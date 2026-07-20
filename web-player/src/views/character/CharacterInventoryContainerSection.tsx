import { C } from "@/lib/theme";
import { IconWeight } from "@/icons";
import { DraggableList } from "@/ui/DraggableList";
import { subLabelStyle, stepperBtn } from "@/views/character/CharacterInventoryPanelHelpers";
import { ItemRow } from "@/views/character/CharacterInventoryPanelRows";
import type { InventoryContainer, InventoryItem } from "@/views/character/CharacterInventory";
import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import type { ProficiencyMap } from "@/views/character/CharacterSheetTypes";

const emptyContainerStyle = {
  padding: "8px 10px",
  border: "1px dashed rgba(255,255,255,0.08)",
  borderRadius: 10,
  color: C.muted,
  fontSize: "var(--fs-small)",
  background: "rgba(255,255,255,0.02)",
};

interface InventoryContainerSectionProps {
  container: InventoryContainer;
  containerItems: InventoryItem[];
  isDefault: boolean;
  isCollapsed: boolean;
  accentColor: string;
  proficiencies?: ProficiencyMap;
  parsedFeatureEffects?: ParsedFeatureEffects[] | null;
  expandedItemId: string | null;
  onToggleCollapsed: () => void;
  onNameChange: (name: string) => void;
  onRename: (name: string) => Promise<void>;
  onResetName: () => void;
  onToggleIgnoreWeight: () => Promise<void>;
  onRemove?: () => Promise<void>;
  onAdd: () => Promise<void>;
  onReorder: (ids: string[]) => void;
  onToggleExpandedItem: (id: string) => void;
  onCycleMain: (id: string) => Promise<void>;
  onToggleOffhand: (id: string) => Promise<void>;
  onToggleWorn: (id: string) => Promise<void>;
  onRemoveItem: (id: string) => Promise<void>;
  onQty: (id: string, delta: number) => Promise<void>;
  ammoItems?: InventoryItem[];
}

export function InventoryContainerSection({
  container,
  containerItems,
  isDefault,
  isCollapsed,
  accentColor,
  proficiencies,
  parsedFeatureEffects,
  expandedItemId,
  onToggleCollapsed,
  onNameChange,
  onRename,
  onResetName,
  onToggleIgnoreWeight,
  onRemove,
  onAdd,
  onReorder,
  onToggleExpandedItem,
  onCycleMain,
  onToggleOffhand,
  onToggleWorn,
  onRemoveItem,
  onQty,
  ammoItems,
}: InventoryContainerSectionProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        onClick={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest("button, input, select, textarea, label, svg, path")) return;
          onToggleCollapsed();
        }}
        style={{ ...subLabelStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              color: C.muted,
              fontSize: "var(--fs-tiny)",
              lineHeight: 1,
              transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
              transition: "transform 120ms ease",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 10,
              flexShrink: 0,
            }}
          >
            ▼
          </span>
          <input
            value={container.name}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={(e) => { onRename(e.target.value).catch(() => onResetName()); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                onResetName();
              }
            }}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: "1px dashed rgba(255,255,255,0.12)",
              color: C.muted,
              fontSize: "var(--fs-tiny)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              minWidth: 110,
              outline: "none",
              padding: "0 0 2px",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isDefault ? (
            <button
              type="button"
              onClick={() => { void onAdd(); }}
              title="Add container"
              style={{ ...stepperBtn, width: 24, height: 24, fontSize: "var(--fs-body)" }}
            >
              +
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { void onToggleIgnoreWeight(); }}
                title={container.ignoreWeight ? "Weight ignored" : "Ignore weight"}
                style={{
                  ...stepperBtn,
                  width: 24,
                  height: 24,
                  color: container.ignoreWeight ? "rgba(255,255,255,0.2)" : C.muted,
                  transition: "color 150ms ease",
                }}
              >
                <IconWeight size={13} />
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => { void onRemove(); }}
                  title="Remove container"
                  style={{ ...stepperBtn, width: 24, height: 24, fontSize: "var(--fs-body)", color: "rgba(248,113,113,0.7)" }}
                >
                  ×
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {!isCollapsed && (containerItems.length > 0 ? (
        <DraggableList
          items={containerItems.map((item) => ({ id: item.id }))}
          onReorder={onReorder}
          renderItem={(dragItem) => {
            const it = containerItems.find((item) => item.id === dragItem.id);
            if (!it) return null;
            return (
              <ItemRow
                item={it}
                accentColor={accentColor}
                proficiencies={proficiencies}
                parsedFeatureEffects={parsedFeatureEffects}
                expanded={expandedItemId === it.id}
                onToggleExpanded={onToggleExpandedItem}
                onCycleMain={onCycleMain}
                onToggleOffhand={onToggleOffhand}
                onToggleWorn={onToggleWorn}
                onRemove={onRemoveItem}
                onQty={onQty}
                ammoItems={ammoItems}
              />
            );
          }}
        />
      ) : (
        <div style={emptyContainerStyle}>Empty.</div>
      ))}
    </div>
  );
}
