/**
 * Players create their own items with the same editor the DM uses, but a player's item belongs in
 * their inventory, not in the compendium everyone browses - and only a DM may write the compendium.
 * So the editor could not save anything for a player at all: every item, weapons included, was
 * refused. The preview route builds the item exactly as the compendium would and writes nothing.
 *
 * Payloads here come from the editor's own `buildItemPayload`, so these tests cover what the editor
 * really sends, not a hand-written approximation of it.
 */
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import express from "express";
import { buildItemPayload, emptyItemForm } from "@beholden/shared/views/item-editor/ItemFormModel";
import { openDb } from "../../lib/db.js";
import { zodErrorMiddleware } from "../../lib/validate.js";
import type { ServerContext } from "../../server/context.js";
import { registerItemRoutes } from "./items.js";

const refuseUnlessDm: express.RequestHandler = (req, res, next) => {
  if (req.headers["x-test-dm"] === "yes") return next();
  res.status(403).json({ ok: false, message: "DM access required" });
};

async function withServer(run: (call: (method: string, path: string, body?: unknown, asDm?: boolean) => Promise<{ status: number; body: any }>, count: () => number) => Promise<void>) {
  const db = openDb(":memory:");
  const app = express();
  app.use(express.json());
  registerItemRoutes(app, { db, broadcast: () => {} } as unknown as ServerContext, refuseUnlessDm);
  app.use(zodErrorMiddleware);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;

  const call = (method: string, path: string, body?: unknown, asDm = false) => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const request = http.request({
      hostname: "127.0.0.1", port, path, method,
      headers: {
        ...(asDm ? { "x-test-dm": "yes" } : {}),
        ...(payload ? { "content-type": "application/json", "content-length": String(payload.length) } : {}),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk as Buffer));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let parsed: unknown = text;
        try { parsed = JSON.parse(text); } catch { /* keep the text */ }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
    });
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
  const count = () => (db.prepare("SELECT COUNT(*) AS n FROM compendium_items").get() as { n: number }).n;

  try {
    await run(call, count);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
}

const flameBlade = () => buildItemPayload({
  ...emptyItemForm(),
  name: "Flame Blade", type: "Melee Weapon", rarity: "uncommon", magical: true, equippable: true,
  isWeapon: true, damage: "1d8", twoHandedDamage: "1d10", damageType: "fire", properties: "Finesse, Versatile",
}, null);

test("a player's weapon comes back built, and nothing is added to the compendium", async () => {
  await withServer(async (call, count) => {
    const before = count();
    const preview = await call("POST", "/api/compendium/items/preview", flameBlade());
    assert.equal(preview.status, 200, JSON.stringify(preview.body));

    const item = preview.body;
    assert.equal(item.name, "Flame Blade");
    assert.equal(item.dmg1, "1d8");
    assert.equal(item.dmg2, "1d10");
    assert.match(String(item.dmgType), /fire/i);
    assert.ok(item.properties.length >= 2, "properties come through");
    assert.equal(item.magic, true);
    assert.equal(item.id, undefined, "no compendium id - it is not a compendium item");

    assert.equal(count(), before, "the compendium is exactly as it was");
  });
});

test("the preview builds the same item a real compendium save would", async () => {
  await withServer(async (call) => {
    const preview = (await call("POST", "/api/compendium/items/preview", flameBlade())).body;
    const saved = await call("POST", "/api/compendium/items", flameBlade(), true);
    assert.equal(saved.status, 200);
    const stored = (await call("GET", `/api/compendium/items/${saved.body.id}`)).body;
    const { id: _id, ...storedWithoutId } = stored;
    assert.deepEqual(preview, storedWithoutId);
  });
});

test("a broken item is refused with a reason, and saving to the compendium stays the DM's", async () => {
  await withServer(async (call, count) => {
    const refused = await call("POST", "/api/compendium/items/preview", { name: "No type or rarity" });
    assert.equal(refused.status, 400);
    assert.equal(count(), 0);

    // Nothing about the preview opened the compendium itself up.
    assert.equal((await call("POST", "/api/compendium/items", flameBlade())).status, 403);
    assert.equal(count(), 0);
  });
});

test("the same item ID can coexist in different rulesets", async () => {
  await withServer(async (call, count) => {
    const base = flameBlade();
    const legacy = { ...base, ruleset: "5e", description: ["Legacy rules."] };
    const current = { ...base, ruleset: "5.5e", description: ["Current rules."] };
    const first = await call("POST", "/api/compendium/items", legacy, true);
    const second = await call("POST", "/api/compendium/items", current, true);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(count(), 2);
    const id = encodeURIComponent(first.body.id);
    assert.equal((await call("GET", `/api/compendium/items/${id}?ruleset=5e`)).body.ruleset, "5e");
    assert.equal((await call("GET", `/api/compendium/items/${id}?ruleset=5.5e`)).body.ruleset, "5.5e");
  });
});
