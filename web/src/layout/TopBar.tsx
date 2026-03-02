
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useStore } from "@/store";
import { theme, withAlpha } from "@/theme/theme";


function NavLink(props: { to: string; label: string }) {
  const loc = useLocation();
  const active = loc.pathname === props.to || (props.to !== "/" && loc.pathname.startsWith(props.to + "/")) || (props.to === "/" && loc.pathname === "/");
  return (
    <Link
      to={props.to}
      style={{
        textDecoration: "none",
        color: active ? theme.colors.textDark : theme.colors.text,
        background: active ? theme.colors.accentPrimary : withAlpha(theme.colors.panelBorder, 0.18),
        border: `1px solid ${theme.colors.panelBorder}`,
        padding: "8px 10px",
        borderRadius: theme.radius.control,
        fontWeight: 900
      }}
    >
      {props.label}
    </Link>
  );
}

export function TopBar() {
  const { state } = useStore();
  const { campaigns, selectedCampaignId } = state;
  const selectedName = campaigns.find((c) => c.id === selectedCampaignId)?.name ?? "";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img src="/beholden_logo.png" alt="Beholden" style={{ width: 50, height: 50 }} />
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

        {selectedCampaignId && selectedName ? (
          <div
            style={{
              marginLeft: 8,
              padding: "6px 10px",
              borderRadius: theme.radius.control,
              border: `1px solid ${withAlpha(theme.colors.panelBorder, 0.6)}`,
              background: withAlpha(theme.colors.panelBg, 0.25),
              color: theme.colors.muted,
              fontWeight: 800,
              maxWidth: 360,
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

      <div style={{ marginLeft: "auto", color: theme.colors.muted, fontSize: "var(--fs-medium)" }}>
        {selectedCampaignId ? <NavLink to={`/campaign/${selectedCampaignId}`} label="Campaign" /> : <NavLink to="/" label="Campaign" />}
        <NavLink to="/compendium" label="Compendium" />
      </div>
    </div>
  );
}
