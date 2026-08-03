import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchBinderMortals, fetchMortalOptions, type BinderMortal, type MortalOptions } from "@/services/binderMortalApi";
import { Input } from "@/ui/Input";
import { Button } from "@/ui/Button";
import { theme, withAlpha } from "@/theme/theme";
import { BinderListEmpty, BinderListError, BinderListHeader, BinderListLoading, BinderRecordThumbnail, useBinderListSort } from "@/components/BinderListTable";
import { SearchableMultiFilter } from "@/components/SearchableSelect";

const NONE = "__none__";
type FilterKey = "className" | "race" | "status" | "campaign" | "player";
type Filters = Record<FilterKey, string[]>;
type SortKey = "name" | "class" | "race" | "age" | "status" | "campaign" | "player";
const emptyFilters = (): Filters => ({ className: [], race: [], status: [], campaign: [], player: [] });

function ageOf(mortal: BinderMortal, currentDate: number | null) {
  const born = Number(mortal.birthDate?.replaceAll(",", ""));
  const end = mortal.deathDate ? Number(mortal.deathDate.replaceAll(",", "")) : currentDate;
  return mortal.birthDate && Number.isFinite(born) && end !== null && Number.isFinite(end)
    ? Math.max(0, end - born)
    : null;
}

function matches(value: string | null | undefined, selected: string[]) {
  return !selected.length || selected.some((item) => item === NONE ? !value : item === value);
}

export function BinderPlayersWorkspace({ binderId, binderCurrentDate, accent }: { binderId: string; binderCurrentDate: number | null; accent: string }) {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<MortalOptions["players"]>([]);
  const [mortals, setMortals] = useState<BinderMortal[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { sortKey, sortDir, toggleSort } = useBinderListSort<SortKey>("name");

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMortalOptions(binderId), fetchBinderMortals(binderId)])
      .then(([options, mortalRecords]) => {
        setPlayers(options.players);
        setMortals(mortalRecords);
        setError(null);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load players."))
      .finally(() => setLoading(false));
  }, [binderId]);

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const pcs = useMemo(() => mortals.filter((mortal) => mortal.mortalType === "player_character"), [mortals]);
  const choices = useMemo(() => {
    const unique = (values: Array<[string, string]>) => [...new Map(values).entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return {
      className: [{ value: NONE, label: "None" }, ...unique(players.filter((p) => p.className).map((p) => [p.className!, p.className!]))],
      race: [{ value: NONE, label: "None" }, ...unique(pcs.filter((p) => p.race).map((p) => [p.race!.id, p.race!.name]))],
      status: [{ value: "alive", label: "Alive" }, { value: "dead", label: "Dead" }],
      campaign: [{ value: NONE, label: "None" }, ...unique(players.filter((p) => p.campaignName).map((p) => [p.campaignName!, p.campaignName!]))],
      player: [{ value: NONE, label: "None" }, ...unique(players.filter((p) => p.playerName).map((p) => [p.playerName!, p.playerName!]))],
    } satisfies Record<FilterKey, Array<{ value: string; label: string }>>;
  }, [pcs, players]);

  const filtered = useMemo(() => pcs.filter((mortal) => {
    const linked = mortal.player ? playersById.get(mortal.player.id) : undefined;
    return mortal.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      && matches(linked?.className, filters.className)
      && matches(mortal.race?.id, filters.race)
      && matches(mortal.lifeStatus ?? "alive", filters.status)
      && matches(linked?.campaignName, filters.campaign)
      && matches(linked?.playerName, filters.player);
  }), [filters, pcs, playersById, query]);

  const columns = "minmax(220px,1.4fr) minmax(150px,1fr) minmax(140px,.85fr) 90px 90px minmax(190px,1.2fr) minmax(160px,1fr)";
  const headers: Array<{ label: string; key: SortKey }> = [
    { label: "Name", key: "name" },
    { label: "Class", key: "class" },
    { label: "Race", key: "race" },
    { label: "Age", key: "age" },
    { label: "DoA", key: "status" },
    { label: "Campaign", key: "campaign" },
    { label: "Player", key: "player" },
  ];
  const labels: Record<FilterKey, string> = { className: "Class", race: "Race", status: "DoA", campaign: "Campaign", player: "Player" };
  const cell = { color: theme.colors.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const rows = filtered.map((mortal) => ({
      mortal,
      player: mortal.player ? playersById.get(mortal.player.id) : undefined,
      age: ageOf(mortal, binderCurrentDate),
    }));
    rows.sort((a, b) => {
      switch (sortKey) {
        case "name": return a.mortal.name.localeCompare(b.mortal.name) * dir;
        case "class": return (a.player?.className ?? "").localeCompare(b.player?.className ?? "") * dir;
        case "race": return (a.mortal.race?.name ?? "").localeCompare(b.mortal.race?.name ?? "") * dir;
        case "age": return ((a.age ?? -1) - (b.age ?? -1)) * dir;
        case "status": return ((a.mortal.lifeStatus === "dead" ? 1 : 0) - (b.mortal.lifeStatus === "dead" ? 1 : 0)) * dir;
        case "campaign": return (a.player?.campaignName ?? "").localeCompare(b.player?.campaignName ?? "") * dir;
        case "player": return (a.player?.playerName ?? "").localeCompare(b.player?.playerName ?? "") * dir;
        default: return 0;
      }
    });
    return rows;
  }, [filtered, playersById, binderCurrentDate, sortKey, sortDir]);

  return <div style={{ display: "grid", gap: 12 }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search players…" style={{ width: 260 }} />
      {(Object.keys(labels) as FilterKey[]).map((key) => <SearchableMultiFilter key={key} label={labels[key]} selected={filters[key]} options={choices[key]} onAdd={(value) => setFilters((current) => current[key].includes(value) ? current : { ...current, [key]: [...current[key], value] })} />)}
      {Object.values(filters).some((values) => values.length) ? <Button variant="ghost" onClick={() => setFilters(emptyFilters())}>Clear</Button> : null}
    </div>
    {Object.entries(filters).some(([, values]) => values.length) ? <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
      {(Object.entries(filters) as Array<[FilterKey, string[]]>).flatMap(([key, values]) => values.map((value) => {
        const choice = choices[key].find((item) => item.value === value);
        return <button key={`${key}:${value}`} type="button" onClick={() => setFilters((current) => ({ ...current, [key]: current[key].filter((item) => item !== value) }))} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 7px", border: `1px solid ${withAlpha(accent, 0.48)}`, borderRadius: 999, background: withAlpha(accent, 0.12), color: theme.colors.text, cursor: "pointer", font: "inherit", fontSize: "var(--fs-tiny)", lineHeight: 1.35, fontWeight: 900 }}>
          <span style={{ color: accent }}>{labels[key]}</span> {choice?.label ?? value}<span aria-hidden style={{ color: theme.colors.red, fontSize: 14 }}>×</span>
        </button>;
      }))}
    </div> : null}
    <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, overflowX: "auto" }}>
      <BinderListHeader
        columns={headers.map(({ label, key }) => ({ key, label, sortable: true }))}
        gridTemplateColumns={columns}
        accent={accent}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(key) => toggleSort(key as SortKey)}
      />
      {loading ? <BinderListLoading />
        : error ? <BinderListError message={error} />
        : sorted.length ? sorted.map(({ mortal, player, age }) => {
          const dead = mortal.lifeStatus === "dead";
          return <button key={mortal.id} type="button" onClick={() => navigate(`/binder/${binderId}/mortals/${mortal.id}`)} style={{ minWidth: 1120, width: "100%", display: "grid", gridTemplateColumns: columns, gap: 10, padding: "6px 12px", border: 0, borderTop: `1px solid ${theme.colors.panelBorder}`, background: "transparent", color: theme.colors.text, alignItems: "center", textAlign: "left", cursor: "pointer", font: "inherit", fontSize: "var(--fs-small)" }}>
            <span title={mortal.name} style={{ ...cell, color: theme.colors.text, fontWeight: 750, display: "flex", alignItems: "center", gap: 9 }}>
              <BinderRecordThumbnail imageUrl={mortal.imageUrl} imageUpdatedAt={mortal.imageUpdatedAt} accent={accent} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{mortal.name}</span>
            </span>
            <span title={player?.className || "None"} style={cell}>{player?.className || "None"}</span>
            <span title={mortal.race?.name ?? "None"} style={cell}>{mortal.race?.name ?? "None"}</span>
            <span style={cell}>{age ?? "None"}</span>
            <span style={{ justifySelf: "start", display: "inline-flex", padding: "2px 7px", borderRadius: 5, color: "#fff", background: dead ? theme.colors.red : theme.colors.green, fontSize: "var(--fs-small)", lineHeight: 1.3, fontWeight: 800 }}>{dead ? "Dead" : "Alive"}</span>
            <span title={player?.campaignName || "None"} style={cell}>{player?.campaignName || "None"}</span>
            <span title={player?.playerName || "None"} style={cell}>{player?.playerName || "None"}</span>
          </button>;
        }) : <BinderListEmpty>{pcs.length ? "No Player Characters match the current filters." : "No Player Character Mortals exist in this Binder."}</BinderListEmpty>}
    </div>
  </div>;
}
