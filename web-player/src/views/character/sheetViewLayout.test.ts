import { describe, expect, it } from "vitest";
import { PANEL_IDS } from "@/views/character/panelRegistry";
import { normalizeSheetView, normalizeSheetViews, resolveActiveSheetView } from "@/views/character/sheetViewLayout";

describe("sheet view layout normalization", () => {
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
});
