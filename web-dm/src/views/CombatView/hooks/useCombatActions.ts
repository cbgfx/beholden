import type { EncounterActor } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";

import { useCombatHpActions } from "@/views/CombatView/hooks/actions/useCombatHpActions";
import { useCombatantPatchActions } from "@/views/CombatView/hooks/actions/useCombatantPatchActions";
import { useCombatInitiativeActions } from "@/views/CombatView/hooks/actions/useCombatInitiativeActions";
import { useCombatFightActions } from "@/views/CombatView/hooks/actions/useCombatFightActions";
import { useCombatDrawerActions } from "@/views/CombatView/hooks/actions/useCombatDrawerActions";
import type { StoreDispatch } from "@/views/CombatView/hooks/actions/types";

type Args = {
  campaignId?: string;
  encounterId: string | undefined;
  round: number;
  orderedCombatants: EncounterActor[];
  setActiveId: (id: string | null) => void;
  setTargetId: (id: string | null) => void;
  setRound: (n: number | ((prev: number) => number)) => void;
  persistCombatState: (next: { round: number; activeId: string | null }) => Promise<void>;
  inpcsById: Record<string, { monsterId?: string } | undefined>;
  delta: string;
  setDelta: (v: string) => void;
  target: EncounterActor | null;
  refresh: () => Promise<void>;
  monsterCache: Record<string, MonsterDetail>;
  setMonsterCache: (next: Record<string, MonsterDetail>) => void;
  dispatch: StoreDispatch;
};

// Convenience aggregator for combat actions.
// NOTE: This is intentionally kept as a thin wrapper over smaller hooks.
export function useCombatActions({
  campaignId,
  encounterId,
  round,
  orderedCombatants,
  setActiveId,
  setTargetId,
  setRound,
  persistCombatState,
  inpcsById,
  delta,
  setDelta,
  target,
  refresh,
  monsterCache,
  setMonsterCache,
  dispatch
}: Args) {
  const { applyHpDelta, concentrationAlert, dismissConcentrationAlert } = useCombatHpActions({ encounterId, delta, setDelta, target });
  const { updateCombatant } = useCombatantPatchActions({ encounterId });
  const { rollInitiativeForMonsters } = useCombatInitiativeActions({
    encounterId,
    orderedCombatants,
    inpcsById,
    monsterCache,
    setMonsterCache
  });
  const { resetFight, endCombat } = useCombatFightActions({
    campaignId,
    encounterId,
    orderedCombatants,
    setRound,
    setActiveId,
    setTargetId,
    persistCombatState
  });
  const { onOpenOverrides, onOpenConditions, onOpenPolymorph } = useCombatDrawerActions({ encounterId, round, dispatch });

  return {
    applyHpDelta,
    concentrationAlert,
    dismissConcentrationAlert,
    updateCombatant,
    rollInitiativeForMonsters,
    resetFight,
    endCombat,
    onOpenOverrides,
    onOpenConditions,
    onOpenPolymorph,
  };
}
