import * as React from "react";
import { useWs } from "@/services/ws";
import { fetchEncounterCombatState, putEncounterCombatState } from "@/services/encounterApi";

type CombatState = { round: number; activeCombatantId: string | null };

export function useServerCombatState(encounterId: string | undefined) {
  const [loaded, setLoaded] = React.useState(false);
  const [round, setRound] = React.useState(1);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [started, setStarted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scope = React.useRef<{ id: string | undefined; revision: number; writes: number } | null>(null);
  const apply = React.useCallback((s: CombatState) => {
    setRound(Number(s.round ?? 1) || 1);
    setActiveId(s.activeCombatantId ?? null);
    setStarted(Boolean(s.activeCombatantId) || Number(s.round ?? 1) > 1);
    setLoaded(true);
    setError(null);
  }, []);
  const refresh = React.useCallback(async (retainError?: string) => {
    const current = scope.current;
    if (!encounterId || !current || current.id !== encounterId || current.writes) return;
    const revision = ++current.revision;
    try {
      const next = await fetchEncounterCombatState<CombatState>(encounterId);
      if (scope.current === current && current.revision === revision) { apply(next); if (retainError) setError(retainError); }
    } catch (cause) {
      if (scope.current === current && current.revision === revision) setError(cause instanceof Error ? cause.message : "Failed to load combat state.");
    }
  }, [encounterId, apply]);
  React.useEffect(() => {
    scope.current = { id: encounterId, revision: 0, writes: 0 };
    setLoaded(false); setStarted(false); setRound(1); setActiveId(null); setError(null);
    void refresh();
    return () => { scope.current = null; };
  }, [encounterId, refresh]);
  useWs((msg) => {
    if (msg.type !== "encounter:combatStateChanged") return;
    const payload = msg.payload as { encounterId?: string } | undefined;
    if (payload?.encounterId === encounterId) void refresh();
  });
  const persist = React.useCallback(async (next: { round: number; activeId: string | null }) => {
    const current = scope.current;
    if (!encounterId || !current || current.id !== encounterId) return;
    if (current.writes) {
      const message = "A turn change is still saving. Please try again.";
      setError(message);
      throw new Error(message);
    }
    ++current.revision;
    current.writes++;
    let failure: string | undefined;
    try {
      await putEncounterCombatState(encounterId, { round: next.round, activeCombatantId: next.activeId });
      if (scope.current === current) apply({ round: next.round, activeCombatantId: next.activeId });
    } catch (cause) {
      failure = cause instanceof Error ? cause.message : "Failed to save combat state.";
      if (scope.current === current) setError(failure);
      throw cause;
    } finally {
      current.writes--;
      if (scope.current === current) void refresh(failure);
    }
  }, [encounterId, apply, refresh]);
  return { loaded, round, setRound, activeId, setActiveId, started, error, refresh, persist };
}
