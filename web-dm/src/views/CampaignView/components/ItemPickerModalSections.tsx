import React from "react";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { IconButton } from "@/ui/IconButton";
import { IconClose, IconPlus } from "@/icons";
import { Select } from "@/ui/Select";
import { theme, withAlpha } from "@/theme/theme";
import { titleCase } from "@/lib/format/titleCase";
import type { CompendiumItemDetail, CompendiumItemRow } from "@/domain/types/compendium";
import {
  KNOWN_TYPES,
  MagicBadge,
  RARITY_ORDER,
  RarityDot,
  CheckRow,
  Chip,
  FormField,
  Stat,
  fieldInput,
  rarityChipColor,
  searchStyle,
} from "./ItemPickerModalParts";

const DMG_TYPE_LABELS: Record<string, string> = {
  S: "Slashing", P: "Piercing", B: "Bludgeoning",
  F: "Fire", C: "Cold", L: "Lightning", A: "Acid",
  N: "Necrotic", R: "Radiant", T: "Thunder",
  PS: "Psychic", PO: "Poison", FO: "Force",
};

const PROPERTY_LABELS: Record<string, string> = {
  "2H": "Two-Handed", F: "Finesse", L: "Light", T: "Thrown",
  V: "Versatile", R: "Reach", H: "Heavy", A: "Ammunition",
  LD: "Loading", S: "Special",
};

export function ItemPickerBrowsePanel(props: {
  createMode: boolean;
  loading: boolean;
  q: string;
  rarity: string;
  rarityOptions: string[];
  type: string;
  typeOptions: string[];
  magicFilter: "" | "magic" | "nonmagic";
  rows: CompendiumItemRow[];
  filtered: CompendiumItemRow[];
  selectedId: string | null;
  rowHeight: number;
  padTop: number;
  padBottom: number;
  start: number;
  end: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: React.UIEventHandler<HTMLDivElement>;
  onToggleCreateMode: () => void;
  onQChange: (value: string) => void;
  onRarityChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onMagicFilterChange: (value: "" | "magic" | "nonmagic") => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Panel
      title="Browse"
      actions={
        <button
          type="button"
          title={props.createMode ? "Back to browse" : "Create new item"}
          onClick={props.onToggleCreateMode}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: 8,
            border: `1px solid ${theme.colors.panelBorder}`,
            background: props.createMode ? theme.colors.panelBg : theme.colors.accentPrimary,
            color: props.createMode ? theme.colors.muted : theme.colors.textDark,
            cursor: "pointer", fontSize: "var(--fs-title)", lineHeight: 1, fontWeight: 700,
          }}
        >
          {props.createMode ? "x" : <IconPlus size={14} />}
        </button>
      }
      style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}
    >
      <input value={props.q} onChange={(e) => props.onQChange(e.target.value)} placeholder="Search items..." style={searchStyle()} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <Select value={props.rarity} onChange={(e) => props.onRarityChange(e.target.value)} style={{ width: "100%" }}>
          <option value="">All Rarities</option>
          {props.rarityOptions.map((rarity) => (
            <option key={rarity} value={rarity}>{titleCase(rarity)}</option>
          ))}
        </Select>
        <Select value={props.type} onChange={(e) => props.onTypeChange(e.target.value)} style={{ width: "100%" }}>
          <option value="">All Types</option>
          {props.typeOptions.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </Select>
        <Select value={props.magicFilter} onChange={(e) => props.onMagicFilterChange(e.target.value as "" | "magic" | "nonmagic")} style={{ width: "100%" }}>
          <option value="">Any magic</option>
          <option value="magic">Magic only</option>
          <option value="nonmagic">Non-magic</option>
        </Select>
      </div>

      <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted }}>
        {props.loading ? "Loading..." : `${props.filtered.length} of ${props.rows.length}`}
      </div>

      <div
        ref={props.scrollRef}
        onScroll={props.onScroll}
        style={{
          flex: 1, minHeight: 0, overflowY: "auto",
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: 10,
        }}
      >
        <div style={{ height: props.padTop }} />

        {!props.loading && props.filtered.length === 0 && (
          <div style={{ padding: 12, color: theme.colors.muted }}>No items found.</div>
        )}

        {props.filtered.slice(props.start, props.end).map((row) => {
          const isSelected = row.id === props.selectedId;
          const subtitle = [
            row.rarity ? titleCase(row.rarity) : null,
            row.type ?? null,
            row.attunement ? "Attunement" : null,
          ].filter(Boolean).join(" • ");

          return (
            <div
              key={row.id}
              onClick={() => props.onSelect(row.id)}
              style={{
                height: props.rowHeight,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "0 12px",
                borderBottom: `1px solid ${theme.colors.panelBorder}`,
                background: isSelected ? withAlpha(theme.colors.accentHighlight, 0.15) : "transparent",
                cursor: "pointer",
                color: theme.colors.text,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {row.rarity && <RarityDot rarity={row.rarity} />}
                <span style={{ fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
                {row.magic && <MagicBadge />}
              </div>
              {subtitle && (
                <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {subtitle}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ height: props.padBottom }} />
      </div>
    </Panel>
  );
}

export function ItemPickerDetailPanel(props: {
  createMode: boolean;
  detail: CompendiumItemDetail | null;
  qty: number;
  customName: string;
  customRarity: string;
  customType: string;
  customAttune: boolean;
  customMagic: boolean;
  customText: string;
  canAddCompendium: boolean;
  canAddCustom: boolean;
  onClose: () => void;
  onQtyChange: (value: number) => void;
  onAddCompendium: () => void;
  onAddCustom: () => void;
  onCustomNameChange: (value: string) => void;
  onCustomRarityChange: (value: string) => void;
  onCustomTypeChange: (value: string) => void;
  onCustomAttuneChange: (value: boolean) => void;
  onCustomMagicChange: (value: boolean) => void;
  onCustomTextChange: (value: string) => void;
}) {
  return (
    <Panel
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span>{props.createMode ? "New Item" : props.detail?.name ?? "Select an item"}</span>
          <div style={{ flex: 1 }} />
          <IconButton title="Close" variant="ghost" onClick={props.onClose}>
            <IconClose />
          </IconButton>
        </div>
      }
      actions={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 8, overflow: "hidden" }}>
            <button type="button" onClick={() => props.onQtyChange(Math.max(1, props.qty - 1))}
              style={{ width: 28, height: 28, border: "none", background: "transparent", color: theme.colors.text, cursor: "pointer", fontSize: "var(--fs-body)", fontWeight: 700, flexShrink: 0 }}>-</button>
            <input
              type="number"
              min={1}
              value={props.qty}
              onChange={(e) => props.onQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                width: 48,
                textAlign: "center",
                fontSize: "var(--fs-medium)",
                fontWeight: 700,
                background: "transparent",
                color: theme.colors.text,
                border: "none",
                outline: "none",
                appearance: "textfield",
                MozAppearance: "textfield",
                WebkitAppearance: "none",
              } as React.CSSProperties}
            />
            <button type="button" onClick={() => props.onQtyChange(props.qty + 1)}
              style={{ width: 28, height: 28, border: "none", background: "transparent", color: theme.colors.text, cursor: "pointer", fontSize: "var(--fs-body)", fontWeight: 700, flexShrink: 0 }}>+</button>
          </div>
          {props.createMode ? (
            <Button onClick={props.onAddCustom} disabled={!props.canAddCustom}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <IconPlus size={14} /> Add
              </span>
            </Button>
          ) : (
            <Button onClick={props.onAddCompendium} disabled={!props.canAddCompendium}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <IconPlus size={14} /> Add
              </span>
            </Button>
          )}
        </div>
      }
      bodyStyle={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}
    >
      {props.createMode ? (
        <>
          <FormField label="Name *">
            <input value={props.customName} onChange={(e) => props.onCustomNameChange(e.target.value)} placeholder="Item name" style={fieldInput()} />
          </FormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <FormField label="Rarity">
              <select value={props.customRarity} onChange={(e) => props.onCustomRarityChange(e.target.value)} style={fieldInput()}>
                <option value="">- None -</option>
                {RARITY_ORDER.map((rarity) => <option key={rarity} value={rarity}>{titleCase(rarity)}</option>)}
              </select>
            </FormField>
            <FormField label="Type">
              <input value={props.customType} onChange={(e) => props.onCustomTypeChange(e.target.value)} list="ipm-type-list" placeholder="e.g. Wondrous Item" style={fieldInput()} />
              <datalist id="ipm-type-list">{KNOWN_TYPES.map((type) => <option key={type} value={type} />)}</datalist>
            </FormField>
          </div>

          <div style={{ display: "flex", gap: 20 }}>
            <CheckRow label="Requires Attunement" checked={props.customAttune} onChange={props.onCustomAttuneChange} />
            <CheckRow label="Magic Item" checked={props.customMagic} onChange={props.onCustomMagicChange} />
          </div>

          <FormField label="Description">
            <textarea
              value={props.customText}
              onChange={(e) => props.onCustomTextChange(e.target.value)}
              rows={10}
              placeholder="Notes / description..."
              style={{ ...fieldInput(), resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
            />
          </FormField>
        </>
      ) : props.detail ? (
        <ItemDetail detail={props.detail} />
      ) : (
        <div style={{ color: theme.colors.muted, lineHeight: 1.5 }}>
          Select an item from the list on the left, or click <strong>Create New</strong> to add a custom item.
        </div>
      )}
    </Panel>
  );
}

function ItemDetail({ detail }: { detail: CompendiumItemDetail }) {
  const dmg1 = detail.dmg1 ?? null;
  const dmg2 = detail.dmg2 ?? null;
  const dmgTypeLabel = DMG_TYPE_LABELS[detail.dmgType ?? ""] ?? detail.dmgType ?? null;
  const propertyLabels = (detail.properties ?? []).map((property) => PROPERTY_LABELS[property] ?? property);
  const hasStats = dmg1 || dmg2 || detail.weight != null || detail.value != null || detail.ac != null || propertyLabels.length > 0;
  const detailText = typeof detail.text === "string" ? detail.text.trim() : Array.isArray(detail.text) ? detail.text.join("\n\n") : "";
  const displayName = detail.name.replace(/\s*\[.*?\]\s*$/, "").trim();

  return (
    <>
      <div>
        <div style={{ fontWeight: 900, fontSize: "var(--fs-title)", color: theme.colors.text }}>{displayName}</div>
        {detail.type && <div style={{ fontSize: "var(--fs-subtitle)", color: theme.colors.muted, marginTop: 2 }}>{detail.type}</div>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {detail.magic && <MagicBadge />}
        {detail.attunement && <Chip label="Requires Attunement" color={theme.colors.accentHighlight} />}
        {detail.rarity && <Chip label={titleCase(detail.rarity)} color={rarityChipColor(detail.rarity)} />}
        {(detail.modifiers ?? []).map((modifier, index) => <Chip key={index} label={modifier.text} color={theme.colors.colorMagic} />)}
      </div>
      {hasStats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
          {detail.ac != null && <Stat label="Armor Class" value={String(detail.ac)} />}
          {dmg1 && <Stat label="One-Handed Damage" value={dmg1} />}
          {dmg2 && <Stat label="Two-Handed Damage" value={dmg2} />}
          {dmgTypeLabel && <Stat label="Damage Type" value={dmgTypeLabel} />}
          {detail.weight != null && <Stat label="Weight" value={`${detail.weight} lb`} />}
          {detail.value != null && <Stat label="Value" value={`${detail.value} gp`} />}
          {propertyLabels.length > 0 && <Stat label="Properties" value={propertyLabels.join(", ")} />}
        </div>
      )}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 12,
          borderRadius: 10,
          border: `1px solid ${theme.colors.panelBorder}`,
          whiteSpace: "pre-wrap",
          lineHeight: 1.5,
          fontSize: "var(--fs-medium)",
          color: theme.colors.text,
        }}
      >
        {detailText || <span style={{ color: theme.colors.muted }}>No description.</span>}
      </div>
    </>
  );
}
