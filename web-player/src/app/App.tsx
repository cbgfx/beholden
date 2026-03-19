import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoginView } from "@/views/LoginView";
import { PlayerHomeView } from "@/views/PlayerHomeView";
import { CompendiumView } from "@/views/CompendiumView/CompendiumView";
import { AppShell } from "./AppShell";

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
      <Routes>
        <Route path="/" element={<PlayerHomeView />} />
        <Route path="/compendium" element={<CompendiumView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter
        basename="/player"
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AuthGate />
      </BrowserRouter>
    </AuthProvider>
  );
}
