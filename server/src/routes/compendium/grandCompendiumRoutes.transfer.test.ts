import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import { CANONICAL_MONSTER, makeTestBatch, db, compendiumUploadDir, request, requestBuffer, uploadCompendium } from './grandCompendiumRoutes.fixtures.js';

describe("POST /api/compendium/native/preview", () => {
    it("stages a validated preview and imports it once without a second upload", async () => {
      const result = await uploadCompendium("/api/compendium/native/preview", JSON.stringify(makeTestBatch("monsters", [CANONICAL_MONSTER])));
      assert.equal(result.status, 200);
      const previewToken = String((result.body as { previewToken?: unknown }).previewToken ?? "");
      assert.match(previewToken, /^[0-9a-f-]{36}$/u);
      assert.equal(fs.readdirSync(compendiumUploadDir).length, 1);

      const imported = await request("POST", "/api/compendium/native/import-preview", { previewToken });
      assert.equal(imported.status, 200);
      assert.deepEqual(fs.readdirSync(compendiumUploadDir), []);

      const replay = await request("POST", "/api/compendium/native/import-preview", { previewToken });
      assert.equal(replay.status, 400);
    });

    it("deletes the disk-backed upload after invalid JSON", async () => {
      const result = await uploadCompendium("/api/compendium/native/preview", "{ definitely not json");
      assert.equal(result.status, 400);
      assert.deepEqual(fs.readdirSync(compendiumUploadDir), []);
    });

    it("deletes the disk-backed upload after schema validation fails", async () => {
      const invalid = { ...CANONICAL_MONSTER, name: "" };
      const result = await uploadCompendium("/api/compendium/native/preview", JSON.stringify(makeTestBatch("monsters", [invalid])));
      assert.equal(result.status, 400);
      assert.deepEqual(fs.readdirSync(compendiumUploadDir), []);
    });
  });


  describe("POST /api/compendium/native/import", () => {
    it("imports a disk-backed bundle and deletes the temporary upload", async () => {
      const entry = { ...CANONICAL_MONSTER, id: "m_disk_upload", name: "Disk Upload Monster" };
      const result = await uploadCompendium("/api/compendium/native/import", JSON.stringify(makeTestBatch("monsters", [entry])));
      assert.equal(result.status, 200);
      assert.deepEqual(fs.readdirSync(compendiumUploadDir), []);
      assert.equal((db.prepare("SELECT COUNT(*) AS n FROM compendium_monsters WHERE id = ?").get(entry.id) as { n: number }).n, 1);
    });
  });


  describe("GET /api/compendium/native/export-all.zip", () => {
    it("returns one ZIP containing a JSON file for every category", async () => {
      const response = await requestBuffer("/api/compendium/native/export-all.zip");
      assert.equal(response.status, 200);
      assert.equal(response.headers["content-type"], "application/zip");
      assert.match(
        String(response.headers["content-disposition"]),
        /filename=beholden-compendium-all\.zip/,
      );
      assert.equal(response.body.subarray(0, 2).toString("ascii"), "PK");
      for (const category of [
        "monsters",
        "items",
        "spells",
        "classTalents",
        "classes",
        "species",
        "backgrounds",
        "feats",
        "decks",
        "bastions",
      ]) {
        assert.ok(
          response.body.includes(Buffer.from(`beholden-compendium-${category}.json`)),
          `archive must contain the ${category} batch`,
        );
      }
    });
  });


  describe("GET /api/compendium/native/:category/export", () => {
    it("streams a valid native category document", async () => {
      const response = await requestBuffer("/api/compendium/native/monsters/export");
      assert.equal(response.status, 200);
      const document = JSON.parse(response.body.toString("utf8")) as { monsters?: Array<{ id?: string }> };
      assert.ok(document.monsters?.some((entry) => entry.id === CANONICAL_MONSTER.id));
    });
  });
