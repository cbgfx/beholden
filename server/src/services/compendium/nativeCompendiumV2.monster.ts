import { parseAttackFromText } from "../../lib/attacks.js";
import { isCanonicalV2Shape, upgradeCanonicalV2Entry } from "./nativeCompendiumV2Migration.js";
import { type JsonRecord, ABILITIES, record, list, text, number, split } from "./nativeCompendiumV2.helpers.js";
import { compactMonsterEntry } from "./monsterCompaction.js";

function legacyAbilityScore(value: unknown): number | null {
  const score = number(value);
  // Legacy vehicle stat blocks use 0 as a sentinel for "not applicable."
  // Canonical v2 expresses that explicitly as null.
  return score === 0 ? null : score;
}

function splitDefense(value: unknown): string[] {
  return String(value ?? "").split(";").flatMap((part) => {
    const clause = part.trim();
    return /\bfrom\b/iu.test(clause) ? [clause] : split(clause);
  }).filter(Boolean);
}

function parseSignedList(value: unknown): Array<{ name: string; bonus: number | null }> {
  return split(value).map((part) => {
    const match = part.match(/^(.+?)\s*([+-]\d+)$/u);
    return { name: (match?.[1] ?? part).trim(), bonus: match?.[2] ? Number(match[2]) : null };
  });
}

function parseProficiencyInput(value: unknown): Array<{ name: string; bonus: number | null }> {
  if (typeof value === "string") return parseSignedList(value);
  if (Array.isArray(value)) {
    return value.flatMap((raw) => {
      if (typeof raw === "string") return parseSignedList(raw);
      const item = record(raw);
      const name = text(item.name);
      return name ? [{ name, bonus: number(item.bonus) }] : [];
    });
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).map(([name, bonus]) => ({ name, bonus: number(bonus) }));
  }
  return [];
}


function parseArmorClass(value: unknown) {
  if (typeof value === "number") return { value, source: null };
  const raw = text(value);
  const match = raw?.match(/^(\d+)(?:\s*\((.+)\))?$/u);
  return {
    value: match?.[1] ? Number(match[1]) : number(value),
    source: match?.[2]?.trim() ?? null,
  };
}

function parseHitPoints(value: unknown) {
  if (typeof value === "number") return { average: value, formula: null };
  const raw = text(value);
  const match = raw?.match(/^(\d+)(?:\s*\((.+)\))?$/u);
  return {
    average: match?.[1] ? Number(match[1]) : number(value),
    formula: match?.[2]?.replace(/\s+/gu, " ").trim() ?? null,
  };
}

function parseMovement(value: unknown) {
  const modes: Record<string, number | null> = {
    walk: null, burrow: null, climb: null, fly: null, swim: null,
  };
  const raw = String(value ?? "");
  for (const part of raw.split(",")) {
    const match = part.trim().match(/^(?:(walk|burrow|climb|fly|swim)\s+)?(\d+)\s*ft\.?/iu);
    if (!match?.[2]) continue;
    modes[(match[1] ?? "walk").toLowerCase()] = Number(match[2]);
  }
  return { ...modes, hover: /\bhover\b/iu.test(raw) };
}

function parseRecharge(value: unknown): JsonRecord | null {
  const source = text(value)?.toUpperCase();
  if (!source) return null;
  const roll = source.match(/^(?:D|RECHARGE\s+)([1-6])(?:-[1-6])?$/u);
  if (roll?.[1]) {
    return { kind: "roll", minimumRoll: Number(roll[1]), uses: null, period: null, source };
  }
  const limited = source.match(/^(\d+)\/(DAY|TURN)$/u);
  if (limited?.[1] && limited[2]) {
    return { kind: "uses", minimumRoll: null, uses: Number(limited[1]), period: limited[2].toLowerCase(), source };
  }
  if (source.includes("LONG")) {
    return { kind: "rest", minimumRoll: null, uses: null, period: "long_rest", source };
  }
  if (source.includes("SHORT")) {
    return { kind: "rest", minimumRoll: null, uses: null, period: "short_rest", source };
  }
  return { kind: "special", minimumRoll: null, uses: null, period: null, source };
}

function actionEntries(value: unknown) {
  return list(value).map((raw, index) => {
    const entry = record(raw);
    const description = text(entry.text ?? entry.description) ?? "";
    const attackSource = entry.attacks ?? entry.attack;
    const explicitAttacks = (
      Array.isArray(attackSource)
        ? attackSource
        : typeof attackSource === "string" || typeof attackSource === "number"
          ? [attackSource]
          : []
    )
      .map(text)
      .filter((attack): attack is string => attack != null);
    return {
      id: text(entry.id) ?? `action_${index + 1}`,
      name: text(entry.name ?? entry.title) ?? `Action ${index + 1}`,
      description,
      category: text(entry.category ?? entry["@_category"]),
      recharge: parseRecharge(entry.recharge),
      ...(entry.slots ? {
        spellSlots: Object.fromEntries(
          String(entry.slots).split(",").map((count, index) => [String(index + 1), parseInt(count.trim(), 10) || 0]),
        ),
      } : {}),
      attack: record(entry.attack).toHit != null
        ? entry.attack
        : parseAttackFromText(description),
      attacks: explicitAttacks,
    };
  });
}

function movementToLegacy(value: unknown): string | null {
  const movement = record(value);
  const parts = ["walk", "burrow", "climb", "fly", "swim"].flatMap((mode) => {
    const distance = number(movement[mode]);
    return distance == null ? [] : [`${mode} ${distance} ft.${mode === "fly" && movement.hover === true ? " (hover)" : ""}`];
  });
  return parts.join(", ") || null;
}

function namedBonusesToLegacy(value: unknown): string | null {
  const parts = list(value).map((raw) => {
    const item = record(raw);
    const name = text(item.name);
    const bonus = number(item.bonus);
    return name ? `${name}${bonus == null ? "" : ` ${bonus >= 0 ? "+" : ""}${bonus}`}` : "";
  }).filter(Boolean);
  return parts.join(", ") || null;
}

function actionEntriesToLegacy(value: unknown) {
  return list(value).map((raw) => {
    const entry = record(raw);
    const recharge = record(entry.recharge);
    const attack = record(entry.attack);
    return {
      name: text(entry.name) ?? "",
      text: text(entry.description) ?? "",
      category: text(entry.category),
      recharge: text(recharge.source),
      attack: number(attack.toHit) !== null ? {
        toHit: number(attack.toHit),
        reach: text(attack.reach),
        range: text(attack.range),
        melee: attack.melee === true,
        ranged: attack.ranged === true,
        damage: text(attack.damage),
        damageType: text(attack.damageType),
      } : null,
      attacks: list(entry.attacks).map(String),
    };
  });
}

export function monsterToV2(entry: JsonRecord): JsonRecord {
  if (isCanonicalV2Shape("monsters", entry)) return upgradeCanonicalV2Entry("monsters", entry);
  return compactMonsterEntry({
    id: text(entry.id),
    name: text(entry.name),
    source: text(entry.source),
    classification: {
      size: text(entry.size),
      type: text(entry.typeKey ?? entry.type_key),
      description: text(entry.typeFull ?? entry.type_full),
      sortName: text(entry.sortName ?? entry.sortname),
      alignment: text(entry.alignment),
      ancestry: text(entry.ancestry),
      environment: split(entry.environment),
    },
    description: text(entry.description),
    initiativeBonus: number(entry.initiativeBonus ?? entry.init),
    passivePerception: number(entry.passivePerception ?? entry.passive),
    npc: entry.npc === true,
    challenge: {
      rating: text(entry.cr),
      numeric: number(entry.crNumeric ?? entry.cr_numeric),
      xp: number(entry.xp),
    },
    armorClass: parseArmorClass(entry.ac),
    hitPoints: parseHitPoints(entry.hp),
    movement: parseMovement(entry.speed),
    abilities: Object.fromEntries(ABILITIES.map((ability) => [ability, legacyAbilityScore(entry[ability])])),
    proficiencies: {
      savingThrows: parseProficiencyInput(entry.save),
      skills: parseProficiencyInput(entry.skill),
    },
    defenses: {
      vulnerabilities: splitDefense(entry.vulnerable),
      resistances: splitDefense(entry.resist),
      damageImmunities: splitDefense(entry.immune),
      conditionImmunities: splitDefense(entry.conditionImmune),
    },
    senses: split(entry.senses),
    languages: split(entry.languages),
    traits: actionEntries(entry.trait),
    actions: actionEntries(entry.action),
    reactions: actionEntries(entry.reaction),
    legendaryActions: actionEntries(entry.legendary),
    spellcasting: actionEntries(entry.spellcasting),
    spells: list(entry.spells).flatMap((spell) => {
      if (typeof spell === "string") {
        return split(spell).map((name) => ({ id: null, name }));
      }
      const value = record(spell);
      return [{ id: text(value.spellId ?? value.id), name: text(value.name) }];
    }),
  });
}

export function monsterFromV2(entry: JsonRecord): JsonRecord {
  const compact = compactMonsterEntry(entry);
  const classification = record(compact.classification);
  const challenge = record(compact.challenge);
  const armorClass = record(compact.armorClass);
  const hitPoints = record(compact.hitPoints);
  const abilities = record(compact.abilities);
  const proficiencies = record(compact.proficiencies);
  const defenses = record(compact.defenses);
  return {
    id: compact.id,
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
    crNumeric: challenge.numeric,
    xp: challenge.xp ?? null,
    ac: armorClass.source ? `${armorClass.value} (${armorClass.source})` : armorClass.value,
    hp: hitPoints.formula ? `${hitPoints.average} (${hitPoints.formula})` : hitPoints.average,
    speed: movementToLegacy(compact.movement),
    ...Object.fromEntries(ABILITIES.map((ability) => [ability, abilities[ability] ?? null])),
    save: namedBonusesToLegacy(proficiencies.savingThrows),
    skill: namedBonusesToLegacy(proficiencies.skills),
    vulnerable: list(defenses.vulnerabilities).join(", "),
    resist: list(defenses.resistances).join(", "),
    immune: list(defenses.damageImmunities).join(", "),
    conditionImmune: list(defenses.conditionImmunities).join(", "),
    senses: list(compact.senses).join(", "),
    languages: list(compact.languages).join(", "),
    trait: actionEntriesToLegacy(compact.traits),
    action: actionEntriesToLegacy(compact.actions),
    reaction: actionEntriesToLegacy(compact.reactions),
    legendary: actionEntriesToLegacy(compact.legendaryActions),
    spellcasting: actionEntriesToLegacy(compact.spellcasting),
    spells: list(compact.spells).map((raw) => {
      const spell = record(raw);
      return { spellId: spell.id ?? null, name: spell.name ?? "" };
    }),
  };
}
