/**
 * Builds one representative level-1 character per class against the canonical compendium and
 * steps it to level 20, auto-resolving every choice it hits. Reports any level where a choice
 * has too few valid candidates, a spell/feature reference doesn't resolve, or the walk throws.
 *
 * This does not replicate the character-creator's exact request/response contract (that logic
 * lives in web-player and isn't cleanly importable into a server-run script). It re-implements
 * just enough choice-resolution to prove the compendium data supports a clean 1-20 walk for
 * every class -- see REMAINING_WORK.md "1. Class and live-play gaps".
 *
 * Scope cuts (deliberate, not oversights):
 *  - Single representative build per class: species Human, background Soldier, first subclass.
 *  - ASI levels always take the ability score increase, never the feat path (feats were already
 *    individually reviewed this session; exercising every feat's own choices here would roughly
 *    double the work for little additional compendium-progression signal).
 *  - `weapon_mastery` choices are checked for shape only, not resolved against a real weapon
 *    pool (no weapon-eligibility catalog is wired up here).
 *  - `feat_choice`/`replacement`-kind choices are skipped (nothing to replace on a fresh single
 *    path; feat choices are the ASI-vs-feat scope cut above).
 *
 * Usage: npx tsx src/scripts/simulateClassProgression.ts [path-to-compendium.json]
 * Run from server/. Defaults to ../compendium/WotC_5e_only.json, with WotC_5e_Items.json and
 * WotC_5e_Spell.json resolved alongside it (same convention used by every migration script this
 * session).
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../lib/dbSchema.js";
import { importNativeCompendiumDocument } from "../services/compendium/nativeCompendium.js";
import { parseStoredGrandEntry } from "../services/compendium/storedCompendium.js";

type JsonRecord = Record<string, unknown>;

const compendiumPath = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("../compendium/WotC_5e_only.json");
const compendiumDir = path.dirname(compendiumPath);
const itemsPath = path.join(compendiumDir, "WotC_5e_Items.json");
const spellsPath = path.join(compendiumDir, "WotC_5e_Spell.json");

const doc = JSON.parse(fs.readFileSync(compendiumPath, "utf8"));
const itemsDoc = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
const spellsDoc = JSON.parse(fs.readFileSync(spellsPath, "utf8"));

const db = new Database(":memory:");
db.exec(SCHEMA_SQL);
importNativeCompendiumDocument(db, itemsDoc);
// Seed spellLists from the target doc's classes first (spells' `access` field validates against
// them), then import spells, then the real import of the full target doc last.
importNativeCompendiumDocument(db, { ...doc, species: [], backgrounds: [], feats: [], classTalents: [] });
importNativeCompendiumDocument(db, spellsDoc);
importNativeCompendiumDocument(db, doc);

function getRow(table: string, id: string, ruleset = "5e"): { data_json: string } | undefined {
  return db.prepare(`SELECT data_json FROM ${table} WHERE id = ? AND ruleset = ?`).get(id, ruleset) as { data_json: string } | undefined;
}

const ALL_SKILLS = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight",
  "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion",
  "Religion", "Sleight of Hand", "Stealth", "Survival",
];
const ALL_TOOLS = [
  "Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies", "Carpenter's Tools",
  "Cartographer's Tools", "Cobbler's Tools", "Cook's Utensils", "Glassblower's Tools",
  "Jeweler's Tools", "Leatherworker's Tools", "Mason's Tools", "Painter's Supplies",
  "Potter's Tools", "Smith's Tools", "Tinker's Tools", "Weaver's Tools", "Woodcarver's Tools",
  "Disguise Kit", "Forgery Kit", "Herbalism Kit", "Navigator's Tools", "Poisoner's Kit",
  "Thieves' Tools", "Dice Set", "Dragonchess Set", "Playing Card Set", "Three-Dragon Ante Set",
  "Bagpipes", "Drum", "Dulcimer", "Flute", "Lute", "Lyre", "Horn", "Pan Flute", "Shawm", "Viol",
  "Land Vehicles", "Water Vehicles",
];
const ALL_LANGUAGES = [
  "Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orcish", "Abyssal",
  "Celestial", "Draconic", "Deep Speech", "Infernal", "Primordial", "Sylvan", "Undercommon",
  "Sign Language", "Thieves' Cant", "Druidic",
];

interface SpellRow { name: string; level: number; school: string | null; access: string[]; }
const allSpells: SpellRow[] = (db.prepare("SELECT data_json FROM compendium_spells WHERE ruleset = '5e'").all() as Array<{ data_json: string }>)
  .map((row) => {
    const entry = JSON.parse(row.data_json) as JsonRecord;
    return {
      name: String(entry.name ?? ""),
      level: Number(entry.level ?? 0),
      school: entry.school == null ? null : String(entry.school),
      access: Array.isArray(entry.access) ? (entry.access as unknown[]).map(String) : [],
    };
  });

interface Issue { level: number; message: string; }

interface CharacterState {
  classId: string;
  className: string;
  subclassId: string | null;
  abilityScores: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  skills: Set<string>;
  tools: Set<string>;
  languages: Set<string>;
  savingThrows: Set<string>;
  knownSpells: Set<string>;
  expertise: Set<string>;
  talentsByKind: Map<string, Set<string>>;
  issues: Issue[];
}

function normalized(s: string) { return s.trim().toLowerCase(); }

function resolveProficiencyChoice(
  choice: JsonRecord,
  char: CharacterState,
  classDetail: JsonRecord,
  level: number,
): void {
  const category = String(choice.category ?? "");
  const count = Number(choice.count ?? 1);
  const ifProficient = choice.ifProficient ? String(choice.ifProficient) : null;
  const taken = category === "skill" ? char.skills : category === "tool" ? char.tools : category === "language" ? char.languages : char.savingThrows;

  if (ifProficient) {
    const has = [char.skills, char.tools, char.savingThrows].some((set) => [...set].some((v) => normalized(v) === normalized(ifProficient)));
    if (!has) return; // matches the runtime's own conditional-offer behavior; not an issue
  }

  let pool: string[];
  const from = choice.from;
  if (Array.isArray(from)) pool = from.map(String);
  else if (from === "class_skills") pool = ((classDetail.proficiencies as JsonRecord | undefined)?.skills as JsonRecord | undefined)?.from as string[] ?? ALL_SKILLS;
  else if (from === "artisan_tools") pool = ALL_TOOLS;
  else pool = category === "skill" ? ALL_SKILLS : category === "tool" ? ALL_TOOLS : category === "language" ? ALL_LANGUAGES : ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];

  const takenKeys = new Set([...taken].map(normalized));
  const candidates = pool.filter((v) => !takenKeys.has(normalized(v)));
  if (candidates.length < count) {
    char.issues.push({ level, message: `proficiency choice (${category}) needs ${count}, only ${candidates.length} candidates available` });
  }
  for (const pick of candidates.slice(0, count)) taken.add(pick);
}

function resolveSpellChoice(choice: JsonRecord, char: CharacterState, level: number): void {
  const lists = Array.isArray(choice.lists) ? (choice.lists as unknown[]).map(String) : [];
  const count = Number(choice.count ?? 1);
  const spellLevel = choice.level == null ? null : Number(choice.level);
  const maxLevel = choice.maxLevel == null ? null : Number(choice.maxLevel);
  const school = choice.school ? String(choice.school) : null;
  const ifKnown = choice.ifKnown ? String(choice.ifKnown) : null;

  if (ifKnown && ![...char.knownSpells].some((s) => normalized(s) === normalized(ifKnown))) return;

  const knownKeys = new Set([...char.knownSpells].map(normalized));
  const candidates = allSpells.filter((s) => {
    if (knownKeys.has(normalized(s.name))) return false;
    if (lists.length && !s.access.some((a) => lists.includes(a))) return false;
    if (spellLevel != null && s.level !== spellLevel) return false;
    if (maxLevel != null && s.level > maxLevel) return false;
    if (school && s.school !== school) return false;
    return true;
  });
  if (candidates.length < count) {
    char.issues.push({ level, message: `spell choice needs ${count}, only ${candidates.length} candidates available (lists=${lists.join(",")}, level=${spellLevel}, maxLevel=${maxLevel}, school=${school})` });
  }
  for (const pick of candidates.slice(0, count)) char.knownSpells.add(pick.name);
}

function resolveExpertiseChoice(choice: JsonRecord, char: CharacterState, level: number): void {
  const known = choice.known as Record<string, number> | undefined;
  const target = known?.[String(level)];
  if (target == null) return;
  const from = Array.isArray(choice.from) ? (choice.from as unknown[]).map(String) : [...char.skills, ...char.tools];
  const alreadyChosen = char.expertise.size;
  const need = target - alreadyChosen;
  if (need <= 0) return;
  const chosenKeys = new Set([...char.expertise].map(normalized));
  const candidates = from.filter((v) => !chosenKeys.has(normalized(v)));
  if (candidates.length < need) {
    char.issues.push({ level, message: `expertise choice needs ${need} more (target ${target}), only ${candidates.length} candidates available` });
  }
  for (const pick of candidates.slice(0, need)) char.expertise.add(pick);
}

function resolveTalentGrant(talent: JsonRecord, char: CharacterState, level: number): void {
  const kind = String(talent.kind);
  const known = talent.known as Record<string, number> | undefined;
  const target = known?.[String(level)];
  if (target == null) return;
  const set = char.talentsByKind.get(kind) ?? new Set<string>();
  char.talentsByKind.set(kind, set);
  const need = target - set.size;
  if (need <= 0) return;
  const rows = db.prepare("SELECT id, data_json FROM compendium_class_talents WHERE ruleset = '5e' AND kind = ?").all(kind) as Array<{ id: string; data_json: string }>;
  const candidates = rows.filter((row) => {
    if (set.has(row.id)) return false;
    const entry = JSON.parse(row.data_json) as JsonRecord;
    const prereq = entry.prerequisite as JsonRecord | undefined;
    if (prereq?.level != null && Number(prereq.level) > level) return false;
    return true;
  });
  if (candidates.length < need) {
    char.issues.push({ level, message: `${kind} talent grant needs ${need} more (target ${target}), only ${candidates.length} eligible candidates` });
  }
  for (const pick of candidates.slice(0, need)) set.add(pick.id);
}

function applyChoices(choices: JsonRecord[], char: CharacterState, classDetail: JsonRecord, level: number): void {
  for (const choice of choices) {
    const kind = String(choice.kind);
    if (kind === "proficiency") resolveProficiencyChoice(choice, char, classDetail, level);
    else if (kind === "spell") resolveSpellChoice(choice, char, level);
    else if (kind === "expertise") resolveExpertiseChoice(choice, char, level);
    else if (kind === "selection") {
      const options = Array.isArray(choice.options) ? choice.options : [];
      const count = Number(choice.count ?? 1);
      if (options.length < count) char.issues.push({ level, message: `selection choice needs ${count}, only ${options.length} options declared` });
    } else if (kind === "weapon_mastery") {
      // Shape-only check; no weapon-eligibility pool is modeled here (see file header).
      if (!choice.known) char.issues.push({ level, message: "weapon_mastery choice missing `known` map" });
    }
    // "feat" and "replacement" kinds are intentionally skipped -- see file header scope cuts.
  }
}

function simulateClass(classId: string): { classId: string; className: string; subclassId: string | null; levelsReached: number; issues: Issue[] } {
  const row = getRow("compendium_classes", classId);
  if (!row) throw new Error(`class not found: ${classId}`);
  const classDetail = parseStoredGrandEntry("classes", row.data_json) as JsonRecord;
  const className = String(classDetail.name);
  const subclassesField = classDetail.subclasses as JsonRecord | undefined;
  const subclassLevel = subclassesField ? Number(subclassesField.level) : null;
  const subclassId = subclassesField ? Object.keys(subclassesField.options as JsonRecord)[0] ?? null : null;

  // Class-wide named choice groups (e.g. Fighting Style): only the first option's features are
  // "chosen" -- every other option's features are structurally-valid alternatives, not applied.
  const skipFeatureIds = new Set<string>();
  for (const group of (classDetail.choices as JsonRecord[] | undefined) ?? []) {
    const options = group.options as JsonRecord[];
    for (const option of options.slice(1)) for (const fid of option.features as string[]) skipFeatureIds.add(fid);
  }

  const char: CharacterState = {
    classId,
    className,
    subclassId: null,
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    skills: new Set(),
    tools: new Set(),
    languages: new Set(),
    savingThrows: new Set((((classDetail.proficiencies as JsonRecord | undefined)?.savingThrows as string[] | undefined) ?? [])),
    knownSpells: new Set(),
    expertise: new Set(),
    talentsByKind: new Map(),
    issues: [],
  };

  const levels = (classDetail.levels as JsonRecord[]).slice().sort((a, b) => Number(a.level) - Number(b.level));
  let levelsReached = 0;
  try {
    for (const levelEntry of levels) {
      const level = Number(levelEntry.level);
      if (level > 20) break;

      if (subclassLevel != null && level >= subclassLevel && char.subclassId == null) char.subclassId = subclassId;

      if (levelEntry.abilityScoreImprovement) {
        char.abilityScores.str = Math.min(20, char.abilityScores.str + 2);
      }

      const features = (levelEntry.features as JsonRecord[] | undefined) ?? [];
      for (const feature of features) {
        const fid = feature.id ? String(feature.id) : null;
        if (fid && skipFeatureIds.has(fid)) continue;
        const featureSubclass = feature.subclass ? String(feature.subclass) : null;
        if (featureSubclass && featureSubclass !== char.subclassId) continue;

        if (feature.talent) resolveTalentGrant(feature.talent as JsonRecord, char, level);
        if (feature.choices) applyChoices(feature.choices as JsonRecord[], char, classDetail, level);

        if (feature.preparedSpellProgression) {
          for (const table of feature.preparedSpellProgression as JsonRecord[]) {
            for (const row2 of (table.rows as JsonRecord[] | undefined) ?? []) {
              if (Number(row2.level) !== level) continue;
              for (const spellName of (row2.spells as string[] | undefined) ?? []) {
                const found = allSpells.some((s) => normalized(s.name) === normalized(spellName));
                if (!found) char.issues.push({ level, message: `preparedSpellProgression references unknown spell "${spellName}"` });
              }
            }
          }
        }
      }

      if (levelEntry.spellSlots && Object.keys(levelEntry.spellSlots as JsonRecord).length === 0) {
        char.issues.push({ level, message: "spellSlots present but empty" });
      }

      levelsReached = level;
    }
  } catch (err) {
    char.issues.push({ level: levelsReached + 1, message: `could not simulate past level ${levelsReached}: ${err instanceof Error ? err.message : String(err)}` });
  }

  return { classId, className, subclassId: char.subclassId, levelsReached, issues: char.issues };
}

const classIds = (db.prepare("SELECT id FROM compendium_classes WHERE ruleset = '5e' ORDER BY id").all() as Array<{ id: string }>).map((r) => r.id);
const results = classIds.map(simulateClass);

const report = {
  classesChecked: results.length,
  classesPassed: results.filter((r) => r.levelsReached === 20 && r.issues.length === 0).length,
  classesFailed: results.filter((r) => r.levelsReached !== 20 || r.issues.length > 0).length,
  results: results.map((r) => ({ ...r, passed: r.levelsReached === 20 && r.issues.length === 0 })),
};

console.log(JSON.stringify(report, null, 2));
if (report.classesFailed > 0) process.exitCode = 1;
