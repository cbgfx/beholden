import React, { useEffect, useState } from "react";
import { C } from "@/lib/theme";
import { titleCase } from "@/lib/format/titleCase";
import { RightDrawer } from "@/ui/RightDrawer";
import { Select } from "@/ui/Select";
import { StatCard, Tag } from "@beholden/shared/ui";
import type { CompendiumItemDetail, InventoryContainer, InventoryItem } from "@/views/character/CharacterInventory";
import {
  formatItemDamageType,
  formatItemProperties,
  getEquipState,
  isArmorItem,
  isRangedWeapon,
  isShieldItem,
  isWeaponItem,
  parseChargesMax,
  parseItemSpells,
} from "@/views/character/CharacterInventory";
import { inventoryCheckboxLabel, inventoryPickerDetailStyle, inventoryRarityColor } from "@/views/character/CharacterViewParts";
import { DEFAULT_CONTAINER_ID, inputStyle } from "@/views/character/CharacterInventoryPanelHelpers";

export function InventoryItemDrawer(props: {
  item: InventoryItem;
  containers: InventoryContainer[];
  detail: CompendiumItemDetail | null;
  busy: boolean;
  accentColor: string;
  otherAttunedCount: number;
  editMode: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onClose: () => void;
  onSave: (patch: Partial<InventoryItem>) => Promise<void>;
  onMoveToContainer: (containerId: string | null) => Promise<void>;
  onChargesChange: (charges: number) => void | Promise<void>;
}) {
  const merged = {
    name: props.item.name,
    rarity: props.item.rarity ?? props.detail?.rarity ?? "",
    type: props.item.type ?? props.detail?.type ?? "",
    attunement: props.item.attunement ?? props.detail?.attunement ?? false,
    attuned: props.item.attuned ?? false,
    magic: props.item.magic ?? props.detail?.magic ?? false,
    silvered: props.item.silvered ?? false,
    weight: props.item.weight ?? props.detail?.weight ?? null,
    value: props.item.value ?? props.detail?.value ?? null,
    ac: props.item.ac ?? props.detail?.ac ?? null,
    stealthDisadvantage: props.item.stealthDisadvantage ?? props.detail?.stealthDisadvantage ?? false,
    dmg1: props.item.dmg1 ?? props.detail?.dmg1 ?? "",
    dmg2: props.item.dmg2 ?? props.detail?.dmg2 ?? "",
    dmgType: props.item.dmgType ?? props.detail?.dmgType ?? "",
    properties: props.item.properties?.length ? props.item.properties : (props.detail?.properties ?? []),
    description: props.item.description ?? (props.detail ? (Array.isArray(props.detail.text) ? props.detail.text.join("\n\n") : props.detail.text ?? "") : ""),
  };
  const kindItem: InventoryItem = { ...props.item, type: merged.type || null, dmg1: merged.dmg1 || null, dmg2: merged.dmg2 || null, ac: merged.ac, properties: merged.properties };
  const isWeaponLike = isWeaponItem(kindItem);
  const isRangedWeaponLike = isWeaponLike && isRangedWeapon(kindItem);
  const isMeleeWeaponLike = isWeaponLike && !isRangedWeaponLike;
  const isArmorLike = isArmorItem(kindItem) || isShieldItem(kindItem);
  const [draft, setDraft] = useState(merged);

  useEffect(() => {
    setDraft(merged);
  }, [props.item.id, merged.name, merged.rarity, merged.type, merged.attunement, merged.attuned, merged.magic, merged.silvered, merged.weight, merged.value, merged.ac, merged.stealthDisadvantage, merged.dmg1, merged.dmg2, merged.dmgType, merged.description, merged.properties.join("|")]);

  const hasAnyDetails = Boolean(
    draft.rarity || draft.type || draft.description || draft.weight != null || draft.value != null ||
    (isArmorLike && draft.ac != null) || (isWeaponLike && draft.dmg1) || (isWeaponLike && draft.dmg2) ||
    (isWeaponLike && draft.dmgType) || (isWeaponLike && draft.properties.length > 0) || draft.stealthDisadvantage ||
    draft.attunement || draft.attuned || draft.magic || (isMeleeWeaponLike && draft.silvered) || (props.item.chargesMax ?? 0) > 0
  );
  const canEnableAttuned = draft.attuned || props.otherAttunedCount < 3;
  const currentContainerId = props.item.containerId ?? DEFAULT_CONTAINER_ID;

  async function handleSave() {
    await props.onSave({
      name: draft.name.trim() || props.item.name,
      rarity: draft.rarity.trim() || null,
      type: props.item.type ?? props.detail?.type ?? null,
      attunement: Boolean(draft.attunement),
      attuned: draft.attunement && canEnableAttuned ? Boolean(draft.attuned) : false,
      magic: Boolean(draft.magic),
      silvered: isMeleeWeaponLike ? Boolean(draft.silvered) : false,
      weight: draft.weight == null || Number.isNaN(draft.weight) ? null : draft.weight,
      value: draft.value == null || Number.isNaN(draft.value) ? null : draft.value,
      ac: isArmorLike && draft.ac != null && !Number.isNaN(draft.ac) ? draft.ac : null,
      stealthDisadvantage: isArmorLike ? Boolean(draft.stealthDisadvantage) : false,
      dmg1: isWeaponLike ? (draft.dmg1.trim() || null) : null,
      dmg2: isWeaponLike ? (draft.dmg2.trim() || null) : null,
      dmgType: isWeaponLike ? (draft.dmgType.trim() || null) : null,
      properties: isWeaponLike ? draft.properties.map((p) => p.trim()).filter(Boolean) : [],
      description: draft.description.trim() || undefined,
      source: "custom",
      chargesMax: props.item.chargesMax ?? parseChargesMax(draft.description.trim()) ?? null,
    });
  }

  return (
    <RightDrawer
      onClose={props.onClose}
      width="min(520px, 92vw)"
      title={
        <>
          <div style={{ fontWeight: 900, fontSize: "var(--fs-title)", color: C.text }}>{props.item.name}</div>
          <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginTop: 4 }}>Player-owned copy. Edits here affect only this character.</div>
        </>
      }
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {props.editMode ? (
            <>
              <button type="button" onClick={props.onCancelEdit} style={plainBtn}>Cancel</button>
              <button type="button" onClick={() => { void handleSave(); }} style={accentBtn(props.accentColor)}>Save</button>
            </>
          ) : (
            <button type="button" onClick={props.onStartEdit} style={accentBtn(props.accentColor)}>Edit</button>
          )}
        </div>
      }
    >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {getEquipState(props.item) === "backpack" ? (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8, padding: "10px 12px", border: `1px solid ${C.panelBorder}`, borderRadius: 12, background: "rgba(255,255,255,0.03)" }}>
              <div style={sectionLabel}>Container</div>
              <Select value={currentContainerId} onChange={(e) => { void props.onMoveToContainer(e.target.value); }} style={{ width: "100%" }}>
                {props.containers.map((container) => <option key={container.id} value={container.id}>{container.name}{container.ignoreWeight ? " (Ignore Weight)" : ""}</option>)}
              </Select>
            </div>
          ) : null}
          {props.editMode ? (
            <EditFields
              draft={draft}
              setDraft={setDraft}
              isWeaponLike={isWeaponLike}
              isArmorLike={isArmorLike}
              isMeleeWeaponLike={isMeleeWeaponLike}
              canEnableAttuned={canEnableAttuned}
              chargesMax={props.item.chargesMax ?? null}
              onSaveCharges={async (v) => { await props.onSave({ chargesMax: v, charges: v ?? null }); }}
            />
          ) : props.busy ? (
            <div style={{ color: C.muted, padding: "8px 2px" }}>Loading...</div>
          ) : hasAnyDetails ? (
            <ReadFields draft={draft} item={props.item} isWeaponLike={isWeaponLike} isArmorLike={isArmorLike} isMeleeWeaponLike={isMeleeWeaponLike} accentColor={props.accentColor} onChargesChange={props.onChargesChange} />
          ) : (
            <div style={{ border: `1px solid ${C.panelBorder}`, borderRadius: 12, padding: 14, color: C.muted, minHeight: 96, display: "flex", alignItems: "center" }}>No details yet. Use Edit to add player-specific notes or item data.</div>
          )}
        </div>
    </RightDrawer>
  );
}

function EditFields({ draft, setDraft, isWeaponLike, isArmorLike, isMeleeWeaponLike, canEnableAttuned, chargesMax, onSaveCharges }: any) {
  return (
    <>
      <Field label="Title"><input value={draft.name} onChange={(e) => setDraft((d: any) => ({ ...d, name: e.target.value }))} placeholder="Item name" style={fullInput} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Rarity">
          <Select value={draft.rarity} onChange={(e) => setDraft((d: any) => ({ ...d, rarity: e.target.value }))} style={fullInput}>
            <option value="">None</option><option value="common">Common</option><option value="uncommon">Uncommon</option><option value="rare">Rare</option><option value="very rare">Very Rare</option><option value="legendary">Legendary</option><option value="artifact">Artifact</option>
          </Select>
        </Field>
        <Field label="Weight"><input type="number" value={draft.weight ?? ""} onChange={(e) => setDraft((d: any) => ({ ...d, weight: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="Weight" style={fullInput} /></Field>
        <Field label="Value"><input type="number" value={draft.value ?? ""} onChange={(e) => setDraft((d: any) => ({ ...d, value: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="Value" style={fullInput} /></Field>
        {isWeaponLike ? <Field label="Damage 1"><input value={draft.dmg1} onChange={(e) => setDraft((d: any) => ({ ...d, dmg1: e.target.value }))} style={fullInput} /></Field> : null}
        {isWeaponLike ? <Field label="Damage 2"><input value={draft.dmg2} onChange={(e) => setDraft((d: any) => ({ ...d, dmg2: e.target.value }))} style={fullInput} /></Field> : null}
        {isWeaponLike ? <Field label="Damage Type"><input value={draft.dmgType} onChange={(e) => setDraft((d: any) => ({ ...d, dmgType: e.target.value }))} style={fullInput} /></Field> : null}
        {isWeaponLike ? <Field label="Properties"><input value={draft.properties.join(", ")} onChange={(e) => setDraft((d: any) => ({ ...d, properties: e.target.value.split(",").map((p: string) => p.trim()).filter(Boolean) }))} style={fullInput} /></Field> : null}
        {isArmorLike ? <Field label="Armor Class"><input type="number" value={draft.ac ?? ""} onChange={(e) => setDraft((d: any) => ({ ...d, ac: e.target.value === "" ? null : Number(e.target.value) }))} style={fullInput} /></Field> : null}
        <Field label="Max Charges"><input type="number" min={0} value={chargesMax ?? ""} onChange={async (e) => { const v = e.target.value === "" ? null : Number(e.target.value); await onSaveCharges(v); }} placeholder="0" style={fullInput} /></Field>
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <label style={inventoryCheckboxLabel}><input type="checkbox" checked={draft.magic} onChange={(e) => setDraft((d: any) => ({ ...d, magic: e.target.checked }))} />Magic</label>
        {draft.attunement ? <label style={inventoryCheckboxLabel}><input type="checkbox" checked={draft.attuned} disabled={!draft.attuned && !canEnableAttuned} onChange={(e) => setDraft((d: any) => ({ ...d, attuned: e.target.checked }))} />Attuned</label> : null}
        {isMeleeWeaponLike ? <label style={inventoryCheckboxLabel}><input type="checkbox" checked={draft.silvered} onChange={(e) => setDraft((d: any) => ({ ...d, silvered: e.target.checked }))} />Silvered</label> : null}
        {isArmorLike ? <label style={inventoryCheckboxLabel}><input type="checkbox" checked={draft.stealthDisadvantage} onChange={(e) => setDraft((d: any) => ({ ...d, stealthDisadvantage: e.target.checked }))} />Stealth D</label> : null}
      </div>
      {draft.attunement && !canEnableAttuned ? <div style={{ fontSize: "var(--fs-small)", color: C.red }}>You can have no more than 3 attuned items at a time.</div> : null}
      <Field label="Text"><textarea value={draft.description} onChange={(e) => setDraft((d: any) => ({ ...d, description: e.target.value }))} placeholder="Description" rows={12} style={{ ...fullInput, resize: "vertical", minHeight: 240, fontFamily: "inherit", lineHeight: 1.5 }} /></Field>
    </>
  );
}

function ReadFields({ draft, item, isWeaponLike, isArmorLike, isMeleeWeaponLike, accentColor, onChargesChange }: any) {
  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {draft.magic ? <Tag label="Magic" color={C.colorMagic} /> : null}
        {draft.attunement && !draft.attuned ? <Tag label="Requires Attunement" color={accentColor} /> : null}
        {draft.attuned ? <Tag label="Attuned" color={accentColor} /> : null}
        {isMeleeWeaponLike && draft.silvered ? <Tag label="Silvered" color="#cbd5e1" /> : null}
        {draft.rarity ? <Tag label={titleCase(draft.rarity)} color={inventoryRarityColor(draft.rarity)} /> : null}
        {draft.type ? <Tag label={draft.type} color={C.muted} /> : null}
        {isArmorLike && draft.stealthDisadvantage ? <Tag label="D" color={C.colorPinkRed} /> : null}
      </div>
      {((isWeaponLike && (draft.dmg1 || draft.dmg2 || draft.dmgType || draft.properties.length > 0)) || draft.weight != null || draft.value != null || (isArmorLike && (draft.ac != null || draft.stealthDisadvantage))) ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
          {isArmorLike && draft.ac != null ? <Stat label="Armor Class" value={String(draft.ac)} /> : null}
          {isWeaponLike && draft.dmg1 ? <Stat label="One-Handed Damage" value={draft.dmg1} /> : null}
          {isWeaponLike && draft.dmg2 ? <Stat label="Two-Handed Damage" value={draft.dmg2} /> : null}
          {isWeaponLike && draft.dmgType ? <Stat label="Damage Type" value={formatItemDamageType(draft.dmgType) ?? draft.dmgType} /> : null}
          {draft.weight != null ? <Stat label="Weight" value={`${draft.weight} lb`} /> : null}
          {draft.value != null ? <Stat label="Value" value={`${draft.value} gp`} /> : null}
          {isWeaponLike && draft.properties.length > 0 ? <Stat label="Properties" value={formatItemProperties(draft.properties)} /> : null}
          {isArmorLike && draft.stealthDisadvantage ? <Stat label="Stealth" value="D" /> : null}
        </div>
      ) : null}
      {(item.chargesMax ?? 0) > 0 ? <ChargeBoxes item={item} accentColor={accentColor} onChargesChange={onChargesChange} /> : null}
      <ItemSpells description={draft.description ?? ""} />
      <div style={{ ...inventoryPickerDetailStyle, minHeight: 180 }}>{draft.description || <span style={{ color: C.muted }}>No description.</span>}</div>
    </>
  );
}

function ChargeBoxes({ item, accentColor, onChargesChange }: any) {
  const max = item.chargesMax!;
  const cur = item.charges ?? max;
  return <div><div style={sectionLabel}>Charges</div><div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>{Array.from({ length: max }).map((_, i) => { const filled = i < cur; return <button key={i} title={filled ? "Expend charge" : "Regain charge"} onClick={() => onChargesChange(filled ? cur - 1 : i + 1)} style={{ width: 24, height: 24, borderRadius: 4, border: `2px solid ${filled ? accentColor : "rgba(255,255,255,0.2)"}`, background: filled ? `${accentColor}33` : "transparent", cursor: "pointer", padding: 0 }} />; })}<span style={{ fontSize: "var(--fs-small)", color: C.muted, marginLeft: 4 }}>{cur} / {max}</span></div></div>;
}

function ItemSpells({ description }: { description: string }) {
  const spells = parseItemSpells(description);
  if (!spells.length) return null;
  return <div><div style={sectionLabel}>Spells</div><div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{spells.map((sp) => <div key={sp.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 6, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}><span style={{ fontSize: "var(--fs-subtitle)", color: "#c4b5fd", fontWeight: 600 }}>{sp.name}</span><span style={{ fontSize: "var(--fs-small)", color: C.muted, fontWeight: 600 }}>{sp.cost} {sp.cost === 1 ? "Charge" : "Charges"}</span></div>)}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={sectionLabel}>{label}</div>{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <StatCard label={label} value={value} theme={{ borderColor: C.panelBorder, background: "rgba(255,255,255,0.035)", mutedColor: C.muted, textColor: C.text }} />;
}

const sectionLabel: React.CSSProperties = { fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 };
const fullInput = { ...inputStyle, width: "100%", boxSizing: "border-box" } as React.CSSProperties;
const plainBtn: React.CSSProperties = { background: "transparent", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 8, color: C.muted, cursor: "pointer", padding: "8px 16px", fontSize: "var(--fs-subtitle)" };
const accentBtn = (accentColor: string): React.CSSProperties => ({ background: `${accentColor}22`, border: `1px solid ${accentColor}55`, borderRadius: 8, color: accentColor, cursor: "pointer", padding: "8px 16px", fontSize: "var(--fs-subtitle)", fontWeight: 700 });
