export const PLACE_FILTER_FIELDS = ["continents", "countries", "locations", "points-of-interest"] as const;
export type PlaceFilters = Record<typeof PLACE_FILTER_FIELDS[number], string[]>;
export const emptyPlaceFilters = (): PlaceFilters => ({ continents: [], countries: [], locations: [], "points-of-interest": [] });
type Place = { id: string; name: string; referenceType: string; parent?: { id: string } | null };

export function filterPlaces<T extends Place>(rows: T[], query: string, filters: PlaceFilters): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const needle = query.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (needle && !row.name.toLocaleLowerCase().includes(needle)) return false;
    const hierarchy = new Map<string, Set<string>>();
    const visited = new Set<string>();
    let current: Place | undefined = row;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      const values = hierarchy.get(current.referenceType) ?? new Set<string>();
      values.add(current.id);
      hierarchy.set(current.referenceType, values);
      current = current.parent ? byId.get(current.parent.id) : undefined;
    }
    return PLACE_FILTER_FIELDS.every((key) => !filters[key].length || filters[key].some((id) =>
      id === "__none__" ? !hierarchy.has(key) : hierarchy.get(key)?.has(id)));
  });
}

/** A picker depends only on filters above it, never its own or lower selections. */
export function placeFilterOptions<T extends Place>(rows: T[], filters: PlaceFilters, field: keyof PlaceFilters): T[] {
  const upstream = emptyPlaceFilters();
  for (const key of PLACE_FILTER_FIELDS) {
    if (key === field) break;
    upstream[key] = filters[key];
  }
  return filterPlaces(rows, "", upstream).filter((row) => row.referenceType === field);
}

export function reconcilePlaceFilters(rows: Place[], filters: PlaceFilters): PlaceFilters {
  const next = { ...filters };
  let changed = false;
  for (const key of PLACE_FILTER_FIELDS) {
    const valid = new Set(placeFilterOptions(rows, next, key).map((row) => row.id));
    const selected = next[key].filter((id) => id === "__none__" || valid.has(id));
    if (selected.length !== next[key].length) { next[key] = selected; changed = true; }
  }
  return changed ? next : filters;
}
