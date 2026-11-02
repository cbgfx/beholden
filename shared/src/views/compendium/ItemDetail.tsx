import { useUiTranslation } from "../../i18n/useUiTranslation";
import { formatItemDamageType, formatItemProperty, itemModifierLabel, type CompendiumItemDetail } from "../../domain/items";
import { titleCase } from "../../domain/text/titleCase";
import { rarityColor } from "../../ui/RarityDot";
import { useCompendiumHost, type Ruleset } from "./CompendiumHost";
import { COMPENDIUM_COLORS as C, CompendiumTag } from "./compendiumStyle";
import { DetailBody, DetailFacts, DetailFooter, DetailHeader, DetailProse, splitDescription, type DetailFact } from "./DetailLayout";
import { entryPath, useCompendiumEntry } from "./useCompendiumEntry";

/** "1d8 / 1d10 Slashing" from the one- and two-handed dice and the damage type code. */
function damageLabel(dmg1: string | null, dmg2: string | null, dmgType: string | null): string | null {
  const dice = [dmg1, dmg2 && dmg2 !== dmg1 ? dmg2 : null].filter(Boolean).join(" / ") || null;
  const type = formatItemDamageType(dmgType);
  if (!dice) return type;
  return type ? `${dice} ${type}` : dice;
}

export function ItemDetail(props: { itemId: string; ruleset?: Ruleset | null }) {
  const translateUi = useUiTranslation("sharedUi");
  const { Panel, revision } = useCompendiumHost();
  const { data: item, busy, error } = useCompendiumEntry<CompendiumItemDetail>(entryPath("/api/compendium/items", props.itemId, props.ruleset), revision);

  const facts: DetailFact[] = [];
  if (item) {
    const damage = damageLabel(item.dmg1, item.dmg2, item.dmgType);
    const properties = (item.properties ?? []).map(formatItemProperty).filter(Boolean);
    const modifiers = (item.modifiers ?? []).map(itemModifierLabel).filter((label): label is string => Boolean(label));
    if (damage) facts.push({ label: translateUi("Damage"), value: damage });
    if (properties.length) facts.push({ label: translateUi("Properties"), value: properties.join(", ") });
    if (item.ac != null) {
      facts.push({ label: translateUi("Armor Class"), value: item.ac, note: item.stealthDisadvantage ? translateUi("Stealth Disadvantage") : null });
    } else if (item.stealthDisadvantage) {
      facts.push({ label: translateUi("Stealth"), value: translateUi("Disadvantage") });
    }
    if (modifiers.length) facts.push({ label: translateUi("Bonuses"), value: modifiers.join(", ") });
    if (item.attunement) facts.push({ label: translateUi("Attunement"), value: translateUi("Required") });
    if (item.weight != null) facts.push({ label: translateUi("Weight"), value: translateUi("{{value1}} lb", { value1: item.weight }) });
    if (item.value != null) facts.push({ label: translateUi("Value"), value: translateUi("{{value1}} gp", { value1: item.value }) });
  }
  const description = splitDescription(item?.text);
  const source = item?.source ?? description.source;
  const subtitle = item ? (
    <>
      {item.rarity ? <span style={{ color: rarityColor(item.rarity, C.muted) }}>{titleCase(item.rarity)}</span> : null}
      {item.rarity && item.type ? " • " : null}
      {item.type}
    </>
  ) : null;

  return (
    <Panel
      title={translateUi("Item")}
      actions={busy ? <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{translateUi("Loading...")}</div> : null}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0, overflow: "auto", WebkitOverflowScrolling: "touch", touchAction: "pan-y", overscrollBehavior: "contain" }}
    >
      {error ? (
        <div style={{ color: C.red }}>{translateUi("Could not load this item: {{value1}}", { value1: error })}</div>
      ) : !item ? (
        <div style={{ color: C.muted, lineHeight: 1.4 }}>{busy ? translateUi("Loading...") : translateUi("Pick an item on the left to view details.")}</div>
      ) : (
        <DetailBody>
          <DetailHeader
            name={item.name}
            subtitle={item.rarity || item.type ? subtitle : null}
            aside={item.magic ? <CompendiumTag label={translateUi("Magic")} color={C.colorMagic} /> : null}
          />
          <DetailFacts facts={facts} />
          <DetailProse label={translateUi("Description")} paragraphs={description.paragraphs} empty={translateUi("No description.")} />
          <DetailFooter>{[source, item.ruleset].filter(Boolean).join(" · ")}</DetailFooter>
        </DetailBody>
      )}
    </Panel>
  );
}
