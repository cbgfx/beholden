import { ReferencedMarkdown as MarkdownRichText } from "@beholden/shared/ui/ReferencedMarkdown";
import { useWs } from "@/services/ws";
import { useUiMessages, useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { useRichTextDraft } from "./useRichTextDraft";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolveAssetUrl } from "@/services/api";
import { IconCamera, IconGender, IconPencil, IconPlayer, IconPlus, IconShield, IconTrash } from "@/icons";
import { IconCakeSlice, IconDna1, IconOrganigram, IconVillage } from "@/views/BinderView/binderIcons";
import { EntityIcon } from "@/components/iconPicker/EntityIcon";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { useConfirm } from "@/confirm/ConfirmContext";
import { theme, withAlpha } from "@/theme/theme";
import { BinderListEmpty, BinderListError, BinderListHeader, BinderListLoading, BinderRecordThumbnail, compareValues, useBinderListSort } from "@/components/BinderListTable";
import { SearchableMultiFilter, SearchableSelect } from "@/components/SearchableSelect";
import { createBinderMortal, deleteBinderMortal, fetchBinderMortals, fetchMortalOptions, updateBinderMortal, uploadBinderMortalImage, type BinderMortal, type BinderMortalInput, type MortalOptions } from "@/services/binderMortalApi";
import { BINDER_MORTAL_COLUMNS, BinderDataTableRow, ImageLightbox } from "@beholden/shared/ui";
import { MortalRecordModal } from "@/views/BinderView/MortalRecordModal";
import { WysiwygNoteEditor } from "@beholden/shared/ui";
import { fetchBinderRecordOptions, syncBinderMentions, type BinderRecordOption } from "@/services/binderLoreApi";
import { BacklinksPanel } from "./BacklinksPanel";
import { useValidMentionIds } from "./useValidMentionIds";
import { useDebouncedEffect } from "@/hooks/useDebouncedEffect";
import { useIsNarrow } from "@/hooks/useIsNarrow";
import { VisibilityIcon } from "./VisibilityIcon";
import { BinderRecordDetailShell } from "./BinderRecordDetailShell";
import { emptyMortalFilters as emptyFilters, useMortalSavedViews, type MortalFilters } from "./useMortalSavedViews";
import { LinkedMortalStatblock } from "./LinkedMortalStatblock";

const mortalTableColumns = BINDER_MORTAL_COLUMNS;
const NONE_FILTER = "__none__";

function OrganizationIcon(props: { icon?: string | null; size: number }) {
  return props.icon ? <EntityIcon icon={props.icon} size={props.size} /> : <IconOrganigram size={props.size} />;
}

type MortalSortKey = "name" | "position" | "organization" | "location" | "species" | "age" | "gender" | "status";

function matchesFilter(value: string | null | undefined, filter: string[]): boolean {
  return !filter.length || filter.some((selected) => selected === NONE_FILTER ? !value : value === selected);
}

function addFilterValue(filters: MortalFilters, key: keyof MortalFilters, value: string): MortalFilters {
  if (!value || filters[key].includes(value)) return filters;
  return { ...filters, [key]: [...filters[key], value] };
}

function removeFilterValue(filters: MortalFilters, key: keyof MortalFilters, value: string): MortalFilters {
  return { ...filters, [key]: filters[key].filter((item) => item !== value) };
}

function InlineRichTextField(props: {
  sourceField: string;
  label: string;
  value: string | null;
  canEdit: boolean;
  onSave: (value: string | null) => Promise<void>;
  mentions?: Array<{ id: string; label: string; href: string; type?: string }>;
  validMentionIds?: Set<string>;
  binderId: string;
}) {
  const translateUi = useUiTranslation("dmUi");
  const { editing, draft, saving, error, setDraft, startEditing, cancel, save } = useRichTextDraft(props.value, props.onSave);
  return <section>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase" }}>{props.label}</div>
      {props.canEdit && !editing ? <button type="button" onClick={startEditing} title={translateUi("Edit {{value1}}", { value1: props.label.toLocaleLowerCase() })} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: 0, background: "transparent", color: theme.colors.muted, cursor: "pointer", padding: "2px 4px", font: "inherit", fontSize: "var(--fs-small)", fontWeight: 750 }}>
        <IconPencil size={13} /> {translateUi("Edit")}
      </button> : null}
    </div>
    {editing ? <div style={{ display: "grid", gap: 9, marginTop: 7 }}>
      <WysiwygNoteEditor value={draft} onChange={setDraft} mentions={props.mentions} placeholder={translateUi("Add {{value1}}…", { value1: props.label.toLocaleLowerCase() })} minHeight={220} theme={{ radius: theme.radius.control, panelBorder: theme.colors.panelBorder, inputBg: theme.colors.inputBg, text: theme.colors.text }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" disabled={saving} onClick={cancel}>{translateUi("Cancel")}</Button>
            <Button disabled={saving} onClick={save}>{saving ? translateUi("Saving…") : translateUi("Save")}</Button>
            {error ? <div role="alert">{error}</div> : null}
      </div>
    </div> : <div style={{ minHeight: 54, marginTop: 7, padding: "7px 8px", color: props.value ? theme.colors.text : theme.colors.muted, lineHeight: 1.55 }}>
      {props.value ? <MarkdownRichText sourceField={props.sourceField} text={props.value} validMentionIds={props.validMentionIds} binderId={props.binderId} /> : translateUi("No {{value1}} yet.", { value1: props.label.toLocaleLowerCase() })}
    </div>}
  </section>;
}

/**
 * The phone version of a Mortal list row: portrait, name, a one-line summary of who they are and
 * where, and their alive/dead status. The full table needs ~1000px, so it only shows on wide screens.
 */
function MortalCardRow(props: { record: BinderMortal; accent: string; onOpen: () => void }) {
  const translateUi = useUiTranslation("dmUi");
  const { record } = props;
  const summary = [record.position?.name, record.race?.name, record.location?.name].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={props.onOpen}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        gap: 10,
        alignItems: "center",
        padding: "9px 11px",
        border: 0,
        borderBottom: `1px solid ${theme.colors.panelBorder}`,
        background: "transparent",
        color: theme.colors.text,
        font: "inherit",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <BinderRecordThumbnail imageUrl={record.imageUrl} imageUpdatedAt={record.imageUpdatedAt} accent={props.accent} size={40} />
      <span style={{ minWidth: 0, display: "grid", gap: 2 }}>
        <span style={{ fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{record.name}</span>
        {summary ? <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</span> : null}
      </span>
      <span
        style={{
          padding: "2px 7px",
          borderRadius: 5,
          color: "#fff",
          background: record.lifeStatus === "dead" ? theme.colors.red : theme.colors.green,
          fontSize: "var(--fs-small)",
          fontWeight: 800,
        }}
      >
        {record.lifeStatus === "dead" ? translateUi("Dead") : translateUi("Alive")}
      </span>
    </button>
  );
}

function mortalAge(record: BinderMortal, binderCurrentDate: number | null): number | null {
  const birth = Number(record.birthDate?.replaceAll(",", ""));
  const end = record.deathDate ? Number(record.deathDate.replaceAll(",", "")) : binderCurrentDate;
  if (!record.birthDate || !Number.isFinite(birth) || end === null || !Number.isFinite(end)) return null;
  return Math.max(0, end - birth);
}

export function MortalWorkspace(props: { binderId: string; binderCurrentDate: number | null; recordId?: string; accent: string; canEdit: boolean; onRecordsChanged: () => Promise<void> }) {
  const translateMessage = useUiMessages("dmUi");
  const translateUi = useUiTranslation("dmUi");
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [records, setRecords] = useState<BinderMortal[]>([]);
  const [options, setOptions] = useState<MortalOptions>({ records: [], players: [], monsters: [] });
  const [loreRecords, setLoreRecords] = useState<BinderRecordOption[]>([]);
  const persisted = useMemo(() => {
    try {
      const value = JSON.parse(localStorage.getItem(`binder:${props.binderId}:mortals-filters`) ?? "null") as { query?: unknown; filters?: MortalFilters } | null;
      return { query: typeof value?.query === "string" ? value.query : "", filters: value?.filters ?? emptyFilters() };
    } catch { return { query: "", filters: emptyFilters() }; }
  }, [props.binderId]);
  const [query, setQuery] = useState(persisted.query);
  const [filters, setFilters] = useState<MortalFilters>(persisted.filters);
  const { savedViews, selectedViewId, viewName, setViewName, save: saveMortalView, apply: applyMortalView, removeSelected: removeSelectedMortalView, clearSelection: clearSelectedMortalView } = useMortalSavedViews(props.binderId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalRecord, setModalRecord] = useState<BinderMortal | "new" | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const { sortKey, sortDir, toggleSort } = useBinderListSort<MortalSortKey>("name");
  // Phones get a card list instead of the wide table, and the filter row tucked behind a toggle.
  const isNarrow = useIsNarrow("(max-width: 760px)");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Lets the portrait on a Mortal's page take a new photo straight away, without going through
  // the edit drawer. On a phone the file picker offers both the camera and the photo library.
  const portraitInputRef = useRef<HTMLInputElement>(null);
  const [portraitUploading, setPortraitUploading] = useState(false);
  const [portraitError, setPortraitError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(`binder:${props.binderId}:mortals-filters`, JSON.stringify({ query, filters }));
  }, [filters, props.binderId, query]);

  function applyView(viewId: string) {
    const view = applyMortalView(viewId);
    if (!view) return;
    setQuery(view.query);
    setFilters(view.filters);
  }

  const filteredRecords = useMemo(() => records.filter((record) =>
    (!filters.position.length || filters.position.some((position) => position === NONE_FILTER
      ? !record.position
      : record.position?.id === position))
    && (!filters.organization.length
      || filters.organization.some((organization) => organization === NONE_FILTER
        ? record.organizations.length === 0
        : record.organizations.some((membership) => membership.id === organization)))
    && matchesFilter(record.continent?.id, filters.continent)
    && matchesFilter(record.location?.id, filters.location)
    && matchesFilter(record.race?.id, filters.species)
    && matchesFilter(record.lifeStatus ?? "alive", filters.status)
    && matchesFilter(record.gender, filters.gender)
    // "Linked" means linked to anything external, not just a player character -- an NPC-type
    // mortal is linked via its statblock (monsterId), not a player record.
    && matchesFilter(record.player || record.monsterId ? "true" : "false", filters.linked)
  ), [records, filters]);
  const sortedRecords = useMemo(() => {
    const sortValue = (record: BinderMortal): string | number | null => {
      switch (sortKey) {
        case "name": return record.name;
        case "position": return record.position?.name ?? null;
        case "organization": return record.organizations.map((organization) => organization.name).join(", ");
        case "location": return record.location?.name ?? null;
        case "species": return record.race?.name ?? null;
        case "age": return mortalAge(record, props.binderCurrentDate);
        case "gender": return record.gender ?? null;
        case "status": return record.lifeStatus === "dead" ? 1 : 0;
        default: return null;
      }
    };
    return [...filteredRecords].sort((a, b) => compareValues(sortValue(a), sortValue(b), sortDir));
  }, [filteredRecords, sortKey, sortDir, props.binderCurrentDate]);
  const filterOptions = useMemo(() => ({
    positions: options.records.filter((item) => item.type === "position"),
    organizations: options.records.filter((item) => item.type === "organization"),
    continents: options.records.filter((item) => item.type === "continent"),
    locations: options.records.filter((item) => item.type === "location" || item.type === "poi"),
    species: options.records.filter((item) => item.type === "race"),
  }), [options.records]);
  const filterChoices = useMemo(() => ({
    position: [{ value: NONE_FILTER, label: translateUi("None") }, ...filterOptions.positions.map((item) => ({ value: item.id, label: item.name }))],
    organization: [{ value: NONE_FILTER, label: translateUi("None") }, ...filterOptions.organizations.map((item) => ({ value: item.id, label: item.name }))],
    continent: [{ value: NONE_FILTER, label: translateUi("None") }, ...filterOptions.continents.map((item) => ({ value: item.id, label: item.name }))],
    location: [{ value: NONE_FILTER, label: translateUi("None") }, ...filterOptions.locations.map((item) => ({ value: item.id, label: item.name }))],
    species: [{ value: NONE_FILTER, label: translateUi("None") }, ...filterOptions.species.map((item) => ({ value: item.id, label: item.name }))],
    status: [{ value: "alive", label: translateUi("Alive") }, { value: "dead", label: translateUi("Dead") }],
    gender: [{ value: "male", label: translateUi("Male") }, { value: "female", label: translateUi("Female") }],
    linked: [{ value: "true", label: translateUi("True") }, { value: "false", label: translateUi("False") }],
  }), [filterOptions.continents, filterOptions.locations, filterOptions.organizations, filterOptions.positions, filterOptions.species, translateUi]);

  const hasLoadedRef = useRef(false);
  const reload = useCallback(async () => {
    // Only show the full-page loading state for the true first load. This also runs on every
    // window focus/visibility regain (see below) to pick up changes made elsewhere without a
    // manual refresh — flashing the whole list back to "Loading…" on every one of those would
    // make the page feel like it reloads whenever the tab regains focus.
    if (!hasLoadedRef.current) setLoading(true);
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
      hasLoadedRef.current = true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translateMessage("Unable to load Mortals."));
    } finally {
      setLoading(false);
    }
  }, [props.binderId, query, translateMessage]);

  useDebouncedEffect(reload, 180);
  useWs((message) => {
    if (message.type === "players:delta" && (message.payload as { lifeStatusChanged?: boolean } | undefined)?.lifeStatusChanged) void reload();
  });

  // Binder has no live websocket layer yet, so a linked Player's portrait (or any other
  // field) changed elsewhere — e.g. the player uploading it from their own device — never
  // appears here until something re-fetches. Refresh whenever this tab regains focus/visibility,
  // which covers the common "switch away, let the player upload, switch back" flow.
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

  async function uploadPortrait(record: BinderMortal, file: File) {
    setPortraitUploading(true);
    setPortraitError(null);
    try {
      await uploadBinderMortalImage(props.binderId, record.id, file);
      await reload();
    } catch (cause) {
      setPortraitError(cause instanceof Error ? cause.message : translateMessage("Unable to upload portrait."));
    } finally {
      setPortraitUploading(false);
    }
  }

  async function remove(record: BinderMortal) {
    if (!(await confirm({ title: translateUi("Delete Mortal"), message: `Delete “${record.name}”? Related memberships and event associations will also be removed.`, confirmLabel: translateMessage("Delete Mortal"), intent: "danger" }))) return;
    await deleteBinderMortal(props.binderId, record.id);
    if (props.recordId === record.id) navigate(`/binder/${props.binderId}/mortals`);
    await reload();
    await props.onRecordsChanged();
  }

  const modal = <MortalRecordModal isOpen={modalRecord !== null} record={modalRecord === "new" ? null : modalRecord} binderCurrentDate={props.binderCurrentDate} options={options} onClose={() => setModalRecord(null)} onSave={save} />;

  if (props.recordId && !loading && !selected) {
    return <div style={{ padding: 28, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, color: theme.colors.muted }}>{translateUi("Mortal not found.")}</div>;
  }

  if (selected) {
    const age = mortalAge(selected, props.binderCurrentDate);
    const genderColor = selected.gender === "male" ? "#7dd3fc" : selected.gender === "female" ? "#f9a8d4" : null;
    const linkedPlayer = selected.player
      ? options.players.find((player) => player.id === selected.player!.id)
        ?? options.players.find((player) => selected.characterId && player.characterId === selected.characterId)
      : undefined;
    const facts: Array<{ key: string; icon: React.ReactNode; label: string; node: React.ReactNode }> = [
      ...(() => {
        const displayClassName = selected.mortalType === "player_character" ? (linkedPlayer?.className || selected.className) : null;
        return displayClassName ? [{ key: "class", icon: <EntityIcon icon="game-icons:doubled" size={16} />, label: translateUi("Class"), node: displayClassName as React.ReactNode }] : [];
      })(),
      ...(selected.position ? [{ key: "position", icon: selected.position.icon ? <EntityIcon icon={selected.position.icon} size={16}/> : <IconShield size={16} />, label: translateUi("Position"), node: selected.position.name as React.ReactNode }] : []),
      ...(selected.organizations.length ? [{
        key: "organizations", icon: <OrganizationIcon size={16} />, label: translateUi("Org"),
        node: <span style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px" }}>{selected.organizations.map((organization) => (
          <button
            key={organization.id}
            type="button"
            title={translateUi("Open {{value1}}", { value1: organization.name })}
            onClick={() => navigate(`/binder/${props.binderId}/organizations/${organization.id}`)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: 0, background: "transparent", color: theme.colors.text, cursor: "pointer", font: "inherit", textAlign: "left" }}
          >
            <OrganizationIcon icon={organization.icon} size={14} />
            <span style={{ textDecoration: "underline", textDecorationColor: withAlpha(props.accent, 0.5), textUnderlineOffset: 3 }}>{organization.name}</span>
          </button>
        ))}</span>,
      }] : []),
      ...(selected.location ? [{ key: "location", icon: <IconVillage size={16} />, label: translateUi("Location"), node: selected.location.name as React.ReactNode }] : []),
      ...(selected.race ? [{ key: "race", icon: <IconDna1 size={16} />, label: translateUi("Race"), node: selected.race.name as React.ReactNode }] : []),
      ...(age !== null ? [{ key: "age", icon: <IconCakeSlice size={16} />, label: translateUi("Age"), node: String(age) as React.ReactNode }] : []),
      ...(selected.personal?.height ? [{ key: "height", icon: null, label: translateUi("Height"), node: selected.personal.height as React.ReactNode }] : []),
      ...(selected.personal?.weight ? [{ key: "weight", icon: <EntityIcon icon="game-icons:weight" size={16} />, label: translateUi("Weight"), node: selected.personal.weight as React.ReactNode }] : []),
      ...(selected.personal?.hair ? [{ key: "hair", icon: <EntityIcon icon="game-icons:comb" size={16} />, label: translateUi("Hair"), node: selected.personal.hair as React.ReactNode }] : []),
      ...(selected.personal?.skin ? [{ key: "skin", icon: <EntityIcon icon="game-icons:animal-hide" size={16} />, label: translateUi("Skin"), node: selected.personal.skin as React.ReactNode }] : []),
      {
        key: "gender", icon: <IconGender size={16} />, label: translateUi("Gender"),
        node: genderColor
          ? <span style={{ display: "inline-flex", padding: "2px 7px", borderRadius: 999, color: genderColor, background: withAlpha(genderColor, 0.16), fontSize: "var(--fs-small)", lineHeight: 1.3, fontWeight: 750 }}>{selected.gender === "male" ? translateUi("Male") : translateUi("Female")}</span>
          : <span style={{ color: theme.colors.red }}>{translateUi("Needs gender")}</span>,
      },
      {
        key: "status", icon: <EntityIcon icon="game-icons:half-dead" size={16} />, label: translateUi("Status"),
        node: <span style={{ display: "inline-flex", padding: "2px 7px", borderRadius: 5, color: "#fff", background: selected.lifeStatus === "dead" ? theme.colors.red : theme.colors.green, fontSize: "var(--fs-small)", fontWeight: 800 }}>{selected.lifeStatus === "dead" ? translateUi("Dead") : translateUi("Alive")}</span>,
      },
      ...(selected.mortalType === "player_character" && selected.player?.playerName
        ? [{ key: "player", icon: <IconPlayer size={16} />, label: translateUi("Player"), node: selected.player.playerName as React.ReactNode }]
        : []),
    ];
    const mentions = loreRecords.filter((row) => row.id !== selected.id).map((row) => ({
      id: row.id, label: row.name, href: row.route, type: row.type,
    }));
    const toggleVisibility = async () => {
      await updateBinderMortal(props.binderId, selected.id, { visibility: selected.visibility === "public" ? "dm" : "public" });
      await reload();
      await props.onRecordsChanged();
    };
    return (
      <>
        <BinderRecordDetailShell
          onBack={() => navigate(`/binder/${props.binderId}/mortals`)}
          backLabel="Mortals"
          accent={props.accent}
          leading={
            <div style={{ position: "relative", flex: "0 0 auto" }}>
            <input
              ref={portraitInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadPortrait(selected, file);
              }}
            />
            <button
              type="button"
              // With no portrait yet there's nothing to enlarge, so a tap goes straight to picking one.
              disabled={portraitUploading || (!selected.imageUrl && !props.canEdit)}
              onClick={() => {
                if (selected.imageUrl) setLightboxSrc(`${resolveAssetUrl(selected.imageUrl)}${selected.imageUpdatedAt ? `?v=${selected.imageUpdatedAt}` : ""}`);
                else if (props.canEdit) portraitInputRef.current?.click();
              }}
              title={selected.imageUrl ? translateUi("View full portrait") : undefined}
              style={{
                width: 84,
                height: 84,
                padding: 0,
                border: `1px solid ${withAlpha(props.accent, 0.3)}`,
                borderRadius: theme.radius.control,
                overflow: "hidden",
                background: withAlpha(props.accent, 0.1),
                color: theme.colors.muted,
                cursor: selected.imageUrl ? "zoom-in" : props.canEdit ? "pointer" : "default",
                opacity: portraitUploading ? 0.5 : 1,
              }}
            >
              {selected.imageUrl ? (
                <img
                  src={`${resolveAssetUrl(selected.imageUrl)}${selected.imageUpdatedAt ? `?v=${selected.imageUpdatedAt}` : ""}`}
                  alt={`${selected.name} portrait`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: "var(--fs-small)", opacity: 0.72 }}>{props.canEdit ? translateUi("Add portrait") : translateUi("Portrait")}</span>
              )}
            </button>
            {props.canEdit && selected.imageUrl ? (
              <button
                type="button"
                aria-label={translateUi("Change portrait")}
                title={translateUi("Change portrait")}
                disabled={portraitUploading}
                onClick={() => portraitInputRef.current?.click()}
                style={{
                  position: "absolute",
                  right: -8,
                  bottom: -8,
                  width: 32,
                  height: 32,
                  display: "grid",
                  placeItems: "center",
                  padding: 0,
                  borderRadius: 999,
                  border: `1px solid ${withAlpha(props.accent, 0.6)}`,
                  background: theme.colors.panelBg,
                  color: props.accent,
                  cursor: "pointer",
                }}
              >
                <IconCamera size={16} />
              </button>
            ) : null}
            {portraitError ? <div role="alert" style={{ position: "absolute", top: "100%", left: 0, marginTop: 12, width: 220, color: theme.colors.red, fontSize: "var(--fs-small)" }}>{portraitError}</div> : null}
            </div>
          }
          leadingAlign="center"
          name={{ editable: false, value: selected.name }}
          canEdit={props.canEdit}
          recordLabel="Mortal"
          visibilityPublic={selected.visibility === "public"}
          onVisibilityChange={() => void toggleVisibility()}
          onEdit={() => setModalRecord(selected)}
          onDelete={() => void remove(selected)}
          actionButtonSize={{ width: 42, height: 38 }}
          bodyPadding={20}
          bodyGap={16}
          bodyMaxWidth={1680}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 24, alignItems: "start" }}>
            <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", columnGap: 30, rowGap: 0 }}>
                {facts.map(({ key, icon, label, node }) => (
                  <div
                    key={key}
                    style={{
                      minHeight: 42,
                      padding: "8px 2px",
                      display: "grid",
                      gridTemplateColumns: "105px minmax(0, 1fr)",
                      gap: 10,
                      alignItems: "center",
                      borderBottom: `1px solid ${withAlpha(props.accent, 0.14)}`,
                    }}
                  >
                    <div
                      style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      {icon}
                      {label}
                    </div>
                    <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{node}</div>
                  </div>
                ))}
              </div>
              <InlineRichTextField
                key={`${props.binderId}:${selected.id}:notes`}
                binderId={props.binderId}
                sourceField="description"
                label={translateUi("Notes")}
                value={selected.notes}
                mentions={mentions}
                validMentionIds={validMentionIds}
                canEdit={props.canEdit}
                onSave={async (notes) => {
                  await updateBinderMortal(props.binderId, selected.id, { notes });
                  await syncBinderMentions(props.binderId, selected.id, "description", notes);
                  await reload();
                }}
              />
              <InlineRichTextField
                key={`${props.binderId}:${selected.id}:dm-notes`}
                binderId={props.binderId}
                sourceField="dm_notes"
                label={translateUi("DM Notes")}
                value={selected.dmNotes}
                mentions={mentions}
                validMentionIds={validMentionIds}
                canEdit={props.canEdit}
                onSave={async (dmNotes) => {
                  await updateBinderMortal(props.binderId, selected.id, { dmNotes });
                  await syncBinderMentions(props.binderId, selected.id, "dm_notes", dmNotes);
                  await reload();
                }}
              />
              <BacklinksPanel binderId={props.binderId} recordId={selected.id} />
            </div>
            <div style={{ minWidth: 0 }}>
              <LinkedMortalStatblock
                mortalId={selected.id}
                monsterId={selected.mortalType === "npc" ? selected.monsterId : null}
                playerLink={
                  selected.mortalType === "player_character" && linkedPlayer ? { campaignId: linkedPlayer.campaignId, playerId: linkedPlayer.id } : null
                }
                mechanics={selected.npcMechanics}
                accent={props.accent}
              />
            </div>
          </div>
        </BinderRecordDetailShell>
        {modal}
        <ImageLightbox src={lightboxSrc} alt={`${selected.name} portrait`} onClose={() => setLightboxSrc(null)} />
      </>
    );
  }

  return <>
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 9, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flex: "1 1 auto" }}>
          <Input value={query} onChange={(event) => { setQuery(event.target.value); clearSelectedMortalView(); }} placeholder={translateUi("Search mortals…")} style={{ width: isNarrow ? "100%" : 280 }} />
          <div style={{ width: 170 }}>
            <SearchableSelect
              value={selectedViewId}
              onChange={applyView}
              placeholder={translateUi("View: Unsaved")}
              noneLabel="View: Unsaved"
              maxResults={20}
              options={savedViews.map((view) => ({ id: view.id, name: `View: ${view.name}` }))}
            />
          </div>
          {selectedViewId ? <Button variant="ghost" aria-label={translateUi("Delete saved view")} onClick={removeSelectedMortalView}><IconTrash size={14} /></Button> : null}
          <Input value={viewName} onChange={(event) => setViewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveMortalView(query, filters); }} placeholder={translateUi("View name")} style={{ width: 140 }} />
          <Button variant="ghost" disabled={!viewName.trim()} onClick={() => saveMortalView(query, filters)}>{translateUi("Save View")}</Button>
        </div>
        {props.canEdit ? <Button onClick={() => setModalRecord("new")}><span style={{ display: "inline-flex", gap: 7 }}><IconPlus size={14} /> {translateUi("New Mortal")}</span></Button> : null}
      </div>
      {isNarrow ? (
        <Button variant="ghost" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)} style={{ justifySelf: "start" }}>
          {filtersOpen ? translateUi("Hide filters") : translateUi("Filters")}
        </Button>
      ) : null}
      {!isNarrow || filtersOpen ? <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
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
          <SearchableMultiFilter
            key={key}
            label={label}
            width={width}
            selected={filters[key]}
            options={filterChoices[key]}
            onAdd={(value) => { setFilters(addFilterValue(filters, key, value)); clearSelectedMortalView(); }}
          />
        ))}
        {Object.values(filters).some((values) => values.length) ? <Button variant="ghost" onClick={() => { setFilters(emptyFilters()); clearSelectedMortalView(); }}>{translateUi("Clear")}</Button> : null}
      </div> : null}
      {Object.entries(filters).some(([, values]) => values.length) ? (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          {(Object.entries(filters) as Array<[keyof MortalFilters, string[]]>).flatMap(([key, values]) => values.map((value) => {
            const label = key[0]!.toUpperCase() + key.slice(1);
            const choice = filterChoices[key].find((item) => item.value === value);
            return <button
              key={`${key}:${value}`}
              type="button"
              aria-label={translateUi("Remove {{value1}} {{value2}} filter", { value1: label, value2: choice?.label ?? value })}
              onClick={() => { setFilters(removeFilterValue(filters, key, value)); clearSelectedMortalView(); }}
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
        {isNarrow ? null : <BinderListHeader
          columns={[
            { key: "name", label: translateUi("Name"), sortable: true },
            { key: "position", label: translateUi("Position"), icon: <IconShield size={14} />, sortable: true },
            { key: "organization", label: translateUi("Org"), icon: <IconOrganigram size={14} />, sortable: true },
            { key: "location", label: translateUi("Location"), sortable: true },
            { key: "species", label: translateUi("Species"), sortable: true },
            { key: "age", label: translateUi("Age"), sortable: true },
            { key: "gender", label: translateUi("Gender"), sortable: true },
            { key: "status", label: translateUi("Status"), sortable: true },
            { key: "visibility", label: "" },
          ]}
          gridTemplateColumns={mortalTableColumns}
          accent={props.accent}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(key) => toggleSort(key as MortalSortKey)}
        />}
        {loading ? <BinderListLoading />
          : error ? <BinderListError message={error} />
          : sortedRecords.length ? sortedRecords.map((record) => {
            const age = mortalAge(record, props.binderCurrentDate);
            const genderColor = record.gender === "male" ? "#7dd3fc" : record.gender === "female" ? "#f9a8d4" : null;
            const cell = { color: theme.colors.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
            const open = () => navigate(`/binder/${props.binderId}/mortals/${record.id}`);
            if (isNarrow) return <MortalCardRow key={record.id} record={record} accent={props.accent} onOpen={open} />;
            return (
              <BinderDataTableRow
                key={record.id}
                as="div"
                onClick={open}
                onMouseEnter={() => setHoveredId(record.id)}
                onMouseLeave={() => setHoveredId(null)}
                gridTemplateColumns={mortalTableColumns}
                background={hoveredId === record.id ? withAlpha(props.accent, 0.08) : "transparent"}
                theme={{ text: theme.colors.text, muted: theme.colors.muted, border: theme.colors.panelBorder }}
              >
                <span title={record.name} style={{ ...cell, color: theme.colors.text, fontWeight: 750, display: "flex", alignItems: "center", gap: 9 }}>
                  <BinderRecordThumbnail imageUrl={record.imageUrl} imageUpdatedAt={record.imageUpdatedAt} accent={props.accent} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{record.name}</span>
                </span>
                <span title={record.position?.name ?? translateUi("None")} style={{ ...cell, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-flex", opacity: 0.65, flex: "0 0 auto" }}>
                    {record.position?.icon ? <EntityIcon icon={record.position.icon} size={14} /> : <IconShield size={14} />}
                  </span>
                  {record.position?.name ?? "None"}
                </span>
                <span
                  title={record.organizations.map((organization) => organization.name).join(", ") || translateUi("None")}
                  style={{ ...cell, display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span style={{ display: "inline-flex", opacity: 0.65, flex: "0 0 auto" }}>
                    <OrganizationIcon icon={record.organizations[0]?.icon} size={14} />
                  </span>
                  {record.organizations.map((organization) => organization.name).join(", ") || "None"}
                </span>
                <span title={record.location?.name ?? translateUi("None")} style={cell}>
                  {record.location?.name ?? "None"}
                </span>
                <span title={record.race?.name ?? translateUi("None")} style={cell}>
                  {record.race?.name ?? "None"}
                </span>
                <span style={cell}>{age ?? "None"}</span>
                <span>
                  {genderColor ? (
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "2px 7px",
                        borderRadius: 999,
                        color: genderColor,
                        background: withAlpha(genderColor, 0.16),
                        fontSize: "var(--fs-small)",
                        lineHeight: 1.3,
                        fontWeight: 750,
                      }}
                    >
                      {record.gender === "male" ? translateUi("Male") : translateUi("Female")}
                    </span>
                  ) : (
                    <span style={{ ...cell, color: theme.colors.red }}>{translateUi("Needs gender")}</span>
                  )}
                </span>
                <span
                  style={{
                    justifySelf: "start",
                    display: "inline-flex",
                    padding: "2px 7px",
                    borderRadius: 5,
                    color: "#fff",
                    background: record.lifeStatus === "dead" ? theme.colors.red : theme.colors.green,
                    fontSize: "var(--fs-small)",
                    lineHeight: 1.3,
                    fontWeight: 800,
                  }}
                >
                  {record.lifeStatus === "dead" ? translateUi("Dead") : translateUi("Alive")}
                </span>
                {props.canEdit ? (
                  <button
                    type="button"
                    aria-label={translateUi("{{value1}}: {{value2}}", {
                      value1: record.visibility === "public" ? "Make private" : "Make public",
                      value2: record.name,
                    })}
                    title={
                      record.visibility === translateUi("public")
                        ? translateUi("Public — click to make private")
                        : translateUi("Private — click to make public")
                    }
                    onClick={async (event) => {
                      event.stopPropagation();
                      await updateBinderMortal(props.binderId, record.id, { visibility: record.visibility === "public" ? "dm" : "public" });
                      await reload();
                      await props.onRecordsChanged();
                    }}
                    style={{
                      width: 28,
                      height: 26,
                      display: "grid",
                      placeItems: "center",
                      padding: 0,
                      borderRadius: 6,
                      border: `1px solid ${record.visibility === "public" ? withAlpha(props.accent, 0.65) : theme.colors.panelBorder}`,
                      background: record.visibility === "public" ? withAlpha(props.accent, 0.16) : "rgba(255,255,255,0.03)",
                      color: record.visibility === "public" ? props.accent : theme.colors.muted,
                      cursor: "pointer",
                    }}
                  >
                    <VisibilityIcon visible={record.visibility === "public"} size={16} />
                  </button>
                ) : (
                  <span />
                )}
              </BinderDataTableRow>
            );
          }) : <BinderListEmpty>{records.length ? translateUi("No Mortals match the current filters.") : query ? translateUi("No Mortals match your search.") : translateUi("No Mortals yet.")}</BinderListEmpty>}
      </div>
    </div>
    {modal}
  </>;
}
