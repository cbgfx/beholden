import React from "react";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { C, withAlpha } from "@/lib/theme";
import { titleCase } from "@/lib/format/titleCase";
import { useItemSearch, type ItemSearchRow } from "@/views/CompendiumView/hooks/useItemSearch";
import { useVirtualList } from "@/lib/monsterPicker/useVirtualList";
import { IconChest } from "@/ui/Icons";
import { ItemListRow, togglePillStyle } from "@beholden/shared/ui";

const ROW_HEIGHT = 52;

function rarityColor(rarity: string | null): string {
  switch ((rarity ?? "").toLowerCase()) {
    case "common":    return C.muted;
    case "uncommon":  return "#1eff00";
    case "rare":      return "#0070dd";
    case "very rare": return "#a335ee";
    case "legendary": return "#ff8000";
    case "artifact":  return "#e6cc80";
    default:          return C.muted;
  }
}

export function ItemsBrowserPanel(props: {
  selectedItemId?: string | null;
  onSelectItem?: (id: string) => void;
}) {
  const {
    q, setQ,
    rarityFilter, setRarityFilter, rarityOptions,
    typeFilter, setTypeFilter, typeOptions,
    filterAttunement, setFilterAttunement,
    filterMagic, setFilterMagic,
    hasActiveFilters, clearFilters,
    rows, busy,
  } = useItemSearch();

  const vl = useVirtualList({ isEnabled: true, rowHeight: ROW_HEIGHT, overscan: 6 });
  const { start, end, padTop, padBottom } = vl.getRange(rows.length);

  React.useEffect(() => {
    const el = vl.scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [q, rarityFilter, typeFilter, filterAttunement, filterMagic]);

  return (
    <Panel
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}><IconChest size={28} /><span>Items</span></span>}
      actions={<div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{busy ? "Loading…" : rows.length}</div>}
      style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
    >
      <input
        value={q} placeholder="Search items…" onChange={(e) => setQ(e.target.value)}
        style={{
          background: C.panelBg, color: C.text, border: `1px solid ${C.panelBorder}`,
          borderRadius: 10, padding: "8px 10px", outline: "none",
        }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)} style={{ width: "100%" }}>
          {rarityOptions.map((r) => (
            <option key={r} value={r}>{r === "all" ? "All Rarities" : titleCase(r)}</option>
          ))}
        </Select>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: "100%" }}>
          {typeOptions.map((t) => (
            <option key={t} value={t}>{t === "all" ? "All Types" : t}</option>
          ))}
        </Select>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => setFilterAttunement(!filterAttunement)} style={togglePillStyle(filterAttunement, C.accentHl, C.panelBorder, C.muted)}>
          Attunement
        </button>
        <button type="button" onClick={() => setFilterMagic(!filterMagic)} style={togglePillStyle(filterMagic, C.accentHl, C.panelBorder, C.muted)}>
          Magic
        </button>
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} style={togglePillStyle(false, C.accentHl, C.panelBorder, C.muted)}>Clear</button>
        )}
      </div>

      <div
        ref={vl.scrollRef} onScroll={vl.onScroll}
        style={{ flex: 1, minHeight: 0, overflowY: "auto", border: `1px solid ${C.panelBorder}`, borderRadius: 12 }}
      >
        <div style={{ height: padTop }} />
        {rows.slice(start, end).map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            active={item.id === (props.selectedItemId ?? "")}
            onClick={() => props.onSelectItem?.(item.id)}
          />
        ))}
        <div style={{ height: padBottom }} />
        {!busy && rows.length === 0 && (
          <div style={{ padding: 10, color: C.muted }}>No items found.</div>
        )}
      </div>
    </Panel>
  );
}

function ItemRow({ item, active, onClick }: { item: ItemSearchRow; active: boolean; onClick: () => void }) {
  const subtitle = [
    item.rarity ? titleCase(item.rarity) : null,
    item.type ?? null,
    item.attunement ? "Attunement" : null,
  ].filter(Boolean).join(" • ");

  return (
    <ItemListRow
      name={item.name}
      subtitle={subtitle || null}
      rarityColor={item.rarity ? rarityColor(item.rarity) : null}
      magic={!!item.magic}
      magicColor={C.colorMagic}
      active={active}
      onClick={onClick}
      height={ROW_HEIGHT}
      padding="0 12px"
      textColor={C.text}
      mutedColor={C.muted}
      borderColor={C.panelBorder}
      activeBackground={withAlpha(C.accentHl, 0.16)}
    />
  );
}
