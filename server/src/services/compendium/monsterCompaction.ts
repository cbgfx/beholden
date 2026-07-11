import { type JsonRecord, list, number, record, text } from "./nativeCompendiumV2.helpers.js";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
const MOVEMENT_MODES = ["walk", "burrow", "climb", "fly", "swim"] as const;
const DEFENSE_FIELDS = [
  "vulnerabilities",
  "resistances",
  "damageImmunities",
  "conditionImmunities",
] as const;

function stringList(value: unknown): string[] {
  return list(value).map(String).map((entry) => entry.trim()).filter(Boolean);
}

function compactNamedBonuses(value: unknown): JsonRecord[] {
  return list(value).flatMap((raw) => {
    const bonus = record(raw);
    const name = text(bonus.name);
    return name ? [{
      name,
      ...(number(bonus.bonus) !== null ? { bonus: number(bonus.bonus) } : {}),
    }] : [];
  });
}

function compactRecharge(value: unknown): JsonRecord | undefined {
  const recharge = record(value);
  const kind = text(recharge.kind);
  const source = text(recharge.source);
  if (!kind || !source) return undefined;
  return {
    kind,
    source,
    ...(number(recharge.minimumRoll) !== null ? { minimumRoll: number(recharge.minimumRoll) } : {}),
    ...(number(recharge.uses) !== null ? { uses: number(recharge.uses) } : {}),
    ...(text(recharge.period) ? { period: text(recharge.period) } : {}),
  };
}

function compactAttack(value: unknown): JsonRecord | undefined {
  const attack = record(value);
  const toHit = number(attack.toHit);
  if (toHit === null) return undefined;
  return {
    toHit,
    ...(text(attack.reach) ? { reach: text(attack.reach) } : {}),
    ...(text(attack.range) ? { range: text(attack.range) } : {}),
    ...(attack.melee === true ? { melee: true } : {}),
    ...(attack.ranged === true ? { ranged: true } : {}),
    ...(text(attack.damage) ? { damage: text(attack.damage) } : {}),
    ...(text(attack.damageType) ? { damageType: text(attack.damageType) } : {}),
  };
}

export function compactMonsterActions(value: unknown): JsonRecord[] {
  return list(value).map((raw, index) => {
    const action = record(raw);
    const recharge = compactRecharge(action.recharge);
    const attack = compactAttack(action.attack);
    const attacks = stringList(action.attacks);
    const spellSlots = Object.fromEntries(
      Object.entries(record(action.spellSlots))
        .flatMap(([level, count]) => number(count) !== null ? [[level, number(count)]] : []),
    );
    return {
      id: text(action.id) ?? `action_${index + 1}`,
      name: text(action.name) ?? `Action ${index + 1}`,
      description: text(action.description) ?? "",
      ...(text(action.category) ? { category: text(action.category) } : {}),
      ...(recharge ? { recharge } : {}),
      ...(Object.keys(spellSlots).length ? { spellSlots } : {}),
      ...(attack ? { attack } : {}),
      ...(attacks.length ? { attacks } : {}),
    };
  });
}

/** Converts verbose or sparse canonical monster data into the sparse V2 representation. */
export function compactMonsterEntry(entry: JsonRecord): JsonRecord {
  const classificationSource = record(entry.classification);
  const environment = stringList(classificationSource.environment);
  const classification = {
    ...(text(classificationSource.size) ? { size: text(classificationSource.size) } : {}),
    ...(text(classificationSource.type) ? { type: text(classificationSource.type) } : {}),
    ...(text(classificationSource.description) ? { description: text(classificationSource.description) } : {}),
    ...(text(classificationSource.sortName) ? { sortName: text(classificationSource.sortName) } : {}),
    ...(text(classificationSource.alignment) ? { alignment: text(classificationSource.alignment) } : {}),
    ...(text(classificationSource.ancestry) ? { ancestry: text(classificationSource.ancestry) } : {}),
    ...(environment.length ? { environment } : {}),
  };

  const challengeSource = record(entry.challenge);
  const challenge = {
    ...(text(challengeSource.rating) ? { rating: text(challengeSource.rating) } : {}),
    ...(number(challengeSource.numeric) !== null ? { numeric: number(challengeSource.numeric) } : {}),
    ...(number(challengeSource.xp) !== null ? { xp: number(challengeSource.xp) } : {}),
  };

  const armorClassSource = record(entry.armorClass);
  const hitPointsSource = record(entry.hitPoints);
  const movementSource = record(entry.movement);
  const movement = Object.fromEntries([
    ...MOVEMENT_MODES.flatMap((mode) =>
      number(movementSource[mode]) !== null ? [[mode, number(movementSource[mode])]] : []),
    ...(movementSource.hover === true ? [["hover", true]] : []),
  ]);

  const abilitiesSource = record(entry.abilities);
  const abilities = Object.fromEntries(
    ABILITIES.flatMap((ability) =>
      number(abilitiesSource[ability]) !== null ? [[ability, number(abilitiesSource[ability])]] : []),
  );

  const proficienciesSource = record(entry.proficiencies);
  const savingThrows = compactNamedBonuses(proficienciesSource.savingThrows);
  const skills = compactNamedBonuses(proficienciesSource.skills);
  const proficiencies = {
    ...(savingThrows.length ? { savingThrows } : {}),
    ...(skills.length ? { skills } : {}),
  };

  const defensesSource = record(entry.defenses);
  const defenses = Object.fromEntries(
    DEFENSE_FIELDS.flatMap((field) => {
      const values = stringList(defensesSource[field]);
      return values.length ? [[field, values]] : [];
    }),
  );

  const spells = list(entry.spells).flatMap((raw) => {
    const spell = record(raw);
    const id = text(spell.id ?? spell.spellId);
    const name = text(spell.name);
    return id || name ? [{
      ...(id ? { id } : {}),
      ...(name ? { name } : {}),
    }] : [];
  });

  const optionalLists = {
    traits: compactMonsterActions(entry.traits),
    actions: compactMonsterActions(entry.actions),
    reactions: compactMonsterActions(entry.reactions),
    legendaryActions: compactMonsterActions(entry.legendaryActions),
    spellcasting: compactMonsterActions(entry.spellcasting),
  };

  return {
    id: text(entry.id) ?? "",
    name: text(entry.name) ?? "",
    ...(text(entry.source) ? { source: text(entry.source) } : {}),
    ...(Object.keys(classification).length ? { classification } : {}),
    ...(text(entry.description) ? { description: text(entry.description) } : {}),
    ...(number(entry.initiativeBonus) !== null ? { initiativeBonus: number(entry.initiativeBonus) } : {}),
    ...(number(entry.passivePerception) !== null ? { passivePerception: number(entry.passivePerception) } : {}),
    ...(entry.npc === true ? { npc: true } : {}),
    ...(Object.keys(challenge).length ? { challenge } : {}),
    armorClass: {
      value: number(armorClassSource.value) ?? 0,
      ...(text(armorClassSource.source) ? { source: text(armorClassSource.source) } : {}),
    },
    hitPoints: {
      average: number(hitPointsSource.average) ?? 0,
      ...(text(hitPointsSource.formula) ? { formula: text(hitPointsSource.formula) } : {}),
    },
    ...(Object.keys(movement).length ? { movement } : {}),
    ...(Object.keys(abilities).length ? { abilities } : {}),
    ...(Object.keys(proficiencies).length ? { proficiencies } : {}),
    ...(Object.keys(defenses).length ? { defenses } : {}),
    ...(stringList(entry.senses).length ? { senses: stringList(entry.senses) } : {}),
    ...(stringList(entry.languages).length ? { languages: stringList(entry.languages) } : {}),
    ...(text(entry.treasure) ? { treasure: text(entry.treasure) } : {}),
    ...Object.fromEntries(
      Object.entries(optionalLists).filter(([, entries]) => entries.length > 0),
    ),
    ...(spells.length ? { spells } : {}),
  };
}
