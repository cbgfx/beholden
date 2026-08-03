/** Tags a freshly-built tagged entry (spell, invocation, ...) with the level it was acquired at,
 * preserving whatever the character already had recorded rather than silently re-stamping it on
 * every save. Outcome per entry:
 *  - already known AND already tagged -> keep the existing tag (never re-stamp on re-save)
 *  - already known but untagged (legacy data) -> stays untagged; never guess a level for it
 *  - not previously known, entry already carries its own precise level (e.g. a class feature's
 *    unlock level, known exactly even when the creator builds several levels at once) -> keep it
 *  - not previously known, no precise level available -> tagged with `fallbackLevel` (the level
 *    this save/level-up happened at -- the coarsest honest answer we have)
 */
export function tagAcquisitionLevel<T extends { id?: string; level?: number | null }>(
  entries: T[],
  existingById: Map<string, { level?: number | null }>,
  fallbackLevel: number,
): (T & { level: number | null })[] {
  const occurrences = new Map<string, number>();
  return entries.map((entry) => {
    const occurrence = entry.id ? occurrences.get(entry.id) ?? 0 : 0;
    if (entry.id) occurrences.set(entry.id, occurrence + 1);
    const existing = entry.id
      ? existingById.get(`${entry.id}#${occurrence}`) ?? (occurrence === 0 ? existingById.get(entry.id) : undefined)
      : undefined;
    if (existing) return { ...entry, level: existing.level ?? null };
    return { ...entry, level: entry.level ?? fallbackLevel };
  });
}

/** Builds the id->{level} lookup `tagAcquisitionLevel` needs from a character's previously saved
 * tagged entries (e.g. `characterData.proficiencies.spells`). */
export function buildAcquisitionLevelIndex(
  entries: Array<{ id?: string; level?: number | null }> | null | undefined,
): Map<string, { level?: number | null }> {
  const index = new Map<string, { level?: number | null }>();
  const occurrences = new Map<string, number>();
  for (const entry of entries ?? []) {
    if (!entry.id) continue;
    const occurrence = occurrences.get(entry.id) ?? 0;
    occurrences.set(entry.id, occurrence + 1);
    index.set(`${entry.id}#${occurrence}`, entry);
    if (occurrence === 0) index.set(entry.id, entry);
  }
  return index;
}

/** Same preserve-or-stamp semantics as `tagAcquisitionLevel`, for fields with no tagged-array home
 * of their own (e.g. `chosenOptionals`, `extraFeatIds`) -- a flat id->level map instead of an
 * array of tagged objects. Callers namespace their own ids (e.g. `optional:Pact Boon: ...`,
 * `extraFeat:feat_id`) so unrelated categories sharing one map can't collide. */
export function tagAcquisitionLevelMap(
  ids: string[],
  existing: Record<string, number | null> | undefined,
  fallbackLevel: number,
): Record<string, number | null> {
  const next: Record<string, number | null> = {};
  for (const id of ids) {
    next[id] = existing && id in existing ? (existing[id] ?? null) : fallbackLevel;
  }
  return next;
}

/** Drops only selections known to have been acquired above the target, then removes the newest
 * remaining selections when a bounded known-count applies. A null limit represents accumulated
 * knowledge such as a Wizard spellbook. */
export function trimAcquiredIdsForLevel(
  ids: string[],
  levelOf: (id: string) => number | null,
  targetLevel: number,
  limit: number | null,
): string[] {
  const eligible = ids.filter((id) => {
    const level = levelOf(id);
    return level === null || level <= targetLevel;
  });
  if (limit === null || eligible.length <= limit) return eligible;
  return [...eligible].sort((a, b) => (levelOf(a) ?? -1) - (levelOf(b) ?? -1)).slice(0, limit);
}
