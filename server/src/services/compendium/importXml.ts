import type Database from "better-sqlite3";
import { XMLParser } from "fast-xml-parser";

import { asArray, asText } from "../../lib/text.js";
import { backfillMonsterSpellRefs } from "./normalizeMonsterSpellRefs.js";
import {
  buildBackgroundImportData,
  buildClassImportData,
  buildMonsterImportData,
  buildRaceImportData,
  buildSpellImportData,
  createFeatUpserter,
  xmlItemToJson,
} from "./importXmlHelpers.js";

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
  const upsertFeat = createFeatUpserter(featStmt);

  db.transaction(() => {
    for (const monster of monsters) {
      const data = buildMonsterImportData(monster);
      monStmt.run(
        data.id,
        data.name,
        data.nameKey,
        data.cr,
        data.cr_numeric,
        data.typeKey,
        data.typeFull,
        asText(monster?.size) || null,
        asText(monster?.environment) || null,
        JSON.stringify(data),
      );
    }

    for (const spell of spells) {
      const data = buildSpellImportData(spell);
      spellStmt.run(
        data.id,
        data.name,
        data.nameKey,
        data.level,
        data.school,
        data.ritual,
        data.concentration,
        data.components,
        data.classes,
        JSON.stringify(data),
      );
    }
    backfillMonsterSpellRefs(db);

    for (const item of items) {
      const data = xmlItemToJson(item);
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
        JSON.stringify(data.blob),
      );
    }

    for (const cls of classes) {
      const data = buildClassImportData(cls);
      classStmt.run(data.id, data.name, data.nameKey, data.hd, JSON.stringify(data));
    }

    for (const race of races) {
      const data = buildRaceImportData(race);
      raceStmt.run(data.id, data.name, data.nameKey, data.size, data.speed, JSON.stringify(data));
    }

    for (const background of backgrounds) {
      const { data, embeddedFeatNames } = buildBackgroundImportData(background);
      bgStmt.run(data.id, data.name, data.nameKey, JSON.stringify(data));

      for (const featName of embeddedFeatNames) {
        const featTrait = data.traits.find((trait) => String(trait?.name ?? "").trim() === `Feat: ${featName}`);
        upsertFeat({
          name: featName,
          text: String(featTrait?.text ?? ""),
        });
      }
    }

    for (const feat of feats) {
      const modifierDetails = asArray(feat?.modifier)
        .map((m: any) =>
          typeof m === "string"
            ? { category: "", text: m }
            : { category: m?.["@_category"] ?? "", text: m?.["#text"] ?? asText(m) ?? "" },
        )
        .filter((m: { text: string }) => m.text.length > 0);
      const prerequisite = asText(feat?.prerequisite) || null;
      const proficiency = asText(feat?.proficiency) || null;
      const special = asText(feat?.special) || null;
      upsertFeat({
        name: (asText(feat?.name) || "Unknown").trim(),
        text: asText(feat?.text) || "",
        prerequisite,
        proficiency,
        special,
        modifierDetails,
      });
    }
  })();

  const totalMonsters = (db.prepare("SELECT count(*) AS n FROM compendium_monsters").get() as { n: number }).n;

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
