import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/validate-wotc-5e-cornerstones.mjs <compendium.json>");
const document = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
const classes = new Map((document.classes ?? []).map((entry) => [entry.name, entry]));
const find = (className, featureName) => classes.get(className)?.levels.flatMap((level) => level.features ?? []).find((entry) => entry.name === featureName);
const requireFact = (condition, message) => { if (!condition) throw new Error(message); };

const rage = find("Barbarian", "Rage");
requireFact(rage?.resolution === "mixed" && rage.effects?.some((effect) => effect.type === "attack"), "Rage: missing structured damage.");
requireFact(rage.effects?.some((effect) => effect.type === "defense"), "Rage: missing structured resistance.");
const sneak = find("Rogue", "Sneak Attack");
requireFact(sneak?.scalingRolls?.length === 10 && sneak.scalingRolls.at(-1)?.formula === "10d6", "Sneak Attack: incomplete scaling.");
const wind = find("Fighter", "Second Wind");
requireFact(wind?.scalingRolls?.length === 20 && wind.scalingRolls.at(-1)?.formula === "1d10+20", "Second Wind: incomplete scaling.");
for (const [className, abilities, shieldAllowed] of [["Barbarian", ["dex", "con"], true], ["Monk", ["dex", "wis"], false]]) {
  const unarmored = find(className, "Unarmored Defense");
  const effect = unarmored?.effects?.find((entry) => entry.type === "armor_class" && entry.mode === "base_formula");
  requireFact(effect?.base === 10 && JSON.stringify(effect.abilities) === JSON.stringify(abilities), `${className}: invalid Unarmored Defense formula.`);
  requireFact(effect?.gate?.shieldAllowed === shieldAllowed, `${className}: invalid Unarmored Defense shield rule.`);
}
for (const [className, resourceName] of [["Druid", "Wild Shape"], ["Monk", "Ki"], ["Fighter", "Action Surge"], ["Paladin", "Lay on Hands"], ["Sorcerer", "Sorcery Points"]]) {
  requireFact(classes.get(className)?.levels.some((level) => level.resources?.some((resource) => resource.name === resourceName)), `${className}: missing ${resourceName} resource progression.`);
}
requireFact(classes.get("Warlock")?.multiclass?.spellcasting?.progression === "pact", "Warlock: Pact Magic is not separated from shared spellcasting.");
console.log("5e cornerstone validation passed.");
