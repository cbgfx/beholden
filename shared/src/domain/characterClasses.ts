export interface CharacterClassEntry {
  id: string;
  classId?: string | null;
  className?: string | null;
  level: number;
  subclass?: string | null;
}

function optionalText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function classLevel(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(20, Math.max(1, parsed));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "_").replace(/^_+|_+$/gu, "");
}

function identityOf(entry: Pick<CharacterClassEntry, "classId" | "className">): string {
  const classId = optionalText(entry.classId);
  if (classId) return `id:${classId.toLowerCase()}`;
  return `name:${String(entry.className).toLowerCase()}`;
}

/**
 * Produces the one-entry-per-class contract used at persistence and UI boundaries.
 * Duplicate records are combined without losing accumulated class levels. The first
 * record remains authoritative for identity and subclass when legacy records disagree.
 */
export function normalizeCharacterClassEntries(value: unknown): CharacterClassEntry[] {
  if (!Array.isArray(value)) return [];

  const normalized: CharacterClassEntry[] = [];
  const indexByIdentity = new Map<string, number>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    const classId = optionalText(record.classId);
    const className = optionalText(record.className);
    if (!classId && !className) continue;

    const entry: CharacterClassEntry = {
      id: optionalText(record.id) ?? `class_${slug(classId ?? className!)}`,
      classId,
      className,
      level: classLevel(record.level),
      subclass: optionalText(record.subclass),
    };
    const identity = identityOf(entry);
    const existingIndex = indexByIdentity.get(identity);
    if (existingIndex == null) {
      indexByIdentity.set(identity, normalized.length);
      normalized.push(entry);
      continue;
    }

    const existing = normalized[existingIndex]!;
    normalized[existingIndex] = {
      ...existing,
      classId: existing.classId ?? entry.classId ?? null,
      className: existing.className ?? entry.className ?? null,
      level: Math.min(20, existing.level + entry.level),
      subclass: existing.subclass ?? entry.subclass ?? null,
    };
  }
  return normalized;
}

/** Character level is derived from, never independent of, canonical class levels. */
export function characterLevelFromClasses(value: unknown): number {
  return normalizeCharacterClassEntries(value).reduce((total, entry) => total + entry.level, 0);
}
