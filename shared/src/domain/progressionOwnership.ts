export type ProgressionSelectionKind = "invocation" | "optional" | "extra-feat" | "maneuver" | "metamagic" | "infusion" | "plan";

export interface ProgressionSelectionOccurrence {
  occurrenceId: string;
  kind: ProgressionSelectionKind;
  valueId: string;
  sourceKey: string;
  classEntryId?: string | null;
  classLevel?: number | null;
  characterLevel?: number | null;
}

export interface ProgressionReplacementEvent {
  eventId: string;
  kind: ProgressionSelectionKind;
  sourceKey: string;
  removedOccurrenceId: string;
  addedOccurrenceId: string;
  classEntryId: string;
  classLevel: number;
  characterLevel: number;
}

const clean = (value: unknown) => String(value ?? "").trim();

export function progressionOccurrenceId(args: {
  kind: ProgressionSelectionKind;
  valueId: string;
  sourceKey: string;
  classEntryId?: string | null;
  classLevel?: number | null;
  ordinal?: number;
}): string {
  return [args.kind, clean(args.classEntryId) || "unowned", Math.max(0, Number(args.classLevel) || 0), clean(args.sourceKey), clean(args.valueId), Math.max(0, args.ordinal ?? 0)]
    .map((part) => encodeURIComponent(String(part))).join(":");
}

/** Reconciles a visible value array with durable occurrence records. Existing occurrences survive
 * by identity and order; only genuinely added copies receive a new identity. */
export function reconcileProgressionOccurrences(args: {
  existing: ProgressionSelectionOccurrence[];
  kind: ProgressionSelectionKind;
  values: string[];
  sourceKey: string;
  classEntryId: string;
  classLevel: number;
  characterLevel: number;
  preserveAcrossOwners?: boolean;
  classLevelForValue?: (valueId: string, ordinal: number) => number | null;
}): ProgressionSelectionOccurrence[] {
  const inScope = (entry: ProgressionSelectionOccurrence) => entry.kind === args.kind && (args.preserveAcrossOwners || entry.classEntryId === args.classEntryId);
  const available = args.existing.filter(inScope);
  const untouched = args.existing.filter((entry) => !inScope(entry));
  const used = new Set<string>();
  const next = args.values.map((valueId, ordinal) => {
    const retained = available.find((entry) => entry.valueId === valueId && !used.has(entry.occurrenceId));
    if (retained) { used.add(retained.occurrenceId); return retained; }
    const classLevel = args.classLevelForValue?.(valueId, ordinal) ?? args.classLevel;
    return {
      occurrenceId: progressionOccurrenceId({ kind: args.kind, valueId, sourceKey: args.sourceKey, classEntryId: args.classEntryId, classLevel, ordinal }),
      kind: args.kind, valueId, sourceKey: args.sourceKey, classEntryId: args.classEntryId,
      classLevel, characterLevel: classLevel == null ? null : args.characterLevel,
    };
  });
  return [...untouched, ...next];
}

export function valuesFromProgressionOccurrences(entries: ProgressionSelectionOccurrence[], kind: ProgressionSelectionKind, classEntryId?: string): string[] {
  return entries.filter((entry) => entry.kind === kind && (!classEntryId || entry.classEntryId === classEntryId)).map((entry) => entry.valueId);
}

export function removeClassProgressionOccurrences(entries: ProgressionSelectionOccurrence[], classEntryId: string, targetClassLevel: number): ProgressionSelectionOccurrence[] {
  return entries.filter((entry) => entry.classEntryId !== classEntryId || entry.classLevel == null || entry.classLevel <= targetClassLevel);
}

export function progressionOwnershipProblem(characterData: Record<string, unknown> | null | undefined): string | null {
  const rawOccurrences = characterData?.progressionSelectionOccurrences;
  const rawEvents = characterData?.progressionReplacementEvents;
  if (rawOccurrences == null && rawEvents == null) return null;
  if (!Array.isArray(rawOccurrences)) return "Progression selection occurrences must be an array.";
  if (rawEvents != null && !Array.isArray(rawEvents)) return "Progression replacement events must be an array.";
  const classLevels = new Map((Array.isArray(characterData?.classes) ? characterData.classes : []).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const entry = raw as { id?: unknown; level?: unknown };
    return typeof entry.id === "string" ? [[entry.id, Number(entry.level) || 0] as const] : [];
  }));
  const ids = new Set<string>();
  for (const raw of rawOccurrences) {
    if (!raw || typeof raw !== "object") return "Progression selection occurrences contain an invalid record.";
    const entry = raw as Partial<ProgressionSelectionOccurrence>;
    if (!clean(entry.occurrenceId) || ids.has(entry.occurrenceId!)) return "Progression selection occurrence IDs must be present and unique.";
    ids.add(entry.occurrenceId!);
    if (!clean(entry.valueId) || !clean(entry.sourceKey)) return "Progression selection occurrences require a value and source.";
    if (entry.classEntryId && !classLevels.has(entry.classEntryId)) return "A progression selection occurrence references an unknown class.";
    if (entry.classEntryId && entry.classLevel != null && (!Number.isInteger(entry.classLevel) || entry.classLevel < 1 || entry.classLevel > (classLevels.get(entry.classEntryId) ?? 0))) return "A progression selection occurrence has an invalid class level.";
  }
  const eventIds = new Set<string>();
  for (const raw of Array.isArray(rawEvents) ? rawEvents : []) {
    if (!raw || typeof raw !== "object") return "Progression replacement events contain an invalid record.";
    const event = raw as Partial<ProgressionReplacementEvent>;
    if (!clean(event.eventId) || eventIds.has(event.eventId!)) return "Progression replacement event IDs must be present and unique.";
    eventIds.add(event.eventId!);
    if (!event.removedOccurrenceId || !event.addedOccurrenceId || !ids.has(event.addedOccurrenceId)) return "A progression replacement event references a missing selection occurrence.";
    if (!event.classEntryId || !classLevels.has(event.classEntryId)) return "A progression replacement event references an unknown class.";
  }
  return null;
}
