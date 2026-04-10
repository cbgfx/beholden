
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useStore } from "@/store";
import { useWs, useWsStatus } from "@/services/ws";
import { theme, withAlpha } from "@/theme/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useIsNarrow } from "@/views/CombatView/hooks/useIsNarrow";
import { HeaderActionButton, HeaderActionLink, StatusDot, navLinkStyle } from "@beholden/shared/ui";
import { ToolsBar } from "@/layout/ToolsBar";

function useSaveStatus(): "idle" | "saving" | "saved" {
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useWs(
    React.useCallback((msg) => {
      if (msg.type === "save:pending") {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setStatus("saving");
      } else if (msg.type === "save:complete") {
        setStatus("saved");
        timerRef.current = setTimeout(() => setStatus("idle"), 2000);
      }
    }, [])
  );

  return status;
}


function NavLink(props: { to: string; label: string }) {
  const loc = useLocation();
  const active = loc.pathname === props.to || (props.to !== "/" && loc.pathname.startsWith(props.to + "/")) || (props.to === "/" && loc.pathname === "/");
  return (
    <Link
      to={props.to}
      style={navLinkStyle(active, "var(--campaign-accent, #a78bfa)", theme.colors.muted, { borderRadius: theme.radius.control })}
    >
      {props.label}
    </Link>
  );
}

export function TopBar() {
  const { state } = useStore();
  const { user, logout } = useAuth();
  const connected = useWsStatus();
  const saveStatus = useSaveStatus();
  const isPhone = useIsNarrow("(max-width: 640px)");
  const { campaigns, selectedCampaignId } = state;
  const selectedName = campaigns.find((c) => c.id === selectedCampaignId)?.name ?? "";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img src="/beholden_logo.png" alt="Beholden" style={{ width: isPhone ? 36 : 50, height: isPhone ? 36 : 50 }} />
        {!isPhone && (
          <Link
            to="/"
            style={{
              fontSize: "var(--fs-hero)",
              fontWeight: 900,
              color: theme.colors.text,
              textDecoration: "none",
            }}
            title="Home"
          >
            Beholden
          </Link>
        )}

        {selectedCampaignId && selectedName ? (
          <div
            style={{
              marginLeft: isPhone ? 0 : 8,
              padding: isPhone ? "4px 8px" : "5px 14px",
              borderRadius: theme.radius.control,
              border: `1px solid color-mix(in srgb, var(--campaign-accent, #a78bfa) 35%, transparent)`,
              background: "color-mix(in srgb, var(--campaign-accent, #a78bfa) 10%, transparent)",
              color: "var(--campaign-accent, #a78bfa)",
              fontWeight: 700,
              fontSize: "var(--fs-medium)",
              maxWidth: isPhone ? 120 : 360,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={selectedName}
          >
            {selectedName}
          </div>
        ) : null}
      </div>

      <ToolsBar />

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, color: theme.colors.muted, fontSize: "var(--fs-medium)" }}>
        {selectedCampaignId ? <NavLink to={`/campaign/${selectedCampaignId}`} label="Campaign" /> : <NavLink to="/" label="Campaign" />}
        <NavLink to="/compendium" label="Compendium" />
        {user?.isAdmin && <NavLink to="/admin" label="Admin" />}
        {saveStatus !== "idle" && (
          <span style={{
            fontSize: "var(--fs-medium)",
            color: saveStatus === "saved" ? theme.colors.green : theme.colors.muted,
            transition: "color 300ms ease",
          }}>
            {saveStatus === "saving" ? "Saving…" : "Saved ✓"}
          </span>
        )}
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-medium)" }}>
            {!isPhone && (
              <HeaderActionLink to="/profile" color={theme.colors.muted} title="Account settings">
                {user.name}
              </HeaderActionLink>
            )}
            <HeaderActionButton
              onClick={logout}
              title={isPhone ? `Sign out (${user.name})` : undefined}
              color={theme.colors.muted}
              borderColor={theme.colors.panelBorder}
              padding="4px 8px"
              borderRadius={theme.radius.control}
              fontSize="inherit"
            >
              Sign out
            </HeaderActionButton>
          </div>
        )}
        <StatusDot
          active={connected}
          activeColor={theme.colors.green}
          inactiveColor={theme.colors.red}
          title={connected ? "Server connected" : "Server disconnected"}
        />
      </div>
    </div>
  );
}
