import { describe, expect, it } from "vitest";
import { buildCharacterCreatePayload, buildExportFilename, normalizeCharacterTransfer } from "./PlayerHomeUtils";

describe("normalizeCharacterTransfer", () => {
  it("preserves stored AC and Speed and is idempotent", () => {
    const character = {
      name: "Facts Only",
      className: "Barbarian",
      species: "Human",
      level: 7,
      hpMax: 70,
      hpCurrent: 70,
      ac: 17,
      speed: 40,
      characterData: {
        classes: [{ className: "Barbarian", level: 7 }],
        selectedFeatureNames: ["Fast Movement", "Unarmored Defense"],
      },
    };

    const once = normalizeCharacterTransfer(character);
    const twice = normalizeCharacterTransfer(once);

    expect(once.ac).toBe(17);
    expect(once.speed).toBe(40);
    expect(twice.ac).toBe(17);
    expect(twice.speed).toBe(40);
  });
});

describe("buildExportFilename", () => {
  it("uses only the sanitized character name and date", () => {
    const filename = buildExportFilename("Alarion Veilborne");
    expect(filename).toMatch(/^alarion-veilborne-\d{4}-\d{2}-\d{2}\.json$/u);
    expect(filename).not.toContain("beholden-character");
  });
});

describe("buildCharacterCreatePayload", () => {
  it("preserves the ruleset from a wrapped character export", () => {
    const payload = buildCharacterCreatePayload({
      format: "beholden.character",
      version: 1,
      character: {
        name: "Darius Blackmont",
        ruleset: "5e",
        level: 12,
        hpMax: 87,
        hpCurrent: 87,
        characterData: { classes: [{ className: "Rogue", level: 12 }] },
      },
    });

    expect(payload.ruleset).toBe("5e");
  });

  it("normalizes legacy edition labels and defaults missing values to 5.5e", () => {
    expect(buildCharacterCreatePayload({ name: "Legacy", ruleset: "2014" }).ruleset).toBe("5e");
    expect(buildCharacterCreatePayload({ name: "Current", ruleset: "2024" }).ruleset).toBe("5.5e");
    expect(buildCharacterCreatePayload({ name: "Default" }).ruleset).toBe("5.5e");
  });

  it("uses the effective derived HP maximum for the imported character summary", () => {
    const payload = buildCharacterCreatePayload({
      format: "beholden.character",
      version: 1,
      character: {
        name: "Darius Blackmont",
        ruleset: "5e",
        level: 12,
        hpMax: 87,
        hpCurrent: 108,
        conScore: 15,
        characterData: {
          hd: 8,
          derivedHpMax: 111,
          classes: [{ className: "Rogue", level: 12 }],
        },
      },
    });

    expect(payload.hpCurrent).toBe(108);
    expect(payload.hpMax).toBe(111);
  });
});
