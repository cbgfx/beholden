import { parsePreparedSpellProgression } from "../../lib/preparedSpellProgression.js";
import { asArray, asText, extractSourceLine, normalizeKey, stripSourceLine } from "../../lib/text.js";
import { assertKnownXmlKeys, assertKnownXmlKeysEach } from "./xmlFieldGuard.js";
import { type XmlObject } from "./importXmlHelpers.shared.js";

const CLASS_KNOWN_KEYS = [
  "name", "hd", "proficiency", "numSkills", "armor", "weapons", "tools",
  "slotsReset", "spellAbility", "wealth", "trait", "autolevel",
] as const;
// @_subclass is intentionally not read — subclass autolevel features are merged by level;
// the attribute is human-readable annotation only.
const CLASS_AUTOLEVEL_KNOWN_KEYS = ["@_level", "@_scoreImprovement", "@_subclass", "feature", "counter", "slots"] as const;
const CLASS_FEATURE_KNOWN_KEYS = ["name", "text", "special", "modifier", "roll", "proficiency", "@_optional"] as const;
const CLASS_COUNTER_KNOWN_KEYS = ["name", "value", "reset", "subclass"] as const;
const CLASS_MODIFIER_KNOWN_KEYS = ["@_category", "#text"] as const;
const CLASS_ROLL_KNOWN_KEYS = ["@_description", "@_level", "#text"] as const;

function classReset(value: unknown, context: string): "S" | "L" {
  const reset = asText(value || "L").trim().toUpperCase();
  if (reset === "S" || reset === "L") return reset;
  throw new Error(
    `Unsupported class recovery value "${reset}" at ${context}; expected S or L.`,
  );
}

export function buildClassImportData(cls: XmlObject | null | undefined, warnings?: string[]) {
  const name = (asText(cls?.name) || "Unknown").trim();
  const nameKey = normalizeKey(name);
  const id = `c_${nameKey.replace(/\s/g, "_")}`;
  const hd = cls?.hd != null ? Number(cls.hd) : null;
  const ctx = { entityType: "class", entityName: name };
  assertKnownXmlKeys(cls, CLASS_KNOWN_KEYS, { ...ctx, path: "<class>" }, warnings);

  const autolevels = asArray<XmlObject>(cls?.autolevel as XmlObject | XmlObject[] | null | undefined).map((al) => {
    assertKnownXmlKeys(al, CLASS_AUTOLEVEL_KNOWN_KEYS, { ...ctx, path: "<autolevel>" }, warnings);
    const level = al?.["@_level"] != null ? Number(al["@_level"]) : null;
    const scoreImprovement = al?.["@_scoreImprovement"] === "YES";
    const subclass = asText(al?.["@_subclass"]) || null;
    const features = asArray<XmlObject>(al?.feature as XmlObject | XmlObject[] | null | undefined).map((feature) => {
      assertKnownXmlKeys(feature, CLASS_FEATURE_KNOWN_KEYS, { ...ctx, path: "<feature>" }, warnings);
      assertKnownXmlKeysEach(feature?.modifier, CLASS_MODIFIER_KNOWN_KEYS, { ...ctx, path: "<modifier>" }, warnings);
      assertKnownXmlKeysEach(feature?.roll, CLASS_ROLL_KNOWN_KEYS, { ...ctx, path: "<roll>" }, warnings);
      const special = feature?.special ? asText(feature.special) : null;
      const modifiers = feature?.modifier
        ? asArray<unknown>(feature.modifier as unknown[] | unknown | null | undefined)
          .map((modifier) => ({
            kind: "source_modifier",
            category: typeof modifier === "string"
              ? null
              : asText((modifier as XmlObject)?.["@_category"]) || null,
            value: typeof modifier === "string"
              ? modifier
              : asText((modifier as XmlObject)?.["#text"] ?? modifier),
          }))
          .filter((modifier) => modifier.value)
        : [];
      const rolls = feature?.roll
        ? asArray<unknown>(feature.roll as unknown[] | unknown | null | undefined)
          .map((roll) => ({
            kind: "source_roll",
            description: typeof roll === "string"
              ? null
              : asText((roll as XmlObject)?.["@_description"]) || null,
            level: typeof roll === "string"
              ? null
              : Number.isFinite(Number((roll as XmlObject)?.["@_level"]))
                ? Number((roll as XmlObject)?.["@_level"])
                : null,
            value: typeof roll === "string"
              ? roll
              : asText((roll as XmlObject)?.["#text"] ?? roll),
          }))
          .filter((roll) => roll.value)
        : [];
      const proficiency = feature?.proficiency ? asText(feature.proficiency) : null;
      const text = asText(feature?.text) || "";
      const source = extractSourceLine(text);
      const description = stripSourceLine(text);
      return {
        name: asText(feature?.name) || "",
        text: description,
        source,
        subclass,
        optional: feature?.["@_optional"] === "YES",
        effects: [
          ...modifiers,
          ...rolls,
          ...(special ? [{ kind: "source_special", value: special }] : []),
          ...(proficiency ? [{ kind: "source_proficiency", value: proficiency }] : []),
        ],
        preparedSpellProgression: parsePreparedSpellProgression(asText(feature?.text) || ""),
      };
    });
    const counters = asArray<XmlObject>(al?.counter as XmlObject | XmlObject[] | null | undefined).map((counter) => {
      assertKnownXmlKeys(counter, CLASS_COUNTER_KNOWN_KEYS, { ...ctx, path: "<counter>" }, warnings);
      return {
        name: asText(counter?.name) || "",
        value: counter?.value != null ? Number(counter.value) : 0,
        reset: classReset(counter?.reset, `${name} counter "${asText(counter?.name) || "unnamed"}"`),
        subclass: counter?.subclass ? asText(counter.subclass) : null,
      };
    });
    const slotsRaw = al?.slots != null ? String(al.slots).trim() : null;
    const slots = slotsRaw ? slotsRaw.split(",").map((n) => parseInt(n.trim(), 10) || 0) : null;
    return { level, scoreImprovement, features, counters, slots };
  });

  const traits = asArray<XmlObject>(cls?.trait as XmlObject | XmlObject[] | null | undefined)
    .map((trait) => asText(trait?.text))
    .filter(Boolean);
  const source = traits.map((trait) => extractSourceLine(trait)).find(Boolean) ?? null;
  const descriptions = traits.map((trait) => stripSourceLine(trait));

  return {
    id,
    name,
    nameKey,
    name_key: nameKey,
    hd,
    proficiency: asText(cls?.proficiency) || "",
    numSkills: cls?.numSkills != null ? Number(cls.numSkills) : 0,
    armor: asText(cls?.armor) || "",
    weapons: asText(cls?.weapons) || "",
    tools: asText(cls?.tools) || "",
    slotsReset: classReset(cls?.slotsReset, `${name} spell slots`),
    spellAbility: asText(cls?.spellAbility) || null,
    wealth: cls?.wealth != null && Number.isFinite(Number(cls.wealth)) ? Number(cls.wealth) : null,
    source,
    descriptions,
    description: descriptions[0] || "",
    autolevels,
  };
}
