const PERMANENT_PROFICIENCY_KEYS = ["skills", "tools", "languages", "armor", "weapons", "saves"] as const;

type ProficiencyEntry = { name?: unknown; [key: string]: unknown };

function mergeEntries(existing: unknown, incoming: unknown): unknown {
  if (!Array.isArray(existing)) return incoming;
  if (!Array.isArray(incoming)) return existing;

  const merged = new Map<string, ProficiencyEntry>();
  for (const entry of [...existing, ...incoming]) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as ProficiencyEntry;
    const name = String(record.name ?? "").trim();
    if (!name) continue;
    merged.set(name.toLocaleLowerCase(), record);
  }
  return Array.from(merged.values());
}

export function preserveProficienciesOnLevelUp(
  existingCharacterData: Record<string, unknown> | null | undefined,
  nextCharacterData: Record<string, unknown> | null,
  isLevelUp: boolean,
): Record<string, unknown> | null {
  if (!isLevelUp || !existingCharacterData || !nextCharacterData) return nextCharacterData;

  const existing = existingCharacterData.proficiencies;
  const incoming = nextCharacterData.proficiencies;
  if (!existing || typeof existing !== "object") return nextCharacterData;

  const existingMap = existing as Record<string, unknown>;
  const incomingMap = incoming && typeof incoming === "object" ? incoming as Record<string, unknown> : {};
  const proficiencies = { ...incomingMap };
  for (const key of PERMANENT_PROFICIENCY_KEYS) {
    proficiencies[key] = mergeEntries(existingMap[key], incomingMap[key]);
  }

  return { ...nextCharacterData, proficiencies };
}

/** A single-class progression editor cannot author another class's grants. Preserve entries with
 * explicit stable ownership for those classes even during same-level edits or level-downs. */
export function preserveForeignClassProficiencies(
  existingCharacterData: Record<string, unknown> | null | undefined,
  nextCharacterData: Record<string, unknown> | null,
  editedClassEntryId: string | undefined,
): Record<string, unknown> | null {
  if (!editedClassEntryId || !existingCharacterData || !nextCharacterData) return nextCharacterData;
  const existing = existingCharacterData.proficiencies;
  if (!existing || typeof existing !== "object") return nextCharacterData;
  const incoming = nextCharacterData.proficiencies;
  const incomingMap = incoming && typeof incoming === "object" ? incoming as Record<string, unknown> : {};
  const next = { ...incomingMap };
  for (const [key, value] of Object.entries(existing as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const foreign = value.filter((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const record = entry as Record<string, unknown>;
      const owner = typeof record.classEntryId === "string" ? record.classEntryId
        : typeof record.sourceKey === "string" && record.sourceKey.startsWith("class:") ? record.sourceKey.slice(6)
        : null;
      return owner !== null && owner !== editedClassEntryId;
    });
    next[key] = mergeEntries(foreign, incomingMap[key]);
  }
  return { ...nextCharacterData, proficiencies: next };
}
