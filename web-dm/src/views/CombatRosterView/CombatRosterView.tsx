import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/store";
import { api } from "@/services/api";
import type { INpc, Player } from "@/domain/types/domain";
import { useConfirm } from "@/confirm/ConfirmContext";
import { CombatRosterHeader } from "@/views/CombatRosterView/components/CombatRosterHeader";
import { useEncounterCombatants } from "@/views/CombatView/hooks/useEncounterCombatants";
import { CombatRosterLeftColumn } from "@/views/CombatRosterView/components/CombatRosterLeftColumn";
import { CombatRosterCenterColumn } from "@/views/CombatRosterView/components/CombatRosterCenterColumn";
import { CombatRosterRightColumn } from "@/views/CombatRosterView/components/CombatRosterRightColumn";
import { useEnsureRosterMonsterDetails } from "@/views/CombatRosterView/hooks/useEnsureRosterMonsterDetails";
import { useRosterMetrics } from "@/views/CombatRosterView/hooks/useRosterMetrics";
import { useEncounterActions } from "@/app/useEncounterActions";
import { useCampaignActions } from "@/app/useCampaignActions";

export function CombatRosterView() {
  const { campaignId, encounterId } = useParams();
  const nav = useNavigate();
  const { state, dispatch } = useStore();
  const confirm = useConfirm();
  const { refresh } = useEncounterCombatants(encounterId, dispatch);

  const combatants = React.useMemo(() => {
    if (!encounterId) return [];
    return state.combatants.filter((c) => c.encounterId === encounterId);
  }, [state.combatants, encounterId]);

  const encounter = React.useMemo(() => {
    if (!encounterId) return null;
    return state.encounters.find((e) => e.id === encounterId) ?? null;
  }, [encounterId, state.encounters]);

  useEnsureRosterMonsterDetails({ combatants, inpcs: state.inpcs, monsterDetails: state.monsterDetails, dispatch });

  const playersById = React.useMemo(() => {
    const m: Record<string, { imageUrl?: string | null }> = {};
    for (const p of state.players) m[p.id] = { imageUrl: p.imageUrl };
    return m;
  }, [state.players]);

  const { xpByCombatantId, totalXp, difficulty } = useRosterMetrics({
    combatants,
    inpcs: state.inpcs,
    monsterDetails: state.monsterDetails,
    players: state.players,
  });

  const [compQ, setCompQ] = React.useState("");

  // Encounter-scoped actions — keyed to the explicit route encounterId.
  const encounterActions = useEncounterActions(encounterId, refresh);

  // Campaign-scoped refresh: players + inpcs only (sufficient for roster view).
  const refreshCampaignForRoster = React.useCallback(async (cid: string) => {
    const [players, inpcs] = await Promise.all([
      api<Player[]>(`/api/campaigns/${cid}/players`),
      api<INpc[]>(`/api/campaigns/${cid}/inpcs`),
    ]);
    dispatch({ type: "setPlayers", players });
    dispatch({ type: "setINpcs", inpcs });
  }, [dispatch]);

  const refreshEncounterForRoster = React.useCallback(async (_eid: string | null) => {
    await refresh();
  }, [refresh]);

  const noop = React.useCallback(async () => {}, []);

  // Campaign-scoped actions (deletePlayer, deleteINpc, addINpcFromMonster, fullRestPlayers).
  const campaignActions = useCampaignActions(state, dispatch, confirm, {
    refreshAll: noop,
    refreshCampaign: refreshCampaignForRoster,
    refreshAdventure: noop,
    refreshEncounter: refreshEncounterForRoster,
  });

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
          onFullRest={campaignActions.fullRestPlayers}
          onCreatePlayer={() => dispatch({ type: "openDrawer", drawer: { type: "createPlayer", campaignId: state.selectedCampaignId } })}
          onEditPlayer={(playerId) => dispatch({ type: "openDrawer", drawer: { type: "editPlayer", playerId } })}
          onDeletePlayer={campaignActions.deletePlayer}
          onAddPlayerToEncounter={encounterActions.addPlayerToEncounter}
          onAddINpcFromMonster={campaignActions.addINpcFromMonster}
          onEditINpc={(inpcId) => dispatch({ type: "openDrawer", drawer: { type: "editINpc", inpcId } })}
          onDeleteINpc={campaignActions.deleteINpc}
          onAddINpcToEncounter={encounterActions.addINpcToEncounter}
        />

        <CombatRosterCenterColumn
          selectedEncounter={encounter ? { id: encounter.id, name: encounter.name } : null}
          combatants={combatants}
          xpByCombatantId={xpByCombatantId}
          playersById={playersById}
          compQ={compQ}
          onChangeCompQ={setCompQ}
          compRows={[]}
          onAddMonster={encounterActions.addMonster}
          onAddAllPlayers={encounterActions.addAllPlayers}
          onOpenCombat={() => encounterId && nav(campaignId ? `/campaign/${campaignId}/combat/${encounterId}` : `/combat/${encounterId}`)}
          onEditCombatant={(combatantId) =>
            encounterId ? dispatch({ type: "openDrawer", drawer: { type: "editCombatant", encounterId, combatantId } }) : undefined
          }
          onRemoveCombatant={encounterActions.removeCombatant}
        />

        <CombatRosterRightColumn encounterId={encounterId ?? null} />
      </div>
    </div>
  );
}
