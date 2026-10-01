export function readPersistentFilters<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? "null") } as T; }
  catch { return fallback; }
}

export function writePersistentFilters(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
