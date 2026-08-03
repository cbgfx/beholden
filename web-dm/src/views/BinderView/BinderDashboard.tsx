import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchBinderDashboard, type BinderDashboard } from "@/services/binderApi";
import { theme, withAlpha } from "@/theme/theme";

const TYPE_LABELS: Record<string, string> = { mortal: "Mortals", deity: "Deities", organization: "Organizations", continent: "Continents", country: "Countries", location: "Locations", poi: "POIs", item: "Items", event: "Events", race: "Races", position: "Positions", domain: "Domains" };
const SECTIONS: Record<string, string> = { mortal: "mortals", deity: "deities", organization: "organizations", continent: "continents", country: "countries", location: "locations", poi: "points-of-interest", item: "items", event: "events", race: "races", position: "positions", domain: "domains" };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={{ padding: 15, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, background: theme.colors.panelBg }}><h2 style={{ margin: "0 0 11px", fontSize: "var(--fs-title)" }}>{title}</h2>{children}</section>;
}
function RecordLinks({ rows }: { rows: Array<{ id: string; name: string; type?: string; route: string }> }) {
  return <div style={{ display: "grid", gap: 7 }}>{rows.map((row) => <Link key={row.id} to={row.route} style={{ display: "flex", justifyContent: "space-between", color: theme.colors.text, textDecoration: "none" }}><span>{row.name}</span>{row.type ? <span style={{ color: theme.colors.muted, textTransform: "capitalize" }}>{row.type}</span> : null}</Link>)}{!rows.length ? <span style={{ color: theme.colors.muted }}>Nothing to review.</span> : null}</div>;
}

export function BinderDashboardView({ binderId, accent, canEdit }: { binderId: string; accent: string; canEdit: boolean }) {
  const [data, setData] = useState<BinderDashboard | null>(null);
  useEffect(() => { void fetchBinderDashboard(binderId).then(setData); }, [binderId]);
  if (!data) return <div style={{ color: theme.colors.muted }}>Loading dashboard…</div>;
  return <div style={{ display: "grid", gap: 14 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 9 }}>
      {data.counts.map((entry) => <Link key={entry.type} to={`/binder/${binderId}/${SECTIONS[entry.type] ?? entry.type}`} style={{ padding: 13, border: `1px solid ${withAlpha(accent,.25)}`, borderRadius: 10, background: withAlpha(accent,.06), color: theme.colors.text, textDecoration: "none" }}><div style={{ color: theme.colors.muted }}>{TYPE_LABELS[entry.type] ?? entry.type}</div><strong style={{ fontSize: 24 }}>{entry.count}</strong></Link>)}
    </div>
    {canEdit ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{["mortals","events","items","organizations"].map((section) => <Link key={section} to={`/binder/${binderId}/${section}`} style={{ padding: "8px 11px", borderRadius: 8, background: withAlpha(accent,.12), color: accent, textDecoration: "none", fontWeight: 750 }}>+ {section}</Link>)}</div> : null}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
      <Panel title="Recent edits"><RecordLinks rows={data.recent} /></Panel>
      <Panel title="Near the current date"><RecordLinks rows={data.nearbyEvents.map((row) => ({ ...row, name: `${row.dateText ?? "Undated"} — ${row.name}` }))} /></Panel>
      <Panel title={`Needs description (${data.incomplete.length})`}><RecordLinks rows={data.incomplete} /></Panel>
      <Panel title="Review queue"><div style={{ display: "grid", gap: 8 }}><Link to={`/binder/${binderId}/mortals`} style={{ color: theme.colors.text }}>{data.unlinkedNpcCount} Binder NPCs unused in campaigns</Link><Link to={`/binder/${binderId}/events`} style={{ color: theme.colors.text }}>{data.undatedEventCount} undated Events</Link></div></Panel>
    </div>
  </div>;
}
