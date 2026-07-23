import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  cleanupExpiredCompendiumPreviews,
  consumeCompendiumPreview,
  stageCompendiumPreview,
  STAGED_PREVIEW_TTL_MS,
} from "./stagedCompendiumPreview.js";
import type { NativeCompendiumBatch } from "./nativeCompendium.js";

const batch: NativeCompendiumBatch = {
  format: "beholden.compendium",
  schema: "grand",
  category: "monsters",
  exportedAt: "2026-07-22T00:00:00.000Z",
  entries: [],
};

function withTempDirectory(run: (directory: string) => void): void {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-preview-stage-test-"));
  try { run(directory); }
  finally {
    for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name));
    fs.rmdirSync(directory);
  }
}

test("staged preview is consumed once and deleted even when import throws", () => withTempDirectory((directory) => {
  const upload = path.join(directory, "upload.tmp");
  fs.writeFileSync(upload, "original");
  const token = stageCompendiumPreview(directory, upload, [batch]);
  assert.equal(fs.readdirSync(directory).length, 1);
  assert.throws(() => consumeCompendiumPreview(directory, token, () => { throw new Error("import failed"); }), /import failed/u);
  assert.deepEqual(fs.readdirSync(directory), []);
  assert.throws(() => consumeCompendiumPreview(directory, token, () => null), /Invalid or expired/u);
}));

test("expired staged previews are removed", () => withTempDirectory((directory) => {
  const upload = path.join(directory, "upload.tmp");
  fs.writeFileSync(upload, "original");
  const token = stageCompendiumPreview(directory, upload, [batch]);
  const staged = path.join(directory, `${token}.preview.json`);
  const expired = new Date(Date.now() - STAGED_PREVIEW_TTL_MS - 1_000);
  fs.utimesSync(staged, expired, expired);
  cleanupExpiredCompendiumPreviews(directory);
  assert.deepEqual(fs.readdirSync(directory), []);
}));

test("invalid preview tokens cannot escape the staging directory", () => withTempDirectory((directory) => {
  assert.throws(() => consumeCompendiumPreview(directory, "../../outside", () => null), /Invalid or expired/u);
}));
