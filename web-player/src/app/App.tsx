import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WsProvider, useWsScope } from "@/services/ws";
import { LoginView } from "@/views/auth/LoginView";
import { PlayerHomeView } from "@/views/home/PlayerHomeView";
import { AppShell } from "./AppShell";

const CompendiumView = React.lazy(() => import("@/views/CompendiumView/CompendiumView").then(m => ({ default: m.CompendiumView })));
const CharacterCreatorView = React.lazy(() => import("@/views/character-creator/CharacterCreatorView").then(m => ({ default: m.CharacterCreatorView })));
const CharacterView = React.lazy(() => import("@/views/character/CharacterView").then(m => ({ default: m.CharacterView })));
const LevelUpView = React.lazy(() => import("@/views/level-up/LevelUpView").then(m => ({ default: m.LevelUpView })));
const ProfileView = React.lazy(() => import("@/views/profile/ProfileView").then(m => ({ default: m.ProfileView })));
const CampaignPartyView = React.lazy(() => import("@/views/campaign/CampaignPartyView").then(m => ({ default: m.CampaignPartyView })));
const PartyMemberView = React.lazy(() => import("@/views/campaign/PartyMemberView").then(m => ({ default: m.PartyMemberView })));
const BastionView = React.lazy(() => import("@/views/campaign/BastionView").then(m => ({ default: m.BastionView })));
const AboutView = React.lazy(() => import("@/views/Info/AboutView").then(m => ({ default: m.AboutView })));
const FaqView = React.lazy(() => import("@/views/Info/FaqView").then(m => ({ default: m.FaqView })));
const UpdatesView = React.lazy(() => import("@/views/Info/UpdatesView").then(m => ({ default: m.UpdatesView })));

function KeyedCharacterView() {
  const { id } = useParams<{ id: string }>();
  return <CharacterView key={id} />;
}

function WsScopeBridge() {
  const location = useLocation();
  const campaignMatch = location.pathname.match(/^\/campaigns\/([^/]+)/);
  useWsScope({
    campaignId: campaignMatch ? decodeURIComponent(campaignMatch[1]) : null,
    adventureId: null,
    encounterId: null,
  });
  return null;
}

function AuthGate() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(160,180,220,0.75)",
          fontFamily: "system-ui, Segoe UI, Arial",
        }}
      >
        Loading…
      </div>
    );
  }

  if (!user) return <LoginView />;

  return (
    <WsProvider>
      <WsScopeBridge />
      <AppShell>
        <React.Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<PlayerHomeView />} />
            <Route path="/compendium" element={<CompendiumView />} />
            <Route path="/characters/new" element={<CharacterCreatorView />} />
            <Route path="/characters/:id" element={<KeyedCharacterView />} />
            <Route path="/characters/:id/edit" element={<CharacterCreatorView />} />
            <Route path="/characters/:id/levelup" element={<LevelUpView />} />
            <Route path="/profile" element={<ProfileView />} />
            <Route path="/campaigns/:id" element={<CampaignPartyView />} />
            <Route path="/campaigns/:id/members/:playerId" element={<PartyMemberView />} />
            <Route path="/campaigns/:id/bastions/:bastionId" element={<BastionView />} />
            <Route path="/about" element={<AboutView />} />
            <Route path="/faq" element={<FaqView />} />
            <Route path="/updates" element={<UpdatesView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </AppShell>
    </WsProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter
      >
        <AuthGate />
      </BrowserRouter>
    </AuthProvider>
  );
}
