import React from "react";
import { api, jsonInit } from "@/services/api";
import { useWs } from "@/services/ws";
import type { Character } from "@/views/character/CharacterViewHelpers";

export function useCharacterSyncEffects(args: {
  char: Character | null;
  setChar: React.Dispatch<React.SetStateAction<Character | null>>;
  fetchChar: () => Promise<void>;
  syncedAcValue: number | null;
}) {
  const { char, setChar, fetchChar, syncedAcValue } = args;
  const lastSyncedAcRef = React.useRef<{ charId: string; ac: number } | null>(null);

  React.useEffect(() => {
    if (char?.id && char.name) {
      try {
        localStorage.setItem("beholden:lastCharacter", JSON.stringify({ id: char.id, name: char.name }));
        window.dispatchEvent(new CustomEvent("beholden:lastCharacter"));
      } catch {}
    }
  }, [char?.id, char?.name]);

  useWs(React.useCallback((msg) => {
    if (msg.type !== "players:changed") return;
    const campaignId = (msg.payload as any)?.campaignId as string | undefined;
    if (!campaignId) return;
    setChar((prev) => {
      if (prev?.campaigns.some((campaign) => campaign.campaignId === campaignId)) {
        void fetchChar();
      }
      return prev;
    });
  }, [fetchChar, setChar]));

  React.useEffect(() => {
    if (!char || syncedAcValue == null) return;
    const prev = lastSyncedAcRef.current;
    if (prev?.charId === char.id && prev?.ac === syncedAcValue) return;
    lastSyncedAcRef.current = { charId: char.id, ac: syncedAcValue };
    if (syncedAcValue !== char.syncedAc) {
      void api(`/api/me/characters/${char.id}`, jsonInit("PUT", { syncedAc: syncedAcValue }));
    }
  }, [syncedAcValue, char?.id, char?.syncedAc]); // eslint-disable-line react-hooks/exhaustive-deps
}
