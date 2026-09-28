export interface SpellStateValidationProblem {
  code: "invalid-spell-state";
  message: string;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** Validates mutable spell state at character write and database-import boundaries. */
export function spellStateValidationProblem(characterData: Record<string, unknown> | null | undefined): SpellStateValidationProblem | null {
  if (!characterData) return null;
  if (characterData.usedSpellSlots !== undefined) {
    const slots = record(characterData.usedSpellSlots);
    if (!slots || Object.keys(slots).length > 50) return { code: "invalid-spell-state", message: "Used spell slots must be a small keyed map." };
    for (const [key, value] of Object.entries(slots)) {
      if (!key.trim() || key.length > 200 || !Number.isInteger(value) || Number(value) < 0 || Number(value) > 20) {
        return { code: "invalid-spell-state", message: `Used spell slot ${key || "entry"} is invalid.` };
      }
    }
  }
  if (characterData.classSpellSelections !== undefined) {
    const selections = record(characterData.classSpellSelections);
    if (!selections || Object.keys(selections).length > 20) return { code: "invalid-spell-state", message: "Class spell selections are invalid." };
    for (const [classId, raw] of Object.entries(selections)) {
      if (!classId.trim() || classId.length > 200 || !record(raw)) return { code: "invalid-spell-state", message: "A class spell selection is invalid." };
    }
  }
  // Whether a spell is prepared is a flag on its own entry (shared/domain/spellPreparation.ts).
  const spells = record(characterData.proficiencies)?.spells;
  if (Array.isArray(spells)) {
    if (spells.length > 1000) return { code: "invalid-spell-state", message: "The spell list is too large." };
    if (spells.some((spell) => record(spell) && (spell as Record<string, unknown>).prepared !== undefined && typeof (spell as Record<string, unknown>).prepared !== "boolean")) {
      return { code: "invalid-spell-state", message: "A spell's prepared mark must be true or false." };
    }
  }
  if (characterData.concentrationSpell !== undefined && characterData.concentrationSpell !== null
    && (typeof characterData.concentrationSpell !== "string" || !characterData.concentrationSpell.trim() || characterData.concentrationSpell.length > 500)) {
    return { code: "invalid-spell-state", message: "The concentration spell is invalid." };
  }
  return null;
}
