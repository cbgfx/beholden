
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
      style={navLinkStyle(active, theme.colors.colorGold, theme.colors.muted, { borderRadius: theme.radius.control })}
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
  const rootLayoutStyle = isPhone
    ? { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }
    : {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
        alignItems: "center",
        columnGap: 10,
        width: "100%",
      };

  return (
    <div style={rootLayoutStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: isPhone ? 40 : 52,
            height: isPhone ? 40 : 52,
            borderRadius: 12,
            border: "1px solid rgba(251,191,36,0.42)",
            background: "linear-gradient(180deg, rgba(251,191,36,0.14), rgba(255,255,255,0.02))",
            boxShadow: "0 10px 22px rgba(251,191,36,0.16)",
            flexShrink: 0,
          }}
        >
          <img src="/beholden_logo.png" alt="Beholden" style={{ width: isPhone ? 28 : 40, height: isPhone ? 28 : 40 }} />
        </span>
        {!isPhone && (
          <Link
            to="/"
            style={{
              fontSize: "var(--fs-hero)",
              fontWeight: 900,
              color: theme.colors.text,
              textDecoration: "none",
              textShadow: "0 2px 16px rgba(56,182,255,0.15)",
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
              border: "1px solid rgba(251,191,36,0.40)",
              background: "linear-gradient(180deg, rgba(251,191,36,0.18), rgba(251,191,36,0.08))",
              color: theme.colors.colorGold,
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

      <div style={isPhone ? undefined : { justifySelf: "center" }}>
        <ToolsBar />
      </div>

      <div
        style={{
          marginLeft: isPhone ? "auto" : 0,
          justifySelf: isPhone ? undefined : "end",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
          color: theme.colors.muted,
          fontSize: "var(--fs-medium)",
        }}
      >
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
