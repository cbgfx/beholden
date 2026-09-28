import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { openDb, type Db } from "../../lib/db.js";
import { reclaimableBytes, runStartupMaintenance } from "./startupMaintenance.js";

function withServerData(run: (db: Db, dataDir: string) => void): void {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-maintenance-"));
  const db = openDb(path.join(dataDir, "beholden.db"));
  try {
    run(db, dataDir);
  } finally {
    db.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

function withEnv<T>(values: Record<string, string | undefined>, run: () => T): T {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
    return run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function writeImage(dataDir: string, relativePath: string, bytes = 1024): void {
  const absolute = path.join(dataDir, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, Buffer.alloc(bytes, 1));
}

/** Leaves free pages behind so there is something for VACUUM to reclaim. */
function makeFreeSpace(db: Db): void {
  db.exec("CREATE TABLE IF NOT EXISTS junk (id INTEGER PRIMARY KEY, blob BLOB)");
  const insert = db.prepare("INSERT INTO junk (blob) VALUES (?)");
  for (let index = 0; index < 400; index += 1) insert.run(Buffer.alloc(16 * 1024, index % 255));
  db.exec("DELETE FROM junk");
}

test("deletes image files no row points at any more", () => {
  withServerData((db, dataDir) => {
    const now = Date.now();
    db.prepare("INSERT INTO campaigns (id, name, image_url, created_at, updated_at) VALUES ('c1', 'Camp', '/campaign-images/c1.webp', ?, ?)").run(now, now);
    writeImage(dataDir, "campaign-images/c1.webp");
    writeImage(dataDir, "character-images/gone.webp", 2048);

    // A threshold above anything a fresh database has free keeps this case about images only.
    const summary = withEnv({ BEHOLDEN_STARTUP_VACUUM_MIN_MB: "4096" }, () =>
      runStartupMaintenance(db, dataDir, () => {}));
    assert.equal(summary.ran, true);
    assert.equal(summary.orphanImagesDeleted, 1);
    assert.equal(summary.orphanImageBytes, 2048);
    assert.ok(fs.existsSync(path.join(dataDir, "campaign-images/c1.webp")), "referenced images stay");
    assert.ok(!fs.existsSync(path.join(dataDir, "character-images/gone.webp")), "orphans go");
  });
});

test("compacts the database only once enough space is free to be worth it", () => {
  withServerData((db, dataDir) => {
    makeFreeSpace(db);
    const before = reclaimableBytes(db);
    assert.ok(before > 0, "the fixture should leave free pages behind");

    // A threshold far above what is free: report it, but do not rewrite the file.
    const skipped = withEnv({ BEHOLDEN_STARTUP_VACUUM_MIN_MB: "4096" }, () =>
      runStartupMaintenance(db, dataDir, () => {}));
    assert.equal(skipped.vacuumed, false);
    assert.equal(reclaimableBytes(db), before, "nothing was reclaimed");

    const compacted = withEnv({ BEHOLDEN_STARTUP_VACUUM_MIN_MB: "0" }, () =>
      runStartupMaintenance(db, dataDir, () => {}));
    assert.equal(compacted.vacuumed, true);
    assert.ok(reclaimableBytes(db) < before, "the free pages were handed back");
  });
});

test("clears out the dead character-banners directory once it is empty", () => {
  withServerData((db, dataDir) => {
    const banners = path.join(dataDir, "character-banners");
    fs.mkdirSync(banners, { recursive: true });

    const summary = withEnv({ BEHOLDEN_STARTUP_VACUUM_MIN_MB: "4096" }, () =>
      runStartupMaintenance(db, dataDir, () => {}));
    assert.deepEqual(summary.legacyDirectoriesRemoved, ["character-banners"]);
    assert.ok(!fs.existsSync(banners));

    // Anything still in there is somebody's file; leave the directory alone.
    fs.mkdirSync(banners, { recursive: true });
    fs.writeFileSync(path.join(banners, "keep-me.webp"), "bytes");
    const second = withEnv({ BEHOLDEN_STARTUP_VACUUM_MIN_MB: "4096" }, () =>
      runStartupMaintenance(db, dataDir, () => {}));
    assert.deepEqual(second.legacyDirectoriesRemoved, []);
    assert.ok(fs.existsSync(path.join(banners, "keep-me.webp")));
  });
});

test("skips everything when BEHOLDEN_STARTUP_MAINTENANCE is off", () => {
  withServerData((db, dataDir) => {
    writeImage(dataDir, "character-images/gone.webp");
    const summary = withEnv({ BEHOLDEN_STARTUP_MAINTENANCE: "off" }, () =>
      runStartupMaintenance(db, dataDir, () => {}));
    assert.equal(summary.ran, false);
    assert.equal(summary.orphanImagesDeleted, 0);
    assert.ok(fs.existsSync(path.join(dataDir, "character-images/gone.webp")), "files are left alone");
  });
});
