import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchBinderHealth, type BinderHealth } from "@/services/binderApi";
import { theme, withAlpha } from "@/theme/theme";

export function BinderHealthWorkspace({ binderId, accent }: { binderId: string; accent: string }) {
  const [health, setHealth] = useState<BinderHealth | null>(null);
  useEffect(() => { void fetchBinderHealth(binderId).then(setHealth); }, [binderId]);
  if (!health) return <div style={{ color: theme.colors.muted }}>Checking Binder health…</div>;
  return <div style={{ display: "grid", gap: 14 }}>
    <div style={{ padding: 18, borderRadius: theme.radius.panel, border: `1px solid ${withAlpha(health.healthy ? theme.colors.green : accent,.35)}`, background: withAlpha(health.healthy ? theme.colors.green : accent,.07) }}>
      <strong style={{ fontSize: "var(--fs-title)" }}>{health.healthy ? "Binder looks healthy" : `${health.issueCount} item${health.issueCount === 1 ? "" : "s"} to review`}</strong>
      <div style={{ color: theme.colors.muted, marginTop: 5 }}>Diagnostics are non-destructive. Open a record to decide how it should be corrected.</div>
    </div>
    {health.groups.map((group) => <section key={group.code} style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, overflow: "hidden", background: theme.colors.panelBg }}>
      <header style={{ padding: "11px 14px", display: "flex", justifyContent: "space-between", background: withAlpha(group.severity === "warning" ? theme.colors.red : accent,.07) }}><strong>{group.title}</strong><span style={{ color: theme.colors.muted }}>{group.issues.length}</span></header>
      {group.issues.map((issue, index) => <Link key={`${issue.id}-${index}`} to={issue.route} style={{ padding: "11px 14px", display: "grid", gridTemplateColumns: "minmax(180px,1fr) 2fr", gap: 12, borderTop: `1px solid ${theme.colors.panelBorder}`, color: theme.colors.text, textDecoration: "none" }}><strong>{issue.name}</strong><span style={{ color: theme.colors.muted }}>{issue.detail}</span></Link>)}
      {!group.issues.length ? <div style={{ padding: "12px 14px", color: theme.colors.muted }}>No issues found.</div> : null}
    </section>)}
  </div>;
}
