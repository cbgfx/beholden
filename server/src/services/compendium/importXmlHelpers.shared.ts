import { asArray, asText } from "../../lib/text.js";

export type XmlObject = Record<string, unknown>;

export const RACE_TRAIT_KNOWN_KEYS = ["name", "text", "@_category", "roll", "modifier", "special", "proficiency"] as const;
export const RACE_ROLL_KNOWN_KEYS = ["@_description", "@_level", "#text"] as const;

// modifier/special/proficiency appear in WotC 2024 XML trait elements but are
// not surfaced in the app — listed here so the field guard doesn't false-positive.

export function parseTraitScalingRolls(roll: unknown) {
  return asArray<unknown>(roll as unknown[] | unknown | null | undefined)
    .map((r) => ({
      description: typeof r === "string" ? null : asText((r as XmlObject)?.["@_description"]) || null,
      level: typeof r === "string" || !(r as XmlObject)?.["@_level"]
        ? null
        : Number.isFinite(Number((r as XmlObject)["@_level"])) ? Number((r as XmlObject)["@_level"]) : null,
      formula: typeof r === "string" ? r : asText((r as XmlObject)?.["#text"] ?? r),
    }))
    .filter((r) => r.formula);
}
