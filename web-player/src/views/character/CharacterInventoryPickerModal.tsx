import React, { useEffect, useState } from "react";
import { C, withAlpha } from "@/lib/theme";
import { titleCase } from "@/lib/format/titleCase";
import { api } from "@/services/api";
import { Select } from "@/ui/Select";
import { useVirtualList } from "@/lib/monsterPicker/useVirtualList";
import { useItemSearch } from "@/views/CompendiumView/hooks/useItemSearch";
import type { CompendiumItemDetail, InventoryPickerPayload } from "@/views/character/CharacterInventory";
import { formatItemDamageType, formatItemProperties, hasStealthDisadvantage } from "@/views/character/CharacterInventory";
import { INVENTORY_PICKER_ROW_HEIGHT, inputStyle, stepperBtn } from "@/views/character/CharacterInventoryPanelHelpers";
import { ItemListRow, Tag, togglePillStyle } from "@beholden/shared/ui";
import { InventoryStat } from "@/views/character/CharacterInventoryPanelRows";
import { addBtnStyle, cancelBtnStyle, inventoryCheckboxLabel, inventoryPickerColumnStyle, inventoryPickerDetailStyle, inventoryPickerListStyle, inventoryRarityColor } from "@/views/character/CharacterViewParts";

export function InventoryItemPickerModal(props: {
  isOpen: boolean;
  accentColor: string;
  onClose: () => void;
  onAdd: (payload?: InventoryPickerPayload) => void;
}) {
  const {
    q, setQ,
    rarityFilter, setRarityFilter, rarityOptions,
    typeFilter, setTypeFilter, typeOptions,
    filterAttunement, setFilterAttunement,
    filterMagic, setFilterMagic,
    hasActiveFilters, clearFilters,
    rows, busy, error, totalCount, refresh,
  } = useItemSearch();
  const vl = useVirtualList({ isEnabled: true, rowHeight: INVENTORY_PICKER_ROW_HEIGHT, overscan: 8 });
  const { start, end, padTop, padBottom } = vl.getRange(rows.length);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompendiumItemDetail | null>(null);
  const [qty, setQty] = useState(1);
  const [createMode, setCreateMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customRarity, setCustomRarity] = useState("");
  const [customType, setCustomType] = useState("");
  const [customAttunement, setCustomAttunement] = useState(false);
  const [customMagic, setCustomMagic] = useState(false);
  const [customDescription, setCustomDescription] = useState("");

  useEffect(() => {
    if (props.isOpen) refresh();
  }, [props.isOpen, refresh]);

  useEffect(() => {
    const el = vl.scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [q, rarityFilter, typeFilter, filterAttunement, filterMagic, createMode, props.isOpen, vl.scrollRef]);

  useEffect(() => {
    if (!props.isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  useEffect(() => {
    if (!props.isOpen) {
      setSelectedId(null);
      setDetail(null);
      setQty(1);
      setCreateMode(false);
      setCustomName("");
      setCustomRarity("");
      setCustomType("");
      setCustomAttunement(false);
      setCustomMagic(false);
      setCustomDescription("");
    }
  }, [props.isOpen]);

  useEffect(() => {
    if (!props.isOpen || createMode || !selectedId) {
      setDetail(null);
      return;
    }
    let alive = true;
    api<CompendiumItemDetail>(`/api/compendium/items/${selectedId}`)
      .then((data) => {
        if (!alive) return;
        setDetail(data);
        const parenQty = data.name?.match(/\((\d+)\)$/);
        if (parenQty) setQty(parseInt(parenQty[1], 10));
        else setQty(1);
      })
      .catch(() => { if (alive) setDetail(null); });
    return () => { alive = false; };
  }, [props.isOpen, createMode, selectedId]);

  if (!props.isOpen) return null;

  const detailText = detail
    ? (Array.isArray(detail.text) ? detail.text.join("\n\n") : detail.text ?? "")
    : "";

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) props.onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4, 8, 18, 0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "min(980px, 100%)", height: "min(680px, calc(100vh - 40px))", background: C.bg, border: `1px solid ${C.panelBorder}`, borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,0.45)", display: "grid", gridTemplateColumns: "minmax(320px, 380px) minmax(0, 1fr)", gap: 12, padding: 12, overflow: "hidden" }}>
        <div style={inventoryPickerColumnStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.colorGold }}>Browse Items</div>
            <button type="button" onClick={() => { setCreateMode((v) => !v); setSelectedId(null); }} style={{ border: `1px solid ${createMode ? props.accentColor : C.panelBorder}`, background: createMode ? `${props.accentColor}22` : "transparent", color: createMode ? props.accentColor : C.muted, borderRadius: 8, padding: "6px 10px", fontSize: "var(--fs-small)", fontWeight: 700, cursor: "pointer" }}>{createMode ? "Browse" : "Create New"}</button>
          </div>

          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items..." style={{ ...inputStyle, flex: "0 0 auto", width: "100%" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)} style={{ width: "100%" }}>{rarityOptions.map((r) => <option key={r} value={r}>{r === "all" ? "All Rarities" : titleCase(r)}</option>)}</Select>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: "100%" }}>{typeOptions.map((t) => <option key={t} value={t}>{t === "all" ? "All Types" : t}</option>)}</Select>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setFilterAttunement(!filterAttunement)} style={togglePillStyle(filterAttunement, props.accentColor, C.panelBorder, C.muted)}>Attunement</button>
            <button type="button" onClick={() => setFilterMagic(!filterMagic)} style={togglePillStyle(filterMagic, props.accentColor, C.panelBorder, C.muted)}>Magic</button>
            {hasActiveFilters ? <button type="button" onClick={clearFilters} style={togglePillStyle(false, props.accentColor, C.panelBorder, C.muted)}>Clear</button> : null}
          </div>

          <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
            {busy ? "Loading..." : error ? error : totalCount === rows.length ? `${rows.length} items` : `${rows.length} of ${totalCount}`}
          </div>

          <div ref={vl.scrollRef} onScroll={vl.onScroll} style={inventoryPickerListStyle}>
            <div style={{ height: padTop }} />
            {!busy && error ? <div style={{ padding: 12, color: C.red }}>{error}</div> : null}
            {!busy && rows.length === 0 ? <div style={{ padding: 12, color: C.muted }}>No items found.</div> : null}
            {rows.slice(start, end).map((item) => (
              <ItemListRow
                key={item.id}
                name={item.name}
                subtitle={[item.rarity ? titleCase(item.rarity) : null, item.type, item.attunement ? "Attunement" : null].filter(Boolean).join(" • ") || null}
                rarityColor={item.rarity ? inventoryRarityColor(item.rarity) : null}
                magic={!!item.magic}
                magicColor={C.colorMagic}
                active={item.id === selectedId}
                onClick={() => { setSelectedId(item.id); setCreateMode(false); }}
                height={INVENTORY_PICKER_ROW_HEIGHT}
                padding="0 16px"
                textColor={C.text}
                mutedColor={C.muted}
                borderColor={C.panelBorder}
                activeBackground={withAlpha(C.accentHl, 0.15)}
              />
            ))}
            <div style={{ height: padBottom }} />
          </div>
        </div>

        <div style={inventoryPickerColumnStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: C.text }}>{createMode ? "Create Item" : detail?.name ?? "Select an item"}</div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" onClick={() => setQty((v) => Math.max(1, v - 1))} style={stepperBtn}>-</button>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} style={{ ...inputStyle, width: 64, textAlign: "center", flex: "0 0 auto" }} />
              <button type="button" onClick={() => setQty((v) => v + 1)} style={stepperBtn}>+</button>
            </div>
            <button
              type="button"
              onClick={() => {
                if (createMode) {
                  const name = customName.trim();
                  if (!name) return;
                  props.onAdd({ source: "custom", name, quantity: qty, rarity: customRarity.trim() || null, type: customType.trim() || null, attunement: customAttunement, magic: customMagic, description: customDescription.trim() || undefined });
                  return;
                }
                if (!detail) return;
                props.onAdd({ source: "compendium", name: detail.name.replace(/\s*\(\d+\)$/, "").trim(), quantity: qty, itemId: detail.id, rarity: detail.rarity, type: detail.type, attunement: detail.attunement, magic: detail.magic, equippable: detail.equippable, weight: detail.weight, value: detail.value, proficiency: detail.proficiency, ac: detail.ac, stealthDisadvantage: detail.stealthDisadvantage, dmg1: detail.dmg1, dmg2: detail.dmg2, dmgType: detail.dmgType, properties: detail.properties, description: detailText });
              }}
              disabled={createMode ? !customName.trim() : !detail}
              style={addBtnStyle(props.accentColor)}
            >Add</button>
            <button type="button" onClick={props.onClose} style={cancelBtnStyle}>Close</button>
          </div>

          {createMode ? (
            <>
              <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Item name" style={{ ...inputStyle, flex: "0 0 auto", width: "100%" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input value={customRarity} onChange={(e) => setCustomRarity(e.target.value)} placeholder="Rarity" style={{ ...inputStyle, flex: "0 0 auto", width: "100%" }} />
                <input value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="Type" style={{ ...inputStyle, flex: "0 0 auto", width: "100%" }} />
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <label style={inventoryCheckboxLabel}><input type="checkbox" checked={customAttunement} onChange={(e) => setCustomAttunement(e.target.checked)} />Requires Attunement</label>
                <label style={inventoryCheckboxLabel}><input type="checkbox" checked={customMagic} onChange={(e) => setCustomMagic(e.target.checked)} />Magic Item</label>
              </div>
              <textarea value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} placeholder="Description or notes..." rows={12} style={{ ...inputStyle, flex: "0 0 auto", width: "100%", resize: "vertical", minHeight: 220, fontFamily: "inherit", lineHeight: 1.5 }} />
            </>
          ) : detail ? (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {detail.magic ? <Tag label="Magic" color={C.colorMagic} /> : null}
                {detail.attunement ? <Tag label="Attunement" color={props.accentColor} /> : null}
                {detail.rarity ? <Tag label={titleCase(detail.rarity)} color={inventoryRarityColor(detail.rarity)} /> : null}
                {detail.type ? <Tag label={detail.type} color={C.muted} /> : null}
                {hasStealthDisadvantage(detail) ? <Tag label="D" color={C.colorPinkRed} /> : null}
              </div>
              {(detail.dmg1 || detail.dmg2 || detail.dmgType || detail.weight != null || detail.value != null || detail.properties.length > 0) ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                  {detail.dmg1 ? <InventoryStat label="One-Handed Damage" value={detail.dmg1} /> : null}
                  {detail.dmg2 ? <InventoryStat label="Two-Handed Damage" value={detail.dmg2} /> : null}
                  {detail.dmgType ? <InventoryStat label="Damage Type" value={formatItemDamageType(detail.dmgType) ?? detail.dmgType} /> : null}
                  {detail.weight != null ? <InventoryStat label="Weight" value={`${detail.weight} lb`} /> : null}
                  {detail.value != null ? <InventoryStat label="Value" value={`${detail.value} gp`} /> : null}
                  {hasStealthDisadvantage(detail) ? <InventoryStat label="Stealth" value="D" /> : null}
                  {detail.properties.length > 0 ? <InventoryStat label="Properties" value={formatItemProperties(detail.properties)} /> : null}
                </div>
              ) : null}
              <div style={inventoryPickerDetailStyle}>{detailText || <span style={{ color: C.muted }}>No description.</span>}</div>
            </>
          ) : (
            <div style={{ color: C.muted, lineHeight: 1.5 }}>Pick a compendium item on the left, or switch to <strong>Create New</strong> to add a custom entry.</div>
          )}
        </div>
      </div>
    </div>
  );
}
