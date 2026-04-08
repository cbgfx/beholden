import * as React from "react";
import { useParams } from "react-router-dom";
import { useStore } from "@/store";
import type { EncounterActor } from "@/domain/types/domain";
import type { State } from "@/store/state";
import { theme } from "@/theme/theme";

import { CombatantHeader } from "@/views/CombatView/components/CombatantHeader";
import { CombatHudBar } from "@/views/CombatView/components/CombatHudBar";
import { CombatDeltaControls } from "@/views/CombatView/components/CombatDeltaControls";
import { SpellDetailModal } from "@/views/CombatView/components/SpellDetailModal";
import { CombatantTypeIcon } from "@/views/CombatView/components/CombatantTypeIcon";
import { TurnControls } from "@/views/CombatView/components/TurnControls";
import { CombatOrderPanel } from "@/views/CombatView/panels/CombatOrderPanel";
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
import { useBulkDamageMode } from "@/views/CombatView/hooks/useBulkDamageMode";
import { applyMonsterAttackOverrides } from "@/views/CombatView/utils/monsterOverrides";
import { getSecondsInRound } from "@/views/CombatView/utils/roundTime";

export function CombatView() {
  const { campaignId, encounterId } = useParams();
  const { state, dispatch } = useStore();

  const openSpellBook = React.useCallback(() => {
    dispatch({ type: "openDrawer", drawer: { type: "spellbook" } });
  }, [dispatch]);

  const openAdventureNotes = React.useCallback(() => {
    dispatch({ type: "openDrawer", drawer: { type: "adventureNotes" } });
  }, [dispatch]);

  const [targetId, setTargetId] = React.useState<string | null>(null);

  const { encounter, combatants, orderedCombatants, canNavigate, target, playersById, inpcsById } = useCombatViewModel({
    encounterId,
    state: state as State,
    targetId
  });

  const { refresh } = useEncounterCombatants(encounterId, dispatch);

  const {
    loaded,
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

  const {
    bulkMode,
    bulkSelectedIds,
    toggleBulkMode: handleToggleBulkMode,
    toggleBulkSelect: handleToggleBulkSelect,
    applyBulkDamage,
  } = useBulkDamageMode({ encounterId, delta, setDelta, orderedCombatants, refresh });

  const { active, nextTurn, prevTurn } = useCombatNavigation({
    encounterId,
    orderedCombatants,
    canNavigate,
    started,
    loaded,
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
      if (prev && combatants.some((c) => c.id === prev)) return prev;
      return combatants[0]?.id ?? null;
    });
  }, [combatants, setTargetId]);

  const { monsterCache, setMonsterCache, monsterCrById, activeMonster, targetMonster } = useMonsterDetailsCache(
    combatants,
    (active as EncounterActor | null) ?? null,
    (target as EncounterActor | null) ?? null,
    inpcsById
  );

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
    concentrationAlert,
    dismissConcentrationAlert,
    updateCombatant,
    rollInitiativeForMonsters,
    resetFight,
    endCombat,
    onOpenOverrides,
    onOpenConditions,
    onOpenPolymorph,
  } = useCombatActions({
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
    target: (target as EncounterActor | null) ?? null,
    refresh,
    monsterCache,
    setMonsterCache,
    dispatch,
  });

  const handleSetInitiative = React.useCallback(
    (id: string, initiative: number) => updateCombatant(id, { initiative }),
    [updateCombatant]
  );

  const handleToggleReaction = React.useCallback(
    (id: string) => {
      const c = orderedCombatants.find(x => x.id === id);
      if (!c) return;
      void updateCombatant(id, { usedReaction: !c.usedReaction });
    },
    [orderedCombatants, updateCombatant]
  );

  // Reset reaction for the incoming active combatant each time the turn changes.
  const prevActiveIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!activeId || activeId === prevActiveIdRef.current) return;
    prevActiveIdRef.current = activeId;
    void updateCombatant(activeId, { usedReaction: false });
  }, [activeId, updateCombatant]);

  const renderCombatantIcon = React.useCallback(
    (combatant: EncounterActor | null) => <CombatantTypeIcon combatant={combatant ?? undefined} />,
    []
  );

  const onOpenConditionsFromDelta = React.useCallback(() => {
    if (!active?.id || !target?.id) return;
    const role = target.id === active.id ? "active" : "target";
    onOpenConditions(target.id, role, active.id);
  }, [active?.id, target?.id, onOpenConditions]);

  const handleApplyDamage = React.useCallback(() => {
    if (bulkMode) {
      void applyBulkDamage();
      return;
    }
    void applyHpDelta("damage");
  }, [applyBulkDamage, applyHpDelta, bulkMode]);

  const handleApplyHeal = React.useCallback(() => {
    void applyHpDelta("heal");
  }, [applyHpDelta]);

  const activeCtx = useCombatantDetailsCtx({
    isNarrow,
    role: "active",
    combatant: (active as EncounterActor | null) ?? null,
    selectedMonster: applyMonsterAttackOverrides(activeMonster ?? null, active ?? null),
    playersById,
    spellNames: sortedActiveSpellNames,
    spellLevels: spellLevelCache,
    roster: orderedCombatants,
    activeForCaster: (active as EncounterActor | null) ?? null,
    currentRound: round,
    updateCombatant,
    onOpenOverrides,
    onOpenConditions,
    onOpenPolymorph,
    openSpellByName
  });

  const targetCtx = useCombatantDetailsCtx({
    isNarrow,
    role: "target",
    combatant: (target as EncounterActor | null) ?? null,
    selectedMonster: applyMonsterAttackOverrides(targetMonster ?? null, target ?? null),
    playersById,
    spellNames: sortedTargetSpellNames,
    spellLevels: spellLevelCache,
    roster: orderedCombatants,
    activeForCaster: (active as EncounterActor | null) ?? null,
    currentRound: round,
    updateCombatant,
    onOpenOverrides,
    onOpenConditions,
    onOpenPolymorph,
    openSpellByName,
    casterIdForTarget: active?.id ?? null
  });

  return (
    <div style={{ padding: "var(--space-page)" }}>
      {concentrationAlert && (
        <div style={{
          marginBottom: 10, padding: "10px 14px", borderRadius: 10,
          background: "rgba(255, 140, 66, 0.15)", border: `1px solid ${theme.colors.accentWarning}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <span style={{ color: theme.colors.text, fontWeight: 700 }}>
            ⚠️ <strong>{concentrationAlert.name}</strong> is Concentrating — CON Save DC <strong>{concentrationAlert.dc}</strong>
          </span>
          <button
            onClick={dismissConcentrationAlert}
            style={{ all: "unset", cursor: "pointer", color: theme.colors.muted, fontWeight: 900, fontSize: "var(--fs-title)", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      <CombatantHeader
        backTo={campaignId && encounterId ? `/campaign/${campaignId}/roster/${encounterId}` : (campaignId ? `/campaign/${campaignId}` : "/")}
        backTitle="Back to Roster"
        title={encounter?.name ?? "Combat"}
        round={round}
        seconds={secondsInRound}
        canNavigate={canNavigate}
        rollLabel="Roll Monsters"
        onRollOrReset={rollInitiativeForMonsters}
        onResetFight={resetFight}
        onOpenSpellBook={openSpellBook}
        onOpenAdventureNotes={openAdventureNotes}
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
        <CombatHudBar
          isNarrow={isNarrow}
          active={active ?? null}
          target={target ?? null}
          playersById={playersById}
          renderCombatantIcon={renderCombatantIcon}
          activeId={active?.id ?? null}
          targetId={target?.id ?? null}
          onOpenConditions={onOpenConditions}
          delta={delta}
          deltaDisabled={!bulkMode && !target}
          onChangeDelta={setDelta}
          onApplyDamage={handleApplyDamage}
          onApplyHeal={handleApplyHeal}
          onOpenConditionsFromDelta={onOpenConditionsFromDelta}
          bulkMode={bulkMode}
          bulkCount={bulkSelectedIds.size}
          onToggleBulkMode={handleToggleBulkMode}
        />

        <div>
          <CombatantDetailsPanel roleTitle="Active" role="active" combatant={active ?? null} ctx={activeCtx} />
        </div>

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
              targetId={target?.id ?? null}
              disabled={!bulkMode && !target}
              onChange={setDelta}
              onApplyDamage={handleApplyDamage}
              onApplyHeal={handleApplyHeal}
              onOpenConditions={onOpenConditionsFromDelta}
              bulkMode={bulkMode}
              bulkCount={bulkSelectedIds.size}
              onToggleBulkMode={handleToggleBulkMode}
            />
          ) : null}

          <CombatOrderPanel
            combatants={orderedCombatants}
            playersById={playersById}
            monsterCrById={monsterCrById}
            activeId={activeId}
            targetId={target?.id ?? null}
            onSelectTarget={handleSelectTarget}
            onSetInitiative={handleSetInitiative}
            onToggleReaction={handleToggleReaction}
            bulkMode={bulkMode}
            bulkSelectedIds={bulkSelectedIds}
            onToggleBulkSelect={handleToggleBulkSelect}
          />
        </div>

        <div>
          <CombatantDetailsPanel roleTitle="Target" role="target" combatant={target ?? null} ctx={targetCtx} />
        </div>
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
