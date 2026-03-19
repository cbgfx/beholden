import React from "react";
import { NavLink } from "react-router-dom";
import { C } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { to: "/", label: "Campaigns", end: true },
  { to: "/compendium", label: "Compendium", end: false },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, Segoe UI, Arial, sans-serif" }}>
      <header style={{
        display: "flex", alignItems: "center", gap: 24,
        padding: "0 20px", height: 52, flexShrink: 0,
        background: C.panelBg, borderBottom: `1px solid ${C.panelBorder}`,
      }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: C.accent, letterSpacing: "-0.4px", flexShrink: 0 }}>
          Beholden
        </span>

        <nav style={{ display: "flex", gap: 4, flex: 1 }}>
          {NAV_LINKS.map(({ to, label, end }) => (
            <NavLink
              key={to} to={to} end={end}
              style={({ isActive }) => ({
                padding: "5px 12px",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? C.accentHl : C.muted,
                background: isActive ? `${C.accentHl}18` : "transparent",
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: C.muted }}>{user?.name || user?.username}</span>
          <button
            onClick={logout}
            style={{
              background: "none", border: `1px solid ${C.panelBorder}`,
              borderRadius: 8, color: C.muted, fontSize: 13,
              padding: "4px 12px", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {children}
      </main>
    </div>
  );
}
