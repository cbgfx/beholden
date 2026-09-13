import React from "react";
import { useWs } from "@/services/ws";
import { putMyCharacter } from "@/views/character/state/characterApi";
import type { Character } from "@/views/character/CharacterViewHelpers";
import { useDebouncedSingleflight } from "@beholden/shared/ui";
import { createDerivedStatSync } from "@/views/character/state/derivedStatSync";

export function useCharacterSyncEffects(args: {
  char: Character | null;
  setChar: React.Dispatch<React.SetStateAction<Character | null>>;
  fetchChar: () => Promise<void>;
  syncedAcValue: number | null;
  syncedHpMaxValue: number | null;
  syncedSpeedValue?: number | null;
}) {
  const { char, fetchChar, syncedAcValue, syncedHpMaxValue, syncedSpeedValue } = args;
  const charId = char?.id;
  const statSyncRef = React.useRef<ReturnType<typeof createDerivedStatSync> | null>(null);
  React.useEffect(() => {
    const sync = createDerivedStatSync(putMyCharacter);
    statSyncRef.current = sync;
    return () => { sync.dispose(); statSyncRef.current = null; };
  }, []);
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
    // Any inbound frame proves the socket is live — retry a stat push that a
    // transient failure left pending.
    statSyncRef.current?.poke();
    if (msg.type === "players:delta") {
      const payload = (msg.payload ?? {}) as { campaignId?: string; characterId?: string | null };
      const campaignId = payload.campaignId;
      if (!campaignId) return;
      if (!char?.campaigns.some((campaign) => campaign.campaignId === campaignId)) return;
      if (typeof payload.characterId === "string" && payload.characterId && payload.characterId !== char.id) return;
      enqueueFetchChar(80);
      return;
    }
  }, [enqueueFetchChar, char]));

  React.useEffect(() => {
    statSyncRef.current?.set(
      charId && syncedHpMaxValue != null
        ? { charId, ac: syncedAcValue, hpMax: syncedHpMaxValue, speed: syncedSpeedValue ?? null }
        : null,
    );
  }, [charId, syncedAcValue, syncedHpMaxValue, syncedSpeedValue]);


}
