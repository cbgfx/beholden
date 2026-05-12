export function normalizeCompendiumClassId(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";

  let candidate = raw.replace(/^class_+/i, "").trim();
  if (!candidate || /^primary$/i.test(candidate)) return "";
  if (/^c_[a-z0-9_ -]+$/i.test(candidate)) return candidate.toLowerCase().replace(/\s+/g, "_");

  candidate = candidate
    .toLowerCase()
    .replace(/^c_+/i, "")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]+/g, "")
    .replace(/^_+|_+$/g, "");

  return candidate ? `c_${candidate}` : "";
}

export function resolveStoredCompendiumClassId(entry: {
  classId?: unknown;
  id?: unknown;
  className?: unknown;
} | null | undefined, fallbackClassName?: unknown): string {
  return (
    normalizeCompendiumClassId(entry?.classId) ||
    normalizeCompendiumClassId(entry?.id) ||
    normalizeCompendiumClassId(entry?.className) ||
    normalizeCompendiumClassId(fallbackClassName)
  );
}
