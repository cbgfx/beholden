import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadEnvironment } from "./environment.js";

test("environment loading finds the nearest file and preserves injected values by default", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "beholden-env-"));
  try {
    const cwd = path.join(root, "server", "nested");
    mkdirSync(cwd, { recursive: true });
    writeFileSync(path.join(root, ".env"), "VALUE=root\nROOT_ONLY=yes\n");
    writeFileSync(path.join(root, "server", ".env"), 'VALUE=local\nEMPTY=replaced\nexport QUOTED="hello # world"\nMULTILINE="first\nsecond"\n');
    const env: NodeJS.ProcessEnv = { VALUE: "injected", EMPTY: "" };
    loadEnvironment({ cwd, env });
    assert.equal(env.VALUE, "injected");
    assert.equal(env.EMPTY, "");
    assert.equal(env.ROOT_ONLY, undefined);
    assert.equal(env.QUOTED, "hello # world");
    assert.equal(env.MULTILINE, "first\nsecond");
    loadEnvironment({ cwd, env, override: true });
    assert.equal(env.VALUE, "local");
    assert.equal(env.EMPTY, "replaced");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a missing environment file is optional", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "beholden-env-"));
  try {
    const cwd = path.join(root, "a", "b", "c");
    mkdirSync(cwd, { recursive: true });
    const env = { VALUE: "injected" };
    loadEnvironment({ cwd, env });
    assert.deepEqual(env, { VALUE: "injected" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
