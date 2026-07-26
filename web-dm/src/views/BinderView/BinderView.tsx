import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  IconBinder,
  IconCampaign,
  IconChest,
  IconEncounter,
  IconPlayers,
  IconPlayer,
  IconShield,
  IconSpells,
  IconTargeted,
  IconGreekTemple,
  IconOrganigram,
  IconAntarctica,
  IconFlyingFlag,
  IconVillage,
  IconDna1,
} from "@/icons";
import { theme, withAlpha } from "@/theme/theme";
import type { Campaign } from "@/domain/types/domain";
import type { BinderSummary } from "@/services/binderApi";
import type { BinderReferenceType } from "@/services/binderReferenceApi";
import { ReferenceWorkspace } from "@/views/BinderView/ReferenceWorkspace";
import { MortalWorkspace } from "@/views/BinderView/MortalWorkspace";
import { BinderPlayersWorkspace } from "@/views/BinderView/BinderPlayersWorkspace";

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  columns: string[];
};

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "",
    items: [
      { id: "campaigns", label: "Campaigns", icon: <IconCampaign size={20} />, color: "#3b82f6", columns: ["Name", "Current date", "Players"] },
    ],
  },
  {
    label: "People",
    items: [
      { id: "players", label: "Players", icon: <IconPlayer size={20} />, color: "#f97316", columns: ["Character", "Player", "Campaign", "Sheet", "Binder Mortal"] },
      { id: "mortals", label: "Mortals", icon: <IconPlayers size={20} />, color: "#ef5350", columns: ["Name", "Position", "Organization", "Location", "Species", "Status", "Gender", "Age"] },
      { id: "deities", label: "Deities", icon: <IconGreekTemple size={20} />, color: "#a78bfa", columns: ["Name", "Domains", "Organizations", "Visibility"] },
    ],
  },
  {
    label: "Reference",
    items: [
      { id: "races", label: "Races", icon: <IconDna1 size={20} />, color: "#fb923c", columns: ["Name", "Description", "Mortals"] },
      { id: "positions", label: "Positions", icon: <IconShield size={20} />, color: "#fbbf24", columns: ["Name", "Organizations", "Members"] },
      { id: "organizations", label: "Organizations", icon: <IconOrganigram size={20} />, color: "#60a5fa", columns: ["Name", "Members", "Headquarters", "Visibility"] },
      { id: "domains", label: "Domains", icon: <IconSpells size={20} />, color: "#c084fc", columns: ["Name", "Deities", "Description"] },
    ],
  },
  {
    label: "Places",
    items: [
      { id: "continents", label: "Continents", icon: <IconAntarctica size={20} />, color: "#34d399", columns: ["Name", "Countries", "Description"] },
      { id: "countries", label: "Countries", icon: <IconFlyingFlag size={20} />, color: "#2dd4bf", columns: ["Name", "Continent", "Locations", "Description"] },
      { id: "locations", label: "Locations", icon: <IconVillage size={20} />, color: "#22c55e", columns: ["Name", "Country", "Residents", "Description"] },
      { id: "points-of-interest", label: "Points of Interest", icon: <IconTargeted size={20} />, color: "#84cc16", columns: ["Name", "Parent", "Type", "Description"] },
    ],
  },
  {
    label: "",
    items: [
      { id: "items", label: "Items", icon: <IconChest size={20} />, color: "#f59e0b", columns: ["Name", "Holder", "Location", "Visibility"] },
      { id: "events", label: "Events", icon: <IconEncounter size={20} />, color: "#f43f5e", columns: ["Title", "Date", "Related records", "Campaigns", "Visibility"] },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

function EmptyTable({ item, accent }: { item: NavItem; accent: string }) {
  return (
    <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${item.columns.length}, minmax(130px, 1fr))`,
          minWidth: 680,
          padding: "11px 14px",
          background: `linear-gradient(90deg, ${withAlpha(accent, 0.15)}, rgba(255,255,255,0.055))`,
          boxShadow: `inset 0 2px 0 ${withAlpha(accent, 0.75)}`,
          borderBottom: `1px solid ${theme.colors.panelBorder}`,
        }}
      >
        {item.columns.map((column) => (
          <div key={column} style={{ color: theme.colors.text, fontSize: "var(--fs-subtitle)", fontWeight: 750 }}>{column}</div>
        ))}
      </div>
      <div style={{ padding: "48px 20px", color: theme.colors.muted, textAlign: "center", fontSize: "var(--fs-medium)" }}>
        No {item.label.toLowerCase()} yet. Typed records are the next implementation slice.
      </div>
    </div>
  );
}

function CampaignTable({ campaigns, accent }: { campaigns: Campaign[]; accent: string }) {
  return (
    <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) 180px 110px", padding: "12px 15px", background: `linear-gradient(90deg, ${withAlpha(accent, 0.15)}, rgba(255,255,255,0.055))`, boxShadow: `inset 0 2px 0 ${withAlpha(accent, 0.75)}`, borderBottom: `1px solid ${theme.colors.panelBorder}` }}>
        {["Name", "Current date", "Players"].map((column) => (
          <div key={column} style={{ color: theme.colors.text, fontSize: "var(--fs-subtitle)", fontWeight: 750 }}>{column}</div>
        ))}
      </div>
      {campaigns.length ? campaigns.map((campaign) => (
        <Link
          key={campaign.id}
          to={`/campaign/${campaign.id}`}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(240px, 1fr) 180px 110px",
            padding: "12px 14px",
            color: theme.colors.text,
            textDecoration: "none",
            borderBottom: `1px solid ${theme.colors.panelBorder}`,
          }}
        >
          <span style={{ fontWeight: 700 }}>{campaign.name}</span>
          <span style={{ color: theme.colors.muted }}>{campaign.currentDate?.text ?? "—"}</span>
          <span style={{ color: theme.colors.muted }}>{campaign.playerCount ?? 0}</span>
        </Link>
      )) : (
        <div style={{ padding: "48px 20px", color: theme.colors.muted, textAlign: "center" }}>
          No campaigns are assigned to this Binder.
        </div>
      )}
    </div>
  );
}

const REFERENCE_TYPES = new Set<BinderReferenceType>([
  "races", "positions", "domains", "organizations", "deities",
  "continents", "countries", "locations", "points-of-interest",
]);

export function BinderView({ binder, campaigns, canEdit, onRecordsChanged }: { binder: BinderSummary; campaigns: Campaign[]; canEdit: boolean; onRecordsChanged: () => Promise<void> }) {
  const location = useLocation();
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const routeSection = location.pathname.split("/")[3] ?? "overview";
  const routeRecordId = location.pathname.split("/")[4];
  const activeItem = ALL_ITEMS.find((item) => item.id === routeSection);
  const title = activeItem?.label ?? binder.name;
  const accent = binder.color || theme.colors.accentHighlight;

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "20px 18px 36px" }}>
      <div style={{ width: "100%", display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", gap: 28 }}>
        <aside
          style={{
            position: "sticky",
            top: 20,
            alignSelf: "start",
            display: "grid",
            gap: 14,
            padding: 14,
            borderRadius: theme.radius.panel,
            border: `1px solid ${withAlpha(accent, 0.14)}`,
            background: "rgba(0,0,0,0.13)",
            boxShadow: "0 12px 34px rgba(0,0,0,0.14)",
          }}
        >
          <Link to={`/binder/${binder.id}`} style={{ display: "flex", gap: 11, alignItems: "center", color: theme.colors.text, textDecoration: "none", fontWeight: 850, fontSize: "calc(var(--fs-title) * 1.08)", padding: "3px 6px 7px" }}>
            <span style={{ color: accent, display: "grid" }}><IconBinder size={30} /></span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{binder.name}</span>
          </Link>

          <nav style={{ display: "grid", gap: 15 }}>
            {NAV_GROUPS.map((group, groupIndex) => (
              <div key={`${group.label}-${groupIndex}`} style={{ display: "grid", gap: 4 }}>
                {group.label ? (
                  <div style={{ padding: "2px 10px 5px", color: "rgba(232,237,245,0.55)", fontSize: "var(--fs-small)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {group.label}
                  </div>
                ) : null}
                {group.items.map((item) => {
                  const active = routeSection === item.id;
                  const hovered = hoveredNav === item.id;
                  return (
                    <Link
                      key={item.id}
                      to={`/binder/${binder.id}/${item.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "9px 10px",
                        borderRadius: theme.radius.control,
                        color: active || hovered ? theme.colors.text : "rgba(232,237,245,0.76)",
                        background: active
                          ? withAlpha(accent, 0.15)
                          : hovered
                            ? withAlpha(accent, 0.08)
                            : "transparent",
                        border: `1px solid ${active ? withAlpha(accent, 0.42) : hovered ? withAlpha(accent, 0.2) : "transparent"}`,
                        boxShadow: active ? `inset 3px 0 0 ${accent}` : "none",
                        transform: hovered && !active ? "translateX(3px)" : "none",
                        textDecoration: "none",
                        fontSize: "var(--fs-body)",
                        fontWeight: active ? 760 : 520,
                        transition: "background 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease",
                      }}
                      onMouseEnter={() => setHoveredNav(item.id)}
                      onMouseLeave={() => setHoveredNav(null)}
                    >
                      <span
                        style={{
                          color: item.color,
                          display: "grid",
                          opacity: active || hovered ? 1 : 0.82,
                          filter: active || hovered ? `drop-shadow(0 0 6px ${withAlpha(item.color, 0.25)})` : "none",
                        }}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <main style={{ minWidth: 0, display: "grid", alignContent: "start", gap: 16 }}>
          <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end", minHeight: 56 }}>
            <div>
              <h1 style={{ margin: 0, color: theme.colors.text, fontSize: "calc(var(--fs-hero) * 1.08)", textShadow: `0 0 28px ${withAlpha(accent, 0.13)}` }}>{title}</h1>
              {!activeItem ? <div style={{ color: withAlpha(accent, 0.8), marginTop: 4, fontSize: "var(--fs-medium)" }}>
                {binder.currentDate.text ? `Setting date: ${binder.currentDate.text}` : "No setting date set"}
              </div> : null}
            </div>
          </header>

          {!activeItem ? (
            <>
              {binder.description ? <div style={{ color: theme.colors.muted, lineHeight: 1.5 }}>{binder.description}</div> : null}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                <Link to={`/binder/${binder.id}/campaigns`} style={{ padding: 16, borderRadius: theme.radius.panel, border: `1px solid ${theme.colors.panelBorder}`, background: theme.colors.panelBg, color: theme.colors.text, textDecoration: "none" }}>
                  <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>Campaigns</div>
                  <div style={{ fontSize: 28, fontWeight: 850, marginTop: 3 }}>{campaigns.length}</div>
                </Link>
                <div style={{ padding: 16, borderRadius: theme.radius.panel, border: `1px solid ${theme.colors.panelBorder}`, background: theme.colors.panelBg }}>
                  <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>Records</div>
                  <div style={{ fontSize: 28, fontWeight: 850, marginTop: 3 }}>{binder.recordCount}</div>
                </div>
              </div>
            </>
          ) : activeItem.id === "campaigns" ? (
            <CampaignTable campaigns={campaigns} accent={accent} />
          ) : activeItem.id === "mortals" ? (
            <MortalWorkspace binderId={binder.id} binderCurrentDate={binder.currentDate.sort} recordId={routeRecordId} accent={activeItem.color} canEdit={canEdit} onRecordsChanged={onRecordsChanged} />
          ) : activeItem.id === "players" ? (
            <BinderPlayersWorkspace binderId={binder.id} binderCurrentDate={binder.currentDate.sort} accent={activeItem.color} />
          ) : REFERENCE_TYPES.has(activeItem.id as BinderReferenceType) ? (
            <ReferenceWorkspace
              binderId={binder.id}
              type={activeItem.id as BinderReferenceType}
              recordId={routeRecordId}
              accent={activeItem.color}
              canEdit={canEdit}
              onRecordsChanged={onRecordsChanged}
            />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <EmptyTable item={activeItem} accent={accent} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
