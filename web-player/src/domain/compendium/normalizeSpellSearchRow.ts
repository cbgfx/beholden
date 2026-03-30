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

export function normalizeSpellSearchRow(input: any): SpellSearchRow | null {
  const id = typeof input?.id === "string" ? input.id : "";
  const rawName = input?.name;
  const name = typeof rawName === "string" ? rawName : rawName != null ? String(rawName) : "";
  const level = input?.level == null ? null : Number(input.level);
  const school = input?.school == null ? null : String(input.school);
  const time = input?.time == null ? null : String(input.time);
  const ritual = Boolean(input?.ritual);
  const concentration = Boolean(input?.concentration);
  const components = input?.components == null ? null : String(input.components);
  const classes = input?.classes == null ? null : String(input.classes);
  if (!id || !name || name === "[object Object]") return null;
  return { id, name, level: Number.isFinite(level as any) ? level : null, school, time, ritual, concentration, components, classes };
}
