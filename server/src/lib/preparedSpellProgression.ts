export interface PreparedSpellProgressionRow {
  level: number;
  spells: string[];
}

export interface PreparedSpellProgressionTable {
  label: string | null;
  levelLabel: string;
  spellLabel: string;
  rows: PreparedSpellProgressionRow[];
  choiceGroupKey?: string | null;
  choicePrompt?: string | null;
  choiceOptionLabel?: string | null;
  choiceOptions?: string[] | null;
}

function splitList(text: string): string[] {
  return text
    .replace(/\band\b/gi, ",")
    .replace(/\bor\b/gi, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function cleanSpellName(value: string): string {
  const cleaned = value
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/[.;:]+$/g, "")
    .trim();
  return /^(?:it|that|this|those|these)$/i.test(cleaned) ? "" : cleaned;
}

function splitSpellNames(text: string): string[] {
  return splitList(text)
    .map(cleanSpellName)
    .filter(Boolean);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeChoiceToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b(?:land|terrain|type|table|spells?)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchChoiceOptionToTableLabel(option: string, label: string | null): boolean {
  const normalizedOption = normalizeChoiceToken(option);
  const normalizedLabel = normalizeChoiceToken(label ?? "");
  if (!normalizedOption || !normalizedLabel) return false;
  return normalizedOption === normalizedLabel
    || normalizedLabel.startsWith(normalizedOption)
    || normalizedOption.startsWith(normalizedLabel);
}

export function parsePreparedSpellProgression(text: string): PreparedSpellProgressionTable[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^Source:/i.test(line));

  const tables: PreparedSpellProgressionTable[] = [];

  for (let i = 0; i < lines.length; i++) {
    const headerMatch = lines[i]?.match(/^([^|]+Level)\s*\|\s*(.+)$/i);
    if (!headerMatch) continue;

    const levelLabel = headerMatch[1]!.trim();
    const spellLabel = headerMatch[2]!.trim();
    // Only treat as a spell progression table if the second column header mentions "spell"
    // (prevents Wild Shape, Beast Master, etc. tables from being misread as spell lists)
    if (!/spell/i.test(spellLabel.split("|")[0] ?? spellLabel)) continue;
    const labelCandidate = i > 0 && /:\s*$/.test(lines[i - 1] ?? "")
      ? (lines[i - 1] ?? "").replace(/:\s*$/, "").trim()
      : null;
    const rows: PreparedSpellProgressionRow[] = [];

    let j = i + 1;
    for (; j < lines.length; j++) {
      const line = lines[j] ?? "";
      if (!line.includes("|")) break;
      if (/^[^|]+Level\s*\|/i.test(line)) break;

      const rowMatch = line.match(/^(\d+)(?:st|nd|rd|th)?\s*\|\s*(.+)$/i);
      if (!rowMatch) break;

      rows.push({
        level: Number(rowMatch[1]),
        spells: splitList(rowMatch[2] ?? ""),
      });
    }

    if (rows.length > 0) {
      tables.push({
        label: labelCandidate,
        levelLabel,
        spellLabel,
        rows,
      });
      i = j - 1;
    }
  }

  const choiceMatch = text.match(/choose one ([^:]+):\s*([^.]+?)\.\s*consult the table below that corresponds to the chosen/i);
  if (choiceMatch && tables.length > 1) {
    const options = splitList(choiceMatch[2] ?? "");
    const matchedTables = tables.filter((table) =>
      options.some((option) => matchChoiceOptionToTableLabel(option, table.label))
    );
    if (options.length > 1 && matchedTables.length >= 2) {
      const choiceGroupKey = slugify(choiceMatch[1] ?? "prepared-spell-progression");
      tables.forEach((table) => {
        const matchedOption = options.find((option) => matchChoiceOptionToTableLabel(option, table.label)) ?? null;
        if (!matchedOption) return;
        table.choiceGroupKey = choiceGroupKey;
        table.choicePrompt = `Choose one ${String(choiceMatch[1] ?? "").trim()}`;
        table.choiceOptionLabel = matchedOption;
        table.choiceOptions = options;
      });
    }
  }

  return tables;
}

/**
 * Converts legacy prose-based species spell grants into explicit V2 progression
 * rows. This inference belongs at the XML conversion boundary; native V2
 * consumers must only read the resulting structured data.
 */
export function parseSpeciesSpellProgression(
  text: string,
  traitName: string,
): PreparedSpellProgressionTable[] {
  const rowsByLevel = new Map<number, string[]>();
  const addSpells = (level: number, spellNames: string[]) => {
    const spells = rowsByLevel.get(level) ?? [];
    for (const spellName of spellNames) {
      if (!spells.some((existing) => existing.toLowerCase() === spellName.toLowerCase())) {
        spells.push(spellName);
      }
    }
    if (spells.length > 0) rowsByLevel.set(level, spells);
  };

  for (const match of text.matchAll(/\byou (?:also )?know\s+(.+?)\s+cantrips?\b/giu)) {
    addSpells(1, splitSpellNames(match[1] ?? ""));
  }

  for (const match of text.matchAll(
    /\byou (?:also )?always have\s+(?:the\s+)?(.+?)\s+spell prepared\b/giu,
  )) {
    addSpells(1, splitSpellNames(match[1] ?? ""));
  }

  for (const match of text.matchAll(
    /\bwhen you reach character levels\s+(\d+)\s+and\s+(\d+),\s+you learn\s+(.+?)\s+and\s+(.+?)\s+respectively\b/giu,
  )) {
    addSpells(Number(match[1]), [cleanSpellName(match[3] ?? "")]);
    addSpells(Number(match[2]), [cleanSpellName(match[4] ?? "")]);
  }

  const rows = Array.from(rowsByLevel, ([level, spells]) => ({ level, spells }))
    .sort((a, b) => a.level - b.level);
  if (rows.length === 0) return [];

  return [{
    label: `${traitName.trim() || "Species Trait"} Spells`,
    levelLabel: "Character Level",
    spellLabel: "Granted Spells",
    rows,
  }];
}
