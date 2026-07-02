import {
  asArray,
  asText,
  extractSourceLine,
  normalizeKey,
  stripSourceLine,
} from "../../lib/text.js";
import { assertKnownXmlKeys, assertKnownXmlKeysEach } from "./xmlFieldGuard.js";
import { type XmlObject } from "./importXmlHelpers.shared.js";

const SPELL_KNOWN_KEYS = [
  "name", "level", "school", "time", "range", "components", "duration",
  "classes", "ritual", "roll", "text",
] as const;
const SPELL_ROLL_KNOWN_KEYS = ["@_description", "@_level", "#text"] as const;

export function buildSpellImportData(spell: XmlObject | null | undefined, warnings?: string[]) {
  const displayName = (asText(spell?.name) || "Unknown").trim();
  assertKnownXmlKeys(spell, SPELL_KNOWN_KEYS, { entityType: "spell", entityName: displayName, path: "<spell>" }, warnings);
  assertKnownXmlKeysEach(spell?.roll, SPELL_ROLL_KNOWN_KEYS, { entityType: "spell", entityName: displayName, path: "<roll>" }, warnings);
  const fullKey = normalizeKey(displayName);
  const normalizedName = displayName.replace(/\s*\[[^\]]+\]\s*$/, "").trim() || displayName;
  const baseKey = normalizeKey(normalizedName);
  const id = `s_${fullKey.replace(/\s/g, "_")}`;
  const level = spell?.level != null ? Number(String(spell.level).replace(/[^0-9]/g, "")) : null;
  const levelVal = Number.isFinite(level) ? level : null;
  const schoolVal = asText(spell?.school) || null;
  const componentsVal = asText(spell?.components) || null;
  const durationVal = asText(spell?.duration) || null;
  const classesVal = asText(spell?.classes) || null;
  const ritualRaw = asText(spell?.ritual)?.toLowerCase().trim() ?? "";
  const isRitual = ritualRaw === "yes" || ritualRaw === "1" || ritualRaw === "true" ? 1 : 0;
  const isConcentration = /concentration/i.test(durationVal ?? "") ? 1 : 0;
  const rawText = asArray(spell?.text)
    .map((t) => (t == null ? "" : String(t)).trim())
    .join("\n\n");
  const source = extractSourceLine(rawText) || null;
  const texts = stripSourceLine(rawText).split("\n\n").filter((t) => t.length > 0);

  return {
    id,
    name: displayName,
    nameKey: fullKey,
    name_key: fullKey,
    baseName: normalizedName,
    baseKey,
    base_key: baseKey,
    level: levelVal,
    school: schoolVal,
    ritual: isRitual,
    concentration: isConcentration,
    time: asText(spell?.time) || null,
    range: asText(spell?.range) || null,
    components: componentsVal,
    duration: durationVal,
    classes: classesVal,
    source,
    rolls: (() => {
      const parsed = asArray<unknown>(spell?.roll as unknown[] | unknown | null | undefined)
        .map((roll) => ({
          description: typeof roll === "string"
            ? null
            : asText((roll as XmlObject)?.["@_description"]) || null,
          level: typeof roll === "string" || (roll as XmlObject)?.["@_level"] == null
            ? null
            : Number((roll as XmlObject)["@_level"]),
          formula: typeof roll === "string"
            ? roll.trim()
            : asText((roll as XmlObject)?.["#text"] ?? roll),
        }))
        .filter((roll) => roll.formula && (roll.level == null || Number.isFinite(roll.level)));
      // Multiple rolls sharing the same (description, level) are size-variant stat block data
      // (e.g. Animate Objects 1d4/1d6/1d12 Bludgeoning Damage) — not directly rollable by the
      // caster. Drop the entire group so only unambiguous rolls are stored.
      const groupCount = new Map<string, number>();
      for (const roll of parsed) {
        const key = `${roll.description ?? ""}\0${roll.level ?? ""}`;
        groupCount.set(key, (groupCount.get(key) ?? 0) + 1);
      }
      return parsed.filter((roll) => groupCount.get(`${roll.description ?? ""}\0${roll.level ?? ""}`) === 1);
    })(),
    text: texts,
  };
}
