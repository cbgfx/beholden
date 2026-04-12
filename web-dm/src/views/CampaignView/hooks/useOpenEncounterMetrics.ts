import * as React from "react";
import { api } from "@/services/api";
import { fetchEncounterActors } from "@/services/actorApi";
import { getMonsterXp } from "@/domain/utils/xp";
import { calcEncounterDifficulty } from "@/domain/utils/difficulty";
import { estimateMonsterDpr } from "@/domain/utils/monsterDpr";
import { parseCrToNumberOrNull } from "@/domain/utils/crParsing";
import type { Action } from "@/store/actions";
import type { CampaignCharacter, INpc } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";

type DifficultyRow = {
  label: string;
  rtk: number;
  partyHpMax: number;
  hostileDpr: number;
  burstFactor: number;
  adjustedXp: number;
};

type EncounterLike = { id: string; name: string; status: string };

function parseCrFromDetail(detail: MonsterDetail | null | undefined): number | null {
  if (!detail) return null;
  const raw = (detail as any).cr ?? (detail as any).raw_json?.cr ?? (detail as any).raw_json?.challenge_rating;
  return parseCrToNumberOrNull(raw);
}

export function useOpenEncounterMetrics(args: {
  encounters: EncounterLike[];
  players: CampaignCharacter[];
  inpcs: INpc[];
  monsterDetails: Record<string, MonsterDetail>;
  dispatch: (action: Action) => void;
}) {
  const { encounters, players, inpcs, monsterDetails, dispatch } = args;

  // All encounters show XP (hostile monsters only) and difficulty next to the status label.
  const [encounterXp, setEncounterXp] = React.useState<Record<string, number>>({});
  const [encounterDifficulty, setEncounterDifficulty] = React.useState<Record<string, DifficultyRow>>({});

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const encounterIds = (encounters ?? []).map((e) => e.id);
      const toFetch = encounterIds.filter(
        (id) => encounterXp[id] == null || encounterDifficulty[id] == null,
      );
      if (!toFetch.length) return;

      const nextXp: Record<string, number> = {};
      const nextDiff: Record<string, DifficultyRow> = {};
      const partyHpMax = players.reduce((sum, p) => sum + (p.hpMax ?? 0), 0);
      const playerLevels = players
        .map((p) => Number(p.level ?? 1))
        .filter((n) => Number.isFinite(n) && n > 0);

      for (const encId of toFetch) {
        try {
          const combatants = await fetchEncounterActors(encId);

          // Ensure we have monster details for referenced monsters.
          const monsterIds = new Set<string>();
          for (const combatant of combatants ?? []) {
            if (combatant?.baseType === "monster" && combatant.baseId != null) {
              monsterIds.add(String(combatant.baseId));
            }
            if (combatant?.baseType === "inpc" && combatant.baseId != null) {
              const inpcId = String(combatant.baseId);
              const inpc = inpcs.find((x) => String(x.id) === inpcId);
              if (inpc?.monsterId != null) {
                monsterIds.add(String(inpc.monsterId));
              }
            }
          }

          const missing = Array.from(monsterIds).filter((id) => !monsterDetails?.[id]);
          const patch: Record<string, MonsterDetail> = {};
          if (missing.length) {
            const results = await Promise.allSettled(
              missing.map((id) =>
                api<MonsterDetail>(`/api/compendium/monsters/${id}?view=metrics`).then((detail) => ({ id, detail })),
              ),
            );
            for (const result of results) {
              if (result.status !== "fulfilled") continue;
              patch[result.value.id] = result.value.detail;
            }
            if (!cancelled && Object.keys(patch).length) {
              dispatch({ type: "mergeMonsterDetails", patch });
            }
          }

          const details = { ...monsterDetails, ...patch };

          let totalXp = 0;
          let hostileDpr = 0;
          let burstFactor = 1.0;
          let monsterCount = 0;
          let maxMonsterCr = 0;

          for (const combatant of combatants ?? []) {
            if (combatant?.baseType === "player") continue;
            if (combatant?.friendly) continue;

            let monsterId: string | null = null;
            if (combatant?.baseType === "monster") {
              monsterId = combatant.baseId != null ? String(combatant.baseId) : null;
            }
            if (combatant?.baseType === "inpc") {
              const inpcId = combatant.baseId != null ? String(combatant.baseId) : null;
              const inpc = inpcId
                ? (inpcs ?? []).find((x: any) => String(x.id) === inpcId)
                : null;
              monsterId = inpc?.monsterId != null ? String(inpc.monsterId) : null;
            }
            if (!monsterId) continue;

            monsterCount += 1;

            const detail = details?.[monsterId];

            const xp = getMonsterXp(detail);
            if (xp != null && Number.isFinite(xp)) {
              totalXp += xp;
            }

            const estimate = estimateMonsterDpr(detail);
            if (estimate?.dpr != null && Number.isFinite(estimate.dpr)) {
              hostileDpr += Math.max(0, estimate.dpr);
            }
            if (estimate?.burstFactor != null && Number.isFinite(estimate.burstFactor)) {
              burstFactor = Math.max(burstFactor, estimate.burstFactor);
            }

            const cr = parseCrFromDetail(detail);
            if (cr != null && cr > maxMonsterCr) {
              maxMonsterCr = cr;
            }
          }

          nextXp[encId] = Math.max(0, Math.round(totalXp));

          const diff = calcEncounterDifficulty({
            partyHpMax,
            hostileDpr,
            burstFactor,
            totalXp,
            playerLevels,
            monsterCount,
            maxMonsterCr,
          });
          nextDiff[encId] = {
            label: diff.label,
            rtk: diff.roundsToTpk,
            partyHpMax: diff.partyHpMax,
            hostileDpr: diff.hostileDpr,
            burstFactor: diff.burstFactor,
            adjustedXp: diff.adjustedXp,
          };
        } catch {
          // ignore
        }
      }

      if (cancelled) return;
      if (Object.keys(nextXp).length) {
        setEncounterXp((prev) => ({ ...prev, ...nextXp }));
      }
      if (Object.keys(nextDiff).length) {
        setEncounterDifficulty((prev) => ({ ...prev, ...nextDiff }));
      }
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
    return (encounters ?? []).map((encounter) => {
      const status = String(encounter.status ?? "");
      const xp = encounterXp[encounter.id];
      const diff = encounterDifficulty[encounter.id];

      const parts: string[] = [];
      if (status) parts.push(status);
      if (typeof xp === "number" && Number.isFinite(xp) && xp > 0) {
        parts.push(`${xp.toLocaleString()} XP`);
      }
      if (diff?.label) {
        parts.push(diff.label);
      }

      return {
        id: encounter.id,
        name: encounter.name,
        status: parts.join(" • "),
      };
    });
  }, [encounterDifficulty, encounterXp, encounters]);

  return { encountersForPanel };
}
