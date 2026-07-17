import assert from "node:assert/strict";
import test from "node:test";
import { hasZeroSpeedCondition, ZERO_SPEED_CONDITION_KEYS } from "@beholden/shared/domain/conditions";

// The rule is shared by every surface. Incapacitated is a separate condition effect and does not
// itself set Speed to 0 in the 2024 rules.

test("hasZeroSpeedCondition does not treat Incapacitated as speed-zeroing", () => {
  assert.equal(hasZeroSpeedCondition([{ key: "incapacitated" }]), false);
});

test("hasZeroSpeedCondition covers every condition the 2024 rules reduce Speed to 0 for", () => {
  for (const key of ["grappled", "restrained", "paralyzed", "petrified", "stunned", "unconscious"]) {
    assert.equal(hasZeroSpeedCondition([{ key }]), true, `expected "${key}" to zero speed`);
  }
});

test("hasZeroSpeedCondition is false for conditions that don't zero speed, including Slow and Rage", () => {
  assert.equal(hasZeroSpeedCondition([{ key: "slow" }]), false);
  assert.equal(hasZeroSpeedCondition([{ key: "rage" }]), false);
  assert.equal(hasZeroSpeedCondition([]), false);
  assert.equal(hasZeroSpeedCondition(null), false);
});

test("ZERO_SPEED_CONDITION_KEYS does not include Rage — it's class-specific, not a general condition rule", () => {
  assert.equal(ZERO_SPEED_CONDITION_KEYS.has("rage"), false);
});
