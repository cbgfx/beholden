# Node 24 versus Node 26

Compared v24.22.0 with v26.12.0 on AMD Ryzen 9 5900X 12-Core Processor.

Same current source and lockfile in isolated snapshots; own native build per runtime; sequential AB/BA/AB blocks; two warm-ups + seven samples per workload per block; compile cache disabled. Same host runs HTTP client and server. Authentication is bearer-token middleware, not the full cookie-session stack. Synthetic data, not live campaign data. Timings include assertion checks. Startup is process/module load, not listening readiness. Memory is not compared.

Dataset: 5,000 generated, schema-valid spells; on-disk temporary SQLite database (WAL). Each workload has 21 timed samples; startup has six. Negative percentage means Node 26 took less time. Small differences or overlapping ranges should be treated as noise.

| Workload | Node 24 median (ms) | Node 26 median (ms) | Node 26 time change |
|---|---:|---:|---:|
| server module startup | 1038.1 | 986.3 | -5.0% |
| database startup (fresh file) | 36.6 | 34.2 | -6.7% |
| compendium parse + validate (5,000 spells) | 29.4 | 28.1 | -4.2% |
| compendium import (5,000 new spells) | 128.3 | 123.9 | -3.4% |
| compendium reimport (5,000 unchanged spells) | 67.3 | 67.0 | -0.4% |
| compendium preview (5,000 unchanged spells) | 65.7 | 63.2 | -3.9% |
| compendium streaming export (5,000 spells) | 36.1 | 32.7 | -9.5% |
| spell search HTTP (50 sequential requests) | 78.6 | 79.8 | 1.6% |
| password verification (4 queued checks, worker) | 213.2 | 210.2 | -1.4% |

## Node 26 import CPU profile

Separate warmed Node 26 profile-only run, using the same application source, dependencies, and fixture; not included in timing samples. Phase attribution groups stack samples by application frame, not by native subsystem.

| Sampled phase | CPU sample share |
|---|---:|
| row projection + SQLite writes | 51.2% |
| schema validation + document parsing | 14.8% |
| cross-reference guardrails | 12.2% |
| content hashing (including its serialization) | 9.0% |
| fixture reset, JSON decoding, and other | 5.6% |
| garbage collection | 3.3% |
| profiler control overhead | 2.4% |
| entry serialization + comparison | 1.6% |

Self time from 15 imports (including the fixture reset DELETE), excluding initial imports and database setup. Native calls are attributed to their JavaScript frame. This is not a wall-time breakdown or proof that the top frame can be optimized.

| Function | Location | Self time (ms) |
|---|---|---:|
| (anonymous) | :0 | 442.8 |
| (anonymous) | :0 | 378.0 |
| run | file:///C:/Users/cellu/Desktop/Projects/dnd/beholden/scripts/checks/benchmark-application.mjs:50 | 94.2 |
| walk | server/src/services/compendium/nativeCompendiumGuardrails.ts:1 | 82.9 |
| (anonymous) | server/src/services/compendium/nativeCompendiumImport.ts:1 | 71.1 |
| computeContentHashSync | shared/src/domain/compendium/computeContentHashSync.ts:2 | 67.1 |
| (garbage collector) | :0 | 65.3 |
| assertNativeCompendiumGuardrails | server/src/services/compendium/nativeCompendiumGuardrails.ts:1 | 54.0 |
| update | :0 | 51.6 |
| post | node:inspector:115 | 46.4 |
| (anonymous) | server/src/services/compendium/nativeCompendiumImport.ts:1 | 39.6 |
| (anonymous) | server/src/services/compendium/nativeCompendiumParsing.ts:1 | 27.9 |

Raw samples, ranges, event-loop delays, versions, and lockfile hash: [node24-vs26.json](node24-vs26.json).

## Interpretation and next candidates

Streaming export had the clearest runtime gain: Node 26 took 9.5% less time and was faster in all three blocks. Most other differences were small with overlapping sample ranges. The 1.6% HTTP-search increase is within the observed variation; this run does not establish a search regression. These results do not imply a uniform application speedup.

The import profile attributes roughly half the samples to row projection and SQLite writes; that bucket is not SQL time alone. Validation/document parsing, reference guardrails, and hashing are smaller measurable contributors. Source inspection found two targeted candidates: each valid entry is schema-validated twice in nativeCompendiumParsing.ts, and blobTail serializes the entry both for storage and again inside computeContentHashSync. These are candidates for a separate measured change, not promised gains. No application optimization was applied during this comparison.
