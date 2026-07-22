import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error("Usage: node scripts/enrich-wotc-5e-cornerstones.mjs <input.json> <output.json>");
const document = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
const byName = new Map((document.classes ?? []).map((entry) => [entry.name, entry]));

function feature(className, exactName) {
  const matches = (byName.get(className)?.levels ?? []).flatMap((level) => level.features ?? []).filter((entry) => entry.name === exactName);
  if (matches.length !== 1) throw new Error(`${className}: expected exactly one ${exactName} feature, found ${matches.length}.`);
  return matches[0];
}

const rage = feature("Barbarian", "Rage");
rage.effects = [
  { type: "defense", mode: "damage_resistance", targets: ["Bludgeoning", "Piercing", "Slashing"], gate: { duration: "while_raging" } },
  { type: "attack", mode: "bonus_damage", amount: { kind: "named_progression", key: "barbarian_rage_damage" }, gate: { duration: "while_raging", attackAbility: "str" } },
  { type: "modifier", target: "ability_check", mode: "advantage", appliesTo: ["Strength"], gate: { duration: "while_raging" } },
  { type: "modifier", target: "saving_throw", mode: "advantage", appliesTo: ["Strength"], gate: { duration: "while_raging" } },
  { type: "narrative", category: "manual_resolution", description: "Rage prevents spellcasting and Concentration and uses its authored duration rules." },
];
rage.resolution = "mixed";
rage.resolutionNotes = ["Resistance, Strength advantage, and Rage damage are automatic while the Rage condition is active; duration and spellcasting restrictions remain table-managed."];

const sneakAttack = feature("Rogue", "Sneak Attack");
sneakAttack.scalingRolls = Array.from({ length: 10 }, (_, index) => ({
  level: index * 2 + 1,
  formula: `${index + 1}d6`,
  description: "Sneak Attack damage",
}));
sneakAttack.resolution = "mixed";
sneakAttack.resolutionNotes = ["The scaling damage roll is displayed; attack eligibility and once-per-turn use remain table-managed."];

const secondWind = feature("Fighter", "Second Wind");
secondWind.scalingRolls = Array.from({ length: 20 }, (_, index) => ({
  level: index + 1,
  formula: `1d10+${index + 1}`,
  description: "Hit points regained",
}));
secondWind.resolution = "mixed";
secondWind.resolutionNotes = ["The healing roll scales with Fighter level; spending the tracked use and applying healing remain player-controlled."];

for (const [className, abilities, shieldAllowed] of [
  ["Barbarian", ["dex", "con"], true],
  ["Monk", ["dex", "wis"], false],
]) {
  const unarmoredDefense = feature(className, "Unarmored Defense");
  unarmoredDefense.effects = [{
    type: "armor_class",
    mode: "base_formula",
    base: 10,
    abilities,
    gate: { armorState: "no_armor", shieldAllowed },
  }];
  unarmoredDefense.resolution = "automatic";
  unarmoredDefense.resolutionNotes = ["Only the first Unarmored Defense feature acquired from any class applies."];
}

for (const [className, name, note] of [
  ["Druid", "Wild Shape", "Uses and rest recovery are tracked; selecting and adjudicating beast forms remains manual."],
  ["Monk", "Ki", "Ki points and rest recovery are tracked; individual Ki techniques remain player-controlled."],
  ["Fighter", "Action Surge", "Uses and rest recovery are tracked; the additional action is resolved at the table."],
  ["Paladin", "Lay on Hands", "The healing pool is tracked; healing and condition removal are applied by the player."],
  ["Sorcerer", "Font of Magic", "Sorcery Points are tracked; conversion between points and spell slots remains player-controlled."],
  ["Warlock", "Pact Magic", "Pact slots, slot level, and Short Rest recovery are automatic; spell selection is handled by class progression."],
]) {
  const entry = feature(className, name);
  entry.resolutionNotes = [note];
}

fs.writeFileSync(path.resolve(output), `${JSON.stringify(document, null, 2)}\n`);
console.log(`Enriched cornerstone mechanics into ${output}.`);
