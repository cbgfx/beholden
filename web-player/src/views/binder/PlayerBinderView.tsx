import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconBinder, IconCampaign, IconGender, IconPlayers, IconShield } from "@/icons";
import { GameIcon } from "@/icons/GameIcon";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import { BINDER_MORTAL_COLUMNS, BinderDataTableHeader, BinderDataTableRow, BinderDataTableThumbnail, ImageLightbox, MarkdownRichText, SearchableMultiFilter } from "@beholden/shared/ui";

type Mortal = {
  id: string; name: string; mortalType: "npc" | "player_character";
  species: string | null; gender: string | null; lifeStatus: string | null;
  birthDate: string | null; description: string | null; backstory: string | null;
  age: number | null;
  imageUrl: string | null; imageUpdatedAt: number | null;
  location: string | null; organization: string | null; organizationIcon: string | null;
  position: string | null; positionIcon: string | null;
};
type PlayerBinder = {
  binder: { id: string; name: string; color: string; currentDateSort: number | null };
  linkedMortalId: string;
  mortals: Mortal[];
  campaigns: Array<{ id: string; name: string; currentDate: string | null; story: string | null }>;
  deities: PublicRecord[];
  places: PublicRecord[];
};
type PublicRecord = { id: string; type: "deity" | "continent" | "country" | "location" | "poi"; name: string; description: string | null; rank: string | null; domains?: string[]; imageUrl: string | null; imageUpdatedAt: number | null; parentName: string | null; icon: string | null };
type MortalFilters = { position: string[]; organization: string[]; location: string[]; species: string[]; gender: string[]; status: string[] };
const emptyFilters = (): MortalFilters => ({ position: [], organization: [], location: [], species: [], gender: [], status: [] });
type MortalSortKey = "name" | "position" | "organization" | "location" | "species" | "age" | "gender" | "status";
const MORTAL_COLUMNS = BINDER_MORTAL_COLUMNS;

function ageOf(mortal: Mortal, currentDate: number | null) {
  if (mortal.age !== null) return String(mortal.age);
  const birth = Number(mortal.birthDate?.replaceAll(",", ""));
  return Number.isFinite(birth) && currentDate !== null ? String(Math.max(0, currentDate - birth)) : null;
}

function portraitSrc(mortal: Mortal) {
  if (!mortal.imageUrl) return null;
  return `${mortal.imageUrl}${mortal.imageUpdatedAt ? `?v=${mortal.imageUpdatedAt}` : ""}`;
}

function StatusPill({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: C.muted }}>None</span>;
  const dead = status === "dead";
  const color = dead ? "#ff5c65" : "#5bd36b";
  return <span style={{ display: "inline-flex", padding: "2px 9px", borderRadius: 6, color: "#fff", background: color, fontSize: "var(--fs-small)", lineHeight: 1.35, fontWeight: 850 }}>{dead ? "Dead" : "Alive"}</span>;
}

function PublicPlaceIcon({ record, size = 22 }: { record: PublicRecord; size?: number }) {
  if (record.icon) return <GameIcon icon={record.icon} size={size}/>;
  if (record.type === "continent") return <GameIcon icon="game-icons:antarctica" size={size}/>;
  if (record.type === "country") return <GameIcon icon="game-icons:flying-flag" size={size}/>;
  if (record.type === "location") return <GameIcon icon="game-icons:village" size={size}/>;
  return <GameIcon icon="game-icons:targeted" size={size}/>;
}

export function PlayerBinderView() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<PlayerBinder | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [section, setSection] = useState<"mortals" | "campaigns" | "deities" | "places">("mortals");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<MortalFilters>(emptyFilters);
  const [sortKey, setSortKey] = useState<MortalSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [error, setError] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    api<PlayerBinder>(`/api/me/characters/${id}/binder`).then((value) => {
      setData(value);
      setSelectedId(null);
      setSection("mortals");
    }).catch(() => setError("This character is not attached to a Binder."));
  }, [id]);
  const selected = data?.mortals.find((mortal) => mortal.id === selectedId) ?? null;
  const selectedPublicRecord = (section === "deities" ? data?.deities : data?.places)?.find((record) => record.id === selectedId) ?? null;
  const selectedCampaign = data?.campaigns.find((campaign) => campaign.id === selectedId) ?? null;
  const filterOptions = useMemo(() => {
    const values = (key: keyof MortalFilters) => [...new Set((data?.mortals ?? []).map((mortal) => key === "status" ? mortal.lifeStatus : mortal[key]).filter((value): value is string => Boolean(value)))].sort();
    return Object.fromEntries((Object.keys(emptyFilters()) as Array<keyof MortalFilters>).map((key) => [key, values(key)])) as Record<keyof MortalFilters, string[]>;
  }, [data]);
  const filtered = useMemo(() => data?.mortals.filter((mortal) => {
    if (!mortal.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return (!filters.position.length || filters.position.includes(mortal.position ?? ""))
      && (!filters.organization.length || filters.organization.includes(mortal.organization ?? ""))
      && (!filters.location.length || filters.location.includes(mortal.location ?? ""))
      && (!filters.species.length || filters.species.includes(mortal.species ?? ""))
      && (!filters.gender.length || filters.gender.includes(mortal.gender ?? ""))
      && (!filters.status.length || filters.status.includes(mortal.lifeStatus ?? ""));
  }) ?? [], [data, filters, query]);
  const sorted = useMemo(() => [...filtered].sort((left, right) => {
    const value = (mortal: Mortal): string | number | null => sortKey === "age" ? Number(ageOf(mortal, data?.binder.currentDateSort ?? null)) : sortKey === "status" ? mortal.lifeStatus : mortal[sortKey];
    const a = value(left); const b = value(right);
    const result = typeof a === "number" && typeof b === "number" ? a - b : String(a ?? "").localeCompare(String(b ?? ""));
    return sortDir === "asc" ? result : -result;
  }), [data?.binder.currentDateSort, filtered, sortDir, sortKey]);
  const filteredPublicRecords = useMemo(() => {
    const records = section === "deities" ? data?.deities ?? [] : data?.places ?? [];
    const needle = query.trim().toLowerCase();
    return records.filter((record) => !needle || record.name.toLowerCase().includes(needle)
      || record.rank?.toLowerCase().includes(needle)
      || record.parentName?.toLowerCase().includes(needle)
      || record.domains?.some((domain) => domain.toLowerCase().includes(needle)));
  }, [data?.deities, data?.places, query, section]);
  const toggleSort = (key: MortalSortKey) => { if (key === sortKey) setSortDir((current) => current === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDir("asc"); } };
  const accent = data?.binder.color ?? "#38b6ff";

  if (error) return <main style={{ padding: 30, color: C.text }}>{error}</main>;
  if (!data) return <main style={{ padding: 30, color: C.muted }}>Loading Binder…</main>;

  const navGroups: Array<{ label: string | null; items: Array<{ key: typeof section; label: string; count: number; icon: React.ReactNode; color: string }> }> = [
    { label: null, items: [{ key: "campaigns", label: "Campaigns", count: data.campaigns.length, icon: <IconCampaign size={20}/>, color: "#3b82f6" }] },
    { label: "People", items: [
      { key: "mortals", label: "Mortals", count: data.mortals.length, icon: <IconPlayers size={20}/>, color: "#ef5350" },
      { key: "deities", label: "Deities", count: data.deities.length, icon: <GameIcon icon="game-icons:greek-temple" size={20}/>, color: "#a78bfa" },
    ] },
    { label: "Places", items: [{ key: "places", label: "Places", count: data.places.length, icon: <GameIcon icon="game-icons:village" size={20}/>, color: "#22c55e" }] },
  ];

  return (
    <main style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", color: C.text }}>
      <header style={{ flex: "0 0 auto", padding: "20px 30px", borderBottom: `1px solid ${accent}55`, display: "flex", alignItems: "center", gap: 14 }}>
        <IconBinder size={38} />
        <div><h1 style={{ margin: 0, fontSize: "var(--fs-hero)" }}>{data.binder.name}</h1><div style={{ color: C.muted }}>Binder</div></div>
        <button type="button" onClick={() => navigate(`/characters/${id}`)} style={{ marginLeft: "auto", border: "1px solid rgba(255,255,255,.12)", borderRadius: 9, padding: "8px 13px", background: "rgba(255,255,255,.04)", color: C.muted, cursor: "pointer", font: "inherit" }}>← Character Sheet</button>
      </header>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "260px minmax(0,1fr)", overflow: "hidden" }}>
        <aside style={{ minHeight: 0, overflowY: "auto", padding: 14, borderRight: "1px solid rgba(255,255,255,.08)" }}>
          <nav aria-label="Binder sections" style={{ display: "grid", gap: 14, padding: 14, border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, background: "rgba(255,255,255,.018)" }}>
            {navGroups.map((group, groupIndex) => <div key={group.label ?? "campaigns"} style={{ display: "grid", gap: 4 }}>
              {group.label ? <div style={{ margin: groupIndex ? "4px 10px 3px" : "0 10px 3px", color: C.muted, fontSize: "var(--fs-tiny)", fontWeight: 850, letterSpacing: ".12em", textTransform: "uppercase" }}>{group.label}</div> : null}
              {group.items.map((item) => {
                const active = section === item.key;
                return <button key={item.key} type="button" onClick={() => { setSection(item.key); setSelectedId(null); }} style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: "1px solid transparent", boxShadow: active ? `inset 3px 0 ${accent}` : "none", background: active ? `${accent}18` : "transparent", color: active ? C.text : C.muted, display: "flex", alignItems: "center", gap: 9, cursor: "pointer", font: "inherit", fontWeight: active ? 800 : 650, textAlign: "left" }}>
                  <span style={{ color: item.color, display: "grid", placeItems: "center", flex: "0 0 auto" }}>{item.icon}</span>
                  <span>{item.label}</span>
                  <span style={{ marginLeft: "auto", color: active ? accent : C.muted, fontSize: "var(--fs-small)", fontVariantNumeric: "tabular-nums" }}>{item.count}</span>
                </button>;
              })}
            </div>)}
          </nav>
        </aside>
        <section style={{ minWidth: 0, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "24px clamp(18px,3vw,38px) 60px" }}>
          {section === "campaigns" ? (
            selectedCampaign ? <>
              <button type="button" onClick={() => setSelectedId(null)} style={{ border:0,padding:0,marginBottom:18,background:"transparent",color:C.muted,cursor:"pointer",font:"inherit" }}>← All Campaigns</button>
              <article style={{ maxWidth:1180,padding:"6px 4px 60px" }}><div style={{display:"flex",gap:13,alignItems:"center",marginBottom:28}}><IconCampaign size={38}/><div><div style={{color:C.muted,fontSize:"var(--fs-small)",textTransform:"uppercase",fontWeight:750}}>Campaign</div><div style={{color:accent,marginTop:3}}>{selectedCampaign.currentDate ? `Current date: ${selectedCampaign.currentDate}` : "Current Date"}</div></div></div><section style={{paddingTop:20,borderTop:`1px solid ${accent}2e`}}><h2>Campaign Story</h2><div style={{lineHeight:1.65,color:selectedCampaign.story ? C.text : C.muted}}>{selectedCampaign.story ? <MarkdownRichText text={selectedCampaign.story} binderId={data.binder.id}/> : "No campaign story yet."}</div></section></article>
            </> : <><h2 style={{marginTop:0}}>Campaigns</h2><div style={{display:"grid",gap:8}}>{data.campaigns.map((campaign) => <button key={campaign.id} type="button" onClick={() => setSelectedId(campaign.id)} style={{padding:"14px 16px",border:"1px solid rgba(255,255,255,.09)",borderRadius:10,background:"rgba(255,255,255,.025)",color:C.text,textAlign:"left",cursor:"pointer",font:"inherit",fontWeight:800}}>{campaign.name}<span style={{display:"block",marginTop:4,color:C.muted,fontSize:"var(--fs-small)",fontWeight:500}}>{campaign.currentDate ? `Current date: ${campaign.currentDate}` : "Current Date"}</span></button>)}</div></>
          ) : section === "deities" || section === "places" ? (
            selectedPublicRecord ? <>
              <h2 style={{ margin: "0 0 18px", fontSize: "var(--fs-hero)" }}>{section === "deities" ? "Deities" : "Places"}</h2>
              <button type="button" onClick={() => setSelectedId(null)} style={{ border:0,padding:0,marginBottom:18,background:"transparent",color:C.muted,cursor:"pointer",font:"inherit" }}>← All {section === "deities" ? "Deities" : "Places"}</button>
              <article style={{ border: `1px solid ${accent}55`, borderRadius: 15, background: "rgba(255,255,255,.035)", overflow: "hidden" }}>
                <div style={{ height: 4, background: accent }}/>
                <div style={{ padding: 24, display: "grid", gap: 26, maxWidth: 1240 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    {selectedPublicRecord.type === "deity" ? <div style={{ width: 84, height: 84, border: `1px dashed ${accent}55`, borderRadius: 10, overflow: "hidden", background: `${accent}12`, flex: "0 0 auto" }}>{selectedPublicRecord.imageUrl ? <img src={`${selectedPublicRecord.imageUrl}${selectedPublicRecord.imageUpdatedAt ? `?v=${selectedPublicRecord.imageUpdatedAt}` : ""}`} alt={`${selectedPublicRecord.name} portrait`} style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : null}</div> : <span style={{ width: 54, height: 54, display: "grid", placeItems: "center", color: accent }}><PublicPlaceIcon record={selectedPublicRecord} size={34}/></span>}
                    <h2 style={{ margin: 0, fontSize: "calc(var(--fs-hero) * .9)" }}>{selectedPublicRecord.name}</h2>
                  </div>
                  {selectedPublicRecord.type === "deity" ? <section><div style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: ".06em" }}>Rank</div><div style={{ marginTop: 9, width: "min(280px,100%)", padding: "10px 12px", border: "1px solid rgba(255,255,255,.12)", borderRadius: 9, background: "rgba(0,0,0,.18)", color: selectedPublicRecord.rank === "Greater God" ? "#3b82f6" : selectedPublicRecord.rank === "Lesser God" ? "#e5484d" : selectedPublicRecord.rank === "Overpower" ? "#30a46c" : C.muted, fontWeight: 800 }}>{selectedPublicRecord.rank ?? "None"}</div></section> : null}
                  <section><div style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>Description</div><div style={{ minHeight: 72, padding: "8px 9px", color: selectedPublicRecord.description ? C.text : C.muted, lineHeight: 1.55 }}>{selectedPublicRecord.description ? <MarkdownRichText text={selectedPublicRecord.description} binderId={data.binder.id}/> : "No description yet."}</div></section>
                  {selectedPublicRecord.type === "deity" ? <section><div style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: ".06em" }}>Domains</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 9 }}>{selectedPublicRecord.domains?.length ? selectedPublicRecord.domains.map((domain) => <span key={domain} style={{ padding: "5px 11px", borderRadius: 999, border: `1px solid ${accent}4d`, background: `${accent}24`, fontSize: "var(--fs-small)" }}>{domain}</span>) : <span style={{ color: C.muted }}>None</span>}</div></section> : selectedPublicRecord.parentName ? <section><div style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: ".06em" }}>Parent</div><div style={{ marginTop: 7 }}>{selectedPublicRecord.parentName}</div></section> : null}
                  <section style={{ paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.09)" }}><h3 style={{ margin: 0 }}>Mentioned in</h3><div style={{ marginTop: 13, color: C.muted }}>None</div></section>
                </div>
              </article>
            </> : <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 14 }}>
                <h2 style={{ margin: 0 }}>{section === "deities" ? "Deities" : "Places"}</h2>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${section}…`} style={{ width: 360, maxWidth: "45%", padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.18)", color: C.text, font: "inherit" }}/>
              </div>
              <div style={{ border: "1px solid rgba(255,255,255,.09)", borderRadius: 13, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: section === "deities" ? "minmax(220px,1fr) minmax(300px,2fr) 150px" : "minmax(240px,1.2fr) 150px minmax(220px,1fr)", gap: 12, padding: "12px 15px", background: `${accent}14`, borderBottom: "1px solid rgba(255,255,255,.09)", fontWeight: 750 }}>
                  <span style={{ color: accent }}>Name ▲</span>
                  <span>{section === "deities" ? "Domains" : "Type"}</span>
                  <span>{section === "deities" ? "Rank" : "Parent"}</span>
                </div>
                {filteredPublicRecords.map((record) => <button key={record.id} type="button" onClick={() => setSelectedId(record.id)} style={{ width: "100%", display: "grid", gridTemplateColumns: section === "deities" ? "minmax(220px,1fr) minmax(300px,2fr) 150px" : "minmax(240px,1.2fr) 150px minmax(220px,1fr)", gap: 12, alignItems: "center", padding: "13px 15px", border: 0, borderBottom: "1px solid rgba(255,255,255,.08)", background: "transparent", color: C.text, textAlign: "left", cursor: "pointer", font: "inherit" }}>
                  <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10, fontWeight: 750 }}>
                    {record.imageUrl ? <img src={`${record.imageUrl}${record.imageUpdatedAt ? `?v=${record.imageUpdatedAt}` : ""}`} alt="" style={{ width: 38, height: 38, borderRadius: 6, objectFit: "cover", flex: "0 0 auto" }}/> : record.type === "deity" ? <span style={{ width: 38, height: 38, borderRadius: 6, background: `${accent}1f`, flex: "0 0 auto" }}/> : <span style={{ width: 38, height: 38, display: "grid", placeItems: "center", color: accent, flex: "0 0 auto" }}><PublicPlaceIcon record={record}/></span>}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{record.name}</span>
                  </span>
                  <span style={{ color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{section === "deities" ? record.domains?.join(", ") || "None" : record.type === "poi" ? "Point of Interest" : record.type[0]!.toUpperCase()+record.type.slice(1)}</span>
                  <span style={{ color: section === "deities" && record.rank === "Greater God" ? "#3b82f6" : section === "deities" && record.rank === "Lesser God" ? "#e5484d" : section === "deities" && record.rank === "Overpower" ? "#30a46c" : C.muted, fontWeight: section === "deities" ? 800 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{section === "deities" ? record.rank ?? "None" : record.parentName ?? "None"}</span>
                </button>)}
                {!filteredPublicRecords.length ? <div style={{ padding: 48, textAlign: "center", color: C.muted }}>No {section} match your search.</div> : null}
              </div>
            </>
          ) : selected ? (
            <>
              <button type="button" onClick={() => setSelectedId(null)} style={{ border: 0, padding: 0, marginBottom: 18, background: "transparent", color: C.muted, cursor: "pointer", font: "inherit" }}>← All Mortals</button>
              <article style={{ border: `1px solid ${accent}55`, borderRadius: 15, background: "rgba(255,255,255,.035)", overflow: "hidden" }}>
                <div style={{ height: 4, background: accent }}/>
                <div style={{ padding: 20, display: "grid", gap: 16, maxWidth: 1240 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <button type="button" disabled={!portraitSrc(selected)} onClick={() => setLightboxSrc(portraitSrc(selected))} title={portraitSrc(selected) ? "View full portrait" : undefined} style={{ width: 84, height: 84, padding: 0, border: `1px solid ${accent}4d`, borderRadius: 10, overflow: "hidden", background: `${accent}1a`, display: "grid", placeItems: "center", color: C.muted, flex: "0 0 auto", cursor: portraitSrc(selected) ? "zoom-in" : "default" }}>{portraitSrc(selected) ? <img src={portraitSrc(selected)!} alt={`${selected.name} portrait`} style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : <span style={{ fontSize: "var(--fs-small)", opacity: .72 }}>Portrait</span>}</button>
                    <h2 style={{ margin: 0, fontSize: "calc(var(--fs-hero) * .9)" }}>{selected.name}</h2>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", columnGap: 30, rowGap: 0 }}>
                    {[
                      ["Position",selected.position,<IconShield size={16}/>],["Org",selected.organization ? <span style={{display:"inline-flex",alignItems:"center",gap:6}}>{selected.organizationIcon ? <GameIcon icon={selected.organizationIcon} size={14}/> : null}{selected.organization}</span> : null,<GameIcon icon="game-icons:organigram"/>],["Location",selected.location,<GameIcon icon="game-icons:village"/>],
                      ["Race",selected.species,<GameIcon icon="game-icons:dna1"/>],["Age",ageOf(selected, data.binder.currentDateSort),<GameIcon icon="game-icons:cake-slice"/>],["Gender",selected.gender,<IconGender size={16}/>],["Status",selected.lifeStatus,<GameIcon icon="game-icons:half-dead"/>],
                    ].map(([label,value,icon]) => <div key={String(label)} style={{ minHeight: 42, padding: "8px 2px", borderBottom: `1px solid ${accent}24`, display: "grid", gridTemplateColumns: "105px minmax(0, 1fr)", alignItems: "center", gap: 10 }}><strong style={{ color: C.muted, fontSize: "var(--fs-small)", display: "inline-flex", alignItems: "center", gap: 6 }}>{icon}{label}</strong><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{label === "Status" ? <StatusPill status={value ? String(value) : null} /> : label === "Gender" && value ? <span style={{ display: "inline-flex", padding: "2px 7px", borderRadius: 999, color: value === "female" ? "#f9a8d4" : "#7dd3fc", background: value === "female" ? "rgba(249,168,212,.16)" : "rgba(125,211,252,.16)", fontWeight: 750 }}>{String(value)[0]!.toUpperCase()+String(value).slice(1)}</span> : value || "None"}</span></div>)}
                  </div>
                  {(selected.description || selected.backstory) ? <section style={{ marginTop: 24 }}><h3>Notes</h3><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{selected.description || selected.backstory}</div></section> : null}
                </div>
              </article>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 12 }}><h2 style={{ margin: 0, fontSize: "var(--fs-title)" }}>Mortals</h2><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mortals…" style={{ width: 300, maxWidth: "45%", padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.18)", color: C.text, font: "inherit" }}/></div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
                {(Object.keys(emptyFilters()) as Array<keyof MortalFilters>).map((key) => <SearchableMultiFilter key={key} label={key[0]!.toUpperCase()+key.slice(1)} width={key === "organization" ? 175 : 150} selected={filters[key]} options={filterOptions[key].map((value) => ({ value, label: value[0]!.toUpperCase()+value.slice(1) }))} onAdd={(value) => setFilters((current) => ({ ...current, [key]: [...current[key], value] }))} theme={{ radius: 9, panelBorder: "rgba(255,255,255,.12)", inputBg: "#0d1525", text: C.text, muted: C.muted }} />)}
                {Object.values(filters).some((values) => values.length) ? <button type="button" onClick={() => setFilters(emptyFilters())} style={{ border: 0, background: "transparent", color: accent, cursor: "pointer", font: "inherit", fontWeight: 750 }}>Clear</button> : null}
              </div>
              {Object.entries(filters).some(([,values]) => values.length) ? <div style={{ display:"flex",gap:7,flexWrap:"wrap",marginBottom:14 }}>{(Object.entries(filters) as Array<[keyof MortalFilters,string[]]>).flatMap(([key,values]) => values.map((value) => <button key={`${key}:${value}`} type="button" onClick={() => setFilters((current) => ({...current,[key]:current[key].filter((item) => item !== value)}))} style={{ display:"inline-flex",gap:5,padding:"2px 7px",border:`1px solid ${accent}7a`,borderRadius:999,background:`${accent}1f`,color:C.text,cursor:"pointer",font:"inherit",fontSize:"var(--fs-tiny)",fontWeight:800 }}><span style={{color:accent}}>{key[0]!.toUpperCase()+key.slice(1)}</span>{value} <span style={{color:"#ff5c65"}}>×</span></button>))}</div> : null}
              <div style={{ border: "1px solid rgba(255,255,255,.09)", borderRadius: 13, overflowX: "auto" }}>
                <div style={{ minWidth: 1160 }}>
                  <BinderDataTableHeader
                    gridTemplateColumns={MORTAL_COLUMNS}
                    accent={accent}
                    theme={{ text: C.text, muted: C.muted, border: "rgba(255,255,255,.09)" }}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={(key) => toggleSort(key as MortalSortKey)}
                    columns={[...([
                      ["name","Name",null],["position","Position",<IconShield size={14}/>],["organization","Organization",<GameIcon icon="game-icons:organigram" size={14}/>],["location","Location",<GameIcon icon="game-icons:village" size={14}/>],["species","Species",<GameIcon icon="game-icons:dna1" size={14}/>],["age","Age",<GameIcon icon="game-icons:cake-slice" size={14}/>],["gender","Gender",<IconGender size={14}/>],["status","Status",<GameIcon icon="game-icons:half-dead" size={14}/>],
                    ] as Array<[MortalSortKey,string,React.ReactNode]>).map(([key,label,icon]) => ({ key, label, icon, sortable: true })), { key: "visibility", label: "" }]}
                  />
                  {sorted.map((mortal) => {
                    const genderColor = mortal.gender === "female" ? "#f9a8d4" : mortal.gender === "male" ? "#7dd3fc" : null;
                    const cell = { color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
                    return <BinderDataTableRow key={mortal.id} onClick={() => setSelectedId(mortal.id)} gridTemplateColumns={MORTAL_COLUMNS} theme={{ text: C.text, muted: C.muted, border: "rgba(255,255,255,.08)" }}>
                      <span style={{ ...cell, color: C.text, display: "flex", alignItems: "center", gap: 9, fontWeight: 750 }}><BinderDataTableThumbnail imageUrl={mortal.imageUrl} imageUpdatedAt={mortal.imageUpdatedAt} accent={accent}/><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{mortal.name}</span>{mortal.id === data.linkedMortalId ? <small style={{ color: accent }}>(You)</small> : null}</span>
                      <span style={{...cell,display:"flex",gap:6,alignItems:"center"}}>{mortal.positionIcon ? <GameIcon icon={mortal.positionIcon} size={14}/> : <IconShield size={14}/>} {mortal.position || "None"}</span>
                      <span style={{...cell,display:"flex",gap:6,alignItems:"center"}}>{mortal.organizationIcon ? <GameIcon icon={mortal.organizationIcon} size={14}/> : <GameIcon icon="game-icons:organigram" size={14}/>} {mortal.organization || "None"}</span>
                      <span style={{...cell,display:"flex",gap:6,alignItems:"center"}}><GameIcon icon="game-icons:village" size={14}/>{mortal.location || "None"}</span>
                      <span style={cell}>{mortal.species || "None"}</span><span style={cell}>{ageOf(mortal,data.binder.currentDateSort) || "None"}</span>
                      <span>{genderColor ? <span style={{ display:"inline-flex",padding:"2px 7px",borderRadius:999,color:genderColor,background:`${genderColor}29`,fontSize:"var(--fs-small)",fontWeight:750 }}>{mortal.gender === "female" ? "Female" : "Male"}</span> : <span style={{color:"#ff5c65"}}>Needs gender</span>}</span>
                      <StatusPill status={mortal.lifeStatus}/><span />
                    </BinderDataTableRow>;
                  })}
                  {!sorted.length ? <div style={{ padding: 48, textAlign: "center", color: C.muted }}>No Mortals match the current filters.</div> : null}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
      <ImageLightbox src={lightboxSrc} alt={selected ? `${selected.name} portrait` : "Portrait"} onClose={() => setLightboxSrc(null)} />
    </main>
  );
}
