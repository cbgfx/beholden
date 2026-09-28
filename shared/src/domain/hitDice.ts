// shared/src/domain/hitDice.ts
// Hit dice are stored as how many of each die size are SPENT (`hitDiceSpent`, keyed by die size),
// and nothing else. How many are left is always the maximum (from the character's class levels)
// minus that. They used to be stored as how many were LEFT, twice - a total (`hitDiceCurrent`) and
// per die size (`hitDiceCurrentBySize`) - and a count of what is left goes stale the moment the
// maximum changes: a character who had rested to full came out of a level-up one die short.
// Nothing spent means every die is available, which is also what a long rest restores.

export type HitDiceSpent = Record<string, number>;
export type HitDicePool = { dieSize: number; max: number; current: number };

/** The pools of hit dice: each die size's maximum, and how many are left after what was spent. */
export function hitDicePools(
  maximumByDie: ReadonlyMap<number, number>,
  spent: HitDiceSpent | null | undefined,
): HitDicePool[] {
  return Array.from(maximumByDie, ([dieSize, max]) => {
    const used = Math.max(0, Math.floor(Number(spent?.[String(dieSize)] ?? 0) || 0));
    return { dieSize, max, current: Math.max(0, max - Math.min(max, used)) };
  });
}

/** The spent record after setting one pool's remaining dice; entries with nothing spent are left out. */
export function hitDiceSpentWithCurrent(pools: readonly HitDicePool[], dieSize: number, nextCurrent: number): HitDiceSpent {
  const spent: HitDiceSpent = {};
  for (const pool of pools) {
    const current = pool.dieSize === dieSize ? Math.max(0, Math.min(pool.max, Math.floor(nextCurrent))) : pool.current;
    if (pool.max - current > 0) spent[String(pool.dieSize)] = pool.max - current;
  }
  return spent;
}

// MARK: - Folding the old fields in

const record = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

/**
 * Converts the old "left" counts to a spent record and deletes them. Needs each die size's maximum
 * (`maximumByDie`, from the class levels); a size whose maximum is unknown counts nothing as spent.
 * The per-size count is used when present; the old total only for a character with a single die
 * size. Returns null when there was nothing to fold.
 */
export function foldLegacyHitDice(
  data: Record<string, unknown>,
  maximumByDie: ReadonlyMap<number, number>,
): Record<string, unknown> | null {
  const hasTotal = Object.prototype.hasOwnProperty.call(data, "hitDiceCurrent");
  const hasBySize = Object.prototype.hasOwnProperty.call(data, "hitDiceCurrentBySize");
  if (!hasTotal && !hasBySize) return null;

  const spent: HitDiceSpent = { ...(record(data.hitDiceSpent) as HitDiceSpent | null ?? {}) };
  const bySize = record(data.hitDiceCurrentBySize);
  const soleDie = maximumByDie.size === 1 ? [...maximumByDie.keys()][0]! : null;
  for (const [dieSize, max] of maximumByDie) {
    const left = bySize && bySize[String(dieSize)] != null
      ? Number(bySize[String(dieSize)])
      : dieSize === soleDie && data.hitDiceCurrent != null ? Number(data.hitDiceCurrent) : null;
    if (left === null || !Number.isFinite(left)) continue;
    const used = max - Math.max(0, Math.min(max, Math.floor(left)));
    if (used > 0) spent[String(dieSize)] = used;
    else delete spent[String(dieSize)];
  }

  const next: Record<string, unknown> = { ...data };
  delete next.hitDiceCurrent;
  delete next.hitDiceCurrentBySize;
  if (Object.keys(spent).length > 0) next.hitDiceSpent = spent;
  else delete next.hitDiceSpent;
  return next;
}
