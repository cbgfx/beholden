import fs from "node:fs";
import path from "node:path";

type JsonRecord = Record<string, unknown>;
type Level = { level: number; spellSlots?: Record<string, number>; abilityScoreImprovement?: true; features?: Array<{ id: string; name: string }> };
type ClassEntry = JsonRecord & { id: string; name: string; hitDie: number; levels: Level[]; spellcasting?: { ability?: string; slotRecovery?: string }; proficiencies?: { skills?: { choose?: number }; tools?: { choices?: Array<{ count?: number }> } } };

const defaultCompendium = path.resolve("../compendium/WotC_2024_only.json");
const optionIndex = process.argv.indexOf("--compendium");
const compendiumPath = path.resolve(optionIndex >= 0 ? process.argv[optionIndex + 1] ?? "" : defaultCompendium);
const document = JSON.parse(fs.readFileSync(compendiumPath, "utf8")) as { classes?: ClassEntry[] };
const classes = document.classes ?? [];
const issues: string[] = [];

const expectedHitDice: Record<string, number> = {
  Artificer: 8, Barbarian: 12, Bard: 8, Cleric: 8, Druid: 8, Fighter: 10, Monk: 8,
  Paladin: 10, Ranger: 10, Rogue: 8, Sorcerer: 6, Warlock: 8, Wizard: 6,
};
const expectedAsi: Record<string, number[]> = Object.fromEntries(Object.keys(expectedHitDice).map((name) => [name, [4, 8, 12, 16]]));
expectedAsi.Fighter = [4, 6, 8, 12, 14, 16];
expectedAsi.Rogue = [4, 8, 10, 12, 16];
const expectedSkillChoices: Record<string, number> = {
  Artificer: 2, Barbarian: 2, Bard: 3, Cleric: 2, Druid: 2, Fighter: 2, Monk: 2,
  Paladin: 2, Ranger: 3, Rogue: 4, Sorcerer: 2, Warlock: 2, Wizard: 2,
};
const expectedToolChoices: Record<string, number> = { Artificer: 1, Bard: 3, Monk: 1 };

const fullCasterSlots: Array<Record<string, number>> = [
  { 1: 2 }, { 1: 3 }, { 1: 4, 2: 2 }, { 1: 4, 2: 3 }, { 1: 4, 2: 3, 3: 2 },
  { 1: 4, 2: 3, 3: 3 }, { 1: 4, 2: 3, 3: 3, 4: 1 }, { 1: 4, 2: 3, 3: 3, 4: 2 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 }, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 }, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
];
const halfCasterSlots: Array<Record<string, number>> = [
  { 1: 2 }, { 1: 2 }, { 1: 3 }, { 1: 3 }, { 1: 4, 2: 2 }, { 1: 4, 2: 2 },
  { 1: 4, 2: 3 }, { 1: 4, 2: 3 }, { 1: 4, 2: 3, 3: 2 }, { 1: 4, 2: 3, 3: 2 },
  { 1: 4, 2: 3, 3: 3 }, { 1: 4, 2: 3, 3: 3 }, { 1: 4, 2: 3, 3: 3, 4: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 1 }, { 1: 4, 2: 3, 3: 3, 4: 2 }, { 1: 4, 2: 3, 3: 3, 4: 2 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
];
const warlockSlots = Array.from({ length: 20 }, (_, index) => {
  const level = index + 1;
  const slotLevel = Math.min(5, Math.ceil(level / 2));
  const count = level === 1 ? 1 : level < 11 ? 2 : level < 17 ? 3 : 4;
  return Object.fromEntries(Array.from({ length: slotLevel }, (_, slotIndex) => [String(slotIndex + 1), slotIndex + 1 === slotLevel ? count : 0]));
});

function stable(value: unknown): string { return JSON.stringify(value ?? {}); }

for (const cls of classes) {
  const expectedLevels = Array.from({ length: 20 }, (_, index) => index + 1);
  if (stable(cls.levels.map(({ level }) => level)) !== stable(expectedLevels)) issues.push(`${cls.name}: levels must be exactly 1-20`);
  if (cls.hitDie !== expectedHitDice[cls.name]) issues.push(`${cls.name}: expected d${expectedHitDice[cls.name]}, found d${cls.hitDie}`);
  const skillChoices = cls.proficiencies?.skills?.choose ?? 0;
  if (skillChoices !== expectedSkillChoices[cls.name]) issues.push(`${cls.name}: expected ${expectedSkillChoices[cls.name]} starting skill choices, found ${skillChoices}`);
  const toolChoices = cls.proficiencies?.tools?.choices?.reduce((sum, choice) => sum + (choice.count ?? 0), 0) ?? 0;
  if (toolChoices !== (expectedToolChoices[cls.name] ?? 0)) issues.push(`${cls.name}: expected ${expectedToolChoices[cls.name] ?? 0} starting tool choices, found ${toolChoices}`);
  const asi = cls.levels.filter((level) => level.abilityScoreImprovement).map((level) => level.level);
  if (stable(asi) !== stable(expectedAsi[cls.name])) issues.push(`${cls.name}: ASI levels ${asi.join(",")} do not match ${expectedAsi[cls.name]?.join(",")}`);
  const featureIds = cls.levels.flatMap((level) => (level.features ?? []).map((feature) => feature.id));
  const duplicateIds = [...new Set(featureIds.filter((id, index) => featureIds.indexOf(id) !== index))];
  if (duplicateIds.length) issues.push(`${cls.name}: duplicate feature IDs ${duplicateIds.join(", ")}`);
  for (const level of cls.levels) for (const feature of level.features ?? []) {
    const namedLevel = feature.name.match(/\bLevel\s+(\d+)\s*:/i)?.[1];
    if (namedLevel && Number(namedLevel) !== level.level) issues.push(`${cls.name}: ${feature.name} is owned by level ${level.level}`);
  }
  const expectedSlots = ["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"].includes(cls.name) ? fullCasterSlots
    : ["Artificer", "Paladin", "Ranger"].includes(cls.name) ? halfCasterSlots : null;
  if (expectedSlots) for (let index = 0; index < 20; index += 1) {
    if (stable(cls.levels[index]?.spellSlots) !== stable(expectedSlots[index])) issues.push(`${cls.name} level ${index + 1}: invalid spell-slot progression`);
  }
  if (cls.name === "Warlock") for (let index = 0; index < 20; index += 1) {
    if (stable(cls.levels[index]?.spellSlots) !== stable(warlockSlots[index])) issues.push(`Warlock level ${index + 1}: invalid Pact Magic slot progression`);
  }
  if (!["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"].includes(cls.name)
    && cls.levels.some((level) => level.spellSlots && Object.values(level.spellSlots).some((count) => count > 0))) {
    issues.push(`${cls.name}: base class unexpectedly grants spell slots`);
  }
}

console.log(JSON.stringify({ compendiumPath, classes: classes.length, levels: classes.reduce((sum, cls) => sum + cls.levels.length, 0), issues }, null, 2));
if (issues.length) process.exitCode = 1;
