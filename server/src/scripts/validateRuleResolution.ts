import fs from "node:fs";
import path from "node:path";

type JsonRecord = Record<string, unknown>;
type Rule = JsonRecord & { name?: string; resolution?: string };
const optionIndex = process.argv.indexOf("--compendium");
const defaultCompendium = path.resolve("../compendium/WotC_2024_only.json");
const compendiumPath = path.resolve(optionIndex >= 0 ? process.argv[optionIndex + 1] ?? "" : defaultCompendium);
const document = JSON.parse(fs.readFileSync(compendiumPath, "utf8")) as Record<string, unknown>;
const batch = (category: string): JsonRecord[] => Array.isArray(document[category]) ? document[category] as JsonRecord[] : [];
const rules: Array<{ category: string; owner: string; rule: Rule }> = [];

for (const cls of batch("classes")) for (const level of Array.isArray(cls.levels) ? cls.levels as JsonRecord[] : []) {
  for (const feature of Array.isArray(level.features) ? level.features as Rule[] : []) rules.push({ category: "class feature", owner: String(cls.name), rule: feature });
}
for (const species of batch("species")) for (const trait of Array.isArray(species.traits) ? species.traits as Rule[] : []) {
  rules.push({ category: "species trait", owner: String(species.name), rule: trait });
}
for (const feat of batch("feats") as Rule[]) rules.push({ category: "feat", owner: String(feat.name), rule: feat });

const structuredKeys = ["effects", "resources", "scalingRolls", "preparedSpellProgression", "spellGrants"];
const issues: string[] = [];
const counts: Record<string, number> = {};
for (const { category, owner, rule } of rules) {
  const resolution = String(rule.resolution ?? "");
  counts[resolution || "missing"] = (counts[resolution || "missing"] ?? 0) + 1;
  if (!["automatic", "mixed", "manual"].includes(resolution)) issues.push(`${category} ${owner} > ${rule.name}: missing or invalid resolution`);
  if (resolution !== "manual") {
    const hasStructure = category === "feat"
      ? Boolean(rule.mechanics && typeof rule.mechanics === "object")
      : structuredKeys.some((key) => Array.isArray(rule[key]) && (rule[key] as unknown[]).length > 0);
    if (!hasStructure) issues.push(`${category} ${owner} > ${rule.name}: ${resolution} without structured mechanics`);
  }
}

for (const item of batch("items")) {
  const weapon = item.weapon && typeof item.weapon === "object" ? item.weapon as JsonRecord : null;
  const description = Array.isArray(item.description) ? item.description.join("\n\n") : String(item.description ?? "");
  if (weapon && /\(Mastery\):/iu.test(description) && !String(weapon.mastery ?? "").trim()) {
    issues.push(`item ${String(item.name)}: mastery prose without weapon.mastery`);
  }
}

console.log(JSON.stringify({ compendiumPath, rules: rules.length, counts, issues }, null, 2));
if (issues.length) process.exitCode = 1;
