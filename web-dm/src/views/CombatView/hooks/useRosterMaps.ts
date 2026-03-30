import * as React from "react";
import type { INpc, Player } from "@/domain/types/domain";

type ById<T> = Record<string, T>;

/**
 * Small derived-data helper for CombatView.
 * Keeps CombatView lean while making data-flow explicit.
 */
export function useRosterMaps(players: Player[], inpcs: INpc[] | undefined) {
  const playersById = React.useMemo<ById<Player>>(() => {
    const m: ById<Player> = {};
    for (const p of players ?? []) m[p.id] = p;
    return m;
  }, [players]);

  const inpcsById = React.useMemo<ById<INpc>>(() => {
    const m: ById<INpc> = {};
    for (const i of inpcs ?? []) m[i.id] = i;
    return m;
  }, [inpcs]);

  return { playersById, inpcsById };
}
