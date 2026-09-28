import { useUiTranslation } from "../../i18n/useUiTranslation";
import { formatItemDamageType, formatItemProperty, itemModifierLabel, type CompendiumItemDetail } from "../../domain/items";
import { titleCase } from "../../domain/text/titleCase";
import { FormattedText } from "../../ui/FormattedText";
import { rarityColor } from "../../ui/RarityDot";
import { useCompendiumHost, type Ruleset } from "./CompendiumHost";
import { COMPENDIUM_COLORS as C, CompendiumTag } from "./compendiumStyle";
import { entryPath, useCompendiumEntry } from "./useCompendiumEntry";

/** "1d8 Slashing" from the item's damage dice (two-handed dice preferred) and type code. */
function damageLabel(dmg1: string | null, dmg2: string | null, dmgType: string | null): string | null {
  const dice = dmg2 || dmg1 || null;
  const type = formatItemDamageType(dmgType);
  if (!dice) return type;
  return type ? `${dice} ${type}` : dice;
}

/** A square-cornered chip for a number or rule (damage, AC, weight...). */
function StatChip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${color}44`, background: `${color}18`, color, fontSize: "var(--fs-small)", fontWeight: 700 }}>
      {label}
    </span>
  );
}

export function ItemDetail(props: { itemId: string; ruleset?: Ruleset | null }) {
  const translateUi = useUiTranslation("sharedUi");
  const { Panel, revision } = useCompendiumHost();
  const { data: item, busy, error } = useCompendiumEntry<CompendiumItemDetail>(entryPath("/api/compendium/items", props.itemId, props.ruleset), revision);

  const meta = item
    ? [item.rarity ? titleCase(item.rarity) : null, item.type, item.attunement ? translateUi("Requires Attunement") : null].filter(Boolean).join(" • ")
    : "";
  const paragraphs = item ? (Array.isArray(item.text) ? item.text : [item.text ?? ""]).filter((text) => text.trim()) : [];
  const damage = item ? damageLabel(item.dmg1, item.dmg2, item.dmgType) : null;
  const properties = item ? (item.properties ?? []).map(formatItemProperty).filter(Boolean) : [];
  const stealthDisadvantage = item?.stealthDisadvantage === true;
  const hasStats = Boolean(damage || properties.length || item?.ac != null || item?.weight != null || item?.value != null || stealthDisadvantage);
  const modifiers = (item?.modifiers ?? []).map(itemModifierLabel).filter((label): label is string => Boolean(label));

  return (
    <Panel
      title={item ? item.name : translateUi("Item")}
      actions={<div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{busy ? translateUi("Loading...") : meta}</div>}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
    >
      {error ? (
        <div style={{ color: C.red }}>{translateUi("Could not load this item: {{value1}}", { value1: error })}</div>
      ) : !item ? (
        <div style={{ color: C.muted, lineHeight: 1.4 }}>{busy ? translateUi("Loading...") : translateUi("Pick an item on the left to view details.")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0, flex: 1 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {item.magic && <CompendiumTag label={translateUi("Magic")} color={C.colorMagic} />}
            {item.attunement && <CompendiumTag label={translateUi("Attunement")} color={C.highlight} />}
            {item.rarity && <CompendiumTag label={titleCase(item.rarity)} color={rarityColor(item.rarity, C.muted)} />}
          </div>

          {hasStats && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {damage && <StatChip label={damage} color={C.colorPinkRed} />}
              {properties.map((property) => <StatChip key={property} label={property} color="#94a3b8" />)}
              {item.ac != null && <StatChip label={translateUi("AC {{value1}}", { value1: item.ac })} color={C.colorMagic} />}
              {stealthDisadvantage && <StatChip label={translateUi("Stealth Disadvantage")} color={C.colorPinkRed} />}
              {item.weight != null && <StatChip label={translateUi("{{value1}} lb", { value1: item.weight })} color="#64748b" />}
              {item.value != null && <StatChip label={translateUi("{{value1}} gp", { value1: item.value })} color="#64748b" />}
            </div>
          )}

          {modifiers.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {modifiers.map((label, index) => <StatChip key={index} label={label} color={C.colorMagic} />)}
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: `1px solid ${C.panelBorder}`, borderRadius: 12, padding: 10, whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: "var(--fs-subtitle)" }}>
            {paragraphs.length ? <FormattedText text={paragraphs} /> : <span style={{ color: C.muted }}>{translateUi("No description.")}</span>}
          </div>

          {item.source ? (
            <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
              {translateUi("Source: {{value1}} · Ruleset: {{value2}}", { value1: item.source, value2: item.ruleset ?? translateUi("Unknown") })}
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
