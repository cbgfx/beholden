import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconCakeSlice, IconDna1, IconOrganigram, IconPencil, IconPlus, IconShield, IconTrash, IconVillage } from "@/icons";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { useConfirm } from "@/confirm/ConfirmContext";
import { theme, withAlpha } from "@/theme/theme";
import { createBinderMortal, deleteBinderMortal, fetchBinderMortals, fetchMortalOptions, updateBinderMortal, uploadBinderMortalImage, type BinderMortal, type BinderMortalInput, type MortalOptions } from "@/services/binderMortalApi";
import { MortalRecordModal } from "@/views/BinderView/MortalRecordModal";
import { MarkdownRichText, WysiwygNoteEditor } from "@beholden/shared/ui";
import { fetchBinderRecordOptions, syncBinderMentions, type BinderRecordOption } from "@/services/binderLoreApi";
import { BacklinksPanel } from "./BacklinksPanel";
import { useValidMentionIds } from "./useValidMentionIds";

const mortalTableColumns = "minmax(210px, 1.45fr) minmax(120px, 0.7fr) minmax(135px, 0.85fr) minmax(170px, 1fr) minmax(175px, 1fr) 130px 72px 96px 72px";
const NONE_FILTER = "__none__";

type MortalFilters = {
  position: string[];
  organization: string[];
  continent: string[];
  location: string[];
  species: string[];
  status: string[];
  gender: string[];
  linked: string[];
};

type SavedMortalView = {
  id: string;
  name: string;
  query: string;
  filters: MortalFilters;
};

const emptyFilters = (): MortalFilters => ({
  position: [],
  organization: [],
  continent: [],
  location: [],
  species: [],
  status: [],
  gender: [],
  linked: [],
});

function matchesFilter(value: string | null | undefined, filter: string[]): boolean {
  return !filter.length || filter.some((selected) => selected === NONE_FILTER ? !value : value === selected);
}

function SearchableFilter(props: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  width: number;
  onChange: (value: string) => void;
}) {
  const selected = props.options.find((option) => option.value === props.value) ?? props.options[0];
  const displayValue = `${props.label}: ${selected?.label ?? "All"}`;
  const [query, setQuery] = useState(displayValue);
  const [open, setOpen] = useState(false);
  useEffect(() => setQuery(displayValue), [displayValue]);
  const normalizedQuery = query === displayValue ? "" : query.trim().toLocaleLowerCase();
  const filtered = props.options
    .filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery))
    .slice(0, 20);

  return <div style={{ position: "relative", width: props.width }}>
    <Input
      value={query}
      aria-label={props.label}
      autoComplete="off"
      onFocus={(event) => { setOpen(true); event.currentTarget.select(); }}
      onClick={(event) => { setOpen(true); event.currentTarget.select(); }}
      onBlur={() => window.setTimeout(() => { setOpen(false); setQuery(displayValue); }, 120)}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
      style={{ width: "100%" }}
    />
    {open ? <div style={{ position: "absolute", zIndex: 220, top: "calc(100% + 4px)", left: 0, width: "max-content", minWidth: "100%", maxWidth: 300, maxHeight: 260, overflowY: "auto", padding: 4, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.control, background: "#0d1525", boxShadow: "0 12px 28px rgba(0,0,0,.65)" }}>
      {filtered.map((option) => <button key={option.value || "all"} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { props.onChange(option.value); setOpen(false); }} style={{ display: "block", width: "100%", padding: "8px 10px", border: 0, borderRadius: 6, background: option.value === props.value ? withAlpha(props.label === "Status" ? "#4ade80" : "#38bdf8", 0.14) : "transparent", color: theme.colors.text, textAlign: "left", cursor: "pointer", font: "inherit", whiteSpace: "nowrap" }}>{option.label}</button>)}
      {!filtered.length ? <div style={{ padding: "8px 10px", color: theme.colors.muted }}>No matches</div> : null}
    </div> : null}
  </div>;
}

function addFilterValue(filters: MortalFilters, key: keyof MortalFilters, value: string): MortalFilters {
  if (!value || filters[key].includes(value)) return filters;
  return { ...filters, [key]: [...filters[key], value] };
}

function removeFilterValue(filters: MortalFilters, key: keyof MortalFilters, value: string): MortalFilters {
  return { ...filters, [key]: filters[key].filter((item) => item !== value) };
}

function InlineRichTextField(props: {
  label: string;
  value: string | null;
  canEdit: boolean;
  onSave: (value: string | null) => Promise<void>;
  mentions?: Array<{ id: string; label: string; href: string; type?: string }>;
  validMentionIds?: Set<string>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.value ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(props.value ?? ""), [props.value]);
  return <section>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase" }}>{props.label}</div>
      {props.canEdit && !editing ? <button type="button" onClick={() => setEditing(true)} title={`Edit ${props.label.toLocaleLowerCase()}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: 0, background: "transparent", color: theme.colors.muted, cursor: "pointer", padding: "2px 4px", font: "inherit", fontSize: "var(--fs-small)", fontWeight: 750 }}>
        <IconPencil size={13} /> Edit
      </button> : null}
    </div>
    {editing ? <div style={{ display: "grid", gap: 9, marginTop: 7 }}>
      <WysiwygNoteEditor value={draft} onChange={setDraft} mentions={props.mentions} placeholder={`Add ${props.label.toLocaleLowerCase()}…`} minHeight={220} theme={{ radius: theme.radius.control, panelBorder: theme.colors.panelBorder, inputBg: theme.colors.inputBg, text: theme.colors.text }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={() => { setDraft(props.value ?? ""); setEditing(false); }}>Cancel</Button>
        <Button disabled={saving} onClick={async () => {
          setSaving(true);
          try {
            await props.onSave(draft.trim() || null);
            setEditing(false);
          } finally {
            setSaving(false);
          }
        }}>Save</Button>
      </div>
    </div> : <div style={{ minHeight: 54, marginTop: 7, padding: "7px 8px", color: props.value ? theme.colors.text : theme.colors.muted, lineHeight: 1.55 }}>
      {props.value ? <MarkdownRichText text={props.value} validMentionIds={props.validMentionIds} /> : `No ${props.label.toLocaleLowerCase()} yet.`}
    </div>}
  </section>;
}

function mortalAge(record: BinderMortal, binderCurrentDate: number | null): number | null {
  const birth = Number(record.birthDate?.replaceAll(",", ""));
  const end = record.deathDate ? Number(record.deathDate.replaceAll(",", "")) : binderCurrentDate;
  if (!record.birthDate || !Number.isFinite(birth) || end === null || !Number.isFinite(end)) return null;
  return Math.max(0, end - birth);
}

export function MortalWorkspace(props: { binderId: string; binderCurrentDate: number | null; recordId?: string; accent: string; canEdit: boolean; onRecordsChanged: () => Promise<void> }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [records, setRecords] = useState<BinderMortal[]>([]);
  const [options, setOptions] = useState<MortalOptions>({ records: [], players: [], monsters: [] });
  const [loreRecords, setLoreRecords] = useState<BinderRecordOption[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<MortalFilters>(emptyFilters);
  const [savedViews, setSavedViews] = useState<SavedMortalView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState("");
  const [viewName, setViewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalRecord, setModalRecord] = useState<BinderMortal | "new" | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const savedViewsKey = `binder:${props.binderId}:mortal-views`;

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(savedViewsKey) ?? "[]") as SavedMortalView[];
      setSavedViews(Array.isArray(stored) ? stored.map((view) => ({
        ...view,
        filters: Object.fromEntries(Object.entries(emptyFilters()).map(([key]) => {
          const value = (view.filters as unknown as Record<string, string | string[] | undefined>)[key];
          return [key, Array.isArray(value) ? value : value ? [value] : []];
        })) as MortalFilters,
      })) : []);
    } catch {
      setSavedViews([]);
    }
    setSelectedViewId("");
    setFilters(emptyFilters());
  }, [savedViewsKey]);

  function persistViews(next: SavedMortalView[]) {
    setSavedViews(next);
    localStorage.setItem(savedViewsKey, JSON.stringify(next));
  }

  function saveView() {
    const name = viewName.trim();
    if (!name) return;
    const existing = savedViews.find((view) => view.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    const view: SavedMortalView = {
      id: existing?.id ?? crypto.randomUUID(),
      name,
      query,
      filters,
    };
    const next = existing
      ? savedViews.map((item) => item.id === existing.id ? view : item)
      : [...savedViews, view];
    persistViews(next);
    setSelectedViewId(view.id);
    setViewName("");
  }

  function applyView(viewId: string) {
    setSelectedViewId(viewId);
    const view = savedViews.find((item) => item.id === viewId);
    if (!view) return;
    setQuery(view.query);
    setFilters(view.filters);
  }

  const filteredRecords = useMemo(() => records.filter((record) =>
    (!filters.position.length || filters.position.some((position) => position === NONE_FILTER
      ? record.organizations.every((membership) => !membership.position)
      : record.organizations.some((membership) => membership.position?.id === position)))
    && (!filters.organization.length
      || filters.organization.some((organization) => organization === NONE_FILTER
        ? record.organizations.length === 0
        : record.organizations.some((membership) => membership.id === organization)))
    && matchesFilter(record.continent?.id, filters.continent)
    && matchesFilter(record.location?.id, filters.location)
    && matchesFilter(record.race?.id, filters.species)
    && matchesFilter(record.lifeStatus ?? "alive", filters.status)
    && matchesFilter(record.gender, filters.gender)
    && matchesFilter(record.player ? "true" : "false", filters.linked)
  ), [records, filters]);
  const filterOptions = useMemo(() => ({
    positions: options.records.filter((item) => item.type === "position"),
    organizations: options.records.filter((item) => item.type === "organization"),
    continents: options.records.filter((item) => item.type === "continent"),
    locations: options.records.filter((item) => ["continent", "country", "location", "poi"].includes(item.type)),
    species: options.records.filter((item) => item.type === "race"),
  }), [options.records]);
  const filterChoices = useMemo(() => ({
    position: [{ value: NONE_FILTER, label: "None" }, ...filterOptions.positions.map((item) => ({ value: item.id, label: item.name }))],
    organization: [{ value: NONE_FILTER, label: "None" }, ...filterOptions.organizations.map((item) => ({ value: item.id, label: item.name }))],
    continent: [{ value: NONE_FILTER, label: "None" }, ...filterOptions.continents.map((item) => ({ value: item.id, label: item.name }))],
    location: [{ value: NONE_FILTER, label: "None" }, ...filterOptions.locations.map((item) => ({ value: item.id, label: item.name }))],
    species: [{ value: NONE_FILTER, label: "None" }, ...filterOptions.species.map((item) => ({ value: item.id, label: item.name }))],
    status: [{ value: "alive", label: "Alive" }, { value: "dead", label: "Dead" }],
    gender: [{ value: "male", label: "Male" }, { value: "female", label: "Female" }],
    linked: [{ value: "true", label: "True" }, { value: "false", label: "False" }],
  }), [filterOptions]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mortals, mortalOptions, allRecords] = await Promise.all([
        fetchBinderMortals(props.binderId, query),
        fetchMortalOptions(props.binderId),
        fetchBinderRecordOptions(props.binderId),
      ]);
      setRecords(mortals);
      setOptions(mortalOptions);
      setLoreRecords(allRecords);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load Mortals.");
    } finally {
      setLoading(false);
    }
  }, [props.binderId, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 180);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const selected = props.recordId ? records.find((record) => record.id === props.recordId) : undefined;
  const validMentionIds = useValidMentionIds(props.binderId, selected?.notes, selected?.dmNotes);

  async function save(input: BinderMortalInput, image: File | null) {
    let saved: BinderMortal | null = null;
    if (modalRecord === "new") {
      saved = await createBinderMortal(props.binderId, input);
    } else if (modalRecord) {
      saved = await updateBinderMortal(props.binderId, modalRecord.id, input);
    }
    if (saved && image) await uploadBinderMortalImage(props.binderId, saved.id, image);
    await reload();
    if (modalRecord === "new") await props.onRecordsChanged();
  }

  async function remove(record: BinderMortal) {
    if (!(await confirm({ title: "Delete Mortal", message: `Delete “${record.name}”? Related memberships and event associations will also be removed.`, confirmLabel: "Delete Mortal", intent: "danger" }))) return;
    await deleteBinderMortal(props.binderId, record.id);
    if (props.recordId === record.id) navigate(`/binder/${props.binderId}/mortals`);
    await reload();
    await props.onRecordsChanged();
  }

  const modal = <MortalRecordModal isOpen={modalRecord !== null} record={modalRecord === "new" ? null : modalRecord} binderCurrentDate={props.binderCurrentDate} options={options} onClose={() => setModalRecord(null)} onSave={save} />;

  if (props.recordId && !loading && !selected) {
    return <div style={{ padding: 28, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, color: theme.colors.muted }}>Mortal not found.</div>;
  }

  if (selected) {
    const age = mortalAge(selected, props.binderCurrentDate);
    const genderColor = selected.gender === "male" ? "#7dd3fc" : selected.gender === "female" ? "#f9a8d4" : null;
    const linkedPlayer = selected.player ? options.players.find((player) => player.id === selected.player!.id) : undefined;
    const facts: Array<{ key: string; icon: React.ReactNode; label: string; node: React.ReactNode }> = [
      ...(linkedPlayer?.className ? [{ key: "class", icon: <IconShield size={16} />, label: "Class", node: linkedPlayer.className as React.ReactNode }] : []),
      ...(selected.position ? [{ key: "position", icon: <IconShield size={16} />, label: "Position", node: selected.position.name as React.ReactNode }] : []),
      ...(selected.organizations.length ? [{ key: "organizations", icon: <IconOrganigram size={16} />, label: "Organizations", node: selected.organizations.map((organization) => organization.name).join(", ") as React.ReactNode }] : []),
      ...(selected.location ? [{ key: "location", icon: <IconVillage size={16} />, label: "Location", node: selected.location.name as React.ReactNode }] : []),
      ...(selected.race ? [{ key: "race", icon: <IconDna1 size={16} />, label: "Race", node: selected.race.name as React.ReactNode }] : []),
      ...(age !== null ? [{ key: "age", icon: <IconCakeSlice size={16} />, label: "Age", node: String(age) as React.ReactNode }] : []),
      {
        key: "gender", icon: null, label: "Gender",
        node: genderColor
          ? <span style={{ display: "inline-flex", padding: "2px 7px", borderRadius: 999, color: genderColor, background: withAlpha(genderColor, 0.16), fontSize: "var(--fs-small)", lineHeight: 1.3, fontWeight: 750 }}>{selected.gender === "male" ? "Male" : "Female"}</span>
          : <span style={{ color: theme.colors.red }}>Needs gender</span>,
      },
      {
        key: "status", icon: null, label: "Status",
        node: <span style={{ display: "inline-flex", padding: "2px 7px", borderRadius: 5, color: "#fff", background: selected.lifeStatus === "dead" ? theme.colors.red : theme.colors.green, fontSize: "var(--fs-small)", fontWeight: 800 }}>{selected.lifeStatus === "dead" ? "Dead" : "Alive"}</span>,
      },
      ...(selected.mortalType === "player_character" && selected.player?.playerName
        ? [{ key: "player", icon: null, label: "Player", node: selected.player.playerName as React.ReactNode }]
        : []),
    ];
    const mentions = loreRecords.filter((row) => row.id !== selected.id).map((row) => ({
      id: row.id, label: row.name, href: row.route, type: row.type,
    }));
    return <>
      <div style={{ display: "grid", gap: 16 }}>
        <button type="button" onClick={() => navigate(`/binder/${props.binderId}/mortals`)} style={{ width: "fit-content", border: 0, background: "transparent", color: theme.colors.muted, cursor: "pointer", padding: 0, fontSize: "var(--fs-medium)" }}>← All Mortals</button>
        <article style={{ border: `1px solid ${withAlpha(props.accent, 0.3)}`, borderRadius: theme.radius.panel, background: theme.colors.panelBg, overflow: "hidden" }}>
          <div style={{ height: 4, background: props.accent }} />
          <div style={{ padding: 20, display: "grid", gap: 16, maxWidth: 1240 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <button type="button" onClick={() => { if (props.canEdit) setModalRecord(selected); }} title={props.canEdit ? "Edit portrait" : undefined} style={{ width: 84, height: 84, padding: 0, border: `1px solid ${withAlpha(props.accent, 0.3)}`, borderRadius: theme.radius.control, overflow: "hidden", background: withAlpha(props.accent, 0.1), color: theme.colors.muted, cursor: props.canEdit ? "pointer" : "default", flex: "0 0 auto" }}>
                  {selected.imageUrl
                    ? <img src={`${selected.imageUrl}${selected.imageUpdatedAt ? `?v=${selected.imageUpdatedAt}` : ""}`} alt={`${selected.name} portrait`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: "var(--fs-small)", opacity: 0.72 }}>Portrait</span>}
                </button>
                <h2 style={{ margin: 0, fontSize: "calc(var(--fs-hero) * 0.9)" }}>{selected.name}</h2>
              </div>
              {props.canEdit ? <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" onClick={() => setModalRecord(selected)}><span style={{ display: "inline-flex", gap: 7 }}><IconPencil size={15} /> Edit</span></Button>
                <Button variant="danger" onClick={() => void remove(selected)}><span style={{ display: "inline-flex", gap: 7 }}><IconTrash size={15} /> Delete</span></Button>
              </div> : null}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", columnGap: 30, rowGap: 0 }}>
              {facts.map(({ key, icon, label, node }) => (
                <div key={key} style={{ minHeight: 42, padding: "8px 2px", display: "grid", gridTemplateColumns: "105px minmax(0, 1fr)", gap: 10, alignItems: "center", borderBottom: `1px solid ${withAlpha(props.accent, 0.14)}` }}>
                  <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {icon}{label}
                  </div>
                  <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{node}</div>
                </div>
              ))}
            </div>
            <InlineRichTextField label="Notes" value={selected.notes} mentions={mentions} validMentionIds={validMentionIds} canEdit={props.canEdit} onSave={async (notes) => {
              await updateBinderMortal(props.binderId, selected.id, { notes });
              await syncBinderMentions(props.binderId, selected.id, "description", notes);
              await reload();
            }} />
            <InlineRichTextField label="DM Notes" value={selected.dmNotes} mentions={mentions} validMentionIds={validMentionIds} canEdit={props.canEdit} onSave={async (dmNotes) => {
              await updateBinderMortal(props.binderId, selected.id, { dmNotes });
              await syncBinderMentions(props.binderId, selected.id, "dm_notes", dmNotes);
              await reload();
            }} />
            {/* RelationshipPanel hidden pending redesign — see RelationshipPanel.tsx */}
            <BacklinksPanel binderId={props.binderId} recordId={selected.id} />
          </div>
        </article>
      </div>
      {modal}
    </>;
  }

  return <>
    <div style={{ display: "grid", gap: 13 }}>
      <div style={{ display: "flex", gap: 9, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flex: "1 1 auto" }}>
          <Input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedViewId(""); }} placeholder="Search mortals…" style={{ width: 280 }} />
          <SearchableFilter label="View" value={selectedViewId} width={170} onChange={applyView} options={[
            { value: "", label: "Unsaved" },
            ...savedViews.map((view) => ({ value: view.id, label: view.name })),
          ]} />
          {selectedViewId ? <Button variant="ghost" aria-label="Delete saved view" onClick={() => {
            persistViews(savedViews.filter((view) => view.id !== selectedViewId));
            setSelectedViewId("");
          }}><IconTrash size={14} /></Button> : null}
          <Input value={viewName} onChange={(event) => setViewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveView(); }} placeholder="View name" style={{ width: 140 }} />
          <Button variant="ghost" disabled={!viewName.trim()} onClick={saveView}>Save view</Button>
        </div>
        {props.canEdit ? <Button onClick={() => setModalRecord("new")}><span style={{ display: "inline-flex", gap: 7 }}><IconPlus size={14} /> New Mortal</span></Button> : null}
      </div>
      <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", padding: "7px 0 1px" }}>
        {([
          ["position", "Position", 150],
          ["organization", "Organization", 175],
          ["continent", "Continent", 155],
          ["location", "Location", 165],
          ["species", "Species", 150],
          ["status", "Status", 135],
          ["gender", "Gender", 135],
          ["linked", "Linked", 130],
        ] as Array<[keyof MortalFilters, string, number]>).map(([key, label, width]) => (
          <SearchableFilter
            key={key}
            label={label}
            value=""
            width={width}
            onChange={(value) => { setFilters(addFilterValue(filters, key, value)); setSelectedViewId(""); }}
            options={[{ value: "", label: filters[key].length ? "Add…" : "All" }, ...filterChoices[key].filter((choice) => !filters[key].includes(choice.value))]}
          />
        ))}
        {Object.values(filters).some((values) => values.length) ? <Button variant="ghost" onClick={() => { setFilters(emptyFilters()); setSelectedViewId(""); }}>Clear</Button> : null}
      </div>
      {Object.entries(filters).some(([, values]) => values.length) ? (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          {(Object.entries(filters) as Array<[keyof MortalFilters, string[]]>).flatMap(([key, values]) => values.map((value) => {
            const label = key[0]!.toUpperCase() + key.slice(1);
            const choice = filterChoices[key].find((item) => item.value === value);
            return <button
              key={`${key}:${value}`}
              type="button"
              aria-label={`Remove ${label} ${choice?.label ?? value} filter`}
              onClick={() => { setFilters(removeFilterValue(filters, key, value)); setSelectedViewId(""); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 7px", border: `1px solid ${withAlpha(props.accent, 0.48)}`, borderRadius: 999, background: withAlpha(props.accent, 0.12), color: theme.colors.text, cursor: "pointer", font: "inherit", fontSize: "var(--fs-tiny)", lineHeight: 1.35, fontWeight: 900 }}
            >
              <span style={{ color: props.accent }}>{label}</span>
              {choice?.label ?? value}
              <span aria-hidden style={{ color: theme.colors.red, fontSize: 14, lineHeight: 1 }}>×</span>
            </button>;
          }))}
        </div>
      ) : null}
      <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, overflowX: "auto", overflowY: "hidden" }}>
        <div style={{ minWidth: 1120, display: "grid", gridTemplateColumns: mortalTableColumns, gap: 12, padding: "12px 15px", background: withAlpha(props.accent, 0.08), borderBottom: `1px solid ${theme.colors.panelBorder}` }}>
          {["Name", "Class", "Position", "Organization", "Location", "Species", "Age", "Gender", "Status"].map((column) => <div key={column} style={{ fontSize: "var(--fs-subtitle)", fontWeight: 750 }}>{column}</div>)}
        </div>
        {loading ? <div style={{ padding: 42, textAlign: "center", color: theme.colors.muted }}>Loading…</div>
          : error ? <div role="alert" style={{ padding: 42, textAlign: "center", color: theme.colors.red }}>{error}</div>
          : filteredRecords.length ? filteredRecords.map((record) => {
            const age = mortalAge(record, props.binderCurrentDate);
            const className = record.player ? options.players.find((player) => player.id === record.player!.id)?.className : undefined;
            const genderColor = record.gender === "male" ? "#7dd3fc" : record.gender === "female" ? "#f9a8d4" : null;
            const cell = { color: theme.colors.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
            return <button key={record.id} type="button" onClick={() => navigate(`/binder/${props.binderId}/mortals/${record.id}`)} onMouseEnter={() => setHoveredId(record.id)} onMouseLeave={() => setHoveredId(null)} style={{ minWidth: 1120, width: "100%", display: "grid", gridTemplateColumns: mortalTableColumns, alignItems: "center", gap: 12, padding: "11px 15px", border: 0, borderTop: `1px solid ${theme.colors.panelBorder}`, background: hoveredId === record.id ? withAlpha(props.accent, 0.08) : "transparent", color: theme.colors.text, textAlign: "left", cursor: "pointer", font: "inherit" }}>
              <span title={record.name} style={{ ...cell, color: theme.colors.text, fontWeight: 750, display: "flex", alignItems: "center", gap: 9 }}>
                {record.imageUrl ? <img src={`${record.imageUrl}${record.imageUpdatedAt ? `?v=${record.imageUpdatedAt}` : ""}`} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", flex: "0 0 auto" }} /> : <span style={{ width: 34, height: 34, borderRadius: 6, background: withAlpha(props.accent, 0.12), flex: "0 0 auto" }} />}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{record.name}</span>
              </span>
              <span title={className || "None"} style={cell}>{className || "None"}</span>
              <span title={record.organizations.flatMap((organization) => organization.position?.name ?? []).join(", ") || "None"} style={cell}>{record.organizations.flatMap((organization) => organization.position?.name ?? []).join(", ") || "None"}</span>
              <span title={record.organizations.map((organization) => organization.name).join(", ") || "None"} style={cell}>{record.organizations.map((organization) => organization.name).join(", ") || "None"}</span>
              <span title={record.location?.name ?? "None"} style={cell}>{record.location?.name ?? "None"}</span>
              <span title={record.race?.name ?? "None"} style={cell}>{record.race?.name ?? "None"}</span>
              <span style={cell}>{age ?? "None"}</span>
              <span>{genderColor ? <span style={{ display: "inline-flex", padding: "2px 7px", borderRadius: 999, color: genderColor, background: withAlpha(genderColor, 0.16), fontSize: "var(--fs-small)", lineHeight: 1.3, fontWeight: 750 }}>{record.gender === "male" ? "Male" : "Female"}</span> : <span style={{ ...cell, color: theme.colors.red }}>Needs gender</span>}</span>
              <span style={{ justifySelf: "start", display: "inline-flex", padding: "2px 7px", borderRadius: 5, color: "#fff", background: record.lifeStatus === "dead" ? theme.colors.red : theme.colors.green, fontSize: "var(--fs-small)", lineHeight: 1.3, fontWeight: 800 }}>{record.lifeStatus === "dead" ? "Dead" : "Alive"}</span>
            </button>;
          }) : <div style={{ padding: 48, textAlign: "center", color: theme.colors.muted }}>{records.length ? "No Mortals match the current filters." : query ? "No Mortals match your search." : "No Mortals yet."}</div>}
      </div>
    </div>
    {modal}
  </>;
}
