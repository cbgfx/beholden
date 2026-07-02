import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import type { AppliedCharacterFeatureEntry } from "./characterFeatures";

export interface ProgressionGrantedSpellEntry {
  key: string;
  spellName: string;
  sourceName: string;
  note: string;
  ability?: "str" | "dex" | "con" | "int" | "wis" | "cha" | null;
}

export interface PreparedSpellProgressionChoiceDefinition {
  key: string;
  featureId: string;
  sourceName: string;
  prompt: string;
  options: string[];
}

function splitProgressionChoiceOptions(text: string): string[] {
  return String(text ?? "")
    .replace(/\band\b/gi, ",")
    .replace(/\bor\b/gi, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeProgressionChoiceToken(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\b(?:land|terrain|type|table|spells?)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferPreparedSpellProgressionChoiceMetadata(
  text: string | null | undefined,
  tables: PreparedSpellProgressionTable[],
): PreparedSpellProgressionTable[] {
  if (tables.length <= 1) return tables;
  if (tables.some((table) => table.choiceGroupKey && table.choiceOptionLabel)) return tables;

  const match = String(text ?? "").match(/choose one ([^:]+):\s*([^.]+?)\.\s*consult the table below that corresponds to the chosen/i);
  if (!match) return tables;

  const promptTarget = String(match[1] ?? "").trim();
  const options = splitProgressionChoiceOptions(match[2] ?? "");
  if (options.length <= 1) return tables;
  const choiceGroupKey = normalizeProgressionChoiceToken(promptTarget).replace(/\s+/g, "-") || "progression-choice";

  return tables.map((table) => {
    const matchedOption = options.find((option) => {
      const normalizedOption = normalizeProgressionChoiceToken(option);
      const normalizedLabel = normalizeProgressionChoiceToken(table.label ?? "");
      return normalizedOption && normalizedLabel && (
        normalizedOption === normalizedLabel
        || normalizedLabel.startsWith(normalizedOption)
        || normalizedOption.startsWith(normalizedLabel)
      );
    });
    if (!matchedOption) return table;
    return {
      ...table,
      choiceGroupKey,
      choicePrompt: `Choose one ${promptTarget}`,
      choiceOptionLabel: matchedOption,
      choiceOptions: options,
    };
  });
}

export function buildPreparedSpellProgressionGrants(
  features: Array<Pick<AppliedCharacterFeatureEntry, "id" | "name" | "text" | "preparedSpellProgression" | "spellcastingAbility">>,
  characterLevel: number,
  chosenFeatureChoices: Record<string, string[]> | null | undefined = {},
): ProgressionGrantedSpellEntry[] {
  const grants = new Map<string, ProgressionGrantedSpellEntry>();

  for (const feature of features) {
    const tables = inferPreparedSpellProgressionChoiceMetadata(feature.text, feature.preparedSpellProgression ?? []);
    const groupedTables = tables.filter((table) => table.choiceGroupKey && table.choiceOptionLabel);
    const tablesToApply = (() => {
      if (tables.length === 1) return tables;
      if (groupedTables.length === 0) return [];

      const groups = new Map<string, PreparedSpellProgressionTable[]>();
      for (const table of groupedTables) {
        const groupKey = String(table.choiceGroupKey);
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey)!.push(table);
      }

      return Array.from(groups.entries()).flatMap(([groupKey, groupTables]) => {
        const selectionKey = `${feature.id}:prepared-spell-progression:${groupKey}`;
        const selected = chosenFeatureChoices?.[selectionKey]?.[0];
        if (!selected) return [];
        const normalizedSelection = selected.trim().toLowerCase();
        const matched = groupTables.find((table) => String(table.choiceOptionLabel ?? "").trim().toLowerCase() === normalizedSelection);
        return matched ? [matched] : [];
      });
    })();

    for (const table of tablesToApply) {
      for (const row of table.rows ?? []) {
        if (row.level > characterLevel) continue;
        for (const spellName of row.spells ?? []) {
          // Reject table-row data misidentified as spell names (e.g. "1/4 | No")
          if (/[|]/.test(spellName) || /^[\d/]+$/.test(spellName.trim()) || /^(yes|no)$/i.test(spellName.trim())) continue;
          const normalized = spellName.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!normalized) continue;
          if (grants.has(normalized)) continue;
          grants.set(normalized, {
            key: `progression:${feature.id}:${normalized}`,
            spellName,
            sourceName: feature.name,
            note: "Always prepared.",
            ability: feature.spellcastingAbility ?? null,
          });
        }
      }
    }
  }

  return Array.from(grants.values());
}

export function buildPreparedSpellProgressionChoiceDefinitions(
  features: Array<Pick<AppliedCharacterFeatureEntry, "id" | "name" | "text" | "preparedSpellProgression">>,
): PreparedSpellProgressionChoiceDefinition[] {
  const definitions: PreparedSpellProgressionChoiceDefinition[] = [];
  const seen = new Set<string>();

  for (const feature of features) {
    const tablesWithMetadata = inferPreparedSpellProgressionChoiceMetadata(feature.text, feature.preparedSpellProgression ?? []);
    const groups = new Map<string, PreparedSpellProgressionTable[]>();
    for (const table of tablesWithMetadata) {
      if (!table.choiceGroupKey || !table.choiceOptionLabel) continue;
      const groupKey = String(table.choiceGroupKey);
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(table);
    }

    for (const [groupKey, tables] of groups) {
      const options = Array.from(new Set(
        tables
          .flatMap((table) => table.choiceOptions?.length ? table.choiceOptions : [table.choiceOptionLabel ?? ""])
          .map((option) => String(option ?? "").trim())
          .filter(Boolean)
      ));
      if (options.length <= 1) continue;
      const key = `${feature.id}:prepared-spell-progression:${groupKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      definitions.push({
        key,
        featureId: feature.id,
        sourceName: feature.name,
        prompt: tables[0]?.choicePrompt ?? "Choose a progression table",
        options,
      });
    }
  }

  return definitions;
}
