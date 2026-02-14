import * as React from "react";

import { getMonsterXp } from "@/domain/utils/xp";
import { calcEncounterDifficulty, estimateMonsterDpr } from "@/domain/utils/difficulty";

type Props = {
  combatants: any[] | null;
  inpcs: any[];
  monsterDetails: Record<string, any> | undefined;
  players: any[];
};

export function useRosterMetrics(props: Props) {
  const xpByCombatantId = React.useMemo(() => {
    const map: Record<string, number> = {};
    const cs: any[] = props.combatants ?? [];
    for (const c of cs) {
      if (!c?.id) continue;
      let monsterId: string | null = null;
      if (c.baseType === "monster") monsterId = c.baseId != null ? String(c.baseId) : null;
      if (c.baseType === "inpc") {
        const inpcId = c.baseId != null ? String(c.baseId) : null;
        const inpc = inpcId ? (props.inpcs ?? []).find((x: any) => String(x.id) === inpcId) : null;
        monsterId = inpc?.monsterId != null ? String(inpc.monsterId) : null;
      }
      if (!monsterId) continue;
      const xp = getMonsterXp((props.monsterDetails as any)?.[monsterId]);
      if (xp != null) map[String(c.id)] = xp;
    }
    return map;
  }, [props.combatants, props.inpcs, props.monsterDetails]);

  const totalXp = React.useMemo(() => {
    let total = 0;
    const cs: any[] = props.combatants ?? [];
    for (const c of cs) {
      if (c?.baseType === "player") continue;
      if (c?.friendly) continue; // Friendly monsters do not count.
      const xp = xpByCombatantId[String(c.id)];
      if (typeof xp === "number" && Number.isFinite(xp)) total += xp;
    }
    return total;
  }, [props.combatants, xpByCombatantId]);

  const difficulty = React.useMemo(() => {
    const partyHpMax = (props.players ?? []).reduce(
      (sum: number, p: any) => sum + (typeof p?.hpMax === "number" ? p.hpMax : 0),
      0
    );

    let hostileDpr = 0;
    let burstFactor = 1.0;
    const cs: any[] = props.combatants ?? [];

    for (const c of cs) {
      if (c?.baseType === "player") continue;
      if (c?.friendly) continue;

      let monsterId: string | null = null;
      if (c.baseType === "monster") monsterId = c.baseId != null ? String(c.baseId) : null;
      if (c.baseType === "inpc") {
        const inpcId = c.baseId != null ? String(c.baseId) : null;
        const inpc = inpcId ? (props.inpcs ?? []).find((x: any) => String(x.id) === inpcId) : null;
        monsterId = inpc?.monsterId != null ? String(inpc.monsterId) : null;
      }
      if (!monsterId) continue;

      const est = estimateMonsterDpr((props.monsterDetails as any)?.[monsterId]);
      if (est?.dpr != null && Number.isFinite(est.dpr)) hostileDpr += Math.max(0, est.dpr);
      if (est?.burstFactor != null && Number.isFinite(est.burstFactor)) burstFactor = Math.max(burstFactor, est.burstFactor);
    }

    return calcEncounterDifficulty({ partyHpMax, hostileDpr, burstFactor });
  }, [props.combatants, props.inpcs, props.monsterDetails, props.players]);

  return { xpByCombatantId, totalXp, difficulty };
}
