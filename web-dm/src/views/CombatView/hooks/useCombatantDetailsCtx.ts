import * as React from "react";
import type { AttackOverride, Combatant, Player } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";

type Role = "active" | "target";

type Args = {
  isNarrow: boolean;
  role: Role;
  combatant: Combatant | null;
  selectedMonster: MonsterDetail | null;
  playersById: Record<string, Player>;

  spellNames: string[];
// spell levels are resolved async; unknown levels may be null until fetched
spellLevels: Record<string, number | null>;

  roster: Combatant[];
  activeForCaster: Combatant | null;
  currentRound: number;

  updateCombatant: (id: string, patch: Record<string, unknown>) => void;
  onOpenOverrides: (combatantId: string | null) => void;
  onOpenConditions: (combatantId: string | null, role: Role, casterId: string | null) => void;
  onOpenPolymorph: (combatantId: string | null, combatantName: string) => void;
  openSpellByName: (name: string) => void;

  /** For target role only: caster id should be the active combatant id (if present). */
  casterIdForTarget?: string | null;
};

/**
 * Builds the ctx object consumed by CombatantDetailsPanel.
 * This is a pure memoized adapter to keep CombatView slim.
 */
export function useCombatantDetailsCtx(args: Args) {
  return React.useMemo(
    () => ({
      isNarrow: args.isNarrow,
      selectedMonster: args.selectedMonster,
      playerName:
        args.combatant?.baseType === "player"
          ? (args.playersById[args.combatant.baseId]?.playerName ?? null)
          : null,
      player:
        args.combatant?.baseType === "player" ? (args.playersById[args.combatant.baseId] ?? null) : null,

      spellNames: args.spellNames,
      spellLevels: args.spellLevels,
      roster: args.roster,
      activeForCaster: args.activeForCaster,
      currentRound: args.currentRound,
      showHpActions: false,

      onUpdate: (patch: Record<string, unknown>) => (args.combatant?.id ? args.updateCombatant(args.combatant.id, patch) : void 0),
      onChangeAttack: (actionName: string, patch: AttackOverride) => {
        if (!args.combatant?.id) return;
        const existing = (args.combatant.attackOverrides as Record<string, AttackOverride> | null) ?? {};
        const next = { ...existing, [actionName]: { ...(existing[actionName] ?? {}), ...patch } };
        args.updateCombatant(args.combatant.id, { attackOverrides: next });
      },
      onOpenOverrides: () => args.onOpenOverrides(args.combatant?.id ?? null),
      onOpenConditions: () =>
        args.onOpenConditions(
          args.combatant?.id ?? null,
          args.role,
          args.role === "active" ? (args.combatant?.id ?? null) : (args.casterIdForTarget ?? null)
        ),
      onOpenPolymorph: () =>
        args.onOpenPolymorph(
          args.combatant?.id ?? null,
          args.combatant?.label || args.combatant?.name || "Combatant"
        ),
      onOpenSpell: (name: string) => args.openSpellByName(name)
    }),
    [
      args.isNarrow,
      args.selectedMonster,
      args.combatant?.baseType,
      args.combatant?.baseId,
      args.playersById,
      args.spellNames,
      args.spellLevels,
      args.roster,
      args.activeForCaster,
      args.currentRound,
      args.combatant?.id,
      args.updateCombatant,
      args.onOpenOverrides,
      args.onOpenConditions,
      args.onOpenPolymorph,
      args.openSpellByName,
      args.combatant?.attackOverrides,
      args.role,
      args.casterIdForTarget
    ]
  );
}
