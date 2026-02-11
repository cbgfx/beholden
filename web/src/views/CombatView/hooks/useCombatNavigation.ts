import * as React from "react";
import { api } from "@/app/services/api";
import type { Combatant } from "@/app/types/domain";

type Args = {
  encounterId: string | undefined;
  orderedCombatants: Combatant[];
  canNavigate: boolean;
  started: boolean;
  round: number;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  setRound: (n: number | ((prev: number) => number)) => void;
  persistCombatState: (next: { round: number; activeId: string | null }) => Promise<void>;
};

export function useCombatNavigation({
  encounterId,
  orderedCombatants,
  canNavigate,
  started,
  round,
  activeId,
  setActiveId,
  setRound,
  persistCombatState
}: Args) {
  // Keep activeId valid whenever roster changes.
  React.useEffect(() => {
    if (!orderedCombatants.length) {
      setActiveId(null);
      return;
    }
    if (activeId && orderedCombatants.some((c: any) => (c as any).id === activeId)) return;
    setActiveId((orderedCombatants as any)[0]?.id ?? null);
  }, [orderedCombatants, activeId, setActiveId]);

  const activeIndex = React.useMemo(() => {
    if (!orderedCombatants.length) return 0;
    if (activeId) {
      const idx = (orderedCombatants as any[]).findIndex((c) => (c as any).id === activeId);
      if (idx >= 0) return idx;
    }
    return 0;
  }, [orderedCombatants, activeId]);

  const active = (orderedCombatants as any)[activeIndex] ?? null;

  const isAlive = React.useCallback((c: any) => {
    const hp = Number(c?.hpCurrent ?? 0);
    return !Number.isNaN(hp) && hp > 0;
  }, []);

  const nextTurn = React.useCallback(() => {
    if (!orderedCombatants.length) return;
    if (!canNavigate) return;

    let nextIdx = activeIndex;
    let nextRound = round;
    let nextId: string | null = null;

    for (let i = 0; i < orderedCombatants.length; i++) {
      nextIdx += 1;
      if (nextIdx >= orderedCombatants.length) {
        nextIdx = 0;
        nextRound += 1;
      }
      const c: any = (orderedCombatants as any)[nextIdx];
      if (isAlive(c)) {
        nextId = c?.id ?? null;
        break;
      }
    }

    if (!nextId) return;
    setActiveId(nextId);
    if (nextRound !== round) setRound(nextRound);
    void persistCombatState({ round: nextRound, activeId: nextId });
  }, [orderedCombatants, canNavigate, activeIndex, round, setActiveId, setRound, persistCombatState, isAlive]);

  const prevTurn = React.useCallback(() => {
    if (!orderedCombatants.length) return;
    if (!canNavigate) return;

    let nextIdx = activeIndex;
    let nextRound = round;
    let nextId: string | null = null;

    for (let i = 0; i < orderedCombatants.length; i++) {
      nextIdx -= 1;
      if (nextIdx < 0) {
        nextIdx = Math.max(0, orderedCombatants.length - 1);
        nextRound = Math.max(1, nextRound - 1);
      }
      const c: any = (orderedCombatants as any)[nextIdx];
      if (isAlive(c)) {
        nextId = c?.id ?? null;
        break;
      }
    }

    if (!nextId) return;
    setActiveId(nextId);
    if (nextRound !== round) setRound(nextRound);
    void persistCombatState({ round: nextRound, activeId: nextId });
  }, [orderedCombatants, canNavigate, activeIndex, round, setActiveId, setRound, persistCombatState, isAlive]);

  // When initiative becomes fully set (combat "starts"), initialize persisted combat state once.
  const prevCanNavigateRef = React.useRef(false);
  React.useEffect(() => {
    if (!prevCanNavigateRef.current && canNavigate && !started) {
      const firstAlive = (orderedCombatants as any).find((c: any) => Number(c?.hpCurrent ?? 0) > 0)?.id ??
        (orderedCombatants as any)[0]?.id ??
        null;
      setRound(1);
      setActiveId(firstAlive);
      persistCombatState({ round: 1, activeId: firstAlive });
      if (encounterId) {
        (async () => {
          try {
            await api(`/api/encounters/${encounterId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "In Progress" })
            });
          } catch {
            // ignore
          }
        })();
      }
    }
    prevCanNavigateRef.current = canNavigate;
  }, [canNavigate, encounterId, orderedCombatants, persistCombatState, setActiveId, setRound, started]);

  // Keyboard shortcuts: n/p for next/prev. Ignore when focus is in a text input.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as any;
      const tag = String(t?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        nextTurn();
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        prevTurn();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextTurn, prevTurn]);

  return { activeIndex, active, nextTurn, prevTurn };
}
