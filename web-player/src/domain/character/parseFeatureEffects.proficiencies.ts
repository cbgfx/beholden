import { normalizeLanguageName } from "@/views/character/CharacterSheetUtils";
import { titleCase as toTitleCase } from "@/lib/format/titleCase";
import {
  createFeatureEffectId,
  type FeatureEffect,
  type FeatureEffectSource,
  type ProficiencyGrantEffect,
} from "@/domain/character/featureEffects";
import {
  isProficiencyNoiseToken,
  normalizeSkillName,
  parseWordCount,
  splitSkillNames,
} from "@/domain/character/parseFeatureEffects.normalizers";

export function parseProficiencyGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const armor: string[] = [];
  const weapons: string[] = [];
  const tools: string[] = [];
  const skills: string[] = [];
  const expertise: string[] = [];
  const saves: string[] = [];
  const languages = new Set<string>();

  const pushArmorGrant = (raw: string) => {
    const normalized = String(raw ?? "").trim().toLowerCase();
    if (!normalized) return;
    if (/\ball\b/.test(normalized)) {
      armor.push("All Armor");
      return;
    }
    if (/\blight\b/.test(normalized)) armor.push("Light Armor");
    if (/\bmedium\b/.test(normalized)) armor.push("Medium Armor");
    if (/\bheavy\b/.test(normalized)) armor.push("Heavy Armor");
  };

  const armorClauseRe = /(?:armor training:\s*|training with\s+|proficiency with\s+)((?:all|light|medium|heavy)(?:[\w\s,]*?(?:armor|shields?))?)/gi;
  let m: RegExpExecArray | null;
  while ((m = armorClauseRe.exec(text)) !== null) {
    const clause = m[1]?.trim();
    if (!clause) continue;
    pushArmorGrant(clause);
    if (/\bshields?\b/i.test(clause)) armor.push("Shields");
  }

  for (const match of text.matchAll(/(?:armor training:\s*|training with\s+|proficiency with\s+)shields?\b/gi)) {
    if (match[0]) armor.push("Shields");
  }

  const weaponRe = /proficiency with\s+([\w\s,]+?)\s+weapons\b/gi;
  while ((m = weaponRe.exec(text)) !== null) {
    m[1]
      .split(/\s+and\s+|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => weapons.push(`${toTitleCase(s)} Weapons`));
  }

  const toolRe = /proficiency with\s+([\w\s']+?(?:tools?|kit|instruments?|supplies))\b/gi;
  while ((m = toolRe.exec(text)) !== null) {
    const parsed = toTitleCase(m[1].trim());
    if (isProficiencyNoiseToken(parsed)) continue;
    tools.push(parsed);
  }

  const skillRe = /proficiency in\s+([\w\s]+?)(?:\.|,|\band\b|$)/gi;
  while ((m = skillRe.exec(text)) !== null) {
    splitSkillNames(m[1]).forEach((name) => skills.push(name));
  }

  for (const match of text.matchAll(/proficiency (?:with|in)\s+([A-Za-z,\s]+?)\s+saving throws?/gi)) {
    match[1]
      .split(/\s+and\s+|,/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((name) => saves.push(toTitleCase(name)));
  }

  for (const match of text.matchAll(/saving throw proficiency(?: with)?\s+([A-Za-z,\s]+?)(?:\.|,|;|$)/gi)) {
    match[1]
      .split(/\s+and\s+|,/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((name) => saves.push(toTitleCase(name)));
  }

  if (/proficiency in all saving throws/i.test(text)) {
    saves.push("Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma");
  }

  for (const match of text.matchAll(/gain proficiency (?:with|in)\s+(a|an|another|one|two|three|four|five|six|\d+)\s+(skills?|tools?|languages?)\s+of your choice/gi)) {
    const count = parseWordCount(match[1] ?? "") ?? 0;
    if (count <= 0) continue;
    const rawCategory = String(match[2] ?? "").toLowerCase();
    const optionCategory =
      rawCategory.startsWith("skill") ? "skill"
      : rawCategory.startsWith("tool") ? "tool"
      : rawCategory.startsWith("language") ? "language"
      : null;
    if (!optionCategory) continue;
    effects.push({
      id: createFeatureEffectId(source, "proficiency_grant", effects.length),
      type: "proficiency_grant",
      source,
      category: optionCategory,
      choice: {
        count: { kind: "fixed", value: count },
        optionCategory,
      },
      summary: `Choose ${count} ${optionCategory}${count === 1 ? "" : "s"} for proficiency`,
    } satisfies ProficiencyGrantEffect);
  }

  for (const match of text.matchAll(
    /expertise in\s+(one|two|three|four|five|six|\d+)(?:\s+more)?\s+of your skill proficiencies of your choice/gi,
  )) {
    const count = parseWordCount(match[1] ?? "") ?? 0;
    if (count <= 0) continue;
    effects.push({
      id: createFeatureEffectId(source, "proficiency_grant", effects.length),
      type: "proficiency_grant",
      source,
      category: "skill",
      expertise: true,
      choice: {
        count: { kind: "fixed", value: count },
        optionCategory: "skill",
      },
      summary: `Choose ${count} skill${count === 1 ? "" : "s"} for expertise`,
    } satisfies ProficiencyGrantEffect);
  }

  for (const match of text.matchAll(/(?:learn|know)\s+(one|two|three|four|five|six|\d+)\s+languages?\s+of your choice\b/gi)) {
    const count = parseWordCount(match[1] ?? "") ?? 0;
    if (count <= 0) continue;
    effects.push({
      id: createFeatureEffectId(source, "proficiency_grant", effects.length),
      type: "proficiency_grant",
      source,
      category: "language",
      choice: {
        count: { kind: "fixed", value: count },
        optionCategory: "language",
      },
      summary: `Choose ${count} language${count === 1 ? "" : "s"} for proficiency`,
    } satisfies ProficiencyGrantEffect);
  }

  if (
    /expertise in one skill of your choice/i.test(text)
    || /choose one skill in which you have proficiency/i.test(text)
  ) {
    effects.push({
      id: createFeatureEffectId(source, "proficiency_grant", effects.length),
      type: "proficiency_grant",
      source,
      category: "skill",
      expertise: true,
      choice: {
        count: { kind: "fixed", value: 1 },
        optionCategory: "skill",
      },
      summary: "Choose one skill for expertise",
    } satisfies ProficiencyGrantEffect);
  }

  const expertiseRe = /(?:gain|have)\s+expertise in\s+([A-Za-z' ]+?)(?:\s+skill)?(?:\.|,|;|$)/gi;
  while ((m = expertiseRe.exec(text)) !== null) {
    const raw = m[1]?.trim();
    if (
      !raw
      || /\bone\b.*\bchoice\b/i.test(raw)
      || /\bof your\b/i.test(raw)
      || /\bproficienc(?:y|ies)\b/i.test(raw)
      || /\bchoice\b/i.test(raw)
    ) continue;
    raw
      .split(/\s+and\s+|,/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((name) => normalizeSkillName(name))
      .filter((name): name is string => Boolean(name))
      .forEach((name) => expertise.push(name));
  }

  if (/you have Expertise in those two skills/i.test(text)) {
    const listedSkills = Array.from(new Set(
      ["Arcana", "History", "Nature", "Religion"].filter((skill) => new RegExp(`\\b${skill}\\b`, "i").test(text))
    ));
    listedSkills.forEach((name) => expertise.push(name));
  }

  const langRe = /(?:learn|speak|know|understand)\s+(?:the\s+)?([\w]+)\s+language/gi;
  while ((m = langRe.exec(text)) !== null) {
    const parsed = normalizeLanguageName(toTitleCase(m[1]));
    if (!parsed || isProficiencyNoiseToken(parsed)) continue;
    languages.add(parsed);
  }
  if (/know\s+thieves' cant/i.test(text)) languages.add("Thieves' Cant");

  const byCategory = [
    { category: "armor", values: armor },
    { category: "weapon", values: weapons },
    { category: "tool", values: tools },
    { category: "skill", values: skills },
    { category: "saving_throw", values: saves },
    { category: "language", values: Array.from(languages) },
  ] as const;

  for (const { category, values } of byCategory) {
    if (values.length === 0) continue;
    effects.push({
      id: createFeatureEffectId(source, "proficiency_grant", effects.length),
      type: "proficiency_grant",
      source,
      category,
      grants: Array.from(new Set(values)),
    } satisfies ProficiencyGrantEffect);
  }

  if (expertise.length > 0) {
    effects.push({
      id: createFeatureEffectId(source, "proficiency_grant", effects.length),
      type: "proficiency_grant",
      source,
      category: "skill",
      expertise: true,
      grants: Array.from(new Set(expertise)),
      summary: `Expertise in ${Array.from(new Set(expertise)).join(", ")}`,
    } satisfies ProficiencyGrantEffect);
  }
}

