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
}) {
  const { char, setChar, fetchChar, syncedAcValue } = args;
  const lastSyncedAcRef = React.useRef<{ charId: string; ac: number } | null>(null);
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
    if (!char || syncedAcValue == null) return;
    const prev = lastSyncedAcRef.current;
    if (prev?.charId === char.id && prev?.ac === syncedAcValue) return;
    lastSyncedAcRef.current = { charId: char.id, ac: syncedAcValue };
    if (syncedAcValue !== char.syncedAc) {
      void putMyCharacter(char.id, { syncedAc: syncedAcValue });
    }
  }, [syncedAcValue, char?.id, char?.syncedAc]); // eslint-disable-line react-hooks/exhaustive-deps
}
