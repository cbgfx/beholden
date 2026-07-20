import { averageHpFromFormula, crRatingToNumber } from "@beholden/shared/domain/monsters";
import { type JsonRecord, ABILITIES, record, list, text, number } from "./grandCompendium.helpers.js";

function formatMovement(value: unknown): string | null {
  const movement = record(value);
  const parts = ["walk", "burrow", "climb", "fly", "swim"].flatMap((mode) => {
    const distance = number(movement[mode]);
    return distance == null ? [] : [`${mode} ${distance} ft.${mode === "fly" && movement.hover === true ? " (hover)" : ""}`];
  });
  return parts.join(", ") || null;
}

function formatNamedBonuses(value: unknown): string | null {
  const parts = list(value).map((raw) => {
    const item = record(raw);
    const name = text(item.name);
    const bonus = number(item.bonus);
    return name ? `${name}${bonus == null ? "" : ` ${bonus >= 0 ? "+" : ""}${bonus}`}` : "";
  }).filter(Boolean);
  return parts.join(", ") || null;
}

function projectActions(value: unknown) {
  return list(value).map((raw) => {
    const entry = record(raw);
    const recharge = record(entry.recharge);
    const attack = record(entry.attack);
    const components = (Array.isArray(entry.damage) ? entry.damage : entry.damage ? [entry.damage] : [])
      .map(record)
      .filter((component) => text(component.roll) && text(component.type));
    const firstDamage = components[0];
    return {
      // Typed facts pass through for canonical consumers (e.g. the DM encounter-difficulty
      // estimator): action id, damage components, and Multiattack routine composition.
      ...(text(entry.id) ? { id: text(entry.id) } : {}),
      ...(components.length ? { damage: entry.damage } : {}),
      ...(Array.isArray(entry.routine) && entry.routine.length ? { routine: entry.routine } : {}),
      ...(Object.keys(record(entry.spellSlots)).length ? { spellSlots: entry.spellSlots } : {}),
      name: text(entry.name) ?? "",
      text: text(entry.description) ?? "",
      category: text(entry.category),
      recharge: Object.keys(recharge).length ? recharge : null,
      attack: number(attack.toHit) !== null ? {
        toHit: number(attack.toHit),
        reach: text(attack.reach),
        range: text(attack.range),
        melee: attack.melee === true,
        ranged: attack.ranged === true,
        damage: text(firstDamage?.roll),
        damageType: Array.isArray(firstDamage?.type) ? firstDamage.type.map(String).join("/") : text(firstDamage?.type),
      } : null,
      attacks: components.map((component) =>
        `${(Array.isArray(component.type) ? component.type.map(String).join("/") : text(component.type))?.replace(/\b\w/gu, (letter) => letter.toUpperCase())} Damage||${text(component.roll)}`
      ),
      ...(text(entry.area) ? { area: text(entry.area) } : {}),
      ...(number(entry.targets) !== null ? { targets: number(entry.targets) } : {}),
    };
  });
}

/**
 * The 2024 monster corpus' "Treasure" trait is always the DMG glossary blurb for a fixed set of
 * hoard-category tags (Any/Arcana/Armaments/Relics/Implements/Individual), never per-monster
 * content — e.g. every "Armaments" monster carries the exact same sentence. Reduce it to just the
 * tag(s), which is the only monster-specific signal in the text. Falls back to the raw text if it
 * doesn't match the known "Tag: ..." shape (e.g. a homebrew monster's free-form treasure note).
 */
export function condenseTreasureText(raw: string): string {
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return raw;
  const tags = lines.map((line) => line.match(/^([A-Za-z][A-Za-z ]*):/)?.[1]?.trim());
  if (tags.some((tag) => !tag)) return raw;
  return tags.join(", ");
}

export function projectGrandMonster(entry: JsonRecord): JsonRecord {
  const compact = entry;
  const classification = record(compact.classification);
  const challenge = record(compact.challenge);
  const armorClass = record(compact.armorClass);
  const hitPoints = record(compact.hitPoints);
  const abilities = record(compact.abilities);
  const proficiencies = record(compact.proficiencies);
  const defenses = record(compact.defenses);
  return {
    id: compact.id,
    ruleset: compact.ruleset,
    name: compact.name,
    source: compact.source ?? null,
    size: classification.size ?? null,
    typeKey: classification.type ?? null,
    typeFull: classification.description ?? null,
    sortName: classification.sortName ?? null,
    alignment: classification.alignment ?? null,
    ancestry: classification.ancestry ?? null,
    description: compact.description ?? null,
    initiativeBonus: compact.initiativeBonus ?? null,
    passivePerception: compact.passivePerception ?? null,
    npc: compact.npc === true,
    environment: list(classification.environment).join(", "),
    cr: challenge.rating,
    crNumeric: crRatingToNumber(challenge.rating as string | null),
    xp: challenge.xp ?? null,
    ac: armorClass.source ? `${armorClass.value} (${armorClass.source})` : armorClass.value,
    hp: (() => {
      const average = number(hitPoints.average) ?? averageHpFromFormula(hitPoints.formula as string | null);
      return hitPoints.formula ? `${average} (${hitPoints.formula})` : average;
    })(),
    movement: compact.movement,
    speed: formatMovement(compact.movement),
    ...Object.fromEntries(ABILITIES.map((ability) => [ability, abilities[ability] ?? null])),
    proficiencies: compact.proficiencies,
    save: formatNamedBonuses(proficiencies.savingThrows),
    skill: formatNamedBonuses(proficiencies.skills),
    vulnerable: list(defenses.vulnerabilities).join(", "),
    resist: list(defenses.resistances).join(", "),
    immune: list(defenses.damageImmunities).join(", "),
    conditionImmune: list(defenses.conditionImmunities).join(", "),
    senses: list(compact.senses).join(", "),
    languages: list(compact.languages).join(", "),
    treasure: compact.treasure ?? null,
    trait: projectActions(compact.traits),
    action: projectActions(compact.actions),
    reaction: projectActions(compact.reactions),
    legendary: [
      ...(number(compact.legendaryUses) !== null ? [{
        name: `Legendary Actions (${number(compact.legendaryUses)}/Turn)`,
        text: `The monster can take ${number(compact.legendaryUses)} Legendary Actions per turn.`,
        recharge: { uses: number(compact.legendaryUses), period: "turn" },
      }] : []),
      ...projectActions(compact.legendaryActions),
      ...list(compact.lair).map((raw) => {
        const lair = record(raw);
        return { name: text(lair.name) ?? "Lair", text: text(lair.description) ?? "", category: "lair" };
      }),
    ],
    spellcasting: projectActions(compact.spellcasting),
    // Names resolve from the spell catalog at the API boundary (routes enrich by id).
    spells: list(compact.spells).map((raw) => {
      const spell = record(raw);
      return { spellId: spell.id ?? null, name: spell.name ?? "", ...(spell.level != null ? { level: spell.level } : {}) };
    }),
  };
}
