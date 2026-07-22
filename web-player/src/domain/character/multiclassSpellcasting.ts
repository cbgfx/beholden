export type SpellcastingProgression = "full" | "half" | "third" | "pact";

export type MulticlassSpellcastingClass = {
  entry: { id: string; level: number; subclass?: string | null };
  detail: {
    id: string;
    name: string;
    slotsReset?: string | null;
    autolevels: Array<{ level: number; slots: number[] | null }>;
    multiclass?: { spellcasting?: { progression: SpellcastingProgression; rounding?: "down" | "up" } | null } | null;
    subclassDetails?: Record<string, { name: string; spellcasting?: { contribution?: "third"; progression?: Array<{ level: number; slots?: number[] }> } | null } | string>;
  };
};

export type PactSlotPool = {
  key: string;
  classEntryId: string;
  className: string;
  slots: number[];
};

export type MulticlassSpellSlotState = {
  casterLevel: number;
  sharedSlots: number[] | null;
  pactPools: PactSlotPool[];
};

// Index is combined caster level; each row is indexed by spell level with index 0 unused.
const SHARED_SLOTS: number[][] = [
  [],
  [0, 2], [0, 3], [0, 4, 2], [0, 4, 3], [0, 4, 3, 2],
  [0, 4, 3, 3], [0, 4, 3, 3, 1], [0, 4, 3, 3, 2], [0, 4, 3, 3, 3, 1],
  [0, 4, 3, 3, 3, 2], [0, 4, 3, 3, 3, 2, 1], [0, 4, 3, 3, 3, 2, 1],
  [0, 4, 3, 3, 3, 2, 1, 1], [0, 4, 3, 3, 3, 2, 1, 1],
  [0, 4, 3, 3, 3, 2, 1, 1, 1], [0, 4, 3, 3, 3, 2, 1, 1, 1],
  [0, 4, 3, 3, 3, 2, 1, 1, 1, 1], [0, 4, 3, 3, 3, 3, 1, 1, 1, 1],
  [0, 4, 3, 3, 3, 3, 2, 1, 1, 1], [0, 4, 3, 3, 3, 3, 2, 2, 1, 1],
];

function progressionFor(selection: MulticlassSpellcastingClass): { progression: SpellcastingProgression; rounding?: "down" | "up" } | null {
  const direct = selection.detail.multiclass?.spellcasting;
  if (direct) return direct;
  const selectedSubclass = String(selection.entry.subclass ?? "").trim();
  const subclass = selectedSubclass
    ? selection.detail.subclassDetails?.[selectedSubclass]
      ?? Object.values(selection.detail.subclassDetails ?? {}).find((value) => typeof value !== "string" && value.name === selectedSubclass)
    : null;
  if (subclass && typeof subclass !== "string" && subclass.spellcasting?.contribution === "third") {
    return { progression: "third" };
  }
  if (selection.detail.slotsReset === "S") return { progression: "pact" };
  return null;
}

function casterLevelContribution(level: number, rule: { progression: SpellcastingProgression; rounding?: "down" | "up" }): number {
  if (rule.progression === "full") return level;
  if (rule.progression === "half") return rule.rounding === "up" ? Math.ceil(level / 2) : Math.floor(level / 2);
  if (rule.progression === "third") return Math.floor(level / 3);
  return 0;
}

function ownSlotProgression(selection: MulticlassSpellcastingClass): number[] | null {
  const direct = selection.detail.autolevels.find((row) => row.level === selection.entry.level)?.slots;
  if (direct) return direct;
  const selectedSubclass = String(selection.entry.subclass ?? "").trim();
  const subclass = selectedSubclass
    ? selection.detail.subclassDetails?.[selectedSubclass]
      ?? Object.values(selection.detail.subclassDetails ?? {}).find((value) => typeof value !== "string" && value.name === selectedSubclass)
    : null;
  if (!subclass || typeof subclass === "string") return null;
  const rows = subclass.spellcasting?.progression ?? [];
  return [...rows].reverse().find((row) => row.level <= selection.entry.level)?.slots ?? null;
}

export function deriveMulticlassSpellSlots(selections: MulticlassSpellcastingClass[]): MulticlassSpellSlotState {
  let casterLevel = 0;
  const pactPools: PactSlotPool[] = [];
  const sharedCasters: Array<{ selection: MulticlassSpellcastingClass; rule: { progression: SpellcastingProgression; rounding?: "down" | "up" } }> = [];
  for (const selection of selections) {
    const rule = progressionFor(selection);
    if (!rule) continue;
    if (rule.progression === "pact") {
      const slots = ownSlotProgression(selection);
      if (slots?.some((count, level) => level > 0 && count > 0)) {
        pactPools.push({
          key: `pact:${selection.entry.id}`,
          classEntryId: selection.entry.id,
          className: selection.detail.name,
          slots: [...slots],
        });
      }
      continue;
    }
    sharedCasters.push({ selection, rule });
    casterLevel += casterLevelContribution(selection.entry.level, rule);
  }
  if (sharedCasters.length === 1) {
    const only = sharedCasters[0]!.selection;
    const ownSlots = ownSlotProgression(only);
    return { casterLevel: only.entry.level, sharedSlots: ownSlots ? [...ownSlots] : null, pactPools };
  }
  casterLevel = Math.max(0, Math.min(20, casterLevel));
  return {
    casterLevel,
    sharedSlots: casterLevel > 0 ? [...SHARED_SLOTS[casterLevel]!] : null,
    pactPools,
  };
}
