import React from "react";

import { IconChest } from "@/icons";
import { api } from "@/services/api";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { useVirtualList } from "@/views/CampaignView/monsterPicker/hooks/useVirtualList";
import { useItemSearch } from "@/views/CompendiumView/hooks/useItemSearch";
import { ItemFormModal, type ItemForEdit } from "@/views/CompendiumView/panels/ItemFormModal";
import { BrowserAddButton } from "./browserParts";
import { ItemsBrowserFilters, ItemsBrowserList, ItemsBrowserRow } from "./ItemsBrowserSections";

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
    q,
    setQ,
    rarityFilter,
    setRarityFilter,
    rarityOptions,
    typeFilter,
    setTypeFilter,
    typeOptions,
    filterAttunement,
    setFilterAttunement,
    filterMagic,
    setFilterMagic,
    hasActiveFilters,
    clearFilters,
    rows,
    busy,
    refresh,
  } = useItemSearch();

  const [activeId, setActiveId] = React.useState("");
  const [formTarget, setFormTarget] = React.useState<FormTarget | null>(null);
  const [editLoading, setEditLoading] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [hoveredRowId, setHoveredRowId] = React.useState<string | null>(null);

  const virtualList = useVirtualList({ isEnabled: true, rowHeight: ROW_HEIGHT, overscan: 6 });
  const { start, end, padTop, padBottom } = virtualList.getRange(rows.length);

  React.useEffect(() => {
    setActiveId(props.selectedItemId ?? "");
  }, [props.selectedItemId]);

  React.useEffect(() => {
    const element = virtualList.scrollRef.current;
    if (element) element.scrollTop = 0;
  }, [q, rarityFilter, typeFilter, filterAttunement, filterMagic, virtualList.scrollRef]);

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
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}>
            <IconChest size={28} title="Items" />
            <span>Items</span>
          </span>
        }
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>{busy ? "Loading..." : `${rows.length}`}</div>
            {props.editable ? <BrowserAddButton title="New item" onClick={() => setFormTarget({ mode: "create" })} /> : null}
          </div>
        }
        style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
        bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
      >
        <ItemsBrowserFilters
          q={q}
          rarityFilter={rarityFilter}
          rarityOptions={rarityOptions}
          typeFilter={typeFilter}
          typeOptions={typeOptions}
          filterAttunement={filterAttunement}
          filterMagic={filterMagic}
          hasActiveFilters={hasActiveFilters}
          onChangeQ={setQ}
          onChangeRarity={setRarityFilter}
          onChangeType={setTypeFilter}
          onToggleAttunement={() => setFilterAttunement(!filterAttunement)}
          onToggleMagic={() => setFilterMagic(!filterMagic)}
          onClearFilters={clearFilters}
        />

        <ItemsBrowserList
          scrollRef={virtualList.scrollRef}
          onScroll={virtualList.onScroll as React.UIEventHandler<HTMLDivElement>}
          padTop={padTop}
          padBottom={padBottom}
          rows={rows.slice(start, end)}
          busy={busy}
          renderRow={(item) => (
            <ItemsBrowserRow
              key={item.id}
              item={item}
              active={item.id === activeId}
              hovered={hoveredRowId === item.id}
              confirmingDelete={confirmDeleteId === item.id}
              editLoading={editLoading === item.id}
              deleteBusy={deleteBusy}
              editable={props.editable}
              onHover={setHoveredRowId}
              onClick={() => {
                setActiveId(item.id);
                props.onSelectItem?.(item.id);
              }}
              onEdit={() => handleEditClick(item.id)}
              onDeleteRequest={() => setConfirmDeleteId(item.id)}
              onDeleteConfirm={() => handleDeleteConfirm(item.id)}
              onDeleteCancel={() => setConfirmDeleteId(null)}
            />
          )}
        />
      </Panel>

      {formTarget ? (
        <ItemFormModal
          item={formTarget.mode === "edit" ? formTarget.item : null}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            refresh();
          }}
        />
      ) : null}
    </>
  );
}
