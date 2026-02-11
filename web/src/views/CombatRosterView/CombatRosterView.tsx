import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/app/store";
import { api } from "@/app/services/api";
import type { AddMonsterOptions, INpc } from "@/app/types/domain";

import { PlayersPanel } from "@/views/CampaignView/panels/PlayersPanel";
import { INpcsPanel } from "@/views/CampaignView/panels/INpcsPanel";
import { EncounterRosterPanel } from "@/views/CampaignView/panels/EncounterRosterPanel";
import { TreasurePanel } from "@/views/CombatRosterView/components/TreasurePanel";

import { CombatRosterHeader } from "@/views/CombatRosterView/components/CombatRosterHeader";

import { useEncounterCombatants } from "@/views/CombatView/hooks/useEncounterCombatants";
import { getMonsterXp } from "@/app/utils/xp";
import { calcEncounterDifficulty, estimateMonsterDpr } from "@/app/utils/difficulty";

export function CombatRosterView() {
  const { encounterId } = useParams();
  const nav = useNavigate();
  const { state, dispatch } = useStore();

  const { combatants, refresh } = useEncounterCombatants(encounterId, dispatch);

  const encounter = React.useMemo(() => {
    if (!encounterId) return null;
    return (state as any).encounters?.find((e: any) => e.id === encounterId) ?? null;
  }, [encounterId, state.encounters]);

  // Ensure we have monster details for the roster's monsters so we can display XP.
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const cs: any[] = combatants ?? [];

      // Collect monster ids referenced by combatants.
      const monsterIds = new Set<string>();
      for (const c of cs) {
        if (c?.baseType === "monster" && c.baseId != null) monsterIds.add(String(c.baseId));
        if (c?.baseType === "inpc" && c.baseId != null) {
          const inpcId = String(c.baseId);
          const inpc = (state.inpcs ?? []).find((x: any) => String(x.id) === inpcId);
          if (inpc?.monsterId != null) monsterIds.add(String(inpc.monsterId));
        }
      }

      const missing = Array.from(monsterIds).filter((id) => !(state.monsterDetails && (state.monsterDetails as any)[id]));
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
      if (Object.keys(patch).length) dispatch({ type: "mergeMonsterDetails", patch });
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [combatants, dispatch, state.inpcs, state.monsterDetails]);

  const xpByCombatantId = React.useMemo(() => {
    const map: Record<string, number> = {};
    const cs: any[] = combatants ?? [];
    for (const c of cs) {
      if (!c?.id) continue;
      let monsterId: string | null = null;
      if (c.baseType === "monster") monsterId = c.baseId != null ? String(c.baseId) : null;
      if (c.baseType === "inpc") {
        const inpcId = c.baseId != null ? String(c.baseId) : null;
        const inpc = inpcId ? (state.inpcs ?? []).find((x: any) => String(x.id) === inpcId) : null;
        monsterId = inpc?.monsterId != null ? String(inpc.monsterId) : null;
      }
      if (!monsterId) continue;
      const xp = getMonsterXp((state.monsterDetails as any)?.[monsterId]);
      if (xp != null) map[String(c.id)] = xp;
    }
    return map;
  }, [combatants, state.inpcs, state.monsterDetails]);

  const totalXp = React.useMemo(() => {
    let total = 0;
    const cs: any[] = combatants ?? [];
    for (const c of cs) {
      if (c?.baseType === "player") continue;
      if (c?.friendly) continue; // Friendly monsters do not count.
      const xp = xpByCombatantId[String(c.id)];
      if (typeof xp === "number" && Number.isFinite(xp)) total += xp;
    }
    return total;
  }, [combatants, xpByCombatantId]);

  const difficulty = React.useMemo(() => {
    const partyHpMax = (state.players ?? []).reduce((sum: number, p: any) => sum + (typeof p?.hpMax === "number" ? p.hpMax : 0), 0);

    let hostileDpr = 0;
    let burstFactor = 1.0;
    const cs: any[] = combatants ?? [];

    for (const c of cs) {
      if (c?.baseType === "player") continue;
      if (c?.friendly) continue;

      let monsterId: string | null = null;
      if (c.baseType === "monster") monsterId = c.baseId != null ? String(c.baseId) : null;
      if (c.baseType === "inpc") {
        const inpcId = c.baseId != null ? String(c.baseId) : null;
        const inpc = inpcId ? (state.inpcs ?? []).find((x: any) => String(x.id) === inpcId) : null;
        monsterId = inpc?.monsterId != null ? String(inpc.monsterId) : null;
      }
      if (!monsterId) continue;

      const est = estimateMonsterDpr((state.monsterDetails as any)?.[monsterId]);
      if (est?.dpr != null && Number.isFinite(est.dpr)) hostileDpr += Math.max(0, est.dpr);
      if (est?.burstFactor != null && Number.isFinite(est.burstFactor)) burstFactor = Math.max(burstFactor, est.burstFactor);
    }

    return calcEncounterDifficulty({ partyHpMax, hostileDpr, burstFactor });
  }, [combatants, state.inpcs, state.monsterDetails, state.players]);

  // Keep roster view resilient: the MonsterPickerModal can fetch its own index
  // (and handles errors). We only track the search string here so iNPC creation
  // can share it, but we don't pre-fetch the index in this view.
  const [compQ, setCompQ] = React.useState("");

  const addAllPlayers = React.useCallback(async () => {
    if (!encounterId) return;
    try {
      await api(`/api/encounters/${encounterId}/combatants/addPlayers`, { method: "POST" });
      await refresh();
    } catch (e) {
      // Avoid "nothing happens" when the server returns an error.
      alert(e instanceof Error ? e.message : String(e));
    }
  }, [encounterId, refresh]);

  const addPlayerToEncounter = React.useCallback(
    async (playerId: string) => {
      if (!encounterId) return;
      try {
        await api(`/api/encounters/${encounterId}/combatants/addPlayer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId })
        });
        await refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [encounterId, refresh]
  );

  const addMonster = React.useCallback(
    async (monsterId: string, qty: number, opts?: AddMonsterOptions) => {
      if (!encounterId) return;
      const labelBase = opts?.labelBase;
      try {
        await api(`/api/encounters/${encounterId}/combatants/addMonster`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monsterId,
            qty,
            friendly: Boolean(opts?.friendly ?? false),
            labelBase: labelBase?.trim() || undefined,
            ac: opts?.ac,
            acDetail: opts?.acDetail ?? undefined,
            hpMax: opts?.hpMax,
            hpDetail: opts?.hpDetail ?? undefined,
            attackOverrides: opts?.attackOverrides ?? null
          })
        });
        await refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [encounterId, refresh]
  );

  const removeCombatant = React.useCallback(
    async (combatantId: string) => {
      if (!encounterId) return;
      await api(`/api/encounters/${encounterId}/combatants/${combatantId}`, { method: "DELETE" });
      await refresh();
    },
    [encounterId, refresh]
  );

  const addINpcToEncounter = React.useCallback(
    async (inpcId: string) => {
      if (!encounterId) return;
      await api(`/api/encounters/${encounterId}/combatants/addInpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inpcId })
      });
      await refresh();
    },
    [encounterId, refresh]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <CombatRosterHeader
        title={encounter ? `Combat Roster: ${encounter.name}` : "Combat Roster"}
        totalXp={totalXp}
        difficulty={difficulty}
      />

      <div className="campaignGrid">
        <div className="campaignCol">
          <PlayersPanel
            players={state.players}
            combatants={combatants}
            selectedEncounterId={encounterId ?? null}
            onFullRest={async () => {
              if (!state.selectedCampaignId) return;
              await api(`/api/campaigns/${state.selectedCampaignId}/fullRest`, { method: "POST" });
              // keep roster in sync
              await refresh();
            }}
            onCreatePlayer={() => dispatch({ type: "openDrawer", drawer: { type: "createPlayer", campaignId: state.selectedCampaignId } })}
            onEditPlayer={(playerId) => dispatch({ type: "openDrawer", drawer: { type: "editPlayer", playerId } })}
            onAddPlayerToEncounter={addPlayerToEncounter}
          />

          <INpcsPanel
            inpcs={state.inpcs}
            selectedCampaignId={state.selectedCampaignId ?? ""}
            selectedEncounterId={encounterId ?? null}
            compQ={compQ}
            onChangeCompQ={setCompQ}
            // Let the iNPC panel reuse the MonsterPickerModal's internal compendium
            // loading via its fallback hook.
            compRows={[]}
            onAddINpcFromMonster={async (monsterId, qty, opts) => {
              if (!state.selectedCampaignId) return;
              await api(`/api/campaigns/${state.selectedCampaignId}/inpcs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  monsterId,
                  qty,
                  friendly: Boolean(opts?.friendly ?? true),
                  label: opts?.labelBase ?? null,
                  ac: opts?.ac ?? null,
                  acDetails: opts?.acDetail ?? null,
                  hpMax: opts?.hpMax ?? null,
                  hpDetails: opts?.hpDetail ?? null
                })
              });
              // refresh campaign lists
              const cid = state.selectedCampaignId;
              const inpcs = await api<INpc[]>(`/api/campaigns/${cid}/inpcs`);
              dispatch({ type: "setINpcs", inpcs });
            }}
            onEditINpc={(inpcId) => dispatch({ type: "openDrawer", drawer: { type: "editINpc", inpcId } })}
            onDeleteINpc={async (inpcId) => {
              const ok = window.confirm("Delete this iNPC?");
              if (!ok) return;
              await api(`/api/inpcs/${inpcId}`, { method: "DELETE" });
              const cid = state.selectedCampaignId;
              if (cid) dispatch({ type: "setINpcs", inpcs: await api<INpc[]>(`/api/campaigns/${cid}/inpcs`) });
            }}
            onAddINpcToEncounter={addINpcToEncounter}
          />
        </div>

        <div className="campaignCol" style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <EncounterRosterPanel
            selectedEncounter={encounter ? { id: encounter.id, name: encounter.name } : null}
            combatants={combatants}
            xpByCombatantId={xpByCombatantId}
            compQ={compQ}
            onChangeCompQ={setCompQ}
            // Let the MonsterPickerModal fetch its own index when needed.
            compRows={[]}
            onAddMonster={addMonster}
            onAddAllPlayers={addAllPlayers}
            onOpenCombat={() => encounterId && nav(`/combat/${encounterId}`)}
            onEditCombatant={(combatantId) =>
              encounterId ? dispatch({ type: "openDrawer", drawer: { type: "editCombatant", encounterId, combatantId } }) : undefined
            }
            onRemoveCombatant={removeCombatant}
          />
        </div>

        <div className="campaignCol" style={{ display: "grid", gap: 10, alignContent: "start" }}>
          {encounterId ? <TreasurePanel encounterId={encounterId} /> : null}
        </div>
      </div>
    </div>
  );
}
