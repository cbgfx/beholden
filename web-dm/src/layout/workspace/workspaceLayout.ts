export type PanelAppearance = {
  accent?: string;
  background?: string;
  text?: string;
};
export type WorkspaceView = {
  id: string;
  name: string;
  columns: string[][];
  colors: Record<string, PanelAppearance>;
  appearance: PanelAppearance;
};
export type WorkspacePreferences = { activeId: string; views: WorkspaceView[] };

export function normalizeColumns(
  value: unknown,
  defaults: string[][],
): string[][] {
  const allowed = new Set(defaults.flat());
  const seen = new Set<string>();
  const source =
    Array.isArray(value) && value.length ? value.slice(0, 4) : defaults;
  const columns = source.map((column) =>
    (Array.isArray(column) ? column : []).filter((id): id is string => {
      if (typeof id !== "string" || !allowed.has(id) || seen.has(id))
        return false;
      seen.add(id);
      return true;
    }),
  );
  defaults.forEach((column, index) =>
    column.forEach((id) => {
      if (!seen.has(id)) {
        columns[Math.min(index, columns.length - 1)].push(id);
        seen.add(id);
      }
    }),
  );
  return columns;
}

function normalizeAppearance(value: unknown): PanelAppearance {
  const result: PanelAppearance = {};
  if (!value || typeof value !== "object") return result;
  for (const key of ["accent", "background", "text"] as const) {
    const color = (value as PanelAppearance)[key];
    if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color))
      result[key] = color;
  }
  return result;
}

export function defaultPreferences(defaults: string[][]): WorkspacePreferences {
  return {
    activeId: "default",
    views: [
      {
        id: "default",
        name: "Default",
        columns: defaults.map((c) => [...c]),
        colors: {},
        appearance: {},
      },
    ],
  };
}

export function normalizePreferences(
  value: unknown,
  defaults: string[][],
): WorkspacePreferences {
  if (!value || typeof value !== "object") return defaultPreferences(defaults);
  const raw = value as Partial<WorkspacePreferences>;
  const ids = new Set<string>();
  const views = (Array.isArray(raw.views) ? raw.views : [])
    .slice(0, 12)
    .flatMap((view) => {
      if (!view || typeof view.id !== "string" || !view.id || ids.has(view.id))
        return [];
      ids.add(view.id);
      const colors: Record<string, PanelAppearance> = {};
      for (const id of defaults.flat()) {
        if (view.colors && Object.hasOwn(view.colors, id))
          colors[id] = normalizeAppearance(view.colors[id]);
      }
      return [
        {
          id: view.id,
          name:
            typeof view.name === "string" && view.name.trim()
              ? view.name.slice(0, 60)
              : "Layout",
          columns: normalizeColumns(view.columns, defaults),
          colors,
          appearance: normalizeAppearance(view.appearance),
        },
      ];
    });
  if (!views.length) return defaultPreferences(defaults);
  return {
    views,
    activeId: views.some((v) => v.id === raw.activeId)
      ? raw.activeId!
      : views[0].id,
  };
}

export function movePanel(
  columns: string[][],
  id: string,
  toColumn: number,
  beforeId?: string,
): string[][] {
  if (!columns.flat().includes(id) || !columns[toColumn] || id === beforeId)
    return columns;
  const next = columns.map((column) => column.filter((panel) => panel !== id));
  const index = beforeId ? next[toColumn].indexOf(beforeId) : -1;
  next[toColumn].splice(index < 0 ? next[toColumn].length : index, 0, id);
  return next;
}

export function resizeColumns(columns: string[][], count: number): string[][] {
  count = Math.max(1, Math.min(4, count));
  const next = Array.from({ length: count }, (_, i) => [...(columns[i] ?? [])]);
  if (columns.length > count)
    next[count - 1].push(...columns.slice(count).flat());
  return next;
}
