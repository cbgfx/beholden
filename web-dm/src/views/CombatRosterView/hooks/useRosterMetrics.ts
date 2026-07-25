import * as React from "react";

import { getMonsterXp } from "@/domain/utils/xp";
import { calcEncounterDifficulty } from "@/domain/utils/difficulty";
import { estimateMonsterDpr, estimateMonsterEffectiveHp, estimatePartyDpr } from "@/domain/utils/monsterDpr";
import type { EncounterActor, INpc, CampaignCharacter } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";

type Props = {
  combatants: EncounterActor[];
  inpcs: INpc[];
  monsterDetails: Record<string, MonsterDetail>;
  players: CampaignCharacter[];
};

export function useRosterMetrics(props: Props) {
  const xpByCombatantId = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of props.combatants) {
      if (!c?.id) continue;
      let monsterId: string | null = null;
      if (c.baseType === "monster") monsterId = c.baseId != null ? String(c.baseId) : null;
      if (c.baseType === "inpc") {
        const inpcId = c.baseId != null ? String(c.baseId) : null;
        const inpc = inpcId ? props.inpcs.find((x) => String(x.id) === inpcId) : null;
        monsterId = inpc?.monsterId != null ? String(inpc.monsterId) : null;
      }
      if (!monsterId) continue;
      const xp = getMonsterXp(props.monsterDetails[monsterId]);
      if (xp != null) map[String(c.id)] = xp;
    }
    return map;
  }, [props.combatants, props.inpcs, props.monsterDetails]);

  const totalXp = React.useMemo(() => {
    let total = 0;
    for (const c of props.combatants) {
      if (c?.baseType === "player") continue;
      if (c?.friendly) continue; // Friendly monsters do not count.
      const xp = xpByCombatantId[String(c.id)];
      if (typeof xp === "number" && Number.isFinite(xp)) total += xp;
    }
    return total;
  }, [props.combatants, xpByCombatantId]);

  const difficulty = React.useMemo(() => {
    const encounterPlayerIds = new Set(props.combatants.filter((combatant) => combatant.baseType === "player").map((combatant) => String(combatant.baseId)));
    const encounterPlayers = props.players.filter((player) => encounterPlayerIds.has(String(player.id)));
    const partyHpMax = encounterPlayers.reduce((sum, player) => sum + (player.hpMax ?? 0), 0);
    const armorClasses = encounterPlayers.map((player) => Number(player.ac)).filter((ac) => Number.isFinite(ac) && ac > 0);

    let hostileDpr = 0;
    let projectedDpr = 0;
    let monsterEffectiveHp = 0;

    for (const c of props.combatants) {
      if (c?.baseType === "player") continue;
      if (c?.friendly) continue;

      let monsterId: string | null = null;
      if (c.baseType === "monster") monsterId = c.baseId != null ? String(c.baseId) : null;
      if (c.baseType === "inpc") {
        const inpcId = c.baseId != null ? String(c.baseId) : null;
        const inpc = inpcId ? props.inpcs.find((x) => String(x.id) === inpcId) : null;
        monsterId = inpc?.monsterId != null ? String(inpc.monsterId) : null;
      }
      if (!monsterId) continue;

      const detail = props.monsterDetails[monsterId];
      const est = estimateMonsterDpr(detail, { armorClasses, partySize: encounterPlayers.length });
      if (est?.dpr != null && Number.isFinite(est.dpr)) {
        const dpr = Math.max(0, est.dpr);
        hostileDpr += dpr;
        projectedDpr += dpr * Math.max(1, est.burstFactor);
      }
      monsterEffectiveHp += estimateMonsterEffectiveHp(detail);

    }

    const playerLevels = encounterPlayers.map((player) => Number(player.level ?? 1)).filter((level) => Number.isFinite(level) && level > 0);
    return calcEncounterDifficulty({
      partyHpMax,
      hostileDpr,
      projectedDpr,
      totalXp,
      playerLevels,
      partyHpValues: encounterPlayers.map((player) => Number(player.hpMax)).filter((hp) => Number.isFinite(hp) && hp > 0),
      monsterEffectiveHp,
      partyDpr: estimatePartyDpr(playerLevels),
    });
  }, [props.combatants, props.inpcs, props.monsterDetails, props.players, totalXp]);

  return { xpByCombatantId, totalXp, difficulty };
}
