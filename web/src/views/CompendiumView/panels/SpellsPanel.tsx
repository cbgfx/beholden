import React from "react";
import { Panel } from "@/components/ui/Panel";
import { theme } from "@/app/theme/theme";
import { api } from "@/app/services/api";
import { titleCase } from "@/lib/format/titleCase";

type SpellRow = {
  id: string;
  name: string;
  level: number | null;
  school: string | null;
  time: string | null;
};

export function SpellsPanel(props: {
  selectedSpellId: string;
  onSelectSpell: (id: string) => void;
}) {
  const [q, setQ] = React.useState("");
  const [level, setLevel] = React.useState<string>("all");
  const [rows, setRows] = React.useState<SpellRow[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setBusy(true);
      try {
        const res = await api<SpellRow[]>(`/api/spells/search?q=${encodeURIComponent(q)}&limit=200`);
        if (cancelled) return;
        setRows(Array.isArray(res) ? res : []);
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
  }, [q]);

  const filtered = React.useMemo(() => {
    const lv = level === "all" ? null : Number(level);
    if (lv == null || !Number.isFinite(lv)) return rows;
    return rows.filter((r) => Number(r.level ?? -1) === lv);
  }, [rows, level]);

  return (
    <Panel title="Spells" actions={<div style={{ color: theme.colors.muted, fontSize: 12 }}>{busy ? "Loading…" : `${filtered.length}`}</div>}>
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
          height: "calc(100vh - 320px)",
          overflow: "auto",
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: 12,
        }}
      >
        {filtered.map((s) => {
          const active = s.id === props.selectedSpellId;
          const lvl = s.level == null ? "?" : s.level === 0 ? "0" : String(s.level);
          return (
            <button
              key={s.id}
              onClick={() => props.onSelectSpell(s.id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 10px",
                border: "none",
                borderBottom: `1px solid ${theme.colors.panelBorder}`,
                background: active ? theme.colors.pillActiveBg : "transparent",
                color: theme.colors.text,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 700, lineHeight: 1.1 }}>{s.name}</div>
              <div style={{ color: theme.colors.muted, fontSize: 12, marginTop: 2 }}>
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
