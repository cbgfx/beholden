import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import { C } from "@/lib/theme";
import type { AbilKey, CharacterData, PlayerNote } from "@/views/character/CharacterSheetTypes";
import type { Character, SheetOverrides } from "@/views/character/CharacterViewHelpers";

export function useCharacterViewUiState() {
  const [hpAmount, setHpAmount] = useState("");
  const [hpSaving, setHpSaving] = useState(false);
  const [hpError, setHpError] = useState<string | null>(null);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const flashRef = useRef<number | null>(null);
  const hpInputRef = useRef<HTMLInputElement>(null);
  const [condPickerOpen, setCondPickerOpen] = useState(false);
  const [condSaving, setCondSaving] = useState(false);
  const [xpPopupOpen, setXpPopupOpen] = useState(false);
  const [xpInput, setXpInput] = useState("");
  const [dsSaving, setDsSaving] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<string[]>([]);
  const [expandedClassFeatureIds, setExpandedClassFeatureIds] = useState<string[]>([]);
  const [noteDrawer, setNoteDrawer] = useState<{ scope: "player" | "shared"; note: PlayerNote | null } | null>(null);
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
  const [permanentBuffsDrawerOpen, setPermanentBuffsDrawerOpen] = useState(false);
  const [engagedEnemiesDrawerOpen, setEngagedEnemiesDrawerOpen] = useState(false);
  const [overridesDraft, setOverridesDraft] = useState<SheetOverrides>({ tempHp: 0, acBonus: 0, hpMaxBonus: 0 });
  const [abilityOverridesDraft, setAbilityOverridesDraft] = useState<Partial<Record<AbilKey, number>>>({});
  const [colorDraft, setColorDraft] = useState(C.accentHl);
  const [overridesSaving, setOverridesSaving] = useState(false);
  const [concentrationAlert, setConcentrationAlert] = useState<{ dc: number } | null>(null);
  const [featPickerOpen, setFeatPickerOpen] = useState(false);
  const [polymorphDrawerOpen, setPolymorphDrawerOpen] = useState(false);
  const [polymorphApplyingId, setPolymorphApplyingId] = useState<string | null>(null);
  const [portraitUploading, setPortraitUploading] = useState(false);
  const portraitFileRef = useRef<HTMLInputElement>(null);
  // Any sheet-view id: the 4 built-in ones, or a player-created custom view.
  // Validity (does this id still exist in characterData.sheetViews?) is
  // resolved at render time in CharacterViewLayout.tsx, with a safe fallback
  // -- an unknown/stale id here just falls back to a default, never crashes.
  const [sheetView, setSheetView] = useState<string>(() => {
    try {
      return localStorage.getItem("character-sheet:view") || "play";
    } catch { /* ignore unavailable storage */ }
    return "play";
  });
  const [layoutEditMode, setLayoutEditMode] = useState(false);

  return {
    hpAmount, setHpAmount, hpSaving, setHpSaving, hpError, setHpError, lastRoll, setLastRoll,
    flashRef, hpInputRef, condPickerOpen, setCondPickerOpen, condSaving, setCondSaving,
    xpPopupOpen, setXpPopupOpen, xpInput, setXpInput, dsSaving, setDsSaving,
    expandedNoteIds, setExpandedNoteIds, expandedClassFeatureIds, setExpandedClassFeatureIds,
    noteDrawer, setNoteDrawer, infoDrawerOpen, setInfoDrawerOpen,
    permanentBuffsDrawerOpen, setPermanentBuffsDrawerOpen,
    engagedEnemiesDrawerOpen, setEngagedEnemiesDrawerOpen,
    overridesDraft, setOverridesDraft, abilityOverridesDraft, setAbilityOverridesDraft,
    colorDraft, setColorDraft, overridesSaving, setOverridesSaving,
    concentrationAlert, setConcentrationAlert, featPickerOpen, setFeatPickerOpen,
    polymorphDrawerOpen, setPolymorphDrawerOpen, polymorphApplyingId, setPolymorphApplyingId,
    portraitUploading, setPortraitUploading, portraitFileRef, sheetView, setSheetView,
    layoutEditMode, setLayoutEditMode,
  };
}

export type CharacterViewUiState = ReturnType<typeof useCharacterViewUiState>;

export function useCharacterViewUiSync({
  id,
  char,
  characterData,
  setChar,
  ui,
}: {
  id: string | undefined;
  char: Character | null;
  characterData: CharacterData | null | undefined;
  setChar: React.Dispatch<React.SetStateAction<Character | null>>;
  ui: CharacterViewUiState;
}) {
  const {
    setOverridesDraft,
    setAbilityOverridesDraft,
    setColorDraft,
    setPortraitUploading,
  } = ui;

  useEffect(() => {
    const source = char?.overrides ?? characterData?.sheetOverrides ?? { tempHp: 0, acBonus: 0, hpMaxBonus: 0 };
    setOverridesDraft({
      tempHp: Math.max(0, Math.floor(Number(source.tempHp ?? 0) || 0)),
      acBonus: Math.floor(Number(source.acBonus ?? 0) || 0),
      hpMaxBonus: Math.floor(Number(source.hpMaxBonus ?? 0) || 0),
      permanent: source.permanent && typeof source.permanent === "object" ? { ...source.permanent } : {},
    });
    setAbilityOverridesDraft((source.abilityScores && typeof source.abilityScores === "object")
      ? Object.fromEntries(
          Object.entries(source.abilityScores).filter(([, value]) => Number.isFinite(Number(value)))
        ) as Partial<Record<AbilKey, number>>
      : {});
  }, [char?.overrides, characterData?.sheetOverrides, setAbilityOverridesDraft, setOverridesDraft]);

  useEffect(() => {
    setColorDraft(char?.color ?? C.accentHl);
  }, [char?.color, setColorDraft]);

  return useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !id) return;
    setPortraitUploading(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const result = await api<{ ok: boolean; imageUrl: string }>(`/api/me/characters/${id}/image`, { method: "POST", body });
      const sep = result.imageUrl.includes("?") ? "&" : "?";
      const bustedUrl = `${result.imageUrl}${sep}v=${Date.now()}`;
      setChar((previous) => previous ? { ...previous, imageUrl: bustedUrl } : previous);
    } catch (error) {
      console.error(error);
    } finally {
      setPortraitUploading(false);
    }
  }, [id, setChar, setPortraitUploading]);
}
