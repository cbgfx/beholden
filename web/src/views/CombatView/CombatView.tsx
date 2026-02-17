import * as React from "react";
import { useParams } from "react-router-dom";
import { useStore } from "@/store";
import type { Combatant } from "@/domain/types/domain";

import { CombatHeader } from "@/views/CombatView/components/CombatHeader";
import { CombatDeltaControls } from "@/views/CombatView/components/CombatDeltaControls";
import { SpellDetailModal } from "@/views/CombatView/components/SpellDetailModal";
import { HudFighterCard } from "@/views/CombatView/components/HudFighterCard";
import { CombatantTypeIcon } from "@/views/CombatView/components/CombatantTypeIcon";
import { TurnControls } from "@/views/CombatView/components/TurnControls";
import { InitiativePanel } from "@/views/CombatView/panels/InitiativePanel";
import { CombatantDetailsPanel } from "@/views/CombatView/panels/CombatantDetailsPanel/CombatantDetailsPanel";

import { useIsNarrow } from "@/views/CombatView/hooks/useIsNarrow";
import { useServerCombatState } from "@/views/CombatView/hooks/useServerCombatState";
import { useMonsterDetailsCache } from "@/views/CombatView/hooks/useMonsterDetailsCache";
import { useSpellModal } from "@/views/CombatView/hooks/useSpellModal";
import { useCombatNavigation } from "@/views/CombatView/hooks/useCombatNavigation";
import { useCombatActions } from "@/views/CombatView/hooks/useCombatActions";
import { useCombatantDetailsCtx } from "@/views/CombatView/hooks/useCombatantDetailsCtx";
import { useEncounterCombatants } from "@/views/CombatView/hooks/useEncounterCombatants";
import { useCombatViewModel } from "@/views/CombatView/hooks/useCombatViewModel";
import { applyMonsterAttackOverrides } from "@/views/CombatView/utils/monsterOverrides";
import { getSecondsInRound } from "@/views/CombatView/utils/roundTime";

export function CombatView() {
  const { campaignId, encounterId } = useParams();
  const { state, dispatch } = useStore();

  const [targetId, setTargetId] = React.useState<string | null>(null);

  const { encounter, combatants, orderedCombatants, canNavigate, target, playersById, inpcsById } = useCombatViewModel({
    encounterId,
    state: state as any,
    targetId
  });

  const { refresh } = useEncounterCombatants(encounterId, dispatch);

  const {
    round,
    setRound,
    activeId,
    setActiveId,
    started,
    persist: persistCombatState,
  } = useServerCombatState(encounterId);

  // Stable callbacks so initiative rows can be memoized without thrashing.
  const handleSelectTarget = React.useCallback((id: string) => setTargetId(id), []);

  const [delta, setDelta] = React.useState<string>("");
  const isNarrow = useIsNarrow();

  const { active, nextTurn, prevTurn } = useCombatNavigation({
    encounterId,
    orderedCombatants,
    canNavigate,
    started,
    round,
    activeId,
    setActiveId,
    setRound,
    persistCombatState,
  });

  const secondsInRound = React.useMemo(() => {
    // Display round time as (Round * 6 - 6): Round 1 => 0s, Round 2 => 6s, etc.
    // Intentionally NOT tied to Prev/Next navigation (active combatant).
    return getSecondsInRound({ started, round });
  }, [started, round]);

  React.useEffect(() => {
    // Keep target valid when combatants change.
    setTargetId((prev) => {
      if (prev && combatants.some((c: any) => (c as any).id === prev)) return prev;
      return (combatants[0] as any)?.id ?? null;
    });
  }, [combatants, setTargetId]);

  const { monsterCache, setMonsterCache, monsterCrById, activeMonster, targetMonster } =
    useMonsterDetailsCache(combatants, (active as Combatant | null) ?? null, (target as Combatant | null) ?? null);

  const {
    spellLevelCache,
    spellDetail,
    spellError,
    spellLoading,
    openSpellByName,
    closeSpell,
    sortedActiveSpellNames,
    sortedTargetSpellNames
  } = useSpellModal(activeMonster, targetMonster);

  const {
    applyHpDelta,
    updateCombatant,
    rollInitiativeForMonsters,
    resetFight,
    endCombat,
    onOpenOverrides,
    onOpenConditions
  } = useCombatActions({
    campaignId: campaignId as any,
    encounterId,
    orderedCombatants,
    setActiveId,
    setTargetId,
    setRound,
    persistCombatState,
    inpcsById,
    delta,
    setDelta,
    target: (target as Combatant | null) ?? null,
    refresh,
    monsterCache,
    setMonsterCache,
    dispatch,
  });

  const handleSetInitiative = React.useCallback(
    (id: string, initiative: number) => updateCombatant(id, { initiative }),
    [updateCombatant]
  );

  const activeAny: any = active as any;
  const targetAny: any = target as any;

  const renderCombatantIcon = React.useCallback((c: any) => <CombatantTypeIcon combatant={c} />, []);

  const onOpenConditionsFromDelta = React.useCallback(() => {
    if (!activeAny?.id || !targetAny?.id) return;
    const role = targetAny.id === activeAny.id ? "active" : "target";
    onOpenConditions(targetAny.id, role, activeAny.id);
  }, [activeAny?.id, targetAny?.id, onOpenConditions]);

  const activeCtx = useCombatantDetailsCtx({
    isNarrow,
    role: "active",
    combatant: (active as Combatant | null) ?? null,
    combatantAny: activeAny,
    selectedMonster: applyMonsterAttackOverrides(activeMonster as any, activeAny),
    playersById,
    spellNames: sortedActiveSpellNames,
    spellLevels: spellLevelCache,
    roster: orderedCombatants,
    activeForCaster: (active as Combatant | null) ?? null,
    updateCombatant,
    onOpenOverrides,
    onOpenConditions,
    openSpellByName
  });

  const targetCtx = useCombatantDetailsCtx({
    isNarrow,
    role: "target",
    combatant: (target as Combatant | null) ?? null,
    combatantAny: targetAny,
    selectedMonster: applyMonsterAttackOverrides(targetMonster as any, targetAny),
    playersById,
    spellNames: sortedTargetSpellNames,
    spellLevels: spellLevelCache,
    roster: orderedCombatants,
    activeForCaster: (active as Combatant | null) ?? null,
    updateCombatant,
    onOpenOverrides,
    onOpenConditions,
    openSpellByName,
    casterIdForTarget: (active as any)?.id ?? null
  });

  return (
    <div style={{ padding: "var(--space-page)" }}>
      <CombatHeader
        backTo={campaignId && encounterId ? `/campaign/${campaignId}/roster/${encounterId}` : (campaignId ? `/campaign/${campaignId}` : "/")}
        backTitle="Back to Roster"
        title={(encounter as any)?.name ?? "Combat"}
        round={round}
        seconds={secondsInRound}
        canNavigate={canNavigate}
        rollLabel={canNavigate ? "Reset Fight" : "Roll Monsters"}
        onRollOrReset={canNavigate ? resetFight : rollInitiativeForMonsters}
        onEndCombat={endCombat}
        onPrev={prevTurn}
        onNext={nextTurn}
      />

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: isNarrow ? "1fr" : "minmax(0, 6fr) minmax(0, 5fr) minmax(0, 6fr)",
          gap: 14,
          alignItems: "start"
        }}
      >
        {!isNarrow ? (
          <div
            style={{
              gridColumn: "1 / -1",
              display: "grid",
              gridTemplateColumns: "max-content max-content max-content",
              justifyContent: "center",
              gap: 18,
              alignItems: "center"
            }}
          >
            <HudFighterCard
              combatant={activeAny}
              role="active"
              playersById={playersById}
              renderCombatantIcon={renderCombatantIcon}
              activeId={activeAny?.id ?? null}
              targetId={targetAny?.id ?? null}
              onOpenConditions={onOpenConditions}
            />

            <div style={{ justifySelf: "center" }}>
              <CombatDeltaControls
                value={delta}
                targetId={(target as any)?.id ?? null}
                disabled={!target}
                onChange={setDelta}
                onApplyDamage={() => applyHpDelta("damage")}
                onApplyHeal={() => applyHpDelta("heal")}
                onOpenConditions={onOpenConditionsFromDelta}
              />
            </div>

            <HudFighterCard
              combatant={targetAny}
              role="target"
              playersById={playersById}
              renderCombatantIcon={renderCombatantIcon}
              activeId={activeAny?.id ?? null}
              targetId={targetAny?.id ?? null}
              onOpenConditions={onOpenConditions}
            />
          </div>
        ) : null}

        <CombatantDetailsPanel roleTitle="Active" role="active" combatant={active ?? null} ctx={activeCtx} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Center-stage turn controls: Round + Prev/Next live above delta controls */}
          <TurnControls
            round={round}
            secondsInRound={typeof secondsInRound === "number" ? secondsInRound : null}
            canNavigate={canNavigate}
            onPrev={prevTurn}
            onNext={nextTurn}
          />

          {isNarrow ? (
            <CombatDeltaControls
              value={delta}
              targetId={(target as any)?.id ?? null}
              disabled={!target}
              onChange={setDelta}
              onApplyDamage={() => applyHpDelta("damage")}
              onApplyHeal={() => applyHpDelta("heal")}
              onOpenConditions={onOpenConditionsFromDelta}
            />
          ) : null}

          <InitiativePanel
            combatants={orderedCombatants}
            playersById={playersById}
            monsterCrById={monsterCrById}
            activeId={activeId}
            targetId={(target as any)?.id ?? null}
            onSelectTarget={handleSelectTarget}
            onSetInitiative={handleSetInitiative}
          />
        </div>

        <CombatantDetailsPanel roleTitle="Target" role="target" combatant={target ?? null} ctx={targetCtx} />
      </div>

      <SpellDetailModal
        isOpen={spellLoading || !!spellDetail || !!spellError}
        title={<span>Spell</span>}
        isLoading={spellLoading}
        error={spellError}
        spellDetail={spellDetail}
        onClose={closeSpell}
      />
    </div>
  );
}
