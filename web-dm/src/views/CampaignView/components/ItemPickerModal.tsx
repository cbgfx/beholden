import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import { Modal } from "@/components/overlay/Modal";
import { api } from "@/services/api";
import { ItemFormModal } from "@beholden/shared/views/item-editor/ItemFormModal";
import { useItemPicker } from "./useItemPicker";
import { ItemPickerBrowsePanel, ItemPickerDetailPanel } from "./ItemPickerModalSections";

// Treasure always points at a compendium item. A new item is made with the same full editor the
// Compendium view uses (weapons, armor, charges, spells...), saved to the compendium, then added.
export type AddItemPayload = { source: "compendium"; itemId: string; qty: number };

export function ItemPickerModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (payload: AddItemPayload) => void;
}) {
  const translateUi = useUiTranslation("dmUi");
  const {
    rows,
    totalCount,
    loading,
    q,
    setQ,
    rarity,
    setRarity,
    rarityOptions,
    type,
    setType,
    typeOptions,
    magicFilter,
    setMagicFilter,
    selectedId,
    setSelectedId,
    detail,
    filtered,
    vl,
    onScroll,
    refresh,
    ROW_HEIGHT,
  } = useItemPicker(props.isOpen);

  const [qty, setQty] = React.useState(1);
  const [createMode, setCreateMode] = React.useState(false);

  React.useEffect(() => {
    if (props.isOpen) return;
    setQty(1);
    setCreateMode(false);
  }, [props.isOpen]);

  const { start, end, padTop, padBottom } = vl.getRange(filtered.length);

  function addSelected() {
    if (!selectedId) return;
    props.onAdd({ source: "compendium", itemId: selectedId, qty });
  }

  if (props.isOpen && createMode) {
    return (
      <ItemFormModal
        item={null}
        createOnly
        request={api}
        onClose={() => setCreateMode(false)}
        onSaved={(id) => {
          setCreateMode(false);
          refresh();
          if (id) props.onAdd({ source: "compendium", itemId: id, qty: 1 });
        }}
      />
    );
  }

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title={translateUi("Add items")} width={960}>
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 12, height: 560 }}>
        <ItemPickerBrowsePanel
          createMode={createMode}
          loading={loading}
          q={q}
          rarity={rarity}
          rarityOptions={rarityOptions}
          type={type}
          typeOptions={typeOptions}
          magicFilter={magicFilter}
          rows={rows}
          totalCount={totalCount}
          filtered={filtered}
          selectedId={selectedId}
          rowHeight={ROW_HEIGHT}
          padTop={padTop}
          padBottom={padBottom}
          start={start}
          end={end}
          scrollRef={vl.scrollRef}
          onScroll={onScroll}
          onToggleCreateMode={() => {
            setCreateMode((value) => !value);
            setSelectedId(null);
          }}
          onQChange={setQ}
          onRarityChange={setRarity}
          onTypeChange={setType}
          onMagicFilterChange={setMagicFilter}
          onSelect={(id) => {
            setSelectedId(id);
            setCreateMode(false);
          }}
        />

        <ItemPickerDetailPanel
          detail={detail}
          qty={qty}
          canAddCompendium={Boolean(selectedId)}
          onClose={props.onClose}
          onQtyChange={setQty}
          onAddCompendium={addSelected}
        />
      </div>
    </Modal>
  );
}
