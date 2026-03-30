import React from "react";
import { NavLink, Link } from "react-router-dom";
import { C, withAlpha } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { useWsStatus } from "@/services/ws";
import { StatusDot } from "@beholden/shared/ui";

const NAV_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/compendium", label: "Compendium", end: false },
];

interface Meta {
  support: boolean;
}

function useServerMeta() {
  const [meta, setMeta] = React.useState<Meta | null>(null);
  React.useEffect(() => {
    api<Meta>("/api/meta").then(setMeta).catch(() => {});
  }, []);
  return meta;
}

function useUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = React.useState(false);
  React.useEffect(() => {
    api<{ ok: boolean; updateAvailable?: boolean }>("/api/update-check")
      .then((r) => { if (r.ok && r.updateAvailable) setUpdateAvailable(true); })
      .catch(() => {});
  }, []);
  return updateAvailable;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const meta = useServerMeta();
  const updateAvailable = useUpdateCheck();
  const showSupport = meta?.support === true;
  const connected = useWsStatus();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, Segoe UI, Arial, sans-serif" }}>
      <header style={{
        display: "flex", alignItems: "center", gap: 24,
        padding: "0 20px", height: 68, flexShrink: 0,
        background: C.panelBg, borderBottom: `1px solid ${C.panelBorder}`,
      }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
          <img src={`${import.meta.env.BASE_URL}beholden_logo.png`} alt="" style={{ width: 50, height: 50, objectFit: "contain" }} />
          <span style={{ fontSize: "var(--fs-hero)", fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>
            Beholden
          </span>
        </Link>

        <nav style={{ display: "flex", gap: 4, flex: 1 }}>
          {NAV_LINKS.map(({ to, label, end }) => (
            <NavLink
              key={to} to={to} end={end}
              style={({ isActive }) => ({
                padding: "5px 12px",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: "var(--fs-medium)",
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
          <Link to="/profile" style={{
            fontSize: "var(--fs-medium)", color: C.muted, textDecoration: "none",
            padding: "4px 10px", borderRadius: 8, transition: "background 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            {user?.name || user?.username}
          </Link>
          <button
            onClick={logout}
            style={{
              background: "none", border: `1px solid ${C.panelBorder}`,
              borderRadius: 8, color: C.muted, fontSize: "var(--fs-medium)",
              padding: "4px 12px", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Sign out
          </button>
          <StatusDot
            active={connected}
            activeColor={C.green}
            inactiveColor={C.red}
            title={connected ? "Server connected" : "Server disconnected"}
          />
        </div>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {children}
      </main>

      <footer
        style={{
          borderTop: `1px solid ${C.panelBorder}`,
          padding: "10px 16px",
          color: C.muted,
          fontSize: "var(--fs-medium)",
          background: withAlpha(C.panelBg, 0.12),
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto auto minmax(0, 1fr)",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
        {/* Column 1 — Left */}
        <div style={{ minWidth: 0, justifySelf: "start" }}>
          <div>© {new Date().getFullYear()} Beholden. All rights reserved.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <span>Icons made by</span>
            <a target="_blank" rel="noreferrer" href="https://game-icons.net" style={{ color: C.muted }}>
              https://game-icons.net
            </a>
          </div>
        </div>

        {/* Column 2 — Center Left */}
        <div style={{ justifySelf: "center", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <Link to="/about" style={{ color: C.accent, textDecoration: "none" }}>About</Link>
          <Link to="/faq" style={{ color: C.accent, textDecoration: "none" }}>FAQ</Link>
          <Link to="/updates" style={{ color: C.accent, textDecoration: "none" }}>Future Updates</Link>
        </div>

        {/* Column 3 — Center Right */}
        <div style={{ justifySelf: "center", display: "flex", justifyContent: "center" }}>
          {showSupport ? (
            <a
              href="https://www.buymeacoffee.com/beholden"
              target="_blank"
              rel="noreferrer"
              title="Buy me a pizza"
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              <img
                src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                alt="Buy me a pizza"
                style={{ height: 44, width: "auto" }}
              />
            </a>
          ) : null}
        </div>

        {/* Column 4 — Right */}
        <div style={{ justifySelf: "end", textAlign: "right", fontSize: "var(--fs-small)" }}>
          {updateAvailable && (
            <a
              href="https://github.com/cbgfx/beholden"
              target="_blank"
              rel="noreferrer"
              style={{ color: C.accent, textDecoration: "none", fontWeight: 600 }}
            >
              Update available →
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
