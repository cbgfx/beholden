import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalIdMap, canonicalizeCompendiumId } from "./canonicalCompendiumId.js";

test("canonicalizeCompendiumId removes database-hostile punctuation deterministically", () => {
  assert.equal(canonicalizeCompendiumId("i_clothes,_traveler's"), "i_clothes_travelers");
  assert.equal(canonicalizeCompendiumId("i_arrow_+1"), "i_arrow_plus_1");
  assert.equal(canonicalizeCompendiumId("i_spell_scroll_(level_1)"), "i_spell_scroll_level_1");
});

test("buildCanonicalIdMap rejects collisions", () => {
  assert.throws(
    () => buildCanonicalIdMap(["i_test-item", "i_test_item"]),
    /collision/i,
  );
});
