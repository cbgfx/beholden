import type Database from "better-sqlite3";
import { parseFeat } from "../../lib/featParser.js";
import { classifyFeatResolution, withFeatResolution } from "../../lib/featResolution.js";
import { compactBackgroundEntry } from "./backgroundCompaction.js";
import { compactFeatEntry, expandFeatMechanics } from "./featCompaction.js";
import { compactClassEntry } from "./classCompaction.js";
import { compactSpeciesEntry } from "./speciesCompaction.js";
import {
  hasStructuredClassFeatureMechanics,
  hasStructuredTraitMechanics,
  withContentResolution,
} from "./contentResolution.js";
import { normalizeCanonicalSpell } from "./spellNormalization.js";
import { compactSpellEntry } from "./spellCompaction.js";
import {
  CANONICAL_V2_SCHEMA_VERSION,
  CATEGORY_SCHEMAS,
  type NativeCompendiumCategory,
} from "./nativeCompendiumV2Schemas.js";
import { compactItemEntry } from "./itemCompaction.js";
import { compactMonsterEntry } from "./monsterCompaction.js";

import { type JsonRecord, record, list, text } from "../../lib/jsonRecord.js";

const ABILITY_KEYS: Record<string, string> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

const REFRESHED_FIGHTING_STYLE_MECHANICS = new Set([
  "Fighting Style: Archery",
  "Fighting Style: Blessed Warrior",
  "Fighting Style: Blind Fighting",
  "Fighting Style: Defense",
  "Fighting Style: Dueling",
  "Fighting Style: Great Weapon Fighting",
  "Fighting Style: Interception",
  "Fighting Style: Protection",
  "Fighting Style: Thrown Weapon Fighting",
  "Fighting Style: Two-Weapon Fighting",
  "Fighting Style: Unarmed Fighting",
]);

function nullable(value: unknown): unknown {
  return value === undefined ? null : value;
}

function ability(value: unknown): unknown {
  if (value == null || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  return ABILITY_KEYS[normalized] ?? normalized;
}

function upgradeTrait(raw: unknown, index: number): JsonRecord {
  const { modifiers: _m, specials: _s, proficiencies: _p, ...trait } = record(raw);
  const upgraded = {
    ...trait,
    id: trait.id ?? `trait_${index + 1}`,
    name: trait.name ?? `Trait ${index + 1}`,
    description: trait.description ?? "",
    category: nullable(trait.category),
    scalingRolls: list(trait.scalingRolls),
    preparedSpellProgression: list(trait.preparedSpellProgression),
  };
  return withContentResolution(upgraded, hasStructuredTraitMechanics(upgraded));
}

function upgradeMonster(entry: JsonRecord): JsonRecord {
  return compactMonsterEntry(entry);
}

function upgradeItem(entry: JsonRecord): JsonRecord {
  return compactItemEntry(entry);
}

function upgradeSpell(entry: JsonRecord): JsonRecord {
  return compactSpellEntry(normalizeCanonicalSpell({
    ...entry,
    source: nullable(entry.source),
    rolls: list(entry.rolls).map((raw) => {
      const roll = record(raw);
      return {
        ...roll,
        description: nullable(roll.description),
        scaling: nullable(roll.scaling),
        level: nullable(roll.level),
        formula: roll.formula ?? "",
      };
    }),
  }));
}

function upgradeClass(entry: JsonRecord): JsonRecord {
  const proficiencies = record(entry.proficiencies);
  const skills = record(proficiencies.skills);
  const tools = proficiencies.tools;
  const toolsRecord = record(tools);
  const normalizedTools = Array.isArray(tools)
    ? { fixed: tools, choices: [], notes: [] }
    : {
        ...toolsRecord,
        fixed: list(toolsRecord.fixed),
        choices: list(toolsRecord.choices),
        notes: list(toolsRecord.notes),
      };
  const spellcasting = record(entry.spellcasting);
  const descriptions = list(entry.descriptions);
  return compactClassEntry({
    ...entry,
    source: entry.source ?? null,
    description: entry.description ?? "",
    descriptions: descriptions.length > 0
      ? descriptions
      : [entry.description].filter((value) => typeof value === "string" && value.length > 0),
    startingWealth: nullable(entry.startingWealth),
    proficiencies: {
      ...proficiencies,
      savingThrows: list(proficiencies.savingThrows),
      skills: {
        ...skills,
        choose: typeof skills.choose === "number" ? skills.choose : 0,
        from: list(skills.from),
      },
      armor: list(proficiencies.armor),
      weapons: list(proficiencies.weapons),
      tools: normalizedTools,
    },
    spellcasting: {
      ...spellcasting,
      ability: ability(spellcasting.ability),
      slotRecovery: spellcasting.slotRecovery ?? "long_rest",
    },
    levels: list(entry.levels).map((rawLevel) => {
      const level = record(rawLevel);
      return {
        ...level,
        features: list(level.features).map((rawFeature, index) => {
          const feature = record(rawFeature);
          const effects = list(feature.effects).map(record);
          const migratedRolls = effects
            .filter((effect) => effect.kind === "legacy_roll")
            .map((effect) => ({
              description: nullable(effect.description),
              level: nullable(effect.level),
              formula: String(effect.formula ?? effect.value ?? ""),
            }))
            .filter((roll) => roll.formula);
          const upgradedFeature = {
            ...feature,
            id: feature.id ?? `level_${String(level.level ?? "unknown")}_feature_${index + 1}`,
            description: feature.description ?? "",
            optional: feature.optional === true,
            effects: effects.filter((effect) => effect.kind !== "legacy_roll"),
            scalingRolls: [...list(feature.scalingRolls), ...migratedRolls],
            preparedSpellProgression: list(feature.preparedSpellProgression),
          };
          return withContentResolution(
            upgradedFeature,
            hasStructuredClassFeatureMechanics(upgradedFeature),
          );
        }),
        abilityScoreImprovement: level.abilityScoreImprovement === true,
        cantripsKnown: level.cantripsKnown ?? null,
        spellSlots: level.spellSlots ?? {},
        resources: list(level.resources).map((rawResource) => {
          const r = record(rawResource);
          return { ...r, recovery: r.recovery ?? "long_rest", subclass: r.subclass !== undefined ? r.subclass : null };
        }),
      };
    }),
  });
}

function upgradeSpecies(entry: JsonRecord): JsonRecord {
  return compactSpeciesEntry({
    ...entry,
    source: nullable(entry.source),
    spellcastingAbility: ability(entry.spellcastingAbility),
    resistances: list(entry.resistances).map(String),
    traits: list(entry.traits).map(upgradeTrait),
  });
}

function upgradeBackground(entry: JsonRecord): JsonRecord {
  return compactBackgroundEntry(entry);
}

function upgradeFeat(entry: JsonRecord): JsonRecord {
  const { modifiers: rawModifiers, ...rest } = entry;
  const name = String(rest.name ?? "");
  const shouldRefreshMechanics = REFRESHED_FIGHTING_STYLE_MECHANICS.has(name);
  const rawMechanics = shouldRefreshMechanics
    ? (() => {
        const reparsed = parseFeat({
          name,
          text: String(rest.description ?? ""),
          prerequisite: typeof rest.prerequisite === "string" ? rest.prerequisite : null,
          modifiers: list(rawModifiers).map((raw) => {
            const modifier = record(raw);
            return {
              category: String(modifier.category ?? ""),
              text: String(modifier.value ?? modifier.text ?? ""),
            };
          }),
        });
        // Description may have been stripped of its Source: line; restore mechanics.source from
        // existing mechanics or the entity-level source field so round-trips stay lossless.
        return {
          ...reparsed,
          source: reparsed.source ?? record(rest.mechanics).source ?? text(rest.source),
        };
      })()
    : record(rest.mechanics);
  // Expand sparse compact mechanics (has baseName but missing grants/choices/uses) back to full shape
  // before hasParsedMechanics check, so round-tripped compact entries are treated correctly.
  const expandedMechanics = expandFeatMechanics(rawMechanics, rest);
  const hasParsedMechanics = "grants" in expandedMechanics
    && Array.isArray(expandedMechanics.choices)
    && Array.isArray(expandedMechanics.uses);
  const fullMechanics = hasParsedMechanics
    ? withFeatResolution(name, record(expandedMechanics))
    : expandedMechanics;
  const classified = classifyFeatResolution(name, fullMechanics);
  return compactFeatEntry({
    ...rest,
    source: nullable(rest.source),
    category: nullable(rest.category),
    prerequisite: nullable(rest.prerequisite),
    repeatable: rest.repeatable === true,
    description: rest.description ?? "",
    resolution: rest.resolution ?? classified.resolution,
    resolutionNotes: list(rest.resolutionNotes ?? classified.resolutionNotes),
    mechanics: fullMechanics,
  });
}

export function isCanonicalV2Shape(category: string, entry: JsonRecord): boolean {
  if (entry.schemaVersion === CANONICAL_V2_SCHEMA_VERSION) return true;
  switch (category) {
    case "monsters":
      return "armorClass" in entry && "hitPoints" in entry && !("ac" in entry);
    case "items":
      return (
        ("classification" in entry && "attunement" in entry && "weapon" in entry)
        || ("type" in entry && "rarity" in entry && "description" in entry && !("text" in entry))
      );
    case "spells":
      return Array.isArray(entry.description) && !("text" in entry);
    case "classes":
      return "levels" in entry && "hitDie" in entry && "spellcasting" in entry;
    case "species":
      return Array.isArray(entry.traits) && !("resist" in entry) && !("spellAbility" in entry);
    case "backgrounds":
      return Boolean(
        "proficiencies" in entry
        && typeof entry.proficiencies === "object"
        && !Array.isArray(entry.proficiencies)
        && typeof entry.description === "string",
      );
    case "feats":
      return typeof entry.description === "string" && !("text" in entry);
    case "decks":
      return "deckName" in entry && "cardName" in entry;
    case "bastions":
      return ["space", "order", "facility"].includes(String(entry.kind ?? ""));
    default:
      return false;
  }
}

export function upgradeCanonicalV2Entry(category: string, entry: JsonRecord): JsonRecord {
  const { ruleset: _r, ...strippedEntry } = entry;
  // reassign so the category-specific upgraders work on the stripped object
  entry = strippedEntry;
  let upgraded: JsonRecord;
  switch (category) {
    case "monsters": upgraded = upgradeMonster(entry); break;
    case "items": upgraded = upgradeItem(entry); break;
    case "spells": upgraded = upgradeSpell(entry); break;
    case "classes": upgraded = upgradeClass(entry); break;
    case "species": upgraded = upgradeSpecies(entry); break;
    case "backgrounds": upgraded = upgradeBackground(entry); break;
    case "feats": upgraded = upgradeFeat(entry); break;
    default: upgraded = { ...entry };
  }
  return category === "backgrounds" || category === "items" || category === "monsters" || category === "spells" || category === "feats" || category === "species" || category === "classes"
    ? upgraded
    : { ...upgraded, schemaVersion: CANONICAL_V2_SCHEMA_VERSION };
}

function mergeActionEdits(existingValue: unknown, replacementValue: unknown): JsonRecord[] {
  const existing = list(existingValue).map(record);
  return list(replacementValue).map((rawReplacement, index) => {
    const replacement = record(rawReplacement);
    const byName = existing.find((entry) =>
      String(entry.name ?? "").trim().toLowerCase()
      === String(replacement.name ?? "").trim().toLowerCase()
    );
    const previous = byName ?? existing[index] ?? {};
    return {
      ...previous,
      ...replacement,
      id: previous.id ?? replacement.id,
      category: previous.category ?? replacement.category ?? null,
      recharge: previous.recharge ?? replacement.recharge ?? null,
      attacks: list(previous.attacks).length > 0 ? previous.attacks : list(replacement.attacks),
    };
  });
}

export function mergeCanonicalV2Edit(
  category: "monsters" | "items" | "spells",
  existingEntry: JsonRecord,
  replacementEntry: JsonRecord,
): JsonRecord {
  if (!isCanonicalV2Shape(category, existingEntry)) return replacementEntry;
  const existing = upgradeCanonicalV2Entry(category, existingEntry);
  const replacement = upgradeCanonicalV2Entry(category, replacementEntry);

  if (category === "monsters") {
    const existingClassification = record(existing.classification);
    const replacementClassification = record(replacement.classification);
    return compactMonsterEntry({
      ...existing,
      ...replacement,
      source: existing.source ?? replacement.source,
      classification: {
        ...existingClassification,
        ...replacementClassification,
        sortName: existingClassification.sortName ?? replacementClassification.sortName,
        alignment: existingClassification.alignment ?? replacementClassification.alignment,
        ancestry: existingClassification.ancestry ?? replacementClassification.ancestry,
      },
      description: existing.description ?? replacement.description,
      initiativeBonus: existing.initiativeBonus ?? replacement.initiativeBonus,
      passivePerception: existing.passivePerception ?? replacement.passivePerception,
      npc: existing.npc ?? replacement.npc,
      traits: mergeActionEdits(existing.traits, replacement.traits),
      actions: mergeActionEdits(existing.actions, replacement.actions),
      reactions: mergeActionEdits(existing.reactions, replacement.reactions),
      legendaryActions: mergeActionEdits(existing.legendaryActions, replacement.legendaryActions),
      spellcasting: existing.spellcasting,
      spells: existing.spells,
    });
  }

  if (category === "items") {
    const existingArmor = record(existing.armor);
    const replacementArmor = record(replacement.armor);
    const existingWeapon = record(existing.weapon);
    const replacementWeapon = record(replacement.weapon);
    return compactItemEntry({
      ...existing,
      ...replacement,
      source: existing.source ?? replacement.source,
      attunement: typeof existing.attunement === "string"
        ? existing.attunement
        : replacement.attunement ?? existing.attunement,
      equippable: existing.equippable ?? replacement.equippable,
      proficiency: existing.proficiency ?? replacement.proficiency,
      armor: {
        ...existingArmor,
        ...replacementArmor,
        strength: existingArmor.strength ?? replacementArmor.strength,
      },
      weapon: {
        ...existingWeapon,
        ...replacementWeapon,
        range: existingWeapon.range ?? replacementWeapon.range,
      },
      detail: existing.detail ?? replacement.detail,
      rolls: existing.rolls ?? replacement.rolls,
    });
  }

  return compactSpellEntry({
    ...existing,
    ...replacement,
    source: existing.source ?? replacement.source,
    rolls: existing.rolls,
  });
}

const STORED_TABLES = [
  ["monsters", "compendium_monsters"],
  ["items", "compendium_items"],
  ["spells", "compendium_spells"],
  ["classes", "compendium_classes"],
  ["species", "compendium_races"],
  ["backgrounds", "compendium_backgrounds"],
  ["feats", "compendium_feats"],
] as const satisfies ReadonlyArray<readonly [NativeCompendiumCategory, string]>;

export function upgradeStoredCanonicalV2Entries(db: Database.Database): number {
  let updated = 0;
  db.transaction(() => {
    for (const [category, table] of STORED_TABLES) {
      const rows = db.prepare(`SELECT id, data_json FROM ${table}`).all() as Array<{ id: string; data_json: string }>;
      const update = db.prepare(`UPDATE ${table} SET data_json = ? WHERE id = ?`);
      for (const row of rows) {
        let entry: JsonRecord;
        try {
          entry = record(JSON.parse(row.data_json));
        } catch {
          continue;
        }
        if (!isCanonicalV2Shape(category, entry)) continue;
        const upgraded = upgradeCanonicalV2Entry(category, entry);
        const parsed = CATEGORY_SCHEMAS[category].safeParse(upgraded);
        if (!parsed.success) continue;
        const nextJson = JSON.stringify(parsed.data);
        if (nextJson === row.data_json) continue;
        update.run(nextJson, row.id);
        updated += 1;
      }
    }
  })();
  return updated;
}
