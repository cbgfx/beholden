function sameStringArrays(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}

export function sameSelectionMap(a: Record<string, string[]>, b: Record<string, string[]>): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (!sameStringArrays(aKeys, bKeys)) return false;
  return aKeys.every((key) => sameStringArrays(a[key] ?? [], b[key] ?? []));
}

export function hasKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}
