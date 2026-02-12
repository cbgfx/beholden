import * as React from "react";
import { useParams } from "react-router-dom";
import { useStore } from "@/app/store";
import type { Combatant } from "@/app/types/domain";

import { CombatantHeader } from "./components/CombatantHeader";
import { SpellDetailModal } from "./components/SpellDetailModal";
import { CombatOrderPanel } from "./panels/CombatOrderPanel";
import { CombatantDetailsPanel } from "./panels/CombatantDetailsPanel/CombatantDetailsPanel";

import { useEncounterCombatants } from "./hooks/useEncounterCombatants";
import { useIsNarrow } from "./hooks/useIsNarrow";
import { useServerCombatState } from "./hooks/useServerCombatState";
import { useMonsterDetailsCache } from "./hooks/useMonsterDetailsCache";
import { useSpellModal } from "./hooks/useSpellModal";
import { useCombatNavigation } from "./hooks/useCombatNavigation";
import { useCombatActions } from "./hooks/useCombatActions";

function applyMonsterAttackOverrides(monster: any | null, combatant: any | null): any | null {
  if (!monster || !combatant) return monster;
  const overrides = (combatant as any).attackOverrides;
  if (!overrides || typeof overrides !== "object") return monster;

  const patchText = (text: string, ov: any) => {
    let out = String(text ?? "");
    if (typeof ov?.toHit === "number" && Number.isFinite(ov.toHit)) {
      out = out.replace(/Weapon Attack:\s*\+?\d+\s*to hit/i, (m) => m.replace(/\+?\d+/, `+${ov.toHit}`));
    }
    if (ov?.damage) {
      out = out.replace(/\(\s*[^)]+\s*\)\s*[a-zA-Z]+\s+damage/i, (m) => {
        const type = (ov?.damageType ?? (m.match(/\)\s*([a-zA-Z]+)\s+damage/i)?.[1] ?? "")).toString();
        return `(${ov.damage}) ${type} damage`;
      });
    }
    if (ov?.damageType) {
      out = out.replace(/\)\s*[a-zA-Z]+\s+damage/i, `) ${ov.damageType} damage`);
    }
    return out;
  };

  const actions = Array.isArray((monster as any).action) ? (monster as any).action : [];
  const nextActions = actions.map((a: any) => {
    const name = String(a?.name ?? a?.title ?? "");
    const ov = (overrides as any)[name];
    if (!ov) return a;
    const nextAttack = { ...(a?.attack ?? {}), ...ov };
    const nextText = a?.text ? patchText(a.text, ov) : a?.description ? patchText(a.description, ov) : a?.text;
    return { ...a, attack: nextAttack, text: nextText };
  });

  return { ...(monster as any), action: nextActions };
}
import { allHaveInitiative, orderCombatants } from "./utils/combat";

export function CombatView() {
  const { campaignId, encounterId } = useParams();
  const { state, dispatch } = useStore();

  const encounter = React.useMemo(() => {
    if (!encounterId) return null as any;
    return (state as any).encounters?.find((e: any) => e.id === encounterId) ?? null;
  }, [encounterId, (state as any).encounters]);

  const { combatants, refresh } = useEncounterCombatants(encounterId, dispatch);

  const {
    loaded: combatStateLoaded,
    round,
    setRound,
    activeId,
    setActiveId,
    started,
    persist: persistCombatState,
  } = useServerCombatState(encounterId);

  const [targetId, setTargetId] = React.useState<string | null>(null);

  const [delta, setDelta] = React.useState<string>("");
  const isNarrow = useIsNarrow();

  const orderedCombatants = React.useMemo(() => orderCombatants(combatants), [combatants]);
  const canNavigate = React.useMemo(() => allHaveInitiative(combatants), [combatants]);

  const target = React.useMemo(
    () => combatants.find((c: any) => (c as any).id === targetId) ?? null,
    [combatants, targetId]
  );

  const playersById = React.useMemo(() => {
    const m: Record<string, any> = {};
    for (const p of state.players) m[p.id] = p;
    return m;
  }, [state.players]);

  const inpcsById = React.useMemo(() => {
    const m: Record<string, any> = {};
    for (const i of (state as any).inpcs ?? []) m[i.id] = i;
    return m;
  }, [(state as any).inpcs]);

  const { active, nextTurn, prevTurn } = useCombatNavigation({
    encounterId,
    orderedCombatants,
    canNavigate,
    started,
    round,
    activeId,
    setActiveId,
    setRound,
    persistCombatState
  });

  const secondsInRound = React.useMemo(() => {
    const alive = orderedCombatants.filter((c: any) => !(c as any).isDead);
    if (!activeId) return null;
    const idx = alive.findIndex((c: any) => (c as any).id === activeId);
    return idx >= 0 ? idx * 6 : null;
  }, [orderedCombatants, activeId]);

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
    dispatch
  });

  const activeAny: any = active as any;
  const targetAny: any = target as any;

  const activeCtx = React.useMemo(
    () => ({
      isNarrow,
      selectedMonster: applyMonsterAttackOverrides(activeMonster as any, activeAny),
      playerName:
        activeAny?.baseType === "player" ? (playersById[activeAny.baseId]?.playerName ?? null) : null,
      player: activeAny?.baseType === "player" ? (playersById[activeAny.baseId] ?? null) : null,
      spellNames: sortedActiveSpellNames,
      spellLevels: spellLevelCache,
      roster: orderedCombatants,
      activeForCaster: (active as Combatant | null) ?? null,
      showHpActions: false,

      onUpdate: (patch: any) => ((active as any)?.id ? updateCombatant((active as any).id, patch) : void 0),
      onOpenOverrides: () => onOpenOverrides((active as any)?.id ?? null),
      onOpenConditions: () =>
        onOpenConditions((active as any)?.id ?? null, "active", (active as any)?.id ?? null),
      onOpenSpell: (name: string) => openSpellByName(name)
    }),
    [
      isNarrow,
      activeMonster,
      activeAny?.baseType,
      activeAny?.baseId,
      playersById,
      sortedActiveSpellNames,
      spellLevelCache,
      orderedCombatants,
      active,
      updateCombatant,
      onOpenOverrides,
      onOpenConditions,
      openSpellByName
    ]
  );

  const targetCtx = React.useMemo(
    () => ({
      isNarrow,
      selectedMonster: applyMonsterAttackOverrides(targetMonster as any, targetAny),
      playerName:
        targetAny?.baseType === "player" ? (playersById[targetAny.baseId]?.playerName ?? null) : null,
      player: targetAny?.baseType === "player" ? (playersById[targetAny.baseId] ?? null) : null,
      spellNames: sortedTargetSpellNames,
      spellLevels: spellLevelCache,
      roster: orderedCombatants,
      activeForCaster: (active as Combatant | null) ?? null,
      showHpActions: true,

      delta,
      onDeltaChange: (v: string) => setDelta(v.replace(/[^0-9]/g, "")),
      onDamage: () => applyHpDelta("damage"),
      onHeal: () => applyHpDelta("heal"),

      onUpdate: (patch: any) => ((target as any)?.id ? updateCombatant((target as any).id, patch) : void 0),
      onOpenOverrides: () => onOpenOverrides((target as any)?.id ?? null),
      onOpenConditions: () =>
        onOpenConditions((target as any)?.id ?? null, "target", (active as any)?.id ?? null),
      onOpenSpell: (name: string) => openSpellByName(name)
    }),
    [
      isNarrow,
      targetMonster,
      targetAny?.baseType,
      targetAny?.baseId,
      playersById,
      sortedTargetSpellNames,
      spellLevelCache,
      orderedCombatants,
      active,
      target,
      delta,
      setDelta,
      applyHpDelta,
      updateCombatant,
      onOpenOverrides,
      onOpenConditions,
      openSpellByName
    ]
  );

  return (
    <div style={{ padding: "var(--space-page)" }}>
      <CombatantHeader
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
          gridTemplateColumns: isNarrow  ? "1fr" : "minmax(0, 6fr) minmax(0, 5fr) minmax(0, 6fr)",

          gap: 14,
          alignItems: "start"
        }}
      >
        <CombatantDetailsPanel roleTitle="Active" role="active" combatant={active ?? null} ctx={activeCtx} />


        <CombatOrderPanel
          combatants={orderedCombatants}
          playersById={playersById}
          monsterCrById={monsterCrById}
          activeId={activeId}
          targetId={(target as any)?.id ?? null}
          onSelectTarget={(id) => setTargetId(id)}
          onSetInitiative={(id, initiative) => updateCombatant(id, { initiative })}
        />

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
