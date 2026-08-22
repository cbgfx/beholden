import { C, withAlpha } from "@/lib/theme";
import { inputStyle } from "../shared/CharacterCreatorStyles";

export function CharacterCreatorCatalogPicker<T extends { id: string; name: string }>(props: {
  entries: T[];
  filteredEntries: T[];
  search: string;
  setSearch: (value: string) => void;
  selectedId: string;
  select: (id: string) => void;
  emptyLabel: string;
  searchPlaceholder: string;
}) {
  const { entries, filteredEntries, search, setSearch, selectedId, select, emptyLabel, searchPlaceholder } = props;
  if (entries.length === 0) return <p style={{ color: C.muted }}>{emptyLabel}</p>;
  return <>
    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder}
      style={{ ...inputStyle, width: "100%", marginBottom: 12 }} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxHeight: 340, overflowY: "auto", paddingRight: 4, marginBottom: 4 }}>
      {filteredEntries.length === 0 && <p style={{ color: C.muted, gridColumn: "1 / -1" }}>No matches.</p>}
      {filteredEntries.map((entry) => {
        const selected = selectedId === entry.id;
        return <button type="button" key={entry.id} onClick={() => select(entry.id)} style={{
          padding: "10px 13px", borderRadius: 10, textAlign: "left",
          border: `2px solid ${selected ? C.accentHl : C.panelBorder}`,
          background: selected ? withAlpha(C.accentHl, 0.15) : C.panelBg,
          color: selected ? C.accentHl : C.text, cursor: "pointer", fontWeight: selected ? 700 : 500,
          fontSize: "var(--fs-subtitle)", transition: "border-color 0.12s, background 0.12s",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{entry.name}</button>;
      })}
    </div>
  </>;
}
