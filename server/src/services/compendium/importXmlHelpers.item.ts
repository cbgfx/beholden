import { asArray, asText, normalizeKey } from "../../lib/text.js";
import { assertKnownXmlKeys, assertKnownXmlKeysEach } from "./xmlFieldGuard.js";
import { type XmlObject } from "./importXmlHelpers.shared.js";

type XmlModifierDetail = { category: string; text: string };
type XmlItemJson = {
  id: string;
  name: string;
  name_key: string;
  nameKey: string;
  rarity: string;
  type: string;
  type_key: string;
  typeKey: string;
  attunement: boolean;
  magic: boolean;
  equippable: boolean;
  weight: number | null;
  value: number | null;
  proficiency: string | null;
  blob: {
    ac: number | null;
    stealthDisadvantage: boolean;
    strengthRequirement: number | null;
    dmg1: string | null;
    dmg2: string | null;
    dmgType: string | null;
    range: string | null;
    properties: string[];
    modifiers: XmlModifierDetail[];
    detail: string | null;
    attunementRequirements: string | null;
    rolls: Array<{ description: string | null; formula: string }>;
    text: string[];
  };
};

const ITEM_KNOWN_KEYS = [
  "name", "type", "detail", "magic", "dmg1", "dmg2", "dmgType",
  "weight", "value", "ac", "strength", "stealth", "property",
  "modifier", "text", "range", "roll",
  // #text: inline text content at the <item> root level when the element has mixed content;
  // currently not extracted (item descriptions live in <text> children), tracked as a known gap.
  "#text",
] as const;
const ITEM_MODIFIER_KNOWN_KEYS = ["@_category", "#text"] as const;
const ITEM_ROLL_KNOWN_KEYS = ["@_description", "#text"] as const;

export function xmlItemToJson(it: XmlObject | null | undefined, warnings?: string[]): XmlItemJson | null {
  const name = String(it?.name ?? "Unknown").trim();
  if (!name) return null;
  assertKnownXmlKeys(it, ITEM_KNOWN_KEYS, { entityType: "item", entityName: name, path: "<item>" }, warnings);
  assertKnownXmlKeysEach(it?.modifier, ITEM_MODIFIER_KNOWN_KEYS, { entityType: "item", entityName: name, path: "<modifier>" }, warnings);
  assertKnownXmlKeysEach(it?.roll, ITEM_ROLL_KNOWN_KEYS, { entityType: "item", entityName: name, path: "<roll>" }, warnings);
  const nameKey = normalizeKey(name);
  const id = `i_${nameKey.replace(/\s/g, "_")}`;

  const typeCode = it?.type ?? null;
  const { type, typeKey } = mapItemType(typeCode);
  const text = asArray<unknown>(it?.text as unknown[] | unknown | null | undefined)
    .map((t) => (t == null ? "" : String(t)).trim())
    .filter((t: string) => t.length > 0);

  const {
    rarity,
    attunement,
    attunementRequirements,
    inferredMagic,
  } = parseItemDetail(it?.detail, name, text);
  const magicRaw = String(it?.magic ?? "").trim().toUpperCase();
  const explicitMagic = magicRaw === "1" || magicRaw === "YES" || magicRaw === "TRUE";
  const magic = explicitMagic || inferredMagic;
  const dmg1 = it?.dmg1 != null ? String(it.dmg1).trim() : null;
  const dmg2 = it?.dmg2 != null ? String(it.dmg2).trim() : null;
  const dmgType = it?.dmgType != null ? String(it.dmgType).trim() : null;
  const weight = it?.weight != null ? Number(it.weight) : null;
  const value = it?.value != null ? Number(it.value) : null;
  const ac = it?.ac != null ? Number(it.ac) : null;
  const strengthRequirement = it?.strength != null ? Number(it.strength) : null;
  const stealthDisadvantage = String(it?.stealth ?? "").trim().toUpperCase() === "YES";
  const propertyRaw = it?.property != null ? String(it.property).trim() : "";
  const properties = propertyRaw ? propertyRaw.split(",").map((p: string) => p.trim()).filter(Boolean) : [];
  const modifiers = asArray<unknown>(it?.modifier as unknown[] | unknown | null | undefined)
    .map<XmlModifierDetail>((m) =>
      typeof m === "string"
        ? { category: "", text: m }
        : { category: String((m as XmlObject)?.["@_category"] ?? ""), text: asText((m as XmlObject)?.["#text"] ?? m) },
    )
    .filter((m) => m.text.length > 0);

  const fullText = text.join("\n");
  const equippable = inferItemEquippable(type, fullText);
  const proficiencyMatch = fullText.match(/^Proficiency:\s*(.+)$/im);
  const proficiency = proficiencyMatch?.[1]?.trim() || null;

  const blob = {
    ac: Number.isFinite(ac) ? ac : null,
    stealthDisadvantage,
    strengthRequirement: Number.isFinite(strengthRequirement) ? strengthRequirement : null,
    dmg1: dmg1 || null,
    dmg2: dmg2 || null,
    dmgType: dmgType || null,
    range: asText(it?.range) || null,
    properties,
    modifiers,
    detail: asText(it?.detail) || null,
    attunementRequirements,
    rolls: asArray<unknown>(it?.roll as unknown[] | unknown | null | undefined)
      .map((roll) => ({
        description: typeof roll === "string"
          ? null
          : asText((roll as XmlObject)?.["@_description"]) || null,
        formula: typeof roll === "string"
          ? roll.trim()
          : asText((roll as XmlObject)?.["#text"] ?? roll),
      }))
      .filter((roll) => roll.formula),
    text,
  };

  return {
    id,
    name,
    name_key: nameKey,
    nameKey,
    rarity,
    type,
    type_key: typeKey,
    typeKey,
    attunement,
    magic,
    equippable,
    weight: Number.isFinite(weight) ? weight : null,
    value: Number.isFinite(value) ? value : null,
    proficiency,
    blob,
  };
}

function parseItemDetail(detailRaw: unknown, nameRaw?: unknown, textRaw?: unknown): {
  rarity: string;
  attunement: boolean;
  attunementRequirements: string | null;
  inferredMagic: boolean;
} {
  const detail = String(detailRaw ?? "").trim();
  const name = String(nameRaw ?? "").trim();
  const textBody = Array.isArray(textRaw) ? textRaw.join(" ") : String(textRaw ?? "");
  const lower = detail.toLowerCase();
  const rarityList = ["very rare", "legendary", "artifact", "uncommon", "common", "rare"];

  let explicitRarity: string | null = null;
  for (const rarity of rarityList) {
    const rarityPattern = new RegExp(`(^|[^a-z])${rarity.replace(/\s+/g, "\\s+")}([^a-z]|$)`, "i");
    if (rarityPattern.test(lower)) {
      explicitRarity = rarity;
      break;
    }
  }

  const attunement = /requires\s+attunement|attunement\s*\)/i.test(detail);
  const attunementRequirements = detail.match(
    /requires\s+attunement(?:\s+by\s+([^)]+))?/iu,
  )?.[1]?.trim() ?? null;
  if (explicitRarity !== null) {
    return {
      rarity: explicitRarity,
      attunement,
      attunementRequirements,
      inferredMagic: false,
    };
  }

  const bonusText = `${name} ${detail} ${textBody}`;
  let rarity = "common";
  let inferredMagic = false;
  if (/\+3\b/.test(bonusText)) {
    rarity = "very rare";
    inferredMagic = true;
  } else if (/\+2\b/.test(bonusText)) {
    rarity = "rare";
    inferredMagic = true;
  } else if (/\+1\b/.test(bonusText)) {
    rarity = "uncommon";
    inferredMagic = true;
  } else if (attunement) {
    rarity = "uncommon";
    inferredMagic = true;
  }

  return { rarity, attunement, attunementRequirements, inferredMagic };
}

function inferItemEquippable(type: string, fullText: string): boolean {
  if (/^(ring|rod|wand|wondrous)$/i.test(type)) return true;
  if (/while (?:you (?:are )?)?(?:wear(?:ing)?|hold(?:ing)?|wield(?:ing)?)/i.test(fullText)) return true;
  return false;
}

function mapItemType(codeRaw: unknown): { type: string; typeKey: string } {
  const code = String(codeRaw ?? "").trim().toUpperCase();
  const map: Record<string, string> = {
    LA: "Light Armor",
    MA: "Medium Armor",
    HA: "Heavy Armor",
    S: "Shield",
    M: "Melee Weapon",
    R: "Ranged Weapon",
    A: "Ammo",
    $: "Currency",
    G: "Adventuring Gear",
    P: "Potion",
    SC: "Scroll",
    W: "Wondrous",
    WD: "Wand",
    RD: "Rod",
    ST: "Staff",
    RG: "Ring",
  };
  const type = map[code] ?? "Other";
  return { type, typeKey: normalizeKey(type) };
}
