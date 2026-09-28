// shared/src/domain/spellPreparation.ts
// Whether a spell is prepared lives on the spell's own entry in `proficiencies.spells`, as
// `prepared: true`, and nowhere else. It used to be kept as lists of names beside the spell list -
// a top-level `preparedSpells` and one per class in `classSpellSelections` - and every writer had to
// keep all three in step. Removing a spell then left it prepared in a list, still using a slot.
// With the flag on the entry, removing the spell removes its preparation; there is nothing to sync.
//
// Always-prepared spells (domain, oath, subclass lists) are not stored at all: they are computed
// from the features that grant them.

/** A spell's name as the sheet shows it: without a trailing "[source]" tag, spaces collapsed. */
export function normalizeSpellTrackingName(name: string | null | undefined): string {
  return String(name ?? "")
    .replace(/\s*\[[^\]]+\]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The key a spell is known by across the sheet: its name, lower case, letters and digits only. */
export function normalizeSpellTrackingKey(name: string | null | undefined): string {
  return normalizeSpellTrackingName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export type PreparableSpell = { name?: string; classEntryId?: string | null; prepared?: boolean };

/** Keys of every spell marked prepared. */
export function preparedSpellKeys(spells: readonly PreparableSpell[] | null | undefined): string[] {
  return Array.from(new Set((spells ?? [])
    .filter((spell) => spell?.prepared === true)
    .map((spell) => normalizeSpellTrackingKey(spell.name))
    .filter(Boolean)));
}

/**
 * Prepared keys per class. A spell belongs to the class named on its entry; a spell with no class
 * (older characters, or one added by hand) counts toward `fallbackClassId`, the character's first
 * class that prepares spells.
 */
export function preparedSpellKeysByClass(
  spells: readonly PreparableSpell[] | null | undefined,
  classIds: readonly string[],
  fallbackClassId: string | null | undefined,
): Record<string, string[]> {
  const result: Record<string, string[]> = Object.fromEntries(classIds.map((id) => [id, [] as string[]]));
  for (const spell of spells ?? []) {
    if (spell?.prepared !== true) continue;
    const owner = spell.classEntryId && classIds.includes(spell.classEntryId) ? spell.classEntryId : fallbackClassId;
    const key = normalizeSpellTrackingKey(spell.name);
    if (!owner || !key || !result[owner] || result[owner]!.includes(key)) continue;
    result[owner]!.push(key);
  }
  return result;
}

/** The same spells with exactly `keys` prepared. Entries keep every other field untouched. */
export function withPreparedSpellKeys<T extends PreparableSpell>(spells: readonly T[], keys: Iterable<string>): T[] {
  const prepared = new Set(keys);
  return spells.map((spell) => {
    const isPrepared = prepared.has(normalizeSpellTrackingKey(spell.name));
    if (isPrepared === (spell.prepared === true)) return spell;
    if (isPrepared) return { ...spell, prepared: true };
    const { prepared: _dropped, ...rest } = spell;
    return rest as T;
  });
}

/**
 * For a builder that regenerates spell entries (the character creator, level-up): the new list
 * with each spell prepared if it was prepared in the old list, plus any `alsoPrepared`.
 */
export function carryPreparedSpells<T extends PreparableSpell>(
  next: readonly T[],
  previous: readonly PreparableSpell[] | null | undefined,
  alsoPrepared: Iterable<string> = [],
): T[] {
  return withPreparedSpellKeys(next, [...preparedSpellKeys(previous), ...alsoPrepared]);
}

// MARK: - Folding the old lists in

const record = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const names = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

/**
 * Moves the old prepared lists onto the spell entries and deletes them. A class's list marks that
 * class's spells (or spells with no class); the top-level list is used only when there are no
 * class lists, and then marks any spell of that name. A name that matches no spell on the sheet was
 * a leftover of a removed spell and is dropped.
 * Returns null when there was nothing to fold.
 */
export function foldLegacyPreparedSpells(data: Record<string, unknown>): Record<string, unknown> | null {
  const selections = record(data.classSpellSelections);
  const hasTopLevel = Object.prototype.hasOwnProperty.call(data, "preparedSpells");
  const scopedClassIds = selections
    ? Object.keys(selections).filter((classId) => Object.prototype.hasOwnProperty.call(record(selections[classId]) ?? {}, "preparedSpells"))
    : [];
  if (!hasTopLevel && scopedClassIds.length === 0) return null;

  const proficiencies = record(data.proficiencies) ?? {};
  const spells = Array.isArray(proficiencies.spells) ? proficiencies.spells as Array<Record<string, unknown>> : [];
  const byClass = new Map<string, Set<string>>();
  for (const classId of scopedClassIds) {
    byClass.set(classId, new Set(names(record(selections![classId])!.preparedSpells).map(normalizeSpellTrackingKey)));
  }
  // The per-class lists are what the sheet counted and showed. The top-level list was only a copy
  // of them, and a drifted one (adding a spell once wrote only the copy), so it counts only for a
  // character that has no per-class lists at all. Checked against the live database: honouring the
  // copy as well would have prepared a spell a player saw as unprepared.
  const anyClass = new Set(scopedClassIds.length > 0 ? [] : names(data.preparedSpells).map(normalizeSpellTrackingKey));

  // Where a list covers a spell (its class's list, or the top-level one when it counts), the list decides; that is
  // also what makes an old client's un-prepare stick when it still sends lists. A spell no list
  // covers keeps its own flag.
  const nextSpells = spells.map((spell) => {
    if (!spell || typeof spell !== "object" || typeof spell.name !== "string") return spell;
    const key = normalizeSpellTrackingKey(spell.name);
    const owner = typeof spell.classEntryId === "string" ? spell.classEntryId : null;
    const classList = owner && byClass.has(owner) ? byClass.get(owner)! : null;
    const covered = (hasTopLevel && scopedClassIds.length === 0) || classList !== null || (!owner && byClass.size > 0);
    if (!covered) return spell;
    const prepared = anyClass.has(key)
      || (classList ? classList.has(key) : !owner && [...byClass.values()].some((keys) => keys.has(key)));
    if (prepared) return spell.prepared === true ? spell : { ...spell, prepared: true };
    const { prepared: _dropped, ...rest } = spell;
    return rest;
  });

  const next: Record<string, unknown> = { ...data, proficiencies: { ...proficiencies, spells: nextSpells } };
  delete next.preparedSpells;
  if (selections) {
    next.classSpellSelections = Object.fromEntries(Object.entries(selections).map(([classId, raw]) => {
      const selection = record(raw);
      if (!selection) return [classId, raw];
      const { preparedSpells: _folded, ...rest } = selection;
      return [classId, rest];
    }));
  }
  return next;
}
