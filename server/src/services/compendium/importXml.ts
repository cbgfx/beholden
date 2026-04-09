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
  decks?: number;
  bastions?: number;
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
  const deckCards = asArray(parsed?.deck?.card ?? comp?.deck?.card ?? comp?.card);
  const bastionCompendium = parsed?.bastionCompendium;
  const bastionSpaces = asArray(bastionCompendium?.spaces?.space);
  const bastionOrders = asArray(bastionCompendium?.orders?.order);
  const bastionBasicFacilities = asArray(bastionCompendium?.basicFacilities?.facility);
  const bastionSpecialFacilities = asArray(bastionCompendium?.specialFacilities?.facility);
  const bastionFacilities = [...bastionBasicFacilities, ...bastionSpecialFacilities];

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
  const deckCardStmt = db.prepare(`
    INSERT OR REPLACE INTO compendium_deck_cards
      (id, deck_name, deck_key, card_name, card_key, card_text, sort_index)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const bastionSpaceStmt = db.prepare(`
    INSERT OR REPLACE INTO compendium_bastion_spaces
      (id, name, name_key, squares, label, sort_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const bastionOrderStmt = db.prepare(`
    INSERT OR REPLACE INTO compendium_bastion_orders
      (id, order_name, order_key, sort_index)
    VALUES (?, ?, ?, ?)
  `);
  const bastionFacilityStmt = db.prepare(`
    INSERT OR REPLACE INTO compendium_bastion_facilities
      (id, name, name_key, facility_type, minimum_level, prerequisite, orders_json, space, hirelings, allow_multiple, description, data_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    if (deckCards.length > 0) {
      db.prepare("DELETE FROM compendium_deck_cards WHERE deck_key = ?").run("deck");
      for (let index = 0; index < deckCards.length; index += 1) {
        const card = deckCards[index] as Record<string, unknown>;
        const cardName = asText(card?.name).trim();
        if (!cardName) continue;
        const cardText = asText(card?.text).trim() || null;
        const cardKey = cardName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const id = `deck:${cardKey || "card"}:${index + 1}`;
        deckCardStmt.run(id, "Deck", "deck", cardName, cardKey || null, cardText, index);
      }
    }

    if (bastionCompendium) {
      db.prepare("DELETE FROM compendium_bastion_spaces").run();
      db.prepare("DELETE FROM compendium_bastion_orders").run();
      db.prepare("DELETE FROM compendium_bastion_facilities").run();

      for (let index = 0; index < bastionSpaces.length; index += 1) {
        const space = bastionSpaces[index] as Record<string, unknown>;
        const name = asText(space?.name).trim();
        if (!name) continue;
        const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const squaresText = asText(space?.squares).trim();
        const squares = squaresText ? Number.parseInt(squaresText, 10) : NaN;
        bastionSpaceStmt.run(
          `bastion-space:${key || index + 1}`,
          name,
          key || `space-${index + 1}`,
          Number.isFinite(squares) ? squares : null,
          asText(space?.label).trim() || null,
          index,
        );
      }

      for (let index = 0; index < bastionOrders.length; index += 1) {
        const orderName = asText(bastionOrders[index]).trim();
        if (!orderName) continue;
        const orderKey = orderName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        bastionOrderStmt.run(
          `bastion-order:${orderKey || index + 1}`,
          orderName,
          orderKey || `order-${index + 1}`,
          index,
        );
      }

      for (let index = 0; index < bastionFacilities.length; index += 1) {
        const facility = bastionFacilities[index] as Record<string, unknown>;
        const name = asText(facility?.name).trim();
        if (!name) continue;
        const typeRaw = asText(facility?.type).trim().toLowerCase();
        const facilityType = typeRaw === "basic" ? "basic" : "special";
        const nameKey = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const minimumLevelText = asText(facility?.minimumLevel).trim();
        const minimumLevel = minimumLevelText ? Number.parseInt(minimumLevelText, 10) : 0;
        const prerequisite = asText(facility?.prerequisite).trim() || null;
        const orders = asArray((facility as any)?.orders?.order)
          .map((entry) => asText(entry).trim())
          .filter((entry) => entry.length > 0);
        const space = asText(facility?.space).trim() || null;
        const hirelingsText = asText(facility?.hirelings).trim();
        const hirelingsLeading = hirelingsText.match(/^\d+/u)?.[0] ?? "";
        const hirelings = hirelingsLeading ? Number.parseInt(hirelingsLeading, 10) : NaN;
        const description = asText(facility?.description).trim();
        const allowMultiple = /can have more than one/i.test(description) ? 1 : 0;
        const data = {
          name,
          type: facilityType,
          minimumLevel: Number.isFinite(minimumLevel) ? minimumLevel : 0,
          prerequisite,
          orders,
          space,
          hirelings: Number.isFinite(hirelings) ? hirelings : null,
          description,
          allowMultiple: allowMultiple === 1,
        };
        bastionFacilityStmt.run(
          `bastion-facility:${nameKey || index + 1}`,
          name,
          nameKey || `facility-${index + 1}`,
          facilityType,
          Number.isFinite(minimumLevel) ? minimumLevel : 0,
          prerequisite,
          JSON.stringify(orders),
          space,
          Number.isFinite(hirelings) ? hirelings : null,
          allowMultiple,
          description || null,
          JSON.stringify(data),
        );
      }
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
    decks: deckCards.length > 0 ? 1 : 0,
    bastions: bastionFacilities.length > 0 ? bastionFacilities.length : 0,
  };
}
