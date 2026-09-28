import fs from "node:fs";
import path from "node:path";

const xmlPath = process.argv[2] ? path.resolve(process.argv[2]) : "C:/Users/cellu/Downloads/WotC_5e_only(1).xml";
const outputPath = path.resolve("..", "compendium", "legacy_spells.json");

const xml = fs.readFileSync(xmlPath, "utf8");

// ---- helpers ----

const SCHOOL_MAP: Record<string, string> = {
  A: "Abjuration", C: "Conjuration", D: "Divination", EN: "Enchantment",
  EV: "Evocation", I: "Illusion", N: "Necromancy", T: "Transmutation",
};

const CLASS_TO_LIST: Record<string, string> = {
  Bard: "sl_bard", Cleric: "sl_cleric", Druid: "sl_druid", Paladin: "sl_paladin",
  Ranger: "sl_ranger", Sorcerer: "sl_sorcerer", Warlock: "sl_warlock", Wizard: "sl_wizard",
  Artificer: "sl_artificer",
};

const DAMAGE_KEYWORDS: Record<string, string> = {
  acid: "acid", bludgeoning: "bludgeoning", cold: "cold", fire: "fire", force: "force",
  lightning: "lightning", necrotic: "necrotic", piercing: "piercing", poison: "poison",
  psychic: "psychic", radiant: "radiant", slashing: "slashing", thunder: "thunder",
  healing: "healing", "hit points": "healing", "temporary hit points": "temp_hp",
};

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function tagContent(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return null;
  // Collapse hard-wrapped whitespace (newline + indentation) within short structured fields
  // (name/classes/time/range/etc.) back to single spaces. `text` is handled separately by
  // parseDescriptionAndSource, which needs the raw newlines to detect paragraph breaks.
  const decoded = decodeXmlEntities(m[1]);
  return (tag === "text" ? decoded : decoded.replace(/\s+/g, " ")).trim();
}

function slugify(name: string): string {
  return "s_" + name
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseComponents(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const parts = raw.split(",").map((p) => p.trim());
  const out: Record<string, unknown> = {};
  for (const part of parts) {
    if (part === "V") out.verbal = true;
    else if (part === "S") out.somatic = true;
    else if (part.startsWith("M")) {
      const m = part.match(/^M\s*\(([^)]+)\)/);
      out.material = m ? m[1] : true;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseDuration(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const out: Record<string, unknown> = { description: raw };
  if (/^concentration/i.test(raw)) out.concentration = true;
  return out;
}

function parseAccess(rawClasses: string | null): string[] | undefined {
  if (!rawClasses) return undefined;
  const segments = rawClasses.split(",").map((s) => s.trim());
  const access = new Set<string>();
  for (const seg of segments) {
    if (/^school:/i.test(seg)) continue;
    if (seg === "Ritual Caster") continue;
    if (/\(/.test(seg)) continue; // subclass-qualified entries handled via preparedSpellProgression elsewhere
    const listId = CLASS_TO_LIST[seg];
    if (listId) access.add(listId);
  }
  return access.size > 0 ? [...access] : undefined;
}

function parseRolls(block: string): Array<Record<string, unknown>> | undefined {
  const rolls = [...block.matchAll(/<roll([^>]*)>([^<]*)<\/roll>/g)];
  if (rolls.length === 0) return undefined;
  return rolls.map((m) => {
    const attrs = m[1];
    // The source export leaves an unsubstituted "%0" template placeholder where the
    // spellcasting-ability modifier belongs (e.g. "1d8+%0" for Cure Wounds); the guardrail
    // rejects that literal and the established convention elsewhere in the compendium (see
    // WotC_2024_only.json's Cure Wounds) is the "SPELL" keyword instead.
    const formula = decodeXmlEntities(m[2]).trim().replace(/%\d+/g, "SPELL");
    const descMatch = attrs.match(/description="([^"]*)"/);
    const levelMatch = attrs.match(/level="([^"]*)"/);
    const roll: Record<string, unknown> = { formula };
    if (descMatch) {
      roll.description = descMatch[1];
      const lowerDesc = descMatch[1].toLowerCase();
      for (const [keyword, effect] of Object.entries(DAMAGE_KEYWORDS)) {
        if (lowerDesc.includes(keyword)) { roll.effect = effect; break; }
      }
    }
    if (levelMatch) roll.level = Number(levelMatch[1]);
    return roll;
  });
}

function parseDescriptionAndSource(rawText: string | null): { description: string[]; source?: string } {
  if (!rawText) return { description: [] };
  // Collapse hard-wrapped lines (single newline + leading whitespace) within a paragraph back
  // into one line; keep blank-line-separated paragraphs distinct.
  const normalized = rawText.replace(/\r\n/g, "\n");
  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((p) => p.split("\n").map((line) => line.trim()).filter(Boolean).join(" ").trim())
    .filter(Boolean);
  let source: string | undefined;
  const description: string[] = [];
  for (const p of paragraphs) {
    const sourceMatch = p.match(/^Source:\s*(.+)$/i);
    if (sourceMatch) { source = sourceMatch[1].trim(); continue; }
    description.push(p);
  }
  return { description, source };
}

// ---- main ----

const NON_SPELL_PREFIXES = /^(Invocation|Elemental Discipline|Maneuver|Metamagic|Arcane Shot|Infusion|Rune):/;

const blocks = [...xml.matchAll(/<spell>([\s\S]*?)<\/spell>/g)].map((m) => m[1]);
const skippedNonSpell: string[] = [];
const unrecognizedClassSegments = new Set<string>();

const spells: Record<string, unknown>[] = [];
for (const block of blocks) {
  const name = tagContent(block, "name");
  if (!name) continue;
  if (NON_SPELL_PREFIXES.test(name)) { skippedNonSpell.push(name); continue; }

  const levelRaw = tagContent(block, "level");
  const schoolRaw = tagContent(block, "school");
  const time = tagContent(block, "time");
  const range = tagContent(block, "range");
  const componentsRaw = tagContent(block, "components");
  const durationRaw = tagContent(block, "duration");
  const classesRaw = tagContent(block, "classes");
  const textRaw = tagContent(block, "text");
  const ritualRaw = tagContent(block, "ritual");

  // Track any bare (non-parenthetical, non-"School:"/"Ritual Caster") class-like segment that
  // isn't in our known 9-class map, so it can be reviewed rather than silently dropped.
  if (classesRaw) {
    for (const seg of classesRaw.split(",").map((s) => s.trim())) {
      if (/^school:/i.test(seg) || seg === "Ritual Caster" || /\(/.test(seg)) continue;
      if (seg && !CLASS_TO_LIST[seg]) unrecognizedClassSegments.add(seg);
    }
  }

  const { description, source } = parseDescriptionAndSource(textRaw);

  const spell: Record<string, unknown> = {
    id: slugify(name),
    ruleset: "5e",
    name,
  };
  if (source) spell.source = source;
  if (levelRaw != null) spell.level = Number(levelRaw);
  if (schoolRaw && SCHOOL_MAP[schoolRaw]) spell.school = SCHOOL_MAP[schoolRaw];

  const casting: Record<string, unknown> = {};
  if (time) casting.time = time;
  if (range) casting.range = range;
  const components = parseComponents(componentsRaw);
  if (components) casting.components = components;
  const duration = parseDuration(durationRaw);
  if (duration) casting.duration = duration;
  if (Object.keys(casting).length > 0) spell.casting = casting;

  if (ritualRaw && ritualRaw.toUpperCase() === "YES") spell.ritual = true;

  const access = parseAccess(classesRaw);
  if (access) spell.access = access;

  const rolls = parseRolls(block);
  if (rolls) spell.rolls = rolls;

  spell.description = description.length > 0 ? description : ["(no description text found in source)"];

  spells.push(spell);
}

// Duplicate-id check (shouldn't happen given 0 duplicate names found during exploration, but
// guard against it since ids are derived by slugifying names).
const idCounts = new Map<string, number>();
for (const s of spells) idCounts.set(s.id as string, (idCounts.get(s.id as string) ?? 0) + 1);
const duplicateIds = [...idCounts.entries()].filter(([, c]) => c > 1);

const output = {
  format: "beholden.compendium",
  schema: "grand",
  exportedAt: new Date().toISOString(),
  spells,
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");

console.log("wrote", outputPath);
console.log("spells converted:", spells.length);
console.log("non-spell entries skipped (invocations/maneuvers/etc.):", skippedNonSpell.length);
console.log("unrecognized class-like segments (review these):", [...unrecognizedClassSegments]);
console.log("duplicate ids:", duplicateIds);
console.log("spells with no access list at all:", spells.filter((s) => !s.access).length);
console.log("spells with no casting.duration:", spells.filter((s) => !(s.casting as Record<string, unknown> | undefined)?.duration).length);
