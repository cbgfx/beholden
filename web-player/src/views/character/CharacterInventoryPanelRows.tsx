import type React from "react";
import { C } from "@/lib/theme";
import { titleCase } from "@/lib/format/titleCase";
import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import type { InventoryItem } from "@/views/character/CharacterInventory";
import {
  canEquipOffhand,
  getEquipState,
  getWeaponMasteryName,
  hasArmorProficiency,
  hasStealthDisadvantage,
  hasWeaponMastery,
  isArmorItem,
  isShieldItem,
  isWearableItem,
  isWeaponItem,
  parseWeaponMastery,
  requiresTwoHands,
} from "@/views/character/CharacterInventory";
import { inventoryEquipBtn } from "@/views/character/CharacterViewParts";
import { stepperBtn } from "@/views/character/CharacterInventoryPanelHelpers";

interface InventoryPanelCharacterData {
  proficiencies?: unknown;
}

export interface PartyStashItem {
  id: string;
  name: string;
  quantity: number;
  weight: number | null;
  notes: string;
  rarity: string | null;
  type: string | null;
}

export function PartyStashItemRow({ item, onTake, onDelete, onQuantity }: {
  item: PartyStashItem;
  onTake: () => void;
  onDelete: () => void;
  onQuantity: (q: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--fs-medium)", fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
        {item.notes ? <div style={{ fontSize: "var(--fs-small)", color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.notes}</div> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        <button onClick={() => item.quantity > 1 && onQuantity(item.quantity - 1)} disabled={item.quantity <= 1} style={{ ...stashQtyBtn, opacity: item.quantity <= 1 ? 0.3 : 1 }}>-</button>
        <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.text, minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
        <button onClick={() => onQuantity(item.quantity + 1)} style={stashQtyBtn}>+</button>
      </div>
      <button onClick={onTake} title="Take - moves item to your backpack" style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${C.panelBorder}`, borderRadius: 6, color: C.text, cursor: "pointer", fontSize: "var(--fs-tiny)", fontWeight: 700, padding: "3px 8px", flexShrink: 0 }}>Take</button>
      <button onClick={onDelete} title="Remove from stash" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(248,113,113,0.5)", fontSize: 16, padding: "0 2px", flexShrink: 0, lineHeight: 1 }}>x</button>
    </div>
  );
}

export function ItemRow({ item, accentColor, charData, parsedFeatureEffects, expanded, onToggleExpanded, onCycleMain, onToggleOffhand, onToggleWorn, onRemove, onQty }: {
  item: InventoryItem;
  accentColor: string;
  charData: InventoryPanelCharacterData | null;
  parsedFeatureEffects?: ParsedFeatureEffects[] | null;
  expanded: boolean;
  onToggleExpanded: (id: string) => void;
  onCycleMain: (id: string) => void;
  onToggleOffhand: (id: string) => void;
  onToggleWorn: (id: string) => void;
  onRemove: (id: string) => void;
  onQty: (id: string, delta: number) => void;
}) {
  const state = getEquipState(item);
  const isWeapon = isWeaponItem(item);
  const isArmor = isArmorItem(item);
  const isWearable = isWearableItem(item);
  const offhandAllowed = canEquipOffhand(item, parsedFeatureEffects);
  const mainActive = state === "mainhand-1h" || state === "mainhand-2h";
  const mainLabel = requiresTwoHands(item) ? "2H" : state === "mainhand-2h" ? "2H" : "1H";
  const equipped = state !== "backpack";
  const lacksArmorProficiency = equipped && (isArmor || isShieldItem(item)) && !hasArmorProficiency(item, charData?.proficiencies as never);
  const mastery = isWeapon ? parseWeaponMastery(item) : null;
  const mastered = isWeapon && hasWeaponMastery(item, charData?.proficiencies as never);
  const masteryName = mastered ? (mastery?.name ?? getWeaponMasteryName(item)) : null;
  const meta = [item.rarity ? titleCase(item.rarity) : null, item.type ?? null, item.attunement ? "Attunement" : null, item.magic ? "Magic" : null].filter(Boolean).join(" • ");

  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px" }}>
        {isWeapon ? <button onClick={() => onCycleMain(item.id)} title="Cycle main hand" style={inventoryEquipBtn(mainActive, accentColor)}>{mainLabel}</button> : isArmor ? <button onClick={() => onToggleWorn(item.id)} title={state === "worn" ? "Unequip" : "Equip"} style={inventoryEquipBtn(state === "worn", accentColor)}>EQ</button> : isWearable ? <button onClick={() => onToggleWorn(item.id)} title={state === "worn" ? "Unequip" : "Equip"} style={inventoryEquipBtn(state === "worn", accentColor)}>EQ</button> : offhandAllowed ? <button onClick={() => onToggleOffhand(item.id)} title={state === "offhand" ? "Unequip offhand" : "Equip to offhand"} style={inventoryEquipBtn(state === "offhand", "#94a3b8")}>OH</button> : <div style={{ width: 30, flexShrink: 0 }} />}
        {isWeapon && offhandAllowed ? <button onClick={() => onToggleOffhand(item.id)} title={state === "offhand" ? "Unequip offhand" : "Equip to offhand"} style={inventoryEquipBtn(state === "offhand", "#94a3b8")}>OH</button> : null}
        <button type="button" onClick={() => onToggleExpanded(item.id)} style={{ flex: 1, minWidth: 0, background: expanded ? "rgba(255,255,255,0.05)" : "transparent", border: expanded ? `1px solid ${accentColor}33` : "1px solid transparent", borderRadius: 8, padding: "6px 8px", textAlign: "left", cursor: "pointer" }}>
          <div style={{ fontSize: "var(--fs-subtitle)", color: C.text, fontWeight: equipped ? 600 : 400, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {item.name}
            {item.attuned ? <StatusBadge title="Currently attuned" border="rgba(56,189,248,0.55)" bg="rgba(56,189,248,0.14)" color="#38bdf8">A</StatusBadge> : null}
            {masteryName ? <StatusBadge title={mastery ? mastery.text : `Weapon Mastery: ${masteryName}`} border="rgba(251,191,36,0.45)" bg="rgba(251,191,36,0.14)" color={C.colorGold}>{masteryName}</StatusBadge> : null}
            {hasStealthDisadvantage(item) ? <StatusBadge title="Disadvantage on Stealth checks" border="rgba(248,113,113,0.55)" bg="rgba(248,113,113,0.14)" color={C.colorPinkRed}>D</StatusBadge> : null}
            {lacksArmorProficiency ? <StatusBadge title="Disadvantage from wearing armor or a shield without proficiency" border="rgba(248,113,113,0.55)" bg="rgba(248,113,113,0.14)" color={C.colorPinkRed}>D</StatusBadge> : null}
          </div>
          {meta ? <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginTop: 2 }}>{meta}</div> : null}
          {lacksArmorProficiency ? <div style={{ fontSize: "var(--fs-tiny)", color: C.colorPinkRed, marginTop: 2, fontWeight: 700 }}>Not proficient: AC applies, but STR/DEX rolls have disadvantage and spellcasting is blocked.</div> : null}
          {item.notes ? <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginTop: 4 }}>{item.notes}</div> : null}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {item.quantity > 1 ? <button onClick={() => onQty(item.id, -1)} style={stepperBtn}>-</button> : null}
          {item.quantity > 1 ? <span style={{ fontSize: "var(--fs-small)", color: C.muted, minWidth: 20, textAlign: "center" }}>x{item.quantity}</span> : null}
          <button onClick={() => onQty(item.id, 1)} style={stepperBtn}>+</button>
        </div>
        <button onClick={() => onRemove(item.id)} title="Remove" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.22)", cursor: "pointer", fontSize: "var(--fs-body)", padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>x</button>
      </div>
    </div>
  );
}

export function InventoryTag({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, padding: "2px 8px", borderRadius: 999, color, border: `1px solid ${color}44`, background: `${color}18` }}>{label}</span>;
}

export function InventoryStat({ label, value }: { label: string; value: string }) {
  return <div style={{ border: `1px solid ${C.panelBorder}`, borderRadius: 10, background: "rgba(255,255,255,0.035)", padding: "8px 10px", minWidth: 0 }}><div style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, marginBottom: 4 }}>{label}</div><div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div></div>;
}

function StatusBadge({ children, title, border, bg, color }: { children: React.ReactNode; title: string; border: string; bg: string; color: string }) {
  return <span title={title} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, borderRadius: 999, border: `1px solid ${border}`, background: bg, color, fontSize: "var(--fs-small)", fontWeight: 800, lineHeight: 1, padding: "0 6px" }}>{children}</span>;
}

const stashQtyBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 5,
  color: C.text,
  cursor: "pointer",
  width: 20,
  height: 20,
  fontSize: 13,
  lineHeight: "1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  flexShrink: 0,
};
