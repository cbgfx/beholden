export function nextSort(items) {
  return (
    items.reduce((m, x) => Math.max(m, Number.isFinite(x?.sort) ? x.sort : 0), 0) + 1
  );
}

export function bySortThenUpdatedDesc(a, b) {
  const as = Number.isFinite(a?.sort) ? a.sort : 1e9;
  const bs = Number.isFinite(b?.sort) ? b.sort : 1e9;
  if (as !== bs) return as - bs;
  return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
}
