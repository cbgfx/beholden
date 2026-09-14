import * as React from "react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { C, withAlpha } from "@/lib/theme";
import { useMonsterBrowser } from "@beholden/shared/domain/compendium/useMonsterBrowser";
import { formatCr } from "@/lib/monsterPicker/utils";
import { useVirtualList } from "@/lib/monsterPicker/useVirtualList";
import type { SortMode } from "@/lib/monsterPicker/types";

const ROW_HEIGHT = 52;

/** Stands in for a row whose window hasn't arrived yet, so the list keeps its geometry. */
function MonsterRowPlaceholder() {
  return (
    <div
      style={{
        height: ROW_HEIGHT,
        borderBottom: `1px solid ${C.panelBorder}`,
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
      }}
    >
      <div style={{ height: 10, width: "40%", borderRadius: 5, background: withAlpha(C.muted, 0.18) }} />
    </div>
  );
}

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
  const { t } = useTranslation();
  const { rows, loading, loadError, totalRows, ensureRange, envOptions, sizeOptions, typeOptions, compQ, setCompQ, sortMode, setSortMode, envFilter, setEnvFilter, sizeFilter, setSizeFilter, typeFilter, setTypeFilter, crMin, setCrMin, crMax, setCrMax, rulesetFilter, setRulesetFilter, showRulesetFilter, lettersInList, letterFirstIndex } = useMonsterBrowser();

  const vl = useVirtualList({ isEnabled: true, rowHeight: ROW_HEIGHT, overscan: 8 });
  // The list is sized by the server's total, not by how many rows have been fetched, so the
  // scrollbar and the A-Z jump both address the whole result set.
  const { start, end, padTop, padBottom } = vl.getRange(totalRows);

  // Fetch whatever window the viewport is over. Scrolling changes `start`/`end`, so this covers
  // both dragging the scrollbar and jumping straight to a letter.
  React.useEffect(() => {
    if (totalRows > 0) ensureRange(start, end);
  }, [ensureRange, start, end, totalRows]);

  // The filtered total can't tell an empty catalogue from a filter that matched nothing, so lean on
  // the facet lists: they come back empty only when there are no monsters at all.
  const hasAnyMonsters = typeOptions.length > 1;

  function handleClear() {
    setCompQ(""); setSortMode("az");
    setEnvFilter("all"); setSizeFilter("all"); setTypeFilter("all");
    setCrMin(""); setCrMax("");
  }

  return (
    <Panel
      title={t("compendiumMonsters.title")}
      actions={
        <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
          {loading ? t("compendiumMonsters.loading") : totalRows.toLocaleString()}
        </div>
      }
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
    >
      <input
        value={compQ} placeholder={t("compendiumMonsters.searchPlaceholder")}
        onChange={(e) => setCompQ(e.target.value)}
        style={inputStyle()}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 6 }}>
        <Select style={{ width: "100%" }} value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
          <option value="az">{t("compendiumMonsters.sortAz")}</option>
          <option value="crAsc">{t("compendiumMonsters.sortCrAsc")}</option>
          <option value="crDesc">{t("compendiumMonsters.sortCrDesc")}</option>
        </Select>
        <Select style={{ width: "100%" }} value={envFilter} onChange={(e) => setEnvFilter(e.target.value)}>
          {envOptions.map((env) => (
            <option key={env} value={env}>{env === "all" ? t("compendiumMonsters.allEnvironments") : env}</option>
          ))}
        </Select>
        <Select style={{ width: "100%" }} value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
          {sizeOptions.map((s) => (
            <option key={s} value={s}>{s === "all" ? t("compendiumMonsters.allSizes") : s}</option>
          ))}
        </Select>
        <Select style={{ width: "100%" }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          {typeOptions.map((ty) => (
            <option key={ty} value={ty}>{ty === "all" ? t("compendiumMonsters.allTypes") : ty.charAt(0).toUpperCase() + ty.slice(1)}</option>
          ))}
        </Select>
        {showRulesetFilter && (
          <Select style={{ width: "100%" }} value={rulesetFilter} onChange={(e) => setRulesetFilter(e.target.value as "5e" | "5.5e" | "")}>
            <option value="">{t("compendiumMonsters.allRulesets")}</option>
            <option value="5.5e">5.5e</option>
            <option value="5e">5e</option>
          </Select>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <input value={crMin} onChange={(e) => setCrMin(e.target.value)} placeholder={t("compendiumMonsters.crMin")} style={inputStyle()} />
        <input value={crMax} onChange={(e) => setCrMax(e.target.value)} placeholder={t("compendiumMonsters.crMax")} style={inputStyle()} />
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
        <button type="button" style={pillStyle()} onClick={handleClear}>{t("compendiumMonsters.clear")}</button>
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
        {loadError && <div style={{ padding: 12, color: C.red }}>{t("compendiumMonsters.failedToLoad", { error: loadError })}</div>}
        {!loading && !loadError && totalRows === 0 && (
          <div style={{ padding: 12, color: C.muted }}>
            {hasAnyMonsters ? t("compendiumMonsters.noMonstersMatch") : t("compendiumMonsters.noDataLoaded")}
          </div>
        )}
        {totalRows > 0 && (
          <div style={{ paddingTop: padTop, paddingBottom: padBottom }}>
            {rows.slice(start, end).map((m, offset) => {
              if (!m) return <MonsterRowPlaceholder key={`pending-${start + offset}`} />;
              const crLabel = m.cr != null ? `CR ${formatCr(m.cr)}` : t("compendiumMonsters.crUnknown");
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
