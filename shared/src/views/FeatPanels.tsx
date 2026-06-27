import React from "react";
import { EmptyState, ListShell, togglePillStyle } from "../ui";

export type FeatCatalogRow = {
  id: string;
  name: string;
  category?: string | null;
  prerequisite?: string | null;
  repeatable?: boolean;
  abilities?: string[];
};

export type FeatDetail = {
  id: string;
  name: string;
  text?: string | null;
  prerequisite?: string | null;
  ruleset?: string | null;
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

export type FeatColors = {
  panelBg: string;
  panelBorder: string;
  text: string;
  muted: string;
  accentHighlight: string;
  colorMagic: string;
  colorGold: string;
  green: string;
};

type PanelLikeProps = {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  storageKey?: string;
};

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      padding: "3px 8px", borderRadius: 999,
      border: `1px solid ${color}55`, background: `${color}16`,
      color, fontSize: "var(--fs-small)", fontWeight: 750,
    }}>
      {children}
    </span>
  );
}

export function FeatDetailPanel({ featId, fetchFeat, colors, PanelComponent }: {
  featId: string;
  fetchFeat: (id: string) => Promise<FeatDetail | null>;
  colors: FeatColors;
  PanelComponent: React.ComponentType<PanelLikeProps>;
}) {
  const [feat, setFeat] = React.useState<FeatDetail | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setBusy(true);
    setFeat(null);
    fetchFeat(featId)
      .then((data) => { if (alive) setFeat(data ?? null); })
      .catch(() => { if (alive) setFeat(null); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [featId, fetchFeat]);

  const parsed = feat?.parsed;
  const abilityIncreases = Object.entries(parsed?.grants?.abilityIncreases ?? {})
    .map(([ability, amount]) => `${ability.toUpperCase()} +${amount}`);
  const abilityChoices = (parsed?.choices ?? [])
    .filter((choice) => choice.type === "ability_score")
    .map((choice) => `Choose ${choice.count ?? 1}: ${(choice.options ?? []).join(", ")}${choice.amount ? ` (+${choice.amount})` : ""}`);
  const grants = [
    ...(parsed?.grants?.skills ?? []).map((value) => `Skill: ${value}`),
    ...(parsed?.grants?.tools ?? []).map((value) => `Tool: ${value}`),
    ...(parsed?.grants?.languages ?? []).map((value) => `Language: ${value}`),
    ...(parsed?.grants?.spells ?? []).map((value) => `Spell: ${value}`),
    ...(parsed?.grants?.cantrips ?? []).map((value) => `Cantrip: ${value}`),
  ];

  return (
    <PanelComponent
      title={feat?.name ?? "Feat"}
      actions={<div style={{ color: colors.muted, fontSize: "var(--fs-small)" }}>{busy ? "Loading..." : parsed?.source ?? ""}</div>}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}
    >
      {!feat ? (
        <div style={{ color: colors.muted }}>Select a feat to view its details.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {parsed?.category && <Tag color={colors.accentHighlight}>{parsed.category}</Tag>}
            {feat.ruleset && <Tag color={colors.colorMagic}>{feat.ruleset}</Tag>}
            {parsed?.repeatable && <Tag color={colors.colorGold}>Repeatable</Tag>}
            {abilityIncreases.map((value) => <Tag key={value} color={colors.green}>{value}</Tag>)}
          </div>

          {feat.prerequisite && (
            <div style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${colors.panelBorder}`, color: colors.muted, fontSize: "var(--fs-small)" }}>
              <b style={{ color: colors.text }}>Prerequisite:</b> {feat.prerequisite}
            </div>
          )}

          {(abilityChoices.length > 0 || grants.length > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {abilityChoices.map((value) => <div key={value} style={{ color: colors.green, fontSize: "var(--fs-small)", fontWeight: 700 }}>{value}</div>)}
              {grants.map((value) => <div key={value} style={{ color: colors.muted, fontSize: "var(--fs-small)" }}>{value}</div>)}
            </div>
          )}

          <div style={{
            flex: 1, minHeight: 0, overflowY: "auto",
            border: `1px solid ${colors.panelBorder}`, borderRadius: 12,
            padding: 12, whiteSpace: "pre-wrap", lineHeight: 1.55,
          }}>
            {feat.text || <span style={{ color: colors.muted }}>No description available.</span>}
          </div>
        </>
      )}
    </PanelComponent>
  );
}

export function FeatsPanel(props: {
  selectedFeatId?: string | null;
  onSelectFeat?: (id: string) => void;
  icon: React.ReactNode;
  colors: FeatColors;
  fetchRows: () => Promise<FeatCatalogRow[]>;
  panelStorageKey?: string;
  PanelComponent: React.ComponentType<PanelLikeProps>;
  SelectComponent: React.ComponentType<React.SelectHTMLAttributes<HTMLSelectElement> & { children?: React.ReactNode }>;
}) {
  const { icon, colors, fetchRows, panelStorageKey, PanelComponent, SelectComponent } = props;
  const [rows, setRows] = React.useState<FeatCatalogRow[]>([]);
  const [busy, setBusy] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [ability, setAbility] = React.useState("all");
  const [prerequisite, setPrerequisite] = React.useState<"all" | "yes" | "no">("all");
  const [repeatableOnly, setRepeatableOnly] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setBusy(true);
    fetchRows()
      .then((data) => { if (alive) setRows(data ?? []); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [fetchRows]);

  const categories = React.useMemo(
    () => Array.from(new Set(rows.map((row) => row.category).filter((value): value is string => Boolean(value)))).sort(),
    [rows],
  );
  const abilities = React.useMemo(
    () => Array.from(new Set(rows.flatMap((row) => row.abilities ?? []))).sort(),
    [rows],
  );
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
  const hasActiveFilters =
    query.trim().length > 0
    || category !== "all"
    || ability !== "all"
    || prerequisite !== "all"
    || repeatableOnly;

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setAbility("all");
    setPrerequisite("all");
    setRepeatableOnly(false);
  };

  return (
    <PanelComponent
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}>{icon}<span>Feats</span></span>}
      actions={<div style={{ color: colors.muted, fontSize: "var(--fs-small)" }}>{busy ? "Loading..." : filtered.length}</div>}
      storageKey={panelStorageKey}
      style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
    >
      <input
        value={query}
        placeholder="Search feats or prerequisites..."
        onChange={(event) => setQuery(event.target.value)}
        style={{
          background: colors.panelBg, color: colors.text, border: `1px solid ${colors.panelBorder}`,
          borderRadius: 10, padding: "8px 10px", outline: "none",
        }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        <SelectComponent value={category} onChange={(event) => setCategory(event.target.value)} style={{ width: "100%" }}>
          <option value="all">All Categories</option>
          {categories.map((value) => <option key={value} value={value}>{value}</option>)}
        </SelectComponent>
        <SelectComponent value={ability} onChange={(event) => setAbility(event.target.value)} style={{ width: "100%" }}>
          <option value="all">All Ability Increases</option>
          {abilities.map((value) => <option key={value} value={value}>{value}</option>)}
        </SelectComponent>
        <SelectComponent value={prerequisite} onChange={(event) => setPrerequisite(event.target.value as "all" | "yes" | "no")} style={{ width: "100%" }}>
          <option value="all">Any Prerequisite</option>
          <option value="yes">Has Prerequisite</option>
          <option value="no">No Prerequisite</option>
        </SelectComponent>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => setRepeatableOnly((value) => !value)} style={togglePillStyle(repeatableOnly, colors.accentHighlight, colors.panelBorder, colors.muted)}>
          Repeatable
        </button>
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} style={togglePillStyle(false, colors.accentHighlight, colors.panelBorder, colors.muted)}>Clear</button>
        )}
      </div>

      <ListShell borderColor={colors.panelBorder}>
        {filtered.map((feat) => {
          const active = feat.id === (props.selectedFeatId ?? "");
          const subtitle = [
            feat.category,
            feat.abilities?.length ? `+ ${feat.abilities.join(" / ")}` : null,
            feat.prerequisite,
          ].filter(Boolean).join(" • ");
          return (
            <button
              key={feat.id}
              type="button"
              onClick={() => props.onSelectFeat?.(feat.id)}
              style={{
                display: "flex", flexDirection: "column", width: "100%", textAlign: "left",
                padding: "9px 11px", border: "none", borderBottom: `1px solid ${colors.panelBorder}`,
                background: active ? `${colors.accentHighlight}29` : "transparent",
                color: colors.text, cursor: "pointer",
              }}
            >
              <span style={{ fontWeight: 750, lineHeight: 1.15 }}>{feat.name}</span>
              {subtitle && <span style={{ color: colors.muted, fontSize: "var(--fs-small)", marginTop: 3 }}>{subtitle}</span>}
            </button>
          );
        })}
        {!busy && filtered.length === 0 && (
          <EmptyState textColor={colors.muted} style={{ padding: 10 }}>No feats found.</EmptyState>
        )}
      </ListShell>
    </PanelComponent>
  );
}
