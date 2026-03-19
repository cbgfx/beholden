import React from "react";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { IconChest, IconPencil, IconTrash, IconPlus } from "@/icons";
import { theme, withAlpha } from "@/theme/theme";
import { useItemSearch, type ItemSearchRow } from "@/views/CompendiumView/hooks/useItemSearch";
import { ItemFormModal, type ItemForEdit } from "@/views/CompendiumView/panels/ItemFormModal";
import { useVirtualList } from "@/views/CampaignView/monsterPicker/hooks/useVirtualList";
import { api } from "@/services/api";
import { titleCase } from "@/lib/format/titleCase";

const ROW_HEIGHT = 52;

function rarityColor(rarity: string | null): string {
  switch ((rarity ?? "").toLowerCase()) {
    case "common":    return theme.colors.muted;
    case "uncommon":  return "#1eff00";
    case "rare":      return "#0070dd";
    case "very rare": return "#a335ee";
    case "legendary": return "#ff8000";
    case "artifact":  return "#e6cc80";
    default:          return theme.colors.muted;
  }
}

function RarityDot({ rarity }: { rarity: string | null }) {
  const c = rarityColor(rarity);
  return (
    <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />
  );
}

function MagicBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 11, fontWeight: 700, color: "#a78bfa",
      border: "1px solid #6d28d966", borderRadius: 6,
      padding: "1px 6px", lineHeight: 1.4, whiteSpace: "nowrap",
    }}>
      ✦ Magic
    </span>
  );
}

type Props = {
  editable?: boolean;
  selectedItemId?: string | null;
  onSelectItem?: (id: string) => void;
};

type FormTarget =
  | { mode: "create" }
  | { mode: "edit"; item: ItemForEdit };

export function ItemsBrowserPanel(props: Props) {
  const {
    q, setQ,
    rarityFilter, setRarityFilter, rarityOptions,
    typeFilter, setTypeFilter, typeOptions,
    filterAttunement, setFilterAttunement,
    filterMagic, setFilterMagic,
    hasActiveFilters, clearFilters,
    rows, busy, refresh,
  } = useItemSearch();

  const [activeId, setActiveId] = React.useState<string>("");
  const [formTarget, setFormTarget] = React.useState<FormTarget | null>(null);
  const [editLoading, setEditLoading] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [hoveredRowId, setHoveredRowId] = React.useState<string | null>(null);

  const vl = useVirtualList({ isEnabled: true, rowHeight: ROW_HEIGHT, overscan: 6 });
  const { start, end, padTop, padBottom } = vl.getRange(rows.length);

  React.useEffect(() => {
    setActiveId(props.selectedItemId ?? "");
  }, [props.selectedItemId]);

  // Reset scroll when filters change
  React.useEffect(() => {
    const el = vl.scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [q, rarityFilter, typeFilter, filterAttunement, filterMagic]);

  async function handleEditClick(id: string) {
    setEditLoading(id);
    try {
      const item = await api<ItemForEdit>(`/api/compendium/items/${encodeURIComponent(id)}`);
      setFormTarget({ mode: "edit", item });
    } catch { /* ignore */ }
    finally { setEditLoading(null); }
  }

  async function handleDeleteConfirm(id: string) {
    setDeleteBusy(true);
    try {
      await api(`/api/compendium/items/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (activeId === id) { setActiveId(""); props.onSelectItem?.(""); }
      setConfirmDeleteId(null);
      refresh();
    } catch { /* ignore */ }
    finally { setDeleteBusy(false); }
  }

  return (
    <>
      <Panel
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}>
            <IconChest size={28} title="Items" />
            <span>Items</span>
          </span>
        }
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ color: theme.colors.muted, fontSize: 12 }}>
              {busy ? "Loading…" : `${rows.length}`}
            </div>
            {props.editable && (
              <button
                type="button"
                title="New item"
                onClick={() => setFormTarget({ mode: "create" })}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: 8,
                  border: `1px solid ${theme.colors.panelBorder}`,
                  background: theme.colors.accentPrimary,
                  color: theme.colors.textDark,
                  cursor: "pointer",
                }}
              >
                <IconPlus size={14} />
              </button>
            )}
          </div>
        }
        style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
        bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
      >
        {/* Search */}
        <input
          value={q}
          placeholder="Search items…"
          onChange={(e) => setQ(e.target.value)}
          style={{
            background: theme.colors.panelBg,
            color: theme.colors.text,
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 10,
            padding: "8px 10px",
            outline: "none",
          }}
        />

        {/* Rarity + Type */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)} style={{ width: "100%" }} title="Filter by rarity">
            {rarityOptions.map((r) => (
              <option key={r} value={r}>{r === "all" ? "All Rarities" : titleCase(r)}</option>
            ))}
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: "100%" }} title="Filter by type">
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t === "all" ? "All Types" : t}</option>
            ))}
          </Select>
        </div>

        {/* Attunement + Magic + Clear */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={() => setFilterAttunement(!filterAttunement)} style={togglePill(filterAttunement)}>
            Attunement
          </button>
          <button type="button" onClick={() => setFilterMagic(!filterMagic)} style={togglePill(filterMagic)}>
            Magic
          </button>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} style={togglePill(false)}>
              Clear
            </button>
          )}
        </div>

        {/* Virtual list */}
        <div
          ref={vl.scrollRef}
          onScroll={vl.onScroll}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 12,
          }}
        >
          {/* Top spacer */}
          <div style={{ height: padTop }} />

          {rows.slice(start, end).map((item) => {
            const isConfirmingDelete = confirmDeleteId === item.id;
            const isHovered = hoveredRowId === item.id;
            return (
              <ItemRow
                key={item.id}
                item={item}
                active={item.id === activeId}
                hovered={isHovered}
                confirmingDelete={isConfirmingDelete}
                editLoading={editLoading === item.id}
                deleteBusy={deleteBusy}
                editable={props.editable}
                onHover={setHoveredRowId}
                onClick={() => { setActiveId(item.id); props.onSelectItem?.(item.id); }}
                onEdit={() => handleEditClick(item.id)}
                onDeleteRequest={() => setConfirmDeleteId(item.id)}
                onDeleteConfirm={() => handleDeleteConfirm(item.id)}
                onDeleteCancel={() => setConfirmDeleteId(null)}
              />
            );
          })}

          {/* Bottom spacer */}
          <div style={{ height: padBottom }} />

          {!busy && rows.length === 0 && (
            <div style={{ padding: 10, color: theme.colors.muted }}>No items found.</div>
          )}
        </div>
      </Panel>

      {formTarget && (
        <ItemFormModal
          item={formTarget.mode === "edit" ? formTarget.item : null}
          onClose={() => setFormTarget(null)}
          onSaved={() => { setFormTarget(null); refresh(); }}
        />
      )}
    </>
  );
}

// ─── Row sub-component ───────────────────────────────────────────────────────

type RowProps = {
  item: ItemSearchRow;
  active: boolean;
  hovered: boolean;
  confirmingDelete: boolean;
  editLoading: boolean;
  deleteBusy: boolean;
  editable?: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
  onEdit: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
};

function ItemRow(p: RowProps) {
  const { item } = p;
  const showActions = p.hovered || p.confirmingDelete;

  const subtitle = [
    item.rarity ? titleCase(item.rarity) : null,
    item.type ?? null,
    item.attunement ? "Attunement" : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div
      onMouseEnter={() => p.onHover(item.id)}
      onMouseLeave={() => p.onHover(null)}
      style={{
        display: "flex",
        alignItems: "center",
        height: ROW_HEIGHT,
        borderBottom: `1px solid ${theme.colors.panelBorder}`,
        background: p.active ? withAlpha(theme.colors.accentHighlight, 0.18) : "transparent",
        flexShrink: 0,
      }}
    >
      <button
        onClick={p.onClick}
        style={{
          flex: 1, height: "100%",
          display: "flex", flexDirection: "column", justifyContent: "center",
          textAlign: "left", padding: "0 10px",
          border: "none", background: "transparent",
          color: theme.colors.text, cursor: "pointer", minWidth: 0,
        }}
      >
        {/* Name row: dot + name + magic badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {item.rarity && <RarityDot rarity={item.rarity} />}
          <span style={{ fontWeight: 700, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {item.name}
          </span>
          {item.magic && <MagicBadge />}
        </div>
        {subtitle && (
          <div style={{ color: theme.colors.muted, fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitle}
          </div>
        )}
      </button>

      {p.editable && (
        <div style={{
          display: "flex", alignItems: "center", gap: 4, padding: "0 8px", flexShrink: 0,
          opacity: showActions ? 1 : 0,
          transition: "opacity 0.1s",
          pointerEvents: showActions ? "auto" : "none",
        }}>
          {p.confirmingDelete ? (
            <>
              <span style={{ fontSize: 11, color: theme.colors.muted, marginRight: 4 }}>Delete?</span>
              <button type="button" onClick={p.onDeleteConfirm} disabled={p.deleteBusy} style={actionBtnStyle(theme.colors.red)} title="Yes, delete">Yes</button>
              <button type="button" onClick={p.onDeleteCancel} style={actionBtnStyle(theme.colors.muted)} title="Cancel">No</button>
            </>
          ) : (
            <>
              <button type="button" onClick={p.onEdit} disabled={p.editLoading} style={actionBtnStyle(theme.colors.muted)} title="Edit item">
                {p.editLoading ? <span style={{ fontSize: 10 }}>…</span> : <IconPencil size={13} />}
              </button>
              <button type="button" onClick={p.onDeleteRequest} style={actionBtnStyle(theme.colors.muted)} title="Delete item">
                <IconTrash size={13} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function togglePill(active: boolean): React.CSSProperties {
  return {
    padding: "4px 10px", borderRadius: 999,
    border: `1px solid ${active ? theme.colors.accentHighlight : theme.colors.panelBorder}`,
    background: active ? withAlpha(theme.colors.accentHighlight, 0.18) : withAlpha(theme.colors.shadowColor, 0.12),
    color: active ? theme.colors.accentHighlight : theme.colors.muted,
    cursor: "pointer", fontSize: "var(--fs-pill, 11px)", fontWeight: 700,
  };
}

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 26, height: 26, padding: 0,
    border: `1px solid ${withAlpha(color, 0.3)}`,
    borderRadius: 6, background: withAlpha(color, 0.1),
    color, cursor: "pointer", fontSize: 11, fontWeight: 700,
  };
}
