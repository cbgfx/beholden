import { DEFAULT_SHEET_VIEWS } from "@/views/character/layout/defaultSheetViews";
import { MOVABLE_PANEL_IDS, PANEL_IDS, type PanelColorSettings, type PanelId, type SheetViewDef } from "@/views/character/layout/panelRegistry";

export const MIN_SHEET_COLUMNS = 2;
export const MAX_SHEET_COLUMNS = 5;

const PANEL_ID_SET = new Set<PanelId>(MOVABLE_PANEL_IDS);

export function cloneSheetView(view: SheetViewDef): SheetViewDef {
  return { ...view, layout: view.layout.map((column) => [...column]), panelColors: Object.fromEntries(Object.entries(view.panelColors ?? {}).map(([id, colors]) => [id, { ...colors }])) };
}

function normalizePanelColors(value: unknown): Partial<Record<PanelId, PanelColorSettings>> {
  if (!value || typeof value !== "object") return {};
  const allowed = new Set<PanelId>([...MOVABLE_PANEL_IDS, PANEL_IDS.combatStats]);
  const result: Partial<Record<PanelId, PanelColorSettings>> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!allowed.has(id as PanelId) || !raw || typeof raw !== "object") continue;
    const colors: PanelColorSettings = {};
    for (const key of ["accent", "background", "text"] as const) {
      const color = (raw as PanelColorSettings)[key];
      if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) colors[key] = color;
    }
    if (Object.keys(colors).length) result[id as PanelId] = colors;
  }
  return result;
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
    panelColors: normalizePanelColors(view.panelColors),
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
