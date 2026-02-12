import React from "react";
import { Panel } from "@/components/ui/Panel";
import { IconSpells } from "@/components/icons";
import { theme } from "@/app/theme/theme";
import { api } from "@/app/services/api";
import { titleCase } from "@/lib/format/titleCase";
import { useStore } from "@/app/store";

type SpellRow = {
  id: string;
  name: any;
  level: number | null;
  school: string | null;
  time: string | null;
};

export function SpellsPanel() {
  const { dispatch } = useStore();
  const [activeId, setActiveId] = React.useState<string>("");
  const [q, setQ] = React.useState("");
  const [level, setLevel] = React.useState<string>("all");
  const [rows, setRows] = React.useState<SpellRow[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setBusy(true);
      try {
        const lv = level === "all" ? "" : `&level=${encodeURIComponent(level)}`;
        const res = await api<SpellRow[]>(`/api/spells/search?q=${encodeURIComponent(q)}&limit=500${lv}`);
        if (cancelled) return;
        const cleaned = (Array.isArray(res) ? res : [])
          .map((r: any) => ({
            id: typeof r?.id === "string" ? r.id : "",
            name: typeof r?.name === "string" ? r.name : (r?.name != null ? String(r.name) : ""),
            level: r?.level == null ? null : Number(r.level),
            school: r?.school == null ? null : String(r.school),
            time: r?.time == null ? null : String(r.time)
          }))
          // Defensive: some imports can yield a literal "[object Object]" name.
          .filter((r) => r.id && r.name && r.name !== "[object Object]");
        setRows(cleaned);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    // tiny debounce so typing feels good
    const t = window.setTimeout(run, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, level]);

  // Note: when a level is selected we ask the server to filter as well.
  const filtered = rows;

  return (
    <Panel
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}><IconSpells size={36} title="Spells" /><span>Spells</span></span>}
      actions={<div style={{ color: theme.colors.muted, fontSize: 12 }}>{busy ? "Loading…" : `${filtered.length}`}</div>}
      // Keep this panel a sane size even if the parent layout doesn't provide a bounded height.
      style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
      bodyStyle={{ display: "flex", flexDirection: "column" }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input
          value={q}
          placeholder="Search…"
          onChange={(e) => setQ(e.target.value)}
          style={{
            flex: 1,
            background: theme.colors.panelBg,
            color: theme.colors.text,
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 10,
            padding: "8px 10px",
            outline: "none",
          }}
        />
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          style={{
            background: theme.colors.panelBg,
            color: theme.colors.text,
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 10,
            padding: "8px 10px",
            minWidth: 110,
          }}
          title="Filter by level"
        >
          <option value="all">All levels</option>
          <option value="0">0 (Cantrip)</option>
          {Array.from({ length: 9 }).map((_, i) => {
            const n = i + 1;
            return (
              <option key={n} value={String(n)}>
                Level {n}
              </option>
            );
          })}
        </select>
      </div>

      <div
        style={{
          // Bounded, scrollable list (avoid "page becomes 3000px tall")
          maxHeight: "60vh",
          overflowY: "auto",
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: 12,
        }}
      >
        {filtered.map((s) => {
          const active = s.id === activeId;
          const lvl = s.level == null ? "?" : s.level === 0 ? "0" : String(s.level);
          const safeName = typeof (s as any).name === "string" ? (s as any).name : String((s as any).name ?? "");
          return (
            <button
              key={s.id}
              onClick={() => {
                setActiveId(s.id);
                dispatch({
                  type: "openDrawer",
                  drawer: { type: "viewSpell", spellId: s.id, title: safeName }
                });
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 10px",
                border: "none",
                borderBottom: `1px solid ${theme.colors.panelBorder}`,
                background: active ? theme.colors.panelBg : "transparent",
                color: theme.colors.text,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 700, lineHeight: 1.1 }}>{safeName}</div>
              <div
                style={{
                  color: theme.colors.muted,
                  fontSize: 12,
                  marginTop: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                L{lvl} • {s.school ? titleCase(String(s.school)) : ""}
                {s.time ? ` • ${s.time}` : ""}
              </div>
            </button>
          );
        })}
        {!filtered.length ? <div style={{ padding: 10, color: theme.colors.muted }}>No spells found.</div> : null}
      </div>
    </Panel>
  );
}
