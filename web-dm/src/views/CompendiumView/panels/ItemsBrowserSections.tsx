import React from "react";

import { EmptyState, ItemListRow, ListShell } from "@beholden/shared/ui";
import { IconPencil, IconTrash } from "@/icons";
import { titleCase } from "@/lib/format/titleCase";
import { theme, withAlpha } from "@/theme/theme";
import { Select } from "@/ui/Select";
import { actionBtnStyle, togglePillStyle } from "./browserParts";
import { rarityChipColor } from "@/views/CampaignView/components/ItemPickerModalParts";
import type { ItemSearchRow } from "@/views/CompendiumView/hooks/useItemSearch";

type ItemsBrowserFiltersProps = {
  q: string;
  rarityFilter: string;
  rarityOptions: string[];
  typeFilter: string;
  typeOptions: string[];
  filterAttunement: boolean;
  filterMagic: boolean;
  hasActiveFilters: boolean;
  onChangeQ: (value: string) => void;
  onChangeRarity: (value: string) => void;
  onChangeType: (value: string) => void;
  onToggleAttunement: () => void;
  onToggleMagic: () => void;
  onClearFilters: () => void;
};

export function ItemsBrowserFilters(props: ItemsBrowserFiltersProps) {
  return (
    <>
      <input
        value={props.q}
        placeholder="Search items..."
        onChange={(e) => props.onChangeQ(e.target.value)}
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
        <Select value={props.rarityFilter} onChange={(e) => props.onChangeRarity(e.target.value)} style={{ width: "100%" }} title="Filter by rarity">
          {props.rarityOptions.map((rarity) => (
            <option key={rarity} value={rarity}>
              {rarity === "all" ? "All Rarities" : titleCase(rarity)}
            </option>
          ))}
        </Select>
        <Select value={props.typeFilter} onChange={(e) => props.onChangeType(e.target.value)} style={{ width: "100%" }} title="Filter by type">
          {props.typeOptions.map((type) => (
            <option key={type} value={type}>
              {type === "all" ? "All Types" : type}
            </option>
          ))}
        </Select>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={props.onToggleAttunement} style={togglePillStyle(props.filterAttunement)}>
          Attunement
        </button>
        <button type="button" onClick={props.onToggleMagic} style={togglePillStyle(props.filterMagic)}>
          Magic
        </button>
        {props.hasActiveFilters ? (
          <button type="button" onClick={props.onClearFilters} style={togglePillStyle(false)}>
            Clear
          </button>
        ) : null}
      </div>
    </>
  );
}

type ItemRowProps = {
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

export function ItemsBrowserRow(props: ItemRowProps) {
  const subtitle = [
    props.item.rarity ? titleCase(props.item.rarity) : null,
    props.item.type ?? null,
    props.item.attunement ? "Attunement" : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const showActions = props.hovered || props.confirmingDelete;

  return (
    <div
      onMouseEnter={() => props.onHover(props.item.id)}
      onMouseLeave={() => props.onHover(null)}
      style={{
        display: "flex",
        alignItems: "center",
        height: 52,
        borderBottom: `1px solid ${theme.colors.panelBorder}`,
        background: props.active ? withAlpha(theme.colors.accentHighlight, 0.18) : "transparent",
        flexShrink: 0,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <ItemListRow
          name={props.item.name}
          subtitle={subtitle}
          rarityColor={props.item.rarity ? rarityChipColor(props.item.rarity) : null}
          magic={props.item.magic}
          magicColor={theme.colors.colorMagic}
          active={props.active}
          activeBackground={withAlpha(theme.colors.accentHighlight, 0.18)}
          borderColor={theme.colors.panelBorder}
          textColor={theme.colors.text}
          mutedColor={theme.colors.muted}
          height={52}
          padding="0 10px"
          onClick={props.onClick}
        />
      </div>

      {props.editable ? (
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
          {props.confirmingDelete ? (
            <>
              <span style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, marginRight: 4 }}>Delete?</span>
              <button type="button" onClick={props.onDeleteConfirm} disabled={props.deleteBusy} style={actionBtnStyle(theme.colors.red)} title="Yes, delete">
                Yes
              </button>
              <button type="button" onClick={props.onDeleteCancel} style={actionBtnStyle(theme.colors.muted)} title="Cancel">
                No
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={props.onEdit} disabled={props.editLoading} style={actionBtnStyle(theme.colors.muted)} title="Edit item">
                {props.editLoading ? <span style={{ fontSize: "var(--fs-tiny)" }}>...</span> : <IconPencil size={13} />}
              </button>
              <button type="button" onClick={props.onDeleteRequest} style={actionBtnStyle(theme.colors.muted)} title="Delete item">
                <IconTrash size={13} />
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

type ItemsBrowserListProps = {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: React.UIEventHandler<HTMLDivElement>;
  padTop: number;
  padBottom: number;
  rows: ItemSearchRow[];
  busy: boolean;
  renderRow: (item: ItemSearchRow) => React.ReactNode;
};

export function ItemsBrowserList(props: ItemsBrowserListProps) {
  return (
    <ListShell
      ref={props.scrollRef}
      onScroll={props.onScroll}
      style={{ borderColor: theme.colors.panelBorder }}
    >
      <div style={{ height: props.padTop }} />
      {props.rows.map(props.renderRow)}
      <div style={{ height: props.padBottom }} />
      {!props.busy && props.rows.length === 0 ? (
        <EmptyState textColor={theme.colors.muted} style={{ padding: 10 }}>
          No items found.
        </EmptyState>
      ) : null}
    </ListShell>
  );
}
