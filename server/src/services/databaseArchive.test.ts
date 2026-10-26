import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { zipSync, Zip, ZipDeflate } from "fflate";
import { extractDatabaseArchive, DATABASE_ARCHIVE_LIMITS } from "./databaseArchive.js";
function fixture(t: import("node:test").TestContext, bytes: Uint8Array) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-zip-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "archive.zip"); fs.writeFileSync(file, bytes); return file;
}
test("archive extracts accepted files to staging and ignores unwanted/path traversal entries", async t => {
  const file = fixture(t, zipSync({ "beholden.db": Buffer.from("database"), "campaign-images/one.webp": Buffer.from("portrait"), "campaign-images/../escape": Buffer.from("bad"), "unwanted.txt": Buffer.from("ignored") }));
  const extracted = await extractDatabaseArchive(file); t.after(extracted.dispose);
  assert.equal(fs.readFileSync(extracted.databasePath, "utf8"), "database");
  assert.deepEqual(extracted.images.map(image => image.relativePath), ["campaign-images/one.webp"]);
  const image = extracted.images[0]!; assert.ok("stagedPath" in image);
  assert.equal(fs.readFileSync(image.stagedPath, "utf8"), "portrait");
});
test("archive rejects too many entries and excessive declared entry/total sizes", async t => {
  const file = fixture(t, zipSync({ "beholden.db": new Uint8Array(100), "campaign-images/one.webp": new Uint8Array(100) }));
  await assert.rejects(() => extractDatabaseArchive(file, { ...DATABASE_ARCHIVE_LIMITS, entries: 1 }), /too many/);
  await assert.rejects(() => extractDatabaseArchive(file, { ...DATABASE_ARCHIVE_LIMITS, databaseBytes: 50 }), /size limit/);
  await assert.rejects(() => extractDatabaseArchive(file, { ...DATABASE_ARCHIVE_LIMITS, expandedBytes: 150 }), /expanded-size/);
});
test("streaming ZIPs with unknown declared sizes are limited by actual decompressed output", async t => {
  const chunks: Uint8Array[] = [];
  const zip = new Zip((error, bytes) => { if (error) throw error; chunks.push(bytes); });
  const entry = new ZipDeflate("beholden.db", { level: 9 }); zip.add(entry); entry.push(new Uint8Array(1024), true); zip.end();
  const file = fixture(t, Buffer.concat(chunks.map(chunk => Buffer.from(chunk))));
  await assert.rejects(() => extractDatabaseArchive(file, { ...DATABASE_ARCHIVE_LIMITS, databaseBytes: 100 }), /expanded-size/);
});
test("invalid, truncated and duplicate-entry archives are rejected", async t => {
  await assert.rejects(() => extractDatabaseArchive(fixture(t, Buffer.from("invalid"))), /invalid|incomplete/);
  const valid = zipSync({ "beholden.db": new Uint8Array(1000) });
  await assert.rejects(() => extractDatabaseArchive(fixture(t, valid.subarray(0, 40))), /incomplete|invalid/);
  const chunks: Uint8Array[] = []; const zip = new Zip((error, bytes) => { if (error) throw error; chunks.push(bytes); });
  for (let i = 0; i < 2; i++) { const entry = new ZipDeflate("beholden.db"); zip.add(entry); entry.push(Buffer.from("data"), true); } zip.end();
  await assert.rejects(() => extractDatabaseArchive(fixture(t, Buffer.concat(chunks.map(chunk => Buffer.from(chunk))))), /duplicate/);
});

test("cancelled extraction rejects and releases its staging work", async t => {
  const file = fixture(t, zipSync({ "beholden.db": new Uint8Array(100_000) }));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => extractDatabaseArchive(file, undefined, controller.signal), /invalid|incomplete|cancelled/);
});
