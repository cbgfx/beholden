import * as React from "react";
import { useParams } from "react-router-dom";
import { useStore } from "@/store";
import type { Combatant } from "@/domain/types/domain";

import { CombatHeader } from "@/views/CombatView/components/CombatHeader";
import { CombatDeltaControls } from "@/views/CombatView/components/CombatDeltaControls";
import { SpellDetailModal } from "@/views/CombatView/components/SpellDetailModal";
import { InitiativePanel } from "@/views/CombatView/panels/InitiativePanel";
import { CombatantDetailsPanel } from "@/views/CombatView/panels/CombatantDetailsPanel/CombatantDetailsPanel";

import { useIsNarrow } from "@/views/CombatView/hooks/useIsNarrow";
import { useServerCombatState } from "@/views/CombatView/hooks/useServerCombatState";
import { useMonsterDetailsCache } from "@/views/CombatView/hooks/useMonsterDetailsCache";
import { useSpellModal } from "@/views/CombatView/hooks/useSpellModal";
import { useCombatNavigation } from "@/views/CombatView/hooks/useCombatNavigation";
import { useCombatActions } from "@/views/CombatView/hooks/useCombatActions";
import { api } from "@/services/api";
import { allHaveInitiative, orderCombatants } from "@/views/CombatView/utils/combat";
import { applyMonsterAttackOverrides } from "@/views/CombatView/utils/monsterOverrides";
import { getSecondsInRound } from "@/views/CombatView/utils/roundTime";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import {
  IconPlayer,
  IconMonster,
  IconPerson,
  IconSkull,
  IconTargeted
} from "@/icons";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function getHudNames(c: any, playersById: Record<string, any>) {
  if (!c) return { primary: "—", secondary: null as string | null };

  const baseType = String(c.baseType ?? c.type ?? "");
  const baseName = (c.name ?? "").toString().trim();
  const label = (c.label ?? baseName ?? "").toString().trim();

  if (baseType === "player") {
    const p = playersById?.[c.baseId];
    const playerName = (p?.playerName ?? "").toString().trim();
    return { primary: label || "—", secondary: playerName ? `(${playerName})` : null };
  }

  // Monster / iNPC: show Label (BaseName) when label differs from base name
  if (baseName && label && baseName.toLowerCase() !== label.toLowerCase()) {
    return { primary: label, secondary: `(${baseName})` };
  }

  return { primary: label || baseName || "—", secondary: null };
}

function getHudHp(c: any) {
  const hpCurrent = Number(c?.hpCurrent ?? 0) || 0;
  const baseHpMax = Number(c?.hpMax ?? 0) || 0;
  const hpMaxOverride = Number(c?.overrides?.hpMaxOverride ?? 0) || 0;
  const hpMax = hpMaxOverride > 0 ? hpMaxOverride : baseHpMax;
  const tempHp = Math.max(0, Number(c?.overrides?.tempHp ?? 0) || 0);
  return { hpCurrent, hpMax: Math.max(1, hpMax || 1), tempHp };
}

export function CombatView() {
  const { campaignId, encounterId } = useParams();
  const { state, dispatch } = useStore();

  const encounter = React.useMemo(() => {
    if (!encounterId) return null as any;
    return (state as any).encounters?.find((e: any) => e.id === encounterId) ?? null;
  }, [encounterId, (state as any).encounters]);

  // Combat View should use the store as the single source of truth.
  // (This fixes drawers updating store state but not a local duplicate roster.)
  const combatants = (state.combatants ?? []) as Combatant[];

  const refresh = React.useCallback(async () => {
    if (!encounterId) return;
    const rows = await api<Combatant[]>(`/api/encounters/${encounterId}/combatants`);
    dispatch({ type: "setCombatants", combatants: rows });
  }, [encounterId, dispatch]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const {
    round,
    setRound,
    activeId,
    setActiveId,
    started,
    persist: persistCombatState,
  } = useServerCombatState(encounterId);

  const [targetId, setTargetId] = React.useState<string | null>(null);

  // Stable callbacks so initiative rows can be memoized without thrashing.
  const handleSelectTarget = React.useCallback((id: string) => setTargetId(id), []);

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

  const renderCombatantIcon = React.useCallback((c: any) => {
    if (!c) return null;
    const isDead = Number(c.hpCurrent) <= 0;
    if (isDead) return <IconSkull size={16} title="Dead" />;

    const bt = (c.baseType ?? c.type ?? "").toString();
    if (bt === "player") return <IconPlayer size={16} title="Player" />;
    if (bt === "inpc") return <IconPerson size={16} title="Important NPC" />;
    return <IconMonster size={16} title="Monster" />;
  }, []);

  const onOpenConditionsFromDelta = React.useCallback(() => {
    if (!activeAny?.id || !targetAny?.id) return;
    const role = targetAny.id === activeAny.id ? "active" : "target";
    onOpenConditions(targetAny.id, role, activeAny.id);
  }, [activeAny?.id, targetAny?.id, onOpenConditions]);

  const renderHudFighter = React.useCallback(
    (c: any, role: "active" | "target") => {
      const names = getHudNames(c, playersById);
      const { hpCurrent, hpMax, tempHp } = getHudHp(c);

      const hpPct = clamp01(hpCurrent / hpMax);
      const tempPct = clamp01(tempHp / hpMax);

      // HUD HP color cues: green -> orange (<= 1/2) -> red (<= 1/4)
      const hpFill = hpPct <= 0.25 ? theme.colors.red : hpPct <= 0.5 ? theme.colors.bloody : theme.colors.green;

      const isSelfTarget =
        role === "target" &&
        targetAny?.id != null &&
        activeAny?.id != null &&
        String(targetAny.id) === String(activeAny.id);

      const roleAccent = role === "active" ? theme.colors.accent : theme.colors.blue;
      const roleLabel = isSelfTarget ? "SELF" : role === "active" ? "ACTIVE" : "TARGET";

      // Accent used for the HUD portrait hex backing (match PlayerRow / combat icon coloring).
      const portraitAccent = !c
        ? theme.colors.muted
        : c.isDead
          ? theme.colors.muted
          : c.baseType === "player"
            ? theme.colors.blue
            : (c.color || (c.friendly ? theme.colors.green : theme.colors.red));

      // Fighting-game style: HP + optional temp overlay segment.
      const tempLeft = clamp01(hpPct);
      const tempWidth = clamp01(Math.min(tempPct, 1 - tempLeft));

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "12px 14px",
            borderRadius: 16,
            border: `1px solid ${roleAccent}`,
            background: theme.colors.panelBg,
            boxShadow: `0 0 0 2px rgba(0,0,0,0.18), 0 10px 26px rgba(0,0,0,0.30)`,
            minWidth: 360
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {/* Icon + hex backing for extra oomph */}
            <div style={{ position: "relative", width: 48, height: 48, flex: "0 0 auto" }}>
              <svg
                width={48}
                height={48}
                viewBox="0 0 100 100"
                style={{
                  position: "absolute",
                  inset: 0,
                  filter: `drop-shadow(0 2px 6px rgba(0,0,0,0.35)) drop-shadow(0 0 12px ${portraitAccent}22)`
                }}
                aria-hidden
              >
                <polygon
                  points="50 4, 91 27, 91 73, 50 96, 9 73, 9 27"
                  fill={`${portraitAccent}22`}
                  stroke={`${portraitAccent}CC`}
                  strokeWidth="5"
                  strokeLinejoin="round"
                />
              </svg>

              <div
                style={{
                  width: 48,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: "scale(2.15)",
                  transformOrigin: "center",
                  color: portraitAccent
                }}
              >
                {renderCombatantIcon(c)}
              </div>
            </div>

            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontWeight: 900,
                    letterSpacing: 0.6,
                    fontSize: "var(--fs-tiny)",
                    color: "#0b0e13",
                    background: roleAccent,
                    border: `1px solid rgba(0,0,0,0.35)`,
                    boxShadow: `0 8px 18px rgba(0,0,0,0.35)`
                  }}
                  title={role === "active" ? "Active" : isSelfTarget ? "Self target" : "Target"}
                >
                  {roleLabel}
                </span>
              </div>
              <div
                title={names.primary}
                style={{
                  color: theme.colors.text,
                  fontWeight: 900,
                  fontSize: "calc(var(--fs-title) + 8px)",
                  lineHeight: "34px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 420
                }}
              >
                {names.primary} &nbsp;        
                {names.secondary ? (
                <span
                  title={names.secondary}
                  style={{
                    color: theme.colors.muted,
                    fontWeight: 900,
                    fontSize: "var(--fs-base)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 420
                  }}
                >
                  {names.secondary}
                </span>
              ) : null}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                position: "relative",
                height: 10,
                borderRadius: 8,
                background: theme.colors.panelBorder,
                overflow: "hidden",
                flex: 1
              }}
              aria-label="HP"
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${Math.round(hpPct * 100)}%`,
                  background: hpFill,
                  transition: "width 150ms ease"
                }}
              />

              {tempWidth > 0 ? (
                <div
                  style={{
                    position: "absolute",
                    left: `${Math.round(tempLeft * 100)}%`,
                    top: 0,
                    bottom: 0,
                    width: `${Math.round(tempWidth * 100)}%`,
                    background: theme.colors.accent,
                    opacity: 0.55,
                    transition: "left 150ms ease, width 150ms ease"
                  }}
                  aria-label="Temp HP"
                />
              ) : null}
            </div>

            <div
              style={{
                color: theme.colors.muted,
                fontWeight: 900,
                fontSize: "var(--fs-base)",
                whiteSpace: "nowrap"
              }}
            >
              {Math.max(0, Math.floor(hpCurrent))} / {Math.max(1, Math.floor(hpMax))}
              {tempHp > 0 ? (
                <span style={{ color: theme.colors.accent, marginLeft: 6 }}>+{Math.floor(tempHp)}</span>
              ) : null}
            </div>
          </div>
        </div>
      );
    },
    [playersById, renderCombatantIcon, theme, activeAny?.id, targetAny?.id]
  );

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
      showHpActions: false,

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
      updateCombatant,
      onOpenOverrides,
      onOpenConditions,
      openSpellByName
    ]
  );

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
            {renderHudFighter(activeAny, "active")}

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

            {renderHudFighter(targetAny, "target")}
          </div>
        ) : null}

        <CombatantDetailsPanel roleTitle="Active" role="active" combatant={active ?? null} ctx={activeCtx} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Center-stage turn controls: Round + Prev/Next live above delta controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              paddingTop: 2
            }}
          >
            <span
              style={{
                fontSize: "var(--fs-pill)",
                fontWeight: 900,
                color: theme.colors.muted,
                border: `1px solid ${theme.colors.panelBorder}`,
                background: theme.colors.panelBg,
                padding: "4px 8px",
                borderRadius: 999
              }}
            >
              Round {round}
            </span>
            {typeof secondsInRound === "number" && (
              <span
                style={{
                  fontSize: "var(--fs-pill)",
                  fontWeight: 900,
                  color: theme.colors.muted,
                  border: `1px solid ${theme.colors.panelBorder}`,
                  background: theme.colors.panelBg,
                  padding: "4px 8px",
                  borderRadius: 999
                }}
              >
                {secondsInRound}s
              </span>
            )}

            <Button variant="ghost" onClick={prevTurn} disabled={!canNavigate}>
              Prev (p)
            </Button>
            <Button variant="ghost" onClick={nextTurn} disabled={!canNavigate}>
              Next (n)
            </Button>
          </div>

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
