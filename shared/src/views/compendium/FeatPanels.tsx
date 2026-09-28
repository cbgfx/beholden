import * as React from "react";
import { useUiTranslation } from "../../i18n/useUiTranslation";
import { api } from "../../api/browserClient";
import { useAvailableRulesets } from "../../domain/compendium/useAvailableRulesets";
import { IconInspiration } from "../../icons";
import { togglePillStyle } from "../../ui/browserStyles";
import { EmptyState } from "../../ui/EmptyState";
import { FormattedText } from "../../ui/FormattedText";
import { ListShell } from "../../ui/ListShell";
import { useCompendiumHost, type Ruleset } from "./CompendiumHost";
import { ACTIVE_ROW_BACKGROUND, BrowserTitle, COMPENDIUM_COLORS as C, CompendiumSelect, CompendiumTag, searchInputStyle } from "./compendiumStyle";
import { entryPath, useCompendiumEntry } from "./useCompendiumEntry";

export type FeatCatalogRow = {
  id: string;
  ruleset?: Ruleset;
  name: string;
  category?: string | null;
  prerequisite?: string | null;
  repeatable?: boolean;
  abilities?: string[];
};

export type FeatDetailRecord = {
  id: string;
  name: string;
  ruleset?: Ruleset;
  text?: string | null;
  prerequisite?: string | null;
  parsed?: {
    category?: string | null;
    source?: string | null;
    repeatable?: boolean;
    grants?: {
      abilityIncreases?: Record<string, number>;
      skills?: string[];
      tools?: string[];
      languages?: string[];
      spells?: string[];
      cantrips?: string[];
    };
    choices?: Array<{ type: string; options?: string[] | null; count?: number; amount?: number | null }>;
  };
};

const FEAT_LIST_FIELDS = "id,ruleset,name,category,prerequisite,repeatable,abilities";

export function FeatDetail(props: { featId: string; ruleset?: Ruleset | null }) {
  const translateUi = useUiTranslation("sharedUi");
  const { Panel, revision } = useCompendiumHost();
  const { data: feat, busy, error } = useCompendiumEntry<FeatDetailRecord>(entryPath("/api/compendium/feats", props.featId, props.ruleset), revision);

  const parsed = feat?.parsed;
  const abilityIncreases = Object.entries(parsed?.grants?.abilityIncreases ?? {}).map(([ability, amount]) => `${ability.toUpperCase()} +${amount}`);
  const abilityChoices = (parsed?.choices ?? [])
    .filter((choice) => choice.type === "ability_score")
    .map((choice) => translateUi("Choose {{value1}}: {{value2}}", { value1: choice.count ?? 1, value2: (choice.options ?? []).join(", ") }) + (choice.amount ? ` (+${choice.amount})` : ""));
  const grants = [
    ...(parsed?.grants?.skills ?? []).map((value) => translateUi("Skill: {{value1}}", { value1: value })),
    ...(parsed?.grants?.tools ?? []).map((value) => translateUi("Tool: {{value1}}", { value1: value })),
    ...(parsed?.grants?.languages ?? []).map((value) => translateUi("Language: {{value1}}", { value1: value })),
    ...(parsed?.grants?.spells ?? []).map((value) => translateUi("Spell: {{value1}}", { value1: value })),
    ...(parsed?.grants?.cantrips ?? []).map((value) => translateUi("Cantrip: {{value1}}", { value1: value })),
  ];

  return (
    <Panel
      title={feat?.name ?? translateUi("Feat")}
      actions={
        <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
          {busy ? translateUi("Loading...") : parsed?.source ? translateUi("Source: {{value1}} · Ruleset: {{value2}}", { value1: parsed.source, value2: feat?.ruleset ?? translateUi("Unknown") }) : ""}
        </div>
      }
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}
    >
      {error ? (
        <div style={{ color: C.red }}>{translateUi("Could not load this feat: {{value1}}", { value1: error })}</div>
      ) : !feat ? (
        <div style={{ color: C.muted }}>{busy ? translateUi("Loading...") : translateUi("Select a feat to view its details.")}</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {parsed?.category && <CompendiumTag label={parsed.category} color={C.highlight} />}
            {parsed?.repeatable && <CompendiumTag label={translateUi("Repeatable")} color={C.colorGold} />}
            {abilityIncreases.map((value) => <CompendiumTag key={value} label={value} color={C.green} />)}
          </div>

          {feat.prerequisite && (
            <div style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${C.panelBorder}`, color: C.muted, fontSize: "var(--fs-small)" }}>
              <b style={{ color: C.text }}>{translateUi("Prerequisite:")}</b> {feat.prerequisite}
            </div>
          )}

          {(abilityChoices.length > 0 || grants.length > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {abilityChoices.map((value) => <div key={value} style={{ color: C.green, fontSize: "var(--fs-small)", fontWeight: 700 }}>{value}</div>)}
              {grants.map((value) => <div key={value} style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{value}</div>)}
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", border: `1px solid ${C.panelBorder}`, borderRadius: 12, padding: 12, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
            {feat.text ? <FormattedText text={feat.text} /> : <span style={{ color: C.muted }}>{translateUi("No description available.")}</span>}
          </div>
        </>
      )}
    </Panel>
  );
}

export function FeatBrowser(props: {
  selectedFeatId?: string | null;
  selectedFeatRuleset?: Ruleset | null;
  onSelectFeat: (id: string, ruleset?: Ruleset | null) => void;
}) {
  const translateUi = useUiTranslation("sharedUi");
  const { Panel, revision } = useCompendiumHost();
  const [rows, setRows] = React.useState<FeatCatalogRow[]>([]);
  const [busy, setBusy] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [ability, setAbility] = React.useState("all");
  const [prerequisite, setPrerequisite] = React.useState<"all" | "yes" | "no">("all");
  const [repeatableOnly, setRepeatableOnly] = React.useState(false);
  const { rulesetFilter, setRulesetFilter, showRulesetFilter } = useAvailableRulesets(api, "feats");

  // The feat catalogue is small, so it loads whole and filters in the browser.
  React.useEffect(() => {
    let alive = true;
    setBusy(true);
    const params = new URLSearchParams({ fields: FEAT_LIST_FIELDS });
    if (rulesetFilter) params.set("ruleset", rulesetFilter);
    api<FeatCatalogRow[]>(`/api/compendium/feats?${params.toString()}`)
      .then((data) => { if (alive) setRows(data ?? []); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [rulesetFilter, revision]);

  const categories = React.useMemo(() => [...new Set(rows.map((row) => row.category).filter((value): value is string => Boolean(value)))].sort(), [rows]);
  const abilities = React.useMemo(() => [...new Set(rows.flatMap((row) => row.abilities ?? []))].sort(), [rows]);
  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (needle && !`${row.name} ${row.prerequisite ?? ""}`.toLowerCase().includes(needle)) return false;
      if (category !== "all" && row.category !== category) return false;
      if (ability !== "all" && !(row.abilities ?? []).includes(ability)) return false;
      if (prerequisite === "yes" && !row.prerequisite) return false;
      if (prerequisite === "no" && row.prerequisite) return false;
      if (repeatableOnly && !row.repeatable) return false;
      return true;
    });
  }, [ability, category, prerequisite, query, repeatableOnly, rows]);
  const hasActiveFilters = query.trim().length > 0 || category !== "all" || ability !== "all" || prerequisite !== "all" || repeatableOnly;

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setAbility("all");
    setPrerequisite("all");
    setRepeatableOnly(false);
  };
  const pill = (active: boolean) => togglePillStyle(active, C.highlight, C.panelBorder, C.muted);
  const selectStyle = { width: "100%" };

  return (
    <Panel
      storageKey="compendium-feats"
      title={<BrowserTitle icon={<IconInspiration size={27} />}>{translateUi("Feats")}</BrowserTitle>}
      actions={<div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{busy ? translateUi("Loading...") : filtered.length}</div>}
      style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
    >
      <input value={query} placeholder={translateUi("Search feats or prerequisites...")} onChange={(event) => setQuery(event.target.value)} style={searchInputStyle} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        <CompendiumSelect value={category} onChange={(event) => setCategory(event.target.value)} style={selectStyle} title={translateUi("Filter by category")}>
          <option value="all">{translateUi("All Categories")}</option>
          {categories.map((value) => <option key={value} value={value}>{value}</option>)}
        </CompendiumSelect>
        <CompendiumSelect value={ability} onChange={(event) => setAbility(event.target.value)} style={selectStyle} title={translateUi("Filter by ability increase")}>
          <option value="all">{translateUi("All Ability Increases")}</option>
          {abilities.map((value) => <option key={value} value={value}>{value}</option>)}
        </CompendiumSelect>
        <CompendiumSelect value={prerequisite} onChange={(event) => setPrerequisite(event.target.value as "all" | "yes" | "no")} style={selectStyle} title={translateUi("Filter by prerequisite")}>
          <option value="all">{translateUi("Any Prerequisite")}</option>
          <option value="yes">{translateUi("Has Prerequisite")}</option>
          <option value="no">{translateUi("No Prerequisite")}</option>
        </CompendiumSelect>
        {showRulesetFilter && (
          <CompendiumSelect value={rulesetFilter} onChange={(event) => setRulesetFilter(event.target.value as Ruleset | "")} style={selectStyle} title={translateUi("Filter by ruleset")}>
            <option value="">{translateUi("All Rulesets")}</option>
            <option value="5.5e">5.5e</option>
            <option value="5e">5e</option>
          </CompendiumSelect>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => setRepeatableOnly((value) => !value)} style={pill(repeatableOnly)}>{translateUi("Repeatable")}</button>
        {hasActiveFilters && <button type="button" onClick={clearFilters} style={pill(false)}>{translateUi("Clear")}</button>}
      </div>

      <ListShell borderColor={C.panelBorder}>
        {filtered.map((feat) => {
          const active = feat.id === props.selectedFeatId && (props.selectedFeatRuleset == null || feat.ruleset === props.selectedFeatRuleset);
          const subtitle = [
            feat.category,
            feat.abilities?.length ? `+ ${feat.abilities.join(" / ")}` : null,
            feat.prerequisite,
            // Which ruleset the feat belongs to, when the compendium holds more than one.
            showRulesetFilter ? feat.ruleset : null,
          ].filter(Boolean).join(" • ");
          return (
            <button
              key={`${feat.ruleset ?? ""}:${feat.id}`}
              type="button"
              onClick={() => props.onSelectFeat(feat.id, feat.ruleset ?? null)}
              style={{
                display: "flex", flexDirection: "column", width: "100%", textAlign: "left",
                padding: "9px 11px", border: "none", borderBottom: `1px solid ${C.panelBorder}`,
                background: active ? ACTIVE_ROW_BACKGROUND : "transparent", color: C.text, cursor: "pointer",
              }}
            >
              <span style={{ fontWeight: 750, lineHeight: 1.15 }}>{feat.name}</span>
              {subtitle && <span style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 3 }}>{subtitle}</span>}
            </button>
          );
        })}
        {!busy && filtered.length === 0 && <EmptyState textColor={C.muted} style={{ padding: 10 }}>{translateUi("No feats found.")}</EmptyState>}
      </ListShell>
    </Panel>
  );
}
