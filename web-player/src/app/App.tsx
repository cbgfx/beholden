import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WsProvider } from "@/services/ws";
import { LoginView } from "@/views/LoginView";
import { PlayerHomeView } from "@/views/PlayerHomeView";
import { AppShell } from "./AppShell";

const CompendiumView = React.lazy(() => import("@/views/CompendiumView/CompendiumView").then(m => ({ default: m.CompendiumView })));
const CharacterCreatorView = React.lazy(() => import("@/views/CharacterCreatorView").then(m => ({ default: m.CharacterCreatorView })));
const CharacterView = React.lazy(() => import("@/views/CharacterView").then(m => ({ default: m.CharacterView })));

function AuthGate() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0d1525",
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
    <AppShell>
      <React.Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<PlayerHomeView />} />
          <Route path="/compendium" element={<CompendiumView />} />
          <Route path="/characters/new" element={<CharacterCreatorView />} />
          <Route path="/characters/:id" element={<CharacterView />} />
          <Route path="/characters/:id/edit" element={<CharacterCreatorView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WsProvider>
        <BrowserRouter
          basename="/player"
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <AuthGate />
        </BrowserRouter>
      </WsProvider>
    </AuthProvider>
  );
}
