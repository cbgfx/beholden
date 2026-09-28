/**
 * Which conditions a rest ends.
 *
 * This is a table convenience rather than the printed rule -- by the book a rest ends no condition
 * but Exhaustion. The lists are built on duration instead: a Short Rest outlasts anything measured
 * in rounds, a Long Rest outlasts the hour-to-eight-hour effects. The two exceptions are asserted
 * explicitly below, because getting either wrong corrupts a character rather than just annoying
 * one.
 */
import { describe, expect, it } from "vitest";
import { clearsOnRest, conditionsAfterRest, SHARED_CONDITION_DEFS } from "@beholden/shared/domain/conditions";

/** Every condition key that can sit on a character, including the two outside the shared defs. */
const ALL_KEYS = [...SHARED_CONDITION_DEFS.map((def) => def.key), "rage", "polymorphed"];

const SURVIVES_SHORT_REST = [
  "blinded",
  "charmed",
  "deafened",
  "invisible",
  "poisoned",
  "disadvantage",
  "mage_armor",
  "petrified",
  "polymorphed",
];

describe("clearsOnRest", () => {
  it("ends the round-scale conditions on a Short Rest", () => {
    const cleared = ALL_KEYS.filter((key) => clearsOnRest(key, "short"));
    expect(cleared.sort()).toEqual([
      "concentration",
      "frightened",
      "grappled",
      "hexed",
      "incapacitated",
      "marked",
      "paralyzed",
      "prone",
      "rage",
      "restrained",
      "slow",
      "stunned",
      "unconscious",
    ]);
  });

  it("leaves the hour-scale conditions for a Long Rest to outlast", () => {
    for (const key of SURVIVES_SHORT_REST) {
      expect(clearsOnRest(key, "short"), key).toBe(false);
    }
  });

  it("ends everything on a Long Rest except petrified and polymorphed", () => {
    const survives = ALL_KEYS.filter((key) => !clearsOnRest(key, "long"));
    expect(survives.sort()).toEqual(["petrified", "polymorphed"]);
  });

  it("ends poisoned on a Long Rest but not a Short Rest", () => {
    // The reported bug: nearly every poison runs an hour or less, so eight hours outlasts it.
    expect(clearsOnRest("poisoned", "long")).toBe(true);
    expect(clearsOnRest("poisoned", "short")).toBe(false);
  });

  it("never ends petrified, which has no duration to expire", () => {
    expect(clearsOnRest("petrified", "short")).toBe(false);
    expect(clearsOnRest("petrified", "long")).toBe(false);
  });

  it("is case- and whitespace-insensitive about the key", () => {
    expect(clearsOnRest(" Poisoned ", "long")).toBe(true);
  });

  it("treats an unknown key as something a rest doesn't end", () => {
    expect(clearsOnRest("cursed_by_the_dm", "long")).toBe(false);
  });
});

describe("conditionsAfterRest", () => {
  it("keeps the conditions the rest doesn't outlast", () => {
    const conditions = [
      { key: "poisoned" },
      { key: "petrified" },
      { key: "stunned" },
      { key: "mage_armor" },
    ];
    expect(conditionsAfterRest(conditions, "short")).toEqual([
      { key: "poisoned" },
      { key: "petrified" },
      { key: "mage_armor" },
    ]);
    expect(conditionsAfterRest(conditions, "long")).toEqual([{ key: "petrified" }]);
  });

  it("preserves the rest of each condition's payload", () => {
    const conditions = [{ key: "hexed", casterId: "c1" }, { key: "poisoned", expiresAtRound: 4 }];
    expect(conditionsAfterRest(conditions, "long")).toEqual([]);
    expect(conditionsAfterRest(conditions, "short")).toEqual([{ key: "poisoned", expiresAtRound: 4 }]);
  });

  it("hands polymorphed back untouched, since dropping it would strand the form's numbers", () => {
    // The long-rest handler reverts this one deliberately, restoring the AC and HP maximum the
    // form replaced. A blanket filter here would leave the character wearing them forever.
    const conditions = [{ key: "polymorphed", originalHpCurrent: 17, originalAcBonus: 2 }];
    expect(conditionsAfterRest(conditions, "long")).toEqual(conditions);
  });

  it("tolerates a missing condition list", () => {
    expect(conditionsAfterRest(null, "long")).toEqual([]);
    expect(conditionsAfterRest(undefined, "short")).toEqual([]);
  });
});
