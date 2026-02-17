import * as React from "react";
import type { Combatant } from "@/domain/types/domain";

type Role = "active" | "target";

type Args = {
  isNarrow: boolean;
  role: Role;
  combatant: Combatant | null;
  combatantAny: any;

  selectedMonster: any;
  playersById: Record<string, any>;

  spellNames: string[];
  spellLevels: Record<string, number>;
  roster: Combatant[];
  activeForCaster: Combatant | null;

  updateCombatant: (id: string, patch: any) => void;
  onOpenOverrides: (combatantId: string | null) => void;
  onOpenConditions: (combatantId: string | null, role: Role, casterId: string | null) => void;
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
        args.combatantAny?.baseType === "player"
          ? (args.playersById[args.combatantAny.baseId]?.playerName ?? null)
          : null,
      player:
        args.combatantAny?.baseType === "player" ? (args.playersById[args.combatantAny.baseId] ?? null) : null,

      spellNames: args.spellNames,
      spellLevels: args.spellLevels,
      roster: args.roster,
      activeForCaster: args.activeForCaster,
      showHpActions: false,

      onUpdate: (patch: any) => (args.combatant?.id ? args.updateCombatant(args.combatant.id, patch) : void 0),
      onOpenOverrides: () => args.onOpenOverrides(args.combatant?.id ?? null),
      onOpenConditions: () =>
        args.onOpenConditions(
          args.combatant?.id ?? null,
          args.role,
          args.role === "active" ? (args.combatant?.id ?? null) : (args.casterIdForTarget ?? null)
        ),
      onOpenSpell: (name: string) => args.openSpellByName(name)
    }),
    [
      args.isNarrow,
      args.selectedMonster,
      args.combatantAny?.baseType,
      args.combatantAny?.baseId,
      args.playersById,
      args.spellNames,
      args.spellLevels,
      args.roster,
      args.activeForCaster,
      args.combatant?.id,
      args.updateCombatant,
      args.onOpenOverrides,
      args.onOpenConditions,
      args.openSpellByName,
      args.role,
      args.casterIdForTarget
    ]
  );
}
