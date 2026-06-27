import { useMemo } from "react";
import type { CharacterData, PlayerNote } from "@/views/character/CharacterSheetTypes";
import type { Character } from "@/views/character/CharacterViewHelpers";
import { useCharacterActions } from "@/views/character/useCharacterActions";
import type { CharacterViewUiState } from "@/views/character/useCharacterViewUiState";

function parseNotes(value: string | null | undefined): PlayerNote[] {
  if (!value) return [];
  try {
    return JSON.parse(value) as PlayerNote[];
  } catch {
    return [];
  }
}

export function useCharacterViewNotes({
  char,
  setChar,
  characterData,
  currentCharacterData,
  ui,
}: {
  char: Character | null;
  setChar: React.Dispatch<React.SetStateAction<Character | null>>;
  characterData: CharacterData | null | undefined;
  currentCharacterData: CharacterData;
  ui: CharacterViewUiState;
}) {
  const playerNotesList = currentCharacterData.playerNotesList ?? [];
  const sharedNotesList = useMemo(() => parseNotes(char?.sharedNotes), [char?.sharedNotes]);
  const campaignNotesList = useMemo(() => parseNotes(char?.campaignSharedNotes), [char?.campaignSharedNotes]);
  const allSharedNotes = useMemo(() => {
    const playerNoteIds = new Set(sharedNotesList.map((note) => note.id));
    return [...campaignNotesList.filter((note) => !playerNoteIds.has(note.id)), ...sharedNotesList];
  }, [sharedNotesList, campaignNotesList]);

  const actions = useCharacterActions({
    char,
    setChar,
    characterData: characterData ?? undefined,
    currentCharacterData,
    playerNotesList,
    allSharedNotes,
    campaignNotesList,
    noteDrawer: ui.noteDrawer,
    setNoteDrawer: ui.setNoteDrawer,
    setExpandedNoteIds: ui.setExpandedNoteIds,
    overridesDraft: ui.overridesDraft,
    abilityOverridesDraft: ui.abilityOverridesDraft,
    colorDraft: ui.colorDraft,
    setInfoDrawerOpen: ui.setInfoDrawerOpen,
    setOverridesSaving: ui.setOverridesSaving,
  });

  const toggleNoteExpanded = (id: string) => {
    ui.setExpandedNoteIds((previous) =>
      previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id]
    );
  };
  const toggleClassFeatureExpanded = (id: string) => {
    ui.setExpandedClassFeatureIds((previous) =>
      previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id]
    );
  };

  return {
    playerNotesList,
    allSharedNotes,
    campaignNotesList,
    toggleNoteExpanded,
    toggleClassFeatureExpanded,
    ...actions,
  };
}
