import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/store";
import { api } from "@/services/api";
import type { AddMonsterOptions, INpc, Player } from "@/domain/types/domain";
import { useConfirm } from "@/confirm/ConfirmContext";
import { CombatRosterHeader } from "@/views/CombatRosterView/components/CombatRosterHeader";

import { useEncounterCombatants } from "@/views/CombatView/hooks/useEncounterCombatants";

import { CombatRosterLeftColumn } from "@/views/CombatRosterView/components/CombatRosterLeftColumn";
import { CombatRosterCenterColumn } from "@/views/CombatRosterView/components/CombatRosterCenterColumn";
import { CombatRosterRightColumn } from "@/views/CombatRosterView/components/CombatRosterRightColumn";

import { useEnsureRosterMonsterDetails } from "@/views/CombatRosterView/hooks/useEnsureRosterMonsterDetails";
import { useRosterMetrics } from "@/views/CombatRosterView/hooks/useRosterMetrics";

export function CombatRosterView() {
  const { campaignId, encounterId } = useParams();
  const nav = useNavigate();
  const { state, dispatch } = useStore();
  const confirm = useConfirm();
  // This hook only orchestrates fetching + store updates.
  const { refresh } = useEncounterCombatants(encounterId, dispatch);

  // Store is the single source of truth.
  const combatants = React.useMemo(() => {
    if (!encounterId) return [];
    return state.combatants.filter((c) => c.encounterId === encounterId);
  }, [state.combatants, encounterId]);

  const encounter = React.useMemo(() => {
    if (!encounterId) return null;
    return state.encounters.find((e) => e.id === encounterId) ?? null;
  }, [encounterId, state.encounters]);

  useEnsureRosterMonsterDetails({ combatants, inpcs: state.inpcs, monsterDetails: state.monsterDetails, dispatch });

  const { xpByCombatantId, totalXp, difficulty } = useRosterMetrics({
    combatants,
    inpcs: state.inpcs,
    monsterDetails: state.monsterDetails,
    players: state.players
  });

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
            acDetails: opts?.acDetails ?? undefined,
            hpMax: opts?.hpMax,
            hpDetails: opts?.hpDetails ?? undefined,
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
        backTo={encounter ? `/campaign/${encounter.campaignId}` : "/"}
        title={encounter ? `Combat Roster: ${encounter.name}` : "Combat Roster"}
        totalXp={totalXp}
        difficulty={difficulty}
      />

      <div className="campaignGrid">
        <CombatRosterLeftColumn
          players={state.players}
          combatants={combatants}
          inpcs={state.inpcs}
          selectedCampaignId={state.selectedCampaignId ?? ""}
          selectedEncounterId={encounterId ?? null}
          compQ={compQ}
          onChangeCompQ={setCompQ}
          onFullRest={async () => {
            if (!state.selectedCampaignId) return;
            await api(`/api/campaigns/${state.selectedCampaignId}/fullRest`, { method: "POST" });
            await refresh();
          }}
          onCreatePlayer={() => dispatch({ type: "openDrawer", drawer: { type: "createPlayer", campaignId: state.selectedCampaignId } })}
          onEditPlayer={(playerId) => dispatch({ type: "openDrawer", drawer: { type: "editPlayer", playerId } })}
          onDeletePlayer={async (playerId) => {
            if (!(await confirm({ title: "Delete Player", message: "Delete this player? This cannot be undone.", intent: "danger" }))) return;
            await api(`/api/players/${playerId}`, { method: "DELETE" });
            const cid = state.selectedCampaignId;
            if (cid) dispatch({ type: "setPlayers", players: await api<Player[]>(`/api/campaigns/${cid}/players`) });
          }}
          onAddPlayerToEncounter={addPlayerToEncounter}
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
                acDetails: opts?.acDetails ?? null,
                hpMax: opts?.hpMax ?? null,
                hpDetails: opts?.hpDetails ?? null
              })
            });
            const cid = state.selectedCampaignId;
            const inpcs = await api<INpc[]>(`/api/campaigns/${cid}/inpcs`);
            dispatch({ type: "setINpcs", inpcs });
          }}
          onEditINpc={(inpcId) => dispatch({ type: "openDrawer", drawer: { type: "editINpc", inpcId } })}
          onDeleteINpc={async (inpcId) => {
            if (!(await confirm({ title: "Delete iNPC", message: "Delete this iNPC?", intent: "danger" }))) return;
            await api(`/api/inpcs/${inpcId}`, { method: "DELETE" });
            const cid = state.selectedCampaignId;
            if (cid) dispatch({ type: "setINpcs", inpcs: await api<INpc[]>(`/api/campaigns/${cid}/inpcs`) });
          }}
          onAddINpcToEncounter={addINpcToEncounter}
        />

        <CombatRosterCenterColumn
          selectedEncounter={encounter ? { id: encounter.id, name: encounter.name } : null}
          combatants={combatants}
          xpByCombatantId={xpByCombatantId}
          compQ={compQ}
          onChangeCompQ={setCompQ}
          compRows={[]}
          onAddMonster={addMonster}
          onAddAllPlayers={addAllPlayers}
          onOpenCombat={() => encounterId && nav(campaignId ? `/campaign/${campaignId}/combat/${encounterId}` : `/combat/${encounterId}`)}
          onEditCombatant={(combatantId) =>
            encounterId ? dispatch({ type: "openDrawer", drawer: { type: "editCombatant", encounterId, combatantId } }) : undefined
          }
          onRemoveCombatant={removeCombatant}
        />

        <CombatRosterRightColumn encounterId={encounterId ?? null} />
      </div>
    </div>
  );
}
