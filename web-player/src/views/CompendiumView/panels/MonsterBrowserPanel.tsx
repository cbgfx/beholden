import * as React from "react";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { C, withAlpha } from "@/lib/theme";
import { api } from "@/services/api";
import { formatCr } from "@/lib/monsterPicker/utils";
import { useVirtualList } from "@/lib/monsterPicker/useVirtualList";
import type { CompendiumMonsterRow, SortMode } from "@/lib/monsterPicker/types";
import { SIZE_LABELS } from "@/lib/monsterPicker/useMonsterPickerRows";

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

function normalizeSortName(name: string): string {
  return name
    .trim()
    .replace(/^[^a-z0-9]+/i, "")
    .replace(/^the\s+/i, "")
    .trim();
}

export function MonsterBrowserPanel(props: {
  selectedMonsterId: string | null;
  onSelectMonster: (id: string) => void;
}) {
  const [rows, setRows] = React.useState<CompendiumMonsterRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [totalRows, setTotalRows] = React.useState(0);
  const [envOptions, setEnvOptions] = React.useState<string[]>(["all"]);
  const [sizeOptions, setSizeOptions] = React.useState<string[]>(["all"]);
  const [typeOptions, setTypeOptions] = React.useState<string[]>(["all"]);

  const [compQ, setCompQ] = React.useState("");
  const [sortMode, setSortMode] = React.useState<SortMode>("az");
  const [envFilter, setEnvFilter] = React.useState("all");
  const [sizeFilter, setSizeFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [crMin, setCrMin] = React.useState("");
  const [crMax, setCrMax] = React.useState("");

  React.useEffect(() => {
    const controller = new AbortController();
    api<{ environments: string[]; sizes: string[]; types: string[] }>("/api/compendium/monsters/facets", {
      signal: controller.signal,
    })
      .then((data) => {
        const nextEnv = Array.isArray(data?.environments) ? data.environments : [];
        const nextSizesRaw = Array.isArray(data?.sizes) ? data.sizes : [];
        const nextTypes = Array.isArray(data?.types) ? data.types : [];
        const sizeOrder = new Map<string, number>(SIZE_LABELS.map((size, index) => [size, index]));
        const nextSizes = [...nextSizesRaw].sort((a, b) => {
          const aOrder = sizeOrder.get(a);
          const bOrder = sizeOrder.get(b);
          if (aOrder != null && bOrder != null) return aOrder - bOrder;
          if (aOrder != null) return -1;
          if (bOrder != null) return 1;
          return a.localeCompare(b);
        });
        setEnvOptions(["all", ...nextEnv]);
        setSizeOptions(["all", ...nextSizes]);
        setTypeOptions(["all", ...nextTypes]);
      })
      .catch(() => {
        setEnvOptions(["all"]);
        setSizeOptions(["all"]);
        setTypeOptions(["all"]);
      });
    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({
          q: compQ,
          limit: "400",
          offset: "0",
          withTotal: "1",
          sort: sortMode,
        });
        if (envFilter !== "all") params.set("env", envFilter);
        if (sizeFilter !== "all") params.set("sizes", sizeFilter);
        if (typeFilter !== "all") params.set("types", typeFilter);
        if (crMin.trim()) params.set("crMin", crMin.trim());
        if (crMax.trim()) params.set("crMax", crMax.trim());

        const result = await api<{ rows: CompendiumMonsterRow[]; total: number }>(
          `/api/compendium/search?${params.toString()}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        const nextRows = Array.isArray(result?.rows) ? result.rows : [];
        setRows(nextRows);
        setTotalRows(Number.isFinite(result?.total as number) ? Number(result.total) : nextRows.length);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRows([]);
        setTotalRows(0);
        setLoadError(String((error as any)?.message ?? error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [compQ, sortMode, envFilter, sizeFilter, typeFilter, crMin, crMax]);

  const filteredRows = rows;

  const lettersInList = React.useMemo(() => {
    const set = new Set<string>();
    for (const row of filteredRows) {
      const first = normalizeSortName(String(row.name ?? "")).charAt(0).toUpperCase();
      if (first >= "A" && first <= "Z") set.add(first);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [filteredRows]);

  const letterFirstIndex = React.useMemo(() => {
    const out: Record<string, number> = {};
    for (let i = 0; i < filteredRows.length; i += 1) {
      const first = normalizeSortName(String(filteredRows[i].name ?? "")).charAt(0).toUpperCase();
      if (!(first >= "A" && first <= "Z")) continue;
      if (out[first] == null) out[first] = i;
    }
    return out;
  }, [filteredRows]);

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
          {loading ? "Loading..." : `${filteredRows.length.toLocaleString()} / ${totalRows.toLocaleString()}`}
        </div>
      }
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
    >
      <input
        value={compQ} placeholder="Search monsters..."
        onChange={(e) => setCompQ(e.target.value)}
        style={inputStyle()}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 6 }}>
        <Select style={{ width: "100%" }} value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
          <option value="az">A-Z</option>
          <option value="crAsc">CR (low to high)</option>
          <option value="crDesc">CR (high to low)</option>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <input value={crMin} onChange={(e) => setCrMin(e.target.value)} placeholder="CR min" style={inputStyle()} />
        <input value={crMax} onChange={(e) => setCrMax(e.target.value)} placeholder="CR max" style={inputStyle()} />
      </div>

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

      <div
        ref={vl.scrollRef} onScroll={vl.onScroll}
        style={{ flex: 1, minHeight: 0, overflowY: "auto", border: `1px solid ${C.panelBorder}`, borderRadius: 12 }}
      >
        {loadError && <div style={{ padding: 12, color: C.red }}>Failed to load: {loadError}</div>}
        {!loading && !loadError && filteredRows.length === 0 && (
          <div style={{ padding: 12, color: C.muted }}>
            {totalRows === 0 ? "No compendium data loaded." : "No monsters match the current filters."}
          </div>
        )}
        {filteredRows.length > 0 && (
          <div style={{ paddingTop: padTop, paddingBottom: padBottom }}>
            {filteredRows.slice(start, end).map((m) => {
              const crLabel = m.cr != null ? `CR ${formatCr(m.cr)}` : "CR -";
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
                    {crLabel}{type ? ` - ${type}` : ""}{m.environment ? ` - ${m.environment}` : ""}
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
