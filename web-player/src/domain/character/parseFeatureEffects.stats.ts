import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import {
  createFeatureEffectId,
  type AbilityScoreEffect,
  type ArmorClassEffect,
  type FeatureEffect,
  type FeatureEffectSource,
  type ModifierEffect,
  type SensesEffect,
  type SpeedEffect,
} from "@/domain/character/featureEffects";
import { createRageGate } from "@/domain/character/parseFeatureEffects.normalizers";

const ABILITY_NAME_MAP: Record<string, AbilKey> = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
};

// Adjective form → canonical SpeedEffect movementMode, e.g. "swimming" → "swim"
const SPEED_ADJECTIVE_MAP: Record<string, SpeedEffect["movementMode"]> = {
  fly: "fly", flying: "fly",
  swim: "swim", swimming: "swim",
  climb: "climb", climbing: "climb",
  burrow: "burrow", burrowing: "burrow",
};

export function parseSpeedEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const rageGate = createRageGate(source, text);
  const armorState =
    /(?:if|while) you aren't wearing (?:any )?armor\b/i.test(text) ? "no_armor"
    : /while you aren't wearing heavy armor/i.test(text) ? "not_heavy"
    : undefined;
  // Items gate their speed grants on being equipped ("while wearing this ring", etc.).
  const isEquippedEffect = /while (?:wearing|you wear|you (?:are )?attuned|holding) this\b/i.test(text);
  const baseDuration = rageGate?.duration ?? (isEquippedEffect ? "while_equipped" : "passive");

  const bonusMatch = text.match(/your speed increases by (\d+) feet/i);
  if (bonusMatch) {
    // Detect per-level scaling (e.g. Monk Unarmored Movement)
    const isMonkScaling = /this bonus increases when you reach certain monk levels/i.test(text);
    effects.push({
      id: createFeatureEffectId(source, "speed", effects.length),
      type: "speed",
      source,
      mode: "bonus",
      amount: isMonkScaling
        ? { kind: "named_progression", key: "monk_unarmored_movement" }
        : { kind: "fixed", value: Number(bonusMatch[1]) },
      gate: {
        duration: baseDuration,
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
        movementMode: SPEED_ADJECTIVE_MAP[modeName.trim().toLowerCase()] ?? modeName.trim().toLowerCase() as SpeedEffect["movementMode"],
        amount: { kind: "named_progression", key: "equal_to_speed" },
        gate: {
          duration: baseDuration,
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
      movementMode: SPEED_ADJECTIVE_MAP[match[1].trim().toLowerCase()] ?? match[1].trim().toLowerCase() as SpeedEffect["movementMode"],
      amount: { kind: "named_progression", key: "equal_to_speed" },
      gate: {
        duration: baseDuration,
        ...(armorState ? { armorState } : {}),
      },
    } satisfies SpeedEffect);
  }

  // Matches both "Swim Speed of 40 feet" (2024 style) and "swimming speed of 40 feet" (older style).
  for (const match of text.matchAll(/you (?:have|gain)\s+(?:a\s+)?(fly(?:ing)?|swim(?:ming)?|climb(?:ing)?|burrow(?:ing)?) speed of\s+(\d+)\s+feet/gi)) {
    const movementMode = SPEED_ADJECTIVE_MAP[match[1].trim().toLowerCase()];
    if (!movementMode) continue;
    effects.push({
      id: createFeatureEffectId(source, "speed", effects.length),
      type: "speed",
      source,
      mode: "grant_mode",
      movementMode,
      amount: { kind: "fixed", value: Number(match[2]) },
      gate: {
        duration: baseDuration,
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
  // Items: ability score floor effects — "while equipped" gate implied by context.
  // Pattern A: "Your CON score is/becomes/changes to 19 while you wear/hold/attune..."
  //   → Amulet of Health, Headband of Intellect, Gauntlets of Ogre Power
  for (const match of text.matchAll(
    /Your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) score (?:is|becomes|changes to) (\d+) while you\b/gi,
  )) {
    const abil = ABILITY_NAME_MAP[match[1].toLowerCase()] as AbilKey;
    const minimum = Number(match[2]);
    if (!abil || !Number.isFinite(minimum) || minimum <= 0) continue;
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source,
      mode: "set_minimum",
      ability: abil, choiceCount: 1, amount: minimum,
      gate: { duration: "while_equipped" },
      summary: `${match[1]} score is at least ${minimum} (while equipped)`,
    } satisfies AbilityScoreEffect);
  }
  // Pattern B: "While wearing this belt, your STR score changes to 23."
  //   → Belt of Giant Strength family (subject comes after the while-clause)
  for (const match of text.matchAll(
    /While (?:wearing|holding|attuned to) this[^,]*,\s*your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) score (?:is|becomes|changes to) (\d+)/gi,
  )) {
    const abil = ABILITY_NAME_MAP[match[1].toLowerCase()] as AbilKey;
    const minimum = Number(match[2]);
    if (!abil || !Number.isFinite(minimum) || minimum <= 0) continue;
    // Deduplicate: skip if Pattern A already produced an identical effect for this ability.
    const alreadyCaptured = effects.some(
      (e) => e.type === "ability_score" && e.mode === "set_minimum" && e.ability === abil && e.amount === minimum,
    );
    if (alreadyCaptured) continue;
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source,
      mode: "set_minimum",
      ability: abil, choiceCount: 1, amount: minimum,
      gate: { duration: "while_equipped" },
      summary: `${match[1]} score is at least ${minimum} (while equipped)`,
    } satisfies AbilityScoreEffect);
  }

  const maximumMatch = text.match(/to a maximum of (\d+)/i);
  const maximum = maximumMatch ? Number(maximumMatch[1]) : 20;
  const asiMatch = text.match(
    /increase one (?:of your )?ability scores? by (\d+),? or (?:choose two (?:different )?ability scores? and increase each|increase two (?:of your )?ability scores?) by (\d+)/i,
  );
  if (asiMatch) {
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      choiceCount: 1, amount: Number(asiMatch[1]),
      maximum,
      summary: `+${asiMatch[1]} to one ability score`,
    } satisfies AbilityScoreEffect);
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      choiceCount: 2, amount: Number(asiMatch[2]),
      maximum,
      summary: `+${asiMatch[2]} to two ability scores`,
    } satisfies AbilityScoreEffect);
    return;
  }

  const freeMatch = text.match(/increase one (?:(?:of your )?ability scores?|ability score of your choice) by (\d+)/i);
  if (freeMatch) {
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      choiceCount: 1, amount: Number(freeMatch[1]),
      maximum,
      summary: `+${freeMatch[1]} to one ability score`,
    } satisfies AbilityScoreEffect);
    return;
  }

  const abilityListPattern = "(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?:(?:\\s*,\\s*|\\s*,?\\s+or\\s+)(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma))+";
  const listedChoiceMatch =
    text.match(new RegExp(`increase your (${abilityListPattern})(?:\\s+score)?\\s+by\\s+(\\d+)`, "i"))
    ?? text.match(new RegExp(`your (${abilityListPattern})\\s+score increases?\\s+by\\s+(\\d+)`, "i"));
  if (listedChoiceMatch) {
    const chooseFrom = Array.from(
      listedChoiceMatch[1].matchAll(/Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma/gi),
      (match) => ABILITY_NAME_MAP[match[0].toLowerCase()] as AbilKey,
    );
    const amount = Number(listedChoiceMatch[2]);
    if (chooseFrom.length === 1) {
      effects.push({
        id: createFeatureEffectId(source, "ability_score", effects.length),
        type: "ability_score", source, mode: "fixed",
        ability: chooseFrom[0], choiceCount: 1, amount, maximum,
        summary: `+${amount} ${chooseFrom[0].toUpperCase()}`,
      } satisfies AbilityScoreEffect);
      return;
    }
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      chooseFrom, choiceCount: 1, amount, maximum,
      summary: `+${amount} to ${chooseFrom.map((ability) => ability.toUpperCase()).join(" or ")}`,
    } satisfies AbilityScoreEffect);
    return;
  }

  for (const match of text.matchAll(/(?:your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+score increases?|increase\s+your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?:\s+score)?)\s+by\s+(\d+)/gi)) {
    const abilityToken = (match[1] ?? match[2]) as string;
    const amount = Number(match[3]);
    const ability = ABILITY_NAME_MAP[abilityToken.toLowerCase()] as AbilKey;
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "fixed",
      ability, choiceCount: 1, amount, maximum,
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

  const directPerLevelMatch = text.match(
    /hit point maximum increases by (\d+)[^.]*(?:for each|per) (?:character )?level/i,
  );
  if (directPerLevelMatch) {
    const multiplier = Number(directPerLevelMatch[1]);
    effects.push({
      id: createFeatureEffectId(source, "hit_points", effects.length),
      type: "hit_points", source, mode: "max_bonus",
      amount: { kind: "character_level", multiplier },
      summary: `+${multiplier} max HP per character level`,
    });
    return;
  }

  // "increases by N ... whenever/each time you gain a level" — per-level scaling (e.g. Dwarven Toughness)
  const perLevelMatch = text.match(/hit point maximum increases by (\d+)[^.]*(?:whenever|each time|every time) you gain a level/i);
  if (perLevelMatch) {
    const multiplier = Number(perLevelMatch[1]);
    effects.push({
      id: createFeatureEffectId(source, "hit_points", effects.length),
      type: "hit_points", source, mode: "max_bonus",
      amount: { kind: "character_level", multiplier },
      summary: `+${multiplier} max HP per character level`,
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

  // Senses granted only temporarily (e.g. "gain Tremorsense ... for 10 minutes") are not passive.
  const temporarySenses = new Set<string>();
  for (const m of text.matchAll(/\byou gain\s+(?:\w+\s+)?(Darkvision|Blindsight|Tremorsense|Truesight)\b[^.]*for\s+\d+\s+(?:minutes?|hours?)/gi)) {
    const word = m[1]?.toLowerCase();
    if (word) temporarySenses.add(word);
  }

  const re = /\b(Darkvision|Blindsight|Tremorsense|Truesight)\b[^.]*?(?:out to|with a range of|range of|up to)?\s*(\d+)\s*feet/gi;
  for (const match of text.matchAll(re)) {
    const kind = kindMap[match[1].toLowerCase()];
    const range = Number(match[2]);
    if (!kind || !range) continue;
    if (temporarySenses.has(kind)) continue;
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
    // Handles both "its range increases by N" and "increases its range by N".
    const pronounBonus = text.match(/\b(?:its range increases?\s+by|increases?\s+its range\s+by)\s+(\d+)\s*feet/i);
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
