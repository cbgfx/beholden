import * as React from "react";

import { getMonsterXp } from "@/domain/utils/xp";
import { calcEncounterDifficulty, estimateMonsterDpr } from "@/domain/utils/difficulty";
import type { Combatant, INpc, Player } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";

type Props = {
  combatants: Combatant[];
  inpcs: INpc[];
  monsterDetails: Record<string, MonsterDetail>;
  players: Player[];
};

/** Parse a CR value from a MonsterDetail — mirrors parseCrToNumberOrNull in difficulty.ts */
function parseCrFromDetail(detail: MonsterDetail): number | null {
  const raw = (detail as any).cr ?? (detail as any).raw_json?.cr ?? (detail as any).raw_json?.challenge_rating;
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).trim();
  const frac = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (frac?.[1] && frac?.[2]) {
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
  }
  const num = s.match(/-?\d+(?:\.\d+)?/);
  if (num?.[0]) {
    const n = Number(num[0]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

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
    const partyHpMax = props.players.reduce((sum, p) => sum + (p.hpMax ?? 0), 0);

    let hostileDpr = 0;
    let burstFactor = 1.0;
    let monsterCount = 0;
    let maxMonsterCr = 0;

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

      monsterCount += 1;

      const detail = props.monsterDetails[monsterId];
      const est = estimateMonsterDpr(detail);
      if (est?.dpr != null && Number.isFinite(est.dpr)) hostileDpr += Math.max(0, est.dpr);
      if (est?.burstFactor != null && Number.isFinite(est.burstFactor)) burstFactor = Math.max(burstFactor, est.burstFactor);

      const cr = detail ? parseCrFromDetail(detail) : null;
      if (cr != null && cr > maxMonsterCr) maxMonsterCr = cr;
    }

    const playerLevels = props.players.map((p) => Number(p.level ?? 1)).filter((n) => Number.isFinite(n) && n > 0);
    return calcEncounterDifficulty({
      partyHpMax,
      hostileDpr,
      burstFactor,
      totalXp,
      playerLevels,
      monsterCount,
      maxMonsterCr,
    });
  }, [props.combatants, props.inpcs, props.monsterDetails, props.players, totalXp]);

  return { xpByCombatantId, totalXp, difficulty };
}
