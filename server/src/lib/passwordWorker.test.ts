import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { hashPasswordAsync, verifyPasswordAsync } from "./jwtAuth.js";

test("password worker preserves hashes, concurrent replies, and restarts after idle release", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
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
  // Release the idle worker, then immediately dispatch while its exit event may
  // still be pending. The old worker must not clear or reject the new one's work.
  t.mock.timers.tick(30_000);
  assert.equal(await verifyPasswordAsync("existing-password", legacyHash), true);
  t.mock.timers.tick(30_000);
});
