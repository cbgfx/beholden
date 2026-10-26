import assert from "node:assert/strict";
import { test } from "node:test";
import { averageHitPointFormula, compendiumMonsterMechanics } from "../services/binders/mortals.js";

test("formula-only monster HP hydrates to its expected average instead of its dice count", () => {
  assert.equal(averageHitPointFormula("13d10+52"), 123);
  assert.equal(averageHitPointFormula("2d8 - 2"), 7);
  assert.equal(averageHitPointFormula("not dice"), null);
  assert.deepEqual(
    compendiumMonsterMechanics(JSON.stringify({ hitPoints: { formula: "13d10+52" }, armorClass: { value: 17 } })),
    { hpMax: 123, hpDetails: "13d10+52", ac: 17, acDetails: null },
  );
});
