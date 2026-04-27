import type Database from "better-sqlite3";

import { parseAttackFromText } from "../../lib/attacks.js";
import { parseFeat } from "../../lib/featParser.js";
import { inferRuleset } from "../../lib/inferRuleset.js";
import { parsePreparedSpellProgression } from "../../lib/preparedSpellProgression.js";
import { parseBackgroundProficiencies, parseRaceChoicesByRuleset } from "../../lib/proficiencyConstants.js";
import { asArray, asText, normalizeKey, parseCrValue } from "../../lib/text.js";
import { pruneFeatBlob } from "./blobHygiene.js";
import { normalizeHp } from "./normalizeHp.js";

type XmlObject = Record<string, unknown>;
type XmlModifierDetail = { category: string; text: string };
type XmlItemJson = {
  id: string;
  name: string;
  ruleset: string | null;
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
    dmg1: string | null;
    dmg2: string | null;
    dmgType: string | null;
    properties: string[];
    modifiers: XmlModifierDetail[];
    text: string[];
  };
};

export function createFeatUpserter(
  featStmt: Database.Statement,
) {
  return (args: {
    name: string;
    text: string;
    prerequisite?: string | null;
    proficiency?: string | null;
    special?: string | null;
    modifierDetails?: Array<{ category: string; text: string }>;
  }) => {
    const name = args.name.trim();
    const nameKey = normalizeKey(name);
    const id = `f_${nameKey.replace(/\s/g, "_")}`;
    const modifierDetails = (args.modifierDetails ?? []).filter((m) => m.text.length > 0);
    const modifiers = modifierDetails.map((m) => m.text);
    const prerequisite = args.prerequisite ?? null;
    const proficiency = args.proficiency ?? null;
    const special = args.special ?? null;
    const parsed = parseFeat({
      name,
      text: args.text,
      prerequisite,
      proficiency,
      modifiers: modifierDetails,
    });
    const data = {
      id,
      name,
      ruleset: inferRuleset(name, args.text, prerequisite, special),
      nameKey,
      name_key: nameKey,
      text: args.text,
      prerequisite,
      proficiency,
      special,
      modifiers,
      modifierDetails,
      parsed,
    };

    featStmt.run(id, name, nameKey, JSON.stringify(pruneFeatBlob(data as Record<string, unknown>)));
  };
}

export function buildMonsterImportData(monster: XmlObject | null | undefined) {
  const name = (asText(monster?.name) || "Unknown").trim();
  const nameKey = normalizeKey(name);
  const typeFull = monster?.type != null ? String(monster.type) : null;
  const typeKey =
    typeFull
      ? String(typeFull)
          .trim()
          .match(/^([a-zA-Z]+)/)?.[1]
          ?.toLowerCase() ?? null
      : null;
  const crRaw = monster?.cr != null ? parseCrValue(monster.cr) : null;
  const crNumeric = Number.isFinite(crRaw) ? crRaw : null;
  const crStr =
    monster?.cr != null
      ? String(monster.cr).trim().includes("/")
        ? String(monster.cr).trim()
        : crNumeric != null
          ? String(crNumeric)
          : null
      : null;

  return {
    id: `m_${nameKey}`,
    name,
    ruleset: inferRuleset(name, asText(monster?.environment), asText(monster?.type)),
    nameKey,
    name_key: nameKey,
    cr: crStr,
    cr_numeric: crNumeric,
    typeFull,
    type_full: typeFull,
    typeKey,
    type_key: typeKey,
    size: monster?.size ?? null,
    environment: monster?.environment ?? null,
    source: null,
    ac: monster?.ac ?? null,
    hp: normalizeHp(monster?.hp ?? null),
    speed: monster?.speed ?? null,
    str: monster?.str ?? null,
    dex: monster?.dex ?? null,
    con: monster?.con ?? null,
    int: monster?.int ?? null,
    wis: monster?.wis ?? null,
    cha: monster?.cha ?? null,
    save: monster?.save ?? null,
    skill: monster?.skill ?? null,
    senses: monster?.senses ?? null,
    languages: monster?.languages ?? null,
    immune: monster?.immune ?? null,
    resist: monster?.resist ?? null,
    vulnerable: monster?.vulnerable ?? null,
    conditionImmune: monster?.conditionImmune ?? null,
    trait: asArray(monster?.trait),
    action: asArray<XmlObject>(monster?.action as XmlObject | XmlObject[] | null | undefined).map((action) => {
      const actionName = action?.name ?? action?.title ?? null;
      const text = action?.text ?? action?.description ?? "";
      const attack = parseAttackFromText(text);
      return { ...action, name: actionName, text, attack };
    }),
    reaction: asArray(monster?.reaction),
    legendary: asArray(monster?.legendary),
    spellcasting: asArray(monster?.spellcasting),
    spells: asArray(monster?.spells),
  };
}

export function buildSpellImportData(spell: XmlObject | null | undefined) {
  const displayName = (asText(spell?.name) || "Unknown").trim();
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
  const texts = asArray(spell?.text)
    .map((t) => (t == null ? "" : String(t)).trim())
    .filter((t) => t.length > 0);

  return {
    id,
    name: displayName,
    ruleset: inferRuleset(displayName, texts.join("\n")),
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
    text: texts,
  };
}

export function buildClassImportData(cls: XmlObject | null | undefined) {
  const name = (asText(cls?.name) || "Unknown").trim();
  const nameKey = normalizeKey(name);
  const id = `c_${nameKey.replace(/\s/g, "_")}`;
  const hd = cls?.hd != null ? Number(cls.hd) : null;

  const autolevels = asArray<XmlObject>(cls?.autolevel as XmlObject | XmlObject[] | null | undefined).map((al) => {
    const level = al?.["@_level"] != null ? Number(al["@_level"]) : null;
    const scoreImprovement = al?.["@_scoreImprovement"] === "YES";
    const features = asArray<XmlObject>(al?.feature as XmlObject | XmlObject[] | null | undefined).map((feature) => ({
      name: asText(feature?.name) || "",
      text: asText(feature?.text) || "",
      optional: feature?.["@_optional"] === "YES",
      special: feature?.special ? asText(feature.special) : null,
      modifier: feature?.modifier
        ? asArray<unknown>(feature.modifier as unknown[] | unknown | null | undefined).map((m) => (typeof m === "string" ? m : asText((m as XmlObject)?.["#text"] ?? m)))
        : [],
      preparedSpellProgression: parsePreparedSpellProgression(asText(feature?.text) || ""),
    }));
    const counters = asArray<XmlObject>(al?.counter as XmlObject | XmlObject[] | null | undefined).map((counter) => ({
      name: asText(counter?.name) || "",
      value: counter?.value != null ? Number(counter.value) : 0,
      reset: asText(counter?.reset) || "L",
      subclass: counter?.subclass ? asText(counter.subclass) : null,
    }));
    const slotsRaw = al?.slots != null ? String(al.slots).trim() : null;
    const slots = slotsRaw ? slotsRaw.split(",").map((n) => parseInt(n.trim(), 10) || 0) : null;
    return { level, scoreImprovement, features, counters, slots };
  });

  return {
    id,
    name,
    ruleset: inferRuleset(name),
    nameKey,
    name_key: nameKey,
    hd,
    proficiency: asText(cls?.proficiency) || "",
    numSkills: cls?.numSkills != null ? Number(cls.numSkills) : 0,
    armor: asText(cls?.armor) || "",
    weapons: asText(cls?.weapons) || "",
    tools: asText(cls?.tools) || "",
    slotsReset: asText(cls?.slotsReset) || "L",
    description: asText((asArray<XmlObject>(cls?.trait as XmlObject | XmlObject[] | null | undefined)[0] ?? {})?.text) || "",
    autolevels,
  };
}

export function buildRaceImportData(race: XmlObject | null | undefined) {
  const name = (asText(race?.name) || "Unknown").trim();
  const nameKey = normalizeKey(name);
  const id = `r_${nameKey.replace(/\s/g, "_")}`;
  const speed = race?.speed != null ? Number(race.speed) : null;
  const size = asText(race?.size) || null;

  const traits = asArray<XmlObject>(race?.trait as XmlObject | XmlObject[] | null | undefined).map((trait) => ({
    name: asText(trait?.name) || "",
    text: asText(trait?.text) || "",
    category: trait?.["@_category"] ? asText(trait["@_category"]) : null,
    modifier: trait?.modifier
      ? asArray<unknown>(trait.modifier as unknown[] | unknown | null | undefined).map((m) => (typeof m === "string" ? m : asText((m as XmlObject)?.["#text"] ?? m)))
      : [],
    preparedSpellProgression: parsePreparedSpellProgression(asText(trait?.text) || ""),
  }));

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

  const raceRuleset = inferRuleset(name, traits.map((t) => `${t.name}\n${t.text}`).join("\n"));
  return {
    id,
    name,
    ruleset: raceRuleset,
    nameKey,
    name_key: nameKey,
    size,
    speed,
    resist: asText(race?.resist) || null,
    vision,
    parsedChoices: parseRaceChoicesByRuleset(
      raceRuleset,
      traits.map((t) => ({ name: t.name, text: t.text })),
    ),
    traits,
  };
}

export function buildBackgroundImportData(background: XmlObject | null | undefined) {
  const name = (asText(background?.name) || "Unknown").trim();
  const nameKey = normalizeKey(name);
  const id = `bg_${nameKey.replace(/\s/g, "_")}`;

  const traits = asArray<XmlObject>(background?.trait as XmlObject | XmlObject[] | null | undefined).map((trait) => ({
    name: asText(trait?.name) || "",
    text: asText(trait?.text) || "",
    preparedSpellProgression: parsePreparedSpellProgression(asText(trait?.text) || ""),
  }));

  const bgRuleset = inferRuleset(name, traits.map((t) => `${t.name}\n${t.text}`).join("\n"));
  const proficiencies = parseBackgroundProficiencies({
    proficiency: asText(background?.proficiency) || "",
    trait: asArray(background?.trait),
    ruleset: bgRuleset,
  });

  let equipment = "";
  const equipTrait = traits.find((trait) => /(?:starting|choose)\s+equipment/i.test(trait.name));
  if (equipTrait) {
    equipment = equipTrait.text.replace(/Source:.*$/gim, "").trim();
  } else if (background?.equipment) {
    const eq = background.equipment;
    if (typeof eq === "string") {
      equipment = eq.trim();
    } else {
      const items = asArray<unknown>(((eq as XmlObject)?.item as unknown[] | unknown | null | undefined))
        .map((it) => {
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
      ruleset: bgRuleset,
      nameKey,
      name_key: nameKey,
      proficiency: asText(background?.proficiency) || "",
      proficiencies,
      traits,
      equipment,
    },
    embeddedFeatNames,
  };
}

export function xmlItemToJson(it: XmlObject | null | undefined): XmlItemJson | null {
  const name = String(it?.name ?? "Unknown").trim();
  if (!name) return null;
  const nameKey = normalizeKey(name);
  const id = `i_${nameKey.replace(/\s/g, "_")}`;

  const typeCode = it?.type ?? null;
  const { type, typeKey } = mapItemType(typeCode);
  const text = asArray<unknown>(it?.text as unknown[] | unknown | null | undefined)
    .map((t) => (t == null ? "" : String(t)).trim())
    .filter((t: string) => t.length > 0);

  const { rarity, attunement, inferredMagic } = parseItemDetail(it?.detail, name, text);
  const magicRaw = String(it?.magic ?? "").trim().toUpperCase();
  const explicitMagic = magicRaw === "1" || magicRaw === "YES" || magicRaw === "TRUE";
  const magic = explicitMagic || inferredMagic;
  const dmg1 = it?.dmg1 != null ? String(it.dmg1).trim() : null;
  const dmg2 = it?.dmg2 != null ? String(it.dmg2).trim() : null;
  const dmgType = it?.dmgType != null ? String(it.dmgType).trim() : null;
  const weight = it?.weight != null ? Number(it.weight) : null;
  const value = it?.value != null ? Number(it.value) : null;
  const ac = it?.ac != null ? Number(it.ac) : null;
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
    dmg1: dmg1 || null,
    dmg2: dmg2 || null,
    dmgType: dmgType || null,
    properties,
    modifiers,
    text,
  };

  return {
    id,
    name,
    ruleset: inferRuleset(name, it?.detail, fullText),
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
  if (explicitRarity !== null) {
    return { rarity: explicitRarity, attunement, inferredMagic: false };
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

  return { rarity, attunement, inferredMagic };
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
