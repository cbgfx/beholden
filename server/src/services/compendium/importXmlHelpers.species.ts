import {
  parsePreparedSpellProgression,
  parseSpeciesSpellProgression,
} from "../../lib/preparedSpellProgression.js";
import { parseRaceChoices } from "../../lib/proficiencyConstants.js";
import { asArray, asText, extractSourceLine, normalizeKey, stripSourceLine } from "../../lib/text.js";
import { assertKnownXmlKeys, assertKnownXmlKeysEach } from "./xmlFieldGuard.js";
import { type XmlObject, RACE_TRAIT_KNOWN_KEYS, RACE_ROLL_KNOWN_KEYS, parseTraitScalingRolls } from "./importXmlHelpers.shared.js";

const RACE_KNOWN_KEYS = [
  "name", "size", "speed", "spellAbility", "resist", "trait",
] as const;

export function buildRaceImportData(race: XmlObject | null | undefined, warnings?: string[]) {
  const name = (asText(race?.name) || "Unknown").trim();
  const nameKey = normalizeKey(name);
  const id = `r_${nameKey.replace(/\s/g, "_")}`;
  const speed = race?.speed != null ? Number(race.speed) : null;
  const size = asText(race?.size) || null;
  const ctx = { entityType: "species", entityName: name };
  assertKnownXmlKeys(race, RACE_KNOWN_KEYS, { ...ctx, path: "<race>" }, warnings);

  const rawTraitObjects = asArray<XmlObject>(race?.trait as XmlObject | XmlObject[] | null | undefined);
  const source = rawTraitObjects.map((trait) => extractSourceLine(asText(trait?.text) || "")).find(Boolean) ?? null;
  const traits = rawTraitObjects.map((trait) => {
    assertKnownXmlKeys(trait, RACE_TRAIT_KNOWN_KEYS, { ...ctx, path: "<trait>" }, warnings);
    assertKnownXmlKeysEach(trait?.roll, RACE_ROLL_KNOWN_KEYS, { ...ctx, path: "<roll>" }, warnings);
    const text = stripSourceLine(asText(trait?.text) || "");
    const traitName = asText(trait?.name) || "";
    const tableProgression = parsePreparedSpellProgression(text);
    return {
      name: traitName,
      text,
      category: trait?.["@_category"] ? asText(trait["@_category"]) : null,
      scalingRolls: parseTraitScalingRolls(trait?.roll),
      preparedSpellProgression:
        tableProgression.length > 0
          ? tableProgression
          : parseSpeciesSpellProgression(text, traitName),
    };
  });

  const visionTypes = ["Darkvision", "Blindsight", "Truesight", "Tremorsense"];
  const vision: { type: string; range: number }[] = [];
  for (const trait of traits) {
    const visionType = visionTypes.find((v) => v.toLowerCase() === trait.name.toLowerCase().trim());
    if (visionType) {
      const rangeMatch = trait.text.match(/(\d+)\s*(?:feet?|ft\.?)/i);
      const range = rangeMatch?.[1] ? parseInt(rangeMatch[1], 10) : 60;
      vision.push({ type: visionType, range });
    }
  }

  return {
    id,
    name,
    nameKey,
    name_key: nameKey,
    size,
    speed,
    source,
    spellAbility: asText(race?.spellAbility) || null,
    resist: asText(race?.resist) || null,
    vision,
    parsedChoices: parseRaceChoices(
      traits.map((t) => ({ name: t.name, text: t.text })),
    ),
    traits,
  };
}
