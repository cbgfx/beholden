import React from "react";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { C, withAlpha } from "@/lib/theme";
import { expandSchool } from "@/lib/format/expandSchool";
import { useSpellSearch } from "@/views/CompendiumView/hooks/useSpellSearch";
import { IconSpells } from "@/ui/Icons";

function togglePill(active: boolean, gold = false): React.CSSProperties {
  const accent = gold ? C.accent : C.accentHl;
  return {
    padding: "4px 10px", borderRadius: 999,
    border: `1px solid ${active ? accent : C.panelBorder}`,
    background: active ? withAlpha(accent, 0.18) : withAlpha(C.accentHl, 0.08),
    color: active ? accent : C.muted,
    cursor: "pointer", fontSize: "var(--fs-pill)", fontWeight: 700,
  };
}

export function SpellsPanel(props: {
  selectedSpellId?: string | null;
  onSelectSpell?: (id: string) => void;
}) {
  const {
    q, setQ, level, setLevel,
    schoolFilter, setSchoolFilter, schoolOptions,
    classFilter, setClassFilter, classOptions,
    filterV, setFilterV, filterS, setFilterS, filterM, setFilterM,
    filterConcentration, setFilterConcentration,
    filterRitual, setFilterRitual,
    hasActiveFilters, clearFilters,
    rows, busy,
  } = useSpellSearch();

  return (
    <Panel
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}><IconSpells size={36} /><span>Spells</span></span>}
      actions={<div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{busy ? "Loading…" : rows.length}</div>}
      style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
    >
      {/* Search */}
      <input
        value={q} placeholder="Search…" onChange={(e) => setQ(e.target.value)}
        style={{
          background: C.panelBg, color: C.text, border: `1px solid ${C.panelBorder}`,
          borderRadius: 10, padding: "8px 10px",
          outline: "none",
        }}
      />

      {/* Level + School + Class */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <Select value={level} onChange={(e) => setLevel(e.target.value)} style={{ width: "100%" }}>
          <option value="all">All Levels</option>
          <option value="0">Cantrip</option>
          {Array.from({ length: 9 }).map((_, i) => {
            const n = i + 1;
            return <option key={n} value={String(n)}>Level {n}</option>;
          })}
        </Select>
        <Select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} style={{ width: "100%" }}>
          {schoolOptions.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All Schools" : expandSchool(s)}</option>
          ))}
        </Select>
        <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ width: "100%" }}>
          {classOptions.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All Classes" : c}</option>
          ))}
        </Select>
      </div>

      {/* V S M + Concentration + Ritual + Clear */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {([["V", filterV, setFilterV], ["S", filterS, setFilterS], ["M", filterM, setFilterM]] as const).map(
          ([label, active, setActive]) => (
            <button key={label} type="button" onClick={() => setActive(!active)} style={togglePill(active, true)}>
              {label}
            </button>
          )
        )}
        <button type="button" onClick={() => setFilterConcentration(!filterConcentration)} style={togglePill(filterConcentration)}>
          Concentration
        </button>
        <button type="button" onClick={() => setFilterRitual(!filterRitual)} style={togglePill(filterRitual)}>
          Ritual
        </button>
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} style={togglePill(false)}>Clear</button>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", border: `1px solid ${C.panelBorder}`, borderRadius: 12 }}>
        {rows.map((s) => {
          const active = s.id === (props.selectedSpellId ?? "");
          const lvl = s.level == null ? "?" : s.level === 0 ? "0" : String(s.level);
          return (
            <button
              key={s.id} type="button"
              onClick={() => props.onSelectSpell?.(s.id)}
              style={{
                display: "flex", flexDirection: "column", justifyContent: "center",
                width: "100%", textAlign: "left", padding: "9px 10px",
                border: "none", borderBottom: `1px solid ${C.panelBorder}`,
                background: active ? withAlpha(C.accentHl, 0.16) : "transparent",
                color: C.text, cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 700, lineHeight: 1.1 }}>{s.name}</div>
              <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>
                L{lvl} • {s.school ? expandSchool(s.school) : ""}
                {s.time ? ` • ${s.time}` : ""}
              </div>
            </button>
          );
        })}
        {!rows.length && <div style={{ padding: 10, color: C.muted }}>No spells found.</div>}
      </div>
    </Panel>
  );
}
