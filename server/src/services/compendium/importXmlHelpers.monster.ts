import { parseAttackFromText } from "../../lib/attacks.js";
import { asArray, asText, extractSourceLine, normalizeKey, parseCrValue, stripSourceLine } from "../../lib/text.js";
import { normalizeHp } from "./normalizeHp.js";
import { assertKnownXmlKeys, assertKnownXmlKeysEach } from "./xmlFieldGuard.js";
import { type XmlObject } from "./importXmlHelpers.shared.js";

const MONSTER_KNOWN_KEYS = [
  "name", "size", "type", "alignment", "ancestry", "description",
  "cr", "environment", "sortname", "npc", "init", "passive",
  "ac", "hp", "speed", "str", "dex", "con", "int", "wis", "cha",
  "save", "skill", "senses", "languages",
  "immune", "resist", "vulnerable", "conditionImmune",
  "trait", "action", "reaction", "legendary", "spellcasting", "spells",
  // slots: spell slot table for spellcasting monsters (e.g. "Skilled Crew"); not yet extracted
  // into a structured field — tracked as a known gap for future monster spellcasting work.
  "slots",
] as const;
const MONSTER_ACTION_KNOWN_KEYS = ["name", "title", "text", "description", "attack", "recharge"] as const;
// recharge + attack: some legendary actions carry these sub-elements (e.g. Aboleth); preserved in blob passthrough.
const MONSTER_LEGENDARY_KNOWN_KEYS = ["name", "text", "@_category", "recharge", "attack"] as const;
// attack: summoned/transformed monsters embed attack rolls inside traits (blob passthrough, step-2 gap).
// recharge: some traits carry a <recharge> element (e.g. Aboleth); preserved in blob passthrough.
const MONSTER_TRAIT_KNOWN_KEYS = ["name", "text", "@_category", "attack", "recharge"] as const;
const MONSTER_SPELLCASTING_KNOWN_KEYS = ["name", "text"] as const;

export function buildMonsterImportData(monster: XmlObject | null | undefined, warnings?: string[]) {
  const name = (asText(monster?.name) || "Unknown").trim();
  const nameKey = normalizeKey(name);
  const ctx = { entityType: "monster", entityName: name };
  assertKnownXmlKeys(monster, MONSTER_KNOWN_KEYS, { ...ctx, path: "<monster>" }, warnings);
  assertKnownXmlKeysEach(monster?.trait, MONSTER_TRAIT_KNOWN_KEYS, { ...ctx, path: "<trait>" }, warnings);
  assertKnownXmlKeysEach(monster?.action, MONSTER_ACTION_KNOWN_KEYS, { ...ctx, path: "<action>" }, warnings);
  assertKnownXmlKeysEach(monster?.reaction, MONSTER_ACTION_KNOWN_KEYS, { ...ctx, path: "<reaction>" }, warnings);
  assertKnownXmlKeysEach(monster?.legendary, MONSTER_LEGENDARY_KNOWN_KEYS, { ...ctx, path: "<legendary>" }, warnings);
  assertKnownXmlKeysEach(monster?.spellcasting, MONSTER_SPELLCASTING_KNOWN_KEYS, { ...ctx, path: "<spellcasting>" }, warnings);
  const typeFull = monster?.type != null ? String(monster.type) : null;
  const typeKey =
    typeFull
      ? String(typeFull)
          .trim()
          .match(/^([a-zA-Z]+)/)?.[1]
          ?.toLowerCase() ?? null
      : null;
  const crRaw = monster?.cr != null ? parseCrValue(monster.cr) : null;
  const crNumeric = Number.isFinite(crRaw) ? crRaw : null;
  const crStr =
    monster?.cr != null
      ? String(monster.cr).trim().includes("/")
        ? String(monster.cr).trim()
        : crNumeric != null
          ? String(crNumeric)
          : null
      : null;

  const descriptionRaw = asText(monster?.description) || null;
  const description = descriptionRaw ? stripSourceLine(descriptionRaw) || null : null;
  const source = descriptionRaw ? extractSourceLine(descriptionRaw) : null;
  const spellcasting = asArray<XmlObject>(
    monster?.spellcasting as XmlObject | XmlObject[] | null | undefined,
  ).map((entry, index) =>
    index === 0 && monster?.slots != null
      ? { ...entry, slots: monster.slots }
      : entry);

  return {
    id: `m_${nameKey.replace(/\s/g, "_")}`,
    name,
    nameKey,
    name_key: nameKey,
    cr: crStr,
    cr_numeric: crNumeric,
    typeFull,
    type_full: typeFull,
    typeKey,
    type_key: typeKey,
    size: monster?.size ?? null,
    sortName: asText(monster?.sortname) || null,
    alignment: asText(monster?.alignment) || null,
    ancestry: asText(monster?.ancestry) || null,
    description,
    source,
    initiativeBonus: monster?.init == null || !Number.isFinite(Number(monster.init))
      ? null
      : Number(monster.init),
    passivePerception: monster?.passive == null || !Number.isFinite(Number(monster.passive))
      ? null
      : Number(monster.passive),
    npc: /^(?:1|true|yes)$/iu.test(asText(monster?.npc)),
    environment: monster?.environment ?? null,
    ac: monster?.ac ?? null,
    hp: normalizeHp(monster?.hp ?? null),
    speed: monster?.speed ?? null,
    str: monster?.str ?? null,
    dex: monster?.dex ?? null,
    con: monster?.con ?? null,
    int: monster?.int ?? null,
    wis: monster?.wis ?? null,
    cha: monster?.cha ?? null,
    save: monster?.save ?? null,
    skill: monster?.skill ?? null,
    senses: monster?.senses ?? null,
    languages: monster?.languages ?? null,
    immune: monster?.immune ?? null,
    resist: monster?.resist ?? null,
    vulnerable: monster?.vulnerable ?? null,
    conditionImmune: monster?.conditionImmune ?? null,
    trait: asArray<XmlObject>(monster?.trait as XmlObject | XmlObject[] | null | undefined).map((trait) => {
      return { ...trait, name: (asText(trait?.name) || "").trim() };
    }),
    action: asArray<XmlObject>(monster?.action as XmlObject | XmlObject[] | null | undefined).map((action) => {
      const actionName = (asText(action?.name ?? action?.title) || "").trim();
      const text = action?.text ?? action?.description ?? "";
      const attack = parseAttackFromText(text);
      const attacks = asArray(action?.attack)
        .map((value) => asText(value))
        .filter(Boolean);
      return { ...action, name: actionName, text, attack, attacks };
    }),
    reaction: asArray(monster?.reaction),
    legendary: asArray<XmlObject>(monster?.legendary as XmlObject | XmlObject[] | null | undefined).map((legendary) => {
      return { ...legendary, name: (asText(legendary?.name) || "").trim() };
    }),
    spellcasting,
    spells: asArray(monster?.spells),
  };
}
