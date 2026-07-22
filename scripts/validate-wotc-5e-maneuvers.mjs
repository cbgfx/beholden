import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/validate-wotc-5e-maneuvers.mjs <compendium.json>");
const document = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
const requireFact = (condition, message) => { if (!condition) throw new Error(message); };
const maneuvers = (document.classTalents ?? []).filter((entry) => entry.ruleset === "5e" && entry.kind === "maneuver");
requireFact(maneuvers.length === 23, `Expected 23 authentic 5e maneuvers, found ${maneuvers.length}.`);
requireFact(new Set(maneuvers.map((entry) => entry.id)).size === 23, "5e maneuver IDs are not unique.");
requireFact(maneuvers.every((entry) => entry.id.startsWith("ct_maneuver_") && entry.description?.length), "A maneuver is missing canonical identity or description.");
requireFact(maneuvers.some((entry) => entry.name === "Trip Attack" && /Player's Handbook \(2014\)/u.test(entry.source)), "PHB maneuver catalog is incomplete.");
requireFact(maneuvers.some((entry) => entry.name === "Quick Toss" && /Tasha's Cauldron/u.test(entry.source)), "Tasha maneuver catalog is incomplete.");

const fighter = (document.classes ?? []).find((entry) => entry.id === "c_fighter" && entry.ruleset === "5e");
const feature = fighter?.levels.flatMap((row) => row.features ?? []).find((entry) => entry.id === "cf_fighter_3_combat_superiority_battle_master");
requireFact(JSON.stringify(feature?.talent?.known) === JSON.stringify({ "3": 3, "7": 5, "10": 7, "15": 9 }), "Battle Master maneuver progression is incorrect.");
requireFact(JSON.stringify(feature?.talent?.ability) === JSON.stringify(["str", "dex"]), "Battle Master save-ability choice is missing.");
for (const [level, uses] of [[3, 4], [7, 5], [15, 6]]) {
  const resource = fighter?.levels.find((entry) => entry.level === level)?.resources?.find((entry) => entry.name === "Superiority Dice" && entry.subclass === "sc_fighter_battle_master");
  requireFact(resource?.uses === uses && resource?.recovery === "short_rest", `Battle Master level ${level} superiority pool is incorrect.`);
}
const martialAdept = (document.feats ?? []).find((entry) => entry.id === "f_martial_adept" && entry.ruleset === "5e");
const maneuverChoice = martialAdept?.mechanics?.choices?.find((entry) => entry.id === "maneuvers");
requireFact(maneuverChoice?.count === 2 && maneuverChoice?.options?.length === 23 && maneuverChoice?.anyOf?.[0] === "maneuver", "Martial Adept maneuver acquisition is incomplete.");
requireFact(martialAdept?.mechanics?.uses?.[0]?.count === 1 && martialAdept?.mechanics?.uses?.[0]?.recharge === "short_or_long_rest", "Martial Adept superiority die is not tracked.");
console.log("5e maneuver catalog and Battle Master validation passed.");
