import { labelForRoundsToTpk, type ProjectedThreatLabel } from "./monsterDpr";

type OfficialDifficultyLabel = "No Party" | "No Hostiles" | "Low" | "Moderate" | "High";
type EncounterThreatLabel = "Unavailable" | ProjectedThreatLabel;

// 2024 DMG / Free Rules XP budget per character: [low, moderate, high].
const XP_BUDGETS: Record<number, [number, number, number]> = {
  1: [50, 75, 100], 2: [100, 150, 200], 3: [150, 225, 400], 4: [250, 375, 500],
  5: [500, 750, 1100], 6: [600, 1000, 1400], 7: [750, 1300, 1700], 8: [1000, 1700, 2100],
  9: [1300, 2000, 2600], 10: [1600, 2300, 3100], 11: [1900, 2900, 4100], 12: [2200, 3700, 4700],
  13: [2600, 4200, 5400], 14: [2900, 4900, 6200], 15: [3300, 5400, 7800], 16: [3800, 6100, 9800],
  17: [4500, 7200, 11700], 18: [5000, 8700, 14200], 19: [5500, 10700, 17200], 20: [6400, 13200, 22000],
};

export type EncounterDifficulty = {
  officialDifficulty: OfficialDifficultyLabel;
  projectedThreat: EncounterThreatLabel;
  roundsToTpk: number;
  partyHpMax: number;
  hostileDpr: number;
  projectedDpr: number;
  burstFactor: number;
  encounterXp: number;
  lowBudget: number;
  moderateBudget: number;
  highBudget: number;
  monsterSurvivalRounds: number;
  expectedPartyDamageRatio: number;
  roundsToFirstDown: number;
};

function partyBudgets(playerLevels: number[]): [number, number, number] {
  return playerLevels.reduce<[number, number, number]>((total, level) => {
    const row = XP_BUDGETS[Math.min(20, Math.max(1, Math.round(level)))] ?? XP_BUDGETS[1];
    return [total[0] + row[0], total[1] + row[1], total[2] + row[2]];
  }, [0, 0, 0]);
}

export function calcEncounterDifficulty(args: {
  partyHpMax: number;
  hostileDpr: number;
  projectedDpr?: number;
  burstFactor?: number;
  totalXp?: number;
  playerLevels?: number[];
  partyHpValues?: number[];
  monsterEffectiveHp?: number;
  partyDpr?: number;
}): EncounterDifficulty {
  const playerLevels = (args.playerLevels ?? []).filter((level) => Number.isFinite(level) && level > 0);
  const [lowBudget, moderateBudget, highBudget] = partyBudgets(playerLevels);
  const encounterXp = typeof args.totalXp === "number" && Number.isFinite(args.totalXp) ? Math.max(0, Math.round(args.totalXp)) : 0;
  const officialDifficulty: OfficialDifficultyLabel = !playerLevels.length
    ? "No Party"
    : encounterXp <= 0
      ? "No Hostiles"
      : encounterXp <= lowBudget
        ? "Low"
        : encounterXp <= moderateBudget
          ? "Moderate"
          : "High";

  const partyHpMax = Math.max(0, Math.round(args.partyHpMax ?? 0));
  const hostileDprRaw = typeof args.hostileDpr === "number" && Number.isFinite(args.hostileDpr) ? Math.max(0, args.hostileDpr) : 0;
  const legacyBurstFactor = typeof args.burstFactor === "number" && Number.isFinite(args.burstFactor) ? Math.max(1, args.burstFactor) : 1;
  const projectedDpr = typeof args.projectedDpr === "number" && Number.isFinite(args.projectedDpr)
    ? Math.max(0, args.projectedDpr)
    : hostileDprRaw * legacyBurstFactor;
  const burstFactor = hostileDprRaw > 0 ? Math.max(1, projectedDpr / hostileDprRaw) : 1;
  const roundsToTpk = projectedDpr > 0 ? partyHpMax / projectedDpr : Number.POSITIVE_INFINITY;
  const partyHpValues = (args.partyHpValues ?? []).filter((hp) => Number.isFinite(hp) && hp > 0);
  const partyDpr = typeof args.partyDpr === "number" && Number.isFinite(args.partyDpr) ? Math.max(0, args.partyDpr) : 0;
  const monsterEffectiveHp = typeof args.monsterEffectiveHp === "number" && Number.isFinite(args.monsterEffectiveHp) ? Math.max(0, args.monsterEffectiveHp) : 0;
  const monsterSurvivalRounds = partyDpr > 0 ? monsterEffectiveHp / partyDpr : Number.POSITIVE_INFINITY;
  const activeRounds = Number.isFinite(monsterSurvivalRounds) ? Math.max(.5, monsterSurvivalRounds) : Number.POSITIVE_INFINITY;
  const expectedDamageBeforeDefeat = Number.isFinite(activeRounds) ? projectedDpr * activeRounds * (activeRounds <= 1 ? .85 : .65) : Number.POSITIVE_INFINITY;
  const expectedPartyDamageRatio = partyHpMax > 0 ? expectedDamageBeforeDefeat / partyHpMax : Number.POSITIVE_INFINITY;
  const lowestHp = partyHpValues.length ? Math.min(...partyHpValues) : 0;
  const focusedDpr = partyHpValues.length ? projectedDpr * Math.min(.6, 1.5 / partyHpValues.length) : 0;
  const roundsToFirstDown = lowestHp > 0 && focusedDpr > 0 ? lowestHp / focusedDpr : Number.POSITIVE_INFINITY;
  const simulatedThreat: EncounterThreatLabel = expectedPartyDamageRatio <= .2 ? "Too Easy"
    : expectedPartyDamageRatio <= .4 ? "Easy"
      : expectedPartyDamageRatio <= .65 ? "Medium"
        : expectedPartyDamageRatio <= .95 ? "Hard"
          : expectedPartyDamageRatio <= 1.25 ? "Lethal"
            : "TPK";
  const projectedThreat: EncounterThreatLabel = !playerLevels.length || partyHpMax <= 0
    ? "Unavailable"
    : partyDpr > 0 && monsterEffectiveHp > 0
      ? simulatedThreat
      : labelForRoundsToTpk(roundsToTpk);

  return { officialDifficulty, projectedThreat, roundsToTpk, partyHpMax, hostileDpr: hostileDprRaw, projectedDpr, burstFactor, encounterXp, lowBudget, moderateBudget, highBudget, monsterSurvivalRounds, expectedPartyDamageRatio, roundsToFirstDown };
}
