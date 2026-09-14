/**
 * The browser half of the monster sort rule.
 *
 * The server orders the list with an equivalent SQL expression (MONSTER_SORT_KEY in
 * routes/compendium/monsters.ts) and builds the A-Z index from monsterSortLetter. If these two
 * ever disagree, clicking a letter in the jump bar scrolls to the wrong row.
 */
import { describe, expect, it } from "vitest";
import { monsterSortLetter, normalizeMonsterSortName } from "@beholden/shared/domain/compendium/monsterSortName";

describe("normalizeMonsterSortName", () => {
  it("drops a leading article so the name files under the following word", () => {
    expect(normalizeMonsterSortName("The Abbot")).toBe("Abbot");
    expect(normalizeMonsterSortName("the demogorgon")).toBe("demogorgon");
  });

  it("leaves names that merely start with those letters alone", () => {
    // The SQL side has to escape the underscore in 'the_%' to get this same answer.
    expect(normalizeMonsterSortName("Theodore")).toBe("Theodore");
    expect(normalizeMonsterSortName("Thessalhydra")).toBe("Thessalhydra");
    expect(normalizeMonsterSortName("The")).toBe("The");
  });

  it("strips leading punctuation and surrounding space", () => {
    expect(normalizeMonsterSortName("  Aboleth ")).toBe("Aboleth");
    expect(normalizeMonsterSortName('"Bandit"')).toBe('Bandit"');
  });
});

describe("monsterSortLetter", () => {
  it("buckets by the normalized first letter", () => {
    expect(monsterSortLetter("The Abbot")).toBe("A");
    expect(monsterSortLetter("Theodore")).toBe("T");
    expect(monsterSortLetter("zombie")).toBe("Z");
  });

  it("returns null when the name doesn't start with a letter", () => {
    expect(monsterSortLetter("42nd Legionnaire")).toBeNull();
    expect(monsterSortLetter("")).toBeNull();
  });
});
