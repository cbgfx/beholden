import { describe, expect, it } from "vitest";
import { calcEncounterDifficulty } from "./difficulty";

describe("calcEncounterDifficulty", () => {
  const calculate = (totalXp: number, levels = [5, 5, 5, 5]) => calcEncounterDifficulty({ partyHpMax: 120, hostileDpr: 30, totalXp, playerLevels: levels });

  it("uses the 2024 raw-XP budgets without a monster-count multiplier", () => {
    expect(calculate(2_000).officialDifficulty).toBe("Low");
    expect(calculate(2_001).officialDifficulty).toBe("Moderate");
    expect(calculate(3_001).officialDifficulty).toBe("High");
  });

  it("adds mixed-level character budgets", () => {
    const result = calculate(1, [1, 2, 3]);
    expect([result.lowBudget, result.moderateBudget, result.highBudget]).toEqual([300, 450, 700]);
  });

  it("keeps DPR telemetry from overriding the official label", () => {
    const result = calcEncounterDifficulty({ partyHpMax: 10, hostileDpr: 1_000, totalXp: 25, playerLevels: [5] });
    expect(result.officialDifficulty).toBe("Low");
    expect(result.projectedThreat).toBe("TPK");
    expect(result.roundsToTpk).toBeCloseTo(.01);
  });

  it("reports missing party and hostile inputs honestly", () => {
    expect(calculate(100, []).officialDifficulty).toBe("No Party");
    expect(calculate(100, []).projectedThreat).toBe("Unavailable");
    expect(calculate(0).officialDifficulty).toBe("No Hostiles");
  });

  it("uses the sum of per-monster projected DPR without amplifying unrelated damage", () => {
    const result = calcEncounterDifficulty({
      partyHpMax: 100,
      hostileDpr: 30,
      projectedDpr: 35,
      totalXp: 100,
      playerLevels: [5, 5, 5, 5],
    });
    expect(result.projectedDpr).toBe(35);
    expect(result.burstFactor).toBeCloseTo(35 / 30);
    expect(result.roundsToTpk).toBeCloseTo(100 / 35);
    expect(result.projectedThreat).toBe("Hard");
  });

  it("downgrades glass-cannon enemies that the party removes quickly", () => {
    const result = calcEncounterDifficulty({ partyHpMax: 100, partyHpValues: [20, 25, 25, 30], hostileDpr: 20, projectedDpr: 20, monsterEffectiveHp: 20, partyDpr: 20, totalXp: 100, playerLevels: [5, 5, 5, 5] });
    expect(result.roundsToTpk).toBe(5);
    expect(result.monsterSurvivalRounds).toBe(1);
    expect(result.expectedPartyDamageRatio).toBeCloseTo(.17);
    expect(result.projectedThreat).toBe("Too Easy");
  });

  it("recognizes durable enemies that survive long enough to exhaust the party", () => {
    const result = calcEncounterDifficulty({ partyHpMax: 100, partyHpValues: [20, 25, 25, 30], hostileDpr: 20, projectedDpr: 20, monsterEffectiveHp: 200, partyDpr: 20, totalXp: 100, playerLevels: [5, 5, 5, 5] });
    expect(result.monsterSurvivalRounds).toBe(10);
    expect(result.expectedPartyDamageRatio).toBeCloseTo(1.3);
    expect(result.projectedThreat).toBe("TPK");
    expect(result.roundsToFirstDown).toBeGreaterThan(0);
  });
});
