export type SpellSearchRow = {
  id: string;
  name: string;
  level: number | null;
  school: string | null;
  time: string | null;
};

/**
 * Normalize spell search rows coming from the server.
 * Defensive against malformed imports (e.g. name as object, "[object Object]", missing ids).
 */
export function normalizeSpellSearchRow(input: any): SpellSearchRow | null {
  const id = typeof input?.id === "string" ? input.id : "";
  const rawName = input?.name;
  const name =
    typeof rawName === "string" ? rawName : rawName != null ? String(rawName) : "";

  const level = input?.level == null ? null : Number(input.level);
  const school = input?.school == null ? null : String(input.school);
  const time = input?.time == null ? null : String(input.time);

  if (!id || !name || name === "[object Object]") return null;
  return {
    id,
    name,
    level: Number.isFinite(level as any) ? level : null,
    school,
    time,
  };
}
