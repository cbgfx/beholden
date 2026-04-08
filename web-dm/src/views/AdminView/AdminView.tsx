// web-dm/src/views/AdminView/AdminView.tsx

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { UsersAdminPanel } from "./UsersAdminPanel";
import { CampaignsAdminPanel } from "./CampaignsAdminPanel";

type Tab = "users" | "campaigns";

const TABS: { id: Tab; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "campaigns", label: "Campaign Memberships" },
];

export function AdminView() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("users");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.colors.bg,
        color: theme.colors.text,
        fontFamily: "system-ui, Segoe UI, Arial",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          borderBottom: `1px solid ${theme.colors.panelBorder}`,
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: theme.colors.panelBg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontWeight: 800, fontSize: "var(--fs-title)", color: theme.colors.accentPrimary }}>
            Beholden
          </span>
          <span style={{ color: theme.colors.panelBorder }}>|</span>
          <span style={{ fontWeight: 600, color: theme.colors.muted }}>Admin Panel</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a
            href="/"
            style={{ color: theme.colors.accentHighlight, fontSize: "var(--fs-medium)", textDecoration: "none" }}
          >
            ← Back to App
          </a>
          <span style={{ fontSize: "var(--fs-medium)", color: theme.colors.muted }}>{user?.name}</span>
          <Button variant="ghost" style={{ fontSize: "var(--fs-subtitle)", padding: "5px 10px" }} onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          borderBottom: `1px solid ${theme.colors.panelBorder}`,
          padding: "0 24px",
          display: "flex",
          gap: 4,
          background: theme.colors.panelBg,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "12px 16px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${tab === t.id ? theme.colors.accentPrimary : "transparent"}`,
              color: tab === t.id ? theme.colors.accentPrimary : theme.colors.muted,
              fontWeight: tab === t.id ? 700 : 500,
              fontSize: "var(--fs-medium)",
              cursor: "pointer",
              transition: "color 150ms, border-color 150ms",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {tab === "users" && <UsersAdminPanel />}
        {tab === "campaigns" && <CampaignsAdminPanel />}
      </div>
    </div>
  );
}
