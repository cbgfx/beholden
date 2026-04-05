import React from "react";
import { NavLink, Link } from "react-router-dom";
import { C, withAlpha } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { useWsStatus } from "@/services/ws";
import { StatusDot, FooterGrid, HeaderActionButton, HeaderActionLink, navLinkStyle } from "@beholden/shared/ui";

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
              style={({ isActive }) => navLinkStyle(isActive, C.accentHl, C.muted)}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <HeaderActionLink to="/profile" color={C.muted}>
            {user?.name || user?.username}
          </HeaderActionLink>
          <HeaderActionButton onClick={logout} color={C.muted} borderColor={C.panelBorder}>
            Sign out
          </HeaderActionButton>
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

      <FooterGrid
        borderColor={C.panelBorder}
        background={withAlpha(C.panelBg, 0.12)}
        color={C.muted}
        left={
          <>
            <div>© {new Date().getFullYear()} Beholden. All rights reserved.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <span>Icons made by</span>
              <a target="_blank" rel="noreferrer" href="https://game-icons.net" style={{ color: C.muted }}>
                https://game-icons.net
              </a>
            </div>
          </>
        }
        centerLeft={
          <>
            <Link to="/about" style={{ color: C.accent, textDecoration: "none" }}>About</Link>
            <Link to="/faq" style={{ color: C.accent, textDecoration: "none" }}>FAQ</Link>
            <Link to="/updates" style={{ color: C.accent, textDecoration: "none" }}>Future Updates</Link>
          </>
        }
        centerRight={showSupport ? (
          <a href="https://www.buymeacoffee.com/beholden" target="_blank" rel="noreferrer" title="Buy me a pizza" style={{ display: "inline-flex", alignItems: "center" }}>
            <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy me a pizza" style={{ height: 44, width: "auto" }} />
          </a>
        ) : null}
        right={updateAvailable ? (
          <a href="https://github.com/cbgfx/beholden" target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none", fontWeight: 600 }}>
            Update available →
          </a>
        ) : null}
      />
    </div>
  );
}
