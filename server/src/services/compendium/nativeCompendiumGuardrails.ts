import type Database from "better-sqlite3";
import { SHARED_CONDITION_DEFS } from "@beholden/shared/domain/conditions";
import type { NativeCompendiumBatch, NativeCompendiumCategory } from "./nativeCompendium.js";

type JsonRecord = Record<string, unknown>;
// Exhaustion is tracked as a numeric level elsewhere (not a toggle condition instance), so it's
// intentionally absent from SHARED_CONDITION_DEFS — but it's still a valid defense-effect target.
const CONDITION_NAMES = new Set([...SHARED_CONDITION_DEFS.map((def) => def.name), "Exhaustion"]);
const DAMAGE_TYPES = new Set([
  "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic",
  "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder",
]);
const SKILLS = new Set([
  "acrobatics", "animal handling", "arcana", "athletics", "deception", "history", "insight", "intimidation",
  "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight of hand",
  "stealth", "survival",
]);
const SPELL_FILTERS = new Set([
  "artificer", "bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard",
  "abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation",
]);
const FAKE_FEAT_CHOICE_NAME = /feat of your choice|\sor a dark gift feat/iu;
const ABILITIES = new Set(["str", "dex", "con", "int", "wis", "cha", "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]);
const FEAT_CATEGORIES = new Set(["O", "E", "F"]);
const CORRUPTION = /(?:\uFFFD|Ã.|â€|â€™|â€œ|â€|\b(?:sleight|proficiency|strength|dexterity|constitution|intelligence|wisdom|charisma)\s*[0O]\b)/u;

function normalized(value: unknown): string { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function rows(db: Database.Database, sql: string): Array<{ id: string; name?: string }> { return db.prepare(sql).all() as Array<{ id: string; name?: string }>; }

export function assertNativeCompendiumGuardrails(db: Database.Database, batches: NativeCompendiumBatch[]): void {
  const ids = new Map<NativeCompendiumCategory, Set<string>>([
    ["monsters", new Set(rows(db, "SELECT id FROM compendium_monsters").map((row) => row.id))],
    ["items", new Set(rows(db, "SELECT id FROM compendium_items").map((row) => row.id))],
    ["spells", new Set(rows(db, "SELECT id FROM compendium_spells").map((row) => row.id))],
    ["classTalents", new Set(rows(db, "SELECT id FROM compendium_class_talents").map((row) => row.id))],
    ["classes", new Set(rows(db, "SELECT id FROM compendium_classes").map((row) => row.id))],
    ["species", new Set(rows(db, "SELECT id FROM compendium_races").map((row) => row.id))],
    ["backgrounds", new Set(rows(db, "SELECT id FROM compendium_backgrounds").map((row) => row.id))],
    // feat ids alone aren't unique across rulesets (composite PK (id, ruleset)) -- keyed here
    // as "ruleset:id" so feat-reference checks only match a feat from the SAME ruleset as the
    // entry referencing it, not an unrelated same-id feat from the other ruleset.
    ["feats", new Set((db.prepare("SELECT id, ruleset FROM compendium_feats").all() as Array<{ id: string; ruleset: string }>).map((row) => `${row.ruleset}:${row.id}`))],
    ["decks", new Set(rows(db, "SELECT id FROM compendium_deck_cards").map((row) => row.id))],
    ["bastions", new Set([
      ...rows(db, "SELECT id FROM compendium_bastion_spaces").map((row) => row.id),
      ...rows(db, "SELECT id FROM compendium_bastion_orders").map((row) => row.id),
      ...rows(db, "SELECT id FROM compendium_bastion_facilities").map((row) => row.id),
    ])],
  ]);
  const spellNames = new Set(rows(db, "SELECT id, name FROM compendium_spells").map((row) => normalized(row.name)));
  for (const batch of batches) for (const entry of batch.entries) {
    if (batch.category === "feats") ids.get("feats")!.add(`${String(entry.ruleset)}:${String(entry.id)}`);
    else ids.get(batch.category)!.add(String(entry.id));
    if (batch.category === "spells") spellNames.add(normalized(entry.name));
  }
  const spellIds = ids.get("spells")!;
  const itemIds = ids.get("items")!;
  const featIds = ids.get("feats")!;
  const talentIds = ids.get("classTalents")!;
  const itemNamesById = new Map(rows(db, "SELECT id, name FROM compendium_items").map((row) => [row.id, String(row.name ?? "")]));
  for (const batch of batches) if (batch.category === "items") for (const entry of batch.entries) {
    itemNamesById.set(String(entry.id), String(entry.name ?? ""));
  }
  const spellAccessIds = new Set<string>();
  for (const row of db.prepare("SELECT data_json FROM compendium_classes").all() as Array<{ data_json: string }>) {
    try {
      const stored = JSON.parse(row.data_json) as JsonRecord;
      if (stored.spellLists && typeof stored.spellLists === "object" && !Array.isArray(stored.spellLists)) Object.keys(stored.spellLists as JsonRecord).forEach((id) => spellAccessIds.add(id));
    } catch { /* stored canonical validation reports malformed rows elsewhere */ }
  }
  for (const batch of batches) if (batch.category === "classes") for (const entry of batch.entries) {
    if (entry.spellLists && typeof entry.spellLists === "object" && !Array.isArray(entry.spellLists)) Object.keys(entry.spellLists as JsonRecord).forEach((id) => spellAccessIds.add(id));
  }
  const issues: string[] = [];
  const requireSpell = (value: unknown, owner: string, path: string) => {
    const reference = String(value ?? "").trim();
    if (!reference || spellIds.has(reference) || spellNames.has(normalized(reference))) return;
    issues.push(`${owner}.${path} references unknown spell ${JSON.stringify(reference)}`);
  };
  const requireItem = (value: unknown, owner: string, path: string) => {
    const reference = String(value ?? "").trim();
    if (!reference || itemIds.has(reference)) return;
    issues.push(`${owner}.${path} references unknown item id ${JSON.stringify(reference)}`);
  };
  const requireFeat = (value: unknown, owner: string, path: string, ruleset: string) => {
    const reference = String(value ?? "").trim();
    if (!reference || featIds.has(`${ruleset}:${reference}`)) return;
    issues.push(`${owner}.${path} references unknown feat id ${JSON.stringify(reference)}`);
  };
  const requireTalent = (value: unknown, owner: string, path: string) => {
    const reference = String(value ?? "").trim();
    if (!reference || talentIds.has(reference)) return;
    issues.push(`${owner}.${path} references unknown ClassTalent id ${JSON.stringify(reference)}`);
  };
  function walk(value: unknown, owner: string, path: string[] = []): void {
    if (typeof value === "string") {
      if (CORRUPTION.test(value)) issues.push(`${owner}.${path.join(".")} contains corrupted mechanical text ${JSON.stringify(value)}`);
      return;
    }
    if (Array.isArray(value)) { value.forEach((entry, index) => walk(entry, owner, [...path, String(index)])); return; }
    if (!value || typeof value !== "object") return;
    const record = value as JsonRecord;
    if (Array.isArray(record.rows) && path.at(-1) === "preparedSpellProgression") {
      for (const [rowIndex, row] of (record.rows as JsonRecord[]).entries()) for (const [spellIndex, spell] of (Array.isArray(row.spells) ? row.spells : []).entries()) {
        requireSpell(spell, owner, `${path.join(".")}.rows.${rowIndex}.spells.${spellIndex}`);
      }
    }
    if (record.kind === "item") {
      if (!record.itemId) issues.push(`${owner}.${path.join(".")} uses legacy name-only equipment; itemId is required`);
      else requireItem(record.itemId, owner, `${path.join(".")}.itemId`);
    }
    if (record.kind === "itemChoice" && Array.isArray(record.itemIds)) record.itemIds.forEach((id, index) => requireItem(id, owner, `${path.join(".")}.itemIds.${index}`));
    const bundle = record.bundle && typeof record.bundle === "object" && !Array.isArray(record.bundle)
      ? record.bundle as JsonRecord
      : null;
    if (bundle) {
      requireItem(bundle.container, owner, `${path.join(".")}.bundle.container`);
      const bundledItems = bundle.items && typeof bundle.items === "object" && !Array.isArray(bundle.items)
        ? bundle.items as JsonRecord
        : null;
      if (bundledItems) Object.keys(bundledItems).forEach((id) => requireItem(id, owner, `${path.join(".")}.bundle.items.${id}`));
    }
    if (record.type === "spell" && Array.isArray(record.options)) record.options.forEach((spell, index) => {
      const option = String(spell);
      if (option.startsWith("s_")) requireSpell(option, owner, `${path.join(".")}.options.${index}`);
      else if (!SPELL_FILTERS.has(normalized(option))) issues.push(`${owner}.${path.join(".")}.options.${index} contains unknown spell filter ${JSON.stringify(option)}`);
    });
    if (record.grants && typeof record.grants === "object") {
      const grants = record.grants as JsonRecord;
      for (const key of ["spells", "cantrips"]) if (Array.isArray(grants[key])) grants[key].forEach((spell, index) => requireSpell(spell, owner, `${path.join(".")}.grants.${key}.${index}`));
      if (Array.isArray(grants.savingThrows)) grants.savingThrows.forEach((ability, index) => {
        if (!ABILITIES.has(normalized(ability))) issues.push(`${owner}.${path.join(".")}.grants.savingThrows.${index} contains non-ability saving throw ${JSON.stringify(ability)}`);
      });
    }
    Object.entries(record).forEach(([key, entry]) => walk(entry, owner, [...path, key]));
  }

  for (const batch of batches) for (const entry of batch.entries) {
    const owner = `${batch.category}[${String(entry.id)}]`;
    if (batch.category === "monsters" && Array.isArray(entry.spells)) for (const [index, raw] of (entry.spells as JsonRecord[]).entries()) {
      if (raw.id) requireSpell(raw.id, owner, `spells.${index}.id`);
    }
    if (batch.category === "items" && entry.spells && typeof entry.spells === "object" && !Array.isArray(entry.spells)) {
      for (const spellId of Object.keys(entry.spells as JsonRecord)) requireSpell(spellId, owner, `spells.${spellId}`);
    }
    if (batch.category === "items" && entry.spellTemplate) {
      const templates = Array.isArray(entry.spellTemplate) ? entry.spellTemplate : [entry.spellTemplate];
      for (const [templateIndex, rawTemplate] of templates.entries()) {
        const template = rawTemplate as JsonRecord;
        if (template.kind !== "random" || !template.outcomes || typeof template.outcomes !== "object") continue;
        for (const [range, rawOutcome] of Object.entries(template.outcomes as JsonRecord)) {
          const spellId = typeof rawOutcome === "string" ? rawOutcome : (rawOutcome as JsonRecord)?.id;
          requireSpell(spellId, owner, `spellTemplate.${templateIndex}.outcomes.${range}`);
        }
      }
    }
    if (batch.category === "classes") {
      const skills = ((entry.proficiencies as JsonRecord | undefined)?.skills as JsonRecord | undefined)?.from;
      if (Array.isArray(skills)) for (const skill of skills) if (!SKILLS.has(normalized(skill))) issues.push(`${owner}.proficiencies.skills.from contains unknown skill ${JSON.stringify(skill)}`);
      const existing = db.prepare("SELECT data_json FROM compendium_classes WHERE id = ? AND ruleset = ?").get(String(entry.id), String(entry.ruleset)) as { data_json?: string } | undefined;
      if (existing?.data_json) {
        const stored = JSON.parse(existing.data_json) as JsonRecord;
        const existingLevels = Array.isArray(stored.levels) ? stored.levels.length : 0;
        const incomingLevels = Array.isArray(entry.levels) ? entry.levels.length : 0;
        if (existingLevels === 20 && incomingLevels < 20) issues.push(`${owner}.levels is a partial replacement (${incomingLevels}/20 levels)`);
      }
    }
    if (batch.category === "backgrounds") {
      const proficiencies = entry.proficiencies as JsonRecord | undefined;
      if (proficiencies?.feat) requireFeat(proficiencies.feat, owner, "proficiencies.feat", String(entry.ruleset));
      const featChoice = proficiencies?.featChoice as JsonRecord | undefined;
      if (featChoice && typeof featChoice === "object" && Array.isArray(featChoice.from)) {
        featChoice.from.forEach((featId, index) => requireFeat(featId, owner, `proficiencies.featChoice.from.${index}`, String(entry.ruleset)));
      }
      checkBackgroundEquipmentLabels(entry, owner, itemNamesById, issues);
    }
    if (batch.category === "spells" && Array.isArray(entry.access)) {
      for (const accessId of entry.access) if (!spellAccessIds.has(String(accessId))) {
        issues.push(`${owner}.access references unknown spell-list id ${JSON.stringify(accessId)}`);
      }
    }
    if (batch.category === "spells" && Array.isArray(entry.rolls)) {
      for (const [rollIndex, roll] of (entry.rolls as JsonRecord[]).entries()) {
        if (String(roll.formula ?? "").includes("%0")) issues.push(`${owner}.rolls.${rollIndex}.formula contains the broken %0 ability placeholder`);
      }
    }
    if (batch.category === "feats" && FAKE_FEAT_CHOICE_NAME.test(String(entry.name ?? ""))) issues.push(`${owner}.name is a choice sentence, not a catalog feat`);
    if (batch.category === "classTalents") {
      const prerequisite = entry.prerequisite as JsonRecord | undefined;
      if (prerequisite?.talent) requireTalent(prerequisite.talent, owner, "prerequisite.talent");
      const choiceIds = new Set<string>();
      for (const [effectIndex, effect] of (Array.isArray(entry.effects) ? entry.effects as JsonRecord[] : []).entries()) {
        if (effect.type !== "spell_choice" && effect.type !== "feat_choice") continue;
        const choiceId = String(effect.choiceId ?? "").trim();
        if (!choiceId) issues.push(`${owner}.effects.${effectIndex}.choiceId is required for a persistent choice`);
        else if (choiceIds.has(choiceId)) issues.push(`${owner}.effects.${effectIndex}.choiceId duplicates ${JSON.stringify(choiceId)}`);
        else choiceIds.add(choiceId);
        if (effect.type !== "spell_choice") continue;
        for (const [listIndex, accessId] of (Array.isArray(effect.spellLists) ? effect.spellLists : []).entries()) {
          if (!spellAccessIds.has(String(accessId))) issues.push(`${owner}.effects.${effectIndex}.spellLists.${listIndex} references unknown spell-list id ${JSON.stringify(accessId)}`);
        }
      }
    }
    if (batch.category === "feats") checkFeatIdentityAndChoices(entry, owner, featIds, issues);
    if (batch.category === "classes" || batch.category === "species" || batch.category === "feats" || batch.category === "backgrounds") {
      checkAutomaticResolutionIsComplete(entry, batch.category, owner, issues);
    }
    if (batch.category === "species") {
      checkSpeciesFactHomesAndReferences(entry, owner, issues);
    }
    walk(entry, owner);
  }
  if (issues.length) throw new Error(`Compendium import guardrails failed:\n- ${issues.join("\n- ")}`);
}

/** A stored equipment `sourceLabel` exists only to differ from the catalog item name (display
 * ordering like "Traveler's Clothes", or flavor like "Book (prayers)"). A label equal to the
 * catalog name duplicates a fact whose home is the item record — the backgrounds API projects
 * the name at read time, so canonical storage must omit it. */
function checkBackgroundEquipmentLabels(
  entry: JsonRecord,
  owner: string,
  itemNamesById: Map<string, string>,
  issues: string[],
): void {
  const options = (entry.equipment as JsonRecord | undefined)?.options;
  if (!Array.isArray(options)) return;
  for (const [optionIndex, option] of (options as JsonRecord[]).entries()) {
    if (!Array.isArray(option.entries)) continue;
    for (const [entryIndex, raw] of (option.entries as JsonRecord[]).entries()) {
      if (raw.kind !== "item" || typeof raw.sourceLabel !== "string" || !raw.itemId) continue;
      const catalog = itemNamesById.get(String(raw.itemId));
      if (catalog && catalog.trim().toLowerCase() === raw.sourceLabel.trim().toLowerCase()) {
        issues.push(`${owner}.equipment.options.${optionIndex}.entries.${entryIndex}.sourceLabel duplicates the catalog name of ${String(raw.itemId)} — omit it; the API supplies the name at read time`);
      }
    }
  }
}

/** Feat identity and choices are persisted facts. Broken links must not survive an import. */
function checkFeatIdentityAndChoices(entry: JsonRecord, owner: string, featIds: Set<string>, issues: string[]): void {
  if (typeof entry.prerequisite === "string") {
    issues.push(`${owner}.prerequisite uses legacy prose; native Feat prerequisites must be typed facts`);
  }
  const prerequisite = entry.prerequisite && typeof entry.prerequisite === "object" && !Array.isArray(entry.prerequisite)
    ? entry.prerequisite as JsonRecord
    : {};
  const prerequisiteFeatIds = [
    prerequisite.feat,
    ...(Array.isArray(prerequisite.anyOfFeats) ? prerequisite.anyOfFeats : []),
    ...(Array.isArray(prerequisite.noneOfFeats) ? prerequisite.noneOfFeats : []),
    ...(Array.isArray(prerequisite.any)
      ? (prerequisite.any as JsonRecord[]).map((alternative) => alternative.feat)
      : []),
  ].filter((value) => value != null && String(value).trim() !== "").map(String);
  const ruleset = String(entry.ruleset);
  for (const featId of prerequisiteFeatIds) {
    if (!featIds.has(`${ruleset}:${featId}`)) issues.push(`${owner}.prerequisite references unknown feat id ${JSON.stringify(featId)}`);
  }
  if (entry.category !== undefined && !FEAT_CATEGORIES.has(String(entry.category))) {
    issues.push(`${owner}.category must be omitted for General or one of ${[...FEAT_CATEGORIES].join(", ")}`);
  }
  const mechanics = entry.mechanics && typeof entry.mechanics === "object" && !Array.isArray(entry.mechanics)
    ? entry.mechanics as JsonRecord
    : {};
  const choices = Array.isArray(mechanics.choices) ? mechanics.choices as JsonRecord[] : [];
  const ids = new Set<string>();
  for (const [index, choice] of choices.entries()) {
    const id = String(choice.id ?? "").trim();
    if (ids.has(id)) issues.push(`${owner}.mechanics.choices.${index}.id duplicates ${JSON.stringify(id)}`);
    ids.add(id);
  }
  for (const [index, choice] of choices.entries()) {
    for (const field of ["linkedTo", "dependsOnChoiceId"] as const) {
      const reference = String(choice[field] ?? "").trim();
      if (reference && !ids.has(reference)) {
        issues.push(`${owner}.mechanics.choices.${index}.${field} references unknown choice ${JSON.stringify(reference)}`);
      }
    }
    const replacement = String(choice.replacementFor ?? "").trim();
    if (replacement && replacement !== "known_cantrip" && !ids.has(replacement)) {
      issues.push(`${owner}.mechanics.choices.${index}.replacementFor references unknown choice or replacement target ${JSON.stringify(replacement)}`);
    }
  }
  const abilityChoice = String(mechanics.spellcastingAbilityFromChoiceId ?? "").trim();
  if (abilityChoice && !ids.has(abilityChoice)) {
    issues.push(`${owner}.mechanics.spellcastingAbilityFromChoiceId references unknown choice ${JSON.stringify(abilityChoice)}`);
  }
}

/**
 * `automatic` means the record completely describes its own mechanics — no missing schema coverage.
 * Scoped to classes/species/feats/backgrounds; items/spells/monsters have their own completeness rules.
 */
function checkAutomaticResolutionIsComplete(
  entry: JsonRecord,
  category: NativeCompendiumCategory,
  owner: string,
  issues: string[],
): void {
  const hasNonEmptyArray = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

  const checkTrait = (trait: JsonRecord, path: string): void => {
    if (trait.resolution !== "automatic") return;
    const hasMechanics = hasNonEmptyArray(trait.effects) || hasNonEmptyArray(trait.scalingRolls) || hasNonEmptyArray(trait.preparedSpellProgression);
    if (!hasMechanics) issues.push(`${owner}.${path} is marked automatic but has no effects, scalingRolls, or preparedSpellProgression`);
  };

  const checkFeatMechanics = (feat: JsonRecord, path: string): void => {
    if (feat.resolution !== "automatic") return;
    const mechanics = (feat.mechanics && typeof feat.mechanics === "object" ? feat.mechanics as JsonRecord : {});
    const grants = (mechanics.grants && typeof mechanics.grants === "object" ? mechanics.grants as JsonRecord : {});
    const hasMechanics = [
      grants.effects, grants.bonuses, grants.spells, grants.cantrips, grants.skills, grants.tools,
      grants.languages, grants.armor, grants.weapons, grants.savingThrows, mechanics.uses, mechanics.preparedSpellProgression,
      mechanics.choices,
    ].some(hasNonEmptyArray) || (grants.abilityIncreases && typeof grants.abilityIncreases === "object" && Object.keys(grants.abilityIncreases).length > 0);
    if (!hasMechanics) issues.push(`${owner}.${path} is marked automatic but grants no structured mechanics`);
  };

  if (category === "species" && Array.isArray(entry.traits)) {
    (entry.traits as JsonRecord[]).forEach((trait, index) => checkTrait(trait, `traits.${index}`));
  }
  if (category === "backgrounds" && Array.isArray(entry.traits)) {
    (entry.traits as JsonRecord[]).forEach((trait, index) => checkTrait(trait, `traits.${index}`));
  }
  if (category === "classes" && Array.isArray(entry.levels)) {
    for (const [levelIndex, level] of (entry.levels as JsonRecord[]).entries()) {
      if (!Array.isArray(level.features)) continue;
      for (const [featureIndex, feature] of (level.features as JsonRecord[]).entries()) {
        checkTrait(feature as JsonRecord, `levels.${levelIndex}.features.${featureIndex}`);
      }
    }
  }
  if (category === "feats") {
    checkFeatMechanics(entry, "");
  }
}

/**
 * Species-only: catches two failure modes the generic walk above doesn't.
 * 1. Duplicate fact homes — the legacy top-level `vision`/`resistances` fields
 *    restating a fact a trait's `senses`/`defense` effect already grants (one fact, one home).
 * 2. Broken references — a `defense` effect's `targets` naming a condition/damage type
 *    that doesn't exist, which would silently no-op for any consumer matching on it.
 */
function checkSpeciesFactHomesAndReferences(entry: JsonRecord, owner: string, issues: string[]): void {
  const traits = Array.isArray(entry.traits) ? entry.traits as JsonRecord[] : [];
  const traitEffects = traits.flatMap((trait) => Array.isArray(trait.effects) ? trait.effects as JsonRecord[] : []);

  if (Array.isArray(entry.vision) && entry.vision.length > 0) {
    const grantedKinds = new Set(
      traitEffects.filter((e) => e.type === "senses").flatMap((e) => Array.isArray(e.senses) ? (e.senses as JsonRecord[]).map((s) => s.kind) : []),
    );
    for (const vision of entry.vision as JsonRecord[]) {
      if (grantedKinds.has(vision.type)) issues.push(`${owner}.vision duplicates a "${String(vision.type)}" senses effect already granted by a trait — remove the top-level field`);
    }
  }
  if (Array.isArray(entry.resistances) && entry.resistances.length > 0) {
    const grantedTargets = new Set(
      traitEffects.filter((e) => e.type === "defense" && e.mode === "damage_resistance").flatMap((e) => Array.isArray(e.targets) ? e.targets as string[] : []),
    );
    for (const resistance of entry.resistances as string[]) {
      if (grantedTargets.has(resistance)) issues.push(`${owner}.resistances duplicates a "${resistance}" damage_resistance effect already granted by a trait — remove the top-level field`);
    }
  }

  for (const [traitIndex, trait] of traits.entries()) {
    const effects = Array.isArray(trait.effects) ? trait.effects as JsonRecord[] : [];
    for (const [effectIndex, effect] of effects.entries()) {
      if (effect.type !== "defense" || !Array.isArray(effect.targets)) continue;
      const mode = String(effect.mode ?? "");
      const isCondition = mode === "condition_advantage" || mode === "condition_immunity" || mode === "escape_check_advantage" || mode === "save_advantage" || mode === "save_disadvantage";
      const isDamage = mode === "damage_resistance" || mode === "damage_immunity";
      for (const [targetIndex, target] of (effect.targets as unknown[]).entries()) {
        const value = String(target);
        if (isCondition && !CONDITION_NAMES.has(value)) issues.push(`${owner}.traits.${traitIndex}.effects.${effectIndex}.targets.${targetIndex} references unknown condition ${JSON.stringify(value)}`);
        if (isDamage && !DAMAGE_TYPES.has(value)) issues.push(`${owner}.traits.${traitIndex}.effects.${effectIndex}.targets.${targetIndex} references unknown damage type ${JSON.stringify(value)}`);
      }
    }
  }
}
