import fs from "node:fs";
import path from "node:path";
import { canonicalizeCompendiumId } from "../lib/canonicalCompendiumId.js";

type JsonRecord = Record<string, unknown>;
const defaultCompendium = path.resolve("../compendium/WotC_2024_only.json");
const defaults = [
  path.resolve("../compendium/Live-data-export/drokkan-skarvulf-2026-07-14.beholden-character.json"),
  path.resolve("../compendium/Live-data-export/alarion-veilborne-2026-07-14.beholden-character.json"),
];
function option(name: string): string | null { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] ?? null : null; }
const compendiumInput = path.resolve(option("--compendium") ?? defaultCompendium);
const compendiumPaths = fs.statSync(compendiumInput).isDirectory()
  ? fs.readdirSync(compendiumInput)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .map((name) => path.join(compendiumInput, name))
  : [compendiumInput];
const fixtureArgs = process.argv.slice(process.argv.indexOf("--fixtures") + 1).filter((entry) => !entry.startsWith("--"));
const fixturePaths = process.argv.includes("--fixtures") && fixtureArgs.length ? fixtureArgs.map((entry) => path.resolve(entry)) : defaults;
const documents = compendiumPaths.map((compendiumPath) =>
  JSON.parse(fs.readFileSync(compendiumPath, "utf8")) as Record<string, unknown>
);
const entries = (category: string): JsonRecord[] => documents.flatMap((document) =>
  Array.isArray(document[category]) ? document[category] as JsonRecord[] : []
);
const indexes = Object.fromEntries(Array.from(new Set(documents.flatMap(Object.keys))).map((category) => [
  category,
  new Map(entries(category).map((entry) => [String(entry.id), entry])),
])) as Record<string, Map<string, JsonRecord>>;
const index = (category: string): Map<string, JsonRecord> => indexes[category] ?? new Map();
const itemIds = new Set(entries("items").map((entry) => String(entry.id)));
const spellIds = new Set(entries("spells").map((entry) => String(entry.id)));
const featIds = new Set(entries("feats").map((entry) => String(entry.id)));
const issues: string[] = [];
const results: JsonRecord[] = [];

function strings(value: unknown): string[] { return Array.isArray(value) ? value.map(String) : []; }
function modifier(score: number): number { return Math.floor((score - 10) / 2); }
function resolves(category: string, storedId: string): boolean {
  return index(category).has(storedId) || index(category).has(canonicalizeCompendiumId(storedId));
}

for (const fixturePath of fixturePaths) {
  const root = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as JsonRecord;
  const character = root.character as JsonRecord;
  const data = character.characterData as JsonRecord;
  const name = String(character.name);
  const selectedNames = new Set(strings(data.selectedFeatureNames));
  const classRows = Array.isArray(data.classes) ? data.classes as JsonRecord[] : [];
  let requiredFeatures = 0;
  for (const selection of classRows) {
    const classId = String(selection.classId ?? "");
    const cls = index("classes").get(classId) ?? index("classes").get(canonicalizeCompendiumId(classId));
    if (!cls) { issues.push(`${name}: class ${classId} does not resolve`); continue; }
    const level = Number(selection.level ?? 0);
    const subclass = String(selection.subclass ?? "");
    const subclassOptions = ((cls.subclasses as JsonRecord | undefined)?.options ?? {}) as Record<string, unknown>;
    const subclassId = Object.entries(subclassOptions).find(([, label]) => String(label) === subclass)?.[0] ?? subclass;
    const featuresById = new Map<string, JsonRecord>();
    for (const row of Array.isArray(cls.levels) ? cls.levels as JsonRecord[] : []) {
      for (const feature of Array.isArray(row.features) ? row.features as JsonRecord[] : []) featuresById.set(String(feature.id), feature);
    }
    const excludedChoiceFeatures = new Set<string>();
    for (const choice of Array.isArray(cls.choices) ? cls.choices as JsonRecord[] : []) {
      const options = Array.isArray(choice.options) ? choice.options as JsonRecord[] : [];
      const selected = options.find((option) => strings(option.features).some((id) => selectedNames.has(String(featuresById.get(id)?.name ?? ""))));
      for (const option of options) if (option !== selected) for (const id of strings(option.features)) excludedChoiceFeatures.add(id);
    }
    if (Number(data.hd) !== Number(cls.hitDie)) issues.push(`${name}: stored hit die d${data.hd} does not match ${cls.name} d${cls.hitDie}`);
    const proficiencies = cls.proficiencies as JsonRecord | undefined;
    const skillRule = proficiencies?.skills as JsonRecord | undefined;
    const chosenSkills = strings(data.chosenSkills);
    if (chosenSkills.length !== Number(skillRule?.choose ?? 0)) issues.push(`${name}: retained ${chosenSkills.length} class skills; expected ${skillRule?.choose ?? 0}`);
    const skillPool = new Set(strings(skillRule?.from));
    for (const skill of chosenSkills) if (!skillPool.has(skill)) issues.push(`${name}: retained class skill ${skill} is no longer valid for ${cls.name}`);
    if (name === "Drokkan Skarvulf" && !strings(proficiencies?.armor).includes("Medium Armor")) issues.push(`${name}: Barbarian source no longer grants Medium Armor`);
    for (const levelRow of (Array.isArray(cls.levels) ? cls.levels as JsonRecord[] : []).filter((row) => Number(row.level) <= level)) {
      for (const feature of Array.isArray(levelRow.features) ? levelRow.features as JsonRecord[] : []) {
        const featureName = String(feature.name ?? "");
        if (excludedChoiceFeatures.has(String(feature.id ?? ""))) continue;
        if (feature.subclass && String(feature.subclass) !== subclassId) continue;
        if (/^Becoming\b|Ability Score Improvement|Epic Boon/.test(featureName)) continue;
        requiredFeatures += 1;
        if (!selectedNames.has(featureName)) issues.push(`${name}: missing retained feature ${featureName}`);
      }
    }
  }
  const raceId = String(data.raceId ?? "");
  const bgId = String(data.bgId ?? "");
  if (!resolves("species", raceId)) issues.push(`${name}: species ${raceId} does not resolve after canonical migration`);
  if (!resolves("backgrounds", bgId)) issues.push(`${name}: background ${bgId} does not resolve after canonical migration`);
  const chosenFeats = [String(data.chosenRaceFeatId ?? ""), String(data.chosenBgOriginFeatId ?? ""),
    ...(Array.isArray(data.chosenLevelUpFeats) ? data.chosenLevelUpFeats as JsonRecord[] : []).map((entry) => String(entry.featId ?? ""))].filter(Boolean);
  for (const id of chosenFeats) {
    if (!featIds.has(id) && !featIds.has(canonicalizeCompendiumId(id))) issues.push(`${name}: feat ${id} does not resolve after canonical migration`);
  }
  const inventory = Array.isArray(data.inventory) ? data.inventory as JsonRecord[] : [];
  let linkedItems = 0;
  for (const item of inventory) if (item.itemId) {
    linkedItems += 1;
    const oldId = String(item.itemId);
    const migratedId = canonicalizeCompendiumId(oldId);
    if (!itemIds.has(oldId) && !itemIds.has(migratedId)) issues.push(`${name}: item ${oldId} does not resolve after canonical migration`);
  }
  const spellReferences = new Set<string>();
  for (const value of Object.values(data.chosenFeatOptions as JsonRecord ?? {})) for (const id of strings(value)) if (id.startsWith("s_")) spellReferences.add(id);
  for (const key of ["chosenCantrips", "chosenSpells"]) for (const id of strings(data[key])) if (id.startsWith("s_")) spellReferences.add(id);
  const proficiencies = data.proficiencies as JsonRecord | undefined;
  for (const spell of Array.isArray(proficiencies?.spells) ? proficiencies.spells as JsonRecord[] : []) if (spell.id) spellReferences.add(String(spell.id));
  for (const id of spellReferences) if (!spellIds.has(id) && !spellIds.has(canonicalizeCompendiumId(id))) issues.push(`${name}: spell ${id} does not resolve after canonical migration`);

  if (name === "Drokkan Skarvulf") {
    const equippedArmor = inventory.find((item) => item.equipped && /Armor/i.test(String(item.type ?? "")));
    const expectedAc = Number(equippedArmor?.ac ?? 10) + Math.min(2, modifier(Number(character.dexScore)));
    if (Number(character.ac) !== expectedAc) issues.push(`${name}: expected AC ${expectedAc}, found ${character.ac}`);
    if (Number(character.speed) !== 40) issues.push(`${name}: expected level-5 Fast Movement speed 40, found ${character.speed}`);
  }
  if (name === "Alarion Veilborne") {
    const expectedAc = 10 + modifier(Number(character.dexScore));
    const expectedHp = 6 + modifier(Number(character.conScore)) + (Number(character.level) - 1) * (4 + modifier(Number(character.conScore)));
    if (Number(character.ac) !== expectedAc) issues.push(`${name}: expected unarmored AC ${expectedAc}, found ${character.ac}`);
    if (Number(character.hpMax) !== expectedHp) issues.push(`${name}: expected HP ${expectedHp}, found ${character.hpMax}`);
  }
  results.push({ name, level: character.level, requiredFeatures, linkedItems, spellReferences: spellReferences.size, chosenFeats: chosenFeats.length });
}

console.log(JSON.stringify({ compendiumPaths, fixtures: results, issues }, null, 2));
if (issues.length) process.exitCode = 1;
