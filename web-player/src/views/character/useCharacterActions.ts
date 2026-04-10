import React from "react";
import { api, jsonInit } from "@/services/api";
import { updateMyCharacter } from "@/services/actorApi";
import { C } from "@/lib/theme";
import { uid, normalizeCharacterClasses, normalizeProficiencies, type Character, type SheetOverrides } from "@/views/character/CharacterViewHelpers";
import type { AbilKey, CharacterData, PlayerNote } from "@/views/character/CharacterSheetTypes";

export function useCharacterActions(args: {
  char: Character | null;
  setChar: React.Dispatch<React.SetStateAction<Character | null>>;
  characterData: CharacterData | undefined;
  currentCharacterData: CharacterData;
  playerNotesList: PlayerNote[];
  allSharedNotes: PlayerNote[];
  campaignNotesList: PlayerNote[];
  noteDrawer: { scope: "player" | "shared"; note: PlayerNote | null } | null;
  setNoteDrawer: React.Dispatch<React.SetStateAction<{ scope: "player" | "shared"; note: PlayerNote | null } | null>>;
  setExpandedNoteIds: React.Dispatch<React.SetStateAction<string[]>>;
  overridesDraft: SheetOverrides;
  abilityOverridesDraft: Partial<Record<AbilKey, number>>;
  colorDraft: string;
  setInfoDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setOverridesSaving: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const {
    char,
    setChar,
    characterData,
    currentCharacterData,
    playerNotesList,
    allSharedNotes,
    campaignNotesList,
    noteDrawer,
    setNoteDrawer,
    setExpandedNoteIds,
    overridesDraft,
    abilityOverridesDraft,
    colorDraft,
    setInfoDrawerOpen,
    setOverridesSaving,
  } = args;

  const saveCharacterData = React.useCallback(async (updatedData: CharacterData) => {
    if (!char) return null;
    const mergedData = { ...(characterData ?? {}), ...updatedData };
    const normalizedDataBase = mergedData.proficiencies
      ? { ...mergedData, proficiencies: normalizeProficiencies(mergedData.proficiencies) }
      : mergedData;
    const normalizedClasses = normalizeCharacterClasses(normalizedDataBase);
    const normalizedData = {
      ...normalizedDataBase,
      classes: normalizedClasses,
    };
    const updated = await updateMyCharacter(char.id, {
      name: char.name,
      characterData: normalizedData,
    });
    setChar((prev) =>
      prev ? { ...prev, characterData: { ...(prev.characterData ?? {}), ...normalizedData } } : prev,
    );
    return updated as Character;
  }, [char, characterData, setChar]);

  const savePlayerNotesList = React.useCallback(async (list: PlayerNote[]) => {
    await saveCharacterData({ ...currentCharacterData, playerNotesList: list });
  }, [currentCharacterData, saveCharacterData]);

  const saveCustomResistances = React.useCallback(async (values: string[]) => {
    await saveCharacterData({ ...currentCharacterData, customResistances: values });
  }, [currentCharacterData, saveCharacterData]);

  const saveCustomImmunities = React.useCallback(async (values: string[]) => {
    await saveCharacterData({ ...currentCharacterData, customImmunities: values });
  }, [currentCharacterData, saveCharacterData]);

  const saveCustomTools = React.useCallback(async (values: string[]) => {
    await saveCharacterData({ ...currentCharacterData, customTools: values });
  }, [currentCharacterData, saveCharacterData]);

  const saveCustomLanguages = React.useCallback(async (values: string[]) => {
    await saveCharacterData({ ...currentCharacterData, customLanguages: values });
  }, [currentCharacterData, saveCharacterData]);

  const saveSharedNotesList = React.useCallback((list: PlayerNote[]) => {
    if (!char) return;
    const campaignNoteIds = new Set(campaignNotesList.map((note) => note.id));
    const playerOnlyNotes = list.filter((note) => !campaignNoteIds.has(note.id));
    const val = JSON.stringify(playerOnlyNotes);
    void api(`/api/me/characters/${char.id}/sharedNotes`, jsonInit("PATCH", { sharedNotes: val }));
    setChar((prev) => (prev ? { ...prev, sharedNotes: val } : prev));
  }, [campaignNotesList, char, setChar]);

  const handleNoteSave = React.useCallback((title: string, text: string) => {
    if (!noteDrawer) return;
    const { scope, note } = noteDrawer;
    const list = scope === "player" ? playerNotesList : allSharedNotes;
    const updated = note
      ? list.map((entry) => (entry.id === note.id ? { ...entry, title, text } : entry))
      : [...list, { id: uid(), title, text }];
    if (scope === "player") void savePlayerNotesList(updated);
    else saveSharedNotesList(updated);
    setNoteDrawer(null);
  }, [allSharedNotes, noteDrawer, playerNotesList, savePlayerNotesList, saveSharedNotesList, setNoteDrawer]);

  const handleNoteDelete = React.useCallback((scope: "player" | "shared", id: string) => {
    const list = scope === "player" ? playerNotesList : allSharedNotes;
    const updated = list.filter((entry) => entry.id !== id);
    if (scope === "player") void savePlayerNotesList(updated);
    else saveSharedNotesList(updated);
    setExpandedNoteIds((prev) => prev.filter((entry) => entry !== id));
  }, [allSharedNotes, playerNotesList, savePlayerNotesList, saveSharedNotesList, setExpandedNoteIds]);

  const saveSheetOverrides = React.useCallback(async () => {
    if (!char) return;
    const nextAbilityScores = Object.fromEntries(
      (Object.entries(abilityOverridesDraft) as [AbilKey, number | undefined][])
        .map(([ability, value]) => [ability, Math.floor(Number(value))] as const)
        .filter(([, value]) => Number.isFinite(value) && value >= 1 && value <= 30),
    ) as Partial<Record<AbilKey, number>>;
    const nextOverrides = {
      tempHp: Math.max(0, Math.floor(Number(overridesDraft.tempHp) || 0)),
      acBonus: Math.floor(Number(overridesDraft.acBonus) || 0),
      hpMaxBonus: Math.floor(Number(overridesDraft.hpMaxBonus) || 0),
      ...(Object.keys(nextAbilityScores).length > 0 ? { abilityScores: nextAbilityScores } : {}),
    };
    const nextColor = colorDraft || C.accentHl;
    setOverridesSaving(true);
    try {
      await api(`/api/me/characters/${char.id}/overrides`, jsonInit("PATCH", nextOverrides));
      if ((char.color ?? C.accentHl) !== nextColor) {
        await updateMyCharacter(char.id, {
          name: char.name,
          color: nextColor,
        });
      }
      setChar((prev) =>
        prev
          ? {
              ...prev,
              color: nextColor,
              overrides: { ...(prev.overrides ?? {}), ...nextOverrides },
              characterData: {
                ...(prev.characterData ?? {}),
                sheetOverrides: nextOverrides,
              },
            }
          : prev,
      );
      setInfoDrawerOpen(false);
    } finally {
      setOverridesSaving(false);
    }
  }, [abilityOverridesDraft, char, colorDraft, overridesDraft, setChar, setInfoDrawerOpen, setOverridesSaving]);

  return {
    saveCharacterData,
    savePlayerNotesList,
    saveCustomResistances,
    saveCustomImmunities,
    saveCustomTools,
    saveCustomLanguages,
    saveSharedNotesList,
    handleNoteSave,
    handleNoteDelete,
    saveSheetOverrides,
  };
}
