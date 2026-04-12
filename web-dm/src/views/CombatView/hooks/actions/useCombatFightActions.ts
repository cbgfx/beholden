// web/src/views/CombatView/hooks/actions/useCombatFightActions.ts
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import type { EncounterActor } from "@/domain/types/domain";

type Args = {
  campaignId?: string;
  encounterId: string | undefined;
  orderedCombatants: EncounterActor[];
  setRound: (n: number | ((prev: number) => number)) => void;
  setActiveId: (id: string | null) => void;
  setTargetId: (id: string | null) => void;
  persistCombatState: (next: { round: number; activeId: string | null }) => Promise<void>;
};

function normalizeHpMaxBonus(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

export function useCombatFightActions({
  campaignId,
  encounterId,
  orderedCombatants,
  setRound,
  setActiveId,
  setTargetId,
  persistCombatState,
}: Args) {
  const navigate = useNavigate();

  const resetFight = React.useCallback(async () => {
    if (!encounterId) return;

    for (const c of orderedCombatants) {
      // Players are campaign-persistent. Reset Fight must NEVER touch player HP,
      // conditions, death saves, or overrides — those belong to the Player record
      // and are only modified by in-combat HP actions, conditions drawers, or Full Rest.
      if (c.baseType === "player") {
        // Only clear initiative so they re-roll for the next fight.
        await api(`/api/encounters/${encounterId}/combatants/${c.id}`, jsonInit("PUT", { initiative: null }));
        continue;
      }

      // Non-player combatants (monsters, iNPCs): restore HP to max and clear conditions/initiative.
      const overrides = c.overrides ?? null;
      const hpBonus = normalizeHpMaxBonus(overrides?.hpMaxBonus) ?? 0;
      const max = Math.max(1, Number(c.hpMax) + hpBonus);

      await api(`/api/encounters/${encounterId}/combatants/${c.id}`, jsonInit("PUT", {
        initiative: null,
        conditions: [],
        hpCurrent: Number.isFinite(max) ? max : Number(c.hpCurrent ?? 0),
      }));
    }

    try {
      await api(`/api/encounters/${encounterId}`, jsonInit("PUT", { status: "Open" }));
    } catch {
      // ignore
    }

    setRound(1);
    setActiveId(null);
    setTargetId(null);
    try {
      await persistCombatState({ round: 1, activeId: null });
    } catch {
      // ignore
    }
  }, [encounterId, orderedCombatants, setRound, setActiveId, setTargetId, persistCombatState]);

  const endCombat = React.useCallback(async () => {
    if (!encounterId) return;
    try {
      await api(`/api/encounters/${encounterId}`, jsonInit("PUT", { status: "Complete" }));
    } catch {
      // ignore
    }

    try {
      await persistCombatState({ round: 1, activeId: null });
    } catch {
      // ignore
    }

    if (campaignId) navigate(`/campaign/${campaignId}`);
    else navigate("/");
  }, [campaignId, encounterId, persistCombatState, navigate]);

  return { resetFight, endCombat };
}
