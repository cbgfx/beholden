import React from "react";
import { Modal } from "@/components/overlay/Modal";
import { useItemPicker } from "./useItemPicker";
import { ItemPickerBrowsePanel, ItemPickerDetailPanel } from "./ItemPickerModalSections";

export type AddItemPayload =
  | { source: "compendium"; itemId: string; qty: number }
  | {
      source: "custom";
      qty: number;
      custom: {
        name: string;
        rarity: string | null;
        type: string | null;
        attunement: boolean;
        magic: boolean;
        text: string;
      };
    };

export function ItemPickerModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (payload: AddItemPayload) => void;
}) {
  const {
    rows,
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
    ROW_HEIGHT,
  } = useItemPicker(props.isOpen);

  const [qty, setQty] = React.useState(1);
  const [createMode, setCreateMode] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [customRarity, setCustomRarity] = React.useState("");
  const [customType, setCustomType] = React.useState("");
  const [customAttune, setCustomAttune] = React.useState(false);
  const [customMagic, setCustomMagic] = React.useState(false);
  const [customText, setCustomText] = React.useState("");

  React.useEffect(() => {
    if (props.isOpen) return;
    setQty(1);
    setCreateMode(false);
    setCustomName("");
    setCustomRarity("");
    setCustomType("");
    setCustomAttune(false);
    setCustomMagic(false);
    setCustomText("");
  }, [props.isOpen]);

  const { start, end, padTop, padBottom } = vl.getRange(filtered.length);

  function addSelected() {
    if (!selectedId) return;
    props.onAdd({ source: "compendium", itemId: selectedId, qty });
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    props.onAdd({
      source: "custom",
      qty,
      custom: {
        name,
        rarity: customRarity.trim() || null,
        type: customType.trim() || null,
        attunement: customAttune,
        magic: customMagic,
        text: customText,
      },
    });
  }

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="Add items" width={960}>
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
          filtered={filtered}
          selectedId={selectedId}
          rowHeight={ROW_HEIGHT}
          padTop={padTop}
          padBottom={padBottom}
          start={start}
          end={end}
          scrollRef={vl.scrollRef}
          onScroll={vl.onScroll}
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
          createMode={createMode}
          detail={detail}
          qty={qty}
          customName={customName}
          customRarity={customRarity}
          customType={customType}
          customAttune={customAttune}
          customMagic={customMagic}
          customText={customText}
          canAddCompendium={Boolean(selectedId)}
          canAddCustom={Boolean(customName.trim())}
          onClose={props.onClose}
          onQtyChange={setQty}
          onAddCompendium={addSelected}
          onAddCustom={addCustom}
          onCustomNameChange={setCustomName}
          onCustomRarityChange={setCustomRarity}
          onCustomTypeChange={setCustomType}
          onCustomAttuneChange={setCustomAttune}
          onCustomMagicChange={setCustomMagic}
          onCustomTextChange={setCustomText}
        />
      </div>
    </Modal>
  );
}
