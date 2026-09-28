import { progressionOccurrenceId, type ProgressionSelectionKind, type ProgressionSelectionOccurrence } from "./progressionOwnership";

type RepairIssue = { code?: string; message?: string };

/** Establishes the current sheet as an explicit beta baseline. Ambiguous historical ownership is
 * discarded, while current totals and visible choices are preserved without assigning them to a
 * class or invented acquisition level. Future transitions can then record exact ownership. */
export function resetAmbiguousProgressionBaseline(args: {
  characterData: Record<string, any>;
  level: number;
  hpMax: number;
  constitution: number;
}): Record<string, unknown> {
  const data = args.characterData;
  const issues = (Array.isArray(data.progressionRepairIssues) ? data.progressionRepairIssues : []) as RepairIssue[];
  const codes = new Set(issues.map((issue) => String(issue.code ?? "")));
  const classes = Array.isArray(data.classes) ? data.classes : [];
  const classIds = new Set(classes.flatMap((entry: any) => typeof entry?.id === "string" ? [entry.id] : []));
  const chosenLevelUpFeats = (Array.isArray(data.chosenLevelUpFeats) ? data.chosenLevelUpFeats : [])
    .filter((entry: any) => typeof entry?.classEntryId === "string" && classIds.has(entry.classEntryId));

  const existing = (Array.isArray(data.progressionSelectionOccurrences) ? data.progressionSelectionOccurrences : []) as ProgressionSelectionOccurrence[];
  const owned = existing.filter((entry) => !entry.classEntryId || classIds.has(entry.classEntryId));
  const remainingOwnedCounts = new Map<string, number>();
  for (const entry of owned) {
    const key = `${entry.kind}:${entry.valueId}`;
    remainingOwnedCounts.set(key, (remainingOwnedCounts.get(key) ?? 0) + 1);
  }
  const visible: Array<{ kind: ProgressionSelectionKind; valueId: string }> = [
    ...(Array.isArray(data.chosenInvocations) ? data.chosenInvocations : []).map((valueId: unknown) => ({ kind: "invocation" as const, valueId: String(valueId) })),
    ...(Array.isArray(data.chosenOptionals) ? data.chosenOptionals : []).map((valueId: unknown) => ({ kind: "optional" as const, valueId: String(valueId) })),
    ...(Array.isArray(data.extraFeatIds) ? data.extraFeatIds : []).map((valueId: unknown) => ({ kind: "extra-feat" as const, valueId: String(valueId) })),
  ];
  const baselineOccurrences = [...owned];
  visible.forEach((entry, ordinal) => {
    const key = `${entry.kind}:${entry.valueId}`;
    const retainedCount = remainingOwnedCounts.get(key) ?? 0;
    if (retainedCount > 0) { remainingOwnedCounts.set(key, retainedCount - 1); return; }
    baselineOccurrences.push({
      occurrenceId: progressionOccurrenceId({ ...entry, sourceKey: "baseline:beta-repair", classLevel: null, ordinal }),
      ...entry, sourceKey: "baseline:beta-repair", classEntryId: null, classLevel: null, characterLevel: null,
    });
  });

  const hpProgressionHistory = codes.has("ambiguous-hp-ownership")
    ? [{
        legacyBaseline: true,
        characterLevelBefore: 0, characterLevelAfter: args.level,
        classEntryId: "baseline:beta-repair", classLevelAfter: 0,
        baseHpMaxBefore: 0, baseHpMaxAfter: args.hpMax, levelHpGain: args.hpMax,
        hpMethod: "manual", hitDieResult: null,
        constitutionBefore: args.constitution, constitutionAfter: args.constitution,
        constitutionHpAdjustment: 0,
      }]
    : data.hpProgressionHistory;

  return {
    ...data,
    chosenLevelUpFeats,
    progressionSelectionOccurrences: baselineOccurrences,
    progressionReplacementEvents: [],
    ...(Array.isArray(hpProgressionHistory) ? { hpProgressionHistory } : {}),
    progressionRepairIssues: [],
    progressionRepairBaseline: { level: args.level, hpMax: args.hpMax, resetReason: "ambiguous-beta-progression" },
  };
}
