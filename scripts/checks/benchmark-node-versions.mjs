import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..", "..");
const [node24, node26] = process.argv.slice(2);
if (!node24 || !node26) throw new Error("Usage: node scripts/checks/benchmark-node-versions.mjs <node24.exe> <node26.exe>");
const temporary = await mkdtemp(path.join(os.tmpdir(), "beholden-node-comparison-"));
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
const runtimes = [{ key: "node24", executable: path.resolve(node24) }, { key: "node26", executable: path.resolve(node26) }];
const reportDir = path.join(root, "docs", "benchmarks");
await mkdir(reportDir, { recursive: true });
try {
  for (const runtime of runtimes) {
    console.log(`Preparing isolated ${runtime.key} snapshot...`);
    runtime.directory = path.join(temporary, runtime.key);
    await mkdir(runtime.directory);
    for (const file of ["package.json", "package-lock.json"]) await cp(path.join(root, file), path.join(runtime.directory, file));
    for (const directory of ["server", "shared", "scripts"]) {
      await cp(path.join(root, directory), path.join(runtime.directory, directory), {
        recursive: true,
        filter: (source) => !["node_modules", "dist", ".env", ".git"].includes(path.basename(source)),
      });
    }
    for (const workspace of ["web-dm", "web-player"]) {
      await mkdir(path.join(runtime.directory, workspace));
      await cp(path.join(root, workspace, "package.json"), path.join(runtime.directory, workspace, "package.json"));
    }
    runtime.env = { ...process.env, PATH: `${path.dirname(runtime.executable)}${path.delimiter}${process.env.PATH}`,
      NODE_DISABLE_COMPILE_CACHE: "1", npm_config_engine_strict: "false" };
    delete runtime.env.NODE_COMPILE_CACHE;
    runtime.options = { cwd: runtime.directory, env: runtime.env, maxBuffer: 4 * 1024 * 1024, timeout: 240_000, windowsHide: true };
    const npm = path.join(path.dirname(runtime.executable), "node_modules", "npm", "bin", "npm-cli.js");
    await exec(runtime.executable, [npm, "ci", "--no-audit", "--no-fund"], runtime.options);
    runtime.runs = [];
    runtime.startup = [];
    console.log(`${runtime.key} dependencies ready.`);
  }
  // Alternating AB / BA / AB avoids always giving one runtime the warmer machine.
  for (let round = 0; round < 3; round++) {
    for (const runtime of round % 2 ? [...runtimes].reverse() : runtimes) {
      console.log(`Round ${round + 1}/3: ${runtime.key} application workloads...`);
      for (let sample = 0; sample < 3; sample++) {
        const start = performance.now();
        await exec(runtime.executable, ["--import", "tsx", "--input-type=module", "--eval", 'await import("./server/src/server/createServer.ts")'], runtime.options);
        const elapsed = performance.now() - start;
        if (sample > 0) runtime.startup.push(elapsed); // discard first startup of each block
      }
      const output = path.join(temporary, `${runtime.key}-${round}.json`);
      await exec(runtime.executable, ["--import", "tsx", "scripts/checks/benchmark-application.mjs", output], runtime.options);
      runtime.runs.push(JSON.parse(await readFile(output, "utf8")));
    }
  }
  console.log("Profiling Node 26 compendium import (15 repeated imports)...");
  const profileOutput = path.join(temporary, "node26-profile.json");
  await exec(runtimes[1].executable, ["--import", "tsx", "scripts/checks/benchmark-application.mjs", profileOutput, "--profile-only"], runtimes[1].options);
  const profile = JSON.parse(await readFile(profileOutput, "utf8")).profile;
  const aggregate = runtimes.map((runtime) => ({
    name: runtime.key, node: runtime.runs[0].node, v8: runtime.runs[0].v8, sqlite: runtime.runs[0].sqlite,
    startupSamplesMs: runtime.startup,
    results: runtime.runs[0].results.map((entry, index) => {
      const samplesMs = runtime.runs.flatMap((run) => run.results[index].samplesMs);
      const stallsMs = runtime.runs.flatMap((run) => run.results[index].stallsMs);
      return { name: entry.name, samplesMs, stallsMs, medianMs: median(samplesMs), p10Ms: percentile(samplesMs, 0.1),
        p90Ms: percentile(samplesMs, 0.9), medianMaxEventLoopDelayMs: median(stallsMs) };
    }),
  }));
  assert.equal(aggregate[0].sqlite, aggregate[1].sqlite);
  const comparison = aggregate[0].results.map((entry, index) => ({ name: entry.name,
    node24Ms: entry.medianMs, node26Ms: aggregate[1].results[index].medianMs,
    node26TimeChangePercent: 100 * (aggregate[1].results[index].medianMs / entry.medianMs - 1) }));
  comparison.unshift({ name: "server module startup", node24Ms: median(aggregate[0].startupSamplesMs), node26Ms: median(aggregate[1].startupSamplesMs),
    node26TimeChangePercent: 100 * (median(aggregate[1].startupSamplesMs) / median(aggregate[0].startupSamplesMs) - 1) });
  const report = { generatedAt: new Date().toISOString(), platform: process.platform, cpu: os.cpus()[0].model,
    logicalCpus: os.cpus().length, lockSha256: createHash("sha256").update(await readFile(path.join(root, "package-lock.json"))).digest("hex"),
    methodology: "Same current source and lockfile in isolated snapshots; own native build per runtime; sequential AB/BA/AB blocks; two warm-ups + seven samples per workload per block; compile cache disabled. Same host runs HTTP client and server. Authentication is bearer-token middleware, not the full cookie-session stack. Synthetic data, not live campaign data. Timings include assertion checks. Startup is process/module load, not listening readiness. Memory is not compared.",
    dataset: runtimes[0].runs[0].dataset, aggregate, comparison, profile,
    profileMethodology: "Separate warmed Node 26 profile-only run, using the same application source, dependencies, and fixture; not included in timing samples. Phase attribution groups stack samples by application frame, not by native subsystem." };
  await writeFile(path.join(reportDir, "node24-vs26.json"), JSON.stringify(report, null, 2) + "\n");
const lines = ["# Node 24 versus Node 26", "", `Compared ${aggregate[0].node} with ${aggregate[1].node} on ${report.cpu.trim()}.`, "",
    report.methodology, "", "Dataset: 5,000 generated, schema-valid spells; on-disk temporary SQLite database (WAL). Each workload has 21 timed samples; startup has six. Negative percentage means Node 26 took less time. Small differences or overlapping ranges should be treated as noise.", "",
    "| Workload | Node 24 median (ms) | Node 26 median (ms) | Node 26 time change |", "|---|---:|---:|---:|",
    ...comparison.map((row) => `| ${row.name} | ${row.node24Ms.toFixed(1)} | ${row.node26Ms.toFixed(1)} | ${row.node26TimeChangePercent.toFixed(1)}% |`),
    "", "## Node 26 import CPU profile", "", report.profileMethodology,
    "", "Self time from 15 imports (including the fixture reset DELETE), excluding initial imports and database setup. Native calls are attributed to their JavaScript frame. This is not a wall-time breakdown or proof that the top frame can be optimized.", "",
    "| Sampled phase | CPU sample share |", "|---|---:|",
    ...profile.phases.map((phase) => `| ${phase.name} | ${phase.percent.toFixed(1)}% |`), "",
    "| Function | Location | Self time (ms) |", "|---|---|---:|",
    ...profile.topSelfTime.slice(0, 12).map((row) => `| ${row.function.replaceAll("|", "\\|")} | ${row.file.replaceAll(temporary.replaceAll("\\", "/"), "<snapshot>")}:${row.line} | ${row.selfMs.toFixed(1)} |`),
    "", "Raw samples, ranges, event-loop delays, versions, and lockfile hash: [node24-vs26.json](node24-vs26.json).", ""];
  await writeFile(path.join(reportDir, "node24-vs26.md"), lines.join("\n"));
  console.log(JSON.stringify(comparison, null, 2));
  console.log(`Report: ${path.join(reportDir, "node24-vs26.md")}`);
} finally {
  assert.ok(path.resolve(temporary).startsWith(path.join(os.tmpdir(), "beholden-node-comparison-")));
  await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
