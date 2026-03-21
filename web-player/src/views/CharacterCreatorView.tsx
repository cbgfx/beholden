import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { C, withAlpha } from "@/lib/theme";
import { api, jsonInit } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Select } from "@/ui/Select";
import { IconPlayer } from "@/icons";

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface ClassSummary { id: string; name: string; hd: number | null }
interface ClassDetail {
  id: string; name: string; hd: number | null;
  numSkills: number;        // how many skill proficiencies to pick
  proficiency: string;      // comma-separated skill options
  slotsReset: string;       // "L" = long rest, "S" = short rest (Warlock)
  armor: string; weapons: string;
  description: string;
  autolevels: {
    level: number; scoreImprovement: boolean;
    slots: number[] | null; // [cantrips, L1_slots, L2_slots, ...] or null
    features: { name: string; text: string; optional: boolean }[];
    counters: { name: string; value: number; reset: string }[];
  }[];
}
interface SpellSummary { id: string; name: string; level: number | null; school: string | null; classes: string | null; text: string | null }
interface RaceSummary { id: string; name: string; size: string | null; speed: number | null }
interface RaceDetail {
  id: string; name: string; size: string | null; speed: number | null;
  resist: string | null;
  vision: { type: string; range: number }[];
  traits: { name: string; text: string; category: string | null; modifier: string[] }[];
}
interface BgSummary { id: string; name: string }
interface ProficiencyChoice {
  fixed: string[];
  choose: number;
  from: string[] | null;  // null = "any"
}
interface StructuredBgProficiencies {
  skills: ProficiencyChoice;
  tools: ProficiencyChoice;
  languages: ProficiencyChoice;
  feats: string[];
  abilityScores: string[];
}
interface BgDetail {
  id: string; name: string; proficiency: string;
  proficiencies?: StructuredBgProficiencies;
  traits: { name: string; text: string }[];
  equipment?: string;
}

// Canonical pick lists mirrored from server/src/lib/proficiencyConstants.ts
const ALL_TOOLS = [
  "Alchemist's Supplies","Brewer's Supplies","Calligrapher's Supplies",
  "Carpenter's Tools","Cartographer's Tools","Cobbler's Tools","Cook's Utensils",
  "Glassblower's Tools","Jeweler's Tools","Leatherworker's Tools","Mason's Tools",
  "Painter's Supplies","Potter's Tools","Smith's Tools","Tinker's Tools",
  "Weaver's Tools","Woodcarver's Tools",
  "Disguise Kit","Forgery Kit","Herbalism Kit","Navigator's Tools",
  "Poisoner's Kit","Thieves' Tools",
  "Dice Set","Dragonchess Set","Playing Card Set","Three-Dragon Ante Set",
  "Bagpipes","Drum","Dulcimer","Flute","Lute","Lyre","Horn","Pan Flute","Shawm","Viol",
  "Land Vehicles","Water Vehicles","Sea Vehicles",
];
const ALL_LANGUAGES = [
  "Common","Dwarvish","Elvish","Giant","Gnomish","Goblin","Halfling","Orcish",
  "Abyssal","Celestial","Draconic","Deep Speech","Infernal","Primordial","Sylvan","Undercommon",
  "Sign Language","Thieves' Cant",
];
interface Campaign { id: string; name: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ABILITY_LABELS: Record<string, string> = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_BUY_COSTS: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const POINT_BUY_BUDGET = 27;

function abilityMod(score: number) { return Math.floor((score - 10) / 2); }

const ABILITY_NAME_TO_KEY: Record<string, string> = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
};
function abilityNamesToKeys(names: string[]): string[] {
  return names.map(n => ABILITY_NAME_TO_KEY[n.toLowerCase()] ?? "").filter(Boolean);
}

function calcHpMax(hd: number, level: number, conMod: number): number {
  if (level <= 0) return hd + conMod;
  return hd + conMod + (level - 1) * (Math.floor(hd / 2) + 1 + conMod);
}

function getSubclassLevel(cls: ClassDetail | null): number | null {
  if (!cls) return null;
  for (const al of cls.autolevels) {
    for (const f of al.features) {
      if (/subclass/i.test(f.name) && !f.optional) return al.level;
    }
  }
  return null;
}

function featuresUpToLevel(cls: ClassDetail, level: number) {
  return cls.autolevels
    .filter((al) => al.level != null && al.level <= level)
    .flatMap((al) => al.features.filter((f) => !f.optional).map((f) => ({ ...f, level: al.level })));
}

function getSubclassList(cls: ClassDetail): string[] {
  const names: string[] = [];
  for (const al of cls.autolevels) {
    for (const f of al.features) {
      if (f.optional && /subclass:/i.test(f.name)) {
        const label = f.name.replace(/^[^:]+:\s*/i, "").trim();
        if (label && !names.includes(label)) names.push(label);
      }
    }
  }
  return names;
}

/**
 * Parse an embedded "Level | Count" table from feature text.
 * e.g. "Invocations Known:\nLevel | Invocations\n1 | 1\n2 | 3\n..."
 * Returns sorted [level, count] pairs.
 */
function parseLevelTable(text: string): [number, number][] {
  const pairs: [number, number][] = [];
  let inTable = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!inTable) {
      // The header row has "Level" and "|" (but not all-numeric values)
      if (/\blevel\b/i.test(line) && /\|/.test(line) && !/^\d/.test(line)) { inTable = true; }
      continue;
    }
    const m = line.match(/^(\d+)\s*\|?\s*(\d+)/);
    if (m) { pairs.push([parseInt(m[1]), parseInt(m[2])]); }
    else if (line.length > 0 && !/^\d/.test(line)) { break; } // end of table
  }
  return pairs.sort((a, b) => a[0] - b[0]);
}

/** Get value from a parsed level table at a given character level (highest entry ≤ level). */
function tableValueAtLevel(table: [number, number][], level: number): number {
  let result = 0;
  for (const [lvl, val] of table) { if (lvl <= level) result = val; }
  return result;
}

/** Get the active slots array at a given character level (last autolevel ≤ level that has slots). */
function getSlotsAtLevel(cls: ClassDetail, level: number): number[] | null {
  let best: number[] | null = null;
  for (const al of cls.autolevels) {
    if (al.level != null && al.level <= level && al.slots != null) best = al.slots;
  }
  return best;
}

/** Number of cantrips at this level (first element of slots array). */
function getCantripCount(cls: ClassDetail, level: number): number {
  return getSlotsAtLevel(cls, level)?.[0] ?? 0;
}

/** Highest spell slot level available at this character level. */
function getMaxSlotLevel(cls: ClassDetail, level: number): number {
  const slots = getSlotsAtLevel(cls, level);
  if (!slots) return 0;
  for (let i = slots.length - 1; i >= 1; i--) { if (slots[i] > 0) return i; }
  return 0;
}

/** True if class has any spell slots at any level. */
function isSpellcaster(cls: ClassDetail): boolean {
  return cls.autolevels.some((al) => al.slots != null && al.slots.slice(1).some((s) => s > 0));
}

/**
 * For a non-optional class feature whose name contains a keyword (e.g. "Invocation", "Pact Magic"),
 * find the first such feature text up to the given level and parse its level table.
 */
function getClassFeatureTable(cls: ClassDetail, keyword: string, level: number): [number, number][] {
  for (const al of cls.autolevels) {
    if (al.level == null || al.level > level) continue;
    for (const f of al.features) {
      if (!f.optional && new RegExp(keyword, "i").test(f.name)) {
        const t = parseLevelTable(f.text);
        if (t.length > 0) return t;
      }
    }
  }
  return [];
}

const ABILITY_SCORE_NAMES = new Set([
  "Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma",
]);

/** Parse proficiency string into a skill list, excluding ability score names (those become saving throws). */
function parseSkillList(proficiency: string): string[] {
  return proficiency.split(/[,;]/).map(s => s.trim()).filter(s => s && !ABILITY_SCORE_NAMES.has(s));
}

/**
 * Extract the minimum character level from an invocation prerequisite string.
 * e.g. "Prerequisite: Level 7+ Warlock" → 7
 * Returns 1 if no level prerequisite is found (always available).
 */
function parseInvocationPrereqLevel(text: string): number {
  const m = text.match(/Prerequisite[^:]*:.*?Level\s+(\d+)\+/i);
  return m ? parseInt(m[1], 10) : 1;
}

// ---------------------------------------------------------------------------
// Provenance tracking
// ---------------------------------------------------------------------------

export interface TaggedItem { name: string; source: string }
export interface ProficiencyMap {
  skills: TaggedItem[];
  saves: TaggedItem[];
  armor: TaggedItem[];
  weapons: TaggedItem[];
  tools: TaggedItem[];
  languages: TaggedItem[];
  spells: TaggedItem[];        // cantrips + prepared spells
  invocations: TaggedItem[];
}

/** Compile the full proficiency map with source tags from all wizard selections. */
// ---------------------------------------------------------------------------
// Feature grant parsing
// ---------------------------------------------------------------------------

interface FeatureGrants {
  armor: string[];
  weapons: string[];
  tools: string[];
  skills: string[];
  languages: string[];
}

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Parse proficiency grants out of an optional feature's text blob. */
function parseFeatureGrants(text: string): FeatureGrants {
  const result: FeatureGrants = { armor: [], weapons: [], tools: [], skills: [], languages: [] };
  // Strip source lines and flatten newlines
  const t = text.replace(/Source:.*$/gim, "").replace(/\n/g, " ");

  // Armor — "training with X armor" or "proficiency with X armor"
  const armorRe = /(?:training with|proficiency with)\s+([\w\s,]+?)\s+armor\b/gi;
  let m: RegExpExecArray | null;
  while ((m = armorRe.exec(t)) !== null) {
    m[1].split(/\s+and\s+|,/).map(s => s.trim()).filter(Boolean)
      .forEach(s => { if (!/^all$/i.test(s)) result.armor.push(toTitleCase(s) + " Armor"); else result.armor.push("All Armor"); });
  }

  // Weapons — "proficiency with X weapons" (won't overlap with armor)
  const weapRe = /proficiency with\s+([\w\s,]+?)\s+weapons\b/gi;
  while ((m = weapRe.exec(t)) !== null) {
    m[1].split(/\s+and\s+|,/).map(s => s.trim()).filter(Boolean)
      .forEach(s => result.weapons.push(toTitleCase(s) + " Weapons"));
  }

  // Tools — "proficiency with X Tools/Kit/Instruments/Supplies"
  const toolRe = /proficiency with\s+([\w\s']+?(?:tools?|kit|instruments?|supplies))\b/gi;
  while ((m = toolRe.exec(t)) !== null) {
    result.tools.push(toTitleCase(m[1].trim()));
  }

  // Skills — "proficiency in X" (single known skill name)
  const skillRe = /proficiency in\s+([\w\s]+?)(?:\.|,|\band\b|$)/gi;
  while ((m = skillRe.exec(t)) !== null) {
    result.skills.push(toTitleCase(m[1].trim()));
  }

  // Languages — "learn/speak/know X language"
  const langRe = /(?:learn|speak|know|understand)\s+(?:the\s+)?([\w]+)\s+language/gi;
  while ((m = langRe.exec(t)) !== null) {
    result.languages.push(toTitleCase(m[1]));
  }

  return result;
}

// ---------------------------------------------------------------------------

function buildProficiencyMap(
  form: FormState,
  classDetail: ClassDetail | null,
  raceDetail: RaceDetail | null,
  bgDetail: BgDetail | null,
  classCantrips: SpellSummary[],
  classSpells: SpellSummary[],
  classInvocations: SpellSummary[],
): ProficiencyMap {
  const className = classDetail?.name ?? "";
  const raceName  = raceDetail?.name  ?? "";
  const bgName    = bgDetail?.name    ?? "";

  const splitComma = (s: string) => s.split(/[,;]/).map(x => x.trim()).filter(Boolean);

  const skills:      TaggedItem[] = [];
  const saves:       TaggedItem[] = [];
  const armor:       TaggedItem[] = [];
  const weapons:     TaggedItem[] = [];
  const tools:       TaggedItem[] = [];
  const languages:   TaggedItem[] = [];
  const spells:      TaggedItem[] = [];
  const invocations: TaggedItem[] = [];

  // ── Class ──────────────────────────────────────────────────────────────────
  if (classDetail) {
    splitComma(classDetail.armor).forEach(n => armor.push({ name: n, source: className }));
    splitComma(classDetail.weapons).forEach(n => weapons.push({ name: n, source: className }));

    // Saving throws — primary source: ability score names in <proficiency> field
    // e.g. "Wisdom, Charisma, History, Insight" → Wisdom + Charisma are saves
    splitComma(classDetail.proficiency)
      .filter(n => ABILITY_SCORE_NAMES.has(n))
      .forEach(n => saves.push({ name: n, source: className }));

    // Fallback: some older XMLs encode saves in feature text "Saving Throw Proficiencies: X and Y"
    if (saves.length === 0) {
      outer: for (const al of classDetail.autolevels) {
        for (const f of al.features) {
          if (f.optional) continue;
          const m = f.text.match(/Saving Throw Proficiencies?:\s*([^\n.]+)/i);
          if (m) {
            m[1].split(/,|\s+and\s+/i).map(s => s.trim()).filter(Boolean)
              .forEach(n => saves.push({ name: n, source: className }));
            break outer;
          }
        }
      }
    }
    // Skill choices made in Step 5
    form.chosenSkills.forEach(n => skills.push({ name: n, source: className }));

    // ── Chosen optional features (Step 4 picks) ──────────────────────────────
    // Build a flat map of feature name → text so we can parse grants
    const optFeatureMap: Record<string, string> = {};
    for (const al of classDetail.autolevels) {
      for (const f of al.features) {
        if (f.optional) optFeatureMap[f.name] = f.text;
      }
    }
    for (const fname of form.chosenOptionals) {
      const ftext = optFeatureMap[fname];
      if (!ftext) continue;
      const grants = parseFeatureGrants(ftext);
      grants.armor.forEach(n    => armor.push({ name: n, source: fname }));
      grants.weapons.forEach(n  => weapons.push({ name: n, source: fname }));
      grants.tools.forEach(n    => tools.push({ name: n, source: fname }));
      grants.skills.forEach(n   => skills.push({ name: n, source: fname }));
      grants.languages.forEach(n => languages.push({ name: n, source: fname }));
    }
  }

  // ── Background ─────────────────────────────────────────────────────────────
  if (bgDetail) {
    const prof = bgDetail.proficiencies;
    // Skills — always fixed from <proficiency> field
    const bgSkills = prof ? prof.skills.fixed : splitComma(bgDetail.proficiency);
    bgSkills.forEach(n => skills.push({ name: n, source: bgName }));
    // Tools — fixed grants + chosen picks
    if (prof) {
      prof.tools.fixed.forEach(n => tools.push({ name: n, source: bgName }));
      form.chosenBgTools.forEach(n => tools.push({ name: n, source: bgName }));
      // Languages — fixed grants + chosen picks
      prof.languages.fixed.forEach(n => languages.push({ name: n, source: bgName }));
      form.chosenBgLanguages.forEach(n => languages.push({ name: n, source: bgName }));
    } else {
      // Fallback: old-style trait text parsing
      for (const t of bgDetail.traits) {
        if (/tool/i.test(t.name)) splitComma(t.text).forEach(n => tools.push({ name: n, source: bgName }));
        else if (/language/i.test(t.name)) splitComma(t.text).forEach(n => languages.push({ name: n, source: bgName }));
      }
    }
  }

  // ── Species ────────────────────────────────────────────────────────────────
  if (raceDetail) {
    for (const t of raceDetail.traits) {
      // Modifiers like "language:Common" or "tool:Thieves' Tools"
      for (const mod of t.modifier) {
        const m = mod.match(/^(language|tool|skill)[:\s]+(.+)/i);
        if (m) {
          const val = m[2].trim();
          if (/language/i.test(m[1])) languages.push({ name: val, source: raceName });
          else if (/tool/i.test(m[1]))   tools.push({ name: val, source: raceName });
          else if (/skill/i.test(m[1]))  skills.push({ name: val, source: raceName });
        }
      }
      // Trait named "Languages" — fall back to parsing text
      if (/^languages?$/i.test(t.name) && t.modifier.length === 0) {
        splitComma(t.text).forEach(n => {
          if (n && !/choose/i.test(n)) languages.push({ name: n, source: raceName });
        });
      }
    }
  }

  // ── Spells ─────────────────────────────────────────────────────────────────
  const cantripById = Object.fromEntries(classCantrips.map(s => [s.id, s]));
  const spellById   = Object.fromEntries(classSpells.map(s => [s.id, s]));
  const invocById   = Object.fromEntries(classInvocations.map(s => [s.id, s]));

  form.chosenCantrips.forEach(id => {
    const sp = cantripById[id];
    if (sp) spells.push({ name: sp.name, source: className });
  });
  form.chosenSpells.forEach(id => {
    const sp = spellById[id];
    if (sp) spells.push({ name: sp.name, source: className });
  });
  form.chosenInvocations.forEach(id => {
    const sp = invocById[id];
    if (sp) invocations.push({ name: sp.name, source: className });
  });

  return { skills, saves, armor, weapons, tools, languages, spells, invocations };
}

/** Group optional non-subclass features by level, up to `level`.
 *  Multiple autolevel entries at the same level are merged into one group. */
function getOptionalGroups(cls: ClassDetail, level: number): { level: number; features: { name: string; text: string }[] }[] {
  const map = new Map<number, { name: string; text: string }[]>();
  for (const al of cls.autolevels) {
    if (al.level == null || al.level > level) continue;
    const opts = al.features.filter((f) => f.optional && !/subclass/i.test(f.name) && !/^Becoming\b/i.test(f.name));
    if (opts.length > 0) {
      const existing = map.get(al.level) ?? [];
      map.set(al.level, [...existing, ...opts]);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([lvl, features]) => ({ level: lvl, features }));
}

function pointBuySpent(scores: Record<string, number>): number {
  return ABILITY_KEYS.reduce((sum, k) => {
    const s = Math.min(15, Math.max(8, scores[k] ?? 8));
    return sum + (POINT_BUY_COSTS[s] ?? 0);
  }, 0);
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

type AbilityMethod = "standard" | "pointbuy" | "manual";
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

interface FormState {
  classId: string;
  raceId: string;
  bgId: string;
  level: number;
  subclass: string;
  chosenOptionals: string[];
  // Background tool / language / ability choices (Step 3)
  chosenBgTools: string[];
  chosenBgLanguages: string[];
  bgAbilityMode: "split" | "even";
  bgAbilityBonuses: Record<string, number>; // e.g. { str: 2, dex: 1 } or { str:1, dex:1, con:1 }
  // Skill proficiency selections (up to numSkills)
  chosenSkills: string[];
  // Spellcasting selections
  chosenCantrips: string[];    // spell IDs
  chosenSpells: string[];      // spell IDs (prepared)
  chosenInvocations: string[]; // spell IDs (Eldritch Invocations etc.)
  abilityMethod: AbilityMethod;
  standardAssign: Record<string, number>;
  pbScores: Record<string, number>;
  manualScores: Record<string, number>;
  hpMax: string;
  ac: string;
  speed: string;
  characterName: string;
  playerName: string;
  color: string;
  campaignIds: string[];
}

const DEFAULT_SCORES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

function initForm(user: { name?: string } | null, params: URLSearchParams): FormState {
  const preselectedCampaign = params.get("campaign");
  return {
    classId: "", raceId: "", bgId: "",
    level: 1, subclass: "", chosenOptionals: [],
    chosenBgTools: [], chosenBgLanguages: [], bgAbilityMode: "split", bgAbilityBonuses: {},
    chosenSkills: [], chosenCantrips: [], chosenSpells: [], chosenInvocations: [],
    abilityMethod: "standard",
    standardAssign: { str: -1, dex: -1, con: -1, int: -1, wis: -1, cha: -1 },
    pbScores: { ...DEFAULT_SCORES },
    manualScores: { ...DEFAULT_SCORES },
    hpMax: "", ac: "10", speed: "30",
    characterName: "", playerName: user?.name ?? "",
    color: "#38b6ff",
    campaignIds: preselectedCampaign ? [preselectedCampaign] : [],
  };
}

function resolvedScores(form: FormState): Record<string, number> {
  let base: Record<string, number>;
  if (form.abilityMethod === "manual") base = { ...form.manualScores };
  else if (form.abilityMethod === "pointbuy") base = { ...form.pbScores };
  else {
    base = {};
    for (const k of ABILITY_KEYS) {
      const idx = form.standardAssign[k];
      base[k] = idx >= 0 ? STANDARD_ARRAY[idx] : 8;
    }
  }
  // Apply background ability bonuses
  for (const [k, v] of Object.entries(form.bgAbilityBonuses)) {
    if (k in base) base[k] = (base[k] ?? 0) + v;
  }
  return base;
}

/** Parse primary ability keys from class detail features. */
function getPrimaryAbilityKeys(classDetail: ClassDetail | null): string[] {
  if (!classDetail) return [];
  for (const al of classDetail.autolevels) {
    if (al.level !== 1) continue;
    for (const f of al.features) {
      const m = f.text.match(/Primary Ability:\s*([^\n]+)/i);
      if (m) return abilityNamesToKeys(m[1].split(/,|\s+and\s+/i).map((s) => s.trim()).filter(Boolean));
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function StepHeader({ current, onStepClick }: { current: Step; onStepClick: (s: Step) => void }) {
  const STEPS = ["Class", "Species", "Background", "Level", "Spells", "Ability Scores", "Stats", "Identity", "Assign"];
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 28 }}>
      {STEPS.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === current;
        const done = n < current;
        return (
          <button key={n} type="button"
            onClick={() => onStepClick(n)}
            style={{
              padding: "5px 13px", borderRadius: 20,
              background: active ? C.accentHl : done ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.06)",
              color: active ? C.textDark : done ? C.accentHl : "rgba(160,180,220,0.50)",
              fontWeight: active ? 700 : done ? 600 : 500,
              fontSize: 12,
              border: `1px solid ${active ? C.accentHl : done ? "rgba(56,182,255,0.35)" : "rgba(255,255,255,0.10)"}`,
              cursor: active ? "default" : "pointer",
              transition: "opacity 0.12s, background 0.12s",
            }}>
            {done ? "✓ " : `${n}. `}{label}
          </button>
        );
      })}
    </div>
  );
}

function NavButtons({ step, onBack, onNext, nextLabel = "Next →", nextDisabled = false }: {
  step: Step; onBack: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "space-between" }}>
      <button type="button" onClick={onBack} disabled={step === 1} style={btnStyle(false, step === 1)}>
        ← Back
      </button>
      <button type="button" onClick={onNext} disabled={nextDisabled} style={btnStyle(true, nextDisabled)}>
        {nextLabel}
      </button>
    </div>
  );
}

function btnStyle(primary: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: "9px 22px", borderRadius: 8, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    border: primary ? "none" : "1px solid rgba(255,255,255,0.18)",
    background: disabled
      ? "rgba(255,255,255,0.06)"
      : primary
        ? C.accentHl
        : "rgba(255,255,255,0.08)",
    color: disabled ? "rgba(160,180,220,0.40)" : primary ? C.textDark : C.text,
    fontSize: 14,
    transition: "opacity 0.15s",
  };
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
      {children}
    </div>
  );
}

function SelectableCard({ selected, onClick, title, subtitle }: {
  selected: boolean; onClick: () => void; title: string; subtitle?: string;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "13px 15px", borderRadius: 10, textAlign: "left",
      border: `2px solid ${selected ? C.accentHl : "rgba(255,255,255,0.12)"}`,
      background: selected ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
      color: C.text, cursor: "pointer",
      boxShadow: selected ? `0 0 0 1px ${C.accentHl}22` : "none",
      transition: "border-color 0.12s, background 0.12s",
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: selected ? C.accentHl : C.text }}>{title}</div>
      {subtitle && <div style={{ color: selected ? "rgba(56,182,255,0.75)" : "rgba(160,180,220,0.6)", fontSize: 12, marginTop: 3 }}>{subtitle}</div>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function CharacterCreatorView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams<{ id: string }>();
  const isEditing = Boolean(editId);

  const [step, setStep] = React.useState<Step>(1);
  const [form, setForm] = React.useState<FormState>(() => initForm(user, searchParams));
  const [busy, setBusy] = React.useState(false);
  const [editLoading, setEditLoading] = React.useState(isEditing);
  const [error, setError] = React.useState<string | null>(null);

  // Compendium data
  const [classes, setClasses] = React.useState<ClassSummary[]>([]);
  const [classDetail, setClassDetail] = React.useState<ClassDetail | null>(null);
  const [races, setRaces] = React.useState<RaceSummary[]>([]);
  const [raceDetail, setRaceDetail] = React.useState<RaceDetail | null>(null);
  const [bgs, setBgs] = React.useState<BgSummary[]>([]);
  const [bgDetail, setBgDetail] = React.useState<BgDetail | null>(null);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  // Spell lists (loaded when class is selected)
  const [classCantrips, setClassCantrips] = React.useState<SpellSummary[]>([]);
  const [classSpells, setClassSpells] = React.useState<SpellSummary[]>([]);
  const [classInvocations, setClassInvocations] = React.useState<SpellSummary[]>([]);

  // Track initially-assigned campaigns so we can diff on save in edit mode
  const initialCampaignIdsRef = React.useRef<string[]>([]);

  // Portrait selection (not part of form schema — uploaded separately after save)
  const [portraitFile, setPortraitFile] = React.useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = React.useState<string | null>(null);
  const portraitInputRef = React.useRef<HTMLInputElement>(null);

  // Search states for long lists (hoisted to avoid Rules-of-Hooks violations in inner fns)
  const [classSearch, setClassSearch] = React.useState("");
  const [raceSearch, setRaceSearch] = React.useState("");
  const [bgSearch, setBgSearch] = React.useState("");

  // Load compendium lists on mount
  React.useEffect(() => {
    api<ClassSummary[]>("/api/compendium/classes").then(setClasses).catch(() => {});
    api<RaceSummary[]>("/api/compendium/races").then(setRaces).catch(() => {});
    api<BgSummary[]>("/api/compendium/backgrounds").then(setBgs).catch(() => {});
    api<Campaign[]>("/api/campaigns").then(setCampaigns).catch(() => {});
  }, []);

  // Load existing character when editing
  React.useEffect(() => {
    if (!editId) return;
    api<any>(`/api/me/characters/${editId}`)
      .then((ch) => {
        const cd = ch.characterData ?? {};
        setForm((f) => ({
          ...f,
          classId: cd.classId ?? "",
          raceId: cd.raceId ?? "",
          bgId: cd.bgId ?? "",
          level: ch.level ?? 1,
          subclass: cd.subclass ?? "",
          chosenOptionals: cd.chosenOptionals ?? [],
          chosenSkills: cd.chosenSkills ?? [],
          chosenCantrips: cd.chosenCantrips ?? [],
          chosenSpells: cd.chosenSpells ?? [],
          chosenInvocations: cd.chosenInvocations ?? [],
          abilityMethod: "manual",
          manualScores: {
            str: ch.strScore ?? 10, dex: ch.dexScore ?? 10, con: ch.conScore ?? 10,
            int: ch.intScore ?? 10, wis: ch.wisScore ?? 10, cha: ch.chaScore ?? 10,
          },
          hpMax: String(ch.hpMax ?? 0),
          ac: String(ch.ac ?? 10),
          speed: String(ch.speed ?? 30),
          characterName: ch.name ?? "",
          playerName: ch.playerName ?? "",
          color: ch.color ?? "#38b6ff",
          campaignIds: (ch.campaigns ?? []).map((c: any) => c.campaignId),
        }));
        // Capture so handleSubmit can diff removals
        initialCampaignIdsRef.current = (ch.campaigns ?? []).map((c: any) => c.campaignId);
      })
      .catch(() => {})
      .finally(() => setEditLoading(false));
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load class detail when selected
  React.useEffect(() => {
    if (!form.classId) { setClassDetail(null); return; }
    api<ClassDetail>(`/api/compendium/classes/${form.classId}`).then(setClassDetail).catch(() => {});
  }, [form.classId]);

  // Load spell lists once classDetail is known
  React.useEffect(() => {
    if (!classDetail) { setClassCantrips([]); setClassSpells([]); setClassInvocations([]); return; }
    const name = encodeURIComponent(classDetail.name);
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&level=0&limit=200`).then(setClassCantrips).catch(() => {});
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&minLevel=1&maxLevel=9&limit=300`).then(setClassSpells).catch(() => {});
    // Eldritch Invocations live in their own spell list
    if (/warlock/i.test(classDetail.name)) {
      api<SpellSummary[]>("/api/spells/search?classes=Eldritch+Invocations&limit=200").then(setClassInvocations).catch(() => {});
    } else {
      setClassInvocations([]);
    }
  }, [classDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drop any chosen invocations whose level prerequisite is no longer met
  React.useEffect(() => {
    if (classInvocations.length === 0) return;
    setForm((f) => {
      const valid = new Set(
        classInvocations
          .filter((inv) => parseInvocationPrereqLevel(inv.text ?? "") <= f.level)
          .map((inv) => inv.id)
      );
      const next = f.chosenInvocations.filter((id) => valid.has(id));
      if (next.length === f.chosenInvocations.length) return f;
      return { ...f, chosenInvocations: next };
    });
  }, [form.level, classInvocations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load race detail when selected
  React.useEffect(() => {
    if (!form.raceId) { setRaceDetail(null); return; }
    api<RaceDetail>(`/api/compendium/races/${form.raceId}`).then(setRaceDetail).catch(() => {});
  }, [form.raceId]);

  // Load bg detail when selected
  React.useEffect(() => {
    if (!form.bgId) { setBgDetail(null); return; }
    setForm(f => ({ ...f, chosenBgTools: [], chosenBgLanguages: [], bgAbilityMode: "split", bgAbilityBonuses: {} }));
    api<BgDetail>(`/api/compendium/backgrounds/${form.bgId}`).then(setBgDetail).catch(() => {});
  }, [form.bgId]);

  // Auto-calculate HP, speed when class/race/scores change
  React.useEffect(() => {
    const hd = classDetail?.hd ?? 8;
    const scores = resolvedScores(form);
    const conMod = abilityMod(scores.con ?? 10);
    const hp = calcHpMax(hd, form.level, conMod);
    const baseSpeed = raceDetail?.speed ?? 30;
    setForm((f) => ({ ...f, hpMax: String(hp), speed: String(baseSpeed) }));
  }, [classDetail, raceDetail, form.level, form.abilityMethod, form.standardAssign, form.pbScores, form.manualScores]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit() {
    if (!form.characterName.trim()) { setError("Character name is required."); return; }
    setBusy(true); setError(null);
    try {
      const scores = resolvedScores(form);
      const body = {
        name: form.characterName.trim(),
        playerName: form.playerName.trim(),
        className: classDetail?.name ?? form.characterName,
        species: raceDetail?.name ?? "",
        level: form.level,
        hpMax: Number(form.hpMax) || 0,
        hpCurrent: Number(form.hpMax) || 0,
        ac: Number(form.ac) || 10,
        speed: Number(form.speed) || 30,
        strScore: scores.str, dexScore: scores.dex, conScore: scores.con,
        intScore: scores.int, wisScore: scores.wis, chaScore: scores.cha,
        color: form.color,
        characterData: {
          classId: form.classId, raceId: form.raceId, bgId: form.bgId,
          subclass: form.subclass || null, abilityMethod: form.abilityMethod,
          hd: classDetail?.hd ?? null,
          chosenOptionals: form.chosenOptionals,
          chosenSkills: form.chosenSkills,
          chosenCantrips: form.chosenCantrips,
          chosenSpells: form.chosenSpells,
          chosenInvocations: form.chosenInvocations,
          proficiencies: buildProficiencyMap(
            form, classDetail, raceDetail, bgDetail,
            classCantrips, classSpells, classInvocations
          ),
        },
      };

      let charId: string;
      if (isEditing && editId) {
        await api(`/api/me/characters/${editId}`, jsonInit("PUT", body));
        charId = editId;
      } else {
        const created = await api<{ id: string }>("/api/me/characters", jsonInit("POST", body));
        charId = created.id;
      }

      // In edit mode: unassign any campaigns the user removed
      if (isEditing) {
        const removed = initialCampaignIdsRef.current.filter(
          (id) => !form.campaignIds.includes(id)
        );
        for (const campaignId of removed) {
          await api(`/api/me/characters/${charId}/unassign`, jsonInit("POST", { campaignId }));
        }
      }

      // Assign / sync all currently selected campaigns
      if (form.campaignIds.length > 0) {
        await api(`/api/me/characters/${charId}/assign`, jsonInit("POST", { campaignIds: form.campaignIds }));
      }

      // Upload portrait if one was selected
      if (portraitFile) {
        const fd = new FormData();
        fd.append("image", portraitFile);
        await api(`/api/me/characters/${charId}/image`, { method: "POST", body: fd });
      }

      navigate("/");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save character.");
    } finally {
      setBusy(false);
    }
  }

  // ── Step renderers ──────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      case 1: return StepClass();
      case 2: return StepSpecies();
      case 3: return StepBackground();
      case 4: return StepLevel();
      case 5: return StepSpells();
      case 6: return StepAbilityScores();
      case 7: return StepDerivedStats();
      case 8: return StepIdentity();
      case 9: return StepCampaigns();
    }
  }

  // Step 1: Class
  function StepClass() {
    const filtered = classSearch
      ? classes.filter((c) => c.name.toLowerCase().includes(classSearch.toLowerCase()))
      : classes;

    return (
      <div>
        <h2 style={headingStyle}>Choose a Class</h2>

        {classes.length === 0
          ? <p style={{ color: C.muted }}>No classes found. Ask your DM to upload a class compendium XML.</p>
          : (
            <>
              <input
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                placeholder="Search classes…"
                style={{ ...inputStyle, width: "100%", marginBottom: 12 }}
              />
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 6, maxHeight: 340, overflowY: "auto", paddingRight: 4, marginBottom: 4,
              }}>
                {filtered.length === 0 && (
                  <p style={{ color: C.muted, gridColumn: "1 / -1" }}>No matches.</p>
                )}
                {filtered.map((c) => {
                  const sel = form.classId === c.id;
                  return (
                    <button type="button" key={c.id} onClick={() => set("classId", c.id)} style={{
                      padding: "10px 13px", borderRadius: 8, textAlign: "left",
                      border: `2px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                      background: sel ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                      color: sel ? C.accentHl : C.text, cursor: "pointer",
                      fontWeight: sel ? 700 : 500, fontSize: 13,
                      transition: "border-color 0.12s, background 0.12s",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {c.name}
                      {c.hd && <span style={{ color: "rgba(160,180,220,0.5)", fontSize: 11, marginLeft: 6 }}>d{c.hd}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )
        }

        {classDetail && (() => {
          // Scan ALL level-1 features (including optional) for core traits block
          let primaryAbility = "";
          let savesText = "";
          const allL1Features = classDetail.autolevels
            .filter((al) => al.level === 1)
            .flatMap((al) => al.features);
          for (const f of allL1Features) {
            const fullText = f.text;
            if (!primaryAbility) {
              const m = fullText.match(/Primary Ability:\s*([^\n]+)/i);
              if (m) primaryAbility = m[1].trim();
            }
            if (!savesText) {
              const m = fullText.match(/Saving Throw Proficiencies?:\s*([^\n.]+)/i);
              if (m) savesText = m[1].trim();
            }
            if (primaryAbility && savesText) break;
          }
          return (
            <div style={detailBoxStyle}>
              {/* Name */}
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10, color: C.accentHl }}>
                {classDetail.name}
              </div>

              {/* Description */}
              {classDetail.description && (
                <div style={{ color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.65, marginBottom: 14 }}>
                  {classDetail.description.slice(0, 320)}{classDetail.description.length > 320 ? "…" : ""}
                </div>
              )}

              {/* Key stats row */}
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                {primaryAbility && (
                  <div>
                    <div style={statLabelStyle}>Primary Ability</div>
                    <div style={statValueStyle}>{primaryAbility}</div>
                  </div>
                )}
                {classDetail.hd && (
                  <div>
                    <div style={statLabelStyle}>Hit Die</div>
                    <div style={statValueStyle}>D{classDetail.hd}</div>
                  </div>
                )}
                {savesText && (
                  <div>
                    <div style={statLabelStyle}>Saves</div>
                    <div style={statValueStyle}>{savesText}</div>
                  </div>
                )}
                {classDetail.armor && (
                  <div>
                    <div style={statLabelStyle}>Armor</div>
                    <div style={{ ...statValueStyle, fontSize: 12 }}>{classDetail.armor}</div>
                  </div>
                )}
                {classDetail.weapons && (
                  <div>
                    <div style={statLabelStyle}>Weapons</div>
                    <div style={{ ...statValueStyle, fontSize: 12 }}>{classDetail.weapons}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <NavButtons step={step} onBack={() => {}} onNext={() => setStep(2)}
          nextDisabled={!form.classId} />
      </div>
    );
  }

  // Step 2: Species
  function StepSpecies() {
    const filtered = raceSearch
      ? races.filter((r) => r.name.toLowerCase().includes(raceSearch.toLowerCase()))
      : races;

    return (
      <div>
        <h2 style={headingStyle}>Choose a Species</h2>

        {races.length === 0
          ? <p style={{ color: C.muted }}>No species found in compendium.</p>
          : (
            <>
              <input
                value={raceSearch}
                onChange={(e) => setRaceSearch(e.target.value)}
                placeholder="Search species…"
                style={{ ...inputStyle, width: "100%", marginBottom: 12 }}
              />
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 6, maxHeight: 340, overflowY: "auto", paddingRight: 4, marginBottom: 4,
              }}>
                {filtered.length === 0 && (
                  <p style={{ color: C.muted, gridColumn: "1 / -1" }}>No matches.</p>
                )}
                {filtered.map((r) => {
                  const sel = form.raceId === r.id;
                  return (
                    <button type="button" key={r.id} onClick={() => set("raceId", r.id)} style={{
                      padding: "10px 13px", borderRadius: 8, textAlign: "left",
                      border: `2px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                      background: sel ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                      color: sel ? C.accentHl : C.text, cursor: "pointer",
                      fontWeight: sel ? 700 : 500, fontSize: 13,
                      transition: "border-color 0.12s, background 0.12s",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {r.name}
                      {r.speed && <span style={{ color: "rgba(160,180,220,0.5)", fontSize: 11, marginLeft: 6 }}>{r.speed}ft</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )
        }

        {raceDetail && (
          <div style={detailBoxStyle}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: C.accentHl }}>{raceDetail.name}</div>

            {/* Stats row: size / speed / vision */}
            <div style={{ display: "flex", gap: 20, marginBottom: 10, flexWrap: "wrap" }}>
              {raceDetail.size && (
                <div>
                  <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Size</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{raceDetail.size}</div>
                </div>
              )}
              {raceDetail.speed && (
                <div>
                  <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Speed</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{raceDetail.speed} ft</div>
                </div>
              )}
              {(raceDetail.vision ?? []).map((v) => (
                <div key={v.type}>
                  <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{v.type}</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{v.range} ft</div>
                </div>
              ))}
            </div>

            {/* Traits — skip vision (already shown above) and description */}
            {raceDetail.traits
              .filter((t) => t.category !== "description" && !["darkvision","blindsight","truesight","tremorsense"].includes(t.name.toLowerCase().trim()))
              .slice(0, 5)
              .map((t) => (
                <div key={t.name} style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: C.accentHl }}>{t.name}.</span>{" "}
                  <span style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{t.text.replace(/Source:.*$/m, "").trim().slice(0, 140)}{t.text.length > 140 ? "…" : ""}</span>
                </div>
              ))}
          </div>
        )}

        <NavButtons step={step} onBack={() => setStep(1)} onNext={() => setStep(3)}
          nextDisabled={!form.raceId} />
      </div>
    );
  }

  // Step 3: Background
  function StepBackground() {
    const filtered = bgSearch
      ? bgs.filter((b) => b.name.toLowerCase().includes(bgSearch.toLowerCase()))
      : bgs;

    return (
      <div>
        <h2 style={headingStyle}>Choose a Background</h2>

        {bgs.length === 0
          ? <p style={{ color: C.muted }}>No backgrounds found in compendium.</p>
          : (
            <>
              {/* Search */}
              <input
                value={bgSearch}
                onChange={(e) => setBgSearch(e.target.value)}
                placeholder="Search backgrounds…"
                style={{ ...inputStyle, width: "100%", marginBottom: 12 }}
              />

              {/* 2-column grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
                maxHeight: 340,
                overflowY: "auto",
                paddingRight: 4,
                marginBottom: 4,
              }}>
                {filtered.length === 0 && (
                  <p style={{ color: C.muted, gridColumn: "1 / -1" }}>No matches.</p>
                )}
                {filtered.map((b) => {
                  const sel = form.bgId === b.id;
                  return (
                    <button type="button" key={b.id} onClick={() => set("bgId", b.id)} style={{
                      padding: "10px 13px", borderRadius: 8, textAlign: "left",
                      border: `2px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                      background: sel ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                      color: sel ? C.accentHl : C.text, cursor: "pointer",
                      fontWeight: sel ? 700 : 500, fontSize: 13,
                      transition: "border-color 0.12s, background 0.12s",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{b.name}</button>
                  );
                })}
              </div>
            </>
          )
        }

        {/* Detail panel for selected background */}
        {bgDetail && (() => {
          const prof = bgDetail.proficiencies;
          const skills  = prof?.skills  ?? { fixed: bgDetail.proficiency.split(/[,;]/).map(s=>s.trim()).filter(Boolean), choose: 0, from: null };
          const tools    = prof?.tools    ?? { fixed: [], choose: 0, from: null };
          const langs    = prof?.languages ?? { fixed: [], choose: 0, from: null };
          const flavorTraits = bgDetail.traits.filter((t) => !/tool|language|starting equipment/i.test(t.name)).slice(0, 1);

          // Toggle helper for bg tool/language pickers
          function toggleBgChoice(item: string, key: "chosenBgTools" | "chosenBgLanguages", max: number) {
            setForm(f => {
              const cur = f[key];
              const next = cur.includes(item) ? cur.filter(x => x !== item)
                : cur.length < max ? [...cur, item] : cur;
              return { ...f, [key]: next };
            });
          }

          function ProfPicker({ label, choice, formKey, canonical }: {
            label: string;
            choice: ProficiencyChoice;
            formKey: "chosenBgTools" | "chosenBgLanguages";
            canonical: string[];
          }) {
            const chosen: string[] = form[formKey];
            const options = choice.from ?? canonical;
            return (
              <div style={{ marginBottom: 10 }}>
                <div style={{ marginBottom: 5 }}>
                  <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>{label} </span>
                  <span style={sourceTagStyle}>{bgDetail!.name}</span>
                </div>
                {choice.fixed.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                    {choice.fixed.map(n => <span key={n} style={profChipStyle}>{n}</span>)}
                  </div>
                )}
                {choice.choose > 0 && (
                  <>
                    <div style={{ color: C.muted, fontSize: 11, marginBottom: 5 }}>
                      Choose {choice.choose} ({chosen.length}/{choice.choose})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {options.map(n => {
                        const sel = chosen.includes(n);
                        return (
                          <button key={n} type="button"
                            onClick={() => toggleBgChoice(n, formKey, choice.choose)}
                            style={{
                              fontSize: 11, padding: "3px 9px", borderRadius: 20, cursor: "pointer",
                              border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.15)"}`,
                              background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.04)",
                              color: sel ? C.accentHl : C.muted,
                              fontWeight: sel ? 700 : 400,
                            }}>
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          }

          return (
            <div style={detailBoxStyle}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: C.accentHl }}>
                {bgDetail.name}
              </div>

              {/* Skills — always fixed from <proficiency> field */}
              {skills.fixed.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Skills </span>
                  <span style={sourceTagStyle}>{bgDetail.name}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                    {skills.fixed.map(s => <span key={s} style={profChipStyle}>{s}</span>)}
                  </div>
                </div>
              )}

              {/* Tools */}
              {(tools.fixed.length > 0 || tools.choose > 0) && ProfPicker({
                label: "Tools", choice: tools, formKey: "chosenBgTools", canonical: ALL_TOOLS,
              })}

              {/* Languages */}
              {(langs.fixed.length > 0 || langs.choose > 0) && ProfPicker({
                label: "Languages", choice: langs, formKey: "chosenBgLanguages", canonical: ALL_LANGUAGES,
              })}

              {/* Granted feat */}
              {prof?.feats && prof.feats.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Feat </span>
                  <span style={sourceTagStyle}>{bgDetail.name}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                    {prof.feats.map(f => (
                      <span key={f} style={{ ...profChipStyle, background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.4)", color: "#fb923c" }}>{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Ability score bonus picker */}
              {prof?.abilityScores && prof.abilityScores.length > 0 && (() => {
                const abilityKeys = abilityNamesToKeys(prof.abilityScores);
                const bonuses = form.bgAbilityBonuses;
                const mode = form.bgAbilityMode;

                function setMode(m: "split" | "even") {
                  setForm(f => ({ ...f, bgAbilityMode: m, bgAbilityBonuses: {} }));
                }

                function handleSplitClick(key: string) {
                  setForm(f => {
                    const cur = { ...f.bgAbilityBonuses };
                    if (cur[key]) {
                      // Toggle off
                      delete cur[key];
                      return { ...f, bgAbilityBonuses: cur };
                    }
                    const hasTwoAlready = Object.keys(cur).length >= 2;
                    if (hasTwoAlready) return f; // already have 2 picks
                    const hasPlus2 = Object.values(cur).includes(2);
                    cur[key] = hasPlus2 ? 1 : 2;
                    return { ...f, bgAbilityBonuses: cur };
                  });
                }

                function handleEvenClick(key: string) {
                  setForm(f => {
                    const cur = { ...f.bgAbilityBonuses };
                    if (cur[key]) {
                      delete cur[key];
                    } else if (Object.keys(cur).length < abilityKeys.length) {
                      cur[key] = 1;
                    }
                    return { ...f, bgAbilityBonuses: cur };
                  });
                }

                const splitDone = Object.keys(bonuses).length === 2;
                const evenDone  = Object.keys(bonuses).length === abilityKeys.length;

                return (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Ability Scores </span>
                      <span style={sourceTagStyle}>{bgDetail!.name}</span>
                    </div>

                    {/* Mode toggle */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      {(["split", "even"] as const).map(m => (
                        <button key={m} type="button" onClick={() => setMode(m)} style={{
                          padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 600,
                          border: `1px solid ${mode === m ? "#a78bfa" : "rgba(255,255,255,0.15)"}`,
                          background: mode === m ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
                          color: mode === m ? "#a78bfa" : C.muted,
                        }}>
                          {m === "split" ? "+2 / +1" : "+1 each"}
                        </button>
                      ))}
                    </div>

                    <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>
                      {mode === "split"
                        ? splitDone ? "✓ All bonuses assigned" : !Object.values(bonuses).includes(2) ? "Click to assign +2" : "Click another for +1"
                        : evenDone  ? "✓ All bonuses assigned" : `Click abilities to assign +1 (${Object.keys(bonuses).length}/${abilityKeys.length})`
                      }
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {prof.abilityScores.map((aName) => {
                        const key = ABILITY_NAME_TO_KEY[aName.toLowerCase()] ?? "";
                        const bonus = key ? bonuses[key] : undefined;
                        const isSelected = bonus != null;
                        const canSelect = mode === "split"
                          ? !isSelected && Object.keys(bonuses).length < 2
                          : !isSelected && Object.keys(bonuses).length < abilityKeys.length;

                        return (
                          <button key={aName} type="button"
                            onClick={() => key && (mode === "split" ? handleSplitClick(key) : handleEvenClick(key))}
                            style={{
                              padding: "5px 13px", borderRadius: 20, cursor: canSelect || isSelected ? "pointer" : "default",
                              border: `1px solid ${isSelected ? "#a78bfa" : canSelect ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.12)"}`,
                              background: isSelected ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)",
                              color: isSelected ? "#a78bfa" : canSelect ? "rgba(167,139,250,0.7)" : C.muted,
                              fontSize: 12, fontWeight: isSelected ? 700 : 500,
                              opacity: !canSelect && !isSelected ? 0.45 : 1,
                            }}>
                            {aName}
                            {isSelected && <span style={{ marginLeft: 5, fontWeight: 800 }}>{bonus! > 0 ? `+${bonus}` : bonus}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Starting Equipment */}
              {bgDetail.equipment && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Starting Equipment </span>
                  <span style={sourceTagStyle}>{bgDetail.name}</span>
                  <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 5, lineHeight: 1.6 }}>
                    {bgDetail.equipment}
                  </div>
                </div>
              )}

              {/* Flavor */}
              {flavorTraits.map((t) => (
                <div key={t.name} style={{ marginBottom: 4, fontSize: "var(--fs-small)" }}>
                  <span style={{ fontWeight: 700, color: C.accentHl }}>{t.name}.</span>{" "}
                  <span style={{ color: C.muted }}>{t.text.replace(/Source:.*$/m, "").trim()}</span>
                </div>
              ))}
            </div>
          );
        })()}

        <NavButtons step={step} onBack={() => setStep(2)} onNext={() => setStep(4)}
          nextDisabled={!form.bgId} />
      </div>
    );
  }

  // Step 4: Level
  function StepLevel() {
    const subclassList = classDetail ? getSubclassList(classDetail) : [];
    const scNeeded = classDetail ? (getSubclassLevel(classDetail) ?? 99) : 99;
    const showSubclass = classDetail && form.level >= scNeeded && subclassList.length > 0;
    const features = classDetail ? featuresUpToLevel(classDetail, form.level) : [];
    const optGroups = classDetail ? getOptionalGroups(classDetail, form.level) : [];

    function toggleOptional(name: string, exclusive: boolean, groupFeatures: string[]) {
      setForm((f) => {
        let next = [...f.chosenOptionals];
        if (exclusive) {
          // Remove all others in this group first, then toggle this one
          next = next.filter((n) => !groupFeatures.includes(n));
          if (!f.chosenOptionals.includes(name)) next.push(name);
        } else {
          if (next.includes(name)) next = next.filter((n) => n !== name);
          else next.push(name);
        }
        return { ...f, chosenOptionals: next };
      });
    }

    return (
      <div>
        <h2 style={headingStyle}>Choose Level</h2>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
          <label style={{ color: C.muted, fontWeight: 600 }}>Level</label>
          <input type="number" min={1} max={20} value={form.level}
            onChange={(e) => set("level", Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
            style={{ ...inputStyle, width: 80 }} />
        </div>

        {showSubclass && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...labelStyle }}>Subclass</label>
            <Select value={form.subclass} onChange={(e) => set("subclass", e.target.value)} style={{ width: 280 }}>
              <option value="">— Choose subclass —</option>
              {subclassList.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        )}

        {/* Optional feature choices */}
        {optGroups.map((grp) => {
          const names = grp.features.map((f) => f.name);
          const isPickOne = grp.features.length <= 4;
          return (
            <div key={grp.level} style={{ marginBottom: 20 }}>
              <div style={{ ...labelStyle, marginBottom: 8 }}>
                Level {grp.level} — {isPickOne ? "Choose one" : "Choose any"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {grp.features.map((f) => {
                  const chosen = form.chosenOptionals.includes(f.name);
                  const grants = parseFeatureGrants(f.text);
                  const grantBadges: { label: string; color: string }[] = [
                    ...grants.armor.map(n    => ({ label: n,              color: "#a78bfa" })), // purple
                    ...grants.weapons.map(n  => ({ label: n,              color: "#f87171" })), // red
                    ...grants.tools.map(n    => ({ label: n,              color: "#fb923c" })), // orange
                    ...grants.skills.map(n   => ({ label: n,              color: "#34d399" })), // green
                    ...grants.languages.map(n => ({ label: n + " (lang)", color: "#60a5fa" })), // blue
                  ];
                  return (
                    <button key={f.name} type="button"
                      onClick={() => toggleOptional(f.name, isPickOne, names)}
                      style={{
                        textAlign: "left", padding: "11px 14px", borderRadius: 8, cursor: "pointer",
                        border: `2px solid ${chosen ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                        background: chosen ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                        transition: "border-color 0.12s, background 0.12s",
                      }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: chosen ? C.accentHl : C.text }}>
                        {f.name}
                      </div>
                      {f.text && (
                        <div style={{ color: "rgba(160,180,220,0.65)", fontSize: 12, marginTop: 3, lineHeight: 1.45 }}>
                          {f.text.replace(/Source:.*$/m, "").trim().slice(0, 140)}
                          {f.text.length > 140 ? "…" : ""}
                        </div>
                      )}
                      {grantBadges.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
                          {grantBadges.map((b, i) => (
                            <span key={i} style={{
                              fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 20,
                              background: b.color + "22", border: `1px solid ${b.color}66`,
                              color: b.color, letterSpacing: "0.02em",
                            }}>
                              {b.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Feature list */}
        <div style={{ ...detailBoxStyle, maxHeight: 260, overflowY: "auto" }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Class Features — Level {form.level}</div>
          {features.length === 0 && <div style={{ color: C.muted, fontSize: 12 }}>No features yet.</div>}
          {features.map((f, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: C.accentHl }}>Lv{f.level} · {f.name}</div>
              <div style={{ color: "rgba(160,180,220,0.65)", fontSize: 12, lineHeight: 1.4 }}>
                {f.text.slice(0, 200)}{f.text.length > 200 ? "…" : ""}
              </div>
            </div>
          ))}
        </div>

        <NavButtons step={step} onBack={() => setStep(3)} onNext={() => setStep(5)} />
      </div>
    );
  }

  // Step 5: Spells & Invocations
  function StepSpells() {
    const cantripCount = classDetail ? getCantripCount(classDetail, form.level) : 0;
    const maxSlotLvl   = classDetail ? getMaxSlotLevel(classDetail, form.level) : 0;
    const isCaster = classDetail ? isSpellcaster(classDetail) : false;

    // Invocations: parse known count from the Eldritch Invocations feature text
    const invocTable = classDetail ? getClassFeatureTable(classDetail, "Invocation", 1) : [];
    const invocCount = invocTable.length > 0 ? tableValueAtLevel(invocTable, form.level) : 0;

    // Prepared spells: parse count from Pact Magic / Spellcasting feature text
    const prepTable = classDetail ? getClassFeatureTable(classDetail, "Pact Magic|Spellcasting", 1) : [];
    const prepCount = prepTable.length > 0 ? tableValueAtLevel(prepTable, form.level) : 0;

    const skillList = classDetail ? parseSkillList(classDetail.proficiency) : [];
    const numSkills = classDetail?.numSkills ?? 0;

    function toggleSpell(id: string, listKey: "chosenCantrips" | "chosenSpells" | "chosenInvocations", max: number) {
      setForm((f) => {
        const current = f[listKey];
        const next = current.includes(id)
          ? current.filter((x) => x !== id)
          : current.length < max ? [...current, id] : current;
        return { ...f, [listKey]: next };
      });
    }

    const hasAnything = isCaster || numSkills > 0 || invocCount > 0;

    return (
      <div>
        <h2 style={headingStyle}>Spells &amp; Skills</h2>

        {/* Skill proficiencies */}
        {numSkills > 0 && skillList.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <div style={{ ...labelStyle, margin: 0 }}>
                Skill Proficiencies{" "}
                {classDetail && <span style={sourceTagStyle}>from {classDetail.name}</span>}
              </div>
              <span style={{ fontSize: 12, color: form.chosenSkills.length >= numSkills ? C.accentHl : C.muted }}>
                {form.chosenSkills.length} / {numSkills}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {skillList.map((skill) => {
                const sel = form.chosenSkills.includes(skill);
                const locked = !sel && form.chosenSkills.length >= numSkills;
                return (
                  <button key={skill} type="button" disabled={locked}
                    onClick={() => setForm((f) => ({
                      ...f,
                      chosenSkills: sel
                        ? f.chosenSkills.filter(s => s !== skill)
                        : f.chosenSkills.length < numSkills ? [...f.chosenSkills, skill] : f.chosenSkills,
                    }))}
                    style={{
                      padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: locked ? "default" : "pointer",
                      border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                      background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                      color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                      fontWeight: sel ? 700 : 400,
                    }}>
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Cantrips */}
        {isCaster && cantripCount > 0 && (
          <SpellPicker
            title="Cantrips" spells={classCantrips} chosen={form.chosenCantrips}
            max={cantripCount} emptyMsg="No cantrips found in compendium for this class."
            onToggle={(id) => toggleSpell(id, "chosenCantrips", cantripCount)}
          />
        )}

        {/* Eldritch Invocations — filtered to those whose level prerequisite is met */}
        {invocCount > 0 && classInvocations.length > 0 && (
          <SpellPicker
            title="Eldritch Invocations" chosen={form.chosenInvocations}
            spells={classInvocations.filter(
              (inv) => parseInvocationPrereqLevel(inv.text ?? "") <= form.level
            )}
            max={invocCount} emptyMsg="No invocations available at this level."
            onToggle={(id) => toggleSpell(id, "chosenInvocations", invocCount)}
          />
        )}

        {/* Prepared Spells */}
        {isCaster && prepCount > 0 && maxSlotLvl > 0 && (
          <SpellPicker
            title={`Prepared Spells (up to level ${maxSlotLvl})`}
            spells={classSpells.filter((s) => s.level != null && s.level <= maxSlotLvl)}
            chosen={form.chosenSpells} max={prepCount}
            emptyMsg="No spells found in compendium for this class."
            onToggle={(id) => toggleSpell(id, "chosenSpells", prepCount)}
          />
        )}

        {!hasAnything && (
          <p style={{ color: C.muted, fontSize: 14 }}>This class has no spellcasting or skill choices at this level.</p>
        )}

        <NavButtons step={step} onBack={() => setStep(4)} onNext={() => setStep(6)} />
      </div>
    );
  }

  // Step 6: Ability Scores
  function StepAbilityScores() {
    const usedIndices = Object.values(form.standardAssign).filter((v) => v >= 0);
    const spent = pointBuySpent(form.pbScores);
    const remaining = POINT_BUY_BUDGET - spent;
    const primaryKeys = getPrimaryAbilityKeys(classDetail);
    const bgBonuses = form.bgAbilityBonuses;
    const hasBgBonuses = Object.keys(bgBonuses).length > 0;

    /** Label for each ability showing the base score + bg bonus annotation */
    function AbilityLabel({ k }: { k: string }) {
      const bonus = bgBonuses[k];
      const isPrimary = primaryKeys.includes(k);
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{
            color: isPrimary ? "#fbbf24" : C.muted,
            fontSize: "var(--fs-small)", fontWeight: isPrimary ? 800 : 600,
          }}>
            {ABILITY_LABELS[k]}
          </span>
          {isPrimary && <span style={{ fontSize: 10, color: "#fbbf24", opacity: 0.75 }}>★ Primary</span>}
          {bonus != null && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10,
              background: "rgba(167,139,250,0.18)", border: "1px solid rgba(167,139,250,0.4)",
              color: "#a78bfa",
            }}>
              +{bonus} {bgDetail?.name ?? "bg"}
            </span>
          )}
        </div>
      );
    }

    return (
      <div>
        <h2 style={headingStyle}>Ability Scores</h2>

        {hasBgBonuses && (
          <div style={{ ...detailBoxStyle, marginBottom: 16, padding: "10px 14px" }}>
            <span style={{ fontSize: 12, color: "#a78bfa" }}>
              Background bonuses applied:{" "}
              {Object.entries(bgBonuses).map(([k, v]) => `${ABILITY_LABELS[k]} +${v}`).join(", ")}
            </span>
          </div>
        )}

        {/* Method tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {(["standard", "pointbuy", "manual"] as AbilityMethod[]).map((m) => (
            <button key={m} type="button" onClick={() => set("abilityMethod", m)} style={{
              padding: "7px 16px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${form.abilityMethod === m ? C.accentHl : "rgba(255,255,255,0.14)"}`,
              background: form.abilityMethod === m ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
              color: form.abilityMethod === m ? C.accentHl : "rgba(160,180,220,0.7)",
              fontWeight: form.abilityMethod === m ? 700 : 500, fontSize: 13,
            }}>
              {m === "standard" ? "Standard Array" : m === "pointbuy" ? "Point Buy" : "Manual"}
            </button>
          ))}
        </div>

        {form.abilityMethod === "standard" && (
          <div>
            <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 12 }}>
              Assign each value to one ability: {STANDARD_ARRAY.join(", ")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {ABILITY_KEYS.map((k) => {
                const assigned = form.standardAssign[k];
                const baseVal = assigned >= 0 ? STANDARD_ARRAY[assigned] : undefined;
                const totalVal = baseVal != null ? baseVal + (bgBonuses[k] ?? 0) : undefined;
                return (
                  <div key={k} style={{
                    padding: "8px", borderRadius: 8,
                    border: `1px solid ${primaryKeys.includes(k) ? "rgba(251,191,36,0.3)" : "transparent"}`,
                    background: primaryKeys.includes(k) ? "rgba(251,191,36,0.05)" : "transparent",
                  }}>
                    <AbilityLabel k={k} />
                    <Select value={assigned >= 0 ? String(assigned) : ""} onChange={(e) => {
                      const idx = e.target.value === "" ? -1 : Number(e.target.value);
                      setForm((f) => ({ ...f, standardAssign: { ...f.standardAssign, [k]: idx } }));
                    }} style={{ width: "100%" }}>
                      <option value="">—</option>
                      {STANDARD_ARRAY.map((v, i) => (
                        !usedIndices.includes(i) || i === assigned
                          ? <option key={i} value={String(i)}>{v}</option>
                          : null
                      ))}
                    </Select>
                    <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2, textAlign: "center" }}>
                      {totalVal != null
                        ? <>
                            {baseVal !== totalVal && <span style={{ color: "#a78bfa", marginRight: 4 }}>{totalVal}</span>}
                            {`mod ${abilityMod(totalVal) >= 0 ? "+" : ""}${abilityMod(totalVal)}`}
                          </>
                        : null
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {form.abilityMethod === "pointbuy" && (
          <div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <span style={{ color: C.muted, fontSize: "var(--fs-small)" }}>Points remaining:</span>
              <span style={{ fontWeight: 700, color: remaining < 0 ? C.red : C.accentHl }}>{remaining} / {POINT_BUY_BUDGET}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {ABILITY_KEYS.map((k) => {
                const score = form.pbScores[k] ?? 8;
                const total = score + (bgBonuses[k] ?? 0);
                return (
                  <div key={k} style={{
                    textAlign: "center", padding: "8px", borderRadius: 8,
                    border: `1px solid ${primaryKeys.includes(k) ? "rgba(251,191,36,0.3)" : "transparent"}`,
                    background: primaryKeys.includes(k) ? "rgba(251,191,36,0.05)" : "transparent",
                  }}>
                    <AbilityLabel k={k} />
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                      <button type="button" disabled={score <= 8} onClick={() => setForm((f) => ({ ...f, pbScores: { ...f.pbScores, [k]: score - 1 } }))}
                        style={{ ...smallBtnStyle, opacity: score <= 8 ? 0.4 : 1 }}>−</button>
                      <span style={{ fontWeight: 700, minWidth: 24 }}>
                        {score}
                        {bgBonuses[k] ? <span style={{ color: "#a78bfa", fontSize: 11 }}> ({total})</span> : null}
                      </span>
                      <button type="button" disabled={score >= 15 || remaining < (POINT_BUY_COSTS[score + 1] ?? 99) - (POINT_BUY_COSTS[score] ?? 0)}
                        onClick={() => setForm((f) => ({ ...f, pbScores: { ...f.pbScores, [k]: score + 1 } }))}
                        style={{ ...smallBtnStyle, opacity: (score >= 15 || remaining < (POINT_BUY_COSTS[score + 1] ?? 99) - (POINT_BUY_COSTS[score] ?? 0)) ? 0.4 : 1 }}>+</button>
                    </div>
                    <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>
                      mod {abilityMod(total) >= 0 ? "+" : ""}{abilityMod(total)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {form.abilityMethod === "manual" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {ABILITY_KEYS.map((k) => {
              const score = form.manualScores[k] ?? 10;
              const total = score + (bgBonuses[k] ?? 0);
              return (
                <div key={k} style={{
                  padding: "8px", borderRadius: 8,
                  border: `1px solid ${primaryKeys.includes(k) ? "rgba(251,191,36,0.3)" : "transparent"}`,
                  background: primaryKeys.includes(k) ? "rgba(251,191,36,0.05)" : "transparent",
                }}>
                  <AbilityLabel k={k} />
                  <input type="number" value={score}
                    onChange={(e) => setForm((f) => ({ ...f, manualScores: { ...f.manualScores, [k]: Number(e.target.value) || 10 } }))}
                    style={{ ...inputStyle, width: "100%" }} />
                  <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>
                    {bgBonuses[k] ? <span style={{ color: "#a78bfa" }}>{total} · </span> : null}
                    mod {abilityMod(total) >= 0 ? "+" : ""}{abilityMod(total)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <NavButtons step={step} onBack={() => setStep(5)} onNext={() => setStep(7)} />
      </div>
    );
  }

  // Step 6: Derived Stats
  function StepDerivedStats() {
    const scores = resolvedScores(form);
    const conMod = abilityMod(scores.con ?? 10);
    const dexMod = abilityMod(scores.dex ?? 10);
    const hd = classDetail?.hd ?? 8;
    return (
      <div>
        <h2 style={headingStyle}>Combat Stats</h2>
        <p style={{ color: C.muted, marginBottom: 16 }}>Auto-calculated from your choices — override freely.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>HP Max</label>
            <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>
              d{hd} + {conMod >= 0 ? "+" : ""}{conMod} CON × lvl {form.level}
            </div>
            <input type="number" value={form.hpMax} onChange={(e) => set("hpMax", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div>
            <label style={labelStyle}>Armor Class</label>
            <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>
              10 + {dexMod >= 0 ? "+" : ""}{dexMod} DEX (base)
            </div>
            <input type="number" value={form.ac} onChange={(e) => set("ac", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div>
            <label style={labelStyle}>Speed (ft)</label>
            <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>
              From species ({raceDetail?.speed ?? 30} ft)
            </div>
            <input type="number" value={form.speed} onChange={(e) => set("speed", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </div>
        </div>
        {/* Proficiency summary */}
        {(() => {
          const prof = buildProficiencyMap(
            form, classDetail, raceDetail, bgDetail,
            classCantrips, classSpells, classInvocations,
          );
          const sections = [
            { label: "Skills",      items: prof.skills },
            { label: "Saves",       items: prof.saves },
            { label: "Armor",       items: prof.armor },
            { label: "Weapons",     items: prof.weapons },
            { label: "Tools",       items: prof.tools },
            { label: "Languages",   items: prof.languages },
            { label: "Spells",      items: prof.spells },
            { label: "Invocations", items: prof.invocations },
          ].filter((s) => s.items.length > 0);
          if (sections.length === 0) return null;
          return (
            <div style={{ ...detailBoxStyle, marginTop: 24 }}>
              <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13 }}>Your Proficiencies</div>
              {sections.map((s) => (
                <div key={s.label} style={{ marginBottom: 10 }}>
                  <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>{s.label}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {s.items.map((item, i) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={profChipStyle}>{item.name}</span>
                        <span style={sourceTagStyle}>{item.source}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        <NavButtons step={step} onBack={() => setStep(6)} onNext={() => setStep(8)} />
      </div>
    );
  }

  // Step 7: Identity
  function StepIdentity() {
    const COLORS = ["#38b6ff", "#5ecb6b", "#f0a500", "#ff5d5d", "#a78bfa", "#fb923c", "#e879f9", "#94a3b8"];

    function handlePortraitChange(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setPortraitFile(file);
      const url = URL.createObjectURL(file);
      setPortraitPreview(url);
    }

    return (
      <div>
        <h2 style={headingStyle}>Character Identity</h2>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>

          {/* Portrait picker */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <input ref={portraitInputRef} type="file" accept="image/*" onChange={handlePortraitChange} style={{ display: "none" }} />
            <div
              onClick={() => portraitInputRef.current?.click()}
              style={{
                width: 110, height: 110, borderRadius: 12, cursor: "pointer",
                border: `2px dashed ${portraitPreview ? C.accentHl : "rgba(255,255,255,0.25)"}`,
                background: portraitPreview ? "#000" : "rgba(255,255,255,0.04)",
                overflow: "hidden", position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title="Click to set portrait"
            >
              {portraitPreview
                ? <img src={portraitPreview} alt="Portrait" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <IconPlayer size={48} style={{ opacity: 0.3 }} />
              }
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(0,0,0,0)",
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                paddingBottom: 6,
              }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.55)", padding: "2px 6px", borderRadius: 4 }}>
                  {portraitPreview ? "Change" : "Add photo"}
                </span>
              </div>
            </div>
            {portraitPreview && (
              <button type="button" onClick={() => { setPortraitFile(null); setPortraitPreview(null); }}
                style={{ fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer" }}>
                Remove
              </button>
            )}
          </div>

          {/* Name + color */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minWidth: 220 }}>
            <div>
              <label style={labelStyle}>Character Name *</label>
              <input
                value={form.characterName}
                onChange={(e) => set("characterName", e.target.value)}
                placeholder="Thraxil the Destroyer"
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>
            <div>
              <label style={labelStyle}>Player Name</label>
              <input
                value={form.playerName}
                onChange={(e) => set("playerName", e.target.value)}
                placeholder="Your name"
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>
            <div>
              <label style={labelStyle}>Color</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => set("color", c)} style={{
                    width: 30, height: 30, borderRadius: "50%", background: c,
                    border: `3px solid ${form.color === c ? C.text : "transparent"}`,
                    cursor: "pointer", padding: 0,
                    boxShadow: form.color === c ? `0 0 0 1px ${c}` : "none",
                  }} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <NavButtons step={step} onBack={() => setStep(7)} onNext={() => setStep(9)}
          nextDisabled={!form.characterName.trim()} />
      </div>
    );
  }

  // Step 8: Campaigns
  function StepCampaigns() {
    return (
      <div>
        <h2 style={headingStyle}>Assign to Campaigns</h2>
        <p style={{ color: C.muted, marginBottom: 16 }}>Optional — you can assign later from your home page.</p>
        {campaigns.length === 0 && <p style={{ color: C.muted }}>You're not a member of any campaigns yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {campaigns.map((c) => {
            const checked = form.campaignIds.includes(c.id);
            return (
              <label key={c.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "11px 15px",
                borderRadius: 8, cursor: "pointer",
                border: `2px solid ${checked ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                background: checked ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                transition: "border-color 0.12s, background 0.12s",
              }}>
                <input type="checkbox" checked={checked} onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    campaignIds: e.target.checked
                      ? [...f.campaignIds, c.id]
                      : f.campaignIds.filter((id) => id !== c.id),
                  }));
                }} style={{ accentColor: C.accentHl, width: 16, height: 16 }} />
                <span style={{ fontWeight: 600 }}>{c.name}</span>
              </label>
            );
          })}
        </div>

        {error && <div style={{ color: C.red, marginBottom: 10 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <button type="button" onClick={() => setStep(8)} style={btnStyle(false, false)}>← Back</button>
          <button type="button" onClick={handleSubmit} disabled={busy} style={btnStyle(true, busy)}>
            {busy ? "Saving…" : isEditing ? "Save Changes ✓" : "Create Character ✓"}
          </button>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (editLoading) {
    return (
      <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px", color: C.muted }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 28px" }}>
        <h1 style={{ fontWeight: 900, fontSize: "var(--fs-hero)", margin: "0 0 8px", letterSpacing: -0.5 }}>
          {isEditing ? "Edit Character" : "Create Character"}
        </h1>
        <p style={{ margin: "0 0 24px", color: "rgba(160,180,220,0.55)", fontSize: 13 }}>
          {isEditing ? "Update your character details below." : "Build your character step by step."}
        </p>
        <StepHeader current={step} onStepClick={(s) => setStep(s)} />
        {renderStep()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpellPicker — module-level so its identity is stable across renders.
// Must NOT be defined inside CharacterCreatorView: it has useState, so calling
// it conditionally as a plain function would violate Rules of Hooks.
// ---------------------------------------------------------------------------

function SpellPicker({ title, spells, chosen, max, emptyMsg, onToggle }: {
  title: string;
  spells: SpellSummary[];
  chosen: string[];
  max: number;
  emptyMsg: string;
  onToggle: (id: string) => void;
}) {
  const [q, setQ] = React.useState("");
  const filtered = q ? spells.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())) : spells;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <div style={{ ...labelStyle, margin: 0 }}>{title}</div>
        <span style={{ fontSize: 12, color: chosen.length >= max ? C.accentHl : C.muted }}>
          {chosen.length} / {max}
        </span>
      </div>
      {spells.length === 0
        ? <p style={{ color: C.muted, fontSize: 12 }}>{emptyMsg}</p>
        : <>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            style={{ ...inputStyle, width: "100%", marginBottom: 8 }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 200, overflowY: "auto", padding: "2px 0" }}>
            {filtered.map((sp) => {
              const sel = chosen.includes(sp.id);
              const locked = !sel && chosen.length >= max;
              return (
                <button key={sp.id} type="button" disabled={locked}
                  onClick={() => onToggle(sp.id)}
                  style={{
                    padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: locked ? "default" : "pointer",
                    border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                    background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                    color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                    fontWeight: sel ? 700 : 400,
                  }}>
                  {sp.name}
                  {sp.level != null && sp.level > 0
                    ? <span style={{ color: "rgba(160,180,220,0.5)", marginLeft: 4 }}>(L{sp.level})</span>
                    : null}
                </button>
              );
            })}
          </div>
        </>
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const headingStyle: React.CSSProperties = {
  fontWeight: 900, fontSize: "var(--fs-large)", margin: "0 0 16px",
};

const detailBoxStyle: React.CSSProperties = {
  marginTop: 14, padding: "14px 16px", borderRadius: 10,
  background: "rgba(56,182,255,0.06)",
  border: "1px solid rgba(56,182,255,0.20)",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.35)", color: C.text,
  border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8,
  padding: "8px 11px", outline: "none", fontSize: 14,
};

const labelStyle: React.CSSProperties = {
  color: C.muted, fontSize: "var(--fs-small)", display: "block", marginBottom: 6, fontWeight: 600,
};

const smallBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)", color: C.text, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
};

/** Uppercase label above a key stat value (Hit Die, Saves, etc.). */
const statLabelStyle: React.CSSProperties = {
  color: "rgba(160,180,220,0.5)",
  fontSize: 10, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: 0.6,
  marginBottom: 3,
};

/** Value beneath a stat label. */
const statValueStyle: React.CSSProperties = {
  color: C.text,
  fontSize: 14, fontWeight: 700,
};

/** A chip showing a proficiency name. */
const profChipStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600,
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 4, padding: "2px 8px",
  color: C.text,
};

/** A tiny source-attribution badge shown after a proficiency chip. */
const sourceTagStyle: React.CSSProperties = {
  fontSize: 10,
  background: "rgba(56,182,255,0.12)",
  border: "1px solid rgba(56,182,255,0.25)",
  borderRadius: 4, padding: "2px 6px",
  color: C.accentHl, fontWeight: 500,
};
