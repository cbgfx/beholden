import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/validate-wotc-5e-base-classes.mjs <compendium.json>");
const document = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
const classes = document.classes ?? [];

const byName = new Map(classes.map((entry) => [entry.name, entry]));
const fail = (message) => { throw new Error(message); };
const requireFact = (condition, message) => { if (!condition) fail(message); };

const cantripVersatility = classes.flatMap((cls) => (cls.levels ?? []).flatMap((level) =>
  (level.features ?? [])
    .filter((feature) => ["Bardic Versatility", "Cantrip Versatility", "Sorcerous Versatility", "Eldritch Versatility"].includes(feature.name))
    .map((feature) => ({ cls, feature })),
));
requireFact(cantripVersatility.length === 25, `Expected 25 cantrip-versatility features, found ${cantripVersatility.length}.`);
for (const { cls, feature } of cantripVersatility) {
  const choice = feature.choices?.find((entry) => entry.kind === "spell" && entry.level === 0 && entry.replace === true);
  requireFact(choice?.lists?.includes(`sl_${cls.name.toLowerCase()}`), `${cls.name}: ${feature.name} is missing its typed class-cantrip replacement.`);
}

const fighterMartialVersatility = classes.find((entry) => entry.name === "Fighter")?.levels
  .flatMap((level) => (level.features ?? []).filter((feature) => feature.name === "Martial Versatility")) ?? [];
requireFact(fighterMartialVersatility.length === 7, `Fighter: expected 7 Martial Versatility features, found ${fighterMartialVersatility.length}.`);
for (const feature of fighterMartialVersatility) {
  requireFact(feature.choices?.some((choice) => choice.kind === "replacement" && choice.target === "maneuver" && choice.count === 1), "Fighter: Martial Versatility is missing its typed maneuver replacement.");
  requireFact(feature.choices?.some((choice) => choice.kind === "replacement" && choice.target === "fighting_style" && choice.count === 1), "Fighter: Martial Versatility is missing its typed Fighting Style replacement.");
  requireFact(feature.resolution === "automatic", "Fighter: Martial Versatility should be automatic now that both its maneuver and Fighting Style branches are structured.");
}

for (const className of ["Paladin", "Ranger"]) {
  const martialVersatility = byName.get(className)?.levels
    .flatMap((level) => (level.features ?? []).filter((feature) => feature.name === "Martial Versatility")) ?? [];
  requireFact(martialVersatility.length === 5, `${className}: expected 5 Martial Versatility features, found ${martialVersatility.length}.`);
  for (const feature of martialVersatility) {
    requireFact(feature.choices?.some((choice) => choice.kind === "replacement" && choice.target === "fighting_style" && choice.count === 1), `${className}: Martial Versatility is missing its typed Fighting Style replacement.`);
    requireFact(feature.resolution === "automatic", `${className}: Martial Versatility should be automatic now that its Fighting Style branch is structured.`);
  }
}

const mysticArcanumSpellLevelByFeatureLevel = { 11: 6, 13: 7, 15: 8, 17: 9 };
const warlockMysticArcanum = byName.get("Warlock")?.levels
  .flatMap((level) => (level.features ?? []).filter((feature) => /^Mystic Arcanum \(/.test(feature.name)).map((feature) => ({ level: level.level, feature }))) ?? [];
requireFact(warlockMysticArcanum.length === 4, `Warlock: expected 4 Mystic Arcanum features, found ${warlockMysticArcanum.length}.`);
for (const { level, feature } of warlockMysticArcanum) {
  const expectedSpellLevel = mysticArcanumSpellLevelByFeatureLevel[level];
  const choice = feature.choices?.find((entry) => entry.kind === "spell" && entry.level === expectedSpellLevel && entry.replace === true && entry.freeCast === true);
  requireFact(choice?.lists?.includes("sl_warlock"), `Warlock: Mystic Arcanum at level ${level} is missing its typed level-${expectedSpellLevel} spell choice.`);
  requireFact(feature.resolution === "mixed", `Warlock: Mystic Arcanum at level ${level} should be mixed until ongoing replacement is structured.`);
}

const warlockEldritchVersatility = byName.get("Warlock")?.levels
  .flatMap((level) => (level.features ?? []).filter((feature) => feature.name === "Eldritch Versatility").map((feature) => ({ level: level.level, feature }))) ?? [];
requireFact(warlockEldritchVersatility.length === 5, `Warlock: expected 5 Eldritch Versatility features, found ${warlockEldritchVersatility.length}.`);
for (const { level, feature } of warlockEldritchVersatility) {
  requireFact(feature.choices?.some((choice) => choice.kind === "replacement" && choice.target === "pact_boon" && choice.count === 1), "Warlock: Eldritch Versatility is missing its typed Pact Boon replacement.");
  const expectedResolution = level < 12 ? "automatic" : "mixed";
  requireFact(feature.resolution === expectedResolution, `Warlock: Eldritch Versatility at level ${level} should be ${expectedResolution}.`);
}

const bardBardicVersatility = byName.get("Bard")?.levels
  .flatMap((level) => (level.features ?? []).filter((feature) => feature.name === "Bardic Versatility")) ?? [];
requireFact(bardBardicVersatility.length === 5, `Bard: expected 5 Bardic Versatility features, found ${bardBardicVersatility.length}.`);
for (const feature of bardBardicVersatility) {
  requireFact(feature.choices?.some((choice) => choice.kind === "expertise" && choice.replace === true), "Bard: Bardic Versatility is missing its typed Expertise replacement.");
  requireFact(feature.resolution === "automatic", "Bard: Bardic Versatility should be automatic now that both its cantrip and Expertise branches are structured.");
}

const sorcererMetamagic = byName.get("Sorcerer")?.levels
  .flatMap((level) => (level.features ?? []).filter((feature) => feature.id === "cf_sorcerer_3_metamagic")) ?? [];
requireFact(sorcererMetamagic.length === 1 && sorcererMetamagic[0].talent?.replace === true, "Sorcerer: base Metamagic feature is missing its typed replace fact.");

const sorcererSorcerousVersatility = byName.get("Sorcerer")?.levels
  .flatMap((level) => (level.features ?? []).filter((feature) => feature.name === "Sorcerous Versatility")) ?? [];
requireFact(sorcererSorcerousVersatility.length === 5, `Sorcerer: expected 5 Sorcerous Versatility features, found ${sorcererSorcerousVersatility.length}.`);
for (const feature of sorcererSorcerousVersatility) {
  requireFact(feature.choices?.some((choice) => choice.kind === "replacement" && choice.target === "metamagic" && choice.count === 1), "Sorcerer: Sorcerous Versatility is missing its typed metamagic replacement.");
  requireFact(feature.resolution === "automatic", "Sorcerer: Sorcerous Versatility should be automatic now that both its cantrip and Metamagic branches are structured.");
}

requireFact(classes.length === 13, `Expected 13 classes, found ${classes.length}.`);
for (const cls of classes) {
  requireFact(cls.primaryAbility, `${cls.name}: missing primaryAbility.`);
  requireFact(cls.multiclass?.requirements, `${cls.name}: missing multiclass requirements.`);
}

for (const name of ["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard", "Artificer"]) {
  const cls = byName.get(name);
  requireFact(cls?.spellcasting?.list === `sl_${name.toLowerCase()}`, `${name}: missing canonical spell-list access.`);
  requireFact(cls.levels.some((level) => level.spellSlots), `${name}: missing spell-slot progression.`);
  requireFact(cls.levels.every((level) => level.level === 1 || level.spellSlots || name === "Paladin" || name === "Ranger"), `${name}: incomplete spell-slot progression.`);
}

for (const name of ["Barbarian", "Fighter", "Monk", "Rogue"]) {
  const cls = byName.get(name);
  requireFact(!cls?.spellcasting, `${name}: base class must not have spellcasting.`);
  requireFact(cls.levels.every((level) => !level.spellSlots), `${name}: base class must not have spell slots.`);
}

for (const [className, expectedCount] of [["Fighter", 11], ["Paladin", 7], ["Ranger", 7]]) {
  const cls = byName.get(className);
  const choice = cls?.choices?.find((entry) => entry.id === `cc_${className.toLowerCase()}_fighting_style`);
  requireFact(choice?.options?.length === expectedCount, `${className}: incomplete Fighting Style choice group.`);
  for (const option of choice.options) {
    requireFact(option.features.length === 1, `${className}: Fighting Style ${option.name} must resolve to one feature.`);
    requireFact(cls.levels.flatMap((level) => level.features ?? []).some((feature) => feature.id === option.features[0]), `${className}: Fighting Style ${option.name} references a missing feature.`);
  }
}
for (const [className, styleName] of [["Fighter", "Archery"], ["Paladin", "Defense"], ["Ranger", "Two-Weapon Fighting"]]) {
  const feature = byName.get(className)?.levels.flatMap((level) => level.features ?? []).find((entry) => entry.name === `Fighting Style: ${styleName}` && !entry.subclass);
  requireFact(feature?.resolution === "automatic" && feature.effects?.length > 0, `${className}: ${styleName} is not structured.`);
}

const wizard = byName.get("Wizard");
requireFact(wizard.levels.every((level) => (level.features ?? []).some((feature) => feature.choices?.some((choice) => choice.mode === "spellbook"))), "Wizard: missing per-level spellbook acquisition.");

const warlockPactBoon = classes.find((entry) => entry.name === "Warlock")?.choices?.find((entry) => entry.id === "cc_warlock_pact_boon");
requireFact(warlockPactBoon?.options?.length === 4, "Warlock: Pact Boon must expose four mutually exclusive options.");

const rangerChoices = classes.find((entry) => entry.name === "Ranger")?.choices ?? [];
for (const id of [
  "cc_ranger_favored_enemy",
  "cc_ranger_natural_explorer",
  "cc_ranger_primeval_awareness",
  "cc_ranger_hide_in_plain_sight",
]) {
  requireFact(rangerChoices.find((entry) => entry.id === id)?.options?.length === 2, `Ranger: missing optional-feature replacement choice ${id}.`);
}
const barbarianPrimalKnowledge = byName.get("Barbarian")?.levels.flatMap((level) => level.features ?? []).filter((feature) => feature.name === "Primal Knowledge");
requireFact(barbarianPrimalKnowledge?.length === 2 && barbarianPrimalKnowledge.every((feature) => feature.choices?.some((choice) => choice.kind === "proficiency" && choice.category === "skill")), "Barbarian: Primal Knowledge skill choices are incomplete.");

const rangerFeatures = byName.get("Ranger")?.levels.flatMap((level) => level.features ?? []) ?? [];
const canny = rangerFeatures.find((feature) => feature.name === "Deft Explorer: Canny");
requireFact(canny?.choices?.some((choice) => choice.kind === "expertise") && canny.choices.some((choice) => choice.kind === "proficiency" && choice.category === "language" && choice.count === 2), "Ranger: Deft Explorer (Canny) choices are incomplete.");
for (const name of ["Favored Enemy", "Favored Enemy Improvement (1)", "Favored Enemy Improvement (2)"]) {
  requireFact(rangerFeatures.find((feature) => feature.name === name)?.choices?.some((choice) => choice.kind === "proficiency" && choice.category === "language"), `Ranger: ${name} is missing its language choice.`);
  requireFact(rangerFeatures.find((feature) => feature.name === name)?.choices?.some((choice) => choice.kind === "selection" && choice.options?.length === 14), `Ranger: ${name} is missing its favored-enemy selection.`);
}
for (const name of ["Natural Explorer", "Natural Explorer Improvement (1)", "Natural Explorer Improvement (2)"]) {
  requireFact(rangerFeatures.find((feature) => feature.name === name)?.choices?.some((choice) => choice.kind === "selection" && choice.options?.length === 8), `Ranger: ${name} is missing its favored-terrain selection.`);
}
const primalAwareness = rangerFeatures.find((feature) => feature.name === "Primal Awareness");
requireFact(primalAwareness?.effects?.filter((effect) => effect.type === "spell_grant").length === 5, "Ranger: Primal Awareness must grant five scaling spells.");
requireFact(primalAwareness?.effects?.filter((effect) => effect.type === "resource_grant").length === 5, "Ranger: Primal Awareness must track one free cast per spell.");
requireFact(byName.get("Warlock")?.multiclass?.spellcasting?.progression === "pact", "Warlock: missing Pact Magic contribution.");
requireFact(byName.get("Paladin")?.spellcasting?.preparedFormula?.classLevelDivisor === 2, "Paladin: incorrect prepared-spell formula.");
requireFact(byName.get("Cleric")?.spellcasting?.preparedFormula?.classLevelDivisor === 1, "Cleric: incorrect prepared-spell formula.");

for (const className of ["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard", "Artificer"]) {
  const spellcastingName = className === "Warlock" ? "Pact Magic" : "Spellcasting";
  const spellcastingFeature = byName.get(className)?.levels.flatMap((level) => level.features ?? [])
    .find((feature) => feature.name === spellcastingName && !feature.subclass);
  requireFact(spellcastingFeature?.resolution === "automatic", `${className}: ${spellcastingName} must reflect its structured progression.`);
}
for (const className of ["Fighter", "Paladin", "Ranger"]) {
  const fightingStyle = byName.get(className)?.levels.flatMap((level) => level.features ?? [])
    .find((feature) => feature.name === "Fighting Style" && !feature.subclass);
  requireFact(fightingStyle?.resolution === "automatic", `${className}: Fighting Style selection must be automatic.`);
}
for (const [className, featureName] of [["Bard", "Expertise"], ["Rogue", "Expertise"], ["Sorcerer", "Metamagic"], ["Warlock", "Eldritch Invocations"]]) {
  const structuredFeature = byName.get(className)?.levels.flatMap((level) => level.features ?? [])
    .find((feature) => feature.name === featureName && !feature.subclass);
  requireFact(structuredFeature?.resolution === "automatic", `${className}: ${featureName} must reflect its structured choices.`);
}

console.log("5e base-class enrichment validation passed.");
