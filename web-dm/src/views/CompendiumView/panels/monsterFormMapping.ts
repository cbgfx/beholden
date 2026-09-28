// web-dm/src/views/CompendiumView/panels/monsterFormMapping.ts
// Pure data-transform functions between the flat monster edit-form state and the compendium's
// structured monster document shape. No rendering here -- see MonsterFormSections.tsx for that.
import {
  MonsterBlock,
  MonsterLairBlock,
  MonsterSpellReference,
  MonsterForEdit,
  normalizeBlocks,
  normalizeSize,
} from "./MonsterFormParts";

export type NamedBonus = { name: string; bonus: string };

export type MonsterFormState = {
  name: string; ruleset: "5e" | "5.5e"; source: string; description: string;
  cr: string; xp: string; typeFull: string; size: string; alignment: string; environment: string;
  ac: string; acSource: string; hpAverage: string; hpFormula: string;
  walk: string; burrow: string; climb: string; fly: string; swim: string; hover: boolean;
  initiativeBonus: string; passivePerception: string;
  str: string; dex: string; con: string; int_: string; wis: string; cha: string;
  saves: NamedBonus[]; skills: NamedBonus[]; senses: string; languages: string;
  immune: string; resist: string; vulnerable: string; condImm: string; treasure: string;
  legendaryUses: string;
  traits: MonsterBlock[]; actions: MonsterBlock[]; reactions: MonsterBlock[]; legendary: MonsterBlock[];
  lair: MonsterLairBlock[]; spellcasting: MonsterBlock[]; spells: MonsterSpellReference[];
};

function namedBonuses(value: unknown): NamedBonus[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const row = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    return { name: String(row.name ?? ""), bonus: row.bonus == null ? "" : String(row.bonus) };
  });
}

export function monsterToForm(monster: MonsterForEdit | null, isDuplicate: boolean): MonsterFormState {
  const classification = monster?.classification ?? {};
  const abilities = monster?.abilities ?? {};
  const defenses = monster?.defenses ?? {};
  return {
    name: isDuplicate ? `${monster?.name ?? ""} (Copy)` : (monster?.name ?? ""),
    ruleset: monster?.ruleset === "5e" ? "5e" : "5.5e",
    source: typeof monster?.source === "string" ? monster.source : "",
    description: typeof monster?.description === "string" ? monster.description : "",
    cr: monster?.challenge?.rating ?? "",
    xp: monster?.challenge?.xp != null ? String(monster.challenge.xp) : "",
    typeFull: classification.description ?? classification.type ?? "",
    size: normalizeSize(classification.size) || "Medium",
    alignment: typeof classification.alignment === "string" ? classification.alignment : "",
    environment: classification.environment?.join(", ") ?? "",
    ac: monster?.armorClass?.value != null ? String(monster.armorClass.value) : "",
    acSource: monster?.armorClass?.source ?? "",
    hpAverage: monster?.hitPoints?.average != null ? String(monster.hitPoints.average) : "",
    hpFormula: monster?.hitPoints?.formula ?? "",
    walk: monster?.movement?.walk != null ? String(monster.movement.walk) : "",
    burrow: monster?.movement?.burrow != null ? String(monster.movement.burrow) : "",
    climb: monster?.movement?.climb != null ? String(monster.movement.climb) : "",
    fly: monster?.movement?.fly != null ? String(monster.movement.fly) : "",
    swim: monster?.movement?.swim != null ? String(monster.movement.swim) : "",
    hover: monster?.movement?.hover === true,
    initiativeBonus: monster?.initiativeBonus != null ? String(monster.initiativeBonus) : "",
    passivePerception: monster?.passivePerception != null ? String(monster.passivePerception) : "",
    str: abilities.str != null ? String(abilities.str) : "",
    dex: abilities.dex != null ? String(abilities.dex) : "",
    con: abilities.con != null ? String(abilities.con) : "",
    int_: abilities.int != null ? String(abilities.int) : "",
    wis: abilities.wis != null ? String(abilities.wis) : "",
    cha: abilities.cha != null ? String(abilities.cha) : "",
    saves: namedBonuses(monster?.proficiencies?.savingThrows),
    skills: namedBonuses(monster?.proficiencies?.skills),
    senses: Array.isArray(monster?.senses) ? monster.senses.join(", ") : "",
    languages: Array.isArray(monster?.languages) ? monster.languages.join(", ") : "",
    immune: defenses.damageImmunities?.join(", ") ?? "",
    resist: defenses.resistances?.join(", ") ?? "",
    vulnerable: defenses.vulnerabilities?.join(", ") ?? "",
    condImm: defenses.conditionImmunities?.join(", ") ?? "",
    treasure: typeof monster?.treasure === "string" ? monster.treasure : "",
    legendaryUses: monster?.legendaryUses != null ? String(monster.legendaryUses) : "",
    traits: normalizeBlocks(monster?.traits),
    actions: normalizeBlocks(monster?.actions),
    reactions: normalizeBlocks(monster?.reactions),
    legendary: normalizeBlocks(monster?.legendaryActions),
    lair: Array.isArray(monster?.lair) ? monster.lair.map((entry) => ({ name: String(entry.name ?? ""), description: String(entry.description ?? "") })) : [],
    spellcasting: normalizeBlocks(monster?.spellcasting),
    spells: Array.isArray(monster?.spells) ? monster.spells.map((entry) => ({ id: String(entry.id ?? ""), ...(entry.level != null ? { level: Number(entry.level) } : {}) })) : [],
  };
}

const splitList = (value: string) => value.split(",").map((part) => part.trim()).filter(Boolean);
const actionBlocks = (blocks: MonsterBlock[]) => blocks.filter((block) => block.name || block.text).map((block, index) => {
  const { text, ...facts } = block;
  return { ...facts, id: block.id || `action_${index + 1}`, name: block.name.trim(), description: text };
});

export function buildMonsterPayload(form: MonsterFormState, original: MonsterForEdit | null) {
  const type = form.typeFull.trim();
  const size = ({ Tiny: "T", Small: "S", Medium: "M", Large: "L", Huge: "H", Gargantuan: "G" } as Record<string, string>)[form.size] ?? form.size;
  const parseInteger = (value: string, label: string, min?: number) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || (min != null && parsed < min)) throw new Error(`${label} must be an integer${min != null ? ` of at least ${min}` : ""}.`);
    return parsed;
  };
  if (!form.name.trim()) throw new Error("Name is required.");
  const positiveInteger = (value: string, label: string) => parseInteger(value, label, 1);
  positiveInteger(form.ac, "Armor Class");
  positiveInteger(form.hpAverage, "Average hit points");
  parseInteger(form.xp, "XP", 0);
  parseInteger(form.initiativeBonus, "Initiative bonus");
  parseInteger(form.passivePerception, "Passive Perception", 0);
  const movement: Record<string, number | true> = {};
  for (const key of ["walk", "burrow", "climb", "fly", "swim"] as const) {
    const value = parseInteger(form[key], `${key} speed`, 0);
    if (value != null) movement[key] = value;
  }
  if (form.hover) movement.hover = true;
  const toNamedBonuses = (rows: NamedBonus[], label: string) => rows.filter((entry) => entry.name.trim() || entry.bonus.trim()).map((entry, index) => {
    if (!entry.name.trim()) throw new Error(`${label} row ${index + 1} needs a name.`);
    if (entry.bonus.trim() && !Number.isFinite(Number(entry.bonus))) throw new Error(`${label} row ${index + 1} has an invalid bonus.`);
    return { name: entry.name.trim(), ...(entry.bonus.trim() ? { bonus: Number(entry.bonus) } : {}) };
  });
  const savingThrows = toNamedBonuses(form.saves, "Saving throw");
  const skills = toNamedBonuses(form.skills, "Skill");
  for (const [ability, value] of [["STR", form.str], ["DEX", form.dex], ["CON", form.con], ["INT", form.int_], ["WIS", form.wis], ["CHA", form.cha]] as const) {
    const score = parseInteger(value, ability, 1);
    if (score != null && score > 30) throw new Error(`${ability} must be no greater than 30.`);
  }
  const abilities = Object.fromEntries([
    ["str", form.str], ["dex", form.dex], ["con", form.con], ["int", form.int_], ["wis", form.wis], ["cha", form.cha],
  ].filter(([, value]) => value.trim()).map(([key, value]) => [key, Number(value)]));
  const traits = actionBlocks(form.traits);
  const actions = actionBlocks(form.actions);
  const reactions = actionBlocks(form.reactions);
  const legendaryActions = actionBlocks(form.legendary);
  for (const [label, blocks] of [["Trait", traits], ["Action", actions], ["Reaction", reactions], ["Legendary action", legendaryActions]] as const) {
    const missingName = blocks.findIndex((block) => !block.name);
    if (missingName >= 0) throw new Error(`${label} ${missingName + 1} needs a name.`);
  }
  const defenses = {
    ...(splitList(form.vulnerable).length ? { vulnerabilities: splitList(form.vulnerable) } : {}),
    ...(splitList(form.resist).length ? { resistances: splitList(form.resist) } : {}),
    ...(splitList(form.immune).length ? { damageImmunities: splitList(form.immune) } : {}),
    ...(splitList(form.condImm).length ? { conditionImmunities: splitList(form.condImm) } : {}),
  };
  const payload: Record<string, unknown> = { ...(original ?? {}), ruleset: form.ruleset, name: form.name.trim() };
  const setOptional = (key: string, value: unknown) => { payload[key] = value; };
  setOptional("source", form.source.trim() || undefined);
  setOptional("description", form.description.trim() || undefined);
  const classification: Record<string, unknown> = { ...(original?.classification ?? {}) };
  if (size) classification.size = size;
  if (type) { classification.type = type.split(/\s/u)[0]?.toLowerCase(); classification.description = type; }
  if (form.alignment.trim()) classification.alignment = form.alignment.trim();
  else delete classification.alignment;
  if (splitList(form.environment).length) classification.environment = splitList(form.environment); else delete classification.environment;
  setOptional("classification", Object.keys(classification).length ? classification : undefined);
  setOptional("challenge", form.cr.trim() || form.xp.trim() ? { ...(form.cr.trim() ? { rating: form.cr.trim() } : {}), ...(form.xp.trim() ? { xp: Number(form.xp) } : {}) } : undefined);
  setOptional("armorClass", form.ac.trim() ? { value: Number(form.ac), ...(form.acSource.trim() ? { source: form.acSource.trim() } : {}) } : undefined);
  setOptional("hitPoints", form.hpFormula.trim() ? { formula: form.hpFormula.trim() } : form.hpAverage.trim() ? { average: Number(form.hpAverage) } : undefined);
  setOptional("movement", Object.keys(movement).length ? movement : undefined);
  setOptional("initiativeBonus", form.initiativeBonus.trim() ? Number(form.initiativeBonus) : undefined);
  setOptional("passivePerception", form.passivePerception.trim() ? Number(form.passivePerception) : undefined);
  setOptional("abilities", Object.keys(abilities).length ? abilities : undefined);
  setOptional("proficiencies", savingThrows.length || skills.length ? { ...(savingThrows.length ? { savingThrows } : {}), ...(skills.length ? { skills } : {}) } : undefined);
  setOptional("senses", splitList(form.senses).length ? splitList(form.senses) : undefined);
  setOptional("languages", splitList(form.languages).length ? splitList(form.languages) : undefined);
  setOptional("defenses", Object.keys(defenses).length ? defenses : undefined);
  setOptional("treasure", form.treasure.trim() || undefined);
  setOptional("traits", traits.length ? traits : undefined);
  setOptional("actions", actions.length ? actions : undefined);
  setOptional("reactions", reactions.length ? reactions : undefined);
  setOptional("legendaryActions", legendaryActions.length ? legendaryActions : undefined);
  setOptional("legendaryUses", legendaryActions.length ? parseInteger(form.legendaryUses || "3", "Legendary uses", 1) : undefined);
  const lair = form.lair.filter((entry) => entry.name.trim() || entry.description.trim()).map((entry) => ({ name: entry.name.trim(), description: entry.description.trim() }));
  const spellcasting = actionBlocks(form.spellcasting);
  lair.forEach((entry, index) => { if (!entry.name || !entry.description) throw new Error(`Lair entry ${index + 1} needs both a name and description.`); });
  spellcasting.forEach((entry, index) => { if (!entry.name) throw new Error(`Spellcasting entry ${index + 1} needs a name.`); });
  const spells = form.spells.filter((entry) => entry.id.trim()).map((entry) => ({ id: entry.id.trim(), ...(entry.level != null ? { level: entry.level } : {}) }));
  spells.forEach((entry, index) => { if (entry.level != null && (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > 9)) throw new Error(`Spell reference ${index + 1} cast level must be from 1 to 9.`); });
  setOptional("lair", lair.length ? lair : undefined);
  setOptional("spellcasting", spellcasting.length ? spellcasting : undefined);
  setOptional("spells", spells.length ? spells : undefined);
  return payload;
}
