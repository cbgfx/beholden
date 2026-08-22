import { describe, expect, it } from "vitest";
import { activeEnemiesFirst } from "./EngagedEnemiesDrawer";

describe("Player Combat View enemy ordering", () => {
  it("moves downed enemies below active enemies while preserving their relative order", () => {
    const enemies = [
      { id: "down-1", name: "Down One", health: "Down" as const },
      { id: "active-1", name: "Active One", health: "Bloodied" as const },
      { id: "down-2", name: "Down Two", health: "Down" as const },
      { id: "active-2", name: "Active Two", health: "Damaged" as const },
    ];

    expect(activeEnemiesFirst(enemies).map((enemy) => enemy.id)).toEqual([
      "active-1",
      "active-2",
      "down-1",
      "down-2",
    ]);
    expect(enemies[0]?.id).toBe("down-1");
  });
});
