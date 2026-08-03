import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolveAssetUrl } from "@/services/api";
import { IconPencil, IconPlus, IconTrash } from "@/icons";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { useConfirm } from "@/confirm/ConfirmContext";
import { theme, withAlpha } from "@/theme/theme";
import { BinderListEmpty, BinderListError, BinderListHeader, BinderListLoading, BinderRecordThumbnail, compareValues, useBinderListSort } from "@/components/BinderListTable";
import {
  addDeityDomain,
  createBinderReference,
  deleteBinderReference,
  DEITY_RANK_COLORS,
  DEITY_RANKS,
  fetchBinderReferences,
  fetchBinderLeaderCharacterOptions,
  fetchBinderOrganizationMembers,
  removeDeityDomain,
  setBinderOrganizationLeaderCharacter,
  updateBinderReference,
  uploadBinderReferenceImage,
  type BinderReferenceInput,
  type BinderOrganizationMember,
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
  const [characterOptions, setCharacterOptions] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!picking) return;
    void fetchBinderLeaderCharacterOptions(props.binderId).then(setCharacterOptions).catch(() => setCharacterOptions([]));
  }, [picking, props.binderId]);

  async function setLeader(leaderId: string | null) {
    if (busy) return;
    setBusy(true);
    try {
      if (leaderId?.startsWith("character:")) {
        await setBinderOrganizationLeaderCharacter(props.binderId, props.organizationId, leaderId.slice("character:".length));
      } else {
        await updateBinderReference(props.binderId, "organizations", props.organizationId, { leaderId });
      }
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
              options={[
                ...props.options.map((option) => ({ id: option.id, name: option.name })),
                ...characterOptions.map((option) => ({ id: `character:${option.id}`, name: `${option.name} (unassigned PC)` })),
              ]}
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

function OrganizationMembersSection(props: { binderId: string; organizationId: string; count: number }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<BinderOrganizationMember[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setOpen(false); setMembers(null); }, [props.organizationId]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || members !== null || loading) return;
    setLoading(true);
    try { setMembers(await fetchBinderOrganizationMembers(props.binderId, props.organizationId)); }
    finally { setLoading(false); }
  }

  return <section>
    <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>Members</div>
    {props.count ? <button type="button" onClick={() => void toggle()} aria-expanded={open} style={{ marginTop: 7, padding: 0, border: 0, background: "transparent", color: theme.colors.text, cursor: "pointer", font: "inherit", fontSize: "var(--fs-body)", textDecoration: "underline", textUnderlineOffset: 3 }}>{props.count} {open ? "▴" : "▾"}</button> : <div style={{ fontSize: "var(--fs-body)", marginTop: 7 }}>None</div>}
    {open ? <div style={{ display: "grid", gap: 2, marginTop: 8, padding: 8, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.control, background: theme.colors.inputBg }}>
      {loading ? <div style={{ color: theme.colors.muted, padding: 6 }}>Loading…</div> : (members ?? []).map((member) => <button key={member.id} type="button" onClick={() => navigate(`/binder/${props.binderId}/mortals/${member.id}`)} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 8px", border: 0, borderRadius: 6, background: "transparent", color: theme.colors.text, cursor: "pointer", font: "inherit", textAlign: "left" }}><span>{member.name}</span>{member.position || member.role ? <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>{member.position ?? member.role}</span> : null}</button>)}
    </div> : null}
  </section>;
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
  const isDeities = props.type === "deities";
  const showDescription = !["races", "positions"].includes(props.type);
  const showLeader = props.type === "organizations";
  const showDescriptionColumn = showDescription && !isDeities && !showLeader;
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
        ...(changes.rank !== undefined ? { rank: changes.rank } : {}),
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
                    {selected.imageUrl ? <img src={`${resolveAssetUrl(selected.imageUrl)}${selected.imageUpdatedAt ? `?v=${selected.imageUpdatedAt}` : ""}`} alt={`${selected.name} portrait`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
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
              {isDeities ? (
                <section>
                  <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rank</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
                    {DEITY_RANKS.map((rank) => {
                      const active = selected.rank === rank;
                      const color = DEITY_RANK_COLORS[rank];
                      return (
                        <button
                          key={rank}
                          type="button"
                          disabled={!props.canEdit}
                          onClick={() => void saveInline({ rank: active ? null : rank })}
                          style={{
                            padding: "4px 12px",
                            borderRadius: 999,
                            border: `1.5px solid ${color}`,
                            background: active ? color : withAlpha(color, 0.14),
                            color: active ? "#0b0e14" : color,
                            fontWeight: 800,
                            fontSize: "var(--fs-small)",
                            cursor: props.canEdit ? "pointer" : "default",
                          }}
                        >
                          {rank}
                        </button>
                      );
                    })}
                  </div>
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
        <ReferenceRecordModal isOpen={modalRecord !== null} singularLabel={labels.singular} record={modalRecord === "new" ? null : modalRecord} accent={props.accent} showDescription={showDescription} showIcon={showIcon} showRank={isDeities} useDrawer={["continents", "countries", "locations", "points-of-interest"].includes(props.type)} parentLabel={parentLabel} parentOptions={parentOptions} onClose={() => setModalRecord(null)} onSave={save} />
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
      <ReferenceRecordModal isOpen={modalRecord !== null} singularLabel={labels.singular} record={modalRecord === "new" ? null : modalRecord} accent={props.accent} showDescription={showDescription} showIcon={showIcon} showRank={isDeities} useDrawer={["continents", "countries", "locations", "points-of-interest"].includes(props.type)} parentLabel={parentLabel} parentOptions={parentOptions} onClose={() => setModalRecord(null)} onSave={save} />
    </>
  );
}
