import { parsePreparedSpellProgression } from "../../lib/preparedSpellProgression.js";
import { parseBackgroundEquipmentOptions } from "./backgroundEquipment.js";
import { parseBackgroundProficiencies } from "../../lib/proficiencyConstants.js";
import { asArray, asText, normalizeKey } from "../../lib/text.js";
import { assertKnownXmlKeys, assertKnownXmlKeysEach } from "./xmlFieldGuard.js";
import { type XmlObject, RACE_TRAIT_KNOWN_KEYS, RACE_ROLL_KNOWN_KEYS, parseTraitScalingRolls } from "./importXmlHelpers.shared.js";

const BACKGROUND_KNOWN_KEYS = ["name", "proficiency", "trait", "equipment"] as const;
const BACKGROUND_EQUIPMENT_ITEM_KNOWN_KEYS = ["#text", "@_count"] as const;

export function buildBackgroundImportData(background: XmlObject | null | undefined, warnings?: string[]) {
  const name = (asText(background?.name) || "Unknown").trim();
  const nameKey = normalizeKey(name);
  const id = `bg_${nameKey.replace(/\s/g, "_")}`;
  const ctx = { entityType: "background", entityName: name };
  assertKnownXmlKeys(background, BACKGROUND_KNOWN_KEYS, { ...ctx, path: "<background>" }, warnings);

  const traits = asArray<XmlObject>(background?.trait as XmlObject | XmlObject[] | null | undefined).map((trait) => {
    assertKnownXmlKeys(trait, RACE_TRAIT_KNOWN_KEYS, { ...ctx, path: "<trait>" }, warnings);
    assertKnownXmlKeysEach(trait?.roll, RACE_ROLL_KNOWN_KEYS, { ...ctx, path: "<roll>" }, warnings);
    const text = asText(trait?.text) || "";
    return {
      name: asText(trait?.name) || "",
      text,
      category: trait?.["@_category"] ? asText(trait["@_category"]) : null,
      scalingRolls: parseTraitScalingRolls(trait?.roll),
      preparedSpellProgression: parsePreparedSpellProgression(text),
    };
  });

  const proficiencies = parseBackgroundProficiencies({
    proficiency: asText(background?.proficiency) || "",
    trait: asArray(background?.trait),
  });

  let equipment = "";
  const equipTrait = traits.find((trait) =>
    /^(?:(?:starting|choose)\s+)?equipment$/i.test(trait.name.trim()));
  if (equipTrait) {
    equipment = equipTrait.text.replace(/Source:.*$/gim, "").trim();
  } else if (background?.equipment) {
    const eq = background.equipment;
    if (typeof eq === "string") {
      equipment = eq.trim();
    } else {
      const items = asArray<unknown>(((eq as XmlObject)?.item as unknown[] | unknown | null | undefined))
        .map((it) => {
          assertKnownXmlKeys(it, BACKGROUND_EQUIPMENT_ITEM_KNOWN_KEYS, { ...ctx, path: "<equipment><item>" }, warnings);
          const count = (it as XmlObject)?.["@_count"];
          const itemName = asText(it) || "";
          return count ? `${count}× ${itemName}` : itemName;
        })
        .filter(Boolean);
      if (items.length > 0) equipment = items.join(", ");
      else equipment = asText(eq) || "";
    }
  }

  const embeddedFeatNames = traits
    .map((trait) => {
      const traitName = String(trait?.name ?? "").trim();
      return traitName.match(/^Feat:\s*(.+)$/i)?.[1]?.trim() ?? null;
    })
    .filter((name): name is string => Boolean(name));

  return {
    data: {
      id,
      name,
      nameKey,
      name_key: nameKey,
      proficiency: asText(background?.proficiency) || "",
      proficiencies,
      traits,
      equipment,
      equipmentOptions: parseBackgroundEquipmentOptions(equipment),
    },
    embeddedFeatNames,
  };
}
