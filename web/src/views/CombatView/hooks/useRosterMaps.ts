import * as React from "react";

type ById<T> = Record<string, T>;

/**
 * Small derived-data helper for CombatView.
 * Keeps CombatView lean while making data-flow explicit.
 */
export function useRosterMaps(players: any[], inpcs: any[] | undefined) {
  const playersById = React.useMemo<ById<any>>(() => {
    const m: ById<any> = {};
    for (const p of players ?? []) m[p.id] = p;
    return m;
  }, [players]);

  const inpcsById = React.useMemo<ById<any>>(() => {
    const m: ById<any> = {};
    for (const i of inpcs ?? []) m[i.id] = i;
    return m;
  }, [inpcs]);

  return { playersById, inpcsById };
}
