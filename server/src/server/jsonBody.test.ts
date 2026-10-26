import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { gzipSync } from "node:zlib";
import { createJsonBodyParser } from "./jsonBody.js";

test("production parser rejects encoded bodies, including trailing junk, and continues serving", async t => {
  const app = express(); app.use(createJsonBodyParser());
  app.post("/probe", (req, res) => { res.json(req.body); });
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(error.status ?? 500).end(); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const address = server.address(); assert(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  const encoded = gzipSync('{"ok":true}');
  for (const body of [encoded, Buffer.concat([encoded, Buffer.from("trailing junk")])]) {
    const response = await fetch(origin + "/probe", { method: "POST", headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" }, body });
    assert.equal(response.status, 415);
  }
  const response = await fetch(origin + "/probe", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"ok":true}' });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
});
