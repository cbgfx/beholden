import * as React from "react";
import { api } from "@/services/api";

type Props = {
  combatants: any[] | null;
  inpcs: any[];
  monsterDetails: Record<string, any> | undefined;
  dispatch: (action: any) => void;
};

/**
 * Ensures monster details exist in the store for any monsters referenced by roster combatants.
 * This is required for XP + difficulty calculations.
 */
export function useEnsureRosterMonsterDetails(props: Props) {
  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const cs: any[] = props.combatants ?? [];

      // Collect monster ids referenced by combatants.
      const monsterIds = new Set<string>();
      for (const c of cs) {
        if (c?.baseType === "monster" && c.baseId != null) monsterIds.add(String(c.baseId));
        if (c?.baseType === "inpc" && c.baseId != null) {
          const inpcId = String(c.baseId);
          const inpc = (props.inpcs ?? []).find((x: any) => String(x.id) === inpcId);
          if (inpc?.monsterId != null) monsterIds.add(String(inpc.monsterId));
        }
      }

      const missing = Array.from(monsterIds).filter((id) => !(props.monsterDetails && (props.monsterDetails as any)[id]));
      if (!missing.length) return;

      const patch: Record<string, any> = {};
      for (const id of missing) {
        try {
          patch[id] = await api(`/api/compendium/monsters/${id}`);
        } catch {
          // ignore fetch failures; XP will just be unavailable
        }
      }

      if (cancelled) return;
      if (Object.keys(patch).length) props.dispatch({ type: "mergeMonsterDetails", patch });
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [props.combatants, props.dispatch, props.inpcs, props.monsterDetails]);
}
