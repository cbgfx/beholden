import * as React from "react";
import { useWs } from "@/services/ws";
import { fetchEncounterCombatState, putEncounterCombatState } from "@/services/encounterApi";

type CombatState = { round: number; activeCombatantId: string | null };

export function useServerCombatState(encounterId: string | undefined) {
  const [loaded, setLoaded] = React.useState(false);
  const [round, setRound] = React.useState(1);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [started, setStarted] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!encounterId) return;
    const s = await fetchEncounterCombatState<CombatState>(encounterId);
    setRound(Number(s.round ?? 1) || 1);
    setActiveId(s.activeCombatantId ?? null);
    setStarted(Boolean(s.activeCombatantId) || Number(s.round ?? 1) > 1);
    setLoaded(true);
  }, [encounterId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  useWs((msg) => {
    if (msg.type !== "encounter:combatStateChanged") return;
    const p = msg.payload;
    if (!p || typeof p !== "object") return;
    const encId = (p as { encounterId?: unknown }).encounterId;
    if (typeof encId === "string" && encId === encounterId) refresh();
  });

  const persist = React.useCallback(
    async (next: { round: number; activeId: string | null }) => {
      if (!encounterId) return;
      await putEncounterCombatState(encounterId, { round: next.round, activeCombatantId: next.activeId });
      // Update local snapshot immediately (ws will also echo).
      setRound(next.round);
      setActiveId(next.activeId);
      setStarted(Boolean(next.activeId) || next.round > 1);
    },
    [encounterId]
  );

  return {
    loaded,
    round,
    setRound,
    activeId,
    setActiveId,
    started,
    refresh,
    persist
  };
}
