import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import {
  createFeatureEffectId,
  type AbilityScoreEffect,
  type ArmorClassEffect,
  type AttackEffect,
  type FeatureEffect,
  type FeatureEffectSource,
  type ModifierEffect,
  type SensesEffect,
  type SpeedEffect,
} from "@/domain/character/featureEffects";
import { parseWordCount } from "@/domain/character/parseFeatureEffects.normalizers";

function textUsesRageGate(text: string): boolean {
  return /while your rage is active|while raging/i.test(text);
}

function isBaseRageRulesText(source: FeatureEffectSource, text: string): boolean {
  return /\brage\b/i.test(source.name)
    && /your rage follows the rules below|damage resistance|rage damage|strength advantage/i.test(text);
}

function createRageGate(source: FeatureEffectSource, text: string) {
  return textUsesRageGate(text) || isBaseRageRulesText(source, text)
    ? { duration: "while_raging" as const }
    : undefined;
}

const ABILITY_NAME_MAP: Record<string, AbilKey> = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
};

export function parseSpeedEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const rageGate = createRageGate(source, text);
  const armorState =
    /if you aren't wearing any armor/i.test(text) ? "no_armor"
    : /while you aren't wearing heavy armor/i.test(text) ? "not_heavy"
    : undefined;
  const bonusMatch = text.match(/your speed increases by (\d+) feet/i);
  if (bonusMatch) {
    effects.push({
      id: createFeatureEffectId(source, "speed", effects.length),
      type: "speed",
      source,
      mode: "bonus",
      amount: { kind: "fixed", value: Number(bonusMatch[1]) },
      gate: {
        duration: rageGate?.duration ?? "passive",
        ...(armorState ? { armorState } : {}),
      },
    } satisfies SpeedEffect);
  }

  for (const match of text.matchAll(/you (?:have|gain)\s+(?:a\s+)?(Fly|Swim|Climb|Burrow)\s+Speed\s+and\s+(?:a\s+)?(Fly|Swim|Climb|Burrow)\s+Speed equal to your Speed/gi)) {
    [match[1], match[2]].forEach((modeName) => {
      effects.push({
        id: createFeatureEffectId(source, "speed", effects.length),
        type: "speed",
        source,
        mode: "grant_mode",
        movementMode: modeName.trim().toLowerCase() as SpeedEffect["movementMode"],
        amount: { kind: "named_progression", key: "equal_to_speed" },
        gate: {
          ...(rageGate ? { duration: rageGate.duration } : {}),
          ...(armorState ? { armorState } : {}),
        },
      } satisfies SpeedEffect);
    });
  }

  for (const match of text.matchAll(/you (?:have|gain)\s+(?:a\s+)?(Fly|Swim|Climb|Burrow) Speed equal to your Speed/gi)) {
    effects.push({
      id: createFeatureEffectId(source, "speed", effects.length),
      type: "speed",
      source,
      mode: "grant_mode",
      movementMode: match[1].trim().toLowerCase() as SpeedEffect["movementMode"],
      amount: { kind: "named_progression", key: "equal_to_speed" },
      gate: {
        ...(rageGate ? { duration: rageGate.duration } : {}),
        ...(armorState ? { armorState } : {}),
      },
    } satisfies SpeedEffect);
  }

  for (const match of text.matchAll(/you (?:have|gain)\s+(?:a\s+)?(Fly|Swim|Climb|Burrow) Speed of\s+(\d+)\s+feet/gi)) {
    effects.push({
      id: createFeatureEffectId(source, "speed", effects.length),
      type: "speed",
      source,
      mode: "grant_mode",
      movementMode: match[1].trim().toLowerCase() as SpeedEffect["movementMode"],
      amount: { kind: "fixed", value: Number(match[2]) },
      gate: {
        ...(rageGate ? { duration: rageGate.duration } : {}),
        ...(armorState ? { armorState } : {}),
      },
    } satisfies SpeedEffect);
  }
}

export function parseArmorClassEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const unarmoredMatch = text.match(/base Armor Class equals 10 plus your ([A-Za-z]+) and ([A-Za-z]+) modifiers/i);
  if (unarmoredMatch) {
    const first = unarmoredMatch[1].trim().toLowerCase().slice(0, 3) as AbilKey;
    const second = unarmoredMatch[2].trim().toLowerCase().slice(0, 3) as AbilKey;
    effects.push({
      id: createFeatureEffectId(source, "armor_class", effects.length),
      type: "armor_class",
      source,
      mode: "base_formula",
      base: 10,
      abilities: [first, second],
      gate: {
        duration: "while_unarmored",
        shieldAllowed: /shield and still gain this benefit/i.test(text),
      },
    } satisfies ArmorClassEffect);
    return;
  }

  const floorMatch = text.match(/your AC equals (\d+) plus your ([A-Za-z]+) modifier if that total is higher than the Beast's AC/i);
  if (floorMatch) {
    effects.push({
      id: createFeatureEffectId(source, "armor_class", effects.length),
      type: "armor_class",
      source,
      mode: "minimum_floor",
      base: Number(floorMatch[1]),
      abilities: [floorMatch[2].trim().toLowerCase().slice(0, 3) as AbilKey],
      gate: { duration: "while_wild_shaped" },
    } satisfies ArmorClassEffect);
  }
}

export function parseAbilityScoreEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const asiMatch = text.match(
    /increase one (?:of your )?ability scores? by (\d+),? or (?:choose two (?:different )?ability scores? and increase each|increase two (?:of your )?ability scores?) by (\d+)/i,
  );
  if (asiMatch) {
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      choiceCount: 1, amount: Number(asiMatch[1]),
      summary: `+${asiMatch[1]} to one ability score`,
    } satisfies AbilityScoreEffect);
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      choiceCount: 2, amount: Number(asiMatch[2]),
      summary: `+${asiMatch[2]} to two ability scores`,
    } satisfies AbilityScoreEffect);
    return;
  }

  const freeMatch = text.match(/increase one (?:of your )?ability scores? by (\d+)/i);
  if (freeMatch) {
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      choiceCount: 1, amount: Number(freeMatch[1]),
      summary: `+${freeMatch[1]} to one ability score`,
    } satisfies AbilityScoreEffect);
    return;
  }

  const twoChoiceMatch = text.match(
    /(?:your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+or\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+score increases?|increase\s+your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+or\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+score)\s+by\s+(\d+)/i,
  );
  if (twoChoiceMatch) {
    const firstAbility = (twoChoiceMatch[1] ?? twoChoiceMatch[3]) as string;
    const secondAbility = (twoChoiceMatch[2] ?? twoChoiceMatch[4]) as string;
    const amount = Number(twoChoiceMatch[5]);
    const a = ABILITY_NAME_MAP[firstAbility.toLowerCase()] as AbilKey;
    const b = ABILITY_NAME_MAP[secondAbility.toLowerCase()] as AbilKey;
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      chooseFrom: [a, b], choiceCount: 1, amount,
      summary: `+${amount} to ${a.toUpperCase()} or ${b.toUpperCase()}`,
    } satisfies AbilityScoreEffect);
    return;
  }

  for (const match of text.matchAll(/(?:your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+score increases?|increase\s+your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+score)\s+by\s+(\d+)/gi)) {
    const abilityToken = (match[1] ?? match[2]) as string;
    const amount = Number(match[3]);
    const ability = ABILITY_NAME_MAP[abilityToken.toLowerCase()] as AbilKey;
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "fixed",
      ability, choiceCount: 1, amount,
      summary: `+${amount} ${ability.toUpperCase()}`,
    } satisfies AbilityScoreEffect);
  }
}

export function parseHitPointBonusEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  if (/hit point maximum increases by (?:an amount equal to )?twice your (?:character )?level/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "hit_points", effects.length),
      type: "hit_points", source, mode: "max_bonus",
      amount: { kind: "character_level", multiplier: 2 },
      summary: "+2 max HP per character level",
    });
    return;
  }

  const fixedMatch = text.match(/hit point maximum increases by (\d+)/i);
  if (fixedMatch) {
    effects.push({
      id: createFeatureEffectId(source, "hit_points", effects.length),
      type: "hit_points", source, mode: "max_bonus",
      amount: { kind: "fixed", value: Number(fixedMatch[1]) },
      summary: `+${fixedMatch[1]} max HP`,
    });
  }
}

export function parseSensesEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const kindMap: Record<string, SensesEffect["senses"][number]["kind"]> = {
    darkvision: "darkvision", blindsight: "blindsight",
    tremorsense: "tremorsense", truesight: "truesight",
  };
  const senses: SensesEffect["senses"] = [];
  const bonusSenses: SensesEffect["senses"] = [];

  const re = /\b(Darkvision|Blindsight|Tremorsense|Truesight)\b[^.]*?(?:out to|with a range of|range of|up to)?\s*(\d+)\s*feet/gi;
  for (const match of text.matchAll(re)) {
    const kind = kindMap[match[1].toLowerCase()];
    const range = Number(match[2]);
    if (!kind || !range) continue;
    const existing = senses.find((s) => s.kind === kind);
    if (existing) { if (range > existing.range) existing.range = range; }
    else senses.push({ kind, range });
  }

  for (const match of text.matchAll(/\b(?:if you already have|if you have|the range of)\s+(Darkvision|Blindsight|Tremorsense|Truesight)[^.]*?increases?\s+by\s+(\d+)\s*feet/gi)) {
    const kind = kindMap[match[1].toLowerCase()];
    const range = Number(match[2]);
    if (!kind || !range) continue;
    const existing = bonusSenses.find((s) => s.kind === kind);
    if (existing) existing.range += range;
    else bonusSenses.push({ kind, range });
  }

  const hasExplicitDarkvisionBonusClause = /\b(?:if you already have|if you have|the range of)\s+Darkvision[^.]*?increases?\s+by\s+\d+\s*feet/i.test(text);
  if (!hasExplicitDarkvisionBonusClause && /already have darkvision/i.test(text)) {
    const pronounBonus = text.match(/\bits range increases?\s+by\s+(\d+)\s*feet/i);
    if (pronounBonus) {
      const range = Number(pronounBonus[1]);
      if (Number.isFinite(range) && range > 0) {
        const existing = bonusSenses.find((s) => s.kind === "darkvision");
        if (existing) existing.range += range;
        else bonusSenses.push({ kind: "darkvision", range });
      }
    }
  }

  if (senses.length > 0) {
    effects.push({
      id: createFeatureEffectId(source, "senses", effects.length),
      type: "senses", source, mode: "grant", senses,
      summary: senses.map((s) => `${s.kind} ${s.range}ft`).join(", "),
    } satisfies SensesEffect);
  }

  if (bonusSenses.length > 0) {
    effects.push({
      id: createFeatureEffectId(source, "senses", effects.length),
      type: "senses",
      source,
      mode: "bonus",
      senses: bonusSenses,
      gate: { notes: "requires_existing_sense" },
      summary: bonusSenses.map((s) => `${s.kind} +${s.range}ft`).join(", "),
    } satisfies SensesEffect);
  }

  if (
    /weapon that has the Heavy property/i.test(text)
    && /extra damage/i.test(text)
    && /equals your Proficiency Bonus/i.test(text)
  ) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "bonus_damage",
      amount: { kind: "proficiency_bonus" },
      gate: {
        duration: "passive",
        weaponFilters: ["heavy_weapon"],
      },
      summary: "Heavy weapon hits deal extra damage equal to Proficiency Bonus",
    } satisfies AttackEffect);
  }
}

export function parsePassiveScoreEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const passiveMatch = text.match(/\+(\d+)(?:\s+bonus)?\s+to (?:your\s+)?passive\s+\w/i);
  if (passiveMatch) {
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier", source,
      target: "passive_score", mode: "bonus",
      amount: { kind: "fixed", value: Number(passiveMatch[1]) },
      summary: `+${passiveMatch[1]} to passive scores`,
    } satisfies ModifierEffect);
  }
}
