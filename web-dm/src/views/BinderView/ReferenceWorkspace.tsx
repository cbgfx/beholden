import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolveAssetUrl } from "@/services/api";
import { IconPencil, IconPlus } from "@/icons";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { useConfirm } from "@/confirm/ConfirmContext";
import { theme, withAlpha } from "@/theme/theme";
import { BinderListEmpty, BinderListError, BinderListHeader, BinderListLoading, BinderRecordThumbnail, compareValues, useBinderListSort } from "@/components/BinderListTable";
import {
  createBinderReference,
  deleteBinderReference,
  DEITY_RANK_COLORS,
  DEITY_RANKS,
  fetchBinderReferences,
  updateBinderReference,
  uploadBinderReferenceImage,
  type BinderReferenceInput,
  type BinderReferenceRecord,
  type BinderReferenceType,
} from "@/services/binderReferenceApi";
import { ReferenceRecordModal } from "@/views/BinderView/ReferenceRecordModal";
import { MarkdownRichText, WysiwygNoteEditor } from "@beholden/shared/ui";
import { fetchBinderRecordOptions, syncBinderMentions, type BinderRecordOption } from "@/services/binderLoreApi";
import { EntityIcon, IconPicker, getDefaultEntityIcon, ICON_ENABLED_REFERENCE_TYPES } from "@/components/iconPicker";
import { BacklinksPanel } from "./BacklinksPanel";
import { useValidMentionIds } from "./useValidMentionIds";
import { useDebouncedEffect } from "@/hooks/useDebouncedEffect";
import { RelatedRecordsPanel } from "./RelatedRecordsPanel";
import { BinderRecordDetailShell } from "./BinderRecordDetailShell";
import { DeityDomainsSection } from "./DeityDomainsSection";
import { OrganizationLeaderSection } from "./OrganizationLeaderSection";
import { OrganizationMembersSection } from "./OrganizationMembersSection";

type ReferenceSortKey = "name" | "middle" | "usage";

const LABELS: Record<BinderReferenceType, { plural: string; singular: string; usage: string }> = {
  races: { plural: "Races", singular: "Race", usage: "Mortals" },
  positions: { plural: "Positions", singular: "Position", usage: "Memberships" },
  domains: { plural: "Domains", singular: "Domain", usage: "Deities" },
  organizations: { plural: "Organizations", singular: "Organization", usage: "Members" },
  deities: { plural: "Deities", singular: "Deity", usage: "Domains" },
  continents: { plural: "Continents", singular: "Continent", usage: "Countries" },
  countries: { plural: "Countries", singular: "Country", usage: "Locations" },
  locations: { plural: "Locations", singular: "Location", usage: "Related records" },
  "points-of-interest": { plural: "Points of Interest", singular: "Point of Interest", usage: "Related records" },
};

type ReferenceViewConfig = {
  isDeities: boolean;
  showDescription: boolean;
  showLeader: boolean;
  showIcon: boolean;
};

const REFERENCE_VIEW_CONFIG: Record<BinderReferenceType, ReferenceViewConfig> = Object.fromEntries(
  (Object.keys(LABELS) as BinderReferenceType[]).map((type) => [type, {
    isDeities: type === "deities",
    showDescription: type !== "races" && type !== "positions",
    showLeader: type === "organizations",
    showIcon: ICON_ENABLED_REFERENCE_TYPES.has(type),
  }]),
) as Record<BinderReferenceType, ReferenceViewConfig>;

export function ReferenceWorkspace(props: {
  binderId: string;
  type: BinderReferenceType;
  recordId?: string;
  accent: string;
  canEdit: boolean;
  onRecordsChanged: () => Promise<void>;
}) {
  const labels = LABELS[props.type];
  const { isDeities, showDescription, showLeader, showIcon } = REFERENCE_VIEW_CONFIG[props.type];
  const showDescriptionColumn = showDescription && !isDeities && !showLeader;
  const hasMiddleColumn = showDescription || showLeader;
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [records, setRecords] = useState<BinderReferenceRecord[]>([]);
  const [loreRecords, setLoreRecords] = useState<BinderRecordOption[]>([]);
  const [parentOptions, setParentOptions] = useState<Array<{ id: string; name: string; type: string; icon: string | null }>>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalRecord, setModalRecord] = useState<BinderReferenceRecord | "new" | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { sortKey, sortDir, toggleSort } = useBinderListSort<ReferenceSortKey>("name");
  const rankOrder = useMemo(() => new Map(DEITY_RANKS.map((rank, index) => [rank, index])), []);
  const sortedRecords = useMemo(() => {
    const sortValue = (record: BinderReferenceRecord): string | number | null => {
      if (sortKey === "name") return record.name;
      if (sortKey === "middle") {
        return isDeities ? (record.domains?.map((domain) => domain.name).join(", ") ?? null)
          : showDescriptionColumn ? record.description
          : showLeader ? (record.leader?.name ?? null)
          : null;
      }
      return isDeities ? (record.rank ? rankOrder.get(record.rank) ?? -1 : -1) : record.usageCount;
    };
    return [...records].sort((a, b) => compareValues(sortValue(a), sortValue(b), sortDir));
  }, [records, sortKey, sortDir, isDeities, showDescriptionColumn, showLeader, rankOrder]);
  const [inlineName, setInlineName] = useState("");
  const [inlineDescription, setInlineDescription] = useState("");
  const [inlineDmNotes, setInlineDmNotes] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingDmNotes, setEditingDmNotes] = useState(false);
  const [inlineSaving, setInlineSaving] = useState(false);
  const portraitInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedRef = useRef(false);

  const reload = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    setError(null);
    try {
      setRecords(await fetchBinderReferences(props.binderId, props.type, query));
      hasLoadedRef.current = true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to load ${labels.plural}.`);
    } finally {
      setLoading(false);
    }
  }, [labels.plural, props.binderId, props.type, query]);

  useDebouncedEffect(reload, 180);

  useEffect(() => {
    const onFocus = () => void reload();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void reload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reload]);

  useEffect(() => {
    void fetchBinderRecordOptions(props.binderId).then(setLoreRecords);
  }, [props.binderId, records.length]);

  useEffect(() => {
    const sourceTypes: BinderReferenceType[] = props.type === "countries"
      ? ["continents"]
      : props.type === "locations"
        ? ["countries"]
        : props.type === "points-of-interest"
          ? ["locations", "countries", "points-of-interest"]
          : [];
    if (!sourceTypes.length) {
      setParentOptions([]);
      return;
    }
    void Promise.all(sourceTypes.map(async (type) => {
      const values = await fetchBinderReferences(props.binderId, type);
      const recordType = type === "locations" ? "location" : type === "points-of-interest" ? "poi" : type.slice(0, -1);
      return values.map((record) => ({ id: record.id, name: record.name, type: recordType, icon: recordType === "poi" ? record.icon : null }));
    })).then((groups) => setParentOptions(groups.flat().filter((option) => option.id !== props.recordId)));
  }, [props.binderId, props.type, props.recordId, records.length]);

  const parentLabel = props.type === "countries"
    ? "Continent"
    : props.type === "locations"
      ? "Country"
      : props.type === "points-of-interest"
        ? "Parent"
        : undefined;

  const selected = props.recordId ? records.find((record) => record.id === props.recordId) : undefined;
  const isPlaceType = ["continents", "countries", "locations", "points-of-interest"].includes(props.type);
  const validMentionIds = useValidMentionIds(props.binderId, selected?.description, selected?.dmNotes);

  useEffect(() => {
    if (!selected) return;
    setInlineName(selected.name);
    setInlineDescription(selected.description ?? "");
    setInlineDmNotes(selected.dmNotes ?? "");
    setEditingDescription(false);
    setEditingDmNotes(false);
  }, [selected]);

  async function saveInline(changes: Partial<BinderReferenceInput>) {
    if (!selected || inlineSaving) return;
    const name = (changes.name ?? inlineName).trim();
    if (!name) {
      setInlineName(selected.name);
      return;
    }
    setInlineSaving(true);
    try {
      await updateBinderReference(props.binderId, props.type, selected.id, {
        name,
        description: changes.description !== undefined
          ? changes.description?.trim() || null
          : selected.description,
        ...(changes.icon !== undefined ? { icon: changes.icon } : {}),
        ...(changes.rank !== undefined ? { rank: changes.rank } : {}),
        ...(changes.dmNotes !== undefined ? { dmNotes: changes.dmNotes?.trim() || null } : {}),
        ...(changes.visibility !== undefined ? { visibility: changes.visibility } : {}),
      });
      if (changes.description !== undefined) {
        await syncBinderMentions(props.binderId, selected.id, "description", changes.description?.trim() || null);
      }
      if (changes.dmNotes !== undefined) {
        await syncBinderMentions(props.binderId, selected.id, "dm_notes", changes.dmNotes?.trim() || null);
      }
      await reload();
    } finally {
      setInlineSaving(false);
    }
  }

  async function save(input: BinderReferenceInput) {
    if (modalRecord === "new") {
      await createBinderReference(props.binderId, props.type, input);
      await reload();
      await props.onRecordsChanged();
      return;
    }
    if (modalRecord) {
      await updateBinderReference(props.binderId, props.type, modalRecord.id, input);
      await reload();
    }
  }

  async function remove(record: BinderReferenceRecord) {
    const impact = record.usageCount
      ? ` ${record.usageCount} linked ${labels.usage.toLowerCase()} will be cleared.`
      : "";
    if (!(await confirm({
      title: `Delete ${labels.singular}`,
      message: `Delete “${record.name}”?${impact}`,
      confirmLabel: `Delete ${labels.singular}`,
      intent: "danger",
    }))) return;
    await deleteBinderReference(props.binderId, props.type, record.id);
    if (props.recordId === record.id) navigate(`/binder/${props.binderId}/${props.type}`);
    await reload();
    await props.onRecordsChanged();
  }

  if (props.recordId && !loading && !selected) {
    return (
      <div style={{ padding: 28, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, color: theme.colors.muted }}>
        {labels.singular} not found.
      </div>
    );
  }

  if (selected) {
    const mentions = loreRecords.filter((row) => row.id !== selected.id).map((row) => ({
      id: row.id, label: row.name, href: row.route, type: row.type,
    }));
    return (
      <>
        <BinderRecordDetailShell
          onBack={() => navigate(`/binder/${props.binderId}/${isPlaceType ? "places" : props.type}`)}
          backLabel={isPlaceType ? "Places" : labels.plural}
          accent={props.accent}
          leading={props.type === "deities" ? (
            <>
              <button type="button" onClick={() => { if (props.canEdit) portraitInputRef.current?.click(); }} title={props.canEdit ? "Change portrait" : undefined} style={{ width: 72, height: 72, padding: 0, border: `1px dashed ${theme.colors.panelBorder}`, borderRadius: theme.radius.control, overflow: "hidden", background: withAlpha(props.accent, 0.1), cursor: props.canEdit ? "pointer" : "default", flex: "0 0 auto" }}>
                {selected.imageUrl ? <img src={`${resolveAssetUrl(selected.imageUrl)}${selected.imageUpdatedAt ? `?v=${selected.imageUpdatedAt}` : ""}`} alt={`${selected.name} portrait`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
              </button>
              <input ref={portraitInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={async (event) => {
                const image = event.target.files?.[0];
                event.target.value = "";
                if (!image) return;
                await uploadBinderReferenceImage(props.binderId, "deities", selected.id, image);
                await reload();
              }} />
            </>
          ) : null}
          name={props.canEdit ? {
            editable: true,
            value: inlineName,
            ariaLabel: `${labels.singular} name`,
            disabled: inlineSaving,
            onChange: setInlineName,
            onCommit: () => { if (inlineName.trim() !== selected.name) void saveInline({ name: inlineName }); },
            onCancel: () => setInlineName(selected.name),
          } : { editable: false, value: selected.name }}
          canEdit={props.canEdit}
          recordLabel={labels.singular}
          visibilityPublic={selected.visibility === "public"}
          onVisibilityChange={() => void saveInline({ visibility: selected.visibility === "public" ? "dm" : "public" })}
          visibilityBusy={inlineSaving}
          onEdit={() => setModalRecord(selected)}
          onDelete={() => void remove(selected)}
        >
              {showIcon ? (
                props.canEdit ? (
                  <IconPicker
                    value={selected.icon}
                    onChange={(icon) => void saveInline({ icon })}
                    label="Icon"
                  />
                ) : (
                  <section>
                    <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>Icon</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}>
                      <EntityIcon icon={selected.icon ?? getDefaultEntityIcon(props.type)} size={22} />
                    </div>
                  </section>
                )
              ) : null}
              {isDeities ? (
                <section>
                  <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rank</div>
                  {props.canEdit ? <select
                    aria-label="Deity rank"
                    value={selected.rank ?? ""}
                    disabled={inlineSaving}
                    onChange={(event) => void saveInline({ rank: event.target.value ? event.target.value as typeof selected.rank : null })}
                    style={{ width: "min(280px, 100%)", marginTop: 7, padding: "9px 11px", borderRadius: theme.radius.control, border: `1px solid ${theme.colors.panelBorder}`, background: theme.colors.inputBg, color: selected.rank ? DEITY_RANK_COLORS[selected.rank] : theme.colors.muted, font: "inherit", fontWeight: 800, cursor: inlineSaving ? "default" : "pointer" }}
                  >
                    <option value="">None</option>
                    {DEITY_RANKS.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
                  </select> : <div style={{ marginTop: 7, fontWeight: 800, color: selected.rank ? DEITY_RANK_COLORS[selected.rank] : theme.colors.muted }}>{selected.rank ?? "None"}</div>}
                </section>
              ) : null}
              {showDescription ? (
                <section>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</div>
                    {props.canEdit && !editingDescription ? <button type="button" onClick={() => setEditingDescription(true)} title="Edit description" style={{ display: "inline-flex", alignItems: "center", gap: 5, border: 0, background: "transparent", color: theme.colors.muted, cursor: "pointer", padding: "2px 4px", font: "inherit", fontSize: "var(--fs-small)", fontWeight: 750 }}>
                      <IconPencil size={13} /> Edit
                    </button> : null}
                  </div>
                  {editingDescription && props.canEdit ? <div style={{ display: "grid", gap: 9, marginTop: 7 }}>
                    <WysiwygNoteEditor
                      value={inlineDescription}
                      onChange={setInlineDescription}
                      mentions={mentions}
                      placeholder="Add a description…"
                      minHeight={240}
                      theme={{ radius: theme.radius.control, panelBorder: theme.colors.panelBorder, inputBg: theme.colors.inputBg, text: theme.colors.text }}
                    />
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Button variant="ghost" onClick={() => { setInlineDescription(selected.description ?? ""); setEditingDescription(false); }}>Cancel</Button>
                      <Button disabled={inlineSaving} onClick={async () => { await saveInline({ description: inlineDescription }); setEditingDescription(false); }}>Save</Button>
                    </div>
                  </div> : <div style={{ minHeight: 72, marginTop: 7, padding: "8px 9px", color: selected.description ? theme.colors.text : theme.colors.muted, fontSize: "var(--fs-body)", lineHeight: 1.55 }}>
                    {selected.description ? <MarkdownRichText text={selected.description} validMentionIds={validMentionIds} binderId={props.binderId} /> : "No description yet."}
                  </div>}
                </section>
              ) : null}
              {isDeities ? (
                <section>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>DM Notes</div>
                    {props.canEdit && !editingDmNotes ? <button type="button" onClick={() => setEditingDmNotes(true)} title="Edit DM notes" style={{ display: "inline-flex", alignItems: "center", gap: 5, border: 0, background: "transparent", color: theme.colors.muted, cursor: "pointer", padding: "2px 4px", font: "inherit", fontSize: "var(--fs-small)", fontWeight: 750 }}><IconPencil size={13}/> Edit</button> : null}
                  </div>
                  {editingDmNotes && props.canEdit ? <div style={{ display: "grid", gap: 9, marginTop: 7 }}>
                    <WysiwygNoteEditor value={inlineDmNotes} onChange={setInlineDmNotes} mentions={mentions} placeholder="Add notes that are always hidden from players…" minHeight={180} theme={{ radius: theme.radius.control, panelBorder: theme.colors.panelBorder, inputBg: theme.colors.inputBg, text: theme.colors.text }}/>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><Button variant="ghost" onClick={() => { setInlineDmNotes(selected.dmNotes ?? ""); setEditingDmNotes(false); }}>Cancel</Button><Button disabled={inlineSaving} onClick={async () => { await saveInline({ dmNotes: inlineDmNotes }); setEditingDmNotes(false); }}>Save</Button></div>
                  </div> : <div style={{ minHeight: 54, marginTop: 7, padding: "8px 9px", color: selected.dmNotes ? theme.colors.text : theme.colors.muted, lineHeight: 1.55 }}>{selected.dmNotes ? <MarkdownRichText text={selected.dmNotes} validMentionIds={validMentionIds} binderId={props.binderId}/> : "No DM notes yet."}</div>}
                </section>
              ) : null}
              {parentLabel ? (
                <section>
                  <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>{parentLabel}</div>
                  <button
                    type="button"
                    onClick={() => { if (props.canEdit) setModalRecord(selected); }}
                    style={{ marginTop: 7, padding: "6px 9px", border: "1px solid transparent", borderRadius: theme.radius.control, background: "transparent", color: selected.parent ? theme.colors.text : theme.colors.muted, cursor: props.canEdit ? "pointer" : "default", font: "inherit", fontSize: "var(--fs-body)", textAlign: "left" }}
                  >
                    {selected.parent?.name ?? "None"}
                  </button>
                </section>
              ) : null}
              {showLeader ? (
                <OrganizationLeaderSection
                  binderId={props.binderId}
                  organizationId={selected.id}
                  leader={selected.leader}
                  options={loreRecords.filter((option) => option.type === "mortal")}
                  canEdit={props.canEdit}
                  onChanged={reload}
                />
              ) : null}
              {props.type === "organizations" ? (
                <OrganizationMembersSection binderId={props.binderId} organizationId={selected.id} count={selected.usageCount} />
              ) : props.type === "deities" ? (
                <DeityDomainsSection
                  binderId={props.binderId}
                  deityId={selected.id}
                  domains={selected.domains ?? []}
                  options={loreRecords.filter((option) => option.type === "domain")}
                  accent={props.accent}
                  canEdit={props.canEdit}
                  onChanged={reload}
                />
              ) : null}
              <RelatedRecordsPanel binderId={props.binderId} recordId={selected.id} />
              <BacklinksPanel binderId={props.binderId} recordId={selected.id} />
        </BinderRecordDetailShell>
        <ReferenceRecordModal isOpen={modalRecord !== null} singularLabel={labels.singular} record={modalRecord === "new" ? null : modalRecord} accent={props.accent} showDescription={showDescription} showIcon={showIcon} showRank={isDeities} showDmNotes={isDeities} useDrawer={["continents", "countries", "locations", "points-of-interest"].includes(props.type)} parentLabel={parentLabel} parentOptions={parentOptions} onClose={() => setModalRecord(null)} onSave={save} />
      </>
    );
  }

  return (
    <>
      <div style={{ display: "grid", gap: 13 }}>
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${labels.plural.toLowerCase()}…`} style={{ width: "min(360px, 100%)" }} />
          {props.canEdit ? (
            <Button onClick={() => setModalRecord("new")}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><IconPlus size={14} /> New {labels.singular}</span>
            </Button>
          ) : null}
        </div>

        <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, overflow: "hidden" }}>
          <BinderListHeader
            columns={[
              { key: "name", label: "Name", sortable: true },
              ...(isDeities ? [{ key: "middle", label: "Domains", sortable: true }]
                : showDescriptionColumn ? [{ key: "middle", label: "Description", sortable: true }]
                : showLeader ? [{ key: "middle", label: "Leader", sortable: true }]
                : []),
              { key: "usage", label: isDeities ? "Rank" : labels.usage, sortable: true },
            ]}
            gridTemplateColumns={hasMiddleColumn ? "minmax(190px, 1fr) minmax(260px, 2fr) 140px" : "minmax(240px, 1fr) 160px"}
            accent={props.accent}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={(key) => toggleSort(key as ReferenceSortKey)}
          />
          {loading ? (
            <BinderListLoading />
          ) : error ? (
            <BinderListError message={error} />
          ) : sortedRecords.length ? sortedRecords.map((record) => {
            const hovered = hoveredId === record.id;
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => navigate(`/binder/${props.binderId}/${props.type}/${record.id}`)}
                onMouseEnter={() => setHoveredId(record.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: hasMiddleColumn ? "minmax(190px, 1fr) minmax(260px, 2fr) 140px" : "minmax(240px, 1fr) 160px",
                  gap: 10,
                  padding: "7px 12px",
                  border: 0,
                  borderBottom: `1px solid ${theme.colors.panelBorder}`,
                  background: hovered ? withAlpha(props.accent, 0.08) : "transparent",
                  color: theme.colors.text,
                  cursor: "pointer",
                  textAlign: "left",
                  font: "inherit",
                  fontSize: "var(--fs-small)",
                  transition: "background 120ms ease",
                }}
              >
                <span style={{ fontWeight: 750, display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  {isDeities
                    ? <BinderRecordThumbnail imageUrl={record.imageUrl} imageUpdatedAt={record.imageUpdatedAt} accent={props.accent} />
                    : showIcon
                      ? <EntityIcon icon={record.icon ?? getDefaultEntityIcon(props.type)} size={22} />
                      : null}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{record.name}</span>
                </span>
                {isDeities ? (
                  <span title={record.domains?.map((domain) => domain.name).join(", ") || "None"} style={{ color: record.domains?.length ? theme.colors.muted : "rgba(160,180,220,0.48)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {record.domains?.map((domain) => domain.name).join(", ") || "None"}
                  </span>
                ) : showDescriptionColumn ? (
                  <span style={{ color: record.description ? theme.colors.muted : "rgba(160,180,220,0.48)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{record.description ?? "None"}</span>
                ) : showLeader ? (
                  <span style={{ color: record.leader ? theme.colors.muted : "rgba(160,180,220,0.48)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{record.leader?.name ?? "None"}</span>
                ) : null}
                {isDeities ? (
                  record.rank ? (
                    <span style={{ fontWeight: 800, color: DEITY_RANK_COLORS[record.rank] }}>
                      {record.rank}
                    </span>
                  ) : <span style={{ color: "rgba(160,180,220,0.48)" }}>None</span>
                ) : (
                  <span style={{ color: theme.colors.muted }}>{record.usageCount}</span>
                )}
              </button>
            );
          }) : (
            <BinderListEmpty>
              {query ? `No ${labels.plural.toLowerCase()} match your search.` : `No ${labels.plural.toLowerCase()} yet.`}
            </BinderListEmpty>
          )}
        </div>
      </div>
      <ReferenceRecordModal isOpen={modalRecord !== null} singularLabel={labels.singular} record={modalRecord === "new" ? null : modalRecord} accent={props.accent} showDescription={showDescription} showIcon={showIcon} showRank={isDeities} showDmNotes={isDeities} useDrawer={["continents", "countries", "locations", "points-of-interest"].includes(props.type)} parentLabel={parentLabel} parentOptions={parentOptions} onClose={() => setModalRecord(null)} onSave={save} />
    </>
  );
}
