import { describe, expect, it } from "vitest";
import { PANEL_IDS } from "@/views/character/layout/panelRegistry";
import { cloneSheetView, normalizeSheetView, normalizeSheetViews, resolveActiveSheetView } from "@/views/character/layout/sheetViewLayout";

describe("sheet view layout normalization", () => {
  it("preserves and clones column labels/icons while dropping invalid and removed-column metadata", () => {
    const view = normalizeSheetView({ id: "custom", name: "Custom", columns: 2, layout: [[], []], columnHeaders: [{ name: "  Magic  ", icon: "spells" }, { name: 123, icon: "unknown" }, { name: "Removed" }] } as never);
    expect(view.columnHeaders).toEqual([{ name: "Magic", icon: "spells" }, {}]);
    expect(normalizeSheetView({ ...view, columnHeaders: [{ icon: "game-icons:sword" }, { icon: "game-icons:bad/path" }] } as never).columnHeaders).toEqual([{ icon: "game-icons:sword" }, {}]);
    const copy = cloneSheetView(view);
    copy.columnHeaders![0].name = "Changed";
    expect(view.columnHeaders![0].name).toBe("Magic");
    expect(normalizeSheetView({ ...view, columns: 3 }).columnHeaders).toEqual([{ name: "Magic", icon: "spells" }, {}, {}]);
    expect(normalizeSheetView({ ...view, columnHeaders: undefined }).layout).toEqual(view.layout);
  });
  it("caps columns and removes duplicate or unknown panels", () => {
    const view = normalizeSheetView({
      id: " custom ",
      name: " ",
      columns: 99,
      layout: [[PANEL_IDS.skills, PANEL_IDS.skills, "removed-panel"], [PANEL_IDS.inventory]],
    } as never);
    expect(view.id).toBe("custom");
    expect(view.name).toBe("Untitled View");
    expect(view.columns).toBe(5);
    expect(view.layout).toHaveLength(5);
    expect(view.layout[0]).toEqual([PANEL_IDS.skills]);
    expect(view.layout[1]).toEqual([PANEL_IDS.inventory]);
  });

  it("falls back to fresh defaults when persisted data is unusable", () => {
    const first = normalizeSheetViews([]);
    const second = normalizeSheetViews(undefined);
    first[0].layout[0].push(PANEL_IDS.inventory);
    expect(second[0].layout[0]).not.toContain(PANEL_IDS.inventory);
  });

  it("resolves a stale selection to Combat", () => {
    const views = normalizeSheetViews(undefined);
    expect(resolveActiveSheetView(views, "deleted-view").id).toBe("play");
  });

  it("keeps valid per-panel colours and drops invalid entries", () => {
    const view = normalizeSheetView({
      id: "custom",
      name: "Custom",
      columns: 2,
      layout: [[], []],
      panelColors: {
        [PANEL_IDS.skills]: { accent: "#123abc", background: "invalid", text: "#ffffff" },
        [PANEL_IDS.combatStats]: { background: "#202735" },
        removedPanel: { accent: "#000000" },
      },
    } as never);

    expect(view.panelColors).toEqual({
      [PANEL_IDS.skills]: { accent: "#123abc", text: "#ffffff" },
      [PANEL_IDS.combatStats]: { background: "#202735" },
    });
  });
});
