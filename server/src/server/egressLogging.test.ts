import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import express from "express";
import compression from "compression";
import { createEgressLoggingMiddleware, egressLogMinBytes, type EgressLogEntry } from "./egressLogging.js";

test("egress logger measures compressed wire bytes and omits query strings", async () => {
  const entries: EgressLogEntry[] = [];
  const app = express();
  app.use(createEgressLoggingMiddleware({ minBytes: 0, log: (entry) => entries.push(entry) }));
  app.use(compression({ threshold: 1 }));
  app.get("/large", (_req, res) => res.json({ text: "compressible".repeat(20_000) }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const response = await new Promise<{ body: Buffer; encoding: string }>((resolve, reject) => {
      const req = http.get({
        hostname: "127.0.0.1",
        port: address.port,
        path: "/large?secret=noise",
        headers: { "Accept-Encoding": "gzip" },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve({ body: Buffer.concat(chunks), encoding: String(res.headers["content-encoding"] ?? "") }));
      });
      req.on("error", reject);
    });

    assert.equal(response.encoding, "gzip");
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.path, "/large");
    assert.equal(entries[0]?.encoding, "gzip");
    assert.equal(entries[0]?.bytes, response.body.length);
    assert(response.body.length < 10_000, "wire payload should be substantially compressed");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("egress logger suppresses responses below its threshold", async () => {
  const entries: EgressLogEntry[] = [];
  const app = express();
  app.use(createEgressLoggingMiddleware({ minBytes: 100, log: (entry) => entries.push(entry) }));
  app.get("/small", (_req, res) => res.send("ok"));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    await new Promise<void>((resolve, reject) => {
      const req = http.get({ hostname: "127.0.0.1", port: address.port, path: "/small" }, (res) => {
        res.resume();
        res.on("end", resolve);
      });
      req.on("error", reject);
    });
    assert.deepEqual(entries, []);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("egress minimum defaults to 1 MiB and accepts zero", () => {
  assert.equal(egressLogMinBytes(undefined), 1024 * 1024);
  assert.equal(egressLogMinBytes("invalid"), 1024 * 1024);
  assert.equal(egressLogMinBytes("0"), 0);
  assert.equal(egressLogMinBytes("2048.9"), 2048);
});
