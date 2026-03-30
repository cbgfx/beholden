import React from "react";
import { Panel } from "@/ui/Panel";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import { titleCase } from "@/lib/format/titleCase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemFull = {
  id: string; name: string;
  rarity: string | null; type: string | null;
  attunement: boolean; magic: boolean;
  weight: number | null;
  value?: number | null;
  ac?: number | null;
  stealthDisadvantage?: boolean;
  dmg1: string | null; dmg2: string | null; dmgType: string | null;
  properties: string[];
  modifiers: Array<{ category: string; text: string }>;
  text: string | string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROPERTY_LABELS: Record<string, string> = {
  "2H": "Two-Handed", F: "Finesse", L: "Light", T: "Thrown",
  V: "Versatile", R: "Reach", H: "Heavy", A: "Ammunition",
  LD: "Loading", S: "Special",
};

const DMG_TYPE_LABELS: Record<string, string> = {
  S: "Slashing", P: "Piercing", B: "Bludgeoning",
  F: "Fire", C: "Cold", L: "Lightning", A: "Acid",
  N: "Necrotic", R: "Radiant", T: "Thunder",
  PS: "Psychic", PO: "Poison", FO: "Force",
};

function fmtDamage(dmg1: string | null, dmg2: string | null, dmgType: string | null): string | null {
  const dice = dmg2 || dmg1 || null;
  const typeLabel = DMG_TYPE_LABELS[dmgType ?? ""] ?? dmgType ?? null;
  if (!dice && !typeLabel) return null;
  if (!typeLabel) return dice;
  if (!dice) return typeLabel;
  return `${dice} ${typeLabel}`;
}

function rarityColor(rarity: string | null): string {
  switch ((rarity ?? "").toLowerCase()) {
    case "common":    return C.muted;
    case "uncommon":  return "#1eff00";
    case "rare":      return "#0070dd";
    case "very rare": return "#a335ee";
    case "legendary": return "#ff8000";
    case "artifact":  return "#e6cc80";
    default:          return C.muted;
  }
}

function hasStealthDisadvantage(item: { stealthDisadvantage?: boolean; text?: string | string[] | null }): boolean {
  if (item.stealthDisadvantage) return true;
  const text = Array.isArray(item.text) ? item.text.join("\n") : String(item.text ?? "");
  return /disadvantage on stealth/i.test(text);
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 999,
      border: `1px solid ${color}33`, background: `${color}1a`,
      color, fontSize: "var(--fs-small)", fontWeight: 700,
    }}>{label}</span>
  );
}

function StatChip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 6,
      border: `1px solid ${color}44`, background: `${color}18`,
      color, fontSize: "var(--fs-small)", fontWeight: 700,
    }}>{label}</span>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function ItemDetailPanel(props: { itemId: string }) {
  const [item, setItem] = React.useState<ItemFull | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!props.itemId) { setItem(null); return; }
    setBusy(true);
    api<ItemFull>(`/api/compendium/items/${encodeURIComponent(props.itemId)}`)
      .then((d) => { if (!cancelled) setItem(d ?? null); })
      .catch(() => { if (!cancelled) setItem(null); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [props.itemId]);

  const meta = item
    ? [item.rarity ? titleCase(item.rarity) : null, item.type, item.attunement ? "Requires Attunement" : null]
        .filter(Boolean).join(" • ")
    : "";

  const textParagraphs: string[] = item
    ? Array.isArray(item.text) ? item.text : [item.text ?? ""]
    : [];

  const dmgLabel = item ? fmtDamage(item.dmg1, item.dmg2, item.dmgType) : null;
  const propertyLabels = item ? (item.properties ?? []).map((p) => PROPERTY_LABELS[p] ?? p) : [];
  const hasWeaponStats = dmgLabel || propertyLabels.length > 0 || (item?.weight ?? null) !== null || (item?.value ?? null) !== null || (item?.ac ?? null) !== null || hasStealthDisadvantage(item ?? {});
  const hasModifiers = (item?.modifiers ?? []).length > 0;

  return (
    <Panel
      title={item ? item.name : "Item"}
      actions={<div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{busy ? "Loading…" : meta}</div>}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}
    >
      {!item ? (
        <div style={{ color: C.muted }}>Pick an item on the left to view details.</div>
      ) : (
        <>
          {/* Rarity / magic / attunement tags */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {item.magic && <Tag label="Magic" color="#a335ee" />}
            {item.attunement && <Tag label="Attunement" color={C.accentHl} />}
            {item.rarity && <Tag label={titleCase(item.rarity)} color={rarityColor(item.rarity)} />}
            {hasStealthDisadvantage(item) && <Tag label="D" color={C.colorPinkRed} />}
          </div>

          {/* Weapon stats row */}
          {hasWeaponStats && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {dmgLabel && <StatChip label={dmgLabel} color={C.colorPinkRed} />}
              {propertyLabels.map((p) => (
                <StatChip key={p} label={p} color="#94a3b8" />
              ))}
              {item.ac != null && <StatChip label={`AC ${item.ac}`} color={C.colorMagic} />}
              {hasStealthDisadvantage(item) && <StatChip label="Stealth D" color={C.colorPinkRed} />}
              {item.weight != null && (
                <StatChip label={`${item.weight} lb`} color="#64748b" />
              )}
              {item.value != null && <StatChip label={`${item.value} gp`} color="#64748b" />}
            </div>
          )}

          {/* Modifier chips */}
          {hasModifiers && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {item.modifiers.map((m, i) => (
                <StatChip key={i} label={m.text} color={C.colorMagic} />
              ))}
            </div>
          )}

          {/* Description */}
          <div style={{
            flex: 1, minHeight: 0, overflowY: "auto",
            border: `1px solid ${C.panelBorder}`, borderRadius: 12,
            padding: 10, whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: "var(--fs-subtitle)",
          }}>
            {textParagraphs.join("\n\n") || <span style={{ color: C.muted }}>No description.</span>}
          </div>
        </>
      )}
    </Panel>
  );
}
