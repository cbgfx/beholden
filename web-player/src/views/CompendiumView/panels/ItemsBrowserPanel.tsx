import React from "react";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { C, withAlpha } from "@/lib/theme";
import { titleCase } from "@/lib/format/titleCase";
import { useItemSearch, type ItemSearchRow } from "@/views/CompendiumView/hooks/useItemSearch";
import { useVirtualList } from "@/lib/monsterPicker/useVirtualList";
import { IconChest } from "@/ui/Icons";

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

function togglePill(active: boolean): React.CSSProperties {
  return {
    padding: "4px 10px", borderRadius: 999,
    border: `1px solid ${active ? C.accentHl : C.panelBorder}`,
    background: active ? withAlpha(C.accentHl, 0.18) : withAlpha(C.accentHl, 0.08),
    color: active ? C.accentHl : C.muted,
    cursor: "pointer", fontSize: "var(--fs-pill)", fontWeight: 700,
  };
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
          borderRadius: 10, padding: "8px 10px",
          outline: "none",
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
        <button type="button" onClick={() => setFilterAttunement(!filterAttunement)} style={togglePill(filterAttunement)}>
          Attunement
        </button>
        <button type="button" onClick={() => setFilterMagic(!filterMagic)} style={togglePill(filterMagic)}>
          Magic
        </button>
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} style={togglePill(false)}>Clear</button>
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
  const c = rarityColor(item.rarity);
  const subtitle = [
    item.rarity ? titleCase(item.rarity) : null,
    item.type ?? null,
    item.attunement ? "Attunement" : null,
  ].filter(Boolean).join(" • ");

  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", justifyContent: "center",
        height: ROW_HEIGHT, width: "100%", textAlign: "left",
        padding: "0 12px", border: "none",
        borderBottom: `1px solid ${C.panelBorder}`,
        background: active ? withAlpha(C.accentHl, 0.16) : "transparent",
        color: C.text, cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {item.rarity && (
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0, display: "inline-block" }} />
        )}
        <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {item.name}
        </span>
        {item.magic && (
          <span style={{
            fontSize: "var(--fs-small)", fontWeight: 700, color: C.colorMagic,
            border: "1px solid #6d28d966", borderRadius: 6,
            padding: "1px 6px", whiteSpace: "nowrap",
          }}>✦ Magic</span>
        )}
      </div>
      {subtitle && (
        <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {subtitle}
        </div>
      )}
    </button>
  );
}
