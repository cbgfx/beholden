// Read-only, synthetic workloads: never starts the server or opens application data.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";

const root = path.resolve(import.meta.dirname, "..", "..");
const require = createRequire(path.join(root, "server", "package.json"));
const bcrypt = require("bcryptjs");
const { zipSync, unzipSync, strToU8 } = require("fflate");
const { parse } = require("csv-parse/sync");
// Run with --import tsx so this measures the real request-path worker implementation.
const { runPasswordTask } = await import("../../server/src/lib/passwordWorker.ts");
const cache = mkdtempSync(path.join(os.tmpdir(), "beholden-compile-profile-"));
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = (value) => Number(value.toFixed(1));

function moduleLoad(cached) {
  const env = { ...process.env, NODE_COMPILE_CACHE: cache };
  if (cached) delete env.NODE_DISABLE_COMPILE_CACHE;
  else env.NODE_DISABLE_COMPILE_CACHE = "1";
  const started = performance.now();
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval",
    'await import("./server/src/server/createServer.ts")'], {
    cwd: root, env, encoding: "utf8", timeout: 60_000,
  });
  if (result.status !== 0) throw new Error(result.stderr || `Module load exited ${result.status}`);
  return performance.now() - started;
}

async function workload(name, work) {
  const elapsed = [];
  const stalls = [];
  for (let iteration = 0; iteration < 5; iteration++) {
    let last = performance.now();
    let worst = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      worst = Math.max(worst, now - last - 5);
      last = now;
    }, 5);
    await new Promise((resolve) => setTimeout(resolve, 15));
    const started = performance.now();
    await work();
    elapsed.push(performance.now() - started);
    await new Promise((resolve) => setTimeout(resolve, 15));
    clearInterval(timer);
    stalls.push(worst);
  }
  return { name, medianMs: round(median(elapsed)), medianMaxEventLoopDelayMs: round(median(stalls)) };
}

try {
  const coldCacheMs = moduleLoad(true);
  const without = [];
  const withCache = [];
  for (let iteration = 0; iteration < 7; iteration++) {
    // Alternate order to reduce filesystem warm-up and CPU scheduling bias.
    if (iteration % 2) {
      withCache.push(moduleLoad(true));
      without.push(moduleLoad(false));
    } else {
      without.push(moduleLoad(false));
      withCache.push(moduleLoad(true));
    }
  }
  console.log(JSON.stringify({
    node: process.version,
    moduleLoad: {
      runsPerMode: 7, coldCacheMs: round(coldCacheMs),
      disabledMedianMs: round(median(without)), warmCacheMedianMs: round(median(withCache)),
    },
  }, null, 2));
  const hash = bcrypt.hashSync("synthetic-profile-password", 10);
  await runPasswordTask("verify", "synthetic-profile-password", hash);
  const zip = zipSync({
    "records.csv": strToU8("name,description\n" + "Example,Repeated synthetic import text\n".repeat(100_000)),
    "image.bin": randomBytes(8 * 1024 * 1024),
  });
  const compendiumJson = JSON.stringify({ entries: Array.from({ length: 10_000 }, (_, id) => ({
    id: `synthetic-${id}`, name: `Synthetic entry ${id}`, description: "Synthetic rules text. ".repeat(50),
  })) });
  console.log(JSON.stringify({ zipBytes: zip.byteLength, workloads: [
    await workload("one bcrypt cost-10 hash", () => bcrypt.hash("synthetic-profile-password", 10)),
    await workload("four concurrent bcrypt verifications", () => Promise.all(
      Array.from({ length: 4 }, () => bcrypt.compare("synthetic-profile-password", hash)))),
    await workload("four concurrent worker bcrypt verifications", () => Promise.all(
      Array.from({ length: 4 }, () => runPasswordTask("verify", "synthetic-profile-password", hash)))),
    await workload("ZIP extraction: 100k CSV rows plus 8 MiB binary", () => { unzipSync(zip); }),
    await workload("ZIP extraction plus parsing 100k CSV rows", () => {
      const entries = unzipSync(zip);
      parse(Buffer.from(entries["records.csv"]).toString("utf8"), { columns: true, skip_empty_lines: true });
    }),
    await workload("JSON parsing: 10k synthetic compendium entries", () => { JSON.parse(compendiumJson); }),
  ] }, null, 2));
} finally {
  rmSync(cache, { recursive: true, force: true });
}
