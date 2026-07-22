import * as React from "react";
import { api } from "@/services/api";
import { getMonsterXp } from "@/domain/utils/xp";
import { calcEncounterDifficulty } from "@/domain/utils/difficulty";
import { estimateMonsterDpr, estimateMonsterEffectiveHp, estimatePartyDpr } from "@/domain/utils/monsterDpr";
import type { Action } from "@/store/actions";
import type { CampaignCharacter, INpc } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";

type DifficultyRow = {
  officialDifficulty: string;
  projectedThreat: string;
  rtk: number;
  partyHpMax: number;
  hostileDpr: number;
  projectedDpr: number;
  burstFactor: number;
  encounterXp: number;
};

type EncounterLike = { id: string; name: string; status: string };

export function useOpenEncounterMetrics(args: {
  selectedAdventureId: string | null;
  encounters: EncounterLike[];
  players: CampaignCharacter[];
  inpcs: INpc[];
  monsterDetails: Record<string, MonsterDetail>;
  dispatch: (action: Action) => void;
}) {
  const { selectedAdventureId, encounters, players, inpcs, monsterDetails, dispatch } = args;

  // All encounters show XP (hostile monsters only) and difficulty next to the status label.
  const [encounterXp, setEncounterXp] = React.useState<Record<string, number>>({});
  const [encounterDifficulty, setEncounterDifficulty] = React.useState<Record<string, DifficultyRow>>({});
  const monsterDetailsRef = React.useRef(monsterDetails);
  monsterDetailsRef.current = monsterDetails;

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!selectedAdventureId) {
        if (!cancelled) {
          setEncounterXp({});
          setEncounterDifficulty({});
        }
        return;
      }

      const encounterIds = (encounters ?? []).map((e) => e.id);
      if (!encounterIds.length) {
        if (!cancelled) {
          setEncounterXp({});
          setEncounterDifficulty({});
        }
        return;
      }

      const idsParam = encodeURIComponent(encounterIds.join(","));
      const summary = await api<{
        rows: Array<{
          encounterId: string;
          baseType: "player" | "monster" | "inpc";
          baseId: string;
          friendly: boolean;
        }>;
      }>(`/api/adventures/${selectedAdventureId}/encounters/combatantsSummary?ids=${idsParam}`);
      if (cancelled) return;

      const nextXp: Record<string, number> = {};
      const nextDiff: Record<string, DifficultyRow> = {};
      const rowsByEncounter = new Map<string, Array<{
        encounterId: string;
        baseType: "player" | "monster" | "inpc";
        baseId: string;
        friendly: boolean;
      }>>();
      for (const row of summary.rows ?? []) {
        const list = rowsByEncounter.get(row.encounterId) ?? [];
        list.push(row);
        rowsByEncounter.set(row.encounterId, list);
      }

      // Ensure we have monster details for all referenced monsters in one batch pass.
      const monsterIds = new Set<string>();
      for (const row of summary.rows ?? []) {
        if (row.baseType === "monster" && row.baseId) {
          monsterIds.add(String(row.baseId));
          continue;
        }
        if (row.baseType === "inpc" && row.baseId) {
          const inpc = inpcs.find((x) => String(x.id) === String(row.baseId));
          if (inpc?.monsterId) monsterIds.add(String(inpc.monsterId));
        }
      }
      const missing = Array.from(monsterIds).filter((id) => !monsterDetailsRef.current?.[id]);
      const patch: Record<string, MonsterDetail> = {};
      if (missing.length) {
        try {
          const idsParam = encodeURIComponent(missing.join(","));
          const batch = await api<{ rows: MonsterDetail[] }>(`/api/compendium/monsters-metrics?ids=${idsParam}`);
          for (const detail of batch.rows ?? []) {
            const id = String((detail as { id?: unknown }).id ?? "");
            if (!id) continue;
            patch[id] = detail;
          }
        } catch {
          // best-effort; metrics are optional
        }
        if (!cancelled && Object.keys(patch).length) {
          dispatch({ type: "mergeMonsterDetails", patch });
        }
      }
      const details = { ...monsterDetailsRef.current, ...patch };

      for (const encId of encounterIds) {
        try {
          let totalXp = 0;
          let hostileDpr = 0;
          let projectedDpr = 0;
          let monsterEffectiveHp = 0;

          const encounterRows = rowsByEncounter.get(encId) ?? [];
          const encounterPlayerIds = new Set(encounterRows.filter((row) => row.baseType === "player").map((row) => String(row.baseId)));
          const encounterPlayers = players.filter((player) => encounterPlayerIds.has(String(player.id)));
          const partyHpMax = encounterPlayers.reduce((sum, player) => sum + (player.hpMax ?? 0), 0);
          const playerLevels = encounterPlayers.map((player) => Number(player.level ?? 1)).filter((level) => Number.isFinite(level) && level > 0);
          const armorClasses = encounterPlayers.map((player) => Number(player.ac)).filter((ac) => Number.isFinite(ac) && ac > 0);
          for (const row of encounterRows) {
            if (row.baseType === "player") continue;
            if (row.friendly) continue;
            let monsterId: string | null = null;
            if (row.baseType === "monster") {
              monsterId = row.baseId != null ? String(row.baseId) : null;
            }
            if (row.baseType === "inpc") {
              const inpcId = row.baseId != null ? String(row.baseId) : null;
              const inpc = inpcId
                ? (inpcs ?? []).find((x: any) => String(x.id) === inpcId)
                : null;
              monsterId = inpc?.monsterId != null ? String(inpc.monsterId) : null;
            }
            if (!monsterId) continue;

            const detail = details?.[monsterId];

            const xp = getMonsterXp(detail);
            if (xp != null && Number.isFinite(xp)) {
              totalXp += xp;
            }

            const estimate = estimateMonsterDpr(detail, { armorClasses, partySize: encounterPlayers.length });
            if (estimate?.dpr != null && Number.isFinite(estimate.dpr)) {
              const dpr = Math.max(0, estimate.dpr);
              hostileDpr += dpr;
              projectedDpr += dpr * Math.max(1, estimate.burstFactor);
            }
            monsterEffectiveHp += estimateMonsterEffectiveHp(detail);

          }

          nextXp[encId] = Math.max(0, Math.round(totalXp));

          const diff = calcEncounterDifficulty({
            partyHpMax,
            hostileDpr,
            projectedDpr,
            totalXp,
            playerLevels,
            partyHpValues: encounterPlayers.map((player) => Number(player.hpMax)).filter((hp) => Number.isFinite(hp) && hp > 0),
            monsterEffectiveHp,
            partyDpr: estimatePartyDpr(playerLevels),
          });
          nextDiff[encId] = {
            officialDifficulty: diff.officialDifficulty,
            projectedThreat: diff.projectedThreat,
            rtk: diff.roundsToTpk,
            partyHpMax: diff.partyHpMax,
            hostileDpr: diff.hostileDpr,
            projectedDpr: diff.projectedDpr,
            burstFactor: diff.burstFactor,
            encounterXp: diff.encounterXp,
          };
        } catch {
          // ignore
        }
      }

      if (cancelled) return;
      setEncounterXp(nextXp);
      setEncounterDifficulty(nextDiff);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    dispatch,
    selectedAdventureId,
    encounters,
    inpcs,
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
      if (diff?.projectedThreat && diff.projectedThreat !== "Unavailable") {
        parts.push(diff.projectedThreat);
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
