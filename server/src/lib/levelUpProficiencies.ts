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
