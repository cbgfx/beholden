import { describe, it } from "node:test";
import assert from "node:assert";
import { assertKnownXmlKeys, assertKnownXmlKeysEach, UnknownXmlFieldError } from "./xmlFieldGuard.js";

describe("assertKnownXmlKeys", () => {
  it("passes when all keys are known", () => {
    assert.doesNotThrow(() =>
      assertKnownXmlKeys(
        { name: "Fireball", level: 3 },
        ["name", "level"],
        { entityType: "spell", entityName: "Fireball", path: "<spell>" },
      ),
    );
  });

  it("throws UnknownXmlFieldError when an unknown key is present", () => {
    assert.throws(
      () =>
        assertKnownXmlKeys(
          { name: "Dwarf", ability: "Con +2" },
          ["name"],
          { entityType: "species", entityName: "Dwarf", path: "<race>" },
        ),
      (err: unknown) => {
        assert(err instanceof UnknownXmlFieldError, "should be UnknownXmlFieldError");
        assert.deepStrictEqual(err.unknownKeys, ["ability"]);
        assert.strictEqual(err.entityType, "species");
        assert.strictEqual(err.entityName, "Dwarf");
        assert.strictEqual(err.path, "<race>");
        return true;
      },
    );
  });

  it("reports all unknown keys at once", () => {
    assert.throws(
      () =>
        assertKnownXmlKeys(
          { name: "Aboleth", extra1: "a", extra2: "b" },
          ["name"],
          { entityType: "monster", entityName: "Aboleth", path: "<monster>" },
        ),
      (err: unknown) => {
        assert(err instanceof UnknownXmlFieldError);
        assert.strictEqual(err.unknownKeys.length, 2);
        assert(err.unknownKeys.includes("extra1"));
        assert(err.unknownKeys.includes("extra2"));
        return true;
      },
    );
  });

  it("is a no-op for null", () => {
    assert.doesNotThrow(() =>
      assertKnownXmlKeys(null, ["name"], { entityType: "x", entityName: "x", path: "x" }),
    );
  });

  it("is a no-op for undefined", () => {
    assert.doesNotThrow(() =>
      assertKnownXmlKeys(undefined, ["name"], { entityType: "x", entityName: "x", path: "x" }),
    );
  });

  it("is a no-op for a plain string", () => {
    assert.doesNotThrow(() =>
      assertKnownXmlKeys("some text", ["name"], { entityType: "x", entityName: "x", path: "x" }),
    );
  });

  it("is a no-op for an array", () => {
    assert.doesNotThrow(() =>
      assertKnownXmlKeys([{ unknown: true }], ["name"], { entityType: "x", entityName: "x", path: "x" }),
    );
  });
});

describe("assertKnownXmlKeys (warn mode)", () => {
  it("pushes a warning instead of throwing when warnings array is provided", () => {
    const warnings: string[] = [];
    assert.doesNotThrow(() =>
      assertKnownXmlKeys(
        { name: "Cave Bear", powersource: "nature" },
        ["name"],
        { entityType: "monster", entityName: "Cave Bear", path: "<monster>" },
        warnings,
      ),
    );
    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0]!.includes("powersource"), `Expected "powersource" in: ${warnings[0]}`);
    assert.ok(warnings[0]!.includes("Cave Bear"), `Expected entity name in: ${warnings[0]}`);
  });

  it("collects multiple unknown keys in one warning entry", () => {
    const warnings: string[] = [];
    assertKnownXmlKeys(
      { name: "Dwarf", extra1: "a", extra2: "b" },
      ["name"],
      { entityType: "species", entityName: "Dwarf", path: "<race>" },
      warnings,
    );
    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0]!.includes("extra1") && warnings[0]!.includes("extra2"));
  });

  it("does not push anything when all keys are known", () => {
    const warnings: string[] = [];
    assertKnownXmlKeys(
      { name: "Fireball", level: 3 },
      ["name", "level"],
      { entityType: "spell", entityName: "Fireball", path: "<spell>" },
      warnings,
    );
    assert.strictEqual(warnings.length, 0);
  });
});

describe("assertKnownXmlKeysEach (warn mode)", () => {
  it("pushes a warning per item with unknown keys", () => {
    const warnings: string[] = [];
    assertKnownXmlKeysEach(
      [
        { name: "Bite", unknown: true },
        { name: "Claw" },
      ],
      ["name", "text"],
      { entityType: "monster", entityName: "Dragon", path: "<action>" },
      warnings,
    );
    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0]!.includes("unknown"));
  });
});

describe("assertKnownXmlKeysEach", () => {
  it("passes when all items have only known keys", () => {
    assert.doesNotThrow(() =>
      assertKnownXmlKeysEach(
        [{ "@_category": "bonus", "#text": "AC +1" }],
        ["@_category", "#text"],
        { entityType: "item", entityName: "+1 Shield", path: "<modifier>" },
      ),
    );
  });

  it("throws on an item with an unknown key", () => {
    assert.throws(
      () =>
        assertKnownXmlKeysEach(
          [{ "@_category": "bonus", "#text": "AC +1", extra: "oops" }],
          ["@_category", "#text"],
          { entityType: "item", entityName: "+1 Shield", path: "<modifier>" },
        ),
      (err: unknown) => {
        assert(err instanceof UnknownXmlFieldError);
        assert.deepStrictEqual(err.unknownKeys, ["extra"]);
        return true;
      },
    );
  });

  it("skips plain-string items (modifier values stored as raw strings)", () => {
    assert.doesNotThrow(() =>
      assertKnownXmlKeysEach(
        ["Proficiency with martial weapons"],
        ["@_category", "#text"],
        { entityType: "class", entityName: "Fighter", path: "<modifier>" },
      ),
    );
  });

  it("is a no-op for null/undefined value", () => {
    assert.doesNotThrow(() =>
      assertKnownXmlKeysEach(null, ["name"], { entityType: "x", entityName: "x", path: "x" }),
    );
    assert.doesNotThrow(() =>
      assertKnownXmlKeysEach(undefined, ["name"], { entityType: "x", entityName: "x", path: "x" }),
    );
  });

  it("wraps a single object (not in an array) and checks it", () => {
    assert.throws(
      () =>
        assertKnownXmlKeysEach(
          { name: "Bite", unknown: true },
          ["name", "text"],
          { entityType: "monster", entityName: "Dragon", path: "<action>" },
        ),
      (err: unknown) => {
        assert(err instanceof UnknownXmlFieldError);
        assert.deepStrictEqual(err.unknownKeys, ["unknown"]);
        return true;
      },
    );
  });
});
