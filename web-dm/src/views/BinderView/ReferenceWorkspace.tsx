import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconPencil, IconPlus, IconTrash } from "@/icons";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { useConfirm } from "@/confirm/ConfirmContext";
import { theme, withAlpha } from "@/theme/theme";
import {
  addDeityDomain,
  createBinderReference,
  deleteBinderReference,
  fetchBinderReferences,
  removeDeityDomain,
  updateBinderReference,
  uploadBinderReferenceImage,
  type BinderReferenceInput,
  type BinderReferenceLink,
  type BinderReferenceRecord,
  type BinderReferenceType,
} from "@/services/binderReferenceApi";
import { ReferenceRecordModal } from "@/views/BinderView/ReferenceRecordModal";
import { MarkdownRichText, WysiwygNoteEditor } from "@beholden/shared/ui";
import { fetchBinderRecordOptions, syncBinderMentions, type BinderRecordOption } from "@/services/binderLoreApi";
import { SearchableSelect } from "@/components/SearchableSelect";
import { EntityIcon, IconPicker, getDefaultEntityIcon, ICON_ENABLED_REFERENCE_TYPES } from "@/components/iconPicker";
import { BacklinksPanel } from "./BacklinksPanel";
import { useValidMentionIds } from "./useValidMentionIds";

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

function DeityDomainsSection(props: {
  binderId: string;
  deityId: string;
  domains: BinderReferenceLink[];
  options: BinderRecordOption[];
  accent: string;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [addId, setAddId] = useState("");
  const [busy, setBusy] = useState(false);
  const assignedIds = new Set(props.domains.map((domain) => domain.id));
  const available = props.options.filter((option) => !assignedIds.has(option.id));

  async function add() {
    if (!addId || busy) return;
    setBusy(true);
    try {
      await addDeityDomain(props.binderId, props.deityId, addId);
      setAddId("");
      await props.onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(domainId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await removeDeityDomain(props.binderId, props.deityId, domainId);
      await props.onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Domains
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 9 }}>
        {props.domains.length ? props.domains.map((domain) => (
          <span
            key={domain.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 6px 5px 11px",
              borderRadius: 999,
              background: withAlpha(props.accent, 0.14),
              border: `1px solid ${withAlpha(props.accent, 0.3)}`,
              fontSize: "var(--fs-small)",
            }}
          >
            {domain.name}
            {props.canEdit ? (
              <button
                type="button"
                onClick={() => void remove(domain.id)}
                disabled={busy}
                aria-label={`Remove ${domain.name}`}
                title={`Remove ${domain.name}`}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, border: 0, borderRadius: "50%", background: withAlpha("#ffffff", 0.12), color: theme.colors.text, cursor: busy ? "default" : "pointer", padding: 0, lineHeight: 1, fontSize: 12 }}
              >
                ×
              </button>
            ) : null}
          </span>
        )) : <span style={{ color: theme.colors.muted, fontSize: "var(--fs-body)" }}>None</span>}
      </div>
      {props.canEdit ? (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <div style={{ flex: "1 1 auto" }}>
            <SearchableSelect
              value={addId}
              onChange={setAddId}
              disabled={busy || !available.length}
              placeholder={available.length ? "Add a domain…" : "No more domains to add"}
              options={available.map((option) => ({ id: option.id, name: option.name }))}
            />
          </div>
          <Button onClick={() => void add()} disabled={!addId || busy}>Add</Button>
        </div>
      ) : null}
    </section>
  );
}

function OrganizationLeaderSection(props: {
  binderId: string;
  organizationId: string;
  leader: BinderReferenceLink | null;
  options: BinderRecordOption[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickId, setPickId] = useState("");

  async function setLeader(leaderId: string | null) {
    if (busy) return;
    setBusy(true);
    try {
      await updateBinderReference(props.binderId, "organizations", props.organizationId, { leaderId });
      setPicking(false);
      setPickId("");
      await props.onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Leader
      </div>
      {picking ? (
        <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
          <div style={{ flex: "1 1 auto" }}>
            <SearchableSelect
              value={pickId}
              onChange={setPickId}
              disabled={busy}
              placeholder="Choose a Mortal…"
              options={props.options.map((option) => ({ id: option.id, name: option.name }))}
              autoFocus
            />
          </div>
          <Button onClick={() => void setLeader(pickId || null)} disabled={busy || !pickId}>Set</Button>
          <Button variant="ghost" onClick={() => { setPicking(false); setPickId(""); }} disabled={busy}>Cancel</Button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 7 }}>
          {props.leader ? (
            <button
              type="button"
              onClick={() => navigate(`/binder/${props.binderId}/mortals/${props.leader!.id}`)}
              style={{ border: 0, background: "transparent", color: theme.colors.text, cursor: "pointer", padding: 0, font: "inherit", fontSize: "var(--fs-body)", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              {props.leader.name}
            </button>
          ) : (
            <span style={{ fontSize: "var(--fs-body)", color: theme.colors.muted }}>None</span>
          )}
          {props.canEdit ? (
            <>
              <button type="button" onClick={() => setPicking(true)} style={{ border: 0, background: "transparent", color: theme.colors.muted, cursor: "pointer", padding: "2px 4px", font: "inherit", fontSize: "var(--fs-small)", fontWeight: 750 }}>
                {props.leader ? "Change" : "Set leader"}
              </button>
              {props.leader ? (
                <button type="button" onClick={() => void setLeader(null)} disabled={busy} style={{ border: 0, background: "transparent", color: theme.colors.muted, cursor: busy ? "default" : "pointer", padding: "2px 4px", font: "inherit", fontSize: "var(--fs-small)", fontWeight: 750 }}>
                  Clear
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function ReferenceWorkspace(props: {
  binderId: string;
  type: BinderReferenceType;
  recordId?: string;
  accent: string;
  canEdit: boolean;
  onRecordsChanged: () => Promise<void>;
}) {
  const labels = LABELS[props.type];
  const showDescription = !["races", "positions", "organizations"].includes(props.type);
  const showLeader = props.type === "organizations";
  const showIcon = ICON_ENABLED_REFERENCE_TYPES.has(props.type);
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
  const [inlineName, setInlineName] = useState("");
  const [inlineDescription, setInlineDescription] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [inlineSaving, setInlineSaving] = useState(false);
  const portraitInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords(await fetchBinderReferences(props.binderId, props.type, query));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to load ${labels.plural}.`);
    } finally {
      setLoading(false);
    }
  }, [labels.plural, props.binderId, props.type, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 180);
    return () => window.clearTimeout(timer);
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
  const validMentionIds = useValidMentionIds(props.binderId, selected?.description);

  useEffect(() => {
    if (!selected) return;
    setInlineName(selected.name);
    setInlineDescription(selected.description ?? "");
    setEditingDescription(false);
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
      });
      if (changes.description !== undefined) {
        await syncBinderMentions(props.binderId, selected.id, "description", changes.description?.trim() || null);
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
        <div style={{ display: "grid", gap: 16 }}>
          <button type="button" onClick={() => navigate(`/binder/${props.binderId}/${props.type}`)} style={{ width: "fit-content", border: 0, background: "transparent", color: theme.colors.muted, cursor: "pointer", padding: 0, fontSize: "var(--fs-medium)" }}>
            ← All {labels.plural}
          </button>
          <article style={{ border: `1px solid ${withAlpha(props.accent, 0.3)}`, borderRadius: theme.radius.panel, background: theme.colors.panelBg, overflow: "hidden" }}>
            <div style={{ height: 4, background: props.accent }} />
            <div style={{ padding: 24, display: "grid", gap: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
                {props.type === "deities" ? <>
                  <button type="button" onClick={() => { if (props.canEdit) portraitInputRef.current?.click(); }} title={props.canEdit ? "Change portrait" : undefined} style={{ width: 72, height: 72, padding: 0, border: `1px dashed ${theme.colors.panelBorder}`, borderRadius: theme.radius.control, overflow: "hidden", background: withAlpha(props.accent, 0.1), cursor: props.canEdit ? "pointer" : "default", flex: "0 0 auto" }}>
                    {selected.imageUrl ? <img src={`${selected.imageUrl}${selected.imageUpdatedAt ? `?v=${selected.imageUpdatedAt}` : ""}`} alt={`${selected.name} portrait`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                  </button>
                  <input ref={portraitInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={async (event) => {
                    const image = event.target.files?.[0];
                    event.target.value = "";
                    if (!image) return;
                    await uploadBinderReferenceImage(props.binderId, "deities", selected.id, image);
                    await reload();
                  }} />
                </> : null}
                <div style={{ flex: "1 1 auto" }}>
                  {props.canEdit ? <Input
                    aria-label={`${labels.singular} name`}
                    value={inlineName}
                    disabled={inlineSaving}
                    onChange={(event) => setInlineName(event.target.value)}
                    onBlur={() => { if (inlineName.trim() !== selected.name) void saveInline({ name: inlineName }); }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") {
                        setInlineName(selected.name);
                        event.currentTarget.blur();
                      }
                    }}
                    style={{ width: "min(720px, 100%)", padding: "3px 7px", borderColor: "transparent", background: "transparent", fontSize: "calc(var(--fs-hero) * 0.9)", fontWeight: 850 }}
                  /> : <h2 style={{ margin: 0, fontSize: "calc(var(--fs-hero) * 0.9)" }}>{selected.name}</h2>}
                </div>
                {props.canEdit ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button variant="danger" onClick={() => void remove(selected)}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><IconTrash size={15} /> Delete</span>
                    </Button>
                  </div>
                ) : null}
              </div>
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
                    {selected.description ? <MarkdownRichText text={selected.description} validMentionIds={validMentionIds} /> : "No description yet."}
                  </div>}
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
              {props.type === "deities" ? (
                <DeityDomainsSection
                  binderId={props.binderId}
                  deityId={selected.id}
                  domains={selected.domains ?? []}
                  options={loreRecords.filter((option) => option.type === "domain")}
                  accent={props.accent}
                  canEdit={props.canEdit}
                  onChanged={reload}
                />
              ) : (
                <section>
                  <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>{labels.usage}</div>
                  <div style={{ fontSize: "var(--fs-body)", marginTop: 7 }}>{selected.usageCount || "None"}</div>
                </section>
              )}
              {/* RelationshipPanel hidden pending redesign — see RelationshipPanel.tsx */}
              <BacklinksPanel binderId={props.binderId} recordId={selected.id} />
            </div>
          </article>
        </div>
        <ReferenceRecordModal isOpen={modalRecord !== null} singularLabel={labels.singular} record={modalRecord === "new" ? null : modalRecord} accent={props.accent} showDescription={showDescription} showIcon={showIcon} useDrawer={["continents", "countries", "locations", "points-of-interest"].includes(props.type)} parentLabel={parentLabel} parentOptions={parentOptions} onClose={() => setModalRecord(null)} onSave={save} />
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
          <div style={{ display: "grid", gridTemplateColumns: hasMiddleColumn ? "minmax(190px, 1fr) minmax(260px, 2fr) 140px" : "minmax(240px, 1fr) 160px", gap: 12, padding: "12px 15px", background: withAlpha(props.accent, 0.08), borderBottom: `1px solid ${theme.colors.panelBorder}` }}>
            {(showDescription ? ["Name", "Description", labels.usage] : showLeader ? ["Name", "Leader", labels.usage] : ["Name", labels.usage]).map((column) => (
              <div key={column} style={{ color: theme.colors.text, fontSize: "var(--fs-subtitle)", fontWeight: 750 }}>{column}</div>
            ))}
          </div>
          {loading ? (
            <div style={{ padding: 42, textAlign: "center", color: theme.colors.muted }}>Loading…</div>
          ) : error ? (
            <div role="alert" style={{ padding: 42, textAlign: "center", color: theme.colors.red }}>{error}</div>
          ) : records.length ? records.map((record) => {
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
                  gap: 12,
                  padding: "13px 15px",
                  border: 0,
                  borderBottom: `1px solid ${theme.colors.panelBorder}`,
                  background: hovered ? withAlpha(props.accent, 0.08) : "transparent",
                  color: theme.colors.text,
                  cursor: "pointer",
                  textAlign: "left",
                  font: "inherit",
                  transition: "background 120ms ease",
                }}
              >
                <span style={{ fontWeight: 750, display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  {props.type === "deities"
                    ? record.imageUrl
                      ? <img src={`${record.imageUrl}${record.imageUpdatedAt ? `?v=${record.imageUpdatedAt}` : ""}`} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", flex: "0 0 auto" }} />
                      : <span style={{ width: 34, height: 34, borderRadius: 6, background: withAlpha(props.accent, 0.12), flex: "0 0 auto" }} />
                    : showIcon
                      ? <EntityIcon icon={record.icon ?? getDefaultEntityIcon(props.type)} size={22} />
                      : null}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{record.name}</span>
                </span>
                {showDescription ? <span style={{ color: record.description ? theme.colors.muted : "rgba(160,180,220,0.48)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{record.description ?? "None"}</span> : null}
                {showLeader ? <span style={{ color: record.leader ? theme.colors.muted : "rgba(160,180,220,0.48)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{record.leader?.name ?? "None"}</span> : null}
                <span style={{ color: theme.colors.muted }}>{record.usageCount}</span>
              </button>
            );
          }) : (
            <div style={{ padding: 48, textAlign: "center", color: theme.colors.muted, fontSize: "var(--fs-medium)" }}>
              {query ? `No ${labels.plural.toLowerCase()} match your search.` : `No ${labels.plural.toLowerCase()} yet.`}
            </div>
          )}
        </div>
      </div>
      <ReferenceRecordModal isOpen={modalRecord !== null} singularLabel={labels.singular} record={modalRecord === "new" ? null : modalRecord} accent={props.accent} showDescription={showDescription} showIcon={showIcon} useDrawer={["continents", "countries", "locations", "points-of-interest"].includes(props.type)} parentLabel={parentLabel} parentOptions={parentOptions} onClose={() => setModalRecord(null)} onSave={save} />
    </>
  );
}
