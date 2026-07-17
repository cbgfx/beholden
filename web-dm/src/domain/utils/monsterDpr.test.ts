import { describe, expect, it } from "vitest";
import { estimateMonsterDpr } from "./monsterDpr";
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
    expect(estimateMonsterDpr(monster({ area: "cone" }))?.burstFactor).toBe(1.2);
  });

  it("uses canonical selected-target counts", () => {
    expect(estimateMonsterDpr(monster({ targets: 3 }))?.burstFactor).toBe(1.2);
  });

  it("does not infer area pressure from geometry words in prose", () => {
    expect(estimateMonsterDpr(monster({ text: "Hit: 10 (2d6 + 3) force damage in a cone." }))?.burstFactor).toBe(1);
  });

  it("uses canonical recharge facts", () => {
    expect(estimateMonsterDpr(monster({ recharge: { roll: 5 } }))?.burstFactor).toBe(1.35);
  });

  it("does not infer recharge from prose", () => {
    expect(estimateMonsterDpr(monster({ text: "Recharge 5–6. Hit: 10 (2d6 + 3) force damage." }))?.burstFactor).toBe(1);
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

  it("applies the legendary factor to typed damage", () => {
    const detail = monster({});
    (detail as Record<string, unknown>).legendary = [{ name: "Lash", text: "One Burst attack." }];
    expect(estimateMonsterDpr(detail)?.dpr).toBe(10 * 1.25);
  });
});
