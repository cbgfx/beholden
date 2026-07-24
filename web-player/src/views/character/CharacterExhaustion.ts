export type ExhaustionRuleset = "5e" | "5.5e";

const MAX_EXHAUSTION = 6;

function clampExhaustion(level: number): number {
  return Math.max(0, Math.min(MAX_EXHAUSTION, Math.floor(level)));
}

/**
 * 2024: a flat -2 penalty per exhaustion level, applied to every d20 test (ability checks, attack
 * rolls, saving throws). 2014 has no numeric d20 penalty at all — it uses disadvantage instead
 * (see {@link hasExhaustionAbilityCheckDisadvantage} and {@link hasExhaustionAttackAndSaveDisadvantage}).
 */
export function getExhaustionD20Penalty(ruleset: ExhaustionRuleset | undefined, level: number): number {
  if (ruleset === "5e") return 0;
  return clampExhaustion(level) * 2;
}

/** 2024: -5 ft of speed per level. 2014: speed is halved at tier 2+, reduced to 0 at tier 5+. */
export function getExhaustedSpeed(ruleset: ExhaustionRuleset | undefined, baseSpeed: number, level: number): number {
  const normalized = clampExhaustion(level);
  if (ruleset === "5e") {
    if (normalized >= 5) return 0;
    if (normalized >= 2) return Math.floor(baseSpeed / 2);
    return baseSpeed;
  }
  return Math.max(0, baseSpeed - normalized * 5);
}

/** 2014 only: exhaustion tier 1+ imposes disadvantage on ability checks (including skill checks). */
export function hasExhaustionAbilityCheckDisadvantage(ruleset: ExhaustionRuleset | undefined, level: number): boolean {
  return ruleset === "5e" && clampExhaustion(level) >= 1;
}

/** 2014 only: exhaustion tier 3+ imposes disadvantage on attack rolls and saving throws. */
export function hasExhaustionAttackAndSaveDisadvantage(ruleset: ExhaustionRuleset | undefined, level: number): boolean {
  return ruleset === "5e" && clampExhaustion(level) >= 3;
}

/** 2014 only: exhaustion tier 4+ halves hit point maximum. 2024 has no HP max effect. */
export function getExhaustionHpMaxMultiplier(ruleset: ExhaustionRuleset | undefined, level: number): number {
  return ruleset === "5e" && clampExhaustion(level) >= 4 ? 0.5 : 1;
}

export function getExhaustionEffects(ruleset: ExhaustionRuleset | undefined, level: number): string[] {
  const normalized = clampExhaustion(level);
  if (normalized === 0) return [];
  if (ruleset === "5e") {
    const effects: string[] = [];
    if (normalized >= 1) effects.push("Disadvantage on ability checks");
    if (normalized >= 2) effects.push("Speed halved");
    if (normalized >= 3) effects.push("Disadvantage on attack rolls and saving throws");
    if (normalized >= 4) effects.push("Hit point maximum halved");
    if (normalized >= 5) effects.push("Speed reduced to 0");
    if (normalized >= MAX_EXHAUSTION) effects.push("Death");
    return effects;
  }
  return [
    `D20 Tests −${getExhaustionD20Penalty(ruleset, normalized)}`,
    `Speed −${normalized * 5} ft.`,
    ...(normalized >= MAX_EXHAUSTION ? ["Death"] : []),
  ];
}
