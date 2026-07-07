import React from "react";
import { updateMyCharacter } from "@/services/actorApi";
import { C } from "@/lib/theme";
import { uid, normalizeCharacterClasses, normalizeProficiencies, type Character, type SheetOverrides } from "@/views/character/CharacterViewHelpers";
import { patchMyCharacter } from "@/views/character/characterApi";
import type { AbilKey, CharacterData, PlayerNote } from "@/views/character/CharacterSheetTypes";

export function useCharacterActions(args: {
  char: Character | null;
  setChar: React.Dispatch<React.SetStateAction<Character | null>>;
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

  // Sends only the fields present in `updatedData` — never a full-document snapshot.
  // The server merges this patch onto its own freshly-read row (see PUT /api/me/characters/:id),
  // so a stale client-side closure can never clobber fields this call didn't intend to touch.
  const saveCharacterData = React.useCallback(async (updatedData: CharacterData) => {
    if (!char) return null;
    const patch = updatedData.proficiencies
      ? { ...updatedData, proficiencies: normalizeProficiencies(updatedData.proficiencies) }
      : updatedData;
    const normalizedPatch = patch.classes
      ? { ...patch, classes: normalizeCharacterClasses(patch) }
      : patch;
    const updated = await updateMyCharacter(char.id, {
      name: char.name,
      characterData: normalizedPatch,
    });
    setChar((prev) =>
      prev ? { ...prev, characterData: { ...(prev.characterData ?? {}), ...normalizedPatch } } : prev,
    );
    return updated as Character;
  }, [char, setChar]);

  const savePlayerNotesList = React.useCallback(async (list: PlayerNote[]) => {
    await saveCharacterData({ playerNotesList: list });
  }, [saveCharacterData]);

  const saveCustomResistances = React.useCallback(async (values: string[]) => {
    await saveCharacterData({ customResistances: values });
  }, [saveCharacterData]);

  const saveCustomImmunities = React.useCallback(async (values: string[]) => {
    await saveCharacterData({ customImmunities: values });
  }, [saveCharacterData]);

  const saveCustomTools = React.useCallback(async (values: string[]) => {
    await saveCharacterData({ customTools: values });
  }, [saveCharacterData]);

  const saveCustomLanguages = React.useCallback(async (values: string[]) => {
    await saveCharacterData({ customLanguages: values });
  }, [saveCharacterData]);

  const saveSharedNotesList = React.useCallback((list: PlayerNote[]) => {
    if (!char) return;
    const campaignNoteIds = new Set(campaignNotesList.map((note) => note.id));
    const playerOnlyNotes = list.filter((note) => !campaignNoteIds.has(note.id));
    const val = JSON.stringify(playerOnlyNotes);
    const prevSharedNotes = char.sharedNotes;
    setChar((prev) => (prev ? { ...prev, sharedNotes: val } : prev));
    patchMyCharacter(char.id, "sharedNotes", { sharedNotes: val }).catch(() => {
      setChar((prev) => (prev?.sharedNotes === val ? { ...prev, sharedNotes: prevSharedNotes } : prev));
    });
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
      await patchMyCharacter(char.id, "overrides", nextOverrides);
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
