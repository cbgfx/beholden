import * as React from "react";
import { api } from "@/services/api";
import type { Combatant } from "@/domain/types/domain";
import {
  activeIndexOf,
  ensureActiveId,
  initializeCombat,
  nextTurn as nextTurnEngine,
  prevTurn as prevTurnEngine,
} from "@/views/CombatView/engine/CombatEngine";

type Args = {
  encounterId: string | undefined;
  orderedCombatants: Combatant[];
  canNavigate: boolean;
  started: boolean;
  loaded: boolean;
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
  loaded,
  round,
  activeId,
  setActiveId,
  setRound,
  persistCombatState
}: Args) {
  // Keep activeId valid whenever roster changes.
  React.useEffect(() => {
    setActiveId(ensureActiveId(orderedCombatants, activeId));
  }, [orderedCombatants, activeId, setActiveId]);

  const activeIndex = React.useMemo(() => {
    return activeIndexOf(orderedCombatants, activeId);
  }, [orderedCombatants, activeId]);

  const active = orderedCombatants[activeIndex] ?? null;

  const nextTurn = React.useCallback(() => {
    if (!orderedCombatants.length) return;
    if (!canNavigate) return;
    const next = nextTurnEngine(orderedCombatants, { round, activeId });
    if (!next.activeId) return;
    setActiveId(next.activeId);
    if (next.round !== round) setRound(next.round);
    void persistCombatState({ round: next.round, activeId: next.activeId });
  }, [orderedCombatants, canNavigate, round, activeId, setActiveId, setRound, persistCombatState]);

  const prevTurn = React.useCallback(() => {
    if (!orderedCombatants.length) return;
    if (!canNavigate) return;
    const next = prevTurnEngine(orderedCombatants, { round, activeId });
    if (!next.activeId) return;
    setActiveId(next.activeId);
    if (next.round !== round) setRound(next.round);
    void persistCombatState({ round: next.round, activeId: next.activeId });
  }, [orderedCombatants, canNavigate, round, activeId, setActiveId, setRound, persistCombatState]);

  // When initiative becomes fully set (combat "starts"), initialize persisted combat state once.
  const prevCanNavigateRef = React.useRef(false);
  React.useEffect(() => {
    if (!loaded) return;
    if (!prevCanNavigateRef.current && canNavigate && !started) {
      const init = initializeCombat(orderedCombatants);
      setRound(init.round);
      setActiveId(init.activeId);
      persistCombatState({ round: init.round, activeId: init.activeId });
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
  }, [canNavigate, loaded, encounterId, orderedCombatants, persistCombatState, setActiveId, setRound, started]);

  // Keyboard shortcuts: n/p for next/prev. Ignore when focus is in a text input.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = String(t?.tagName ?? "").toLowerCase();
      const inEditable = tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable;
      if (inEditable) {
        // Allow n/p from specific inputs (e.g. CombatDeltaControls) for fast table flow.
        const k = String(e.key || "").toLowerCase();
        const allow = typeof t?.closest === "function" ? t.closest('[data-allow-combat-nav="true"]') : null;
        if (!allow || (k !== "n" && k !== "p")) return;
      }

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
