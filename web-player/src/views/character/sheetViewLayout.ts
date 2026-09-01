import { DEFAULT_SHEET_VIEWS } from "@/views/character/defaultSheetViews";
import { MOVABLE_PANEL_IDS, type PanelId, type SheetViewDef } from "@/views/character/panelRegistry";

export const MIN_SHEET_COLUMNS = 2;
export const MAX_SHEET_COLUMNS = 5;

const PANEL_ID_SET = new Set<PanelId>(MOVABLE_PANEL_IDS);

export function cloneSheetView(view: SheetViewDef): SheetViewDef {
  return { ...view, layout: view.layout.map((column) => [...column]) };
}

export function createDefaultSheetViews(): SheetViewDef[] {
  return DEFAULT_SHEET_VIEWS.map(cloneSheetView);
}

function isPanelId(value: unknown): value is PanelId {
  return typeof value === "string" && PANEL_ID_SET.has(value as PanelId);
}

/** Makes persisted/user-authored view data safe to render. It caps column
 * counts, removes duplicate/unknown panel ids, and ensures layout length and
 * `columns` always agree. */
export function normalizeSheetView(view: SheetViewDef): SheetViewDef {
  const columns = Math.max(
    MIN_SHEET_COLUMNS,
    Math.min(MAX_SHEET_COLUMNS, Math.trunc(Number(view.columns) || MIN_SHEET_COLUMNS)),
  );
  const seen = new Set<PanelId>();
  const layout = Array.from({ length: columns }, (_, index) => {
    const source = Array.isArray(view.layout?.[index]) ? view.layout[index] : [];
    return source.filter((id): id is PanelId => {
      if (!isPanelId(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  });
  return {
    id: String(view.id ?? "").trim(),
    name: String(view.name ?? "").trim() || "Untitled View",
    columns,
    layout,
  };
}

export function normalizeSheetViews(views: SheetViewDef[] | null | undefined): SheetViewDef[] {
  if (!Array.isArray(views) || views.length === 0) return createDefaultSheetViews();
  const seenIds = new Set<string>();
  const normalized: SheetViewDef[] = [];
  for (const candidate of views) {
    if (!candidate || typeof candidate !== "object") continue;
    const view = normalizeSheetView(candidate);
    if (!view.id || seenIds.has(view.id)) continue;
    seenIds.add(view.id);
    normalized.push(view);
  }
  return normalized.length ? normalized : createDefaultSheetViews();
}

export function resolveActiveSheetView(views: SheetViewDef[], requestedId: string): SheetViewDef {
  return views.find((view) => view.id === requestedId)
    ?? views.find((view) => view.id === "play")
    ?? views[0];
}
