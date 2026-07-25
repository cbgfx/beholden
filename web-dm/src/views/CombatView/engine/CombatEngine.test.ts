import { describe, it, expect } from "vitest";
import {
  nextTurn,
  prevTurn,
  ensureActiveId,
  type TurnableCombatant,
} from "./CombatEngine";

function combatant(patch: Partial<TurnableCombatant> & { id: string }): TurnableCombatant {
  return {
    initiative: 10,
    label: patch.id,
    name: patch.id,
    baseType: "monster",
    hpCurrent: 10,
    ...patch,
  };
}

describe("turn navigation skip rules (behaviors 7 & 8)", () => {
  it("keeps a player at 0 HP selectable for death saves", () => {
    const ordered = [
      combatant({ id: "p1", baseType: "player", hpCurrent: 0, initiative: 20 }),
      combatant({ id: "m1", baseType: "monster", hpCurrent: 5, initiative: 10 }),
    ];
    expect(ensureActiveId(ordered, null)).toBe("p1");
  });

  it("skips a monster at 0 HP when advancing to the next turn", () => {
    const ordered = [
      combatant({ id: "p1", baseType: "player", hpCurrent: 10, initiative: 20 }),
      combatant({ id: "m1", baseType: "monster", hpCurrent: 0, initiative: 10 }),
      combatant({ id: "m2", baseType: "monster", hpCurrent: 5, initiative: 5 }),
    ];
    const next = nextTurn(ordered, { round: 1, activeId: "p1" });
    expect(next.activeId).toBe("m2");
    expect(next.round).toBe(1);
  });

  it("skips an iNPC at 0 HP the same way as a monster", () => {
    const ordered = [
      combatant({ id: "p1", baseType: "player", hpCurrent: 10, initiative: 20 }),
      combatant({ id: "n1", baseType: "inpc", hpCurrent: 0, initiative: 10 }),
      combatant({ id: "p2", baseType: "player", hpCurrent: 10, initiative: 5 }),
    ];
    const next = nextTurn(ordered, { round: 1, activeId: "p1" });
    expect(next.activeId).toBe("p2");
  });

  it("does NOT skip a player at 0 HP when advancing to the next turn", () => {
    const ordered = [
      combatant({ id: "m1", baseType: "monster", hpCurrent: 10, initiative: 20 }),
      combatant({ id: "p1", baseType: "player", hpCurrent: 0, initiative: 10 }),
      combatant({ id: "m2", baseType: "monster", hpCurrent: 10, initiative: 5 }),
    ];
    const next = nextTurn(ordered, { round: 1, activeId: "m1" });
    expect(next.activeId).toBe("p1");
  });

  it("keeps a statless world action in normal turn cycling", () => {
    const ordered = [
      combatant({ id: "m1", initiative: 20 }),
      combatant({ id: "world-1", baseType: "world", hpCurrent: null, initiative: 12 }),
      combatant({ id: "p1", baseType: "player", initiative: 5 }),
    ];
    expect(nextTurn(ordered, { round: 1, activeId: "m1" }).activeId).toBe("world-1");
  });

  it("wraps to the next round and re-skips a downed monster going backward too", () => {
    const ordered = [
      combatant({ id: "p1", baseType: "player", hpCurrent: 10, initiative: 20 }),
      combatant({ id: "m1", baseType: "monster", hpCurrent: 0, initiative: 10 }),
      combatant({ id: "m2", baseType: "monster", hpCurrent: 5, initiative: 5 }),
    ];
    const prev = prevTurn(ordered, { round: 2, activeId: "p1" });
    expect(prev.activeId).toBe("m2");
    expect(prev.round).toBe(1);
  });

  it("changes activeId on every advance so the server can restore the incoming combatant's reaction", () => {
    const ordered = [
      combatant({ id: "p1", baseType: "player", hpCurrent: 10, initiative: 20 }),
      combatant({ id: "m1", baseType: "monster", hpCurrent: 10, initiative: 10 }),
    ];
    const state = { round: 1, activeId: "p1" };
    const next = nextTurn(ordered, state);
    expect(next.activeId).not.toBe(state.activeId);
  });
});
