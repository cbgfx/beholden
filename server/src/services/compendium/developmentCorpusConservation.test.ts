import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { XMLParser } from "fast-xml-parser";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import { asArray, asText, stripSourceLine } from "../../lib/text.js";
import { convertCompendiumXmlToNative } from "./convertXmlToNative.js";
import {
  exportNativeCompendiumBundle,
  importNativeCompendiumDocument,
  parseNativeCompendiumDocument,
} from "./nativeCompendium.js";
import { parseStoredCompendiumEntry } from "./storedCompendium.js";

type JsonRecord = Record<string, unknown>;

const corpusDir = fileURLToPath(new URL("../../../../compendium/", import.meta.url));
const primaryCorpusPath = path.join(corpusDir, "WotC_2024_only.xml");
const xmlCache = new Map<string, string>();
const documentCache = new Map<string, ReturnType<typeof convertCompendiumXmlToNative>>();

function readXml(filename: string): string {
  const filePath = path.join(corpusDir, filename);
  const cached = xmlCache.get(filePath);
  if (cached != null) return cached;
  const xml = fs.readFileSync(filePath, "utf8");
  xmlCache.set(filePath, xml);
  return xml;
}

function convertFile(filename: string): ReturnType<typeof convertCompendiumXmlToNative> {
  const cached = documentCache.get(filename);
  if (cached) return cached;
  const document = convertCompendiumXmlToNative(readXml(filename));
  documentCache.set(filename, document);
  return document;
}

function parseSource(xml: string): JsonRecord {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    isArray: (name) => ["autolevel", "feature", "counter", "modifier", "trait"].includes(name),
  });
  const parsed = parser.parse(xml) as JsonRecord;
  return (parsed.compendium ?? parsed) as JsonRecord;
}

function batchEntries(
  document: ReturnType<typeof convertCompendiumXmlToNative>,
  category: string,
): JsonRecord[] {
  return document.batches.find((batch) => batch.category === category)?.entries ?? [];
}

function sorted(values: string[]): string[] {
  return values.sort((a, b) => a.localeCompare(b));
}

test("every development XML file converts into strict canonical v2", () => {
  const files = fs.readdirSync(corpusDir)
    .filter((name) => name.toLowerCase().endsWith(".xml"))
    .sort();
  assert.ok(files.length > 0);

  for (const filename of files) {
    const document = convertCompendiumXmlToNative(
      readXml(filename),
    );
    documentCache.set(filename, document);
    assert.doesNotThrow(
      () => parseNativeCompendiumDocument(document),
      `${filename} must produce a strict v2 document`,
    );
  }
});

test("every development corpus survives native import and export unchanged", () => {
  const files = fs.readdirSync(corpusDir)
    .filter((name) => name.toLowerCase().endsWith(".xml"))
    .sort();

  for (const filename of files) {
    const original = convertFile(filename);
    const db = new Database(":memory:");
    try {
      db.pragma("foreign_keys = ON");
      db.exec(SCHEMA_SQL);
      importNativeCompendiumDocument(db, original);
      const roundTripped = exportNativeCompendiumBundle(
        db,
        original.batches.map((batch) => batch.category),
      );
      assert.deepEqual(
        roundTripped.batches,
        original.batches,
        `${filename} changed during native import/export`,
      );
    } finally {
      db.close();
    }
  }
});

test("primary development corpus conserves every top-level source entry", () => {
  const xml = readXml(path.basename(primaryCorpusPath));
  const source = parseSource(xml);
  const document = convertFile(path.basename(primaryCorpusPath));
  const mappings = [
    ["monster", "monsters"],
    ["item", "items"],
    ["spell", "spells"],
    ["class", "classes"],
    ["race", "species"],
    ["background", "backgrounds"],
  ] as const;

  for (const [sourceCategory, nativeCategory] of mappings) {
    assert.equal(
      batchEntries(document, nativeCategory).length,
      asArray(source[sourceCategory]).length,
      `${nativeCategory} source entries must not collapse during conversion`,
    );
  }
});

test("monster metadata, recharge, lair categories, and explicit attacks survive conversion", () => {
  const source = parseSource(readXml(path.basename(primaryCorpusPath)));
  const document = convertFile(path.basename(primaryCorpusPath));
  const sourceMonsters = asArray<JsonRecord>(
    source.monster as JsonRecord[] | JsonRecord | null | undefined,
  );
  const nativeMonsters = batchEntries(document, "monsters");

  const sourceMetadata = sourceMonsters.map((monster) => [
    asText(monster.name),
    asText(monster.sortname),
    asText(monster.alignment),
    asText(monster.ancestry),
    asText(monster.description).replace(/(?:^|\n)Source:\s*[^\n]+\s*$/iu, "").trim(),
    asText(monster.init),
    asText(monster.passive),
    /^(?:1|true|yes)$/iu.test(asText(monster.npc)) ? "true" : "false",
  ].join("|"));
  const nativeMetadata = nativeMonsters.map((monster) => {
    const classification = monster.classification as JsonRecord;
    return [
      asText(monster.name),
      asText(classification.sortName),
      asText(classification.alignment),
      asText(classification.ancestry),
      asText(monster.description),
      asText(monster.initiativeBonus),
      asText(monster.passivePerception),
      monster.npc === true ? "true" : "false",
    ].join("|");
  });
  assert.deepEqual(sorted(nativeMetadata), sorted(sourceMetadata));

  const sourceMechanics: string[] = [];
  const nativeMechanics: string[] = [];
  const sourceFields = ["trait", "action", "reaction", "legendary", "spellcasting"] as const;
  const nativeFields = ["traits", "actions", "reactions", "legendaryActions", "spellcasting"] as const;
  sourceMonsters.forEach((monster) => {
    sourceFields.forEach((field) => {
      for (const rawEntry of asArray<JsonRecord>(
        monster[field] as JsonRecord[] | JsonRecord | null | undefined,
      )) {
        const attacks = asArray(rawEntry.attack).map(asText).filter(Boolean);
        sourceMechanics.push([
          asText(monster.name),
          field,
          asText(rawEntry.name),
          asText(rawEntry["@_category"]),
          asArray(rawEntry.recharge).map(asText).filter(Boolean).join(",").toUpperCase(),
          attacks.join("~"),
        ].join("|"));
      }
    });
  });
  nativeMonsters.forEach((monster) => {
    nativeFields.forEach((field, index) => {
      for (const rawEntry of asArray<JsonRecord>(
        monster[field] as JsonRecord[] | null | undefined,
      )) {
        const recharge = rawEntry.recharge as JsonRecord | null;
        nativeMechanics.push([
          asText(monster.name),
          sourceFields[index],
          asText(rawEntry.name),
          asText(rawEntry.category),
          asText(recharge?.source),
          asArray(rawEntry.attacks).map(asText).filter(Boolean).join("~"),
        ].join("|"));
      }
    });
  });
  assert.deepEqual(sorted(nativeMechanics), sorted(sourceMechanics));
});

test("item detail, requirements, range, strength, and rolls survive conversion", () => {
  const source = parseSource(readXml(path.basename(primaryCorpusPath)));
  const document = convertFile(path.basename(primaryCorpusPath));
  const sourceItems = asArray<JsonRecord>(
    source.item as JsonRecord[] | JsonRecord | null | undefined,
  );
  const nativeItems = batchEntries(document, "items");

  const sourceSignatures = sourceItems.map((item) => [
    asText(item.name),
    asText(item.range),
    asText(item.strength),
    asArray<JsonRecord | string>(item.roll as Array<JsonRecord | string> | JsonRecord | string | null | undefined)
      .map((roll) => typeof roll === "string"
        ? `||${roll.trim()}`
        : `${asText(roll["@_description"])}||${asText(roll["#text"])}`)
      .join("~"),
  ].join("|"));
  const nativeSignatures = nativeItems.map((item) => {
    const armor = (item.armor ?? {}) as JsonRecord;
    const weapon = (item.weapon ?? {}) as JsonRecord;
    return [
      asText(item.name),
      asText(weapon.range),
      asText(armor.strength),
      asArray<JsonRecord>(item.rolls as JsonRecord[] | null | undefined)
        .map((roll) => `${asText(roll.description)}||${asText(roll.formula)}`)
        .join("~"),
    ].join("|");
  });
  assert.deepEqual(sorted(nativeSignatures), sorted(sourceSignatures));

  const sourceRequirements = sourceItems.flatMap((item) => {
    const requirement = asText(item.detail)
      .match(/requires\s+attunement(?:\s+by\s+([^)]+))?/iu)?.[1]?.trim();
    return requirement ? [`${asText(item.name)}|${requirement}`] : [];
  });
  const nativeRequirements = nativeItems.flatMap((item) =>
    typeof item.attunement === "string"
      ? [`${asText(item.name)}|${item.attunement}`]
      : []);
  assert.deepEqual(sorted(nativeRequirements), sorted(sourceRequirements));

  const reconstructedDetails = nativeItems.map((item) => {
    const rarity = asText(item.rarity);
    const detail = asText(item.detail)
      || (item.attunement === true
        ? `${rarity} (requires attunement)`
        : typeof item.attunement === "string"
          ? `${rarity} (requires attunement by ${item.attunement})`
          : rarity);
    return `${asText(item.name)}|${detail}`;
  });
  for (const item of sourceItems) {
    const detail = asText(item.detail);
    if (!detail) continue;
    assert.ok(
      reconstructedDetails.includes(`${asText(item.name)}|${detail}`),
      `${asText(item.name)} detail changed`,
    );
  }
});

test("spell roll formulas and scaling basis survive conversion", () => {
  const source = parseSource(readXml(path.basename(primaryCorpusPath)));
  const document = convertFile(path.basename(primaryCorpusPath));
  const sourceSpells = asArray<JsonRecord>(
    source.spell as JsonRecord[] | JsonRecord | null | undefined,
  );
  const nativeSpells = batchEntries(document, "spells");

  const sourceRolls = sourceSpells.flatMap((spell) => {
    const rolls = asArray<JsonRecord | string>(
      spell.roll as Array<JsonRecord | string> | JsonRecord | string | null | undefined,
    ).map((roll) => {
      const level = typeof roll === "string" ? "" : asText(roll["@_level"]);
      const formula = typeof roll === "string" ? roll.trim() : asText(roll["#text"]);
      const description = typeof roll === "string" ? "" : asText(roll["@_description"]);
      const scaling = level
        ? Number(spell.level) === 0 ? "character_level" : "slot_level"
        : "";
      return { key: `${description}\0${level}`, line: [asText(spell.name), description, scaling, level, formula].join("|") };
    });
    // Mirror the native deduplication: drop rolls whose (description, level) key appears more than once
    const keyCounts = new Map<string, number>();
    for (const r of rolls) keyCounts.set(r.key, (keyCounts.get(r.key) ?? 0) + 1);
    return rolls.filter((r) => keyCounts.get(r.key) === 1).map((r) => r.line);
  });
  const nativeRolls = nativeSpells.flatMap((spell) =>
    asArray<JsonRecord>(spell.rolls as JsonRecord[] | null | undefined)
      .map((roll) => [
        asText(spell.name),
        asText(roll.description),
        asText(roll.scaling),
        asText(roll.level),
        asText(roll.formula),
      ].join("|")),
  );
  assert.deepEqual(sorted(nativeRolls), sorted(sourceRolls));
});

test("spell canonical fields are homogeneous across the primary corpus", () => {
  const spells = batchEntries(
    convertFile(path.basename(primaryCorpusPath)),
    "spells",
  );
  const schoolNames = new Set([
    "Abjuration", "Conjuration", "Divination", "Enchantment",
    "Evocation", "Illusion", "Necromancy", "Transmutation",
  ]);
  const castingTime = /^(?:(?:Action|Bonus Action|Reaction)(?:, .+)?|Action or [Rr]itual|\d+ (?:Minute|Minutes|Hour|Hours)(?:, .+)?)$/u;
  const duration = /^(?:Instantaneous(?:, .+)?|Until Dispelled|Concentration, up to \d+ (?:Round|Rounds|Minute|Minutes|Hour|Hours|Day|Days)|\d+ (?:Round|Rounds|Minute|Minutes|Hour|Hours|Day|Days))$/u;
  const nonClassTags = new Set([
    "Artificer Infusions", "Eldritch Invocations", "Maneuver Options",
    "Metamagic Options", "Ritual Caster", "Touch Spells",
  ]);

  for (const spell of spells) {
    const casting = (spell.casting ?? {}) as JsonRecord;
    const spellDuration = (casting.duration ?? {}) as JsonRecord;
    assert.ok(
      spell.school == null || schoolNames.has(String(spell.school)),
      `${String(spell.name)} has noncanonical school ${String(spell.school)}`,
    );
    assert.ok(
      casting.time == null || castingTime.test(String(casting.time)),
      `${String(spell.name)} has noncanonical casting time ${String(casting.time)}`,
    );
    assert.ok(
      spellDuration.description == null || duration.test(String(spellDuration.description)),
      `${String(spell.name)} has noncanonical duration ${String(spellDuration.description)}`,
    );
    assert.equal(
      asArray<string>(spell.classes as string[] | undefined).some((value) => /^School:/iu.test(value)),
      false,
      `${String(spell.name)} leaks school metadata into classes`,
    );
    assert.equal(
      asArray<string>(spell.classes as string[] | undefined).some((value) =>
        nonClassTags.has(value) || /^Mages of Strixhaven\b/u.test(value)),
      false,
      `${String(spell.name)} leaks tag metadata into classes`,
    );
  }

  assert.deepEqual(
    spells.filter((spell) => spell.source == null).map((spell) => spell.name),
    ["Homunculus Servant"],
  );
});

test("same-name source items receive stable distinct IDs", () => {
  const document = convertFile(path.basename(primaryCorpusPath));
  const items = batchEntries(document, "items");
  const idsFor = (name: string) => items
    .filter((entry) => entry.name === name)
    .map((entry) => String(entry.id));

  assert.deepEqual(idsFor("Potion of Healing"), ["i_potion_of_healing", "i_potion_of_healing_2"]);
  assert.deepEqual(idsFor("Spell Scroll (Cantrip)"), [
    "i_spell_scroll_(cantrip)",
    "i_spell_scroll_(cantrip)_2",
  ]);
  assert.deepEqual(idsFor("Spell Scroll (Level 1)"), [
    "i_spell_scroll_(level_1)",
    "i_spell_scroll_(level_1)_2",
  ]);
  assert.deepEqual(idsFor("Prosthetic Limb"), ["i_prosthetic_limb", "i_prosthetic_limb_2"]);
});

test("class features, counters, special fields, and modifiers survive conversion", () => {
  const xml = readXml(path.basename(primaryCorpusPath));
  const source = parseSource(xml);
  const document = convertFile(path.basename(primaryCorpusPath));
  const sourceClasses = asArray<JsonRecord>(source.class as JsonRecord[] | JsonRecord | null | undefined);
  const nativeClasses = batchEntries(document, "classes");

  const sourceFeatures: string[] = [];
  let sourceCounters = 0;
  let sourceSpecials = 0;
  let sourceModifiers = 0;
  let sourceRolls = 0;
  let sourceProficiencies = 0;
  for (const cls of sourceClasses) {
    const className = asText(cls.name);
    for (const level of asArray<JsonRecord>(cls.autolevel as JsonRecord[] | JsonRecord | null | undefined)) {
      const levelNumber = Number(level["@_level"]);
      for (const feature of asArray<JsonRecord>(level.feature as JsonRecord[] | JsonRecord | null | undefined)) {
        sourceFeatures.push(
          `${className}|${levelNumber}|${asText(feature.name)}|${stripSourceLine(asText(feature.text))}`,
        );
        if (asText(feature.special)) sourceSpecials += 1;
        if (asText(feature.proficiency)) sourceProficiencies += 1;
        sourceModifiers += asArray(feature.modifier).filter((modifier) => asText(
          typeof modifier === "object" && modifier
            ? (modifier as JsonRecord)["#text"] ?? modifier
            : modifier,
        )).length;
        sourceRolls += asArray(feature.roll).filter((roll) => asText(
          typeof roll === "object" && roll
            ? (roll as JsonRecord)["#text"] ?? roll
            : roll,
        )).length;
      }
      sourceCounters += asArray(level.counter).length;
    }
  }

  const nativeFeatures: string[] = [];
  let nativeCounters = 0;
  let nativeSpecials = 0;
  let nativeModifiers = 0;
  let nativeRolls = 0;
  let nativeProficiencies = 0;
  for (const cls of nativeClasses) {
    for (const rawLevel of asArray<JsonRecord>(cls.levels as JsonRecord[] | null | undefined)) {
      for (const feature of asArray<JsonRecord>(rawLevel.features as JsonRecord[] | null | undefined)) {
        nativeFeatures.push(
          `${String(cls.name)}|${Number(rawLevel.level)}|${String(feature.name)}|${String(feature.description)}`,
        );
        for (const effect of asArray<JsonRecord>(feature.effects as JsonRecord[] | null | undefined)) {
          if (effect.kind === "legacy_special") nativeSpecials += 1;
          if (effect.kind === "legacy_modifier") nativeModifiers += 1;
          if (effect.kind === "legacy_proficiency") nativeProficiencies += 1;
        }
        nativeRolls += asArray(feature.scalingRolls).length;
      }
      nativeCounters += asArray(rawLevel.resources).length;
    }
  }

  assert.deepEqual(sorted(nativeFeatures), sorted(sourceFeatures));
  assert.equal(nativeCounters, sourceCounters);
  assert.equal(nativeSpecials, sourceSpecials);
  assert.equal(nativeModifiers, sourceModifiers);
  assert.equal(nativeRolls, sourceRolls);
  assert.equal(nativeProficiencies, sourceProficiencies);
});

test("class and species canonical metadata survives conversion explicitly", () => {
  const xml = readXml(path.basename(primaryCorpusPath));
  const source = parseSource(xml);
  const document = convertFile(path.basename(primaryCorpusPath));
  const abilityKey = (value: unknown) => {
    const normalized = asText(value).toLowerCase();
    return ({
      strength: "str",
      dexterity: "dex",
      constitution: "con",
      intelligence: "int",
      wisdom: "wis",
      charisma: "cha",
    } as Record<string, string>)[normalized] ?? null;
  };

  const sourceClasses = new Map(
    asArray<JsonRecord>(source.class as JsonRecord[] | JsonRecord | null | undefined)
      .map((entry) => [asText(entry.name), {
        ability: abilityKey(entry.spellAbility),
        startingWealth: entry.wealth == null ? null : Number(entry.wealth),
      }]),
  );
  for (const entry of batchEntries(document, "classes")) {
    const expected = sourceClasses.get(String(entry.name));
    assert.ok(expected, `Missing source class for ${String(entry.name)}`);
    assert.equal(
      (entry.spellcasting as JsonRecord).ability ?? null,
      expected.ability,
      `${String(entry.name)} spellcasting ability changed`,
    );
    assert.equal(
      entry.startingWealth ?? null,
      expected.startingWealth,
      `${String(entry.name)} starting wealth changed`,
    );
  }

  const sourceSpecies = new Map(
    asArray<JsonRecord>(source.race as JsonRecord[] | JsonRecord | null | undefined)
      .map((entry) => [asText(entry.name), abilityKey(entry.spellAbility)]),
  );
  for (const entry of batchEntries(document, "species")) {
    assert.equal(
      entry.spellcastingAbility ?? null,
      sourceSpecies.get(String(entry.name)) ?? null,
      `${String(entry.name)} spellcasting ability changed`,
    );
  }
});

test("species and background trait mechanics survive as typed canonical fields", () => {
  const xml = readXml(path.basename(primaryCorpusPath));
  const source = parseSource(xml);
  const document = convertFile(path.basename(primaryCorpusPath));

  const sourceRolls = (category: "race" | "background") => {
    const rolls: string[] = [];
    for (const entry of asArray<JsonRecord>(source[category] as JsonRecord[] | JsonRecord | null | undefined)) {
      for (const trait of asArray<JsonRecord>(entry.trait as JsonRecord[] | JsonRecord | null | undefined)) {
        const prefix = `${asText(entry.name)}|${asText(trait.name)}`;
        for (const rawRoll of asArray(trait.roll)) {
          const roll = typeof rawRoll === "object" && rawRoll ? rawRoll as JsonRecord : {};
          rolls.push(`${prefix}|${asText(roll["@_description"])}|${asText(roll["@_level"])}|${asText(roll["#text"] ?? rawRoll)}`);
        }
      }
    }
    return sorted(rolls);
  };

  const nativeRolls = (category: "species" | "backgrounds") => {
    const rolls: string[] = [];
    for (const entry of batchEntries(document, category)) {
      const traits = asArray<JsonRecord>(entry.traits as JsonRecord[] | null | undefined);
      const backgroundFeats = category === "backgrounds"
        ? asArray<JsonRecord>((entry.proficiencies as JsonRecord)?.feats as JsonRecord[] | null | undefined)
          .map<JsonRecord>((feat) => ({ ...feat, name: `Feat: ${asText(feat.name)}` }))
        : [];
      for (const trait of [...traits, ...backgroundFeats]) {
        const prefix = `${String(entry.name)}|${String(trait.name)}`;
        for (const roll of asArray<JsonRecord>(trait.scalingRolls as JsonRecord[] | null | undefined)) {
          rolls.push(`${prefix}|${asText(roll.description)}|${asText(roll.level)}|${asText(roll.formula)}`);
        }
      }
    }
    return sorted(rolls);
  };

  assert.deepEqual(nativeRolls("species"), sourceRolls("race"));
  assert.deepEqual(nativeRolls("backgrounds"), sourceRolls("background"));
});

test("all primary-corpus species spell grants are structured at conversion time", () => {
  const document = convertFile(path.basename(primaryCorpusPath));
  const species = batchEntries(document, "species");
  const expected = new Map<string, Array<{ level: number; spells: string[] }>>([
    ["Aasimar|Light Bearer", [{ level: 1, spells: ["Light"] }]],
    ["Elf, Drow|Drow Lineage", [
      { level: 1, spells: ["Dancing Lights"] },
      { level: 3, spells: ["Faerie Fire"] },
      { level: 5, spells: ["Darkness"] },
    ]],
    ["Elf, High|High Elf Lineage", [
      { level: 1, spells: ["Prestidigitation"] },
      { level: 3, spells: ["Detect Magic"] },
      { level: 5, spells: ["Misty Step"] },
    ]],
    ["Elf, Wood|Wood Elf Lineage", [
      { level: 1, spells: ["Druidcraft"] },
      { level: 3, spells: ["Longstrider"] },
      { level: 5, spells: ["Pass without Trace"] },
    ]],
    ["Gnome, Forest|Forest Lineage", [{
      level: 1,
      spells: ["Minor Illusion", "Speak with Animals"],
    }]],
    ["Gnome, Rock|Rock Lineage", [{
      level: 1,
      spells: ["Mending", "Prestidigitation"],
    }]],
    ["Tiefling, Abyssal|Fiendish Legacy", [
      { level: 1, spells: ["Poison Spray"] },
      { level: 3, spells: ["Ray of Sickness"] },
      { level: 5, spells: ["Hold Person"] },
    ]],
    ["Tiefling, Abyssal|Otherworldly Presence", [{
      level: 1,
      spells: ["Thaumaturgy"],
    }]],
    ["Tiefling, Chthonic|Fiendish Legacy", [
      { level: 1, spells: ["Chill Touch"] },
      { level: 3, spells: ["False Life"] },
      { level: 5, spells: ["Ray of Enfeeblement"] },
    ]],
    ["Tiefling, Chthonic|Otherworldly Presence", [{
      level: 1,
      spells: ["Thaumaturgy"],
    }]],
    ["Tiefling, Infernal|Fiendish Legacy", [
      { level: 1, spells: ["Fire Bolt"] },
      { level: 3, spells: ["Hellish Rebuke"] },
      { level: 5, spells: ["Darkness"] },
    ]],
    ["Tiefling, Infernal|Otherworldly Presence", [{
      level: 1,
      spells: ["Thaumaturgy"],
    }]],
  ]);

  const actual = new Map<string, Array<{ level: number; spells: string[] }>>();
  for (const entry of species) {
    for (const trait of entry.traits as JsonRecord[]) {
      const progressions = (trait.preparedSpellProgression as JsonRecord[] | undefined) ?? [];
      if (progressions.length === 0) continue;
      assert.equal(
        progressions.length,
        1,
        `${String(entry.name)} / ${String(trait.name)} should have one progression`,
      );
      actual.set(
        `${String(entry.name)}|${String(trait.name)}`,
        (progressions[0]?.rows as JsonRecord[]).map((row) => ({
          level: Number(row.level),
          spells: row.spells as string[],
        })),
      );
    }
  }

  assert.deepEqual(actual, expected);
});

test("species and background trait prose survives byte-for-byte after XML normalization", () => {
  const xml = readXml(path.basename(primaryCorpusPath));
  const source = parseSource(xml);
  const document = convertFile(path.basename(primaryCorpusPath));

  const sourceSpeciesTraits = asArray<JsonRecord>(source.race as JsonRecord[] | JsonRecord | null | undefined)
    .flatMap((entry) => asArray<JsonRecord>(entry.trait as JsonRecord[] | JsonRecord | null | undefined)
      .map((trait) => {
        const rawText = asText(trait.text);
        const stripped = rawText.replace(/(?:^|\n)Source:\s*[^\n]+\s*$/iu, "").trim();
        return `${asText(entry.name)}|${asText(trait.name)}|${stripped}`;
      }));
  const nativeSpeciesTraits = batchEntries(document, "species")
    .flatMap((entry) => asArray<JsonRecord>(entry.traits as JsonRecord[] | null | undefined)
      .map((trait) => `${String(entry.name)}|${String(trait.name)}|${String(trait.description)}`));
  assert.deepEqual(sorted(nativeSpeciesTraits), sorted(sourceSpeciesTraits));

  const sourceDescriptions = new Map<string, { description: string; source: string }>();
  const sourceFeatDescriptions = new Map<string, string>();
  for (const entry of asArray<JsonRecord>(source.background as JsonRecord[] | JsonRecord | null | undefined)) {
    for (const trait of asArray<JsonRecord>(entry.trait as JsonRecord[] | JsonRecord | null | undefined)) {
      const name = asText(trait.name);
      const text = asText(trait.text);
      if (/^Description$/iu.test(name)) {
        const sourceMatch = text.match(/\n+\s*Source:\s*(.+?)\s*$/iu);
        sourceDescriptions.set(asText(entry.name), {
          description: sourceMatch ? text.slice(0, sourceMatch.index).trim() : text.trim(),
          source: sourceMatch?.[1]?.trim() ?? "",
        });
      }
      const featName = name.match(/^Feat:\s*(.+)$/iu)?.[1]?.trim();
      if (featName) sourceFeatDescriptions.set(`${asText(entry.name)}|${featName}`, text);
    }
  }
  for (const entry of batchEntries(document, "backgrounds")) {
    assert.deepEqual(
      { description: entry.description, source: entry.source ?? "" },
      sourceDescriptions.get(String(entry.name)),
      `${String(entry.name)} description/source changed`,
    );
    for (const feat of asArray<JsonRecord>((entry.proficiencies as JsonRecord).feats as JsonRecord[])) {
      assert.equal(
        feat.description,
        sourceFeatDescriptions.get(`${String(entry.name)}|${String(feat.name)}`),
        `${String(entry.name)} / ${String(feat.name)} description changed`,
      );
    }
  }
});

test("background starting-equipment choices are structured for the full primary corpus", () => {
  const document = convertFile(path.basename(primaryCorpusPath));
  const backgrounds = batchEntries(document, "backgrounds");
  const withStructuredOptions = backgrounds.filter((background) =>
    Array.isArray((background.equipment as JsonRecord)?.options));
  assert.equal(withStructuredOptions.length, 56);

  for (const background of withStructuredOptions) {
    const equipment = background.equipment as JsonRecord;
    const options = equipment.options as JsonRecord[];
    assert.deepEqual(
      options.map((option) => option.id),
      ["A", "B"],
      `${String(background.name)} must expose both equipment choices`,
    );
    assert.ok(
      (options[0]?.entries as unknown[]).length > 0,
      `${String(background.name)} option A must contain structured entries`,
    );
    assert.deepEqual(
      options[1]?.entries,
      [{ kind: "currency", denomination: "GP", amount: 50 }],
      `${String(background.name)} option B must preserve the 50 GP alternative`,
    );
  }

  const acolyte = backgrounds.find((background) => background.name === "Acolyte");
  const acolyteEntries = ((acolyte?.equipment as JsonRecord).options as JsonRecord[])[0]?.entries as JsonRecord[];
  assert.ok(acolyteEntries.some((entry) =>
    entry.kind === "item" && entry.name === "Parchment" && entry.quantity === 10));

  const guard = backgrounds.find((background) => background.name === "Guard");
  assert.equal(((guard?.equipment as JsonRecord).options as unknown[]).length, 2);
});

test("background V2 is compact, sparse, and materially smaller", () => {
  const document = convertFile(path.basename(primaryCorpusPath));
  const backgrounds = batchEntries(document, "backgrounds");
  const prettyBytes = Buffer.byteLength(JSON.stringify({ entries: backgrounds }, null, 2));
  assert.ok(prettyBytes < 270_000, `background payload grew to ${prettyBytes} bytes`);

  let nullCount = 0;
  let emptyCollectionCount = 0;
  const inspect = (value: unknown): void => {
    if (value === null) {
      nullCount += 1;
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) emptyCollectionCount += 1;
      value.forEach(inspect);
      return;
    }
    if (value && typeof value === "object") {
      const values = Object.values(value);
      if (values.length === 0) emptyCollectionCount += 1;
      values.forEach(inspect);
    }
  };
  backgrounds.forEach(inspect);

  assert.equal(nullCount, 0);
  assert.equal(emptyCollectionCount, 0);
  for (const background of backgrounds) {
    assert.equal(background.schemaVersion, undefined);
    assert.notEqual(background.source, null);
    const proficiencies = background.proficiencies as JsonRecord;
    assert.ok(proficiencies.featChoice === undefined || Number(proficiencies.featChoice) > 0);
    assert.ok(
      proficiencies.abilityScoreChoose === undefined
      || Number(proficiencies.abilityScoreChoose) > 0,
    );
    assert.equal(background.traits, undefined, `${String(background.name)} retained duplicated traits`);
  }
});

test("item V2 is compact, sparse, and omits derivable defaults", () => {
  const document = convertFile(path.basename(primaryCorpusPath));
  const items = batchEntries(document, "items");
  const prettyBytes = Buffer.byteLength(JSON.stringify({ entries: items }, null, 2));
  assert.ok(prettyBytes < 2_200_000, `item payload grew to ${prettyBytes} bytes`);

  let nullCount = 0;
  let emptyCollectionCount = 0;
  const inspect = (value: unknown): void => {
    if (value === null) {
      nullCount += 1;
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) emptyCollectionCount += 1;
      value.forEach(inspect);
      return;
    }
    if (value && typeof value === "object") {
      const values = Object.values(value);
      if (values.length === 0) emptyCollectionCount += 1;
      values.forEach(inspect);
    }
  };
  items.forEach(inspect);

  assert.equal(nullCount, 0);
  assert.equal(emptyCollectionCount, 0);
  assert.ok(items.every((item) => item.schemaVersion === undefined));
  assert.ok(items.every((item) => item.classification === undefined));
  assert.ok(items.every((item) => item.equipment === undefined));
  assert.ok(items.every((item) => item.typeKey === undefined));
});

test("spell V2 is compact, sparse, and omits default mechanics", () => {
  const document = convertFile(path.basename(primaryCorpusPath));
  const spells = batchEntries(document, "spells");
  const prettyBytes = Buffer.byteLength(JSON.stringify({ entries: spells }, null, 2));
  assert.ok(prettyBytes < 680_000, `spell payload grew to ${prettyBytes} bytes`);

  let nullCount = 0;
  let emptyCollectionCount = 0;
  const inspect = (value: unknown): void => {
    if (value === null) {
      nullCount += 1;
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) emptyCollectionCount += 1;
      value.forEach(inspect);
      return;
    }
    if (value && typeof value === "object") {
      const values = Object.values(value);
      if (values.length === 0) emptyCollectionCount += 1;
      values.forEach(inspect);
    }
  };
  spells.forEach(inspect);

  assert.equal(nullCount, 0);
  assert.equal(emptyCollectionCount, 0);
  assert.ok(spells.every((spell) => spell.schemaVersion === undefined));
  assert.ok(spells.every((spell) => spell.ritual === undefined || spell.ritual === true));
  assert.ok(spells.every((spell) => {
    const duration = ((spell.casting ?? {}) as JsonRecord).duration as JsonRecord | undefined;
    return duration?.concentration === undefined || duration.concentration === true;
  }));
});

test("feat V2 is compact, sparse, and expands safely at the legacy boundary", () => {
  const document = convertFile(path.basename(primaryCorpusPath));
  const feats = batchEntries(document, "feats");
  const prettyBytes = Buffer.byteLength(JSON.stringify({ entries: feats }, null, 2));
  assert.ok(prettyBytes < 475_000, `feat payload grew to ${prettyBytes} bytes`);

  let nullCount = 0;
  let emptyCollectionCount = 0;
  const inspect = (value: unknown): void => {
    if (value === null) {
      nullCount += 1;
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) emptyCollectionCount += 1;
      value.forEach(inspect);
      return;
    }
    if (value && typeof value === "object") {
      const values = Object.values(value);
      if (values.length === 0) emptyCollectionCount += 1;
      values.forEach(inspect);
    }
  };
  feats.forEach(inspect);

  assert.equal(nullCount, 0);
  assert.equal(emptyCollectionCount, 0);
  assert.ok(feats.every((feat) => feat.schemaVersion === undefined));
  assert.ok(feats.every((feat) => feat.repeatable === undefined || feat.repeatable === true));

  const compact = feats.find((feat) => feat.name === "Aberrant Dragonmark");
  assert.ok(compact);
  const legacy = parseStoredCompendiumEntry("feats", JSON.stringify(compact));
  const parsed = legacy.parsed as JsonRecord;
  const grants = parsed.grants as JsonRecord;
  assert.ok(Array.isArray(grants.skills));
  assert.ok(Array.isArray(parsed.choices));
  assert.equal(parsed.source, compact.source);
  assert.equal(parsed.resolution, compact.resolution);
});

test("monster V2 is compact, sparse, and omits inactive mechanics", () => {
  const document = convertFile(path.basename(primaryCorpusPath));
  const monsters = batchEntries(document, "monsters");
  const prettyBytes = Buffer.byteLength(JSON.stringify({ entries: monsters }, null, 2));
  assert.ok(prettyBytes < 2_500_000, `monster payload grew to ${prettyBytes} bytes`);

  let nullCount = 0;
  let emptyCollectionCount = 0;
  const inspect = (value: unknown): void => {
    if (value === null) {
      nullCount += 1;
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) emptyCollectionCount += 1;
      value.forEach(inspect);
      return;
    }
    if (value && typeof value === "object") {
      const values = Object.values(value);
      if (values.length === 0) emptyCollectionCount += 1;
      values.forEach(inspect);
    }
  };
  monsters.forEach(inspect);

  assert.equal(nullCount, 0);
  assert.equal(emptyCollectionCount, 0);
  assert.ok(monsters.every((monster) => monster.schemaVersion === undefined));
  assert.ok(monsters.every((monster) => monster.challenge == null || (monster.challenge as JsonRecord).xp !== null));
});

test("all class features and species/background traits declare resolution", () => {
  const document = convertFile(path.basename(primaryCorpusPath));
  for (const cls of batchEntries(document, "classes")) {
    for (const level of cls.levels as JsonRecord[]) {
      for (const feature of (level.features as JsonRecord[] | undefined) ?? []) {
        assert.ok(
          ["automatic", "manual", "mixed"].includes(String(feature.resolution)),
          `${String(cls.name)} / ${String(feature.name)} must declare resolution`,
        );
        assert.ok(
          feature.resolutionNotes === undefined || Array.isArray(feature.resolutionNotes),
          `${String(cls.name)} / ${String(feature.name)} resolution notes must be actionable when present`,
        );
      }
    }
  }
  for (const category of ["species", "backgrounds"]) {
    for (const entry of batchEntries(document, category)) {
      const traits = asArray<JsonRecord>(entry.traits as JsonRecord[] | null | undefined);
      const backgroundFeats = category === "backgrounds"
        ? asArray<JsonRecord>((entry.proficiencies as JsonRecord)?.feats as JsonRecord[] | null | undefined)
        : [];
      for (const trait of [...traits, ...backgroundFeats]) {
        assert.ok(
          ["automatic", "manual", "mixed"].includes(String(trait.resolution)),
          `${String(entry.name)} / ${String(trait.name)} must declare resolution`,
        );
        assert.ok(
          trait.resolutionNotes === undefined || Array.isArray(trait.resolutionNotes),
          `${String(entry.name)} / ${String(trait.name)} resolution notes must be actionable when present`,
        );
      }
    }
  }
});

test("canonical content omits redundant resolution-note boilerplate", () => {
  const document = convertFile(path.basename(primaryCorpusPath));
  const notes: string[] = [];
  for (const cls of batchEntries(document, "classes")) {
    for (const level of cls.levels as JsonRecord[]) {
      for (const feature of (level.features as JsonRecord[] | undefined) ?? []) {
        notes.push(...asArray(feature.resolutionNotes).map(asText));
      }
    }
  }
  for (const category of ["species", "backgrounds"]) {
    for (const entry of batchEntries(document, category)) {
      const traits = asArray<JsonRecord>(entry.traits as JsonRecord[] | null | undefined);
      const backgroundFeats = category === "backgrounds"
        ? asArray<JsonRecord>((entry.proficiencies as JsonRecord)?.feats as JsonRecord[] | null | undefined)
        : [];
      for (const trait of [...traits, ...backgroundFeats]) {
        notes.push(...asArray(trait.resolutionNotes).map(asText));
      }
    }
  }
  assert.ok(!notes.includes(
    "Structured benefits are applied where supported; remaining prose requires manual resolution.",
  ));
  assert.ok(!notes.includes(
    "No deterministic mechanics are encoded; resolve this feature manually.",
  ));
});
