import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "@/lib/theme";
import { titleCase } from "@beholden/shared/domain/text/titleCase";
import { RightDrawer } from "@/ui/RightDrawer";
import { Select } from "@/ui/Select";
import { StatCard, Tag } from "@beholden/shared/ui";
import type { CompendiumItemDetail, InventoryContainer, InventoryItem } from "@/views/character/inventory/CharacterInventory";
import {
  formatItemDamageType,
  formatItemProperties,
  getEquipState,
  isArmorItem,
  isRangedWeapon,
  isShieldItem,
  isWeaponItem,
} from "@/views/character/inventory/CharacterInventory";
import { inventoryPickerDetailStyle, inventoryRarityColor } from "@/views/character/CharacterViewParts";
import { DEFAULT_CONTAINER_ID, inputStyle } from "@/views/character/inventory/CharacterInventoryPanelHelpers";
import { CharacterStoredSpellManager } from "@/views/character/spells/CharacterStoredSpellManager";
import { Button } from "@/ui/Button";

export function InventoryItemDrawer(props: {
  item: InventoryItem;
  containers: InventoryContainer[];
  detail: CompendiumItemDetail | null;
  busy: boolean;
  accentColor: string;
  otherAttunedCount: number;
  editMode: boolean;
  canDesignatePactWeapon: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onClose: () => void;
  onSave: (patch: Partial<InventoryItem>) => Promise<void>;
  onMoveToContainer: (containerId: string | null) => Promise<void>;
  onChargesChange: (charges: number) => void | Promise<void>;
  readOnly?: boolean;
  subtitle?: string;
  showContainerControl?: boolean;
}) {
  const { t } = useTranslation();
  const merged = React.useMemo(() => ({
    name: props.item.name,
    rarity: props.item.rarity ?? props.detail?.rarity ?? "",
    type: props.item.type ?? props.detail?.type ?? "",
    attunement: props.item.attunement ?? props.detail?.attunement ?? false,
    attuned: props.item.attuned ?? false,
    pactWeapon: props.item.pactWeapon ?? false,
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
  }), [props.detail, props.item]);
  const kindItem: InventoryItem = { ...props.item, type: merged.type || null, dmg1: merged.dmg1 || null, dmg2: merged.dmg2 || null, ac: merged.ac, properties: merged.properties };
  const isWeaponLike = isWeaponItem(kindItem);
  const isRangedWeaponLike = isWeaponLike && isRangedWeapon(kindItem);
  const isMeleeWeaponLike = isWeaponLike && !isRangedWeaponLike;
  const isArmorLike = isArmorItem(kindItem) || isShieldItem(kindItem);
  const [draft, setDraft] = useState(merged);
  // A save (edits, Max Charges, moving to the Party Stash, stored-spell changes)
  // is a server round trip that can fail. Show the failure instead of silently
  // no-op'ing, and hold off overlapping submissions / edits while one is running.
  const [moveError, setMoveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = React.useRef(false);

  useEffect(() => {
    if (!props.editMode) setDraft(merged);
  }, [merged, props.editMode]);

  const submit = React.useCallback(async (patch: Partial<InventoryItem>) => {
    if (savingRef.current) return;      // synchronous guard against a double click before rerender
    savingRef.current = true;
    setSaving(true);
    setMoveError(null);
    try {
      await props.onSave(patch);
    } catch (cause) {
      setMoveError(cause instanceof Error ? cause.message : t("characterInventoryDrawer.unableToSaveItem"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [props, t]);

  const hasAnyDetails = Boolean(
    draft.rarity || draft.type || draft.description || draft.weight != null || draft.value != null ||
    (isArmorLike && draft.ac != null) || (isWeaponLike && draft.dmg1) || (isWeaponLike && draft.dmg2) ||
    (isWeaponLike && draft.dmgType) || (isWeaponLike && draft.properties.length > 0) || draft.stealthDisadvantage ||
    draft.attunement || draft.attuned || draft.magic || (isMeleeWeaponLike && draft.silvered) || (props.item.chargesMax ?? 0) > 0 ||
    Boolean(props.detail?.source) || Boolean(props.item.spellTemplate)
  );
  const canEnableAttuned = draft.attuned || props.otherAttunedCount < 3;
  const currentContainerId = props.item.containerId ?? DEFAULT_CONTAINER_ID;

  const handleSave = () => submit({
    name: draft.name.trim() || props.item.name,
    rarity: draft.rarity.trim() || null,
    type: props.item.type ?? props.detail?.type ?? null,
    attunement: Boolean(draft.attunement),
    attuned: draft.attunement && canEnableAttuned ? Boolean(draft.attuned) : false,
    pactWeapon: props.canDesignatePactWeapon ? Boolean(draft.pactWeapon) : false,
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
    chargesMax: props.item.chargesMax ?? null,
  });

  return (
    <RightDrawer
      onClose={props.onClose}
      width="min(520px, 92vw)"
      title={
        <>
          <div style={{ fontWeight: 900, fontSize: "var(--fs-title)", color: C.text }}>{props.item.name}</div>
          <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginTop: 4 }}>{props.subtitle ?? t("characterInventoryDrawer.playerOwnedCopySubtitle")}</div>
        </>
      }
      footer={props.readOnly ? undefined :
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {props.editMode ? (
            <>
              <Button type="button" variant="ghost" disabled={saving} onClick={props.onCancelEdit}>{t("characterInventoryDrawer.cancelButton")}</Button>
              <Button type="button" variant="primary" disabled={saving} onClick={() => { void handleSave(); }}>
                {saving ? t("characterInventoryDrawer.savingButton") : t("characterInventoryDrawer.saveButton")}
              </Button>
            </>
          ) : (
            <Button type="button" variant="primary" onClick={props.onStartEdit}>{t("characterInventoryDrawer.editButton")}</Button>
          )}
        </div>
      }
    >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {moveError ? <div role="alert" style={{ color: C.red, fontSize: "var(--fs-small)" }}>{moveError}</div> : null}
          {getEquipState(props.item) === "backpack" && props.showContainerControl !== false ? (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8, padding: "10px 12px", border: `1px solid ${C.panelBorder}`, borderRadius: 12, background: "rgba(255,255,255,0.03)" }}>
              <div style={sectionLabel}>{t("characterInventoryDrawer.containerLabel")}</div>
              <Select
                value={currentContainerId}
                onChange={(e) => {
                  setMoveError(null);
                  void props.onMoveToContainer(e.target.value).catch((cause) =>
                    setMoveError(cause instanceof Error ? cause.message : t("characterInventoryDrawer.moveItemError")),
                  );
                }}
                style={{ width: "100%" }}
              >
                {props.containers.map((container) => <option key={container.id} value={container.id}>{container.name}</option>)}
              </Select>
            </div>
          ) : null}
          {props.editMode ? (
            // A native disabled fieldset freezes every control inside while a
            // save is in flight, so newer keystrokes can't be lost when the
            // editor closes on success.
            <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <EditFields
                draft={draft}
                setDraft={setDraft}
                isWeaponLike={isWeaponLike}
                isArmorLike={isArmorLike}
                isMeleeWeaponLike={isMeleeWeaponLike}
                canEnableAttuned={canEnableAttuned}
                canDesignatePactWeapon={props.canDesignatePactWeapon}
                chargesMax={props.item.chargesMax ?? null}
                onSaveCharges={(v: number | null) => submit({ chargesMax: v, charges: v ?? null })}
                accentColor={props.accentColor}
              />
            </fieldset>
          ) : props.busy ? (
            <div style={{ color: C.muted, padding: "8px 2px" }}>{t("characterInventoryDrawer.loadingText")}</div>
          ) : hasAnyDetails ? (
            <ReadFields draft={draft} item={props.item} source={props.detail?.source} ruleset={props.detail?.ruleset} isWeaponLike={isWeaponLike} isArmorLike={isArmorLike} isMeleeWeaponLike={isMeleeWeaponLike} accentColor={props.accentColor} onChargesChange={(charges) => submit({ charges })} onSave={submit} />
          ) : (
            <div style={{ border: `1px solid ${C.panelBorder}`, borderRadius: 12, padding: 14, color: C.muted, minHeight: 96, display: "flex", alignItems: "center" }}>{t("characterInventoryDrawer.noDetailsYet")}</div>
          )}
        </div>
    </RightDrawer>
  );
}

type InventoryDraft = {
  name: string;
  rarity: string;
  type: string;
  attunement: boolean;
  attuned: boolean;
  pactWeapon: boolean;
  magic: boolean;
  silvered: boolean;
  weight: number | null;
  value: number | null;
  ac: number | null;
  stealthDisadvantage: boolean;
  dmg1: string;
  dmg2: string;
  dmgType: string;
  properties: string[];
  description: string;
};

type EditFieldsProps = {
  draft: InventoryDraft;
  setDraft: React.Dispatch<React.SetStateAction<InventoryDraft>>;
  isWeaponLike: boolean;
  isArmorLike: boolean;
  isMeleeWeaponLike: boolean;
  canEnableAttuned: boolean;
  canDesignatePactWeapon: boolean;
  chargesMax: number | null;
  onSaveCharges: (value: number | null) => Promise<void>;
  accentColor: string;
};

function EditFields({ draft, setDraft, isWeaponLike, isArmorLike, isMeleeWeaponLike, canEnableAttuned, canDesignatePactWeapon, chargesMax, onSaveCharges, accentColor }: EditFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <Field label={t("characterInventoryDrawer.titleFieldLabel")}><input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder={t("characterInventoryDrawer.itemNamePlaceholder")} style={fullInput} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={t("characterInventoryDrawer.rarityFieldLabel")}>
          <Select value={draft.rarity} onChange={(e) => setDraft((d) => ({ ...d, rarity: e.target.value }))} style={fullInput}>
            <option value="">{t("characterInventoryDrawer.rarityNone")}</option>
            <option value="common">{t("characterInventoryDrawer.rarityCommon")}</option>
            <option value="uncommon">{t("characterInventoryDrawer.rarityUncommon")}</option>
            <option value="rare">{t("characterInventoryDrawer.rarityRare")}</option>
            <option value="very rare">{t("characterInventoryDrawer.rarityVeryRare")}</option>
            <option value="legendary">{t("characterInventoryDrawer.rarityLegendary")}</option>
            <option value="artifact">{t("characterInventoryDrawer.rarityArtifact")}</option>
          </Select>
        </Field>
        <Field label={t("characterInventoryDrawer.weightFieldLabel")}><input type="number" value={draft.weight ?? ""} onChange={(e) => setDraft((d) => ({ ...d, weight: e.target.value === "" ? null : Number(e.target.value) }))} placeholder={t("characterInventoryDrawer.weightPlaceholder")} style={fullInput} /></Field>
        <Field label={t("characterInventoryDrawer.valueFieldLabel")}><input type="number" value={draft.value ?? ""} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value === "" ? null : Number(e.target.value) }))} placeholder={t("characterInventoryDrawer.valuePlaceholder")} style={fullInput} /></Field>
        {isWeaponLike ? <Field label={t("characterInventoryDrawer.damage1FieldLabel")}><input value={draft.dmg1} onChange={(e) => setDraft((d) => ({ ...d, dmg1: e.target.value }))} style={fullInput} /></Field> : null}
        {isWeaponLike ? <Field label={t("characterInventoryDrawer.damage2FieldLabel")}><input value={draft.dmg2} onChange={(e) => setDraft((d) => ({ ...d, dmg2: e.target.value }))} style={fullInput} /></Field> : null}
        {isWeaponLike ? <Field label={t("characterInventoryDrawer.damageTypeFieldLabel")}><input value={draft.dmgType} onChange={(e) => setDraft((d) => ({ ...d, dmgType: e.target.value }))} style={fullInput} /></Field> : null}
        {isWeaponLike ? <Field label={t("characterInventoryDrawer.propertiesFieldLabel")}><input value={draft.properties.join(", ")} onChange={(e) => setDraft((d) => ({ ...d, properties: e.target.value.split(",").map((p: string) => p.trim()).filter(Boolean) }))} style={fullInput} /></Field> : null}
        {isArmorLike ? <Field label={t("characterInventoryDrawer.armorClassFieldLabel")}><input type="number" value={draft.ac ?? ""} onChange={(e) => setDraft((d) => ({ ...d, ac: e.target.value === "" ? null : Number(e.target.value) }))} style={fullInput} /></Field> : null}
        {(chargesMax ?? 0) > 0 ? <Field label={t("characterInventoryDrawer.maxChargesFieldLabel")}><input type="number" min={0} value={chargesMax ?? ""} onChange={async (e) => { const v = e.target.value === "" ? null : Number(e.target.value); await onSaveCharges(v); }} placeholder="0" style={fullInput} /></Field> : null}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <TogglePill active={draft.magic} label={t("characterInventoryDrawer.magicToggleLabel")} color={C.colorMagic} onClick={() => setDraft((d) => ({ ...d, magic: !d.magic }))} />
        {draft.attunement ? <TogglePill active={draft.attuned} label={t("characterInventoryDrawer.attunedToggleLabel")} color={accentColor} disabled={!draft.attuned && !canEnableAttuned} onClick={() => setDraft((d) => ({ ...d, attuned: !d.attuned }))} /> : null}
        {canDesignatePactWeapon ? <TogglePill active={draft.pactWeapon} label={t("characterInventoryDrawer.pactWeaponToggleLabel")} color={C.colorPinkRed} onClick={() => setDraft((d) => ({ ...d, pactWeapon: !d.pactWeapon }))} /> : null}
        {isMeleeWeaponLike ? <TogglePill active={draft.silvered} label={t("characterInventoryDrawer.silveredToggleLabel")} color="#cbd5e1" onClick={() => setDraft((d) => ({ ...d, silvered: !d.silvered }))} /> : null}
        {isArmorLike ? <TogglePill active={draft.stealthDisadvantage} label={t("characterInventoryDrawer.stealthDisadvantageToggleLabel")} color={C.red} onClick={() => setDraft((d) => ({ ...d, stealthDisadvantage: !d.stealthDisadvantage }))} /> : null}
      </div>
      {draft.attunement && !canEnableAttuned ? <div style={{ fontSize: "var(--fs-small)", color: C.red }}>{t("characterInventoryDrawer.attunementLimitWarning")}</div> : null}
      <Field label={t("characterInventoryDrawer.textFieldLabel")}><textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder={t("characterInventoryDrawer.descriptionPlaceholder")} rows={12} style={{ ...fullInput, resize: "vertical", minHeight: 240, fontFamily: "inherit", lineHeight: 1.5 }} /></Field>
    </>
  );
}

function TogglePill({ active, label, color, disabled, onClick }: { active: boolean; label: string; color: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "6px 14px", borderRadius: 20, cursor: disabled ? "not-allowed" : "pointer",
        border: `1px solid ${active ? color + "88" : "rgba(255,255,255,0.12)"}`,
        background: active ? `${color}22` : "rgba(255,255,255,0.04)",
        color: active ? color : C.muted,
        fontWeight: 700, fontSize: "var(--fs-small)",
        opacity: disabled ? 0.45 : 1,
        transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
      }}
    >
      {label}
    </button>
  );
}

type ReadFieldsProps = {
  draft: InventoryDraft;
  item: InventoryItem;
  source?: string | null;
  ruleset?: "5e" | "5.5e";
  isWeaponLike: boolean;
  isArmorLike: boolean;
  isMeleeWeaponLike: boolean;
  accentColor: string;
  onChargesChange: (charges: number) => void | Promise<void>;
  onSave: (patch: Partial<InventoryItem>) => Promise<void>;
};

function ReadFields({ draft, item, source, ruleset, isWeaponLike, isArmorLike, isMeleeWeaponLike, accentColor, onChargesChange, onSave }: ReadFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {draft.magic ? <Tag label={t("characterInventoryDrawer.magicToggleLabel")} color={C.colorMagic} /> : null}
        {draft.attunement && !draft.attuned ? <Tag label={t("characterInventoryDrawer.requiresAttunementTag")} color={accentColor} /> : null}
        {draft.attuned ? <Tag label={t("characterInventoryDrawer.attunedToggleLabel")} color={accentColor} /> : null}
        {draft.pactWeapon ? <Tag label={t("characterInventoryDrawer.pactWeaponToggleLabel")} color={C.colorPinkRed} /> : null}
        {isMeleeWeaponLike && draft.silvered ? <Tag label={t("characterInventoryDrawer.silveredToggleLabel")} color="#cbd5e1" /> : null}
        {draft.rarity ? <Tag label={titleCase(draft.rarity)} color={inventoryRarityColor(draft.rarity)} /> : null}
        {draft.type ? <Tag label={draft.type} color={C.muted} /> : null}
        {isArmorLike && draft.stealthDisadvantage ? <Tag label="D" color={C.colorPinkRed} /> : null}
      </div>
      {((isWeaponLike && (draft.dmg1 || draft.dmg2 || draft.dmgType || draft.properties.length > 0)) || draft.weight != null || draft.value != null || (isArmorLike && (draft.ac != null || draft.stealthDisadvantage))) ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
          {isArmorLike && draft.ac != null ? <Stat label={t("characterInventoryDrawer.armorClassFieldLabel")} value={String(draft.ac)} /> : null}
          {isWeaponLike && draft.dmg1 ? <Stat label={t("characterInventoryDrawer.oneHandedDamageStatLabel")} value={draft.dmg1} /> : null}
          {isWeaponLike && draft.dmg2 ? <Stat label={t("characterInventoryDrawer.twoHandedDamageStatLabel")} value={draft.dmg2} /> : null}
          {isWeaponLike && draft.dmgType ? <Stat label={t("characterInventoryDrawer.damageTypeFieldLabel")} value={formatItemDamageType(draft.dmgType) ?? draft.dmgType} /> : null}
          {draft.weight != null ? <Stat label={t("characterInventoryDrawer.weightFieldLabel")} value={`${draft.weight} ${t("units.lb", { ns: "shared" })}`} /> : null}
          {draft.value != null ? <Stat label={t("characterInventoryDrawer.valueFieldLabel")} value={`${draft.value} ${t("units.gp", { ns: "shared" })}`} /> : null}
          {isWeaponLike && draft.properties.length > 0 ? <Stat label={t("characterInventoryDrawer.propertiesFieldLabel")} value={formatItemProperties(draft.properties)} /> : null}
          {isArmorLike && draft.stealthDisadvantage ? <Stat label={t("characterInventoryDrawer.stealthStatLabel")} value="D" /> : null}
        </div>
      ) : null}
      {(item.chargesMax ?? 0) > 0 ? <ChargeBoxes item={item} accentColor={accentColor} onChargesChange={onChargesChange} /> : null}
      <CharacterStoredSpellManager item={item} ruleset={ruleset} accentColor={accentColor} onSave={onSave} />
      <div style={{ ...inventoryPickerDetailStyle, minHeight: 60 }}>{draft.description || <span style={{ color: C.muted }}>{t("characterInventoryDrawer.noDescription")}</span>}</div>
      {source ? (
        <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
          {t("characterInventoryDrawer.sourceRulesetLine", { source, ruleset: ruleset ?? t("characterInventoryDrawer.unknownRuleset") })}
        </div>
      ) : null}
    </>
  );
}

function ChargeBoxes({ item, accentColor, onChargesChange }: { item: InventoryItem; accentColor: string; onChargesChange: (charges: number) => void | Promise<void> }) {
  const { t } = useTranslation();
  const max = item.chargesMax!;
  const cur = item.charges ?? max;
  return <div><div style={sectionLabel}>{t("characterInventoryDrawer.chargesLabel")}</div><div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>{Array.from({ length: max }).map((_, i) => { const filled = i < cur; return <button key={i} title={filled ? t("characterInventoryDrawer.expendChargeTitle") : t("characterInventoryDrawer.regainChargeTitle")} onClick={() => onChargesChange(filled ? cur - 1 : i + 1)} style={{ width: 24, height: 24, borderRadius: 4, border: `2px solid ${filled ? accentColor : "rgba(255,255,255,0.2)"}`, background: filled ? `${accentColor}33` : "transparent", cursor: "pointer", padding: 0 }} />; })}<span style={{ fontSize: "var(--fs-small)", color: C.muted, marginLeft: 4 }}>{cur} / {max}</span></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={sectionLabel}>{label}</div>{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <StatCard label={label} value={value} theme={{ borderColor: C.panelBorder, background: "rgba(255,255,255,0.035)", mutedColor: C.muted, textColor: C.text }} />;
}

const sectionLabel: React.CSSProperties = { fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 };
const fullInput = { ...inputStyle, width: "100%", boxSizing: "border-box" } as React.CSSProperties;
