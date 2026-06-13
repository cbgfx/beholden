import { C } from "@/lib/theme";
import { subLabelStyle } from "@/views/character/CharacterInventoryPanelHelpers";
import { PartyStashItemRow, type PartyStashItem } from "@/views/character/CharacterInventoryPanelRows";

const emptyContainerStyle = {
  padding: "8px 10px",
  border: "1px dashed rgba(255,255,255,0.08)",
  borderRadius: 10,
  color: C.muted,
  fontSize: "var(--fs-small)",
  background: "rgba(255,255,255,0.02)",
};

interface InventoryPartyStashSectionProps {
  stashItems: PartyStashItem[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onTake: (item: PartyStashItem) => void;
  onDelete: (id: string) => void;
  onQuantity: (id: string, quantity: number) => void;
}

export function InventoryPartyStashSection({
  stashItems,
  collapsed,
  onToggleCollapsed,
  onTake,
  onDelete,
  onQuantity,
}: InventoryPartyStashSectionProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        onClick={onToggleCollapsed}
        style={{ ...subLabelStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
      >
        <span
          aria-hidden="true"
          style={{
            color: C.muted,
            fontSize: "var(--fs-tiny)",
            lineHeight: 1,
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 120ms ease",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 10,
            flexShrink: 0,
          }}
        >▼</span>
        Party Stash
        <span style={{ fontWeight: 400, color: C.muted, textTransform: "none", letterSpacing: 0, fontSize: "var(--fs-tiny)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>— shared</span>
      </div>
      {!collapsed && (stashItems.length === 0 ? (
        <div style={emptyContainerStyle}>
          Empty. Move an item here to share it with the party.
        </div>
      ) : (
        stashItems.map((it) => (
          <PartyStashItemRow
            key={it.id}
            item={it}
            onTake={() => onTake(it)}
            onDelete={() => onDelete(it.id)}
            onQuantity={(q) => onQuantity(it.id, q)}
          />
        ))
      ))}
    </div>
  );
}
