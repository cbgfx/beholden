import { useUiMessages, useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconPlus, IconTargeted } from "@/icons";
import { IconAntarctica, IconFlyingFlag, IconVillage } from "@/views/BinderView/binderIcons";
import { EntityIcon } from "@/components/iconPicker";
import { Button } from "@/ui/Button";
import { filterPlaces, placeFilterOptions, reconcilePlaceFilters, emptyPlaceFilters, PLACE_FILTER_FIELDS, type PlaceFilters } from "./placeFilters";
import { SearchableMultiFilter } from "@/components/SearchableSelect";
import { Input } from "@/ui/Input";
import { theme, withAlpha } from "@/theme/theme";
import { createBinderReference, fetchBinderReferences, type BinderReferenceInput, type BinderReferenceRecord, type BinderReferenceType } from "@/services/binderReferenceApi";
import { ReferenceRecordModal } from "./ReferenceRecordModal";

const PLACE_TYPES = ["continents", "countries", "locations", "points-of-interest"] as const;
type PlaceType = typeof PLACE_TYPES[number];
const LABELS: Record<PlaceType, { singular: string; plural: string; recordType: string }> = {
  continents: { singular: "Continent", plural: "Continents", recordType: "continent" },
  countries: { singular: "Country", plural: "Countries", recordType: "country" },
  locations: { singular: "Location", plural: "Locations", recordType: "location" },
  "points-of-interest": { singular: "Point of Interest", plural: "Points of Interest", recordType: "poi" },
};
type PlaceRow = BinderReferenceRecord & { referenceType: PlaceType };

function PlaceIcon({ row }: { row: PlaceRow }) {
  if (row.referenceType === "continents") return <IconAntarctica size={22}/>;
  if (row.referenceType === "countries") return <IconFlyingFlag size={22}/>;
  if (row.referenceType === "locations") return <IconVillage size={22}/>;
  return row.icon ? <EntityIcon icon={row.icon} size={22}/> : <IconTargeted size={22}/>;
}

export function PlacesWorkspace(props: { binderId: string; accent: string; canEdit: boolean; onRecordsChanged: () => Promise<void> }) {
  const translateMessage = useUiMessages("dmUi");
  const translateUi = useUiTranslation("dmUi");
  const navigate = useNavigate();
  const [rows, setRows] = useState<PlaceRow[]>([]);
  const stored = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(`binder:${props.binderId}:places-filters`) ?? "null") as { query?: string; filters?: PlaceFilters } | null; }
    catch { return null; }
  }, [props.binderId]);
  const [query, setQuery] = useState(stored?.query ?? "");
  const [filters, setFilters] = useState<PlaceFilters>(stored?.filters ?? emptyPlaceFilters());
  const [hydratedBinderId, setHydratedBinderId] = useState(props.binderId);
  useEffect(() => {
    if (hydratedBinderId === props.binderId) return;
    setQuery(stored?.query ?? "");
    setFilters(stored?.filters ?? emptyPlaceFilters());
    setHydratedBinderId(props.binderId);
  }, [props.binderId, hydratedBinderId, stored]);
  const [newType, setNewType] = useState<PlaceType>("locations");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const groups = await Promise.all(PLACE_TYPES.map(async (referenceType) => (await fetchBinderReferences(props.binderId, referenceType)).map((record) => ({ ...record, referenceType }))));
      setRows(groups.flat().sort((a, b) => a.name.localeCompare(b.name)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : translateMessage("Unable to load Places.")); }
    finally { setLoading(false); }
  }, [props.binderId, translateMessage]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (hydratedBinderId !== props.binderId) return;
    localStorage.setItem(`binder:${props.binderId}:places-filters`, JSON.stringify({ query, filters }));
  }, [props.binderId, query, filters, hydratedBinderId]);

  const visible = useMemo(() => filterPlaces(rows, query, filters), [query, rows, filters]);
  const filterChoices = useMemo(() => Object.fromEntries(PLACE_FILTER_FIELDS.map((key) => [key, [
    { value: "__none__", label: translateUi("None") },
    ...placeFilterOptions(rows, filters, key).map((row) => ({ value: row.id, label: row.name })),
  ]])) as Record<PlaceType, Array<{ value: string; label: string }>>, [rows, filters, translateUi]);
  useEffect(() => {
    if (!loading && hydratedBinderId === props.binderId) setFilters((current) => reconcilePlaceFilters(rows, current));
  }, [rows, loading, hydratedBinderId, props.binderId]);
  function addFilter(key: PlaceType, value: string) {
    setFilters((current) => reconcilePlaceFilters(rows, { ...current, [key]: [...new Set([...current[key], value])] }));
  }
  function showWithin(id: string) {
    const place = rows.find((row) => row.id === id);
    if (place) addFilter(place.referenceType, id);
  }
  const parentLabel = newType === "countries" ? "Continent" : newType === "locations" ? "Country" : newType === "points-of-interest" ? "Parent" : undefined;
  const allowedParents = newType === "countries" ? ["continents"] : newType === "locations" ? ["countries"] : newType === "points-of-interest" ? ["countries", "locations", "points-of-interest"] : [];
  const parentOptions = rows.filter((row) => allowedParents.includes(row.referenceType)).map((row) => ({ id: row.id, name: row.name, type: LABELS[row.referenceType].recordType, icon: row.icon }));

  async function create(input: BinderReferenceInput) {
    await createBinderReference(props.binderId, newType as BinderReferenceType, input);
    await reload();
    await props.onRecordsChanged();
  }

  return (
    <>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flex: "1 1 520px", flexWrap: "wrap", alignItems: "end" }}>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={translateUi("Search places…")}
              style={{ width: "min(360px,100%)" }}
            />

          </div>
          {props.canEdit ? (
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={newType}
                onChange={(event) => setNewType(event.target.value as PlaceType)}
                style={{
                  minWidth: 170,
                  padding: "9px 11px",
                  borderRadius: theme.radius.control,
                  border: `1px solid ${theme.colors.panelBorder}`,
                  background: theme.colors.inputBg,
                  color: theme.colors.text,
                  font: "inherit",
                }}
              >
                {PLACE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {LABELS[type].singular}
                  </option>
                ))}
              </select>
              <Button onClick={() => setCreating(true)}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <IconPlus size={14} /> {translateUi("New Place")}
                </span>
              </Button>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {PLACE_FILTER_FIELDS.map((key) => <SearchableMultiFilter key={key} label={translateUi(LABELS[key].singular)} width={key === "points-of-interest" ? 200 : 165} selected={filters[key]} options={filterChoices[key]} onAdd={(value) => addFilter(key, value)} />)}
          {Object.values(filters).some((values) => values.length) ? <Button variant="ghost" onClick={() => setFilters(emptyPlaceFilters())}>{translateUi("Clear")}</Button> : null}
        </div>
        {Object.values(filters).some((values) => values.length) ? <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          {PLACE_FILTER_FIELDS.flatMap((key) => filters[key].map((value) => {
            const label = translateUi(LABELS[key].singular);
            const choice = filterChoices[key].find((item) => item.value === value);
            return <button key={`${key}:${value}`} type="button" aria-label={translateUi("Remove {{value1}} {{value2}} filter", { value1: label, value2: choice?.label ?? value })}
              onClick={() => setFilters((current) => reconcilePlaceFilters(rows, { ...current, [key]: current[key].filter((item) => item !== value) }))}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 7px", border: `1px solid ${withAlpha(props.accent, 0.48)}`, borderRadius: 999, background: withAlpha(props.accent, 0.12), color: theme.colors.text, cursor: "pointer", font: "inherit", fontSize: "var(--fs-tiny)", lineHeight: 1.35, fontWeight: 900 }}>
              <span style={{ color: props.accent }}>{label}</span>{choice?.label ?? value}<span aria-hidden style={{ color: theme.colors.red, fontSize: 14, lineHeight: 1 }}>{"\u00d7"}</span>
            </button>;
          }))}
        </div> : null}
        <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(240px,1.4fr) 170px minmax(220px,1fr) 110px",
              gap: 10,
              padding: "8px 12px",
              background: withAlpha(props.accent, 0.08),
              borderBottom: `1px solid ${theme.colors.panelBorder}`,
              fontSize: "var(--fs-small)",
              fontWeight: 750,
            }}
          >
            <span style={{ color: props.accent }}>{translateUi("Name ▲")}</span>
            <span>{translateUi("Type")}</span>
            <span>{translateUi("Parent")}</span>
            <span>{translateUi("Related")}</span>
          </div>
          {loading ? (
            <div style={{ padding: 42, textAlign: "center", color: theme.colors.muted }}>{translateUi("Loading…")}</div>
          ) : error ? (
            <div style={{ padding: 42, textAlign: "center", color: theme.colors.red }}>{error}</div>
          ) : visible.length ? (
            visible.map((row) => (
              <div
                key={row.id}
                role="link"
                tabIndex={0}
                onKeyDown={(event) => { if (event.target === event.currentTarget && event.key === "Enter") navigate(`/binder/${props.binderId}/${row.referenceType}/${row.id}`); }}
                onClick={() => navigate(`/binder/${props.binderId}/${row.referenceType}/${row.id}`)}
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "minmax(240px,1.4fr) 170px minmax(220px,1fr) 110px",
                  gap: 10,
                  alignItems: "center",
                  padding: "7px 12px",
                  border: 0,
                  borderBottom: `1px solid ${theme.colors.panelBorder}`,
                  background: "transparent",
                  color: theme.colors.text,
                  textAlign: "left",
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: "var(--fs-small)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, fontWeight: 750 }}>
                  <span style={{ display: "grid", placeItems: "center", color: props.accent, flex: "0 0 auto" }}>
                    <PlaceIcon row={row} />
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
                </span>
                <span style={{ color: theme.colors.muted }}>{LABELS[row.referenceType].singular}</span>
                <span
                  style={{
                    color: row.parent ? theme.colors.muted : "rgba(160,180,220,.48)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.parent ? <button type="button" onClick={(event) => { event.stopPropagation(); showWithin(row.parent!.id); }} title={`${translateUi("Within")}: ${row.parent.name}`} style={{ padding: 0, border: 0, background: "transparent", color: "inherit", font: "inherit", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>{row.parent.name}</button> : translateUi("None")}
                </span>
                <span style={{ color: theme.colors.muted }}>{row.usageCount}</span>
              </div>
            ))
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: theme.colors.muted }}>{translateUi("No Places match the current search.")}</div>
          )}
        </div>
      </div>
      <ReferenceRecordModal
        isOpen={creating}
        singularLabel={LABELS[newType].singular}
        record={null}
        accent={props.accent}
        showDescription
        showIcon={newType === "points-of-interest"}
        useDrawer
        parentLabel={parentLabel}
        parentOptions={parentOptions}
        onClose={() => setCreating(false)}
        onSave={create}
      />
    </>
  );
}
