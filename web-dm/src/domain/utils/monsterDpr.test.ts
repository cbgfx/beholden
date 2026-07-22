import { describe, expect, it } from "vitest";
import { estimateMonsterDpr, estimateMonsterEffectiveHp, estimatePartyDpr, labelForRoundsToTpk } from "./monsterDpr";
import type { MonsterDetail } from "@/domain/types/compendium";

function monster(action: Record<string, unknown>, extraActions: Array<Record<string, unknown>> = []): MonsterDetail {
  return {
    id: "m_test", name: "Test", cr: null, ac: 10, hp: 10, speed: 30,
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    trait: [], reaction: [], legendary: [], spellcasting: [], raw_json: {},
    action: [
      { id: "burst", name: "Burst", text: "Hit: 10 (2d6 + 3) force damage.", damage: { roll: "2d6+3", type: "force" }, ...action },
      ...extraActions,
    ],
  } as MonsterDetail;
}

describe("monster DPR target pressure", () => {
  it("uses canonical area facts instead of action prose", () => {
    expect(estimateMonsterDpr(monster({ area: "cone" }))?.burstFactor).toBe(1.25);
  });

  it("uses canonical selected-target counts", () => {
    expect(estimateMonsterDpr(monster({ targets: 3 }))?.burstFactor).toBe(1.3);
  });

  it("does not infer area pressure from geometry words in prose", () => {
    expect(estimateMonsterDpr(monster({ text: "Hit: 10 (2d6 + 3) force damage in a cone." }))?.burstFactor).toBe(1);
  });

  it("uses the actual recharge probability over the three-round danger window", () => {
    const result = estimateMonsterDpr(monster({ recharge: { roll: 5 } }));
    expect(result?.dpr).toBeCloseTo(10 * (1 + 2 / 3) / 3);
    expect(result?.burstFactor).toBe(1);
  });

  it("does not infer recharge from prose", () => {
    expect(estimateMonsterDpr(monster({ text: "Recharge 5–6. Hit: 10 (2d6 + 3) force damage." }))?.burstFactor).toBe(1);
  });

  it("does not apply a weak recharge action's pressure to a stronger unrelated routine", () => {
    const result = estimateMonsterDpr(monster({ damage: { roll: "1", type: "force" }, recharge: { roll: 5 } }, [
      { id: "claw", name: "Claw", damage: { roll: "2d10", type: "slashing" } },
      { id: "multiattack", name: "Multiattack", routine: [{ use: "claw", count: 2 }] },
    ]));
    expect(result?.dpr).toBe(22);
    expect(result?.burstFactor).toBe(1);
  });
});

describe("projected difficulty labels", () => {
  it("uses Beholden's established names", () => {
    expect([9, 7, 4, 2.5, 1.25, .5].map(labelForRoundsToTpk)).toEqual([
      "Too Easy", "Easy", "Medium", "Hard", "Lethal", "TPK",
    ]);
  });
});

describe("encounter durability inputs", () => {
  it("estimates party output from participating character levels", () => {
    expect(estimatePartyDpr([1, 5, 11])).toBe(61);
  });

  it("applies a small capped durability adjustment for unknown defense coverage", () => {
    const detail = monster({});
    detail.hp = "100 (10d10 + 45)";
    (detail as Record<string, unknown>).resist = "fire, cold";
    expect(estimateMonsterEffectiveHp(detail)).toBeCloseTo(110);
  });
});

describe("monster DPR from canonical damage facts", () => {
  it("averages typed damage components, never Hit: prose", () => {
    // 2d6+3 -> floor(2 * 3.5) + 3 = 10
    expect(estimateMonsterDpr(monster({}))?.dpr).toBe(10);
  });

  it("returns null for a monster without typed damage — no CR guess, no prose parse", () => {
    expect(estimateMonsterDpr(monster({ damage: undefined, text: "Hit: 45 (7d10 + 7) slashing damage." }))).toBeNull();
  });

  it("sums a typed Multiattack routine by referenced action ids", () => {
    const result = estimateMonsterDpr(monster({}, [
      { id: "bite", name: "Bite", damage: { roll: "1d8+4", type: "piercing" } }, // 8
      { id: "multiattack", name: "Multiattack", text: "Two Bites and one Burst.", routine: [
        { use: "bite", count: 2 },
        { use: "burst" },
      ] },
    ]));
    expect(result?.dpr).toBe(8 * 2 + 10);
  });

  it("takes the strongest option of a typed choose step", () => {
    const result = estimateMonsterDpr(monster({}, [
      { id: "claw", name: "Claw", damage: { roll: "1d4+1", type: "slashing" } }, // 3
      { id: "multiattack", name: "Multiattack", routine: [{ choose: ["claw", "burst"], count: 2 }] },
    ]));
    expect(result?.dpr).toBe(10 * 2);
  });

  it("sums reviewed multi-component damage on one action", () => {
    const result = estimateMonsterDpr(monster({
      damage: [{ roll: "2d8+4", type: "slashing" }, { roll: "2d6", type: "poison" }], // 13 + 7
    }));
    expect(result?.dpr).toBe(20);
  });

  it("adds one conservative typed legendary action instead of a generic multiplier", () => {
    const detail = monster({});
    (detail as Record<string, unknown>).legendary = [{ name: "Lash", damage: { roll: "2d6+3", type: "force" } }];
    expect(estimateMonsterDpr(detail)?.dpr).toBe(20);
  });

  it("uses party AC, hit probability, and critical dice for attack damage", () => {
    const detail = monster({ attack: { toHit: 5, melee: true } });
    // AC 16: 50% hit chance, plus the critical hit's extra 2d6 (7 × 5%).
    expect(estimateMonsterDpr(detail, { armorClasses: [16] })?.dpr).toBeCloseTo(5.35);
  });

  it("averages attack accuracy across the participating party", () => {
    const detail = monster({ attack: { toHit: 5, melee: true } });
    expect(estimateMonsterDpr(detail, { armorClasses: [11, 21] })?.dpr).toBeCloseTo(5.35);
  });

  it("assumes a +0 party save for explicit save DC damage", () => {
    const detail = monster({ description: "Dexterity Saving Throw: DC 16. Failure: damage. Success: no damage." });
    expect(estimateMonsterDpr(detail)?.dpr).toBeCloseTo(7.5);
  });

  it("includes half damage when the explicit success clause says so", () => {
    const detail = monster({ description: "Dexterity Saving Throw: DC 16. Failure: damage. Success: Half damage." });
    expect(estimateMonsterDpr(detail)?.dpr).toBeCloseTo(8.75);
  });
});
