import type Database from "better-sqlite3";
import { XMLParser } from "fast-xml-parser";
import { asArray, asText, normalizeKey, parseCrValue } from "../../lib/text.js";
import { parseAttackFromText } from "../../lib/attacks.js";
import { normalizeHp } from "./normalizeHp.js";

export function importCompendiumXml(args: {
  xml: string;
  db: Database.Database;
}): { imported: number; total: number } {
  const { xml, db } = args;
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });
  const parsed = parser.parse(xml);
  const comp = parsed?.compendium ?? parsed;
  const monsters = asArray(comp?.monster);
  const spells = asArray(comp?.spell);
  const items = asArray(comp?.item);

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
      (id, name, name_key, rarity, type, type_key, attunement, magic, data_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        JSON.stringify(data)
      );
    }
  })();

  const totalMonsters = (
    db.prepare("SELECT count(*) AS n FROM compendium_monsters").get() as { n: number }
  ).n;

  return { imported: monsters.length, total: totalMonsters };
}

function xmlItemToJson(it: any): any | null {
  const name = String(it?.name ?? "Unknown").trim();
  if (!name) return null;
  const nameKey = normalizeKey(name);
  const id = `i_${nameKey.replace(/\s/g, "_")}`;

  const typeCode = it?.type ?? null;
  const { type, typeKey } = mapItemType(typeCode);
  const { rarity, attunement } = parseItemDetail(it?.detail);
  const magic = it?.magic != null ? Number(String(it.magic).trim()) === 1 : false;
  const text = String(it?.text ?? "").trim();

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
    text,
  };
}

function parseItemDetail(detailRaw: unknown): {
  rarity: string | null;
  attunement: boolean;
} {
  const detail = String(detailRaw ?? "").trim();
  const lower = detail.toLowerCase();
  const rarityList = [
    "common",
    "uncommon",
    "rare",
    "very rare",
    "legendary",
    "artifact",
  ];
  let rarity: string | null = null;
  for (const r of rarityList) {
    if (lower.startsWith(r)) {
      rarity = r;
      break;
    }
  }
  const attunement = /requires\s+attunement|attunement\s*\)/i.test(detail);
  return { rarity, attunement };
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
