import * as React from "react";
import { api } from "@/services/api";
import type { Combatant, INpc } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";
import type { Action } from "@/store/actions";

type Props = {
  combatants: Combatant[];
  inpcs: INpc[];
  monsterDetails: Record<string, MonsterDetail>;
  dispatch: (action: Action) => void;
};

/**
 * Ensures monster details exist in the store for any monsters referenced by roster combatants.
 * Fetches all missing details in parallel rather than serially.
 */
export function useEnsureRosterMonsterDetails(props: Props) {
  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const monsterIds = new Set<string>();
      for (const c of props.combatants) {
        if (c?.baseType === "monster" && c.baseId != null) monsterIds.add(String(c.baseId));
        if (c?.baseType === "inpc" && c.baseId != null) {
          const inpc = props.inpcs.find((x) => String(x.id) === String(c.baseId));
          if (inpc?.monsterId != null) monsterIds.add(String(inpc.monsterId));
        }
      }

      const missing = Array.from(monsterIds).filter((id) => !props.monsterDetails[id]);
      if (!missing.length) return;

      // Fetch all missing details in parallel — was sequential before.
      const results = await Promise.allSettled(
        missing.map((id) =>
          api<MonsterDetail>(`/api/compendium/monsters/${id}`).then((d) => ({ id, d }))
        )
      );

      if (cancelled) return;

      const patch: Record<string, MonsterDetail> = {};
      for (const r of results) {
        if (r.status === "fulfilled") patch[r.value.id] = r.value.d;
        // rejected: ignore — XP/difficulty just won't show for that monster
      }
      if (Object.keys(patch).length) props.dispatch({ type: "mergeMonsterDetails", patch });
    };

    run();
    return () => { cancelled = true; };
  }, [props.combatants, props.dispatch, props.inpcs, props.monsterDetails]);
}
