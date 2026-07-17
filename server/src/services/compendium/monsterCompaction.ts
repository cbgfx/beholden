import { averageHpFromFormula } from "@beholden/shared/domain/monsters";
import { type JsonRecord, list, number, record, text } from "./grandCompendium.helpers.js";

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
  const roll = number(recharge.roll);
  if (roll !== null) return { roll };
  const uses = number(recharge.uses);
  const period = text(recharge.period);
  if (uses !== null && period) return { uses, period };
  return period === "short_rest" || period === "long_rest" ? { period } : undefined;
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
  };
}

function damageComponents(value: unknown): JsonRecord[] {
  const values = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
  return values.flatMap((raw) => {
    const component = record(raw);
    const roll = text(component.roll);
    const type = Array.isArray(component.type) ? stringList(component.type) : text(component.type);
    const hasType = Array.isArray(type) ? type.length >= 2 : Boolean(type);
    return roll && hasType ? [{ roll, type }] : [];
  });
}

export function compactMonsterActions(value: unknown): JsonRecord[] {
  return list(value).map((raw, index) => {
    const action = record(raw);
    const recharge = compactRecharge(action.recharge);
    const attack = compactAttack(action.attack);
    const damage = damageComponents(action.damage);
    const routine = list(action.routine).flatMap((rawStep) => {
      const step = record(rawStep);
      const use = text(step.use);
      const choose = stringList(step.choose);
      if (!use && choose.length < 2) return [];
      return [{
        ...(use ? { use } : { choose }),
        ...(number(step.count) !== null && number(step.count)! > 1 ? { count: number(step.count) } : {}),
        ...(step.optional === true ? { optional: true } : {}),
      }];
    });
    const replacementSource = record(action.replace);
    const replacementWith = stringList(replacementSource.with);
    const spellSlots = Object.fromEntries(
      Object.entries(record(action.spellSlots))
        .flatMap(([level, count]) => number(count) !== null ? [[level, number(count)]] : []),
    );
    return {
      id: text(action.id) ?? `action_${index + 1}`,
      name: text(action.name) ?? `Action ${index + 1}`,
      description: text(action.description) ?? "",
      ...(recharge ? { recharge } : {}),
      ...(Object.keys(spellSlots).length ? { spellSlots } : {}),
      ...(attack ? { attack } : {}),
      ...(damage.length === 1 ? { damage: damage[0] } : {}),
      ...(damage.length > 1 ? { damage } : {}),
      ...(routine.length ? { routine } : {}),
      ...(replacementWith.length ? { replace: {
        ...(number(replacementSource.count) !== null && number(replacementSource.count)! > 1 ? { count: number(replacementSource.count) } : {}),
        with: replacementWith,
      } } : {}),
      ...(text(action.area) ? { area: text(action.area) } : {}),
      ...(number(action.targets) !== null && number(action.targets)! > 1 ? { targets: number(action.targets) } : {}),
    };
  });
}

/** Converts verbose or sparse canonical monster data into the sparse Grand representation. */
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
  // `numeric` is derived from `rating` at read time (crRatingToNumber), never stored.
  const challenge = {
    ...(text(challengeSource.rating) ? { rating: text(challengeSource.rating) } : {}),
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

  // Spell references store only the catalog ID (plus a rare typed cast-level override);
  // display names resolve from the spell catalog at read time.
  const spells = list(entry.spells).flatMap((raw) => {
    const spell = record(raw);
    const id = text(spell.id ?? spell.spellId);
    const level = number(spell.level);
    return id ? [{ id, ...(level !== null ? { level } : {}) }] : [];
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
    ...(number(armorClassSource.value) !== null && number(armorClassSource.value)! > 0 ? { armorClass: {
      value: number(armorClassSource.value),
      ...(text(armorClassSource.source) ? { source: text(armorClassSource.source) } : {}),
    } } : {}),
    // Average is deterministic arithmetic from the formula (floor rule) — stored only
    // when there is no formula, or when the formula isn't a derivable NdF(+/-M) shape.
    ...(() => {
      const formula = text(hitPointsSource.formula);
      const average = number(hitPointsSource.average);
      if (formula && averageHpFromFormula(formula) !== null) return { hitPoints: { formula } };
      if (formula) return { hitPoints: { ...(average !== null && average > 0 ? { average } : {}), formula } };
      return average !== null && average > 0 ? { hitPoints: { average } } : {};
    })(),
    ...(Object.keys(movement).length ? { movement } : {}),
    ...(Object.keys(abilities).length ? { abilities } : {}),
    ...(Object.keys(proficiencies).length ? { proficiencies } : {}),
    ...(Object.keys(defenses).length ? { defenses } : {}),
    ...(stringList(entry.senses).length ? { senses: stringList(entry.senses) } : {}),
    ...(stringList(entry.languages).length ? { languages: stringList(entry.languages) } : {}),
    ...(text(entry.treasure) ? { treasure: text(entry.treasure) } : {}),
    ...(number(entry.legendaryUses) !== null ? { legendaryUses: number(entry.legendaryUses) } : {}),
    ...(list(entry.lair).length ? { lair: list(entry.lair).flatMap((raw) => {
      const lair = record(raw); const name = text(lair.name); const description = text(lair.description);
      return name && description ? [{ name, description }] : [];
    }) } : {}),
    ...Object.fromEntries(
      Object.entries(optionalLists).filter(([, entries]) => entries.length > 0),
    ),
    ...(spells.length ? { spells } : {}),
  };
}
