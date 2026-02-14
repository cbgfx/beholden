export type CombatantVM = {
  id: string;
  label: string;
  baseType: "player" | "monster" | "inpc";
  friendly?: boolean; // only meaningful for monsters
  hpMax?: number;
  hpCurrent?: number;
  xp?: number;
};

// Map raw combatants -> VM used by the EncounterRosterPanel
export function mapCombatantsToVM(
  combatants: any[],
  xpByCombatantId?: Record<string, number>
): CombatantVM[] {
  return (combatants ?? []).map((c: any) => {
    // API payloads use baseType: "player" | "monster" | "inpc"
    const baseType: CombatantVM["baseType"] =
      c.baseType === "inpc" ? "inpc" : c.baseType === "player" ? "player" : "monster";

    const id = String(c.id);

    return {
      id,
      label: c.label ?? c.characterName ?? c.name ?? "Combatant",
      baseType,
      friendly: Boolean(c.friendly),
      hpMax: typeof c.hpMax === "number" ? c.hpMax : undefined,
      hpCurrent: typeof c.hpCurrent === "number" ? c.hpCurrent : undefined,
      xp: xpByCombatantId ? xpByCombatantId[id] : undefined
    };
  });
}

export function formatCombatantMeta(c: CombatantVM): string {
  const isPlayer = c.baseType === "player";
  const hpPart = c.hpCurrent != null && c.hpMax != null ? `HP ${c.hpCurrent}/${c.hpMax}` : "";
  const xpPart =
    !isPlayer && c.xp != null && Number.isFinite(c.xp)
      ? `${Math.round(c.xp).toLocaleString()} XP`
      : "";

  return [hpPart, xpPart].filter(Boolean).join(" • ");
}
