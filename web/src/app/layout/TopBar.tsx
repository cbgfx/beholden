
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { IconPencil, IconTrash } from "@/components/icons";
import { useStore } from "@/app/store";
import { theme } from "@/app/theme/theme";


function NavLink(props: { to: string; label: string }) {
  const loc = useLocation();
  const active = loc.pathname === props.to || (props.to !== "/" && loc.pathname.startsWith(props.to + "/")) || (props.to === "/" && loc.pathname === "/");
  return (
    <Link
      to={props.to}
      style={{
        textDecoration: "none",
        color: active ? "#0b0f14" : theme.colors.text,
        background: active ? theme.colors.accent : "rgba(0,0,0,0.18)",
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

export function TopBar(props: { onCreateCampaign: () => void; onSelectCampaign: (id: string) => void; onEditCampaign: (id: string) => void; onDeleteCampaign: (id: string) => void; }) {
  const { state } = useStore();
  const { campaigns, selectedCampaignId, meta } = state;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img src="/beholden_logo.png" alt="Beholden" style={{ width: 50, height: 50 }} />
        <div style={{ fontSize: "var(--fs-hero)", fontWeight: 900, color: theme.colors.text }}>Beholden</div>
      </div>

      {campaigns.length ? (
        <>
          <Select value={selectedCampaignId} onChange={(e) => props.onSelectCampaign(e.target.value)} style={{ minWidth: 220,     background: theme.colors.panelBg,
    color: theme.colors.text,
    border: `2px solid ${theme.colors.accent}`,
    borderRadius: 8,
    padding: "6px 10px",
    fontWeight: 700,
    cursor: "pointer" }}>
            {campaigns.map(c => <option key={c.id} value={c.id} style={{
        background:
          c.id === state.selectedCampaignId
            ? theme.colors.accent
            : theme.colors.panelBg,
        color:
          c.id === state.selectedCampaignId
            ? "#000"
            : theme.colors.text,
        fontWeight: c.id === state.selectedCampaignId ? 800 : 500
      }}>{c.name}</option>)}
          </Select>
          <Button onClick={props.onCreateCampaign}>+ Campaign</Button>
        <IconButton onClick={() => props.onEditCampaign(selectedCampaignId)} title="edit"><IconPencil /></IconButton>
        <IconButton onClick={() => props.onDeleteCampaign(selectedCampaignId)} title="delete"><IconTrash /></IconButton>
        </>
      ) : (
        <Button onClick={props.onCreateCampaign}>Create first campaign</Button>
      )}

      <div style={{ marginLeft: "auto", color: theme.colors.muted, fontSize: "var(--fs-medium)" }}>
              {selectedCampaignId ? <NavLink to={`/campaign/${selectedCampaignId}`} label="Campaign" /> : <NavLink to="/" label="Campaign" /> }
      <NavLink to="/compendium" label="Compendium" />
        {meta?.ips?.length ? <> {meta.ips.map((ip) => <code key={ip} style={{ marginLeft: 6 }}>{ip}</code>)}:5173</> : null}
      </div>
    </div>
  );
}
