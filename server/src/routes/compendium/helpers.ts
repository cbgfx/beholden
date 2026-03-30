// server/src/routes/compendium/helpers.ts
// Shared schemas, builders, and small utilities for compendium routes.

import { z } from "zod";

export const BlockSchema = z.object({ name: z.string(), text: z.string() });

export const MonsterBody = z.object({
  name: z.string().trim().min(1),
  cr: z.string().trim().nullable().optional(),
  typeFull: z.string().trim().nullable().optional(),
  size: z.string().trim().nullable().optional(),
  environment: z.string().trim().nullable().optional(),
  ac: z.string().trim().nullable().optional(),
  hp: z.string().trim().nullable().optional(),
  speed: z.string().trim().nullable().optional(),
  str: z.number().nullable().optional(),
  dex: z.number().nullable().optional(),
  con: z.number().nullable().optional(),
  int: z.number().nullable().optional(),
  wis: z.number().nullable().optional(),
  cha: z.number().nullable().optional(),
  save: z.string().trim().nullable().optional(),
  skill: z.string().trim().nullable().optional(),
  senses: z.string().trim().nullable().optional(),
  languages: z.string().trim().nullable().optional(),
  immune: z.string().trim().nullable().optional(),
  resist: z.string().trim().nullable().optional(),
  vulnerable: z.string().trim().nullable().optional(),
  conditionImmune: z.string().trim().nullable().optional(),
  trait:     z.array(BlockSchema).optional(),
  action:    z.array(BlockSchema).optional(),
  reaction:  z.array(BlockSchema).optional(),
  legendary: z.array(BlockSchema).optional(),
});

export const ItemBody = z.object({
  name: z.string().trim().min(1),
  rarity: z.string().trim().nullable().optional(),
  type: z.string().trim().nullable().optional(),
  attunement: z.boolean().optional(),
  magic: z.boolean().optional(),
  weight: z.number().nullable().optional(),
  value: z.number().nullable().optional(),
  ac: z.number().nullable().optional(),
  stealthDisadvantage: z.boolean().optional(),
  dmg1: z.string().trim().nullable().optional(),
  dmg2: z.string().trim().nullable().optional(),
  dmgType: z.string().trim().nullable().optional(),
  properties: z.array(z.string()).optional(),
  modifiers: z.array(z.object({ category: z.string(), text: z.string() })).optional(),
  text: z.union([z.string(), z.array(z.string())]).optional(),
});

export const SpellBody = z.object({
  name: z.string().trim().min(1),
  level: z.number().int().min(0).max(9).nullable().optional(),
  school: z.string().trim().nullable().optional(),
  time: z.string().trim().nullable().optional(),
  range: z.string().trim().nullable().optional(),
  components: z.string().trim().nullable().optional(),
  duration: z.string().trim().nullable().optional(),
  classes: z.string().trim().nullable().optional(),
  ritual: z.boolean().optional(),
  text: z.union([z.string(), z.array(z.string())]).optional(),
});

export function parseCrToNumeric(cr: string | null): number | null {
  if (!cr) return null;
  const s = cr.trim();
  if (s.includes("/")) {
    const parts = s.split("/").map(Number);
    const [n, d] = [parts[0] ?? 0, parts[1] ?? 0];
    return d ? n / d : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function toBlocks(v: unknown): Array<{ name: string; text: string }> {
  if (!Array.isArray(v)) return [];
  return (v as Array<Record<string, unknown>>)
    .filter((b) => b && typeof b === "object")
    .map((b) => ({ name: String(b.name ?? b.title ?? ""), text: String(b.text ?? b.description ?? "") }));
}

export function baseItemName(name: string): string | null {
  return String(name).replace(/\s+\[2024\]\s*$/i, "").trim() || null;
}

export type MonsterBodyType = z.infer<typeof MonsterBody>;
export type ItemBodyType = z.infer<typeof ItemBody>;
export type SpellBodyType = z.infer<typeof SpellBody>;

export function buildMonsterRecord(id: string, b: MonsterBodyType) {
  const name = b.name;
  const nameKey = name.toLowerCase().replace(/\s+/g, " ");
  const cr = b.cr?.trim() || null;
  const typeFull = b.typeFull?.trim() || null;
  const typeKey = typeFull ? (typeFull.trim().split(/\s+/)[0] ?? "").toLowerCase() : null;
  const size = b.size?.trim() || null;
  const environment = b.environment?.trim() || null;
  const numField = (v: number | null | undefined) => (v != null && Number.isFinite(v) ? v : null);
  const data = {
    id, name, nameKey, name_key: nameKey,
    cr, typeFull, type_full: typeFull,
    typeKey, type_key: typeKey,
    size, environment,
    ac: b.ac?.trim() || null,
    hp: b.hp?.trim() || null,
    speed: b.speed?.trim() || null,
    str: numField(b.str), dex: numField(b.dex), con: numField(b.con),
    int: numField(b.int), wis: numField(b.wis), cha: numField(b.cha),
    save:            b.save?.trim()            || null,
    skill:           b.skill?.trim()           || null,
    senses:          b.senses?.trim()          || null,
    languages:       b.languages?.trim()       || null,
    immune:          b.immune?.trim()          || null,
    resist:          b.resist?.trim()          || null,
    vulnerable:      b.vulnerable?.trim()      || null,
    conditionImmune: b.conditionImmune?.trim() || null,
    trait:     toBlocks(b.trait),
    action:    toBlocks(b.action),
    reaction:  toBlocks(b.reaction),
    legendary: toBlocks(b.legendary),
    spellcasting: [], spells: [],
  };
  return { name, nameKey, cr, crNumeric: parseCrToNumeric(cr), typeKey, typeFull, size, environment, data };
}

export function buildItemRecord(id: string, b: ItemBodyType) {
  const name = b.name;
  const nameKey = name.toLowerCase().replace(/\s+/g, " ");
  const rarityVal = b.rarity?.trim().toLowerCase() || null;
  const typeVal   = b.type?.trim() || null;
  const typeKeyVal = typeVal ? typeVal.toLowerCase().replace(/\s+/g, "_") : null;
  const attunement = b.attunement ? 1 : 0;
  const magic      = b.magic      ? 1 : 0;
  const textArr = Array.isArray(b.text)
    ? b.text
    : typeof b.text === "string" ? [b.text] : [];
  const data = {
    id, name, nameKey, name_key: nameKey,
    rarity: rarityVal, type: typeVal, typeKey: typeKeyVal, type_key: typeKeyVal,
    attunement, magic,
    weight: b.weight ?? null,
    value: b.value ?? null,
    ac: b.ac ?? null,
    stealthDisadvantage: b.stealthDisadvantage ?? false,
    dmg1: b.dmg1?.trim() || null,
    dmg2: b.dmg2?.trim() || null,
    dmgType: b.dmgType?.trim() || null,
    properties: b.properties ?? [],
    modifiers: b.modifiers ?? [],
    text: textArr,
  };
  return { name, nameKey, rarityVal, typeVal, typeKeyVal, attunement, magic, data };
}

export function buildSpellRecord(id: string, b: SpellBodyType) {
  const name = b.name;
  const nameKey = name.toLowerCase().replace(/\s+/g, " ");
  const levelVal = b.level ?? null;
  const schoolVal     = b.school?.trim()     || null;
  const componentsVal = b.components?.trim() || null;
  const durationVal   = b.duration?.trim()   || null;
  const classesVal    = b.classes?.trim()    || null;
  const isRitual        = b.ritual ? 1 : 0;
  const isConcentration = /concentration/i.test(durationVal ?? "") ? 1 : 0;
  const data = {
    id, name, nameKey, name_key: nameKey,
    baseName: name, baseKey: nameKey.replace(/\s/g, "_"), base_key: nameKey.replace(/\s/g, "_"),
    level: levelVal, school: schoolVal,
    ritual: isRitual, concentration: isConcentration,
    time:       b.time?.trim()  || null,
    range:      b.range?.trim() || null,
    components: componentsVal,
    duration:   durationVal,
    classes:    classesVal,
    text: Array.isArray(b.text) ? b.text : typeof b.text === "string" ? [b.text] : [],
  };
  return { name, nameKey, levelVal, schoolVal, isRitual, isConcentration, componentsVal, classesVal, data };
}
