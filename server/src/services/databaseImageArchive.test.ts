import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  existingImageDirectories,
  isDatabaseZipUpload,
  selectImageEntries,
  writeImageEntries,
} from "./databaseImageArchive.js";

test("existingImageDirectories only returns known image directories that actually exist on disk", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-image-archive-test-"));
  try {
    fs.mkdirSync(path.join(tmpDir, "campaign-images"));
    fs.mkdirSync(path.join(tmpDir, "some-other-directory"));

    const result = existingImageDirectories(tmpDir);

    assert.deepEqual(result.map((entry) => entry.name), ["campaign-images"]);
    assert.equal(result[0]?.absolutePath, path.join(tmpDir, "campaign-images"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("isDatabaseZipUpload detects a zip by mimetype or filename extension", () => {
  assert.equal(isDatabaseZipUpload({ mimetype: "application/zip", originalname: "export.dat" }), true);
  assert.equal(isDatabaseZipUpload({ mimetype: "application/octet-stream", originalname: "beholden-2026-08-04.zip" }), true);
  assert.equal(isDatabaseZipUpload({ mimetype: "application/octet-stream", originalname: "beholden.db" }), false);
});

test("selectImageEntries keeps only files under a known image directory, ignoring beholden.db and directory markers", () => {
  const entries = {
    "beholden.db": new Uint8Array([1]),
    "campaign-images/banner.webp": new Uint8Array([2]),
    "campaign-images/": new Uint8Array([]),
    "binder-mortal-images/npc.png": new Uint8Array([3]),
    "not-an-image-dir/file.txt": new Uint8Array([4]),
  };

  const result = selectImageEntries(entries);

  assert.deepEqual(
    result.map((entry) => entry.relativePath).sort(),
    ["binder-mortal-images/npc.png", "campaign-images/banner.webp"],
  );
});

test("writeImageEntries writes each entry to its matching path under dataDir, creating directories as needed", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-image-archive-test-"));
  try {
    writeImageEntries(tmpDir, [
      { relativePath: "campaign-images/banner.webp", bytes: new Uint8Array([1, 2, 3]) },
      { relativePath: "binder-mortal-images/npc.png", bytes: new Uint8Array([4, 5]) },
    ]);

    assert.deepEqual(
      Array.from(fs.readFileSync(path.join(tmpDir, "campaign-images", "banner.webp"))),
      [1, 2, 3],
    );
    assert.deepEqual(
      Array.from(fs.readFileSync(path.join(tmpDir, "binder-mortal-images", "npc.png"))),
      [4, 5],
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("writeImageEntries refuses to write outside dataDir", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-image-archive-test-"));
  try {
    writeImageEntries(tmpDir, [
      { relativePath: "../escaped.webp", bytes: new Uint8Array([9]) },
    ]);

    assert.equal(fs.existsSync(path.join(tmpDir, "..", "escaped.webp")), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("an image entry cannot climb out of its image directory onto the database or the signing secret", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-image-archive-test-"));
  try {
    fs.writeFileSync(path.join(tmpDir, "beholden.db"), "live database");
    fs.writeFileSync(path.join(tmpDir, "jwt-secret"), "secret");
    // These pass selectImageEntries - they start with a known image directory - and resolve inside
    // dataDir, so a check against dataDir alone let them overwrite the live files.
    writeImageEntries(tmpDir, selectImageEntries({
      "campaign-images/../beholden.db": new Uint8Array([1]),
      "player-images/../jwt-secret": new Uint8Array([2]),
      "character-images/../../outside.webp": new Uint8Array([3]),
      "campaign-images/kept.webp": new Uint8Array([4]),
    }));

    assert.equal(fs.readFileSync(path.join(tmpDir, "beholden.db"), "utf8"), "live database");
    assert.equal(fs.readFileSync(path.join(tmpDir, "jwt-secret"), "utf8"), "secret");
    assert.equal(fs.existsSync(path.join(tmpDir, "..", "outside.webp")), false);
    assert.deepEqual(Array.from(fs.readFileSync(path.join(tmpDir, "campaign-images", "kept.webp"))), [4]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
