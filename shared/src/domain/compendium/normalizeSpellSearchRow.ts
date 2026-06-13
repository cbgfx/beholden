export type SpellSearchRow = {
  id: string;
  name: string;
  level: number | null;
  school: string | null;
  time: string | null;
  ritual: boolean;
  concentration: boolean;
  components: string | null;
  classes: string | null;
};

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as Record<string, unknown>;
}

/**
 * Normalize spell search rows coming from the server.
 * Defensive against malformed imports (for example, name as object).
 */
export function normalizeSpellSearchRow(input: unknown): SpellSearchRow | null {
  const row = asRecord(input);
  if (!row) return null;

  const id = typeof row.id === "string" ? row.id : "";
  const rawName = row.name;
  const name =
    typeof rawName === "string" ? rawName : rawName != null ? String(rawName) : "";

  const level = row.level == null ? null : Number(row.level);
  const school = row.school == null ? null : String(row.school);
  const time = row.time == null ? null : String(row.time);
  const ritual = Boolean(row.ritual);
  const concentration = Boolean(row.concentration);
  const components = row.components == null ? null : String(row.components);
  const classes = row.classes == null ? null : String(row.classes);

  if (!id || !name || name === "[object Object]") return null;
  return {
    id,
    name,
    level: Number.isFinite(level) ? level : null,
    school,
    time,
    ritual,
    concentration,
    components,
    classes,
  };
}
