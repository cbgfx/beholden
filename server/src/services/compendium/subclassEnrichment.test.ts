// Regression checks for scripts/enrich-wotc-5e-subclasses.ps1 (5e subclass ownership
// reconstruction). Runs the real enrichment script against the real XML source and a temp
// copy of the tracked JSON -- never the tracked file itself -- and asserts on real output,
// so these catch regressions in the actual algorithm rather than a frozen snapshot.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Feature = { id?: string; name: string; subclass?: string };
type ClassLevel = { level: number; features?: Feature[]; spellSlots?: Record<string, number> };
type ClassEntry = {
  name: string;
  levels: ClassLevel[];
  spellcasting?: { ability?: string; list?: string };
  subclasses?: { level: number; options: Record<string, string | { name: string; spellcasting?: { ability?: string; contribution?: string; progression?: unknown[] } }> };
};
type GrandDoc = { classes: ClassEntry[] };

const repoRoot = path.resolve(import.meta.dirname, "../../../..");
const xmlPath = path.join(repoRoot, "compendium", "WotC_5e_only.xml");
const trackedJsonPath = path.join(repoRoot, "compendium", "WotC_5e_only.json");
const scriptPath = path.join(repoRoot, "scripts", "enrich-wotc-5e-subclasses.ps1");

let enriched: GrandDoc | null = null;

// compendium/WotC_5e_only.xml is gitignored (local source data, not tracked) -- it may not
// exist in every environment (fresh clone, CI). These tests skip gracefully rather than fail
// when it's absent, instead of breaking the main suite for anyone without this local file.
const xmlAvailable = fs.existsSync(xmlPath);

function loadEnrichedFixture(): GrandDoc {
  if (enriched) return enriched;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "subclass-enrich-test-"));
  const tempInput = path.join(tmpDir, "input.json");
  const tempOutput = path.join(tmpDir, "output.json");
  fs.copyFileSync(trackedJsonPath, tempInput);
  execFileSync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-File", scriptPath,
    "-XmlPath", xmlPath,
    "-JsonPath", tempInput,
    "-OutputPath", tempOutput,
    "-Repo2024Path", path.join(repoRoot, "compendium", "WotC_2024_only.json"),
  ], { stdio: "pipe", cwd: repoRoot });
  enriched = JSON.parse(fs.readFileSync(tempOutput, "utf8")) as GrandDoc;
  return enriched;
}

function getClass(doc: GrandDoc, name: string): ClassEntry {
  const cls = doc.classes.find((c) => c.name === name);
  assert.ok(cls, `expected class '${name}' in enriched output`);
  return cls;
}

function allFeatures(cls: ClassEntry): Feature[] {
  return cls.levels.flatMap((l) => l.features ?? []);
}

test("subclass enrichment: base Fighter (no subclass selected) excludes every subclass feature", { skip: xmlAvailable ? false : "compendium/WotC_5e_only.xml not present (local, gitignored source file)" }, () => {
  const doc = loadEnrichedFixture();
  const fighter = getClass(doc, "Fighter");
  const baseFeatures = allFeatures(fighter).filter((f) => !f.subclass);
  const leakedNames = baseFeatures
    .map((f) => f.name)
    .filter((name) => /champion|battle master|eldritch knight/i.test(name));
  assert.deepEqual(leakedNames, [], `base Fighter (no .subclass) must not include any Champion/Battle Master/Eldritch Knight feature, found: ${leakedNames.join(", ")}`);
});

test("subclass enrichment: a selected subclass (Champion) receives only its own features", { skip: xmlAvailable ? false : "compendium/WotC_5e_only.xml not present (local, gitignored source file)" }, () => {
  const doc = loadEnrichedFixture();
  const fighter = getClass(doc, "Fighter");
  assert.ok(fighter.subclasses?.options.sc_fighter_champion, "sc_fighter_champion must exist");
  const championFeatures = allFeatures(fighter).filter((f) => f.subclass === "sc_fighter_champion");
  assert.ok(championFeatures.length > 0, "Champion must have at least one tagged feature");
  const crossContamination = championFeatures.filter((f) => /battle master|eldritch knight|banneret|arcane archer|cavalier|samurai|psi warrior|rune knight/i.test(f.name));
  assert.deepEqual(crossContamination, [], `features tagged sc_fighter_champion must not include other subclasses' content, found: ${crossContamination.map((f) => f.name).join(", ")}`);
  // A character with Champion selected sees: base (untagged) + Champion-tagged features only.
  const applicableFeatures = allFeatures(fighter).filter((f) => !f.subclass || f.subclass === "sc_fighter_champion");
  const otherSubclassLeak = applicableFeatures.filter((f) => f.subclass && f.subclass !== "sc_fighter_champion");
  assert.deepEqual(otherSubclassLeak, []);
});

test("subclass enrichment: Fighter and Rogue base spellcasting/multiclass are untouched", { skip: xmlAvailable ? false : "compendium/WotC_5e_only.xml not present (local, gitignored source file)" }, () => {
  const doc = loadEnrichedFixture();
  for (const name of ["Fighter", "Rogue"]) {
    const cls = getClass(doc, name);
    assert.deepEqual(cls.spellcasting, { ability: "int" }, `${name}'s base spellcasting stub must be unchanged (no slot table added at the base-class level -- that belongs under subclasses.options[sc_id].spellcasting instead)`);
    const levelsWithSlots = cls.levels.filter((l) => l.spellSlots);
    assert.deepEqual(levelsWithSlots, [], `${name} base levels must carry no spellSlots (third-caster progression belongs to the subclass, not the base class)`);
  }
});

test("subclass enrichment: Eldritch Knight and Arcane Trickster expose third-caster progression", { skip: xmlAvailable ? false : "compendium/WotC_5e_only.xml not present (local, gitignored source file)" }, () => {
  const doc = loadEnrichedFixture();
  const fighter = getClass(doc, "Fighter");
  const rogue = getClass(doc, "Rogue");
  for (const [cls, scId] of [[fighter, "sc_fighter_eldritch_knight"], [rogue, "sc_rogue_arcane_trickster"]] as const) {
    const option = cls.subclasses?.options[scId];
    assert.ok(option && typeof option === "object", `${scId} must be the object form (name + spellcasting), not a bare string`);
    const spellcasting = (option as { spellcasting?: { ability?: string; contribution?: string; progression?: unknown[] } }).spellcasting;
    assert.ok(spellcasting, `${scId} must have a spellcasting block`);
    assert.equal(spellcasting!.contribution, "third", `${scId} must be tagged as a third-caster`);
    assert.equal(spellcasting!.ability, "int");
    assert.ok(Array.isArray(spellcasting!.progression) && spellcasting!.progression.length > 0, `${scId} must have a non-empty progression table`);
  }
});

test("subclass enrichment: two subclasses on a multiclass character stay independently scoped", { skip: xmlAvailable ? false : "compendium/WotC_5e_only.xml not present (local, gitignored source file)" }, () => {
  const doc = loadEnrichedFixture();
  const fighter = getClass(doc, "Fighter");
  const rogue = getClass(doc, "Rogue");
  // Simulates a Fighter(Eldritch Knight)/Rogue(Arcane Trickster) multiclass character: each
  // class's own subclasses.options map must not reference or contain the other class's
  // subclass ids, and their tagged feature sets must not overlap by id.
  const fighterScIds = new Set(Object.keys(fighter.subclasses?.options ?? {}));
  const rogueScIds = new Set(Object.keys(rogue.subclasses?.options ?? {}));
  const overlap = [...fighterScIds].filter((id) => rogueScIds.has(id));
  assert.deepEqual(overlap, [], "Fighter and Rogue must not share any subclass id");

  const fighterFeatureIds = new Set(allFeatures(fighter).map((f) => f.id).filter(Boolean));
  const rogueFeatureIds = new Set(allFeatures(rogue).map((f) => f.id).filter(Boolean));
  const featureOverlap = [...fighterFeatureIds].filter((id) => rogueFeatureIds.has(id));
  assert.deepEqual(featureOverlap, [], "Fighter and Rogue feature ids must not collide");

  const ekFeatures = allFeatures(fighter).filter((f) => f.subclass === "sc_fighter_eldritch_knight");
  const atFeatures = allFeatures(rogue).filter((f) => f.subclass === "sc_rogue_arcane_trickster");
  assert.ok(ekFeatures.length > 0 && atFeatures.length > 0);
  assert.deepEqual(ekFeatures.filter((f) => atFeatures.some((a) => a.name === f.name && a.id === f.id)), [], "Eldritch Knight and Arcane Trickster feature sets must not cross-contaminate");
});
