export type ClassSpellSelection = {
  chosenCantrips?: string[];
  chosenSpells?: string[];
  chosenInvocations?: string[];
};

type SpellSelectionData = {
  classSpellSelections?: Record<string, ClassSpellSelection>;
};

export function readClassSpellSelection(data: SpellSelectionData | null | undefined, entryId: string): Required<ClassSpellSelection> {
  const scoped = data?.classSpellSelections?.[entryId];
  return {
    chosenCantrips: scoped?.chosenCantrips ?? [],
    chosenSpells: scoped?.chosenSpells ?? [],
    chosenInvocations: scoped?.chosenInvocations ?? [],
  };
}
