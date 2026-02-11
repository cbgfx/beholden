import React from "react";
import { FillPanel } from "./FillPanel";
import { Select } from "@/components/ui/Select";
import { theme } from "@/app/theme/theme";
import { api } from "@/app/services/api";

type SpellRow = {
  id: string;
  name: string;
  level: number;
  school?: string | null;
  time?: string | null;
};

type SpellDetail = {
  id: string;
  name: string;
  level: number;
  school?: string | null;
  time?: string | null;
  range?: string | null;
  duration?: string | null;
  components?: string | null;
  text?: string | null;
  source?: string | null;
};

function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/g)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function singleLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function levelLabel(level: number) {
  return level === 0 ? "Cantrip" : `L${level}`;
}

function schoolShort(s: string | null | undefined) {
  if (!s) return "";
  const t = singleLine(s).toLowerCase();
  const map: Record<string, string> = {
    abjuration: "Abj",
    conjuration: "Conj",
    divination: "Div",
    enchantment: "Ench",
    evocation: "Evo",
    illusion: "Ill",
    necromancy: "Nec",
    transmutation: "Trans"
  };
  return map[t] ?? titleCase(t);
}

function timeShort(s: string | null | undefined) {
  if (!s) return "";
  return singleLine(s);
}

export function SpellsPanel() {
  const [q, setQ] = React.useState("");
  const [level, setLevel] = React.useState<string>("all");
  const [rows, setRows] = React.useState<SpellRow[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [detail, setDetail] = React.useState<SpellDetail | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const out = await api<SpellRow[]>(`/api/spells/search?q=${encodeURIComponent(q)}&limit=200`);
        if (!alive) return;
        const filtered = level === "all" ? out : out.filter((r) => String(r.level) === level);
        setRows(filtered);
        if (selectedId && !filtered.some((r) => r.id === selectedId)) {
          setSelectedId("");
          setDetail(null);
        }
      } catch {
        if (!alive) return;
        setRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [q, level, selectedId]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!selectedId) {
        setDetail(null);
        return;
      }
      try {
        const s = await api<SpellDetail>(`/api/spells/${selectedId}`);
        if (!alive) return;
        setDetail(s);
      } catch {
        if (!alive) return;
        setDetail(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0, height: "100%" }}>
      <FillPanel
        title="Spells"
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Select value={level} onChange={(e) => setLevel(e.target.value)} style={{ width: 120 }}>
              <option value="all">All levels</option>
              {Array.from({ length: 10 }).map((_, i) => (
                <option key={i} value={String(i)}>
                  {i === 0 ? "Cantrip" : `Level ${i}`}
                </option>
              ))}
            </Select>
          </div>
        }
        style={{ flex: "0 0 330px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            style={{
              width: "100%",
              background: theme.colors.panelBg,
              border: `1px solid ${theme.colors.panelBorder}`,
              borderRadius: 10,
              padding: "8px 10px",
              color: theme.colors.text
            }}
          />

          <div className="bh-scroll" style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 12 }}>
            {rows.length ? (
              rows.map((r) => {
                const active = r.id === selectedId;
                const meta = `${levelLabel(r.level)} • ${schoolShort(r.school)}${r.time ? ` • ${timeShort(r.time)}` : ""}`;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: active ? "rgba(0,0,0,0.18)" : "transparent",
                      color: theme.colors.text,
                      border: "none",
                      borderBottom: `1px solid ${theme.colors.panelBorder}`,
                      padding: "8px 10px",
                      cursor: "pointer"
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: "var(--fs-medium)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.name}
                    </div>
                    <div
                      style={{
                        color: theme.colors.muted,
                        fontSize: "var(--fs-small)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {meta}
                    </div>
                  </button>
                );
              })
            ) : (
              <div style={{ padding: 10, color: theme.colors.muted }}>No spells found.</div>
            )}
          </div>
        </div>
      </FillPanel>

      <FillPanel title={detail ? detail.name : "Spell"} style={{ flex: 1 }}>
        <div className="bh-scroll" style={{ paddingRight: 6 }}>
          {detail ? (
            <>
              <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", marginBottom: 10 }}>
                {levelLabel(detail.level)}
                {detail.school ? ` • ${titleCase(detail.school)}` : ""}
                {detail.time ? ` • ${singleLine(detail.time)}` : ""}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
                  <strong style={{ color: theme.colors.text }}>Range:</strong> {detail.range ? singleLine(detail.range) : "—"}
                </div>
                <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
                  <strong style={{ color: theme.colors.text }}>Duration:</strong> {detail.duration ? singleLine(detail.duration) : "—"}
                </div>
                <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
                  <strong style={{ color: theme.colors.text }}>Components:</strong> {detail.components ? singleLine(detail.components) : "—"}
                </div>
                <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
                  <strong style={{ color: theme.colors.text }}>Source:</strong> {detail.source ? singleLine(detail.source) : "—"}
                </div>
              </div>

              <div className="bh-prewrap" style={{ lineHeight: 1.45, fontSize: "var(--fs-medium)" }}>
                {detail.text ? String(detail.text).trim() : "No description."}
              </div>
            </>
          ) : (
            <div style={{ color: theme.colors.muted }}>Select a spell.</div>
          )}
        </div>
      </FillPanel>
    </div>
  );
}
