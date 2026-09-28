/** Permanent score change only; item/temporary modifiers belong to sheet derivation. */
export function levelUpConstitutionHp(args: {
  constitution: number;
  nextLevel: number;
  mode: "asi" | "feat" | null;
  asi: Record<string, number>;
  feat: Record<string, number>;
}): { constitutionAfter: number; adjustment: number } {
  const bonus = args.mode === "asi" ? args.asi.con ?? 0 : args.mode === "feat" ? args.feat.con ?? 0 : 0;
  const constitutionAfter = Math.max(args.constitution, Math.min(20, args.constitution + bonus));
  const modifierChange = Math.floor((constitutionAfter - 10) / 2) - Math.floor((args.constitution - 10) / 2);
  return { constitutionAfter, adjustment: modifierChange * args.nextLevel };
}

/** Keep authored HP; only untouched automatic creation values follow the calculator. */
export function reconcileCreatorHp(current: string, computed: string, previousComputed: string | null, editing: boolean): string {
  if (editing) return current;
  return previousComputed === null || current === previousComputed ? computed : current;
}

export interface HpProgressionEntry {
  characterLevelBefore: number;
  characterLevelAfter: number;
  classEntryId: string;
  classLevelAfter: number;
  baseHpMaxBefore: number;
  baseHpMaxAfter: number;
  levelHpGain: number;
  hpMethod: "average" | "roll" | "manual" | null;
  hitDieResult: number | null;
  constitutionBefore: number;
  constitutionAfter: number;
  constitutionHpAdjustment: number;
}

/** Records exact level-one/average creation gains. A manually overridden total stays one honest
 * aggregate baseline because distributing it across earlier levels would invent history. */
export function buildInitialHpProgressionHistory(args: {
  level: number;
  hitDie: number;
  constitution: number;
  hpMax: number;
  classEntryId: string;
  hpMethod?: "average" | "physical" | "manual";
  physicalRolls?: Record<string, string | number>;
}): HpProgressionEntry[] {
  const level = Math.max(1, Math.trunc(args.level));
  const conMod = Math.floor((args.constitution - 10) / 2);
  const physicalResults = Array.from({ length: Math.max(0, level - 1) }, (_, index) => Number(args.physicalRolls?.[String(index + 2)]));
  const physicalIsComplete = args.hpMethod === "physical" && physicalResults.every((roll) => Number.isInteger(roll) && roll >= 1 && roll <= args.hitDie);
  const gains = Array.from({ length: level }, (_, index) => Math.max(1, index === 0
    ? args.hitDie + conMod
    : physicalIsComplete ? physicalResults[index - 1]! + conMod : Math.floor(args.hitDie / 2) + 1 + conMod));
  const automaticTotal = gains.reduce((sum, gain) => sum + gain, 0);
  if (args.hpMethod === "manual" || automaticTotal !== args.hpMax) return [{
    characterLevelBefore: 0, characterLevelAfter: level,
    classEntryId: args.classEntryId, classLevelAfter: level,
    baseHpMaxBefore: 0, baseHpMaxAfter: args.hpMax, levelHpGain: args.hpMax,
    hpMethod: "manual", hitDieResult: null,
    constitutionBefore: args.constitution, constitutionAfter: args.constitution, constitutionHpAdjustment: 0,
  }];
  let hpBefore = 0;
  return gains.map((gain, index) => {
    const entry: HpProgressionEntry = {
      characterLevelBefore: index, characterLevelAfter: index + 1,
      classEntryId: args.classEntryId, classLevelAfter: index + 1,
      baseHpMaxBefore: hpBefore, baseHpMaxAfter: hpBefore + gain, levelHpGain: gain,
      hpMethod: index === 0 || !physicalIsComplete ? "average" : "roll",
      hitDieResult: index === 0 || !physicalIsComplete ? null : physicalResults[index - 1]!,
      constitutionBefore: args.constitution, constitutionAfter: args.constitution, constitutionHpAdjustment: 0,
    };
    hpBefore += gain;
    return entry;
  });
}

export function hpProgressionHistoryProblem(
  characterData: Record<string, unknown> | null | undefined,
  expectedLevel: number,
  expectedHpMax: number,
): string | null {
  const raw = characterData?.hpProgressionHistory;
  if (raw == null) return null;
  if (!Array.isArray(raw)) return "HP progression history must be an array.";
  const classIds = new Set((Array.isArray(characterData?.classes) ? characterData.classes : [])
    .flatMap((entry) => entry && typeof entry === "object" && typeof (entry as { id?: unknown }).id === "string" ? [(entry as { id: string }).id] : []));
  let previous: HpProgressionEntry | null = null;
  for (const value of raw) {
    if (value && typeof value === "object" && (value as { legacyBaseline?: unknown }).legacyBaseline === true) continue;
    if (!value || typeof value !== "object") return "HP progression history contains an invalid entry.";
    const entry = value as Partial<HpProgressionEntry>;
    const integers = [entry.characterLevelBefore, entry.characterLevelAfter, entry.classLevelAfter, entry.baseHpMaxBefore, entry.baseHpMaxAfter, entry.levelHpGain, entry.constitutionBefore, entry.constitutionAfter, entry.constitutionHpAdjustment];
    if (integers.some((field) => !Number.isInteger(field))) return "HP progression history contains a non-integer value.";
    if (!entry.classEntryId || (classIds.size > 0 && !classIds.has(entry.classEntryId))) return "HP progression history references an unknown class entry.";
    if ((entry.characterLevelAfter ?? 0) <= (entry.characterLevelBefore ?? -1)) return "HP progression history levels must advance.";
    if ((entry.baseHpMaxAfter ?? 0) !== (entry.baseHpMaxBefore ?? 0) + (entry.levelHpGain ?? 0) + (entry.constitutionHpAdjustment ?? 0)) return "HP progression history does not reconcile its HP change.";
    if (entry.hpMethod === "roll" && (!Number.isInteger(entry.hitDieResult) || (entry.hitDieResult ?? 0) < 1)) return "Rolled HP history requires a positive raw die result.";
    if (entry.hitDieResult != null && (!Number.isInteger(entry.hitDieResult) || entry.hitDieResult < 1)) return "HP history contains an invalid raw die result.";
    if (previous && ((entry.characterLevelBefore !== previous.characterLevelAfter) || (entry.baseHpMaxBefore !== previous.baseHpMaxAfter))) return "HP progression history is not contiguous.";
    previous = entry as HpProgressionEntry;
  }
  if (previous && (previous.characterLevelAfter !== expectedLevel || previous.baseHpMaxAfter !== expectedHpMax)) return "HP progression history does not match the resulting level and HP Max.";
  return null;
}

export function reverseHpProgressionToLevel(raw: unknown, targetLevel: number): { history: HpProgressionEntry[]; hpMax: number } | null {
  if (!Array.isArray(raw) || !Number.isInteger(targetLevel) || targetLevel < 1) return null;
  const entries = raw.filter((value): value is HpProgressionEntry => Boolean(value && typeof value === "object" && Number.isInteger((value as Partial<HpProgressionEntry>).characterLevelAfter)));
  if (entries.length === 0) return null;
  const retained = entries.filter((entry) => entry.characterLevelAfter <= targetLevel);
  const last = retained.at(-1);
  if (!last || last.characterLevelAfter !== targetLevel) return null;
  if (entries.some((entry) => entry.characterLevelBefore < targetLevel && entry.characterLevelAfter > targetLevel)) return null;
  return { history: retained, hpMax: last.baseHpMaxAfter };
}

/** Removes one exact class-level event and replays every later HP entry. This supports reducing a
 * secondary class even when another class was advanced afterward. Aggregate legacy baselines are
 * intentionally not split because that would invent a per-level roll. */
export function removeHpProgressionClassLevel(raw: unknown, classEntryId: string, classLevel: number, constitutionDecrease = 0): { history: HpProgressionEntry[]; hpMax: number } | null {
  if (!Array.isArray(raw) || !classEntryId || !Number.isInteger(classLevel) || classLevel < 1) return null;
  const entries = raw.filter((value): value is HpProgressionEntry => Boolean(value && typeof value === "object" && Number.isInteger((value as Partial<HpProgressionEntry>).characterLevelAfter)));
  const removeIndex = entries.findIndex((entry) => entry.classEntryId === classEntryId && entry.classLevelAfter === classLevel && entry.characterLevelAfter === entry.characterLevelBefore + 1);
  if (removeIndex < 0) return null;
  const retained = entries.filter((_, index) => index !== removeIndex);
  let previousAfter = 0;
  return {
    history: retained.map((entry, index) => {
      const wasAfterRemoved = index >= removeIndex;
      const constitutionBefore = entry.constitutionBefore - (wasAfterRemoved ? constitutionDecrease : 0);
      const constitutionAfter = entry.constitutionAfter - (wasAfterRemoved ? constitutionDecrease : 0);
      const modifierDelta = Math.floor((constitutionAfter - 10) / 2) - Math.floor((constitutionBefore - 10) / 2);
      const characterLevelBefore = entry.characterLevelBefore - (wasAfterRemoved ? 1 : 0);
      const characterLevelAfter = entry.characterLevelAfter - (wasAfterRemoved ? 1 : 0);
      const constitutionHpAdjustment = modifierDelta * characterLevelAfter;
      const replayed = {
        ...entry, characterLevelBefore, characterLevelAfter, constitutionBefore, constitutionAfter,
        baseHpMaxBefore: previousAfter, constitutionHpAdjustment,
        baseHpMaxAfter: previousAfter + entry.levelHpGain + constitutionHpAdjustment,
      };
      previousAfter = replayed.baseHpMaxAfter;
      return replayed;
    }),
    hpMax: previousAfter,
  };
}
