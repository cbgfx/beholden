import * as React from "react";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { C, withAlpha } from "@/lib/theme";
import { api } from "@/services/api";
import { formatCr, parseCrNumber } from "@/lib/monsterPicker/utils";
import { useMonsterPickerRows } from "@/lib/monsterPicker/useMonsterPickerRows";
import { useVirtualList } from "@/lib/monsterPicker/useVirtualList";
import type { CompendiumMonsterRow, SortMode } from "@/lib/monsterPicker/types";

const ROW_HEIGHT = 52;

function inputStyle(): React.CSSProperties {
  return {
    background: C.bg, color: C.text,
    border: `1px solid ${C.panelBorder}`,
    borderRadius: 8, padding: "7px 8px",
    fontSize: "var(--fs-subtitle)", fontFamily: "inherit", outline: "none", width: "100%",
    boxSizing: "border-box",
  };
}

function pillStyle(): React.CSSProperties {
  return {
    border: `1px solid ${C.panelBorder}`,
    background: withAlpha(C.panelBorder, 0.3),
    color: C.text, padding: "3px 8px",
    borderRadius: 999, cursor: "pointer",
    fontSize: "var(--fs-small)", fontWeight: 700,
  };
}

export function MonsterBrowserPanel(props: {
  selectedMonsterId: string | null;
  onSelectMonster: (id: string) => void;
}) {
  const [baseRows, setBaseRows] = React.useState<CompendiumMonsterRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    api<CompendiumMonsterRow[]>("/api/compendium/monsters")
      .then((rows) => { if (alive) setBaseRows(rows); })
      .catch((e) => { if (alive) setLoadError(String(e?.message ?? e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const [compQ, setCompQ] = React.useState("");
  const [sortMode, setSortMode] = React.useState<SortMode>("az");
  const [envFilter, setEnvFilter] = React.useState("all");
  const [sizeFilter, setSizeFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [crMin, setCrMin] = React.useState("");
  const [crMax, setCrMax] = React.useState("");

  const { filteredRows, envOptions, sizeOptions, typeOptions, lettersInList, letterFirstIndex } =
    useMonsterPickerRows({ rows: baseRows, compQ, sortMode, envFilter, sizeFilter, typeFilter, crMin, crMax });

  const vl = useVirtualList({ isEnabled: true, rowHeight: ROW_HEIGHT, overscan: 8 });
  const { start, end, padTop, padBottom } = vl.getRange(filteredRows.length);

  function handleClear() {
    setCompQ(""); setSortMode("az");
    setEnvFilter("all"); setSizeFilter("all"); setTypeFilter("all");
    setCrMin(""); setCrMax("");
  }

  return (
    <Panel
      title="Monsters"
      actions={
        <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
          {loading ? "Loading…" : `${filteredRows.length.toLocaleString()} / ${baseRows.length.toLocaleString()}`}
        </div>
      }
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
    >
      {/* Search */}
      <input
        value={compQ} placeholder="Search monsters…"
        onChange={(e) => setCompQ(e.target.value)}
        style={inputStyle()}
      />

      {/* Sort + filters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 6 }}>
        <Select style={{ width: "100%" }} value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
          <option value="az">A-Z</option>
          <option value="crAsc">CR (low→high)</option>
          <option value="crDesc">CR (high→low)</option>
        </Select>
        <Select style={{ width: "100%" }} value={envFilter} onChange={(e) => setEnvFilter(e.target.value)}>
          {envOptions.map((env) => (
            <option key={env} value={env}>{env === "all" ? "All environments" : env}</option>
          ))}
        </Select>
        <Select style={{ width: "100%" }} value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
          {sizeOptions.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All sizes" : s}</option>
          ))}
        </Select>
        <Select style={{ width: "100%" }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          {typeOptions.map((t) => (
            <option key={t} value={t}>{t === "all" ? "All types" : t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </Select>
      </div>

      {/* CR range */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <input value={crMin} onChange={(e) => setCrMin(e.target.value)} placeholder="CR min" style={inputStyle()} />
        <input value={crMax} onChange={(e) => setCrMax(e.target.value)} placeholder="CR max" style={inputStyle()} />
      </div>

      {/* Quick CR pills */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {[{ label: "0-1", min: "0", max: "1" }, { label: "2-4", min: "2", max: "4" },
          { label: "3-7", min: "3", max: "7" }, { label: "5-10", min: "5", max: "10" },
          { label: "11+", min: "11", max: "" }].map((r) => (
          <button key={r.label} type="button" style={pillStyle()}
            onClick={() => { setCrMin(r.min); setCrMax(r.max); }}>
            {r.label}
          </button>
        ))}
        <button type="button" style={pillStyle()} onClick={handleClear}>Clear</button>
      </div>

      {/* Letter jump */}
      {lettersInList.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {lettersInList.map((letter) => (
            <button key={letter} type="button" style={pillStyle()}
              onClick={() => {
                const idx = letterFirstIndex[letter];
                if (idx == null) return;
                const el = vl.scrollRef.current;
                if (el) el.scrollTop = idx * ROW_HEIGHT;
              }}>
              {letter}
            </button>
          ))}
        </div>
      )}

      {/* Virtual list */}
      <div
        ref={vl.scrollRef} onScroll={vl.onScroll}
        style={{ flex: 1, minHeight: 0, overflowY: "auto", border: `1px solid ${C.panelBorder}`, borderRadius: 12 }}
      >
        {loadError && <div style={{ padding: 12, color: C.red }}>Failed to load: {loadError}</div>}
        {!loading && !loadError && filteredRows.length === 0 && (
          <div style={{ padding: 12, color: C.muted }}>
            {baseRows.length === 0 ? "No compendium data loaded." : "No monsters match the current filters."}
          </div>
        )}
        {filteredRows.length > 0 && (
          <div style={{ paddingTop: padTop, paddingBottom: padBottom }}>
            {filteredRows.slice(start, end).map((m) => {
              const crLabel = m.cr != null ? `CR ${formatCr(m.cr)}` : "CR —";
              const type = m.type ? String(m.type).charAt(0).toUpperCase() + String(m.type).slice(1) : null;
              const active = m.id === props.selectedMonsterId;
              return (
                <button
                  key={m.id} type="button"
                  onClick={() => props.onSelectMonster(m.id)}
                  style={{
                    display: "flex", flexDirection: "column", justifyContent: "center",
                    height: ROW_HEIGHT, width: "100%", textAlign: "left",
                    padding: "0 12px", border: "none",
                    borderBottom: `1px solid ${C.panelBorder}`,
                    background: active ? withAlpha(C.accentHl, 0.16) : "transparent",
                    color: C.text, cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700, lineHeight: 1.15 }}>{m.name}</div>
                  <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>
                    {crLabel}{type ? ` • ${type}` : ""}{m.environment ? ` • ${m.environment}` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
