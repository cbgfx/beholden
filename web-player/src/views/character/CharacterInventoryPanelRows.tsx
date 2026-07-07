import type React from "react";
import { useState } from "react";
import { C } from "@/lib/theme";
import { titleCase } from "@/lib/format/titleCase";
import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import { CollectionRow, QuantityStepper, StatCard, Tag } from "@beholden/shared/ui";
import type { InventoryItem } from "@/views/character/CharacterInventory";
import {
  canEquipOffhand,
  getEquipState,
  getWeaponMasteryName,
  hasArmorProficiency,
  hasStealthDisadvantage,
  hasWeaponMastery,
  isArmorItem,
  isRangedWeapon,
  isShieldItem,
  isWearableItem,
  isWeaponItem,
  parseWeaponMastery,
  requiresTwoHands,
} from "@/views/character/CharacterInventory";
import { inventoryEquipBtn, inventoryRarityColor } from "@/views/character/CharacterViewParts";

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
  source?: "compendium" | "custom" | null;
  itemId?: string | null;
  description?: string | null;
}

export function PartyStashItemRow({ item, onTake, onDelete, onQuantity }: {
  item: PartyStashItem;
  onTake: () => void;
  onDelete: () => void;
  onQuantity: (q: number) => void;
}) {
  return (
    <div className="character-inventory-row">
      <CollectionRow
        padding="4px 2px"
        main={(
          <>
            <div style={{ fontSize: "var(--fs-medium)", fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
            {item.notes ? <div style={{ fontSize: "var(--fs-small)", color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.notes}</div> : null}
          </>
        )}
        trailing={(
          <>
            <QuantityStepper
              value={item.quantity}
              onDecrement={() => item.quantity > 1 && onQuantity(item.quantity - 1)}
              decrementDisabled={item.quantity <= 1}
              onIncrement={() => onQuantity(item.quantity + 1)}
              buttonClassName="character-row-action"
              theme={{
                buttonBorder: C.panelBorder,
                buttonColor: C.text,
                valueColor: C.text,
                borderRadius: 5,
                fontSize: 13,
              }}
            />
            <button className="character-row-action" onClick={onTake} title="Take - moves item to your backpack" style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${C.panelBorder}`, borderRadius: 6, color: C.text, cursor: "pointer", fontSize: "var(--fs-tiny)", fontWeight: 700, padding: "3px 8px", flexShrink: 0 }}>Take</button>
            <button className="character-row-action" onClick={onDelete} title="Remove from stash" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(248,113,113,0.5)", fontSize: 16, padding: "0 2px", flexShrink: 0, lineHeight: 1 }}>x</button>
          </>
        )}
      />
    </div>
  );
}

export function ItemRow({ item, accentColor, charData, parsedFeatureEffects, expanded, onToggleExpanded, onCycleMain, onToggleOffhand, onToggleWorn, onRemove, onQty, ammoItems = [], onLinkAmmo }: {
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
  ammoItems?: InventoryItem[];
  onLinkAmmo?: (weaponId: string, ammoId: string | null) => void;
}) {
  const [ammoOpen, setAmmoOpen] = useState(false);
  const state = getEquipState(item);
  const isWeapon = isWeaponItem(item);
  const isArmor = isArmorItem(item);
  const isWearable = isWearableItem(item);
  const offhandAllowed = canEquipOffhand(item, parsedFeatureEffects);
  const mainActive = state === "mainhand-1h" || state === "mainhand-2h";
  const mainLabel = requiresTwoHands(item) ? "2H" : state === "mainhand-2h" ? "2H" : "1H";
  const equipped = state !== "backpack";
  const canEquipItem = isWeapon || isArmor || isWearable || offhandAllowed;
  const lacksArmorProficiency = equipped && (isArmor || isShieldItem(item)) && !hasArmorProficiency(item, charData?.proficiencies as never);
  const mastery = isWeapon ? parseWeaponMastery(item) : null;
  const mastered = isWeapon && hasWeaponMastery(item, charData?.proficiencies as never);
  const masteryName = mastered ? (mastery?.name ?? getWeaponMasteryName(item)) : null;
  const meta = [item.type ?? null, item.attunement ? "Attunement" : null].filter(Boolean).join(" • ");
  const showAmmoControl = isWeapon && equipped && isRangedWeapon(item) && Boolean(onLinkAmmo);
  const linkedAmmo = item.linkedAmmoId ? ammoItems.find((entry) => entry.id === item.linkedAmmoId) ?? null : null;

  const equipControls = isWeapon ? (
    <>
      <button onClick={() => onCycleMain(item.id)} title="Cycle main hand" style={inventoryEquipBtn(mainActive, accentColor)}>{mainLabel}</button>
      {offhandAllowed ? <button onClick={() => onToggleOffhand(item.id)} title={state === "offhand" ? "Unequip offhand" : "Equip to offhand"} style={inventoryEquipBtn(state === "offhand", accentColor)}>OH</button> : null}
      {showAmmoControl ? <button onClick={() => setAmmoOpen((prev) => !prev)} title="Ammunition" style={inventoryEquipBtn(ammoOpen || Boolean(linkedAmmo), accentColor)}>A</button> : null}
    </>
  ) : isArmor || isWearable ? (
    <button onClick={() => onToggleWorn(item.id)} title={state === "worn" ? "Unequip" : "Equip"} style={inventoryEquipBtn(state === "worn", accentColor)}>EQ</button>
  ) : offhandAllowed ? (
    <button onClick={() => onToggleOffhand(item.id)} title={state === "offhand" ? "Unequip offhand" : "Equip to offhand"} style={inventoryEquipBtn(state === "offhand", accentColor)}>OH</button>
  ) : null;

  return (
    <div className="character-inventory-row">
      <CollectionRow
      main={(
        <button type="button" onClick={() => onToggleExpanded(item.id)} style={{ width: "100%", minWidth: 0, background: expanded ? "rgba(255,255,255,0.05)" : "transparent", border: expanded ? `1px solid ${accentColor}33` : "1px solid transparent", borderRadius: 8, padding: "3px 8px", textAlign: "left", cursor: "pointer" }}>
          <div style={{ fontSize: "var(--fs-medium)", color: C.text, fontWeight: equipped ? 600 : 400, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {item.rarity ? <RarityDot rarity={item.rarity} /> : null}
            {item.name}
            {item.magic ? <Tag label="Magic" color={C.colorMagic} /> : null}
            {item.attuned ? <StatusBadge title="Currently attuned" border="rgba(56,189,248,0.55)" bg="rgba(56,189,248,0.14)" color="#38bdf8">A</StatusBadge> : null}
            {linkedAmmo ? <StatusBadge title={`Loaded ammunition: ${linkedAmmo.name}`} border="rgba(52,211,153,0.45)" bg="rgba(52,211,153,0.14)" color="#34d399">{linkedAmmo.name}</StatusBadge> : null}
            {masteryName ? <StatusBadge title={mastery ? mastery.text : `Weapon Mastery: ${masteryName}`} border="rgba(251,191,36,0.45)" bg="rgba(251,191,36,0.14)" color={C.colorGold}>{masteryName}</StatusBadge> : null}
            {hasStealthDisadvantage(item) ? <StatusBadge title="Disadvantage on Stealth checks" border="rgba(248,113,113,0.55)" bg="rgba(248,113,113,0.14)" color={C.colorPinkRed}>D</StatusBadge> : null}
            {lacksArmorProficiency ? <StatusBadge title="Disadvantage from wearing armor or a shield without proficiency" border="rgba(248,113,113,0.55)" bg="rgba(248,113,113,0.14)" color={C.colorPinkRed}>D</StatusBadge> : null}
          </div>
          {meta ? <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginTop: 2 }}>{meta}</div> : null}
          {lacksArmorProficiency ? <div style={{ fontSize: "var(--fs-tiny)", color: C.colorPinkRed, marginTop: 2, fontWeight: 700 }}>Not proficient: AC applies, but STR/DEX rolls have disadvantage and spellcasting is blocked.</div> : null}
          {item.notes ? <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginTop: 4 }}>{item.notes}</div> : null}
        </button>
      )}
      trailing={(
        <>
          {equipControls}
          <QuantityStepper
            value={item.quantity > 1 ? item.quantity : null}
            valuePrefix="x"
            onDecrement={item.quantity > 1 ? () => onQty(item.id, -1) : undefined}
            onIncrement={canEquipItem ? undefined : () => onQty(item.id, 1)}
            buttonClassName="character-row-action"
          />
          <button className="character-row-action" onClick={() => onRemove(item.id)} title="Remove" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.22)", cursor: "pointer", fontSize: "var(--fs-body)", padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>x</button>
        </>
      )}
      padding="4px 2px"
      />
      {showAmmoControl && ammoOpen ? (
        <div style={{ marginLeft: 22, marginTop: 2, marginBottom: 4, display: "flex", flexDirection: "column", gap: 2, borderLeft: `2px solid ${accentColor}33`, paddingLeft: 8 }}>
          {ammoItems.length === 0 ? (
            <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, padding: "3px 0" }}>No ammunition in inventory</div>
          ) : ammoItems.map((ammo) => {
            const active = item.linkedAmmoId === ammo.id;
            const outOfStock = ammo.quantity <= 0;
            const disabled = outOfStock && !active;
            return (
              <div key={ammo.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "3px 6px", borderRadius: 6, background: active ? `${accentColor}14` : "transparent" }}>
                <span style={{ fontSize: "var(--fs-small)", color: outOfStock ? C.muted : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ammo.name}{ammo.quantity === 1 ? "" : ` x${ammo.quantity}`}
                </span>
                <button
                  onClick={() => { if (!disabled) onLinkAmmo?.(item.id, active ? null : ammo.id); }}
                  disabled={disabled}
                  title={disabled ? "No ammunition remaining" : active ? "Unequip ammunition" : "Equip ammunition"}
                  style={{ ...inventoryEquipBtn(active, accentColor), ...(disabled ? { opacity: 0.4, cursor: "not-allowed" } : null) }}
                >
                  EQ
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function InventoryStat({ label, value }: { label: string; value: string }) {
  return <StatCard label={label} value={value} theme={{ borderColor: C.panelBorder, background: "rgba(255,255,255,0.035)", mutedColor: C.muted, textColor: C.text }} />;
}

function StatusBadge({ children, title, border, bg, color }: { children: React.ReactNode; title: string; border: string; bg: string; color: string }) {
  return <span title={title} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, borderRadius: 999, border: `1px solid ${border}`, background: bg, color, fontSize: "var(--fs-small)", fontWeight: 800, lineHeight: 1, padding: "0 6px" }}>{children}</span>;
}

function RarityDot({ rarity }: { rarity: string | null }) {
  return <span title={rarity ? titleCase(rarity) : undefined} style={{ width: 8, height: 8, borderRadius: 999, background: inventoryRarityColor(rarity), display: "inline-block", flexShrink: 0 }} />;
}
