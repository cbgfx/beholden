import React from "react";
import { useWs } from "@/services/ws";
import { putMyCharacter } from "@/views/character/characterApi";
import type { Character } from "@/views/character/CharacterViewHelpers";
import { useDebouncedSingleflight } from "@beholden/shared/ui";

export function useCharacterSyncEffects(args: {
  char: Character | null;
  setChar: React.Dispatch<React.SetStateAction<Character | null>>;
  fetchChar: () => Promise<void>;
  syncedAcValue: number | null;
  syncedHpMaxValue: number | null;
  syncedSpeedValue?: number | null;
}) {
  const { char, setChar, fetchChar, syncedAcValue, syncedHpMaxValue, syncedSpeedValue } = args;
  const lastSyncedStatsRef = React.useRef<{
    charId: string;
    ac: number | null;
    hpMax: number;
    speed: number | null;
  } | null>(null);
  const enqueueFetchChar = useDebouncedSingleflight(fetchChar);

  React.useEffect(() => {
    if (char?.id && char.name) {
      try {
        localStorage.setItem("beholden:lastCharacter", JSON.stringify({ id: char.id, name: char.name }));
        window.dispatchEvent(new CustomEvent("beholden:lastCharacter"));
      } catch {}
    }
  }, [char?.id, char?.name]);

  useWs(React.useCallback((msg) => {
    if (msg.type === "players:delta") {
      const payload = (msg.payload ?? {}) as { campaignId?: string; characterId?: string | null };
      const campaignId = payload.campaignId;
      if (!campaignId) return;
      setChar((prev) => {
        if (!prev?.campaigns.some((campaign) => campaign.campaignId === campaignId)) return prev;
        if (typeof payload.characterId === "string" && payload.characterId && payload.characterId !== prev.id) return prev;
        enqueueFetchChar(80);
        return prev;
      });
      return;
    }
  }, [enqueueFetchChar, setChar]));

  React.useEffect(() => {
    if (!char || syncedHpMaxValue == null) return;
    const speed = syncedSpeedValue ?? null;
    const prev = lastSyncedStatsRef.current;
    if (
      prev?.charId === char.id
      && prev.ac === syncedAcValue
      && prev.hpMax === syncedHpMaxValue
      && prev.speed === speed
    ) return;
    lastSyncedStatsRef.current = {
      charId: char.id,
      ac: syncedAcValue,
      hpMax: syncedHpMaxValue,
      speed,
    };
    void putMyCharacter(char.id, {
      syncedHpMax: syncedHpMaxValue,
      ...(syncedAcValue != null ? { syncedAc: syncedAcValue } : {}),
      ...(speed != null ? { syncedSpeed: speed } : {}),
    });
  }, [char, syncedAcValue, syncedHpMaxValue, syncedSpeedValue]);

}
