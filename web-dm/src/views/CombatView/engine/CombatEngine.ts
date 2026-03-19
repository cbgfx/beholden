// web/src/views/CombatView/engine/CombatEngine.ts
// Pure combat navigation + ordering utilities.
// No React, no store, no IO.

export type TurnableCombatant = {
  id: string;
  initiative: number | null;
  label: string;
  name: string;
  baseType: "player" | "monster" | "inpc";
  hpCurrent: number | null;
};

export type CombatNavState = {
  round: number;
  activeId: string | null;
};

function initValue(i: number | null | undefined): number {
  if (i == null) return Number.NEGATIVE_INFINITY;
  const n = Number(i);
  return Number.isFinite(n) && n !== 0 ? n : Number.NEGATIVE_INFINITY;
}

export function allHaveInitiative(combatants: TurnableCombatant[]): boolean {
  if (!combatants.length) return false;
  return combatants.every((c) => {
    const n = initValue(c.initiative);
    return Number.isFinite(n) && n !== Number.NEGATIVE_INFINITY;
  });
}

export function orderByInitiative(combatants: TurnableCombatant[]): TurnableCombatant[] {
  const rows = [...combatants];
  rows.sort((a, b) => {
    const ai = initValue(a.initiative);
    const bi = initValue(b.initiative);
    if (bi !== ai) return bi - ai;
    const an = String(a.label || a.name || "");
    const bn = String(b.label || b.name || "");
    return an.localeCompare(bn);
  });
  return rows;
}

export function clampRound(n: number): number {
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(1, Math.floor(x)) : 1;
}

export function isSelectable(c: TurnableCombatant): boolean {
  // Monsters and iNPCs at 0 HP are dead and should be skipped.
  // Players at 0 HP are making death saves and must remain in turn order.
  if (c.baseType === "player") return true;
  const hp = Number(c.hpCurrent ?? 0);
  return Number.isFinite(hp) && hp > 0;
}

export function ensureActiveId(
  ordered: TurnableCombatant[],
  activeId: string | null,
): string | null {
  if (!ordered.length) return null;
  if (activeId && ordered.some((c) => c.id === activeId)) return activeId;
  const first = ordered.find(isSelectable) ?? ordered[0];
  return first?.id ?? null;
}

export function activeIndexOf(ordered: TurnableCombatant[], activeId: string | null): number {
  if (!ordered.length) return 0;
  if (!activeId) return 0;
  const idx = ordered.findIndex((c) => c.id === activeId);
  return idx >= 0 ? idx : 0;
}

export function nextTurn(
  ordered: TurnableCombatant[],
  state: CombatNavState,
): CombatNavState {
  if (!ordered.length) return { round: clampRound(state.round), activeId: null };
  if (!allHaveInitiative(ordered)) return { round: clampRound(state.round), activeId: ensureActiveId(ordered, state.activeId) };

  const round = clampRound(state.round);
  const startIdx = activeIndexOf(ordered, state.activeId);

  let nextIdx = startIdx;
  let nextRound = round;
  for (let i = 0; i < ordered.length; i++) {
    nextIdx += 1;
    if (nextIdx >= ordered.length) {
      nextIdx = 0;
      nextRound += 1;
    }
    const c = ordered[nextIdx];
    if (c && isSelectable(c)) {
      return { round: nextRound, activeId: c.id };
    }
  }

  return { round, activeId: ensureActiveId(ordered, state.activeId) };
}

export function prevTurn(
  ordered: TurnableCombatant[],
  state: CombatNavState,
): CombatNavState {
  if (!ordered.length) return { round: clampRound(state.round), activeId: null };
  if (!allHaveInitiative(ordered)) return { round: clampRound(state.round), activeId: ensureActiveId(ordered, state.activeId) };

  const round = clampRound(state.round);
  const startIdx = activeIndexOf(ordered, state.activeId);

  let nextIdx = startIdx;
  let nextRound = round;
  for (let i = 0; i < ordered.length; i++) {
    nextIdx -= 1;
    if (nextIdx < 0) {
      nextIdx = Math.max(0, ordered.length - 1);
      nextRound = Math.max(1, nextRound - 1);
    }
    const c = ordered[nextIdx];
    if (c && isSelectable(c)) {
      return { round: nextRound, activeId: c.id };
    }
  }

  return { round, activeId: ensureActiveId(ordered, state.activeId) };
}

export function initializeCombat(
  ordered: TurnableCombatant[],
): CombatNavState {
  const activeId = ensureActiveId(ordered, null);
  return { round: 1, activeId };
}
