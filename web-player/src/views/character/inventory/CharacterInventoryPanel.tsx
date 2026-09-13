import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import { C } from "@/lib/theme";
import { IconKnapsack } from "@/icons";
import { Button } from "@/ui/Button";
import { DraggableList } from "@/ui/DraggableList";
import {
  formatWeight,
  getEquipState,
  hasItemProperty,
  hasWeaponProficiency,
  isAmmunitionItem,
  isCurrencyItem,
  isWeaponItem,
  type CharacterDataLike,
  type InventoryContainer,
  type InventoryItem,
} from "@/views/character/inventory/CharacterInventory";
import { InventoryContainerSection } from "@/views/character/inventory/CharacterInventoryContainerSection";
import { InventoryCurrencyBar } from "@/views/character/inventory/CharacterInventoryCurrencyBar";
import { deriveInventoryDisplayState } from "@/views/character/inventory/CharacterInventoryDerived";
import { InventoryItemDrawer } from "@/views/character/inventory/CharacterInventoryDrawer";
import {
  DEFAULT_CONTAINER_ID,
  PARTY_STASH_CONTAINER_ID,
  normalizeContainers,
  subLabelStyle,
} from "@/views/character/inventory/CharacterInventoryPanelHelpers";
import { ItemRow, type PartyStashItem } from "@/views/character/inventory/CharacterInventoryPanelRows";
import { InventoryPartyStashSection } from "@/views/character/inventory/CharacterInventoryPartyStashSection";
import { InventoryItemPickerModal } from "@/views/character/inventory/CharacterInventoryPickerModal";
import { resolvePactBoonFromChosenOptionals } from "@/views/character/CharacterSheetUtils";
import { CollapsiblePanel } from "@/views/character/CharacterViewParts";
import { PANEL_IDS } from "@/views/character/layout/panelRegistry";
import { useCharacterInventoryContainers } from "@/views/character/inventory/useCharacterInventoryContainers";
import { useCharacterInventoryItems } from "@/views/character/inventory/useCharacterInventoryItems";
import { useCharacterInventorySync } from "@/views/character/inventory/useCharacterInventorySync";
import type { ProficiencyMap } from "@/views/character/CharacterSheetTypes";

type InventoryPanelCharacterData = CharacterDataLike & {
  classes?: Array<{ className?: string | null; subclass?: string | null }>;
  chosenOptionals?: string[];
  inventory?: InventoryItem[];
  inventoryContainers?: InventoryContainer[];
};

export function InventoryPanel({
  char,
  charData,
  characterId,
  inventoryRev,
  onReload,
  proficiencies,
  parsedFeatureEffects,
  accentColor,
  campaignId,
  onSave,
}: {
  char: { strScore: number | null; chaScore: number | null; ruleset?: "5e" | "5.5e" };
  charData: InventoryPanelCharacterData | null;
  characterId?: string | null;
  inventoryRev?: string;
  onReload: () => Promise<void>;
  proficiencies?: ProficiencyMap;
  parsedFeatureEffects?: ParsedFeatureEffects[] | null;
  accentColor: string;
  campaignId?: string | null;
  onSave: (
    data: { inventory: InventoryItem[]; inventoryContainers: InventoryContainer[] },
    opts?: { expectedInventoryRev?: string },
  ) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [selectedStashItem, setSelectedStashItem] = useState<PartyStashItem | null>(null);
  const sync = useCharacterInventorySync({
    inventoryRev,
    inventory: charData?.inventory,
    inventoryContainers: charData?.inventoryContainers,
    campaignId,
    onSave,
  });
  const containerActions = useCharacterInventoryContainers({ sync, campaignId, characterId, inventoryRev, onSave, onReload });
  const itemActions = useCharacterInventoryItems({
    sync,
    containers: containerActions,
    campaignId,
    characterId,
    parsedFeatureEffects,
  });
  const derived = deriveInventoryDisplayState({
    items: sync.items,
    containers: sync.containers,
    strengthScore: char.strScore,
    selectedItemId: sync.expandedItemId,
  });

  // Row buttons and drag/reorder fire inventory saves and drop the promise.
  // `persist` rethrows non-conflict failures (so editors stay open); wrap the
  // fire-and-forget callers here so a failed equip/quantity/reorder is visible
  // and never an unhandled rejection.
  const [rowError, setRowError] = useState<string | null>(null);
  const runRow = <A extends unknown[]>(fn: (...args: A) => unknown) => (...args: A): Promise<void> => {
    setRowError(null);
    return Promise.resolve(fn(...args)).then(() => undefined).catch((cause) => {
      setRowError(cause instanceof Error ? cause.message : t("characterInventoryPanel.rowSaveError"));
    });
  };
  const rowActions = {
    cycleMainHand: runRow(itemActions.cycleMainHand),
    toggleOffhand: runRow(itemActions.toggleOffhand),
    toggleWorn: runRow(itemActions.toggleWorn),
    removeItem: runRow(itemActions.removeItem),
    changeQty: runRow(itemActions.changeQty),
    linkAmmo: runRow(itemActions.linkAmmo),
    reorderItemsByIds: runRow(itemActions.reorderItemsByIds),
  };

  const partyCapacityLbs = sync.partyCapacityLbs;

  const ammoItems = sync.items.filter(isAmmunitionItem);
  const hasHexWarrior = (charData?.classes ?? []).some((entry) => /hexblade/i.test(String(entry.subclass ?? "")));
  const hasPactBlade = resolvePactBoonFromChosenOptionals(charData?.chosenOptionals) === "blade";

  const stashWeight = sync.partyStashItems.reduce((sum, item) => sum + (item.weight ?? 0) * item.quantity, 0);
  const weightUnit = t("units.lb", { ns: "shared" });
  const stashWeightLabel = partyCapacityLbs !== null
    ? t("characterInventoryPanel.stashWeightWithCapacity", { weight: formatWeight(stashWeight), capacity: formatWeight(partyCapacityLbs), unit: weightUnit })
    : t("characterInventoryPanel.stashWeightOnly", { weight: formatWeight(stashWeight), unit: weightUnit });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <CollapsiblePanel
        title={<>{t("characterInventoryPanel.title")}{sync.saving && <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginLeft: 6, fontWeight: 400, textTransform: "none" }}>{t("characterInventoryPanel.saving")}</span>}</>}
        color={accentColor}
        storageKey={PANEL_IDS.inventory}
        summary={t("characterInventoryPanel.summaryLine", { count: sync.items.length, carried: Math.round(derived.carriedWeight * 10) / 10, capacity: derived.carryCapacity, unit: weightUnit })}
      >
        {sync.conflict || rowError ? (
          <div role="alert" style={{ color: C.red, fontSize: "var(--fs-small)", padding: "0 2px 10px", marginBottom: 10, borderBottom: `1px solid ${C.panelBorder}` }}>
            {sync.conflict ?? rowError}
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${C.panelBorder}` }}>
          <Button
            type="button"
            variant="primary"
            onClick={() => { void containerActions.addContainer(DEFAULT_CONTAINER_ID); }}
            title="+"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", fontSize: "var(--fs-small)" }}
          >
            <span aria-hidden="true" style={{ fontSize: "var(--fs-title)" }}>+</span><IconKnapsack size={15} />
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => sync.setPickerOpen(true)}
            title={t("characterInventoryPanel.addItemTitle")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", fontSize: "var(--fs-small)" }}
          >
            <span aria-hidden="true" style={{ fontSize: "var(--fs-title)" }}>+</span>
            {t("characterInventoryPanel.addItemButtonLabel")}
          </Button>
        </div>

        <InventoryCurrencyBar
          currencyTotals={derived.currencyTotals}
          carriedWeight={derived.carriedWeight}
          carryCapacity={derived.carryCapacity}
          overCapacity={derived.overCapacity}
          accentColor={accentColor}
          onSaveCurrency={runRow(itemActions.saveCurrencyAmount)}
        />

        {derived.equipped.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={subLabelStyle}>{t("characterInventoryPanel.equippedLabel")}</div>
            <DraggableList
              items={derived.equipped.map((item) => ({ id: item.id }))}
              onReorder={(ids) => rowActions.reorderItemsByIds(ids, (item: InventoryItem) => getEquipState(item) !== "backpack")}
              renderItem={({ id }) => {
                const item = derived.equipped.find((entry) => entry.id === id);
                return item ? (
                  <ItemRow
                    item={item}
                    accentColor={accentColor}
                    proficiencies={proficiencies}
                    parsedFeatureEffects={parsedFeatureEffects}
                    ruleset={char.ruleset}
                    expanded={sync.expandedItemId === item.id}
                    onToggleExpanded={itemActions.toggleExpandedItem}
                    onCycleMain={rowActions.cycleMainHand}
                    onToggleOffhand={rowActions.toggleOffhand}
                    onToggleWorn={rowActions.toggleWorn}
                    onRemove={rowActions.removeItem}
                    onQty={rowActions.changeQty}
                    ammoItems={ammoItems}
                    onLinkAmmo={rowActions.linkAmmo}
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
              proficiencies={proficiencies}
              parsedFeatureEffects={parsedFeatureEffects}
              ruleset={char.ruleset}
              expandedItemId={sync.expandedItemId}
              onToggleCollapsed={() => itemActions.toggleContainerCollapsed(container.id)}
              onNameChange={(name) => sync.setContainers((previous) => previous.map((entry) => entry.id === container.id ? { ...entry, name } : entry))}
              onRename={(name) => containerActions.renameContainer(container.id, name)}
              onResetName={() => sync.setContainers(normalizeContainers(charData?.inventoryContainers ?? sync.containers, undefined, { backpack: t("characterInventoryPanel.defaultContainerName"), container: t("characterInventoryPanel.genericContainerName") }))}
              onToggleIgnoreWeight={() => containerActions.toggleContainerIgnoreWeight(container.id)}
              onRemove={!isDefault ? () => containerActions.removeContainer(container.id) : undefined}
              onReorder={(ids) => rowActions.reorderItemsByIds(ids, (item: InventoryItem) => {
                if (getEquipState(item) !== "backpack" || isCurrencyItem(item)) return false;
                const itemContainerId = item.containerId
                  && sync.containers.some((entry) => entry.id === item.containerId)
                  ? item.containerId
                  : DEFAULT_CONTAINER_ID;
                return itemContainerId === container.id;
              })}
              onToggleExpandedItem={itemActions.toggleExpandedItem}
              onCycleMain={rowActions.cycleMainHand}
              onToggleOffhand={rowActions.toggleOffhand}
              onToggleWorn={rowActions.toggleWorn}
              onRemoveItem={rowActions.removeItem}
              onQty={rowActions.changeQty}
              ammoItems={ammoItems}
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
              ? [...sync.containers, { id: PARTY_STASH_CONTAINER_ID, name: t("characterInventoryPanel.partyStashTitle"), ignoreWeight: true }]
              : sync.containers}
            detail={sync.expandedDetail}
            busy={sync.expandedBusy}
            accentColor={accentColor}
            otherAttunedCount={derived.otherAttunedCount}
            editMode={sync.itemEditMode}
            canDesignatePactWeapon={isWeaponItem(derived.selectedItem) && (hasPactBlade || (hasHexWarrior && !hasItemProperty(derived.selectedItem, "2H") && !hasItemProperty(derived.selectedItem, "H") && hasWeaponProficiency(derived.selectedItem, proficiencies)))}
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
          title={t("characterInventoryPanel.partyStashTitle")}
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
            onOpen={setSelectedStashItem}
            onTake={(item) => itemActions.takeFromPartyStash(item)}
            onDelete={(id) => itemActions.deleteFromPartyStash(id)}
            onQuantity={(id, quantity) => itemActions.changePartyStashQty(id, quantity)}
            onCurrencyChange={sync.savePartyCurrency}
          />
          {selectedStashItem ? (
            <InventoryItemDrawer
              item={{
                id: selectedStashItem.id,
                name: selectedStashItem.name,
                quantity: selectedStashItem.quantity,
                equipped: false,
                equipState: "backpack",
                notes: selectedStashItem.notes,
                source: selectedStashItem.source ?? "custom",
                itemId: selectedStashItem.itemId ?? undefined,
                rarity: selectedStashItem.rarity,
                type: selectedStashItem.type,
                weight: selectedStashItem.weight,
                description: selectedStashItem.description ?? undefined,
              }}
              containers={[]}
              detail={null}
              busy={false}
              accentColor={accentColor}
              otherAttunedCount={0}
              editMode={false}
              canDesignatePactWeapon={false}
              readOnly
              subtitle={t("characterInventoryPanel.partyStashItemSubtitle")}
              showContainerControl={false}
              onStartEdit={() => {}}
              onCancelEdit={() => {}}
              onClose={() => setSelectedStashItem(null)}
              onSave={async () => {}}
              onMoveToContainer={async () => {}}
              onChargesChange={() => {}}
            />
          ) : null}
        </CollapsiblePanel>
      )}
    </div>
  );
}
