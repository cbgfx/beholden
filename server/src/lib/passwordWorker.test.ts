import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { hashPasswordAsync, verifyPasswordAsync } from "./jwtAuth.js";

test("password worker preserves existing hashes and associates concurrent replies correctly", async () => {
  const legacyHash = bcrypt.hashSync("existing-password", 10);
  const [matches, mismatch, generated] = await Promise.all([
    verifyPasswordAsync("existing-password", legacyHash),
    verifyPasswordAsync("wrong-password", legacyHash),
    hashPasswordAsync("new-password"),
  ]);
  assert.equal(matches, true);
  assert.equal(mismatch, false);
  assert.equal(bcrypt.getRounds(generated), 10);
  assert.equal(bcrypt.compareSync("new-password", generated), true);
  assert.equal(await verifyPasswordAsync("anything", "invalid-hash"), false);
});
