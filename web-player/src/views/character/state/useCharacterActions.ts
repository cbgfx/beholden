import React from "react";
import { updateMyCharacter } from "@/services/actorApi";
import { C } from "@/lib/theme";
import { uid, normalizeCharacterClasses, normalizeProficiencies, type Character, type SheetOverrides } from "@/views/character/CharacterViewHelpers";
import {
  deleteMySharedNote,
  patchMyCharacter,
  reorderMySharedNotes,
  upsertMySharedNote,
} from "@/views/character/state/characterApi";
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
  // `opts.expectedInventoryRev` opts an inventory edit into optimistic-concurrency:
  // the server rejects it (409) if the stored inventory moved on since it was read.
  const saveCharacterData = React.useCallback(async (
    updatedData: CharacterData,
    opts?: { expectedInventoryRev?: string; expectedSpellStateRev?: string },
  ) => {
    if (!char) return null;
    const characterId = char.id;
    const patch = updatedData.proficiencies
      ? { ...updatedData, proficiencies: normalizeProficiencies(updatedData.proficiencies) }
      : updatedData;
    const normalizedPatch = patch.classes
      ? { ...patch, classes: normalizeCharacterClasses(patch) }
      : patch;
    const updated = await updateMyCharacter(characterId, {
      name: char.name,
      characterData: normalizedPatch,
      ...(opts?.expectedInventoryRev !== undefined ? { expectedInventoryRev: opts.expectedInventoryRev } : {}),
      ...(opts?.expectedSpellStateRev !== undefined ? { expectedSpellStateRev: opts.expectedSpellStateRev } : {}),
    });
    setChar((prev) =>
      prev?.id === characterId
        ? {
            ...prev,
            characterData: { ...(prev.characterData ?? {}), ...normalizedPatch },
            inventoryRev: (Object.hasOwn(normalizedPatch, "inventory") || Object.hasOwn(normalizedPatch, "inventoryContainers"))
              ? updated.inventoryRev ?? prev.inventoryRev
              : prev.inventoryRev,
            spellStateRev: ["usedSpellSlots", "classSpellSelections", "proficiencies", "concentrationSpell"].some((key) => Object.hasOwn(normalizedPatch, key))
              ? updated.spellStateRev ?? prev.spellStateRev
              : prev.spellStateRev,
          }
        : prev,
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

  // Shared notes are written one at a time. Sending the whole list meant a DM editing a note while
  // the player added another quietly threw one of the two away, because each side sent the list as
  // it looked when they started. These say what changed and let the server apply it to what it has.
  //
  // The list is still updated locally first so the panel responds at once, and rolled back if the
  // request fails. Notes originating elsewhere remain in campaignSharedNotes locally; the server
  // resolves their actual owner so editing one never creates a duplicate on this character.
  const applySharedNotesLocally = React.useCallback((
    change: (list: PlayerNote[]) => PlayerNote[],
    send: (characterId: string) => Promise<unknown>,
  ) => {
    if (!char) return;
    const campaignNoteIds = new Set(campaignNotesList.map((note) => note.id));
    const ownNotes = allSharedNotes.filter((note) => !campaignNoteIds.has(note.id));
    const val = JSON.stringify(change(ownNotes));
    const prevSharedNotes = char.sharedNotes;
    setChar((prev) => (prev ? { ...prev, sharedNotes: val } : prev));
    send(char.id).catch(() => {
      setChar((prev) => (prev?.sharedNotes === val ? { ...prev, sharedNotes: prevSharedNotes } : prev));
    });
  }, [allSharedNotes, campaignNotesList, char, setChar]);

  const upsertSharedNote = React.useCallback((note: PlayerNote) => {
    if (char && campaignNotesList.some((entry) => entry.id === note.id)) {
      const previous = char.campaignSharedNotes;
      const next = JSON.stringify(campaignNotesList.map((entry) => entry.id === note.id ? note : entry));
      setChar((current) => current ? { ...current, campaignSharedNotes: next } : current);
      upsertMySharedNote(char.id, note.id, { title: note.title, text: note.text }).catch(() => {
        setChar((current) => current?.campaignSharedNotes === next ? { ...current, campaignSharedNotes: previous } : current);
      });
      return;
    }
    applySharedNotesLocally(
      (list) => (list.some((entry) => entry.id === note.id)
        ? list.map((entry) => (entry.id === note.id ? note : entry))
        : [...list, note]),
      (characterId) => upsertMySharedNote(characterId, note.id, { title: note.title, text: note.text }),
    );
  }, [applySharedNotesLocally, campaignNotesList, char, setChar]);

  const deleteSharedNote = React.useCallback((id: string) => {
    applySharedNotesLocally(
      (list) => list.filter((entry) => entry.id !== id),
      (characterId) => deleteMySharedNote(characterId, id),
    );
  }, [applySharedNotesLocally]);

  const reorderSharedNotes = React.useCallback((list: PlayerNote[]) => {
    const ids = list.map((note) => note.id);
    applySharedNotesLocally(
      (own) => {
        const byId = new Map(own.map((note) => [note.id, note] as const));
        const named = ids.map((id) => byId.get(id)).filter((note): note is PlayerNote => Boolean(note));
        const namedIds = new Set(named.map((note) => note.id));
        return [...named, ...own.filter((note) => !namedIds.has(note.id))];
      },
      (characterId) => reorderMySharedNotes(characterId, ids),
    );
  }, [applySharedNotesLocally]);

  const handleNoteSave = React.useCallback((title: string, text: string) => {
    if (!noteDrawer) return;
    const { scope, note } = noteDrawer;
    if (scope === "shared") {
      upsertSharedNote({ id: note?.id ?? uid(), title, text });
      setNoteDrawer(null);
      return;
    }
    const updated = note
      ? playerNotesList.map((entry) => (entry.id === note.id ? { ...entry, title, text } : entry))
      : [...playerNotesList, { id: uid(), title, text }];
    void savePlayerNotesList(updated);
    setNoteDrawer(null);
  }, [noteDrawer, playerNotesList, savePlayerNotesList, setNoteDrawer, upsertSharedNote]);

  const handleNoteDelete = React.useCallback((scope: "player" | "shared", id: string) => {
    if (scope === "shared") deleteSharedNote(id);
    else void savePlayerNotesList(playerNotesList.filter((entry) => entry.id !== id));
    setExpandedNoteIds((prev) => prev.filter((entry) => entry !== id));
  }, [deleteSharedNote, playerNotesList, savePlayerNotesList, setExpandedNoteIds]);

  const saveSheetOverrides = React.useCallback(async () => {
    if (!char) return;
    // `abilityScores` is a bonus now, not an absolute score -- a debuff is a
    // legitimate negative value, so only finite/non-zero is filtered here;
    // the 1-30 clamp applies to the *resulting* score, not this delta.
    const nextAbilityScores = Object.fromEntries(
      (Object.entries(abilityOverridesDraft) as [AbilKey, number | undefined][])
        .map(([ability, value]) => [ability, Math.floor(Number(value))] as const)
        .filter(([, value]) => Number.isFinite(value) && value !== 0),
    ) as Partial<Record<AbilKey, number>>;
    const nextOverrides = {
      tempHp: Math.max(0, Math.floor(Number(overridesDraft.tempHp) || 0)),
      acBonus: Math.floor(Number(overridesDraft.acBonus) || 0),
      hpMaxBonus: Math.floor(Number(overridesDraft.hpMaxBonus) || 0),
      // Always sent, even empty -- this is a merge-patch endpoint, so omitting
      // the key when the last bonus was just cleared would leave the server's
      // stale prior value in place instead of clearing it (this was exactly
      // the "setting a buff to 0 doesn't save" bug).
      abilityScores: nextAbilityScores,
      permanent: overridesDraft.permanent ?? {},
    };
    setOverridesSaving(true);
    try {
      await patchMyCharacter(char.id, "overrides", nextOverrides);
      setChar((prev) =>
        prev
          ? {
              ...prev,
              overrides: { ...(prev.overrides ?? {}), ...nextOverrides },
            }
          : prev,
      );
      setInfoDrawerOpen(false);
    } finally {
      setOverridesSaving(false);
    }
  }, [abilityOverridesDraft, char, overridesDraft, setChar, setInfoDrawerOpen, setOverridesSaving]);

  const saveThemeColor = React.useCallback(async (color?: string) => {
    if (!char) return;
    const nextColor = color || colorDraft || C.accentHl;
    if ((char.color ?? C.accentHl) === nextColor) return;
    await updateMyCharacter(char.id, {
      name: char.name,
      color: nextColor,
    });
    setChar((prev) => (prev ? { ...prev, color: nextColor } : prev));
  }, [char, colorDraft, setChar]);

  return {
    saveCharacterData,
    saveThemeColor,
    savePlayerNotesList,
    saveCustomResistances,
    saveCustomImmunities,
    saveCustomTools,
    saveCustomLanguages,
    upsertSharedNote,
    deleteSharedNote,
    reorderSharedNotes,
    handleNoteSave,
    handleNoteDelete,
    saveSheetOverrides,
  };
}
