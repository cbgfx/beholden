import React from "react";
import { ItemListRow } from "@beholden/shared/ui";
import { IconChest, IconPencil, IconTrash } from "@/icons";
import { titleCase } from "@/lib/format/titleCase";
import { api } from "@/services/api";
import { theme, withAlpha } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { useVirtualList } from "@/views/CampaignView/monsterPicker/hooks/useVirtualList";
import { MagicBadge, rarityChipColor, RarityDot } from "@/views/CampaignView/components/ItemPickerModalParts";
import { useItemSearch, type ItemSearchRow } from "@/views/CompendiumView/hooks/useItemSearch";
import { ItemFormModal, type ItemForEdit } from "@/views/CompendiumView/panels/ItemFormModal";
import { actionBtnStyle, togglePillStyle, BrowserAddButton } from "./browserParts";

const ROW_HEIGHT = 52;

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

  React.useEffect(() => {
    const el = vl.scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [q, rarityFilter, typeFilter, filterAttunement, filterMagic]);

  async function handleEditClick(id: string) {
    setEditLoading(id);
    try {
      const item = await api<ItemForEdit>(`/api/compendium/items/${encodeURIComponent(id)}`);
      setFormTarget({ mode: "edit", item });
    } catch {
      // ignore
    } finally {
      setEditLoading(null);
    }
  }

  async function handleDeleteConfirm(id: string) {
    setDeleteBusy(true);
    try {
      await api(`/api/compendium/items/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (activeId === id) {
        setActiveId("");
        props.onSelectItem?.("");
      }
      setConfirmDeleteId(null);
      refresh();
    } catch {
      // ignore
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <Panel
        storageKey="compendium-items"
        title={(
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}>
            <IconChest size={28} title="Items" />
            <span>Items</span>
          </span>
        )}
        actions={(
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
              {busy ? "Loading…" : `${rows.length}`}
            </div>
            {props.editable ? <BrowserAddButton title="New item" onClick={() => setFormTarget({ mode: "create" })} /> : null}
          </div>
        )}
        style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
        bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
      >
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)} style={{ width: "100%" }} title="Filter by rarity">
            {rarityOptions.map((r) => <option key={r} value={r}>{r === "all" ? "All Rarities" : titleCase(r)}</option>)}
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: "100%" }} title="Filter by type">
            {typeOptions.map((t) => <option key={t} value={t}>{t === "all" ? "All Types" : t}</option>)}
          </Select>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={() => setFilterAttunement(!filterAttunement)} style={togglePillStyle(filterAttunement)}>Attunement</button>
          <button type="button" onClick={() => setFilterMagic(!filterMagic)} style={togglePillStyle(filterMagic)}>Magic</button>
          {hasActiveFilters ? <button type="button" onClick={clearFilters} style={togglePillStyle(false)}>Clear</button> : null}
        </div>

        <div
          ref={vl.scrollRef}
          onScroll={vl.onScroll}
          style={{ flex: 1, minHeight: 0, overflowY: "auto", border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 12 }}
        >
          <div style={{ height: padTop }} />

          {rows.slice(start, end).map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              active={item.id === activeId}
              hovered={hoveredRowId === item.id}
              confirmingDelete={confirmDeleteId === item.id}
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
          ))}

          <div style={{ height: padBottom }} />

          {!busy && rows.length === 0 ? <div style={{ padding: 10, color: theme.colors.muted }}>No items found.</div> : null}
        </div>
      </Panel>

      {formTarget ? (
        <ItemFormModal
          item={formTarget.mode === "edit" ? formTarget.item : null}
          onClose={() => setFormTarget(null)}
          onSaved={() => { setFormTarget(null); refresh(); }}
        />
      ) : null}
    </>
  );
}

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
  const subtitle = [
    item.rarity ? titleCase(item.rarity) : null,
    item.type ?? null,
    item.attunement ? "Attunement" : null,
  ].filter(Boolean).join(" • ");

  const showActions = p.hovered || p.confirmingDelete;

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
      <div style={{ flex: 1, minWidth: 0 }}>
        <ItemListRow
          name={item.name}
          subtitle={subtitle}
          rarityColor={item.rarity ? rarityChipColor(item.rarity) : null}
          magic={item.magic}
          magicColor={theme.colors.colorMagic}
          active={p.active}
          activeBackground={withAlpha(theme.colors.accentHighlight, 0.18)}
          borderColor={theme.colors.panelBorder}
          textColor={theme.colors.text}
          mutedColor={theme.colors.muted}
          height={ROW_HEIGHT}
          padding="0 10px"
          onClick={p.onClick}
        />
      </div>

      {p.editable ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "0 8px",
            flexShrink: 0,
            opacity: showActions ? 1 : 0,
            transition: "opacity 0.1s",
            pointerEvents: showActions ? "auto" : "none",
          }}
        >
          {p.confirmingDelete ? (
            <>
              <span style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, marginRight: 4 }}>Delete?</span>
              <button type="button" onClick={p.onDeleteConfirm} disabled={p.deleteBusy} style={actionBtnStyle(theme.colors.red)} title="Yes, delete">Yes</button>
              <button type="button" onClick={p.onDeleteCancel} style={actionBtnStyle(theme.colors.muted)} title="Cancel">No</button>
            </>
          ) : (
            <>
              <button type="button" onClick={p.onEdit} disabled={p.editLoading} style={actionBtnStyle(theme.colors.muted)} title="Edit item">
                {p.editLoading ? <span style={{ fontSize: "var(--fs-tiny)" }}>…</span> : <IconPencil size={13} />}
              </button>
              <button type="button" onClick={p.onDeleteRequest} style={actionBtnStyle(theme.colors.muted)} title="Delete item">
                <IconTrash size={13} />
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
