import React from "react";
import type { Combatant } from "@/domain/types/domain";
import type { CombatantDetailsCtx } from "@/views/CombatView/panels/CombatantDetailsPanel/CombatantDetailsPanel";
import { useCharacterSheetStats } from "./useCharacterSheetStats";
import { useCombatantConditions } from "./useCombatantConditions";

// Re-export so existing callers of this module don't break.
export type { ConditionInstance, ConditionDef } from "@/domain/conditions";

type Role = "active" | "target";

function norm(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

export function useCombatantDetailsModel(args: {
  roleTitle: string;
  role: Role;
  combatant: Combatant | null;
  ctx: CombatantDetailsCtx;
}) {
  const { role, combatant, ctx } = args;

  const selected = combatant ?? null;
  const isMonster =
    selected?.baseType === "monster" ||
    (selected?.baseType === "inpc" && !!ctx.selectedMonster);
  const isPlayer = selected?.baseType === "player";

  const titleMain = selected
    ? selected.label || selected.name || "(Unnamed)"
    : "No selection";
  const monsterBaseName = isMonster ? selected!.name.trim() : "";
  const showMonsterBaseName =
    isMonster && monsterBaseName && norm(monsterBaseName) !== norm(titleMain);

  const displayName = React.useCallback((c: Combatant | null) => {
    if (!c) return "—";
    return c.label || c.name || "Combatant";
  }, []);

  const sheetStats = useCharacterSheetStats({
    combatant: selected,
    selectedMonster: ctx.selectedMonster,
    player: ctx.player,
  });

  const conditions = useCombatantConditions({
    selected,
    role,
    roster: ctx.roster ?? [],
    onUpdate: ctx.onUpdate,
  });

  return {
    selected,
    isMonster,
    isPlayer,
    titleMain,
    monsterBaseName,
    showMonsterBaseName,
    displayName,
    sheetStats,
    ...conditions,
  };
}
