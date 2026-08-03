import { describe, expect, it } from "vitest";
import { buildFixedCountSpellChoiceEntries } from "./useCharacterCreatorDerivedState";
import type { SpellChoiceEffect } from "@/domain/character/featureEffects";

function makeEffect(overrides: Partial<SpellChoiceEffect> = {}): SpellChoiceEffect {
  return {
    id: "effect_1",
    type: "spell_choice",
    mode: "learn",
    choiceId: "choice_1",
    count: { kind: "fixed", value: 1 },
    level: 0,
    spellLists: ["Wizard"],
    source: { id: "src_1", kind: "class", name: "Arcane Discovery" },
    ...overrides,
  };
}

describe("buildFixedCountSpellChoiceEntries", () => {
  it("keys entries by choiceId falling back to id, and titles by level", () => {
    const [cantripEntry] = buildFixedCountSpellChoiceEntries(
      [makeEffect({ level: 0 })],
      { keyPrefix: "classfeature", resolveKeyId: (e) => e.choiceId ?? e.id, titleWord: "Bonus" },
    );
    expect(cantripEntry.key).toBe("classfeature:choice_1");
    expect(cantripEntry.title).toBe("Bonus Cantrip");

    const [leveledEntry] = buildFixedCountSpellChoiceEntries(
      [makeEffect({ level: 3 })],
      { keyPrefix: "classfeature", resolveKeyId: (e) => e.choiceId ?? e.id, titleWord: "Bonus" },
    );
    expect(leveledEntry.title).toBe("Bonus Level 3 Spell");

    const [anyLevelEntry] = buildFixedCountSpellChoiceEntries(
      [makeEffect({ level: null })],
      { keyPrefix: "classfeature", resolveKeyId: (e) => e.choiceId ?? e.id, titleWord: "Bonus" },
    );
    expect(anyLevelEntry.title).toBe("Bonus Spell");
  });

  it("drops non-fixed-count effects", () => {
    const entries = buildFixedCountSpellChoiceEntries(
      [makeEffect({ count: { kind: "scaling_by_level", tiers: [] } as never })],
      { keyPrefix: "classfeature", resolveKeyId: (e) => e.id, titleWord: "Bonus" },
    );
    expect(entries).toEqual([]);
  });

  it("filters by ifKnownPool only when the option is supplied (class-feature-only behavior)", () => {
    const effect = makeEffect({ ifKnown: "Fireball" });
    const withoutPool = buildFixedCountSpellChoiceEntries([effect], {
      keyPrefix: "classfeature",
      resolveKeyId: (e) => e.id,
      titleWord: "Bonus",
    });
    expect(withoutPool).toHaveLength(1);

    const knownPool = buildFixedCountSpellChoiceEntries([effect], {
      keyPrefix: "classfeature",
      resolveKeyId: (e) => e.id,
      titleWord: "Bonus",
      ifKnownPool: { classCantrips: [{ id: "sp_fireball", name: "Fireball" } as never], chosenCantripIds: ["sp_fireball"] },
    });
    expect(knownPool).toHaveLength(1);

    const unknownPool = buildFixedCountSpellChoiceEntries([effect], {
      keyPrefix: "classfeature",
      resolveKeyId: (e) => e.id,
      titleWord: "Bonus",
      ifKnownPool: { classCantrips: [{ id: "sp_fireball", name: "Fireball" } as never], chosenCantripIds: [] },
    });
    expect(unknownPool).toEqual([]);
  });

  it("caps unleveled choices to maxSpellLevel only when the option is supplied", () => {
    // `maxLevel` is intentionally not part of `CreatorResolvedSpellChoiceEntry` -- see the
    // excess-property-check note on the helper's call sites -- so tests read it via a cast.
    const [entry] = buildFixedCountSpellChoiceEntries(
      [makeEffect({ level: null })],
      { keyPrefix: "classfeature", resolveKeyId: (e) => e.id, titleWord: "Bonus", maxSpellLevel: 3 },
    ) as Array<{ maxLevel?: number | null }>;
    expect(entry.maxLevel).toBe(3);

    const [entryWithoutOption] = buildFixedCountSpellChoiceEntries(
      [makeEffect({ level: null })],
      { keyPrefix: "classfeature", resolveKeyId: (e) => e.id, titleWord: "Bonus" },
    ) as Array<{ maxLevel?: number | null }>;
    expect(entryWithoutOption.maxLevel).toBeUndefined();
  });

  it("applies extraFields (invocation-only fields) verbatim", () => {
    const [entry] = buildFixedCountSpellChoiceEntries(
      [makeEffect()],
      {
        keyPrefix: "invocation",
        resolveKeyId: (e) => e.id,
        titleWord: "Invocation Bonus",
        extraFields: () => ({ damageOnly: true, attackOnly: false, grantsSpell: true }),
      },
    );
    expect(entry.damageOnly).toBe(true);
    expect(entry.attackOnly).toBe(false);
    expect(entry.grantsSpell).toBe(true);
  });
});
