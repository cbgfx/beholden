
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useMatch } from "react-router-dom";
import { ShellLayout } from "@/layout/ShellLayout";
import { theme } from "@/theme/theme";
import { StoreProvider, useStore } from "@/store";
import { api } from "@/services/api";
import { fetchCampaignCharacters, fetchEncounterActors } from "@/services/actorApi";
import {
  fetchAdventureNotes,
  fetchAdventureTreasure,
  fetchCampaignNotes,
  fetchCampaignTreasure,
} from "@/services/collectionApi";
import type { Adventure, Campaign, CampaignCharacter, Encounter, EncounterActor, INpc, Meta, Note, TreasureEntry } from "@/domain/types/domain";
import { useAppWebSocket } from "@/app/useAppWebSocket";
import type { CompendiumMonsterRow } from "@/views/CampaignView/monsterPicker/types";
import { HomeView } from "@/views/HomeView";
import { DrawerHost } from "@/drawers/DrawerHost";
import { ConfirmProvider, useConfirm } from "@/confirm/ConfirmContext";
import { useCampaignActions } from "@/app/useCampaignActions";
import type { State } from "@/store/state";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoginView } from "@/views/LoginView";

const CompendiumView = React.lazy(() => import("@/views/CompendiumView/CompendiumView").then(m => ({ default: m.CompendiumView })));
const CampaignView = React.lazy(() => import("@/views/CampaignView/CampaignView").then(m => ({ default: m.CampaignView })));
const CombatView = React.lazy(() => import("@/views/CombatView/CombatView").then(m => ({ default: m.CombatView })));
const CombatRosterView = React.lazy(() => import("@/views/CombatRosterView/CombatRosterView").then(m => ({ default: m.CombatRosterView })));
const AboutView = React.lazy(() => import("@/views/Info/AboutView").then(m => ({ default: m.AboutView })));
const FaqView = React.lazy(() => import("@/views/Info/FaqView").then(m => ({ default: m.FaqView })));
const UpdatesView = React.lazy(() => import("@/views/Info/UpdatesView").then(m => ({ default: m.UpdatesView })));
const AdminView = React.lazy(() => import("@/views/AdminView/AdminView").then(m => ({ default: m.AdminView })));
const ProfileView = React.lazy(() => import("@/views/ProfileView").then(m => ({ default: m.ProfileView })));

function AppInner() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [compQ, setCompQ] = useState("");
  const [compendiumIndex, setCompendiumIndex] = useState<CompendiumMonsterRow[]>([]);
  const [compRows, setCompRows] = useState<CompendiumMonsterRow[]>([]);
  const importAdventureFileRef = useRef<HTMLInputElement>(null);

  const refreshAll = useCallback(async () => {
    const [m, c] = await Promise.all([api<Meta>("/api/meta"), api<Campaign[]>("/api/campaigns")]);
    dispatch({ type: "setMeta", meta: m });
    dispatch({ type: "setCampaigns", campaigns: c });
    dispatch({ type: "autoSelectFirstCampaign", campaigns: c });
  }, [dispatch]);

  const refreshCampaign = useCallback(async (cid: string) => {
    if (!cid) return;
    const [adv, pls, inpcs, notes, treasure] = await Promise.all([
      api<Adventure[]>(`/api/campaigns/${cid}/adventures`),
      fetchCampaignCharacters(cid),
      api<INpc[]>(`/api/campaigns/${cid}/inpcs`),
      fetchCampaignNotes(cid) as Promise<Note[]>,
      fetchCampaignTreasure(cid) as Promise<TreasureEntry[]>
    ]);
    dispatch({ type: "setAdventures", adventures: adv });
    dispatch({ type: "setPlayers", players: pls });
    dispatch({ type: "setINpcs", inpcs });
    dispatch({ type: "setCampaignNotes", notes });
    dispatch({ type: "setCampaignTreasure", treasure });
  }, [dispatch]);

  const refreshAdventure = useCallback(async (adventureId: string | null) => {
    if (!adventureId) {
      dispatch({ type: "setEncounters", encounters: [] });
      dispatch({ type: "setAdventureNotes", notes: [] });
      dispatch({ type: "setAdventureTreasure", treasure: [] });
      return;
    }
    const [enc, notes, treasure] = await Promise.all([
      api<Encounter[]>(`/api/adventures/${adventureId}/encounters`),
      fetchAdventureNotes(adventureId) as Promise<Note[]>,
      fetchAdventureTreasure(adventureId) as Promise<TreasureEntry[]>
    ]);
    dispatch({ type: "setEncounters", encounters: enc });
    dispatch({ type: "setAdventureNotes", notes });
    dispatch({ type: "setAdventureTreasure", treasure });
  }, [dispatch]);

  const refreshEncounter = useCallback(async (encounterId: string | null) => {
    if (!encounterId) { dispatch({ type: "setCombatants", combatants: [] }); return; }
    dispatch({ type: "setCombatants", combatants: await fetchEncounterActors(encounterId) as EncounterActor[] });
  }, [dispatch]);

  useEffect(() => { refreshAll(); }, []);
  useEffect(() => { if (state.selectedCampaignId) refreshCampaign(state.selectedCampaignId); }, [state.selectedCampaignId]);
  useEffect(() => { refreshAdventure(state.selectedAdventureId); }, [state.selectedAdventureId]);
  useEffect(() => { refreshEncounter(state.selectedEncounterId); }, [state.selectedEncounterId]);

  // Sync the :campaignId route param into the store.
  // Covers direct links, refreshes, and back/forward navigation to any
  // /campaign/:campaignId, /campaign/:campaignId/roster/:encounterId, or
  // /campaign/:campaignId/combat/:encounterId URL.
  const matchCampaignExact = useMatch("/campaign/:campaignId");
  const matchCampaignSub   = useMatch("/campaign/:campaignId/*");
  const routeCampaignId = matchCampaignExact?.params.campaignId ?? matchCampaignSub?.params.campaignId ?? null;
  useEffect(() => {
    if (!routeCampaignId) return;
    if (routeCampaignId === state.selectedCampaignId) return;
    dispatch({ type: "selectCampaign", campaignId: routeCampaignId });
  }, [routeCampaignId, state.selectedCampaignId, dispatch]);

  // Load the full compendium index once, then filter client-side.
  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = await api<CompendiumMonsterRow[]>(`/api/compendium/monsters`);
      if (!alive) return;
      setCompendiumIndex(rows);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const q = compQ.trim().toLowerCase();
    if (!q) { setCompRows(compendiumIndex); return; }
    setCompRows(compendiumIndex.filter((m) => String(m?.name ?? "").toLowerCase().includes(q)));
  }, [compQ, compendiumIndex]);

  useAppWebSocket({
    selectedCampaignId: state.selectedCampaignId,
    selectedAdventureId: state.selectedAdventureId,
    selectedEncounterId: state.selectedEncounterId,
    dispatch,
    refreshAll,
    refreshCampaign,
    refreshAdventure,
    refreshEncounter,
    setCompendiumIndex,
  });

  const {
    addPlayerToEncounter,
    fullRestPlayers,
    reorderAdventures,
    reorderEncounters,
    reorderCampaignNotes,
    reorderAdventureNotes,
    addMonster,
    removeCombatant,
    addINpcFromMonster,
    deletePlayer,
    deleteINpc,
    exportAdventure,
    handleImportAdventureFile,
    addINpcToEncounter,
    deleteCampaign,
    deleteAdventure,
    duplicateEncounter,
    deleteEncounter,
    deleteCampaignNote,
    deleteAdventureNote,
  } = useCampaignActions(
    state as State,
    dispatch,
    confirm,
    { refreshAll, refreshCampaign, refreshAdventure, refreshEncounter }
  );

  const hasCampaigns = state.campaigns.length > 0;

  return (
    <ShellLayout>
      <DrawerHost refreshAll={refreshAll} refreshCampaign={refreshCampaign} refreshAdventure={refreshAdventure} refreshEncounter={refreshEncounter} />
      <input
        ref={importAdventureFileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={handleImportAdventureFile}
      />

      <React.Suspense fallback={null}>
      <Routes>
        <Route
          path="/"
          element={
            <HomeView
              campaigns={state.campaigns.map((c) => ({ id: c.id, name: c.name, updatedAt: c.updatedAt, playerCount: c.playerCount, imageUrl: c.imageUrl }))}
              onCreateCampaign={() => dispatch({ type: "openDrawer", drawer: { type: "createCampaign" } })}
              onOpenCampaign={(campaignId) => {
                dispatch({ type: "selectCampaign", campaignId });
                navigate(`/campaign/${campaignId}`);
                api(`/api/campaigns/${campaignId}/touch`, { method: "POST" }).catch(() => {});
              }}
              onEditCampaign={(campaignId) => dispatch({ type: "openDrawer", drawer: { type: "editCampaign", campaignId } })}
              onDeleteCampaign={deleteCampaign}
              onRefresh={refreshAll}
            />}
        />

        <Route
          path="/campaign/:campaignId"
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
                onDeleteAdventure={deleteAdventure}
                onEditEncounter={(encounterId) => dispatch({ type: "openDrawer", drawer: { type: "editEncounter", encounterId } })}
                onDuplicateEncounter={duplicateEncounter}
                onDeleteEncounter={deleteEncounter}
                onAddCampaignNote={() => dispatch({ type: "openDrawer", drawer: { type: "note", scope: "campaign", campaignId: state.selectedCampaignId } })}
                onEditCampaignNote={(noteId) => dispatch({ type: "openDrawer", drawer: { type: "editNote", noteId } })}
                onDeleteCampaignNote={deleteCampaignNote}
                onAddAdventureNote={() => state.selectedAdventureId ? dispatch({ type: "openDrawer", drawer: { type: "note", scope: "adventure", campaignId: state.selectedCampaignId, adventureId: state.selectedAdventureId } }) : undefined}
                onEditAdventureNote={(noteId) => dispatch({ type: "openDrawer", drawer: { type: "editNote", noteId } })}
                onDeleteAdventureNote={deleteAdventureNote}
                onFullRest={fullRestPlayers}
                onCreatePlayer={() => dispatch({ type: "openDrawer", drawer: { type: "createPlayer", campaignId: state.selectedCampaignId } })}
                onEditPlayer={(playerId) => dispatch({ type: "openDrawer", drawer: { type: "editPlayer", playerId } })}
                onDeletePlayer={deletePlayer}
                onAddPlayerToEncounter={addPlayerToEncounter}
                onAddINpcFromMonster={addINpcFromMonster}
                onEditINpc={(inpcId) => dispatch({ type: "openDrawer", drawer: { type: "editINpc", inpcId } })}
                onDeleteINpc={deleteINpc}
                onAddINpcToEncounter={addINpcToEncounter}
                onExportAdventure={exportAdventure}
                onImportAdventure={() => importAdventureFileRef.current?.click()}
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
          <Route path="/campaign/:campaignId/roster/:encounterId" element={<CombatRosterView />} />
          <Route path="/campaign/:campaignId/combat/:encounterId" element={<CombatView />} />
          <Route path="/compendium" element={<CompendiumView />} />
          <Route path="/profile" element={<ProfileView />} />
          <Route path="/about" element={<AboutView />} />
          <Route path="/faq" element={<FaqView />} />
          <Route path="/updates" element={<UpdatesView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </React.Suspense>
    </ShellLayout>
  );
}

function AuthGate() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: theme.colors.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.colors.muted,
        }}
      >
        Loading…
      </div>
    );
  }

  if (!user) return <LoginView />;

  // Pure players (no admin, no DM role) belong in the player app.
  if (!user.hasDmAccess) {
    window.location.replace("/player/");
    return null;
  }

  return (
    <React.Suspense fallback={null}>
    <Routes>
      {/* Admin panel — admins only */}
      <Route
        path="/admin/*"
        element={user.isAdmin ? <AdminView /> : <Navigate to="/" replace />}
      />
      {/* Main DM app */}
      <Route
        path="/*"
        element={
          <StoreProvider>
            <ConfirmProvider>
              <AppInner />
            </ConfirmProvider>
          </StoreProvider>
        }
      />
    </Routes>
    </React.Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthGate />
      </BrowserRouter>
    </AuthProvider>
  );
}
