import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import {
  createBinderEvent, createBinderItem, deleteBinderEvent, deleteBinderItem,
  fetchBinderEvents, fetchBinderItems, fetchBinderRecordOptions, updateBinderEvent,
  updateBinderItem, type BinderAssociation, type BinderEvent, type BinderItem,
  type BinderRecordOption,
} from "@/services/binderLoreApi";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { theme, withAlpha } from "@/theme/theme";
import { MarkdownRichText, WysiwygNoteEditor } from "@beholden/shared/ui";
import { SearchableSelect } from "@/components/SearchableSelect";
import { BacklinksPanel } from "./BacklinksPanel";
import { useValidMentionIds } from "./useValidMentionIds";

type CampaignOption = { id: string; name: string };
type CompendiumOption = { id: string; name: string };

function Field(props: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "grid", gridTemplateColumns: "145px minmax(0,1fr)", gap: 12, alignItems: "center" }}>
    <span style={{ color: theme.colors.muted, fontWeight: 750 }}>{props.label}</span>{props.children}
  </label>;
}

function Select(props: { value: string; onChange: (value: string) => void; options: Array<{ id: string; name: string; icon?: string | null }>; none?: string }) {
  return <SearchableSelect value={props.value} onChange={props.onChange} options={props.options} noneLabel={props.none} placeholder={props.none} />;
}

function MultiRecords(props: {
  options: BinderRecordOption[]; value: BinderAssociation[]; onChange: (value: BinderAssociation[]) => void;
}) {
  const [selected, setSelected] = useState("");
  const available = props.options.filter((option) => !props.value.some((row) => row.id === option.id));
  return <div style={{ display: "grid", gap: 7 }}>
    <div style={{ display: "flex", gap: 7 }}>
      <div style={{ flex: "1 1 auto" }}>
        <Select value={selected} onChange={setSelected} options={available.map((row) => ({ id: row.id, name: `${row.name} · ${row.type}`, icon: row.icon }))} />
      </div>
      <Button variant="ghost" disabled={!selected} onClick={() => {
        const option = props.options.find((row) => row.id === selected);
        if (option) props.onChange([...props.value, { id: option.id, name: option.name, type: option.type, role: null, description: null }]);
        setSelected("");
      }}>Add</Button>
    </div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {props.value.map((row) => <span key={row.id} style={{ display: "inline-flex", gap: 7, alignItems: "center", padding: "4px 8px", borderRadius: 7, border: `1px solid ${theme.colors.panelBorder}`, background: "rgba(255,255,255,.055)" }}>
        {row.name ?? props.options.find((option) => option.id === row.id)?.name ?? row.id}
        <button type="button" onClick={() => props.onChange(props.value.filter((item) => item.id !== row.id))} style={{ border: 0, background: "transparent", color: theme.colors.colorPinkRed, cursor: "pointer" }}>×</button>
      </span>)}
    </div>
  </div>;
}

function Drawer(props: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.68)" }} onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose(); }}>
    <aside style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "min(720px, 95vw)", overflowY: "auto", padding: 22, background: "#0d1729", borderLeft: `1px solid ${theme.colors.panelBorder}`, boxShadow: "-18px 0 50px rgba(0,0,0,.45)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <h2 style={{ margin: 0 }}>{props.title}</h2><Button variant="ghost" onClick={props.onClose}>Close</Button>
      </header>
      {props.children}
    </aside>
  </div>;
}

function ItemEditor(props: {
  binderId: string; item?: BinderItem; records: BinderRecordOption[]; compendium: CompendiumOption[];
  onSaved: () => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(props.item?.name ?? "");
  const [description, setDescription] = useState(props.item?.description ?? "");
  const [dmNotes, setDmNotes] = useState(props.item?.dm_notes ?? "");
  const [compendiumItemId, setCompendiumItemId] = useState(props.item?.compendium_item_id ?? "");
  const [holderMortalId, setHolderMortalId] = useState(props.item?.holder_mortal_id ?? "");
  const [locationRecordId, setLocationRecordId] = useState(props.item?.location_record_id ?? "");
  const [saving, setSaving] = useState(false);
  const mortals = props.records.filter((row) => row.type === "mortal");
  const places = props.records.filter((row) => ["continent", "country", "location", "poi"].includes(row.type));
  const mentions = props.records.map((row) => ({ id: row.id, label: row.name, href: row.route, type: row.type }));
  return <Drawer title={props.item ? "Edit Item" : "New Item"} onClose={props.onClose}>
    <div style={{ display: "grid", gap: 14 }}>
      <Field label="Name"><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Compendium item"><Select value={compendiumItemId} onChange={setCompendiumItemId} options={props.compendium} /></Field>
      <Field label="Current holder"><Select value={holderMortalId} onChange={setHolderMortalId} options={mortals} /></Field>
      <Field label="Location"><Select value={locationRecordId} onChange={setLocationRecordId} options={places} /></Field>
      <div><strong>Description</strong><WysiwygNoteEditor value={description} onChange={setDescription} mentions={mentions} minHeight={180} theme={{ radius: theme.radius.control, panelBorder: theme.colors.panelBorder, inputBg: theme.colors.inputBg, text: theme.colors.text }} /></div>
      <div><strong>DM Notes</strong><WysiwygNoteEditor value={dmNotes} onChange={setDmNotes} mentions={mentions} minHeight={130} theme={{ radius: theme.radius.control, panelBorder: theme.colors.panelBorder, inputBg: theme.colors.inputBg, text: theme.colors.text }} /></div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={props.onClose}>Cancel</Button>
        <Button disabled={saving || !name.trim()} onClick={async () => {
          setSaving(true);
          try {
            const input = { name, description: description || null, dmNotes: dmNotes || null, compendiumItemId: compendiumItemId || null, holderMortalId: holderMortalId || null, locationRecordId: locationRecordId || null };
            if (props.item) await updateBinderItem(props.binderId, props.item.id, input); else await createBinderItem(props.binderId, input);
            await props.onSaved(); props.onClose();
          } finally { setSaving(false); }
        }}>Save Item</Button>
      </div>
    </div>
  </Drawer>;
}

function EventEditor(props: {
  binderId: string; event?: BinderEvent; records: BinderRecordOption[]; campaigns: CampaignOption[];
  onSaved: () => Promise<void>; onClose: () => void;
}) {
  const [title, setTitle] = useState(props.event?.title ?? "");
  const [description, setDescription] = useState(props.event?.description ?? "");
  const [dateText, setDateText] = useState(props.event?.dateText ?? "");
  const [endDateText, setEndDateText] = useState(props.event?.endDateText ?? "");
  const [tags, setTags] = useState(props.event?.tags.map((tag) => tag.name).join(", ") ?? "");
  const [records, setRecords] = useState<BinderAssociation[]>(props.event?.records ?? []);
  const [campaigns, setCampaigns] = useState<BinderAssociation[]>(props.event?.campaigns ?? []);
  const [saving, setSaving] = useState(false);
  const campaignRecords = props.campaigns.map((row) => ({ id: row.id, binderId: props.binderId, type: "campaign", name: row.name, route: "", icon: null }));
  const mentions = props.records.map((row) => ({ id: row.id, label: row.name, href: row.route, type: row.type }));
  return <Drawer title={props.event ? "Edit Event" : "New Event"} onClose={props.onClose}>
    <div style={{ display: "grid", gap: 14 }}>
      <Field label="Title"><Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label="Date"><Input value={dateText} onChange={(event) => setDateText(event.target.value)} placeholder="None" /></Field>
      <Field label="End date"><Input value={endDateText} onChange={(event) => setEndDateText(event.target.value)} placeholder="None" /></Field>
      <Field label="Tags"><Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="War, politics, prophecy" /></Field>
      <Field label="Related records"><MultiRecords options={props.records.filter((row) => row.id !== props.event?.id)} value={records} onChange={setRecords} /></Field>
      <Field label="Campaigns"><MultiRecords options={campaignRecords} value={campaigns} onChange={setCampaigns} /></Field>
      <div><strong>Description</strong><WysiwygNoteEditor value={description} onChange={setDescription} mentions={mentions} minHeight={260} theme={{ radius: theme.radius.control, panelBorder: theme.colors.panelBorder, inputBg: theme.colors.inputBg, text: theme.colors.text }} /></div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Button variant="ghost" onClick={props.onClose}>Cancel</Button>
        <Button disabled={saving || !title.trim()} onClick={async () => {
          setSaving(true);
          try {
            const number = (value: string) => /^-?\d+$/.test(value.trim()) ? Number(value) : null;
            const input = { title, description: description || null, dateText: dateText || null, dateSort: number(dateText), endDateText: endDateText || null, endDateSort: number(endDateText), tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), records, campaigns };
            if (props.event) await updateBinderEvent(props.binderId, props.event.id, input); else await createBinderEvent(props.binderId, input);
            await props.onSaved(); props.onClose();
          } finally { setSaving(false); }
        }}>Save Event</Button>
      </div>
    </div>
  </Drawer>;
}

export function BinderLoreWorkspace(props: {
  binderId: string; type: "items" | "events"; recordId?: string; accent: string; canEdit: boolean;
  campaigns: CampaignOption[]; onRecordsChanged: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<BinderItem[]>([]);
  const [events, setEvents] = useState<BinderEvent[]>([]);
  const [records, setRecords] = useState<BinderRecordOption[]>([]);
  const [compendium, setCompendium] = useState<CompendiumOption[]>([]);
  const [editor, setEditor] = useState<"new" | "edit" | null>(null);
  const [timelineQuery, setTimelineQuery] = useState("");
  const [timelineRecordId, setTimelineRecordId] = useState("");
  const [timelineTag, setTimelineTag] = useState("");
  const [timelineCampaignId, setTimelineCampaignId] = useState("");
  const [timelinePlaceId, setTimelinePlaceId] = useState("");
  const reload = useCallback(async () => {
    const [recordRows, loreRows] = await Promise.all([
      fetchBinderRecordOptions(props.binderId),
      props.type === "items" ? fetchBinderItems(props.binderId) : fetchBinderEvents(props.binderId),
    ]);
    setRecords(recordRows);
    if (props.type === "items") setItems(loreRows as BinderItem[]); else setEvents(loreRows as BinderEvent[]);
  }, [props.binderId, props.type]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (props.type !== "items") return;
    void api<unknown>("/api/compendium/items?compact=true&limit=250").then((raw) => {
      const rows = Array.isArray(raw) ? raw : (raw as { items?: unknown[] }).items ?? [];
      setCompendium((rows as Array<{ id: string; name: string }>).map(({ id, name }) => ({ id, name })));
    });
  }, [props.type]);
  const selected = props.type === "items"
    ? items.find((row) => row.id === props.recordId)
    : events.find((row) => row.id === props.recordId);
  const validMentionIds = useValidMentionIds(props.binderId, selected?.description);
  const list = props.type === "items" ? items : events;
  const timelineEvents = events.filter((event) => {
    const query = timelineQuery.trim().toLocaleLowerCase();
    const textMatch = !query || event.title.toLocaleLowerCase().includes(query)
      || (event.description ?? "").toLocaleLowerCase().includes(query)
      || event.records.some((record) => (record.name ?? "").toLocaleLowerCase().includes(query));
    return textMatch
      && (!timelineRecordId || event.records.some((record) => record.id === timelineRecordId))
      && (!timelineTag || event.tags.some((tag) => tag.id === timelineTag))
      && (!timelineCampaignId || event.campaigns.some((campaign) => campaign.id === timelineCampaignId))
      && (!timelinePlaceId || event.records.some((record) => record.id === timelinePlaceId));
  });
  const timelineTags = Array.from(new Map(events.flatMap((event) => event.tags).map((tag) => [tag.id, tag])).values());
  const places = records.filter((record) => ["continent", "country", "location", "poi"].includes(record.type));
  const singular = props.type === "items" ? "Item" : "Event";
  const columns = props.type === "items" ? "2fr 1.2fr 1fr 1fr" : "2fr .8fr 1.4fr 1fr";
  const headers = props.type === "items" ? ["Name", "Compendium", "Holder", "Location"] : ["Title", "Date", "Related records", "Campaigns"];

  if (selected) {
    return <div style={{ display: "grid", gap: 15 }}>
      <button type="button" onClick={() => navigate(`/binder/${props.binderId}/${props.type}`)} style={{ width: "fit-content", border: 0, background: "transparent", color: theme.colors.muted, cursor: "pointer" }}>← All {props.type}</button>
      <article style={{ border: `1px solid ${theme.colors.panelBorder}`, borderTop: `4px solid ${props.accent}`, borderRadius: theme.radius.panel, background: theme.colors.panelBg, padding: 22, display: "grid", gap: 18 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}><h2 style={{ margin: 0, fontSize: "var(--fs-hero)" }}>{"name" in selected ? selected.name : selected.title}</h2>
          {props.canEdit ? <div style={{ display: "flex", gap: 8 }}><Button onClick={() => setEditor("edit")}>Edit</Button><Button variant="danger" onClick={async () => {
            if (props.type === "items") await deleteBinderItem(props.binderId, selected.id); else await deleteBinderEvent(props.binderId, selected.id);
            navigate(`/binder/${props.binderId}/${props.type}`); await reload(); await props.onRecordsChanged();
          }}>Delete</Button></div> : null}</header>
        {"description" in selected && selected.description ? <MarkdownRichText text={selected.description} validMentionIds={validMentionIds} binderId={props.binderId} /> : null}
        <BacklinksPanel binderId={props.binderId} recordId={selected.id} />
      </article>
      {editor ? props.type === "items"
        ? <ItemEditor binderId={props.binderId} item={selected as BinderItem} records={records} compendium={compendium} onSaved={async () => { await reload(); await props.onRecordsChanged(); }} onClose={() => setEditor(null)} />
        : <EventEditor binderId={props.binderId} event={selected as BinderEvent} records={records} campaigns={props.campaigns} onSaved={async () => { await reload(); await props.onRecordsChanged(); }} onClose={() => setEditor(null)} /> : null}
    </div>;
  }

  return <div style={{ display: "grid", gap: 12 }}>
    <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
      {props.type === "events" ? <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
        <Input value={timelineQuery} onChange={(event) => setTimelineQuery(event.target.value)} placeholder="Filter timeline…" style={{ maxWidth: 300 }} />
        <SearchableSelect value={timelineRecordId} onChange={setTimelineRecordId} options={records} placeholder="All related records" />
        <SearchableSelect value={timelineTag} onChange={setTimelineTag} options={timelineTags} placeholder="All tags" />
        <SearchableSelect value={timelineCampaignId} onChange={setTimelineCampaignId} options={props.campaigns} placeholder="All Campaigns" />
        <SearchableSelect value={timelinePlaceId} onChange={setTimelinePlaceId} options={places} placeholder="All places" />
      </div> : <span />}
      {props.canEdit ? <Button onClick={() => setEditor("new")}>+ New {singular}</Button> : null}
    </div>
    {props.type === "events" ? <div style={{ display: "grid", gap: 0, borderLeft: `2px solid ${withAlpha(props.accent, .45)}`, marginLeft: 72 }}>
      {timelineEvents.map((event) => <button key={event.id} type="button" onClick={() => navigate(`/binder/${props.binderId}/events/${event.id}`)} style={{ position: "relative", display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: 14, margin: "0 0 12px 20px", padding: 14, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, background: theme.colors.panelBg, color: theme.colors.text, textAlign: "left", cursor: "pointer" }}>
        <span style={{ position: "absolute", left: -27, top: 20, width: 12, height: 12, borderRadius: "50%", background: props.accent, boxShadow: `0 0 0 4px ${theme.colors.panelBg}` }} />
        <strong style={{ color: event.dateSort === null ? theme.colors.muted : props.accent }}>{event.dateText ?? "Undated"}{event.endDateText ? ` – ${event.endDateText}` : ""}</strong>
        <span><strong style={{ fontSize: "var(--fs-title)" }}>{event.title}</strong><span style={{ display: "block", marginTop: 5, color: theme.colors.muted }}>{event.records.map((record) => record.name).join(", ") || "No related records"}</span></span>
      </button>)}
      {!timelineEvents.length ? <div style={{ padding: 35, color: theme.colors.muted }}>No matching events.</div> : null}
    </div> : <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.panel, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: columns, gap: 10, padding: "8px 12px", background: withAlpha(props.accent, 0.08), borderBottom: `1px solid ${theme.colors.panelBorder}`, fontSize: "var(--fs-small)" }}>
        {headers.map((header) => <strong key={header}>{header}</strong>)}
      </div>
      {list.map((row) => {
        const item = row as BinderItem; const event = row as BinderEvent;
        const cells = props.type === "items"
          ? [item.name, item.compendium_item_name ?? "None", item.holder_name ?? "None", item.location_name ?? "None"]
          : [event.title, event.dateText ?? "None", event.records.map((entry) => entry.name).join(", ") || "None", event.campaigns.map((entry) => entry.name).join(", ") || "None"];
        return <button key={row.id} type="button" onClick={() => navigate(`/binder/${props.binderId}/${props.type}/${row.id}`)} style={{ width: "100%", display: "grid", gridTemplateColumns: columns, gap: 10, padding: "7px 12px", border: 0, borderTop: `1px solid ${theme.colors.panelBorder}`, background: "transparent", color: theme.colors.text, textAlign: "left", cursor: "pointer", fontSize: "var(--fs-small)" }}>
          {cells.map((cell, index) => <span key={index} style={{ color: index ? theme.colors.muted : theme.colors.text, fontWeight: index ? 500 : 750 }}>{cell}</span>)}
        </button>;
      })}
      {!list.length ? <div style={{ padding: 40, textAlign: "center", color: theme.colors.muted }}>No {props.type} yet.</div> : null}
    </div>}
    {editor ? props.type === "items"
      ? <ItemEditor binderId={props.binderId} records={records} compendium={compendium} onSaved={async () => { await reload(); await props.onRecordsChanged(); }} onClose={() => setEditor(null)} />
      : <EventEditor binderId={props.binderId} records={records} campaigns={props.campaigns} onSaved={async () => { await reload(); await props.onRecordsChanged(); }} onClose={() => setEditor(null)} /> : null}
  </div>;
}
