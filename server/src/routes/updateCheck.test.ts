import assert from "node:assert/strict";
import test from "node:test";
import { getLatestVersion, isNewer, resetUpdateCheckCacheForTests } from "./updateCheck.js";

test("update version comparison handles release and prerelease precedence", () => {
  assert.equal(isNewer("2.0.0", "1.99.99"), true);
  assert.equal(isNewer("1.6.0", "1.5.9"), true);
  assert.equal(isNewer("1.5.1", "1.5.0"), true);
  assert.equal(isNewer("1.5.0+build", "1.5.0"), false);
  assert.equal(isNewer("1.5.0", "1.5.0-beta.2"), true);
  assert.equal(isNewer("1.5.0-beta.2", "1.5.0-beta.1"), true);
  assert.equal(isNewer("1.5.0-beta.1", "1.5.0-beta.2"), false);
  assert.equal(isNewer("1.5.0-beta", "1.5.0"), false);
  assert.equal(isNewer("1.4.99", "1.5.0"), false);
});

test("successful update checks are cached until their TTL expires", async () => {
  resetUpdateCheckCacheForTests();
  let time = 1;
  let calls = 0;
  const fetchImpl = async () => new Response(JSON.stringify({ version: calls++ === 0 ? "1.6.0" : "1.7.0" }), { status: 200 });
  assert.equal(await getLatestVersion({ fetchImpl, now: () => time }), "1.6.0");
  assert.equal(await getLatestVersion({ fetchImpl, now: () => time + 1_000 }), "1.6.0");
  assert.equal(calls, 1);
  time += 24 * 60 * 60 * 1000 + 1;
  assert.equal(await getLatestVersion({ fetchImpl, now: () => time }), "1.7.0");
  assert.equal(calls, 2);
});

test("offline and invalid responses are negatively cached", async () => {
  const failures: Array<typeof fetch> = [
    async () => { throw new Error("offline"); },
    async () => new Response(JSON.stringify({ version: "not-semver" }), { status: 200 }),
  ];
  for (const fetchImpl of failures) {
    resetUpdateCheckCacheForTests();
    let calls = 0;
    const counted = async (...args: Parameters<typeof fetch>) => { calls += 1; return fetchImpl(...args); };
    assert.equal(await getLatestVersion({ fetchImpl: counted }), null);
    assert.equal(await getLatestVersion({ fetchImpl: counted }), null);
    assert.equal(calls, 1);
  }
});

test("an update request is aborted at its timeout and the failure is cached", async () => {
  resetUpdateCheckCacheForTests();
  let calls = 0;
  const fetchImpl = (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    calls += 1;
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  assert.equal(await getLatestVersion({ fetchImpl, timeoutMs: 5 }), null);
  assert.equal(await getLatestVersion({ fetchImpl, timeoutMs: 5 }), null);
  assert.equal(calls, 1);
});
