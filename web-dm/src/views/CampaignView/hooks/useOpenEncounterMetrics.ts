import * as React from "react";
import { api } from "@/services/api";
import { getMonsterXp } from "@/domain/utils/xp";
import { calcEncounterDifficulty } from "@/domain/utils/difficulty";
import { estimateMonsterDpr } from "@/domain/utils/monsterDpr";
import type { Action } from "@/store/actions";
import type { Player, INpc } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";

type DifficultyRow = {
  label: string;
  rtk: number;
  partyHpMax: number;
  hostileDpr: number;
  burstFactor: number;
};

type EncounterLike = { id: string; name: string; status: string };

export function useOpenEncounterMetrics(args: {
  encounters: EncounterLike[];
  players: Player[];
  inpcs: INpc[];
  monsterDetails: Record<string, MonsterDetail>;
  dispatch: (action: Action) => void;
}) {
  const { encounters, players, inpcs, monsterDetails, dispatch } = args;

  // Open encounters show XP (hostile monsters only) next to the status label.
  const [encounterXp, setEncounterXp] = React.useState<Record<string, number>>(
    {},
  );
  const [encounterDifficulty, setEncounterDifficulty] = React.useState<
    Record<string, DifficultyRow>
  >({});

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const openIds = (encounters ?? [])
        .filter((e) => String(e.status).toLowerCase() === "open")
        .map((e) => e.id);

      const toFetch = openIds.filter(
        (id) => encounterXp[id] == null || encounterDifficulty[id] == null,
      );
      if (!toFetch.length) return;

      const nextXp: Record<string, number> = {};
      const nextDiff: Record<string, DifficultyRow> = {};

const partyHpMax = players.reduce((sum, p) => sum + (p.hpMax ?? 0), 0);

      for (const encId of toFetch) {
        try {
          const cs: any[] = await api(`/api/encounters/${encId}/combatants`);

          // Ensure we have monster details for referenced monsters.
          const monsterIds = new Set<string>();
          for (const c of cs ?? []) {
            if (c?.baseType === "monster" && c.baseId != null)
              monsterIds.add(String(c.baseId));
            if (c?.baseType === "inpc" && c.baseId != null) {
              const inpcId = String(c.baseId);
const inpc = inpcs.find((x) => String(x.id) === inpcId);
              if (inpc?.monsterId != null)
                monsterIds.add(String(inpc.monsterId));
            }
          }

const missing = Array.from(monsterIds).filter((id) => !monsterDetails?.[id]);
          const patch: Record<string, MonsterDetail> = {};
          if (missing.length) {
            for (const id of missing) {
              try {
                patch[id] = await api(`/api/compendium/monsters/${id}`);
              } catch {
                // ignore
              }
            }
            if (!cancelled && Object.keys(patch).length)
              dispatch({ type: "mergeMonsterDetails", patch });
          }

          const details = { ...monsterDetails, ...patch };

          // Compute hostile XP + planning DPR.
          let total = 0;
          let hostileDpr = 0;
          let burstFactor = 1.0;

          for (const c of cs ?? []) {
            if (c?.baseType === "player") continue;
            if (c?.friendly) continue;

            let monsterId: string | null = null;
            if (c?.baseType === "monster")
              monsterId = c.baseId != null ? String(c.baseId) : null;
            if (c?.baseType === "inpc") {
              const inpcId = c.baseId != null ? String(c.baseId) : null;
              const inpc = inpcId
                ? (inpcs ?? []).find((x: any) => String(x.id) === inpcId)
                : null;
              monsterId =
                inpc?.monsterId != null ? String(inpc.monsterId) : null;
            }
            if (!monsterId) continue;

            const xp = getMonsterXp(details?.[monsterId]);
            if (xp != null && Number.isFinite(xp)) total += xp;

            const est = estimateMonsterDpr(details?.[monsterId]);
            if (est?.dpr != null && Number.isFinite(est.dpr))
              hostileDpr += Math.max(0, est.dpr);
            if (est?.burstFactor != null && Number.isFinite(est.burstFactor))
              burstFactor = Math.max(burstFactor, est.burstFactor);
          }

          nextXp[encId] = Math.max(0, Math.round(total));

          const diff = calcEncounterDifficulty({
            partyHpMax,
            hostileDpr,
            burstFactor,
          });
          nextDiff[encId] = {
            label: diff.label,
            rtk: diff.roundsToTpk,
            partyHpMax: diff.partyHpMax,
            hostileDpr: diff.hostileDpr,
            burstFactor: diff.burstFactor,
          };
        } catch {
          // ignore
        }
      }

      if (cancelled) return;
      if (Object.keys(nextXp).length)
        setEncounterXp((prev) => ({ ...prev, ...nextXp }));
      if (Object.keys(nextDiff).length)
        setEncounterDifficulty((prev) => ({ ...prev, ...nextDiff }));
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    dispatch,
    encounterDifficulty,
    encounterXp,
    encounters,
    inpcs,
    monsterDetails,
    players,
  ]);

  const encountersForPanel = React.useMemo(() => {
    return (encounters ?? []).map((e) => {
      const status = String(e.status ?? "");
      const isOpen = status.toLowerCase() === "open";
      const xp = encounterXp[e.id];
      const diff = encounterDifficulty[e.id];

      const parts: string[] = [status];
      if (isOpen) {
        if (typeof xp === "number" && Number.isFinite(xp) && xp > 0)
          parts.push(`${xp.toLocaleString()} XP`);
        if (diff?.label) parts.push(diff.label);
      }

      return {
        id: e.id,
        name: e.name,
        status: isOpen && parts.length > 1 ? parts.join(" • ") : status,
      };
    });
  }, [encounterDifficulty, encounterXp, encounters]);

  return { encountersForPanel };
}
