// Run only in an isolated benchmark snapshot: uses temporary databases and generated content.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { Session } from "node:inspector/promises";
import { createRequire } from "node:module";
import { once } from "node:events";
import { openDb } from "../../server/src/lib/db.ts";
import { parseNativeCompendiumDocument, importNativeCompendiumDocument, previewNativeCompendiumDocument } from "../../server/src/services/compendium/nativeCompendium.ts";
import { streamNativeCompendiumCategory } from "../../server/src/services/compendium/nativeCompendiumStreaming.ts";
import { registerSpellRoutes } from "../../server/src/routes/compendium/spells.ts";
import { runPasswordTask } from "../../server/src/lib/passwordWorker.ts";
import { signToken } from "../../server/src/lib/jwtAuth.ts";
import { GRAND_COMPENDIUM_SCHEMA_VERSION } from "../../shared/src/domain/compendium/grandCompendiumSchemas.shared.ts";

const require = createRequire(new URL("../../server/package.json", import.meta.url));
const express = require("express");
const bcrypt = require("bcryptjs");
const directory = mkdtempSync(path.join(os.tmpdir(), "beholden-workload-"));
const db = openDb(path.join(directory, "benchmark.db"));
db.prepare("INSERT INTO compendium_classes (id, ruleset, name, name_key, hd, data_json) VALUES (?, ?, ?, ?, ?, ?)")
  .run("c_benchmark_wizard", "5.5e", "Benchmark Wizard", "benchmark wizard", 6, JSON.stringify({ spellLists: { sl_wizard: "Wizard" } }));
const entries = Array.from({ length: 5000 }, (_, id) => ({
  ruleset: "5.5e", id: `s_benchmark_${id}`, name: `Benchmark Spark ${String(id).padStart(5, "0")}`,
  level: id % 10, school: "Evocation", casting: { time: "1 action", range: "60 feet",
    components: { verbal: true, somatic: true }, duration: { description: "Instantaneous" } },
  access: ["sl_wizard"], description: ["A synthetic spell description for benchmarking. ".repeat(16)],
}));
const document = { format: "beholden.compendium", schema: "grand", version: GRAND_COMPENDIUM_SCHEMA_VERSION,
  category: "spells", exportedAt: "2026-10-18T00:00:00.000Z", entries };
const json = JSON.stringify(document);
const hash = bcrypt.hashSync("benchmark-password", 10);
const app = express();
registerSpellRoutes(app, { db }, (_req, _res, next) => next());
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = `http://127.0.0.1:${server.address().port}`;
const token = signToken({ userId: "benchmark", username: "benchmark", isAdmin: true });
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
let freshId = 0;
const cases = [
  { name: "database startup (fresh file)", run: () => {
    const fresh = openDb(path.join(directory, `fresh-${freshId++}.db`)); fresh.close();
  } },
  { name: "compendium parse + validate (5,000 spells)", run: () => {
    assert.equal(parseNativeCompendiumDocument(JSON.parse(json))[0].entries.length, 5000);
  } },
  { name: "compendium import (5,000 new spells)", setup: () => db.exec("DELETE FROM compendium_spells"), run: () => {
    assert.equal(importNativeCompendiumDocument(db, JSON.parse(json)).imported, 5000);
  } },
  { name: "compendium reimport (5,000 unchanged spells)", run: () => {
    assert.equal(importNativeCompendiumDocument(db, JSON.parse(json)).imported, 0);
  } },
  { name: "compendium preview (5,000 unchanged spells)", run: () => {
    assert.equal(previewNativeCompendiumDocument(db, JSON.parse(json)).unchanged, 5000);
  } },
  { name: "compendium streaming export (5,000 spells)", run: async () => {
    let bytes = 0;
    for await (const chunk of streamNativeCompendiumCategory(db, "spells")) bytes += Buffer.byteLength(chunk);
    assert.ok(bytes > 1_000_000);
  } },
  { name: "spell search HTTP (50 sequential requests)", run: async () => {
    for (let index = 0; index < 50; index++) {
      const response = await fetch(`${address}/api/spells/search?q=Spark&limit=100&ruleset=5.5e&compact=1&withTotal=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.rows.length, 100);
    }
  } },
  { name: "password verification (4 queued checks, worker)", run: async () => {
    const values = await Promise.all(Array.from({ length: 4 }, () => runPasswordTask("verify", "benchmark-password", hash)));
    assert.ok(values.every(Boolean));
  } },
];

async function measure(entry) {
  for (let index = 0; index < 2; index++) { await entry.setup?.(); await entry.run(); }
  const samplesMs = [];
  const stallsMs = [];
  for (let index = 0; index < 7; index++) {
    await entry.setup?.();
    let last = performance.now();
    let stall = 0;
    const timer = setInterval(() => { const now = performance.now(); stall = Math.max(stall, now - last - 5); last = now; }, 5);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const start = performance.now();
    await entry.run();
    samplesMs.push(performance.now() - start);
    await new Promise((resolve) => setTimeout(resolve, 20));
    clearInterval(timer);
    stallsMs.push(stall);
  }
  return { name: entry.name, samplesMs, stallsMs, medianMs: median(samplesMs) };
}

try {
  const results = [];
  if (!process.argv.includes("--profile-only")) for (const entry of cases) results.push(await measure(entry));
  let profile;
  if (process.argv.includes("--profile") || process.argv.includes("--profile-only")) {
    await cases[2].setup();
    await cases[2].run();
    const session = new Session();
    session.connect();
    await session.post("Profiler.enable");
    await session.post("Profiler.start");
    const target = cases[2];
    for (let index = 0; index < 15; index++) { await target.setup(); await target.run(); }
    const { profile: raw } = await session.post("Profiler.stop");
    session.disconnect();
    const times = new Map();
    raw.samples.forEach((id, index) => times.set(id, (times.get(id) ?? 0) + (raw.timeDeltas[index] ?? 0) / 1000));
    const nodes = new Map(raw.nodes.map((node) => [node.id, node]));
    const parents = new Map(raw.nodes.flatMap((node) => (node.children ?? []).map((child) => [child, node.id])));
    const phases = new Map();
    for (const [id, time] of times) {
      const stack = [];
      for (let cursor = id; cursor !== undefined; cursor = parents.get(cursor)) stack.push(nodes.get(cursor).callFrame);
      const matches = (pattern) => stack.some((frame) => pattern.test(`${frame.functionName} ${frame.url}`));
      const phase = matches(/computeContentHashSync|node:internal\/crypto/) ? "content hashing (including its serialization)"
        : matches(/nativeCompendiumGuardrails/) ? "cross-reference guardrails"
        : matches(/nativeCompendiumParsing|grandCompendiumSchemas|assertGrandCompendiumEntry|isGrandCompendiumEntry/) ? "schema validation + document parsing"
        : matches(/blobTail|isUnchanged/) ? "entry serialization + comparison"
        : matches(/nativeCompendiumImport/) ? "row projection + SQLite writes"
        : matches(/garbage collector/) ? "garbage collection"
        : matches(/node:inspector/) ? "profiler control overhead"
        : "fixture reset, JSON decoding, and other";
      phases.set(phase, (phases.get(phase) ?? 0) + time);
    }
    const totalMs = [...phases.values()].reduce((sum, value) => sum + value, 0);
    profile = { workload: target.name, iterations: 15,
      phases: [...phases].map(([name, selfMs]) => ({ name, selfMs, percent: 100 * selfMs / totalMs })).sort((a, b) => b.selfMs - a.selfMs),
      topSelfTime: raw.nodes.map(({ id, callFrame }) => ({
      function: callFrame.functionName || "(anonymous)", file: callFrame.url.replaceAll("\\", "/").replace(/^.*\/(server|shared)\//, "$1/"),
      line: callFrame.lineNumber + 1, selfMs: times.get(id) ?? 0,
    })).sort((a, b) => b.selfMs - a.selfMs).slice(0, 20) };
  }
  writeFileSync(process.argv[2], JSON.stringify({ node: process.version, v8: process.versions.v8,
    sqlite: db.prepare("SELECT sqlite_version() AS version").get().version,
    dataset: { spells: entries.length, jsonBytes: Buffer.byteLength(json) }, results, profile }, null, 2));
} finally {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  assert.ok(path.resolve(directory).startsWith(path.join(os.tmpdir(), "beholden-workload-")));
  rmSync(directory, { recursive: true, force: true });
}
