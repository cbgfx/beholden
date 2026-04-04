import type Database from "better-sqlite3";
import { XMLParser } from "fast-xml-parser";
import { asArray, asText, normalizeKey, parseCrValue } from "../../lib/text.js";
import { parseAttackFromText } from "../../lib/attacks.js";
import { normalizeHp } from "./normalizeHp.js";
import { parseBackgroundProficiencies, parseRaceChoicesByRuleset } from "../../lib/proficiencyConstants.js";
import { parseFeat } from "../../lib/featParser.js";
import { inferRuleset } from "../../lib/inferRuleset.js";
import { parsePreparedSpellProgression } from "../../lib/preparedSpellProgression.js";
import { backfillMonsterSpellRefs } from "./normalizeMonsterSpellRefs.js";

export function importCompendiumXml(args: {
  xml: string;
  db: Database.Database;
}): {
  imported: number;
  total: number;
  items?: number;
  classes?: number;
  races?: number;
  backgrounds?: number;
  feats?: number;
} {
  const { xml, db } = args;
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    isArray: (name) => ["autolevel", "feature", "counter", "modifier", "trait"].includes(name),
  });
  const parsed = parser.parse(xml);
  const comp = parsed?.compendium ?? parsed;
  const monsters = asArray(comp?.monster);
  const spells = asArray(comp?.spell);
  const items = asArray(comp?.item);
  const classes = asArray(comp?.class);
  const races = asArray(comp?.race);
  const backgrounds = asArray(comp?.background);
  const feats = asArray(comp?.feat);

  const monStmt = db.prepare(`
    INSERT OR REPLACE INTO compendium_monsters
      (id, name, name_key, cr, cr_numeric, type_key, type_full, size, environment, data_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const spellStmt = db.prepare(`
    INSERT OR REPLACE INTO compendium_spells
      (id, name, name_key, level, school, ritual, concentration, components, classes, data_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const itemStmt = db.prepare(`
    INSERT OR REPLACE INTO compendium_items
      (id, name, name_key, rarity, type, type_key, attunement, magic, equippable, weight, value, proficiency, data_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const classStmt = db.prepare(`
    INSERT OR REPLACE INTO compendium_classes (id, name, name_key, hd, data_json)
    VALUES (?, ?, ?, ?, ?)
  `);
  const raceStmt = db.prepare(`
    INSERT OR REPLACE INTO compendium_races (id, name, name_key, size, speed, data_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const bgStmt = db.prepare(`
    INSERT OR REPLACE INTO compendium_backgrounds (id, name, name_key, data_json)
    VALUES (?, ?, ?, ?)
  `);
  const featStmt = db.prepare(`
    INSERT OR REPLACE INTO compendium_feats (id, name, name_key, data_json)
    VALUES (?, ?, ?, ?)
  `);

  db.transaction(() => {
    // ── Monsters ────────────────────────────────────────────────────────────
    for (const m of monsters) {
      const name = (asText(m?.name) || "Unknown").trim();
      const nameKey = normalizeKey(name);
      const typeFull = m?.type != null ? String(m.type) : null;
      const typeKey =
        typeFull
          ? String(typeFull)
              .trim()
              .match(/^([a-zA-Z]+)/)?.[1]
              ?.toLowerCase() ?? null
          : null;
      const crRaw = m?.cr != null ? parseCrValue(m.cr) : null;
      const crNumeric = Number.isFinite(crRaw) ? crRaw : null;
      const crStr =
        m?.cr != null
          ? String(m.cr).trim().includes("/")
            ? String(m.cr).trim()
            : crNumeric != null
            ? String(crNumeric)
            : null
          : null;

      const data = {
        id: `m_${nameKey}`,
        name,
        ruleset: inferRuleset(name, asText(m?.environment), asText(m?.type)),
        nameKey,
        name_key: nameKey,
        cr: crStr,
        cr_numeric: crNumeric,
        typeFull,
        type_full: typeFull,
        typeKey,
        type_key: typeKey,
        size: m?.size ?? null,
        environment: m?.environment ?? null,
        source: null,
        ac: m?.ac ?? null,
        hp: normalizeHp(m?.hp ?? null),
        speed: m?.speed ?? null,
        str: m?.str ?? null,
        dex: m?.dex ?? null,
        con: m?.con ?? null,
        int: m?.int ?? null,
        wis: m?.wis ?? null,
        cha: m?.cha ?? null,
        save: m?.save ?? null,
        skill: m?.skill ?? null,
        senses: m?.senses ?? null,
        languages: m?.languages ?? null,
        immune: m?.immune ?? null,
        resist: m?.resist ?? null,
        vulnerable: m?.vulnerable ?? null,
        conditionImmune: m?.conditionImmune ?? null,
        trait: asArray(m?.trait),
        action: asArray(m?.action).map((a: any) => {
          const aName = a?.name ?? a?.title ?? null;
          const text = a?.text ?? a?.description ?? "";
          const attack = parseAttackFromText(text);
          return { ...a, name: aName, text, attack };
        }),
        reaction: asArray(m?.reaction),
        legendary: asArray(m?.legendary),
        spellcasting: asArray(m?.spellcasting),
        spells: asArray(m?.spells),
      };

      monStmt.run(
        data.id,
        name,
        nameKey,
        crStr,
        crNumeric,
        typeKey,
        typeFull,
        asText(m?.size) || null,
        asText(m?.environment) || null,
        JSON.stringify(data)
      );
    }

    // ── Spells ──────────────────────────────────────────────────────────────
    for (const s of spells) {
      const displayName = (asText(s?.name) || "Unknown").trim();
      const fullKey = normalizeKey(displayName);
      const normalizedName =
        displayName.replace(/\s*\[[^\]]+\]\s*$/, "").trim() || displayName;
      const baseKey = normalizeKey(normalizedName);
      const id = `s_${fullKey.replace(/\s/g, "_")}`;
      const level =
        s?.level != null
          ? Number(String(s.level).replace(/[^0-9]/g, ""))
          : null;
      const levelVal = Number.isFinite(level) ? level : null;
      const schoolVal   = asText(s?.school) || null;
      const componentsVal = asText(s?.components) || null;
      const durationVal   = asText(s?.duration) || null;
      const classesVal    = asText(s?.classes) || null;

      // Detect ritual from <ritual> tag ("YES", "yes", "1", "true" all count)
      const ritualRaw = asText(s?.ritual)?.toLowerCase().trim() ?? "";
      const isRitual = ritualRaw === "yes" || ritualRaw === "1" || ritualRaw === "true" ? 1 : 0;

      // Detect concentration from duration string
      const isConcentration = /concentration/i.test(durationVal ?? "") ? 1 : 0;

      const texts = asArray(s?.text)
        .map((t) => (t == null ? "" : String(t)).trim())
        .filter((t) => t.length > 0);

      const data = {
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
        time: asText(s?.time) || null,
        range: asText(s?.range) || null,
        components: componentsVal,
        duration: durationVal,
        classes: classesVal,
        text: texts,
      };

      spellStmt.run(
        id, displayName, fullKey, levelVal, schoolVal,
        isRitual, isConcentration, componentsVal, classesVal,
        JSON.stringify(data)
      );
    }
    backfillMonsterSpellRefs(db);

    // ── Items ────────────────────────────────────────────────────────────────

    for (const it of items) {
      const data = xmlItemToJson(it);
      if (!data) continue;
      itemStmt.run(
        data.id,
        data.name,
        data.name_key,
        data.rarity,
        data.type,
        data.type_key,
        data.attunement ? 1 : 0,
        data.magic ? 1 : 0,
        data.equippable ? 1 : 0,
        data.weight ?? null,
        data.value ?? null,
        data.proficiency ?? null,
        JSON.stringify(data.blob)
      );
    }

    // ── Classes ──────────────────────────────────────────────────────────────
    for (const c of classes) {
      const name = (asText(c?.name) || "Unknown").trim();
      const nameKey = normalizeKey(name);
      const id = `c_${nameKey.replace(/\s/g, "_")}`;
      const hd = c?.hd != null ? Number(c.hd) : null;

      // Parse autolevels: each autolevel is a level entry with features/counters
      const autolevels = asArray(c?.autolevel).map((al: any) => {
        const level = al?.["@_level"] != null ? Number(al["@_level"]) : null;
        const scoreImprovement = al?.["@_scoreImprovement"] === "YES";
        const features = asArray(al?.feature).map((f: any) => ({
          name: asText(f?.name) || "",
          text: asText(f?.text) || "",
          optional: f?.["@_optional"] === "YES",
          special: f?.special ? asText(f.special) : null,
          modifier: f?.modifier ? asArray(f.modifier).map((m: any) =>
            typeof m === "string" ? m : (m?.["#text"] ?? asText(m) ?? "")
          ) : [],
          preparedSpellProgression: parsePreparedSpellProgression(asText(f?.text) || ""),
        }));
        const counters = asArray(al?.counter).map((ct: any) => ({
          name: asText(ct?.name) || "",
          value: ct?.value != null ? Number(ct.value) : 0,
          reset: asText(ct?.reset) || "L",
          subclass: ct?.subclass ? asText(ct.subclass) : null,
        }));
        // <slots>2,1</slots> → [cantrips, L1_slots, L2_slots, ...]
        const slotsRaw = al?.slots != null ? String(al.slots).trim() : null;
        const slots = slotsRaw ? slotsRaw.split(",").map((n) => parseInt(n.trim(), 10) || 0) : null;
        return { level, scoreImprovement, features, counters, slots };
      });

      const data = {
        id, name, ruleset: inferRuleset(name), nameKey, name_key: nameKey, hd,
        proficiency: asText(c?.proficiency) || "",
        numSkills: c?.numSkills != null ? Number(c.numSkills) : 0,
        armor: asText(c?.armor) || "",
        weapons: asText(c?.weapons) || "",
        tools: asText(c?.tools) || "",
        slotsReset: asText(c?.slotsReset) || "L",
        description: asText(asArray(c?.trait)?.[0]?.text) || "",
        autolevels,
      };

      classStmt.run(id, name, nameKey, hd, JSON.stringify(data));
    }

    // ── Races ────────────────────────────────────────────────────────────────
    for (const r of races) {
      const name = (asText(r?.name) || "Unknown").trim();
      const nameKey = normalizeKey(name);
      const id = `r_${nameKey.replace(/\s/g, "_")}`;
      const speed = r?.speed != null ? Number(r.speed) : null;
      const size = asText(r?.size) || null;

      const traits = asArray(r?.trait).map((t: any) => ({
        name: asText(t?.name) || "",
        text: asText(t?.text) || "",
        category: t?.["@_category"] ? asText(t["@_category"]) : null,
        modifier: t?.modifier ? asArray(t.modifier).map((m: any) =>
          typeof m === "string" ? m : (m?.["#text"] ?? asText(m) ?? "")
        ) : [],
        preparedSpellProgression: parsePreparedSpellProgression(asText(t?.text) || ""),
      }));

      // Parse vision traits (Darkvision, Blindsight, Truesight, Tremorsense)
      const VISION_TYPES = ["Darkvision", "Blindsight", "Truesight", "Tremorsense"];
      const vision: { type: string; range: number }[] = [];
      for (const t of traits) {
        const vType = VISION_TYPES.find(v => v.toLowerCase() === t.name.toLowerCase().trim());
        if (vType) {
          // Extract range: "range of 120 feet" or "60 ft" or just a number
          const rangeMatch = t.text.match(/(\d+)\s*(?:feet?|ft\.?)/i);
          const range = rangeMatch?.[1] ? parseInt(rangeMatch[1], 10) : 60;
          vision.push({ type: vType, range });
        }
      }

      const raceRuleset = inferRuleset(name, traits.map((t) => `${t.name}\n${t.text}`).join("\n"));
      const data = {
        id, name, ruleset: raceRuleset, nameKey, name_key: nameKey,
        size, speed,
        resist: asText(r?.resist) || null,
        vision,
        parsedChoices: parseRaceChoicesByRuleset(
          raceRuleset,
          traits.map((t) => ({ name: t.name, text: t.text })),
        ),
        traits,
      };

      raceStmt.run(id, name, nameKey, size, speed, JSON.stringify(data));
    }

    // ── Backgrounds ──────────────────────────────────────────────────────────
    for (const bg of backgrounds) {
      const name = (asText(bg?.name) || "Unknown").trim();
      const nameKey = normalizeKey(name);
      const id = `bg_${nameKey.replace(/\s/g, "_")}`;

      const traits = asArray(bg?.trait).map((t: any) => ({
        name: asText(t?.name) || "",
        text: asText(t?.text) || "",
        preparedSpellProgression: parsePreparedSpellProgression(asText(t?.text) || ""),
      }));

      const bgRuleset = inferRuleset(name, traits.map((t) => `${t.name}\n${t.text}`).join("\n"));
      const proficiencies = parseBackgroundProficiencies({
        proficiency: asText(bg?.proficiency) || "",
        trait: asArray(bg?.trait),
        ruleset: bgRuleset,
      });

      // Starting equipment — prefer trait named "Starting Equipment", fallback to <equipment> tag
      let equipment = "";
      const equipTrait = traits.find((t) => /(?:starting|choose)\s+equipment/i.test(t.name));
      if (equipTrait) {
        equipment = equipTrait.text.replace(/Source:.*$/gim, "").trim();
      } else if (bg?.equipment) {
        // Structured <equipment> tag: may be a string or { item: [...] }
        const eq = bg.equipment;
        if (typeof eq === "string") {
          equipment = eq.trim();
        } else {
          const items = asArray(eq?.item).map((it: any) => {
            const count = it?.["@_count"];
            const itemName = asText(it) || "";
            return count ? `${count}× ${itemName}` : itemName;
          }).filter(Boolean);
          if (items.length > 0) equipment = items.join(", ");
          else equipment = asText(eq) || "";
        }
      }

      const data = {
        id, name, ruleset: bgRuleset, nameKey, name_key: nameKey,
        proficiency: asText(bg?.proficiency) || "",
        proficiencies,
        traits,
        equipment,
      };

      bgStmt.run(id, name, nameKey, JSON.stringify(data));
    }

    // ── Feats ────────────────────────────────────────────────────────────────
    for (const ft of feats) {
      const name = (asText(ft?.name) || "Unknown").trim();
      const nameKey = normalizeKey(name);
      const id = `f_${nameKey.replace(/\s/g, "_")}`;

      const modifierDetails = asArray(ft?.modifier).map((m: any) =>
        typeof m === "string"
          ? { category: "", text: m }
          : { category: m?.["@_category"] ?? "", text: m?.["#text"] ?? asText(m) ?? "" }
      ).filter((m: { text: string }) => m.text.length > 0);
      const modifiers = modifierDetails.map((m) => m.text);
      const prerequisite = asText(ft?.prerequisite) || null;
      const proficiency = asText(ft?.proficiency) || null;
      const special = asText(ft?.special) || null;
      const parsed = parseFeat({
        name,
        text: asText(ft?.text) || "",
        prerequisite,
        proficiency,
        modifiers: modifierDetails,
      });

      const data = {
        id, name, ruleset: inferRuleset(name, asText(ft?.text), prerequisite, special), nameKey, name_key: nameKey,
        text: asText(ft?.text) || "",
        prerequisite,
        proficiency,
        special,
        modifiers,
        modifierDetails,
        parsed,
      };

      featStmt.run(id, name, nameKey, JSON.stringify(data));
    }
  })();

  const totalMonsters = (
    db.prepare("SELECT count(*) AS n FROM compendium_monsters").get() as { n: number }
  ).n;

  return {
    imported: monsters.length,
    total: totalMonsters,
    items: items.length,
    classes: classes.length,
    races: races.length,
    backgrounds: backgrounds.length,
    feats: feats.length,
  };
}

function xmlItemToJson(it: any): any | null {
  const name = String(it?.name ?? "Unknown").trim();
  if (!name) return null;
  const nameKey = normalizeKey(name);
  const id = `i_${nameKey.replace(/\s/g, "_")}`;

  const typeCode = it?.type ?? null;
  const { type, typeKey } = mapItemType(typeCode);

  // Multiple <text> tags → collect as array of non-empty lines
  const text = asArray(it?.text)
    .map((t: any) => (t == null ? "" : String(t)).trim())
    .filter((t: string) => t.length > 0);

  const { rarity, attunement, inferredMagic } = parseItemDetail(it?.detail, name, text);
  const magic = (it?.magic != null ? Number(String(it.magic).trim()) === 1 : false) || inferredMagic;

  // Weapon / armor stats
  const dmg1 = it?.dmg1 != null ? String(it.dmg1).trim() : null;
  const dmg2 = it?.dmg2 != null ? String(it.dmg2).trim() : null;
  const dmgType = it?.dmgType != null ? String(it.dmgType).trim() : null;
  const weight = it?.weight != null ? Number(it.weight) : null;
  const value = it?.value != null ? Number(it.value) : null;
  const ac = it?.ac != null ? Number(it.ac) : null;
  const stealthDisadvantage = String(it?.stealth ?? "").trim().toUpperCase() === "YES";

  // Properties: single tag with comma-separated codes e.g. "F,L" or "2H"
  const propertyRaw = it?.property != null ? String(it.property).trim() : "";
  const properties = propertyRaw
    ? propertyRaw.split(",").map((p: string) => p.trim()).filter(Boolean)
    : [];

  // Modifiers: already forced to array by XMLParser isArray config
  const modifiers = asArray(it?.modifier)
    .map((m: any) =>
      typeof m === "string"
        ? { category: "", text: m }
        : { category: m?.["@_category"] ?? "", text: m?.["#text"] ?? asText(m) ?? "" }
    )
    .filter((m: any) => m.text.length > 0);

  const fullText = text.join("\n");
  const equippable = inferItemEquippable(type, fullText);

  // Parse "Proficiency: simple, mace" line from text
  const proficiencyMatch = fullText.match(/^Proficiency:\s*(.+)$/im);
  const proficiency = proficiencyMatch?.[1]?.trim() || null;

  const weightVal = Number.isFinite(weight) ? weight : null;
  const valueVal = Number.isFinite(value) ? value : null;

  // Blob: only fields that don't have their own column
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
    weight: weightVal,
    value: valueVal,
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
  const rarityList = [
    "common",
    "uncommon",
    "rare",
    "very rare",
    "legendary",
    "artifact",
  ];

  let explicitRarity: string | null = null;
  for (const r of rarityList) {
    if (lower.startsWith(r)) {
      explicitRarity = r;
      break;
    }
  }

  const attunement = /requires\s+attunement|attunement\s*\)/i.test(detail);

  // If rarity is explicit, trust it
  if (explicitRarity !== null) {
    return { rarity: explicitRarity, attunement, inferredMagic: false };
  }

  // Infer from +N bonus in name, detail, or description text
  const bonusText = `${name} ${detail} ${textBody}`;
  let rarity = "common";
  let inferredMagic = false;
  if (/\+3\b/.test(bonusText)) {
    rarity = "very rare"; inferredMagic = true;
  } else if (/\+2\b/.test(bonusText)) {
    rarity = "rare"; inferredMagic = true;
  } else if (/\+1\b/.test(bonusText)) {
    rarity = "uncommon"; inferredMagic = true;
  } else if (attunement) {
    rarity = "uncommon"; inferredMagic = true;
  }

  return { rarity, attunement, inferredMagic };
}

function inferItemEquippable(type: string, fullText: string): boolean {
  // Always equippable by type
  if (/^(ring|rod|wand|wondrous)$/i.test(type)) return true;
  // Text signals equippable usage
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
