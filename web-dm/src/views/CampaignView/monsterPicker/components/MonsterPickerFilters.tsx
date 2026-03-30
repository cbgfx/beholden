import * as React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import type { SortMode } from "@/views/CampaignView/monsterPicker/types";

export function MonsterPickerFilters(props: {
  compQ: string;
  onChangeCompQ: (q: string) => void;
  sortMode: SortMode;
  onChangeSortMode: (s: SortMode) => void;
  envFilter: string;
  onChangeEnvFilter: (e: string) => void;
  envOptions: string[];
  sizeFilter: string;
  onChangeSizeFilter: (s: string) => void;
  sizeOptions: string[];
  typeFilter: string;
  onChangeTypeFilter: (t: string) => void;
  typeOptions: string[];
  crMin: string;
  crMax: string;
  onChangeCrMin: (v: string) => void;
  onChangeCrMax: (v: string) => void;
  onQuickCr: (min: string, max: string) => void;
  onClear: () => void;
}) {
  return (
    <>
      <Input value={props.compQ} onChange={(e) => props.onChangeCompQ(e.target.value)} placeholder="Search compendium…" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6 }}>
        <Select style={{ width: "100%" }} value={props.sortMode} onChange={(e) => props.onChangeSortMode(e.target.value as SortMode)}>
          <option value="az">A-Z</option>
          <option value="crAsc">CR (low→high)</option>
          <option value="crDesc">CR (high→low)</option>
        </Select>

        <Select style={{ width: "100%" }} value={props.envFilter} onChange={(e) => props.onChangeEnvFilter(e.target.value)}>
          {props.envOptions.map((env) => (
            <option key={env} value={env}>
              {env === "all" ? "All environments" : env}
            </option>
          ))}
        </Select>

        <Select style={{ width: "100%" }} value={props.sizeFilter} onChange={(e) => props.onChangeSizeFilter(e.target.value)}>
          {props.sizeOptions.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All sizes" : s}
            </option>
          ))}
        </Select>

        <Select style={{ width: "100%" }} value={props.typeFilter} onChange={(e) => props.onChangeTypeFilter(e.target.value)}>
          {props.typeOptions.map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "All types" : t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </Select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <Input value={props.crMin} onChange={(e) => props.onChangeCrMin(e.target.value)} placeholder="CR min (e.g. 3 or 1/4)" />
        <Input value={props.crMax} onChange={(e) => props.onChangeCrMax(e.target.value)} placeholder="CR max (e.g. 7)" />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { label: "0-1", min: "0", max: "1" },
          { label: "2-4", min: "2", max: "4" },
          { label: "3-7", min: "3", max: "7" },
          { label: "5-10", min: "5", max: "10" },
          { label: "11+", min: "11", max: "" }
        ].map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => props.onQuickCr(r.min, r.max)}
            style={pillStyle()}
          >
            {r.label}
          </button>
        ))}
        <button type="button" onClick={props.onClear} style={pillStyle()}>
          Clear
        </button>
      </div>
    </>
  );
}

function pillStyle(): React.CSSProperties {
  return {
    border: `1px solid ${theme.colors.panelBorder}`,
    background: withAlpha(theme.colors.shadowColor, 0.12),
    color: theme.colors.text,
    padding: "4px 8px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: "var(--fs-pill)",
    fontWeight: 700
  };
}
