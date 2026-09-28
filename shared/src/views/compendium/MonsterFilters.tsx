import { useUiTranslation } from "../../i18n/useUiTranslation";
import type { SortMode } from "../../domain/compendium/monsterPicker";
import type { Ruleset } from "./CompendiumHost";
import { CompendiumSelect, plainPillStyle, searchInputStyle, smallInputStyle } from "./compendiumStyle";

const QUICK_CR_RANGES = [
  { label: "0-1", min: "0", max: "1" },
  { label: "2-4", min: "2", max: "4" },
  { label: "3-7", min: "3", max: "7" },
  { label: "5-10", min: "5", max: "10" },
  { label: "11+", min: "11", max: "" },
];

/**
 * Search and filters for monster lists: the compendium's monster browser and the DM's encounter
 * monster picker. Takes the state from `useMonsterBrowser`.
 */
export function MonsterFilters(props: {
  compQ: string;
  onChangeCompQ: (value: string) => void;
  sortMode: SortMode;
  onChangeSortMode: (value: SortMode) => void;
  envFilter: string;
  onChangeEnvFilter: (value: string) => void;
  envOptions: string[];
  sizeFilter: string;
  onChangeSizeFilter: (value: string) => void;
  sizeOptions: string[];
  typeFilter: string;
  onChangeTypeFilter: (value: string) => void;
  typeOptions: string[];
  crMin: string;
  crMax: string;
  onChangeCrMin: (value: string) => void;
  onChangeCrMax: (value: string) => void;
  rulesetFilter?: Ruleset | "";
  onChangeRulesetFilter?: (value: Ruleset | "") => void;
  showRulesetFilter?: boolean;
  onClear: () => void;
}) {
  const translateUi = useUiTranslation("sharedUi");
  const selectStyle = { width: "100%" };
  return (
    <>
      <input value={props.compQ} onChange={(event) => props.onChangeCompQ(event.target.value)} placeholder={translateUi("Search monsters...")} style={searchInputStyle} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6 }}>
        <CompendiumSelect style={selectStyle} value={props.sortMode} onChange={(event) => props.onChangeSortMode(event.target.value as SortMode)} title={translateUi("Sort order")}>
          <option value="az">A-Z</option>
          <option value="crAsc">{translateUi("CR (low→high)")}</option>
          <option value="crDesc">{translateUi("CR (high→low)")}</option>
        </CompendiumSelect>
        <CompendiumSelect style={selectStyle} value={props.envFilter} onChange={(event) => props.onChangeEnvFilter(event.target.value)} title={translateUi("Filter by environment")}>
          {props.envOptions.map((env) => <option key={env} value={env}>{env === "all" ? translateUi("All environments") : env}</option>)}
        </CompendiumSelect>
        <CompendiumSelect style={selectStyle} value={props.sizeFilter} onChange={(event) => props.onChangeSizeFilter(event.target.value)} title={translateUi("Filter by size")}>
          {props.sizeOptions.map((size) => <option key={size} value={size}>{size === "all" ? translateUi("All sizes") : size}</option>)}
        </CompendiumSelect>
        <CompendiumSelect style={selectStyle} value={props.typeFilter} onChange={(event) => props.onChangeTypeFilter(event.target.value)} title={translateUi("Filter by type")}>
          {props.typeOptions.map((type) => (
            <option key={type} value={type}>{type === "all" ? translateUi("All types") : type.charAt(0).toUpperCase() + type.slice(1)}</option>
          ))}
        </CompendiumSelect>
        {props.showRulesetFilter && (
          <CompendiumSelect
            style={selectStyle}
            value={props.rulesetFilter ?? ""}
            onChange={(event) => props.onChangeRulesetFilter?.(event.target.value as Ruleset | "")}
            title={translateUi("Filter by ruleset")}
          >
            <option value="">{translateUi("All Rulesets")}</option>
            <option value="5.5e">5.5e</option>
            <option value="5e">5e</option>
          </CompendiumSelect>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <input value={props.crMin} onChange={(event) => props.onChangeCrMin(event.target.value)} placeholder={translateUi("CR min (e.g. 3 or 1/4)")} style={smallInputStyle} />
        <input value={props.crMax} onChange={(event) => props.onChangeCrMax(event.target.value)} placeholder={translateUi("CR max (e.g. 7)")} style={smallInputStyle} />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {QUICK_CR_RANGES.map((range) => (
          <button
            key={range.label}
            type="button"
            title={translateUi("Challenge rating {{value1}}", { value1: range.label })}
            onClick={() => { props.onChangeCrMin(range.min); props.onChangeCrMax(range.max); }}
            style={plainPillStyle}
          >
            {range.label}
          </button>
        ))}
        <button type="button" onClick={props.onClear} style={plainPillStyle}>{translateUi("Clear")}</button>
      </div>
    </>
  );
}
