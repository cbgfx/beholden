import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import { C } from "@/lib/theme";
import { DraggableList } from "@/ui/DraggableList";
import {
  formatWeight,
  getEquipState,
  isCurrencyItem,
  type CharacterDataLike,
  type InventoryContainer,
  type InventoryItem,
} from "@/views/character/CharacterInventory";
import { InventoryContainerSection } from "@/views/character/CharacterInventoryContainerSection";
import { InventoryCurrencyBar } from "@/views/character/CharacterInventoryCurrencyBar";
import { deriveInventoryDisplayState } from "@/views/character/CharacterInventoryDerived";
import { InventoryItemDrawer } from "@/views/character/CharacterInventoryDrawer";
import {
  DEFAULT_CONTAINER_ID,
  PARTY_STASH_CONTAINER_ID,
  normalizeContainers,
  subLabelStyle,
} from "@/views/character/CharacterInventoryPanelHelpers";
import { ItemRow } from "@/views/character/CharacterInventoryPanelRows";
import { InventoryPartyStashSection } from "@/views/character/CharacterInventoryPartyStashSection";
import { InventoryItemPickerModal } from "@/views/character/CharacterInventoryPickerModal";
import { CollapsiblePanel, panelHeaderAddBtn } from "@/views/character/CharacterViewParts";
import { useCharacterInventoryContainers } from "@/views/character/useCharacterInventoryContainers";
import { useCharacterInventoryItems } from "@/views/character/useCharacterInventoryItems";
import { useCharacterInventorySync } from "@/views/character/useCharacterInventorySync";

type InventoryPanelCharacterData = CharacterDataLike & {
  inventory?: InventoryItem[];
  inventoryContainers?: InventoryContainer[];
};

export function InventoryPanel({
  char,
  charData,
  parsedFeatureEffects,
  accentColor,
  campaignId,
  onSave,
}: {
  char: { strScore: number | null };
  charData: InventoryPanelCharacterData | null;
  parsedFeatureEffects?: ParsedFeatureEffects[] | null;
  accentColor: string;
  campaignId?: string | null;
  onSave: (data: { inventory: InventoryItem[]; inventoryContainers: InventoryContainer[] }) => Promise<unknown>;
}) {
  const sync = useCharacterInventorySync({
    inventory: charData?.inventory,
    inventoryContainers: charData?.inventoryContainers,
    campaignId,
    onSave,
  });
  const containerActions = useCharacterInventoryContainers({ sync, campaignId, onSave });
  const itemActions = useCharacterInventoryItems({
    sync,
    containers: containerActions,
    campaignId,
    parsedFeatureEffects,
  });
  const derived = deriveInventoryDisplayState({
    items: sync.items,
    containers: sync.containers,
    strengthScore: char.strScore,
    selectedItemId: sync.expandedItemId,
  });

  const myRemainingCapacity = char.strScore !== null
    ? Math.max(0, char.strScore * 15 - derived.carriedWeight)
    : null;
  const partyCapacityLbs =
    myRemainingCapacity !== null || sync.otherMembersCapacityLbs !== null
      ? (myRemainingCapacity ?? 0) + (sync.otherMembersCapacityLbs ?? 0)
      : null;

  const stashWeight = sync.partyStashItems.reduce((sum, item) => sum + (item.weight ?? 0) * item.quantity, 0);
  const stashWeightLabel = partyCapacityLbs !== null
    ? `${formatWeight(stashWeight)} / ${formatWeight(partyCapacityLbs)} lb`
    : `${formatWeight(stashWeight)} lb`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <CollapsiblePanel
        title={<>Inventory{sync.saving && <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginLeft: 6, fontWeight: 400, textTransform: "none" }}>saving…</span>}</>}
        color={accentColor}
        storageKey="inventory"
        summary={`${sync.items.length} items · ${Math.round(derived.carriedWeight * 10) / 10} / ${derived.carryCapacity} lb`}
        actions={<button type="button" onClick={() => sync.setPickerOpen(true)} title="Add item" style={panelHeaderAddBtn(accentColor)}>+</button>}
      >
        <InventoryCurrencyBar
          currencyTotals={derived.currencyTotals}
          carriedWeight={derived.carriedWeight}
          carryCapacity={derived.carryCapacity}
          overCapacity={derived.overCapacity}
          accentColor={accentColor}
          onSaveCurrency={itemActions.saveCurrencyAmount}
        />

        {derived.equipped.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={subLabelStyle}>Equipped</div>
            <DraggableList
              items={derived.equipped.map((item) => ({ id: item.id }))}
              onReorder={(ids) => void itemActions.reorderItemsByIds(ids, (item) => getEquipState(item) !== "backpack")}
              renderItem={({ id }) => {
                const item = derived.equipped.find((entry) => entry.id === id);
                return item ? (
                  <ItemRow
                    item={item}
                    accentColor={accentColor}
                    charData={charData}
                    parsedFeatureEffects={parsedFeatureEffects}
                    expanded={sync.expandedItemId === item.id}
                    onToggleExpanded={itemActions.toggleExpandedItem}
                    onCycleMain={itemActions.cycleMainHand}
                    onToggleOffhand={itemActions.toggleOffhand}
                    onToggleWorn={itemActions.toggleWorn}
                    onRemove={itemActions.removeItem}
                    onQty={itemActions.changeQty}
                  />
                ) : null;
              }}
            />
          </div>
        )}

        {sync.containers.map((container) => {
          const containerItems = derived.itemsByContainer.get(container.id) ?? [];
          const isDefault = container.id === DEFAULT_CONTAINER_ID;
          return (
            <InventoryContainerSection
              key={container.id}
              container={container}
              containerItems={containerItems}
              isDefault={isDefault}
              isCollapsed={sync.collapsedContainerIds.includes(container.id)}
              accentColor={accentColor}
              charData={charData}
              parsedFeatureEffects={parsedFeatureEffects}
              expandedItemId={sync.expandedItemId}
              onToggleCollapsed={() => itemActions.toggleContainerCollapsed(container.id)}
              onNameChange={(name) => sync.setContainers((previous) => previous.map((entry) => entry.id === container.id ? { ...entry, name } : entry))}
              onRename={(name) => containerActions.renameContainer(container.id, name)}
              onResetName={() => sync.setContainers(normalizeContainers(charData?.inventoryContainers ?? sync.containers))}
              onToggleIgnoreWeight={() => containerActions.toggleContainerIgnoreWeight(container.id)}
              onRemove={!isDefault ? () => containerActions.removeContainer(container.id) : undefined}
              onAdd={() => containerActions.addContainer(container.id)}
              onReorder={(ids) => void itemActions.reorderItemsByIds(ids, (item) => {
                if (getEquipState(item) !== "backpack" || isCurrencyItem(item)) return false;
                const itemContainerId = item.containerId
                  && sync.containers.some((entry) => entry.id === item.containerId)
                  ? item.containerId
                  : DEFAULT_CONTAINER_ID;
                return itemContainerId === container.id;
              })}
              onToggleExpandedItem={itemActions.toggleExpandedItem}
              onCycleMain={itemActions.cycleMainHand}
              onToggleOffhand={itemActions.toggleOffhand}
              onToggleWorn={itemActions.toggleWorn}
              onRemoveItem={itemActions.removeItem}
              onQty={itemActions.changeQty}
            />
          );
        })}

        <InventoryItemPickerModal
          isOpen={sync.pickerOpen}
          accentColor={accentColor}
          onClose={() => sync.setPickerOpen(false)}
          onAdd={containerActions.addItem}
        />
        {derived.selectedItem && (
          <InventoryItemDrawer
            item={derived.selectedItem}
            containers={campaignId
              ? [...sync.containers, { id: PARTY_STASH_CONTAINER_ID, name: "Party Stash", ignoreWeight: true }]
              : sync.containers}
            detail={sync.expandedDetail}
            busy={sync.expandedBusy}
            accentColor={accentColor}
            otherAttunedCount={derived.otherAttunedCount}
            editMode={sync.itemEditMode}
            onStartEdit={() => sync.setItemEditMode(true)}
            onCancelEdit={() => sync.setItemEditMode(false)}
            onClose={() => sync.setExpandedItemId(null)}
            onSave={async (patch) => {
              await itemActions.saveItemEdits(derived.selectedItem!.id, patch);
              sync.setItemEditMode(false);
            }}
            onMoveToContainer={(containerId) => containerActions.moveItemToContainer(derived.selectedItem!.id, containerId)}
            onChargesChange={(charges) => itemActions.saveItemEdits(derived.selectedItem!.id, { charges })}
          />
        )}
      </CollapsiblePanel>

      {campaignId && (
        <CollapsiblePanel
          title="Party Stash"
          color={accentColor}
          storageKey="party-stash"
          summary={stashWeightLabel}
        >
          <InventoryPartyStashSection
            stashItems={sync.partyStashItems}
            stashWeight={stashWeight}
            partyCapacityLbs={partyCapacityLbs}
            currency={sync.partyCurrency}
            campaignId={campaignId}
            onTake={(item) => void itemActions.takeFromPartyStash(item)}
            onDelete={(id) => void itemActions.deleteFromPartyStash(id)}
            onQuantity={(id, quantity) => void itemActions.changePartyStashQty(id, quantity)}
            onCurrencyChange={(patch) => {
              sync.setPartyCurrency((prev) => ({ ...prev, ...patch }));
            }}
          />
        </CollapsiblePanel>
      )}
    </div>
  );
}
