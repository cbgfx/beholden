import React from "react";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { IconSpells } from "@/icons";
import { theme } from "@/theme/theme";
import { titleCase } from "@/lib/format/titleCase";
import { useStore } from "@/store";
import { useSpellSearch } from "@/views/CompendiumView/hooks/useSpellSearch";

export function SpellsPanel() {
  const { dispatch } = useStore();
  const [activeId, setActiveId] = React.useState<string>("");
  const { q, setQ, level, setLevel, rows, busy } = useSpellSearch();

  const filtered = rows;

  return (
    <Panel
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}>
          <IconSpells size={36} title="Spells" />
          <span>Spells</span>
        </span>
      }
      actions={<div style={{ color: theme.colors.muted, fontSize: 12 }}>{busy ? "Loading…" : `${filtered.length}`}</div>}
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
        <Select value={level} onChange={(e) => setLevel(e.target.value)} style={{ minWidth: 110 }} title="Filter by level">
          <option value="all">All Levels</option>
          <option value="0">Cantrip</option>
          {Array.from({ length: 9 }).map((_, i) => {
            const n = i + 1;
            return (
              <option key={n} value={String(n)}>
                Level {n}
              </option>
            );
          })}
        </Select>
      </div>

      <div
        style={{
          maxHeight: "60vh",
          overflowY: "auto",
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: 12,
        }}
      >
        {filtered.map((s) => {
          const active = s.id === activeId;
          const lvl = s.level == null ? "?" : s.level === 0 ? "0" : String(s.level);
          const safeName = typeof s.name === "string" ? s.name : String((s as any).name ?? "");
          return (
            <button
              key={s.id}
              onClick={() => {
                setActiveId(s.id);
                dispatch({
                  type: "openDrawer",
                  drawer: { type: "viewSpell", spellId: s.id, title: safeName },
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
