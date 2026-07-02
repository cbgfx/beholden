import { wordOrNumberToInt } from "@/lib/characterRules";
import { ALL_SKILLS } from "../constants/CharacterCreatorConstants";
import type {
  CreatorClassDetailLike,
  CreatorRaceTraitLike,
  StartingEquipmentOption,
  StructuredStartingEquipmentOption,
} from "./CharacterCreatorClassCoreUtils";
import type { RaceChoices } from "./CharacterCreatorClassCoreUtils";

const SKILL_NAMES = ALL_SKILLS.map((skill) => skill.name);

export function parseRaceChoices(traits: CreatorRaceTraitLike[]): RaceChoices {
  let hasChosenSize = false;
  let skillChoice: RaceChoices["skillChoice"] = null;
  let toolChoice: RaceChoices["toolChoice"] = null;
  let languageChoice: RaceChoices["languageChoice"] = null;
  let hasFeatChoice = false;

  for (const trait of traits) {
    const text = trait.text;
    if (/^size$/i.test(trait.name) && /chosen when you select/i.test(text)) hasChosenSize = true;
    if (/origin feat of your choice/i.test(text)) hasFeatChoice = true;

    const skillListMatch = text.match(/proficiency in the\s+([\w\s,]+?)\s+skills?\b/i);
    if (skillListMatch) {
      const from = skillListMatch[1]
        .split(/,\s*|\s+or\s+/i)
        .map((s) => s.trim())
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .filter((s) => SKILL_NAMES.includes(s));
      if (from.length > 0 && !skillChoice) skillChoice = { count: 1, from };
    } else if (
      /one skill proficiency|proficiency in one skill|gain proficiency in one skill of your choice/i.test(text) ||
      /one skill of your choice/i.test(text)
    ) {
      if (!skillChoice) skillChoice = { count: 1, from: null };
    }

    if (/one tool proficiency of your choice/i.test(text)) {
      if (!toolChoice) toolChoice = { count: 1, from: null };
    }

    const langListMatch = text.match(/your choice of (\w+)\s+of the following[^:]*languages?:\s*([^\n.]+)/i);
    if (langListMatch) {
      const count = wordOrNumberToInt(langListMatch[1]) ?? 1;
      const from = langListMatch[2]
        .split(/[,\n\t]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "));
      if (!languageChoice) languageChoice = { count, from: from.length > 0 ? from : null };
    } else if (/one(?:\s+extra)?\s+language.*(?:of your )?choice/i.test(text)) {
      if (!languageChoice) languageChoice = { count: 1, from: null };
    }
  }

  return { hasChosenSize, skillChoice, toolChoice, languageChoice, hasFeatChoice };
}

function splitEquipmentEntries(text: string): string[] {
  return text
    .replace(/\s+or\s+$/i, "")
    .replace(/\s+and\s+/gi, ", ")
    .split(/\s*,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseStartingEquipmentOptions(
  equipment: string | undefined,
  structuredOptions?: StructuredStartingEquipmentOption[],
): StartingEquipmentOption[] {
  if (structuredOptions?.length) {
    return structuredOptions.map((option) => {
      const entries = option.entries.map((entry) => entry.kind === "currency"
        ? `${entry.amount} ${entry.denomination}`
        : `${entry.quantity > 1 ? `${entry.quantity}× ` : ""}${entry.name}`);
      return { id: option.id, entries, text: entries.join(", ") };
    });
  }
  if (!equipment) return [];
  const normalized = equipment
    .replace(/\r/g, "")
    .replace(/Choose\s+A\s+or\s+8/gi, "Choose A or B")
    .replace(/\(8\)/g, "(B)")
    .replace(/\u2022/g, ";")
    .replace(/•/g, ";")
    .replace(/\s+/g, " ")
    .trim();
  const matches = [...normalized.matchAll(/\(([A-Z])\)\s*([\s\S]*?)(?=(?:;\s*or\s*\([A-Z]\))|(?:;\s*\([A-Z]\))|$)/g)];
  return matches
    .map((match) => ({
      id: match[1] ?? "",
      text: (match[2] ?? "").trim().replace(/;$/, ""),
      entries: splitEquipmentEntries((match[2] ?? "").trim()),
    }))
    .filter((option) => option.id && option.entries.length > 0);
}

export function extractClassStartingEquipment(classDetail: CreatorClassDetailLike | null): string {
  if (!classDetail) return "";
  for (const al of classDetail.autolevels) {
    if (al.level !== 1) continue;
    for (const feature of al.features ?? []) {
      const match = (feature.text ?? "").match(/Starting Equipment:\s*([^\n]+)/i);
      if (match?.[1]) return match[1].trim();
    }
  }
  return "";
}
