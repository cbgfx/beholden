
import React, { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ShellLayout } from "./layout/ShellLayout";
import { TopBar } from "./layout/TopBar";
import { StoreProvider, useStore } from "@/app/store";
import { api, jsonInit } from "./services/api";
import { useWs } from "./services/ws";
import type { Adventure, Campaign, Combatant, Encounter, INpc, Meta, Note, Player, AddMonsterOptions, TreasureEntry } from "./types/domain";
import { HomeView } from "../views/HomeView";
import { CompendiumView } from "../views/CompendiumView/CompendiumView";
import { CampaignView } from "../views/CampaignView/CampaignView";
import { CombatView } from "../views/CombatView/CombatView";
import { CombatRosterView } from "../views/CombatRosterView/CombatRosterView";
import { DrawerHost } from "./DrawerHost";

function AppInner() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [compQ, setCompQ] = useState("");
  const [compendiumIndex, setCompendiumIndex] = useState<any[]>([]);
  const [compRows, setCompRows] = useState<any[]>([]);

  const refreshAll = useCallback(async () => {
    const [m, c] = await Promise.all([api<Meta>("/api/meta"), api<Campaign[]>("/api/campaigns")]);
    dispatch({ type: "setMeta", meta: m });
    dispatch({ type: "setCampaigns", campaigns: c });
    if (!state.selectedCampaignId && c.length) dispatch({ type: "selectCampaign", campaignId: c[0].id });
  }, [dispatch, state.selectedCampaignId]);

  const refreshCampaign = useCallback(async (cid: string) => {
    if (!cid) return;
    const [adv, pls, inpcs, notes, treasure] = await Promise.all([
      api<Adventure[]>(`/api/campaigns/${cid}/adventures`),
      api<Player[]>(`/api/campaigns/${cid}/players`),
      api<INpc[]>(`/api/campaigns/${cid}/inpcs`),
      api<Note[]>(`/api/campaigns/${cid}/notes`),
      api<TreasureEntry[]>(`/api/campaigns/${cid}/treasure`)
    ]);
    dispatch({ type: "setAdventures", adventures: adv });
    dispatch({ type: "setPlayers", players: pls });
    dispatch({ type: "setINpcs", inpcs });
    dispatch({ type: "setCampaignNotes", notes });
    dispatch({ type: "setCampaignTreasure", treasure });
    if (state.selectedAdventureId && !adv.some(a => a.id === state.selectedAdventureId)) dispatch({ type: "selectAdventure", adventureId: null });
  }, [dispatch, state.selectedAdventureId]);

  const refreshAdventure = useCallback(async (adventureId: string | null) => {
    if (!adventureId) {
      dispatch({ type: "setEncounters", encounters: [] });
      dispatch({ type: "setAdventureNotes", notes: [] });
      dispatch({ type: "setAdventureTreasure", treasure: [] });
      return;
    }
    const [enc, notes, treasure] = await Promise.all([
      api<Encounter[]>(`/api/adventures/${adventureId}/encounters`),
      api<Note[]>(`/api/adventures/${adventureId}/notes`),
      api<TreasureEntry[]>(`/api/adventures/${adventureId}/treasure`)
    ]);
    dispatch({ type: "setEncounters", encounters: enc });
    dispatch({ type: "setAdventureNotes", notes });
    dispatch({ type: "setAdventureTreasure", treasure });
  }, [dispatch]);

  const refreshEncounter = useCallback(async (encounterId: string | null) => {
    if (!encounterId) { dispatch({ type: "setCombatants", combatants: [] }); return; }
    dispatch({ type: "setCombatants", combatants: await api<Combatant[]>(`/api/encounters/${encounterId}/combatants`) });
  }, [dispatch]);

  useEffect(() => { refreshAll(); }, []);
  useEffect(() => { if (state.selectedCampaignId) refreshCampaign(state.selectedCampaignId); }, [state.selectedCampaignId]);
  useEffect(() => { refreshAdventure(state.selectedAdventureId); }, [state.selectedAdventureId]);
  useEffect(() => { refreshEncounter(state.selectedEncounterId); }, [state.selectedEncounterId]);

  // Load the full compendium index once, then filter client-side.
  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = await api<any[]>(`/api/compendium/monsters`);
      if (!alive) return;
      setCompendiumIndex(rows);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Filter the index by query (no server limit). Additional sorting/filtering happens in the MonsterPicker.
  useEffect(() => {
    const q = compQ.trim().toLowerCase();
    if (!q) {
      setCompRows(compendiumIndex);
      return;
    }
    setCompRows(
      compendiumIndex.filter((m) => String(m?.name ?? "").toLowerCase().includes(q))
    );
  }, [compQ, compendiumIndex]);

  useWs((msg) => {
    if (msg.type === "campaigns:changed" || msg.type === "user:changed") { refreshAll(); return; }
    if (msg.type === "adventures:changed" && msg.payload?.campaignId === state.selectedCampaignId) { refreshCampaign(state.selectedCampaignId); return; }
    if (msg.type === "players:changed" && msg.payload?.campaignId === state.selectedCampaignId) {
      api<Player[]>(`/api/campaigns/${state.selectedCampaignId}/players`).then((pls) => dispatch({ type: "setPlayers", players: pls }));
      return;
    }
    if (msg.type === "inpcs:changed" && msg.payload?.campaignId === state.selectedCampaignId) {
      api<INpc[]>(`/api/campaigns/${state.selectedCampaignId}/inpcs`).then((inpcs) => dispatch({ type: "setINpcs", inpcs }));
      return;
    }
    if (msg.type === "encounters:changed" && msg.payload?.campaignId === state.selectedCampaignId) {
      if (state.selectedAdventureId) refreshAdventure(state.selectedAdventureId);
      return;
    }
    if (msg.type === "notes:changed" && msg.payload?.campaignId === state.selectedCampaignId) {
      api<Note[]>(`/api/campaigns/${state.selectedCampaignId}/notes`).then((notes) => dispatch({ type: "setCampaignNotes", notes }));
      if (state.selectedAdventureId) refreshAdventure(state.selectedAdventureId);
      return;
    }
    if (msg.type === "treasure:changed" && msg.payload?.campaignId === state.selectedCampaignId) {
      api<TreasureEntry[]>(`/api/campaigns/${state.selectedCampaignId}/treasure`).then((treasure) => dispatch({ type: "setCampaignTreasure", treasure }));
      if (state.selectedAdventureId) {
        api<TreasureEntry[]>(`/api/adventures/${state.selectedAdventureId}/treasure`).then((treasure) => dispatch({ type: "setAdventureTreasure", treasure }));
      } else {
        dispatch({ type: "setAdventureTreasure", treasure: [] });
      }
      return;
    }
    if (msg.type === "encounter:combatantsChanged" && msg.payload?.encounterId === state.selectedEncounterId) { refreshEncounter(state.selectedEncounterId); return; }

    // Refresh the compendium index when an import occurs.
    if (msg.type === "compendium:changed") {
      api<any[]>(`/api/compendium/monsters`).then(setCompendiumIndex);
      return;
    }
  });

  async function addAllPlayers() {
    if (!state.selectedEncounterId) return;
    await api(`/api/encounters/${state.selectedEncounterId}/combatants/addPlayers`, { method: "POST" });
    await refreshEncounter(state.selectedEncounterId);
  }


  async function addPlayerToEncounter(playerId: string) {
    if (!state.selectedEncounterId) return;
    await api(`/api/encounters/${state.selectedEncounterId}/combatants/addPlayer`, jsonInit("POST", { playerId }));
    await refreshEncounter(state.selectedEncounterId);
  }

  
  async function fullRestPlayers() {
    if (!state.selectedCampaignId) return;
    await api(`/api/campaigns/${state.selectedCampaignId}/fullRest`, { method: "POST" });
    await refreshCampaign(state.selectedCampaignId);
    // If a combat roster is currently loaded, refresh it so HP/conditions snap immediately.
    if (state.selectedEncounterId) await refreshEncounter(state.selectedEncounterId);
  }

  
  async function reorderAdventures(ids: string[]) {
    if (!state.selectedCampaignId) return;
    await api(`/api/campaigns/${state.selectedCampaignId}/adventures/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    await refreshCampaign(state.selectedCampaignId);
  }

  async function reorderEncounters(ids: string[]) {
    if (!state.selectedAdventureId) return;
    await api(`/api/adventures/${state.selectedAdventureId}/encounters/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    await refreshAdventure(state.selectedAdventureId);
  }

  async function reorderCampaignNotes(ids: string[]) {
    if (!state.selectedCampaignId) return;
    await api(`/api/campaigns/${state.selectedCampaignId}/notes/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    await refreshCampaign(state.selectedCampaignId);
  }

  async function reorderAdventureNotes(ids: string[]) {
    if (!state.selectedAdventureId) return;
    await api(`/api/adventures/${state.selectedAdventureId}/notes/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    await refreshAdventure(state.selectedAdventureId);
  }

  async function addMonster(
    monsterId: string,
    qty: number,
    opts?: AddMonsterOptions
  ) {
    if (!state.selectedEncounterId) return;
    const labelBase = opts?.labelBase;
    await api(`/api/encounters/${state.selectedEncounterId}/combatants/addMonster`, {
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
    await refreshEncounter(state.selectedEncounterId);
  }

  async function removeCombatant(combatantId: string) {
    if (!state.selectedEncounterId) return;
    await api(`/api/encounters/${state.selectedEncounterId}/combatants/${combatantId}`, { method: "DELETE" });
    await refreshEncounter(state.selectedEncounterId);
  }

  const hasCampaigns = state.campaigns.length > 0;

  async function addINpcFromMonster(monsterId: string, qty: number, opts?: AddMonsterOptions) {
    if (!state.selectedCampaignId) return;
    await api(`/api/campaigns/${state.selectedCampaignId}/inpcs`,
      jsonInit("POST", {
        monsterId,
        qty,
        name: opts?.labelBase ?? null,
        friendly: Boolean(opts?.friendly ?? true),
        ac: opts?.ac ?? null,
        acDetails: opts?.acDetail ?? null,
        hpMax: opts?.hpMax ?? null,
        hpDetails: opts?.hpDetail ?? null
      })
    );
    await refreshCampaign(state.selectedCampaignId);
  }

  async function deleteINpc(inpcId: string) {
    if (!state.selectedCampaignId) return;
    if (!confirm("Delete this iNPC?")) return;
    await api(`/api/inpcs/${inpcId}`, { method: "DELETE" });
    await refreshCampaign(state.selectedCampaignId);
  }

  async function addINpcToEncounter(inpcId: string) {
    if (!state.selectedEncounterId) return;
    await api(`/api/encounters/${state.selectedEncounterId}/combatants/addInpc`, jsonInit("POST", { inpcId }));
    await refreshEncounter(state.selectedEncounterId);
  }

  return (
    <ShellLayout>
      <TopBar
        onCreateCampaign={() => dispatch({ type: "openDrawer", drawer: { type: "createCampaign" } })}
        onSelectCampaign={(id) => dispatch({ type: "selectCampaign", campaignId: id })}
        onEditCampaign={(id) => dispatch({ type: "openDrawer", drawer: { type: "editCampaign", campaignId: id } })}
        onDeleteCampaign={async (id) => {
          if (!id) return;
          if (!confirm("Delete this campaign? This will delete ALL its adventures, encounters, players, notes, etc.")) return;
          await api(`/api/campaigns/${id}`, { method: "DELETE" });
          await refreshAll();
        }}
      />

      <DrawerHost refreshAll={refreshAll} refreshCampaign={refreshCampaign} refreshAdventure={refreshAdventure} refreshEncounter={refreshEncounter} />

      <Routes>
        <Route
          path="/"
          element={
            <HomeView
              campaigns={state.campaigns.map((c) => ({ id: c.id, name: c.name }))}
              onCreateCampaign={() => dispatch({ type: "openDrawer", drawer: { type: "createCampaign" } })}
              onOpenCampaign={(campaignId) => {
                dispatch({ type: "selectCampaign", campaignId });
                navigate("/campaign");
              }}
            />
          }
        />

        <Route
          path="/campaign"
          element={
            !hasCampaigns ? (
              <Navigate to="/" replace />
            ) : (
              <CampaignView
                onCreateAdventure={() => dispatch({ type: "openDrawer", drawer: { type: "createAdventure", campaignId: state.selectedCampaignId } })}
                onCreateEncounter={() => {
                  if (!state.selectedAdventureId) return;
                  dispatch({ type: "openDrawer", drawer: { type: "createEncounter", adventureId: state.selectedAdventureId } });
                }}
                onEditAdventure={(adventureId) => dispatch({ type: "openDrawer", drawer: { type: "editAdventure", adventureId } })}
                onDeleteAdventure={async (adventureId) => {
                  if (!confirm("Delete this adventure? This will also delete its encounters and notes.")) return;
                  await api(`/api/adventures/${adventureId}`, { method: "DELETE" });
                  await refreshCampaign(state.selectedCampaignId);
                  await refreshAdventure(state.selectedAdventureId);
                }}
                onEditEncounter={(encounterId) => dispatch({ type: "openDrawer", drawer: { type: "editEncounter", encounterId } })}
                onDeleteEncounter={async (encounterId) => {
                  if (!confirm("Delete this encounter?")) return;
                  await api(`/api/encounters/${encounterId}`, { method: "DELETE" });
                  await refreshAdventure(state.selectedAdventureId);
                  await refreshCampaign(state.selectedCampaignId);
                }}
                onAddCampaignNote={() => dispatch({ type: "openDrawer", drawer: { type: "note", scope: "campaign", campaignId: state.selectedCampaignId } })}
                onEditCampaignNote={(noteId) => dispatch({ type: "openDrawer", drawer: { type: "editNote", noteId } })}
                onDeleteCampaignNote={async (noteId) => {
                  if (!confirm("Delete this note?")) return;
                  await api(`/api/notes/${noteId}`, { method: "DELETE" });
                  await refreshCampaign(state.selectedCampaignId);
                }}
                onAddAdventureNote={() => state.selectedAdventureId ? dispatch({ type: "openDrawer", drawer: { type: "note", scope: "adventure", campaignId: state.selectedCampaignId, adventureId: state.selectedAdventureId } }) : undefined}
                onEditAdventureNote={(noteId) => dispatch({ type: "openDrawer", drawer: { type: "editNote", noteId } })}
                onDeleteAdventureNote={async (noteId) => {
                  if (!confirm("Delete this note?")) return;
                  await api(`/api/notes/${noteId}`, { method: "DELETE" });
                  await refreshAdventure(state.selectedAdventureId);
                }}
                onFullRest={fullRestPlayers}
                onCreatePlayer={() => dispatch({ type: "openDrawer", drawer: { type: "createPlayer", campaignId: state.selectedCampaignId } })}
                onEditPlayer={(playerId) => dispatch({ type: "openDrawer", drawer: { type: "editPlayer", playerId } })}
                onAddPlayerToEncounter={addPlayerToEncounter}

                onAddINpcFromMonster={addINpcFromMonster}
                onEditINpc={(inpcId) => dispatch({ type: "openDrawer", drawer: { type: "editINpc", inpcId } })}
                onDeleteINpc={deleteINpc}
                onAddINpcToEncounter={addINpcToEncounter}
                onReorderAdventures={reorderAdventures}
                onReorderEncounters={reorderEncounters}
                onReorderCampaignNotes={reorderCampaignNotes}
                onReorderAdventureNotes={reorderAdventureNotes}
                compQ={compQ}
                setCompQ={setCompQ}
                compRows={compRows}
              />
  )}
          />
          <Route path="/roster/:encounterId" element={<CombatRosterView />} />
          <Route path="/combat/:encounterId" element={<CombatView />} />
          <Route path="/compendium" element={<CompendiumView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ShellLayout>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </StoreProvider>
  );
}
