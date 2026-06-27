import React from "react";
import { EmptyState, ListShell } from "@beholden/shared/ui";

import { IconDice } from "@/icons";
import { api } from "@/services/api";
import { theme, withAlpha } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { togglePillStyle } from "./browserParts";

type FeatCatalogRow = {
  id: string;
  name: string;
  category?: string | null;
  prerequisite?: string | null;
  repeatable?: boolean;
  abilities?: string[];
};

export function FeatsPanel(props: {
  selectedFeatId?: string | null;
  onSelectFeat?: (id: string) => void;
}) {
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
    api<FeatCatalogRow[]>("/api/compendium/feats?fields=id,name,category,prerequisite,repeatable,abilities")
      .then((data) => { if (alive) setRows(data ?? []); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []);

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

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setAbility("all");
    setPrerequisite("all");
    setRepeatableOnly(false);
  }

  return (
    <Panel
      storageKey="compendium-feats"
      title={(
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}>
          <IconDice size={28} title="Feats" />
          <span>Feats</span>
        </span>
      )}
      actions={<div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>{busy ? "Loading..." : filtered.length}</div>}
      style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
    >
      <input
        value={query}
        placeholder="Search feats or prerequisites..."
        onChange={(event) => setQuery(event.target.value)}
        style={{
          background: theme.colors.panelBg,
          color: theme.colors.text,
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: 10,
          padding: "8px 10px",
          outline: "none",
        }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        <Select value={category} onChange={(event) => setCategory(event.target.value)} style={{ width: "100%" }}>
          <option value="all">All Categories</option>
          {categories.map((value) => <option key={value} value={value}>{value}</option>)}
        </Select>
        <Select value={ability} onChange={(event) => setAbility(event.target.value)} style={{ width: "100%" }}>
          <option value="all">All Ability Increases</option>
          {abilities.map((value) => <option key={value} value={value}>{value}</option>)}
        </Select>
        <Select
          value={prerequisite}
          onChange={(event) => setPrerequisite(event.target.value as "all" | "yes" | "no")}
          style={{ width: "100%" }}
        >
          <option value="all">Any Prerequisite</option>
          <option value="yes">Has Prerequisite</option>
          <option value="no">No Prerequisite</option>
        </Select>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => setRepeatableOnly((value) => !value)} style={togglePillStyle(repeatableOnly)}>
          Repeatable
        </button>
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} style={togglePillStyle(false)}>Clear</button>
        )}
      </div>

      <ListShell style={{ borderColor: theme.colors.panelBorder }}>
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
                display: "flex",
                flexDirection: "column",
                width: "100%",
                textAlign: "left",
                padding: "9px 11px",
                border: "none",
                borderBottom: `1px solid ${theme.colors.panelBorder}`,
                background: active ? withAlpha(theme.colors.accentHighlight, 0.16) : "transparent",
                color: theme.colors.text,
                cursor: "pointer",
              }}
            >
              <span style={{ fontWeight: 750, lineHeight: 1.15 }}>{feat.name}</span>
              {subtitle && <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", marginTop: 3 }}>{subtitle}</span>}
            </button>
          );
        })}
        {!busy && filtered.length === 0 && (
          <EmptyState textColor={theme.colors.muted} style={{ padding: 10 }}>No feats found.</EmptyState>
        )}
      </ListShell>
    </Panel>
  );
}
