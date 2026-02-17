import * as React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import type { Combatant } from "@/domain/types/domain";

type Args = {
  campaignId?: string;
  encounterId: string | undefined;
  orderedCombatants: Combatant[];
  refresh: () => Promise<void>;
  setRound: (n: number | ((prev: number) => number)) => void;
  setActiveId: (id: string | null) => void;
  setTargetId: (id: string | null) => void;
  persistCombatState: (next: { round: number; activeId: string | null }) => Promise<void>;
};

function normalizeHpMaxOverride(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function useCombatFightActions({
  campaignId,
  encounterId,
  orderedCombatants,
  refresh,
  setRound,
  setActiveId,
  setTargetId,
  persistCombatState
}: Args) {
  const navigate = useNavigate();

  const resetFight = React.useCallback(async () => {
    if (!encounterId) return;
    const rows = orderedCombatants as any[];
    for (const c of rows) {
      const patch: any = {
        conditions: [],
        initiative: 0
      };
      if (c.baseType === "monster") {
        const overrides = c.overrides ?? null;
        const maxOverride = normalizeHpMaxOverride(overrides?.hpMaxOverride);
        const max = maxOverride ?? Number(c.hpMax);
        patch.hpCurrent = Number.isFinite(max) ? max : Number(c.hpCurrent ?? 0);
      }
      await api(`/api/encounters/${encounterId}/combatants/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
    }
    try {
      await api(`/api/encounters/${encounterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Open" })
      });
    } catch {
      // ignore
    }
    await refresh();
    setRound(1);
    // With initiatives cleared, there is no active combatant until initiatives are entered/rolled.
    setActiveId(null);
    setTargetId(null);
    try {
      await persistCombatState({ round: 1, activeId: null });
    } catch {
      // ignore
    }
  }, [encounterId, orderedCombatants, refresh, setRound, setActiveId, setTargetId, persistCombatState]);

  const endCombat = React.useCallback(async () => {
    if (!encounterId) return;
    try {
      await api(`/api/encounters/${encounterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Complete" })
      });
    } catch {
      // ignore
    }

    try {
      await persistCombatState({ round: 1, activeId: null });
    } catch {
      // ignore
    }

    // Give immediate feedback by returning to the campaign view.
    try {
      await refresh();
    } catch {
      // ignore
    }
    if (campaignId) navigate(`/campaign/${campaignId}`);
    else navigate("/");
  }, [campaignId, encounterId, persistCombatState, refresh, navigate]);

  return { resetFight, endCombat };
}
