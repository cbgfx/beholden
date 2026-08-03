import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconAntarctica, IconFlyingFlag, IconPlus, IconTargeted, IconVillage } from "@/icons";
import { EntityIcon } from "@/components/iconPicker";
import { Button } from "@/ui/Button";
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
  const navigate = useNavigate();
  const [rows, setRows] = useState<PlaceRow[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | PlaceType>("all");
  const [newType, setNewType] = useState<PlaceType>("locations");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const groups = await Promise.all(PLACE_TYPES.map(async (referenceType) => (await fetchBinderReferences(props.binderId, referenceType)).map((record) => ({ ...record, referenceType }))));
      setRows(groups.flat().sort((a, b) => a.name.localeCompare(b.name)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load Places."); }
    finally { setLoading(false); }
  }, [props.binderId]);
  useEffect(() => { void reload(); }, [reload]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => (typeFilter === "all" || row.referenceType === typeFilter)
      && (!needle || row.name.toLowerCase().includes(needle) || row.parent?.name.toLowerCase().includes(needle)));
  }, [query, rows, typeFilter]);
  const parentLabel = newType === "countries" ? "Continent" : newType === "locations" ? "Country" : newType === "points-of-interest" ? "Parent" : undefined;
  const allowedParents = newType === "countries" ? ["continents"] : newType === "locations" ? ["countries"] : newType === "points-of-interest" ? ["countries", "locations", "points-of-interest"] : [];
  const parentOptions = rows.filter((row) => allowedParents.includes(row.referenceType)).map((row) => ({ id: row.id, name: row.name, type: LABELS[row.referenceType].recordType, icon: row.icon }));

  async function create(input: BinderReferenceInput) {
    await createBinderReference(props.binderId, newType as BinderReferenceType, input);
    await reload();
    await props.onRecordsChanged();
  }

  return <>
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flex: "1 1 520px" }}>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search places…" style={{ width: "min(360px,100%)" }}/>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} style={{ minWidth: 170, padding: "9px 11px", borderRadius: theme.radius.control, border: `1px solid ${theme.colors.panelBorder}`, background: theme.colors.inputBg, color: theme.colors.text, font: "inherit" }}>
            <option value="all">All place types</option>{PLACE_TYPES.map((type) => <option key={type} value={type}>{LABELS[type].plural}</option>)}
          </select>
        </div>
        {props.canEdit ? <div style={{ display: "flex", gap: 8 }}>
          <select value={newType} onChange={(event) => setNewType(event.target.value as PlaceType)} style={{ minWidth: 170, padding: "9px 11px", borderRadius: theme.radius.control, border: `1px solid ${theme.colors.panelBorder}`, background: theme.colors.inputBg, color: theme.colors.text, font: "inherit" }}>{PLACE_TYPES.map((type) => <option key={type} value={type}>{LABELS[type].singular}</option>)}</select>
          <Button onClick={() => setCreating(true)}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><IconPlus size={14}/> New Place</span></Button>
        </div> : null}
      </div>
      <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px,1.4fr) 170px minmax(220px,1fr) 110px", gap: 10, padding: "8px 12px", background: withAlpha(props.accent,.08), borderBottom: `1px solid ${theme.colors.panelBorder}`, fontSize: "var(--fs-small)", fontWeight: 750 }}><span style={{ color: props.accent }}>Name ▲</span><span>Type</span><span>Parent</span><span>Related</span></div>
        {loading ? <div style={{ padding: 42, textAlign: "center", color: theme.colors.muted }}>Loading…</div> : error ? <div style={{ padding: 42, textAlign: "center", color: theme.colors.red }}>{error}</div> : visible.length ? visible.map((row) => <button key={row.id} type="button" onClick={() => navigate(`/binder/${props.binderId}/${row.referenceType}/${row.id}`)} style={{ width: "100%", display: "grid", gridTemplateColumns: "minmax(240px,1.4fr) 170px minmax(220px,1fr) 110px", gap: 10, alignItems: "center", padding: "7px 12px", border: 0, borderBottom: `1px solid ${theme.colors.panelBorder}`, background: "transparent", color: theme.colors.text, textAlign: "left", cursor: "pointer", font: "inherit", fontSize: "var(--fs-small)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, fontWeight: 750 }}><span style={{ display: "grid", placeItems: "center", color: props.accent, flex: "0 0 auto" }}><PlaceIcon row={row}/></span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span></span>
          <span style={{ color: theme.colors.muted }}>{LABELS[row.referenceType].singular}</span><span style={{ color: row.parent ? theme.colors.muted : "rgba(160,180,220,.48)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.parent?.name ?? "None"}</span><span style={{ color: theme.colors.muted }}>{row.usageCount}</span>
        </button>) : <div style={{ padding: 48, textAlign: "center", color: theme.colors.muted }}>No Places match the current search.</div>}
      </div>
    </div>
    <ReferenceRecordModal isOpen={creating} singularLabel={LABELS[newType].singular} record={null} accent={props.accent} showDescription showIcon={newType === "points-of-interest"} useDrawer parentLabel={parentLabel} parentOptions={parentOptions} onClose={() => setCreating(false)} onSave={create}/>
  </>;
}
