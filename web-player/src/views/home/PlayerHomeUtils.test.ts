import { describe, expect, it } from "vitest";
import { CHARACTER_EXPORT_VERSION, buildCharacterCreatePayload, buildExportFilename, normalizeCharacterTransfer } from "./PlayerHomeUtils";
import { buildCharacterExportV2 } from "@beholden/shared/domain/characterExport";

const completeV2Character = (overrides: Record<string, unknown> = {}) => ({
  name: "Darius Blackmont",
  playerName: "Darius",
  ruleset: "5e" as const,
  className: "Rogue",
  species: "Human",
  level: 12,
  hpMax: 87,
  hpCurrent: 87,
  ac: 16,
  speed: 30,
  strScore: 10,
  dexScore: 18,
  conScore: 15,
  intScore: 12,
  wisScore: 11,
  chaScore: 14,
  color: null,
  characterData: { hd: 8, classes: [{ className: "Rogue", level: 12 }] },
  isActive: true,
  ...overrides,
});

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

it("exports the live-state-preserving character format version", () => {
  expect(CHARACTER_EXPORT_VERSION).toBe(2);
});

describe("buildCharacterCreatePayload", () => {
  it("rejects unknown wrapped formats and future versions", () => {
    expect(() => buildCharacterCreatePayload({ format: "other.character", version: 2, character: { name: "Nope" } })).toThrow(/format/i);
    expect(() => buildCharacterCreatePayload({ format: "beholden.character", version: 99, character: { name: "Future" } })).toThrow(/version/i);
  });

  it("strictly validates v2 documents instead of coercing malformed sheet values", () => {
    const document = buildCharacterExportV2(completeV2Character());
    expect(buildCharacterCreatePayload(document).level).toBe(12);
    expect(() => buildCharacterCreatePayload({
      ...document,
      character: { ...document.character, level: "12" },
    })).toThrow(/character\.level/i);
  });

  it("exports only portable fields from the character API DTO", () => {
    const document = buildCharacterExportV2({
      ...completeV2Character(),
      id: "installation-local-id",
      userId: "account-id",
      campaigns: [{ campaignId: "campaign-id" }],
      imageUrl: "/character-images/local.webp",
      inventoryRev: "revision",
      createdAt: 1,
      updatedAt: 2,
    });
    expect(document.character).not.toHaveProperty("id");
    expect(document.character).not.toHaveProperty("userId");
    expect(document.character).not.toHaveProperty("campaigns");
    expect(document.character).not.toHaveProperty("imageUrl");
    expect(document.character).not.toHaveProperty("inventoryRev");
    expect(document.character).not.toHaveProperty("createdAt");
    expect(document.character).not.toHaveProperty("updatedAt");
  });

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

  it("restores portable live state from a v1 export", () => {
    const payload = buildCharacterCreatePayload({
      format: "beholden.character",
      version: 1,
      character: {
        name: "Darius Blackmont",
        ruleset: "5e",
        conditions: [{ key: "poisoned" }],
        overrides: { tempHp: 7, acBonus: 1, hpMaxBonus: 2, inspiration: true },
        deathSaves: { success: 2, fail: 1 },
        sharedNotes: "Remember the silver key.",
        isActive: false,
      },
    });

    expect(payload.conditions).toEqual([{ key: "poisoned" }]);
    expect(payload.overrides).toEqual({ tempHp: 7, acBonus: 1, hpMaxBonus: 2, inspiration: true });
    expect(payload.deathSaves).toEqual({ success: 2, fail: 1 });
    expect(payload.sharedNotes).toBe("Remember the silver key.");
    expect(payload.isActive).toBe(false);
  });

  it("normalizes legacy edition labels and defaults missing values to 5.5e", () => {
    expect(buildCharacterCreatePayload({ name: "Legacy", ruleset: "2014" }).ruleset).toBe("5e");
    expect(buildCharacterCreatePayload({ name: "Current", ruleset: "2024" }).ruleset).toBe("5.5e");
    expect(buildCharacterCreatePayload({ name: "Default" }).ruleset).toBe("5.5e");
  });

  it("preserves base HP while allowing current HP up to the derived maximum", () => {
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
    expect(payload.hpMax).toBe(87);
  });

  it("does not fold a Tough-style derived bonus into base HP on repeated transfers", () => {
    const exported = {
      name: "Darius Blackmont",
      ruleset: "5e",
      level: 12,
      hpMax: 87,
      hpCurrent: 111,
      conScore: 15,
      characterData: {
        hd: 8,
        derivedHpMax: 111,
        extraFeatIds: ["f_tough"],
        classes: [{ className: "Rogue", level: 12 }],
      },
    };

    const once = normalizeCharacterTransfer(exported);
    const twice = normalizeCharacterTransfer(once);

    expect(once.hpMax).toBe(87);
    expect(once.hpCurrent).toBe(111);
    expect(twice.hpMax).toBe(87);
    expect(twice.hpCurrent).toBe(111);
  });

  it("keeps the worked-out maximum an export carries beside the character", () => {
    // Since the worked-out stats moved into their own columns, an export carries them at the top
    // level. Reading only the character's data clamped an imported character down to its base HP.
    const payload = buildCharacterCreatePayload({
      format: "beholden.character",
      version: 2,
      exportedAt: "2026-09-28T00:00:00.000Z",
      character: completeV2Character({
        hpCurrent: 111,
        derivedHpMax: 111,
        derivedSpeed: 35,
      }),
    });

    expect(payload.hpMax).toBe(87);
    expect(payload.hpCurrent).toBe(111);
    expect((payload.characterData as Record<string, unknown>).derivedHpMax).toBe(111);
    expect((payload.characterData as Record<string, unknown>).derivedSpeed).toBe(35);
  });

  it("repairs v1 exports that promoted derived HP into base HP", () => {
    const payload = buildCharacterCreatePayload({
      format: "beholden.character",
      version: 1,
      character: {
        name: "Darius Blackmont",
        ruleset: "5e",
        level: 12,
        hpMax: 111,
        hpCurrent: 111,
        conScore: 15,
        characterData: {
          hd: 8,
          derivedHpMax: 111,
          extraFeatIds: ["f_tough"],
          classes: [{ className: "Rogue", level: 12 }],
        },
      },
    });

    expect(payload.hpMax).toBe(87);
    expect(payload.hpCurrent).toBe(111);
  });
});
