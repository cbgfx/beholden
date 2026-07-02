/**
 * Corpus preservation test for the WotC 2024 feat source file.
 *
 * Invariants:
 *  - Every feat declared in the XML must survive the XML→v2 conversion with
 *    its original name, description, prerequisite, and modifiers intact.
 *  - The number of source feats that remain fully prose-only (no structured
 *    mechanics) is tracked explicitly.  If that count rises unexpectedly the
 *    test fails, forcing a deliberate decision to either add a parser rule or
 *    extend the allowlist below.
 *
 * Note: the conversion also produces additional feat entries derived from
 * background trait embeds (e.g. "Alert" from a "Feat: Alert" background
 * trait).  These extra entries are not source feats and are ignored here.
 *
 * Run condition: the file at CORPUS_PATH must exist.  The suite skips
 * silently when run in environments (e.g., CI) that do not ship the corpus.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it, before } from "node:test";
import { XMLParser } from "fast-xml-parser";
import { convertCompendiumXmlToNative } from "./convertXmlToNative.js";

// ── Paths ─────────────────────────────────────────────────────────────────────

const CORPUS_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
  "../../../../compendium/WotC_2024_only.xml",
);

// ── Prose-only allowlist ──────────────────────────────────────────────────────
//
// All previously prose-only feats now have structured mechanics via
// parseFeatStructuredEffects() in featParser.ts:
//   - Fighting Styles: typed ModifierEffect / ActionEffect / AttackEffect entries
//   - Alert / Tough: proficiency_grant (initiative) and hit_points entries
//   - Bespoke origin feats (Healer, Savage Attacker, Vampire Hunter, etc.) and
//     Dragonmark, Potent: NarrativeEffect { category: "manual_resolution" }
//
// Add to this set ONLY when a NEW feat cannot be expressed by any existing or
// narrative mechanic shape. Do NOT raise EXPECTED_PROSE_ONLY_COUNT without
// listing the new entry here and explaining why narrative is also inappropriate.

const INTENTIONAL_PROSE_ONLY = new Set<string>([]);

const EXPECTED_PROSE_ONLY_COUNT = 0;

const REVIEWED_AUTOMATIC_FEATS = new Set([
  "Ability Score Improvement",
  "Fighting Style: Archery",
  "Fighting Style: Blessed Warrior",
  "Fighting Style: Blind Fighting",
  "Fighting Style: Defense",
  "Fighting Style: Dueling",
  "Fighting Style: Thrown Weapon Fighting",
  "Fighting Style: Two-Weapon Fighting",
  "Origin: Tough",
]);

const MANUAL_FEATS = new Set([
  "Dragonmark, Potent",
  "Fighting Style: Great Weapon Fighting",
  "Fighting Style: Interception",
  "Fighting Style: Protection",
  "Origin: Healer",
  "Origin: Lords' Alliance Agent",
  "Origin: Savage Attacker",
  "Origin: Tyro of the Gauntlet",
  "Origin: Vampire Hunter",
  "Origin: Zhentarim Ruffian",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

type JsonRecord = Record<string, unknown>;

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function rec(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

/** Returns true when the feat's parsed mechanics carry no structured data. */
function isProseOnly(feat: JsonRecord): boolean {
  const m = rec(feat.mechanics);
  if (list(m.choices).length > 0) return false;
  if (list(m.uses).length > 0) return false;
  if (list(m.preparedSpellProgression).length > 0) return false;
  const g = rec(m.grants);
  for (const key of Object.keys(g)) {
    const v = g[key];
    if (Array.isArray(v) && v.length > 0) return false;
    if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0) return false;
  }
  return true;
}

// ── Parse source XML ──────────────────────────────────────────────────────────

interface SourceFeat {
  name: string;
  text: string;
  prerequisite: string | null;
  hasModifiers: boolean;
}

function parseXmlFeats(xml: string): Map<string, SourceFeat> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => ["feat", "modifier"].includes(name),
  });
  const doc = parser.parse(xml) as JsonRecord;
  const rawFeats = list((doc.compendium as JsonRecord | undefined)?.feat);
  const map = new Map<string, SourceFeat>();
  for (const raw of rawFeats) {
    const feat = rec(raw as JsonRecord);
    const name = String(feat.name ?? "").trim();
    if (name) {
      map.set(name, {
        name,
        text: String(feat.text ?? "").trim(),
        prerequisite: feat.prerequisite != null ? String(feat.prerequisite).trim() : null,
        hasModifiers: list(feat.modifier).length > 0,
      });
    }
  }
  return map;
}

// ── Test suite ────────────────────────────────────────────────────────────────

const corpusAvailable = fs.existsSync(CORPUS_PATH);

describe("WotC 2024 feat corpus – preservation", { skip: !corpusAvailable }, () => {
  let sourceMap: Map<string, SourceFeat>;
  let convertedByName: Map<string, JsonRecord>;

  before(() => {
    const xml = fs.readFileSync(CORPUS_PATH, "utf-8");
    sourceMap = parseXmlFeats(xml);
    const bundle = convertCompendiumXmlToNative(xml);
    const batch = bundle.batches.find((b) => b.category === "feats");
    const allConverted = (batch?.entries ?? []) as JsonRecord[];
    // Build a name→entry map; prefer entries whose names match a source name exactly.
    // (Background-embedded feats may share a base name with a source feat —
    //  source feats appear first in the XML and take precedence in the map.)
    convertedByName = new Map();
    for (const feat of allConverted) {
      const name = String(feat.name ?? "");
      if (!convertedByName.has(name)) convertedByName.set(name, feat);
    }
  });

  it("source XML contains exactly 239 feats", () => {
    assert.equal(sourceMap.size, 239);
  });

  it("every source feat name appears in the converted output", () => {
    const missing: string[] = [];
    for (const name of sourceMap.keys()) {
      if (!convertedByName.has(name)) missing.push(name);
    }
    assert.deepEqual(missing, [], `Source feats lost during conversion: ${missing.join(", ")}`);
  });

  it("every converted feat has a non-empty id, name, and description", () => {
    // Only check source feats (by name match)
    for (const name of sourceMap.keys()) {
      const feat = convertedByName.get(name);
      if (!feat) continue;
      assert.ok(feat.id && typeof feat.id === "string" && feat.id.length > 0, `Feat "${name}" missing id`);
      assert.ok(typeof feat.description === "string" && feat.description.length > 0, `Feat "${name}" has empty description`);
    }
  });

  it("every source feat description is preserved in the converted output", () => {
    for (const [name, source] of sourceMap) {
      const feat = convertedByName.get(name);
      if (!feat) continue;
      const desc = String(feat.description ?? "");
      const expected = source.text.replace(/(?:^|\n)Source:\s*[^\n]+\s*$/iu, "").trim();
      assert.equal(
        desc.trim(),
        expected,
        `Description mismatch for "${name}"\n  Expected: ${expected.substring(0, 80)}\n  Got:      ${desc.substring(0, 80)}`,
      );
    }
  });

  it("every source feat prerequisite is preserved in the converted output", () => {
    for (const [name, source] of sourceMap) {
      const feat = convertedByName.get(name);
      if (!feat) continue;
      const actual = feat.prerequisite ?? null;
      assert.equal(
        actual,
        source.prerequisite,
        `Prerequisite mismatch for "${name}": expected ${JSON.stringify(source.prerequisite)}, got ${JSON.stringify(actual)}`,
      );
    }
  });

  it("every source feat that has XML modifiers also has non-empty modifiers in the converted output", () => {
    for (const [name, source] of sourceMap) {
      if (!source.hasModifiers) continue;
      const feat = convertedByName.get(name);
      assert.ok(feat, `Feat "${name}" (has XML modifiers) is missing from converted output`);
      const mechanics = feat!.mechanics as Record<string, unknown> | null | undefined;
      const mods = list(mechanics?.modifierDetails);
      assert.ok(mods.length > 0, `Feat "${name}" should have non-empty modifierDetails in mechanics but got none`);
    }
  });

  it("every converted source feat has a 'mechanics' object", () => {
    for (const name of sourceMap.keys()) {
      const feat = convertedByName.get(name);
      if (!feat) continue;
      assert.ok(
        feat.mechanics && typeof feat.mechanics === "object",
        `Feat "${name}" is missing the mechanics object`,
      );
    }
  });

  it("covers the complete Fighting Style corpus with explicit contracts", () => {
    const expectedNames = [
      "Fighting Style: Archery",
      "Fighting Style: Blessed Warrior",
      "Fighting Style: Blind Fighting",
      "Fighting Style: Defense",
      "Fighting Style: Dueling",
      "Fighting Style: Great Weapon Fighting",
      "Fighting Style: Interception",
      "Fighting Style: Protection",
      "Fighting Style: Thrown Weapon Fighting",
      "Fighting Style: Two-Weapon Fighting",
      "Fighting Style: Unarmed Fighting",
    ];
    const actualNames = [...sourceMap.keys()]
      .filter((name) => name.startsWith("Fighting Style:"))
      .sort();
    assert.deepEqual(actualNames, expectedNames, "Fighting Style corpus changed; update the contract tests deliberately");

    const effectFor = (name: string): JsonRecord => {
      const feat = convertedByName.get(name);
      assert.ok(feat, `${name} must survive conversion`);
      const effect = list(rec(rec(rec(feat).mechanics).grants).effects).map(rec)[0];
      assert.ok(effect, `${name} must have a structured effect`);
      return effect;
    };
    const grantsFor = (name: string) => rec(rec(convertedByName.get(name)!).mechanics).grants;

    const automaticContracts = [
      ["Fighting Style: Archery", "modifier", "bonus", "attack_roll"],
      ["Fighting Style: Blind Fighting", "senses", "grant", null],
      ["Fighting Style: Defense", "armor_class", "bonus", null],
      ["Fighting Style: Dueling", "modifier", "bonus", "damage_roll"],
      ["Fighting Style: Thrown Weapon Fighting", "modifier", "bonus", "damage_roll"],
      ["Fighting Style: Two-Weapon Fighting", "attack", "add_ability_to_damage", null],
    ] as const;
    for (const [name, type, mode, target] of automaticContracts) {
      const effect = effectFor(name);
      assert.equal(effect.type, type, `${name} effect type`);
      assert.equal(effect.mode, mode, `${name} effect mode`);
      assert.equal(effect.target ?? null, target, `${name} effect target`);
      assert.equal(effect.resolution, "automatic", `${name} must be explicitly automatic`);
    }

    for (const name of [
      "Fighting Style: Great Weapon Fighting",
      "Fighting Style: Interception",
      "Fighting Style: Protection",
    ]) {
      assert.equal(effectFor(name).resolution, "manual", `${name} must remain explicitly manual`);
    }

    const blessed = rec(convertedByName.get("Fighting Style: Blessed Warrior"));
    const blessedMechanics = rec(blessed.mechanics);
    const blessedChoice = list(blessedMechanics.choices).map(rec)[0];
    assert.ok(blessedChoice, "Blessed Warrior must expose its cantrip choice");
    assert.equal(blessedChoice.type, "spell");
    assert.equal(blessedChoice.count, 2);
    assert.equal(blessedChoice.level, 0);
    assert.deepEqual(blessedChoice.options, ["Cleric"]);
    assert.equal(blessedMechanics.spellcastingAbility, "cha");
    assert.equal(list(rec(grantsFor("Fighting Style: Blessed Warrior")).effects).length, 0);

    const unarmedEffects = list(rec(grantsFor("Fighting Style: Unarmed Fighting")).effects).map(rec);
    assert.equal(unarmedEffects.length, 2);
    assert.equal(unarmedEffects[0]?.type, "attack");
    assert.equal(unarmedEffects[0]?.mode, "damage_die_override");
    assert.equal(unarmedEffects[0]?.resolution, "automatic");
    assert.deepEqual(unarmedEffects[0]?.amount, { kind: "fixed", dice: "1d6" });
    assert.deepEqual(unarmedEffects[0]?.alternateAmount, { kind: "fixed", dice: "1d8" });
    assert.equal(unarmedEffects[0]?.alternateWhen, "no_weapon_or_shield");
    assert.equal(unarmedEffects[1]?.type, "narrative");
    assert.equal(unarmedEffects[1]?.category, "manual_resolution");
    assert.equal(unarmedEffects[1]?.resolution, "manual");
  });

  it("classifies every source feat under the conservative resolution policy", () => {
    const missingReviewedNames = [...REVIEWED_AUTOMATIC_FEATS, ...MANUAL_FEATS]
      .filter((name) => !sourceMap.has(name));
    assert.deepEqual(
      missingReviewedNames,
      [],
      "The reviewed feat lists contain names that are absent from the source corpus",
    );

    const counts = { automatic: 0, manual: 0, mixed: 0 };
    for (const name of sourceMap.keys()) {
      const feat = convertedByName.get(name);
      assert.ok(feat, `${name} must survive conversion`);
      const mechanics = rec(feat.mechanics);
      const expected = REVIEWED_AUTOMATIC_FEATS.has(name)
        ? "automatic"
        : MANUAL_FEATS.has(name)
          ? "manual"
          : "mixed";

      assert.equal(feat.resolution, expected, `${name} root resolution`);
      assert.equal(
        mechanics.resolution,
        undefined,
        `${name} must not duplicate root resolution inside mechanics`,
      );
      const notes = list(feat.resolutionNotes);
      assert.deepEqual(
        list(mechanics.resolutionNotes),
        [],
        `${name} must not duplicate root resolution notes inside mechanics`,
      );
      if (expected === "automatic") {
        assert.deepEqual(notes, [], `${name} should not carry manual-resolution notes`);
      }
      counts[expected] += 1;
    }

    assert.deepEqual(counts, { automatic: 9, manual: 10, mixed: 220 });
  });

  it(`prose-only source feat count equals ${EXPECTED_PROSE_ONLY_COUNT} (the allowlist)`, () => {
    // Only count source feats (ignore background-embedded extras)
    const sourceFeatEntries = [...sourceMap.keys()]
      .map((name) => convertedByName.get(name))
      .filter((f): f is JsonRecord => f != null);

    const proseOnlyFeats = sourceFeatEntries.filter(isProseOnly);
    const proseOnlyNames = proseOnlyFeats.map((f) => String(f.name)).sort();

    // Every detected prose-only feat must be in the allowlist
    const unexpected = proseOnlyNames.filter((n) => !INTENTIONAL_PROSE_ONLY.has(n));
    assert.deepEqual(
      unexpected,
      [],
      `These source feats are prose-only but not in the allowlist — either add a parser rule or extend the allowlist:\n  ${unexpected.join("\n  ")}`,
    );

    // Allowlist entries that now have structured mechanics: the allowlist needs trimming
    const nowStructured = [...INTENTIONAL_PROSE_ONLY].filter((n) => !proseOnlyNames.includes(n));
    assert.deepEqual(
      nowStructured,
      [],
      `These allowlisted feats now have structured mechanics — remove them from INTENTIONAL_PROSE_ONLY:\n  ${nowStructured.join("\n  ")}`,
    );

    assert.equal(
      proseOnlyFeats.length,
      EXPECTED_PROSE_ONLY_COUNT,
      `Expected exactly ${EXPECTED_PROSE_ONLY_COUNT} prose-only source feats but found ${proseOnlyFeats.length}:\n  ${proseOnlyNames.join("\n  ")}`,
    );
  });
});
