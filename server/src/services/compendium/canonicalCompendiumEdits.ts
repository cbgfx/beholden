import { record, list } from "../../lib/jsonRecord.js";
import { compactItemEntry } from "./itemCompaction.js";
import { compactMonsterEntry } from "./monsterCompaction.js";
import { compactSpellEntry } from "./spellCompaction.js";
import { CATEGORY_SCHEMAS } from "./nativeCompendiumV2Schemas.js";

type JsonRecord = Record<string, unknown>;
type EditableCategory = "monsters" | "items" | "spells";

function requireCanonicalEntry(
  category: EditableCategory,
  entry: JsonRecord,
): JsonRecord {
  return CATEGORY_SCHEMAS[category].parse(entry) as JsonRecord;
}

function mergeActionEdits(existingValue: unknown, replacementValue: unknown): JsonRecord[] {
  const existing = list(existingValue).map(record);
  return list(replacementValue).map((rawReplacement, index) => {
    const replacement = record(rawReplacement);
    const byName = existing.find((entry) =>
      String(entry.name ?? "").trim().toLowerCase()
      === String(replacement.name ?? "").trim().toLowerCase()
    );
    const previous = byName ?? existing[index] ?? {};
    return {
      ...previous,
      ...replacement,
      id: previous.id ?? replacement.id,
      category: previous.category ?? replacement.category ?? null,
      recharge: previous.recharge ?? replacement.recharge ?? null,
      attacks: list(previous.attacks).length > 0 ? previous.attacks : list(replacement.attacks),
    };
  });
}

/**
 * Merge fields not exposed by the current editor into its canonical V2 replacement.
 * Both inputs must already satisfy the current V2 schema.
 */
export function mergeCanonicalV2Edit(
  category: EditableCategory,
  existingEntry: JsonRecord,
  replacementEntry: JsonRecord,
): JsonRecord {
  const existing = requireCanonicalEntry(category, existingEntry);
  const replacement = requireCanonicalEntry(
    category,
    category === "spells"
      && (!Array.isArray(replacementEntry.description) || replacementEntry.description.length === 0)
      ? { ...replacementEntry, description: existing.description }
      : replacementEntry,
  );

  if (category === "monsters") {
    const existingClassification = record(existing.classification);
    const replacementClassification = record(replacement.classification);
    return compactMonsterEntry({
      ...existing,
      ...replacement,
      source: existing.source ?? replacement.source,
      classification: {
        ...existingClassification,
        ...replacementClassification,
        sortName: existingClassification.sortName ?? replacementClassification.sortName,
        alignment: existingClassification.alignment ?? replacementClassification.alignment,
        ancestry: existingClassification.ancestry ?? replacementClassification.ancestry,
      },
      description: existing.description ?? replacement.description,
      initiativeBonus: existing.initiativeBonus ?? replacement.initiativeBonus,
      passivePerception: existing.passivePerception ?? replacement.passivePerception,
      npc: existing.npc ?? replacement.npc,
      treasure: existing.treasure,
      traits: mergeActionEdits(existing.traits, replacement.traits),
      actions: mergeActionEdits(existing.actions, replacement.actions),
      reactions: mergeActionEdits(existing.reactions, replacement.reactions),
      legendaryActions: mergeActionEdits(existing.legendaryActions, replacement.legendaryActions),
      spellcasting: existing.spellcasting,
      spells: existing.spells,
    });
  }

  if (category === "items") {
    const existingArmor = record(existing.armor);
    const replacementArmor = record(replacement.armor);
    const existingWeapon = record(existing.weapon);
    const replacementWeapon = record(replacement.weapon);
    return compactItemEntry({
      ...existing,
      ...replacement,
      source: existing.source ?? replacement.source,
      attunement: typeof existing.attunement === "string"
        ? existing.attunement
        : replacement.attunement ?? existing.attunement,
      equippable: existing.equippable ?? replacement.equippable,
      proficiency: existing.proficiency ?? replacement.proficiency,
      armor: {
        ...existingArmor,
        ...replacementArmor,
        strength: existingArmor.strength ?? replacementArmor.strength,
      },
      weapon: {
        ...existingWeapon,
        ...replacementWeapon,
        range: existingWeapon.range ?? replacementWeapon.range,
      },
      detail: existing.detail ?? replacement.detail,
      rolls: existing.rolls ?? replacement.rolls,
    });
  }

  return compactSpellEntry({
    ...existing,
    ...replacement,
    source: existing.source ?? replacement.source,
    rolls: existing.rolls,
  });
}
