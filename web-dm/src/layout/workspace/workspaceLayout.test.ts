import { describe, expect, it } from "vitest";
import {
  movePanel,
  normalizePreferences,
  resizeColumns,
} from "./workspaceLayout";

describe("DM workspace layouts", () => {
  it("recovers removed, duplicated and newly introduced panel IDs without losing panels", () => {
    const result = normalizePreferences(
      {
        activeId: "missing",
        views: [
          {
            id: "a",
            name: "Prep",
            columns: [["players", "players", "deleted"]],
            colors: { players: { accent: "red", text: "#abcdef" } },
          },
        ],
      },
      [["players"], ["notes", "new-panel"]],
    );
    expect(result.activeId).toBe("a");
    expect(result.views[0].columns).toEqual([
      ["players", "notes", "new-panel"],
    ]);
    expect(result.views[0].colors.players).toEqual({ text: "#abcdef" });
  });
  it("moves across columns, reorders within a column, and preserves panels when columns shrink", () => {
    const initial = [["a", "b"], ["c"], []];
    const moved = movePanel(initial, "b", 1, "c");
    expect(moved).toEqual([["a"], ["b", "c"], []]);
    expect(movePanel(moved, "b", 1)).toEqual([["a"], ["c", "b"], []]);
    expect(resizeColumns(moved, 1)).toEqual([["a", "b", "c"]]);
    expect(initial).toEqual([["a", "b"], ["c"], []]);
  });
});
