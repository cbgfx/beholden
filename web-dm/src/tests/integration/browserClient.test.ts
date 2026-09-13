import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", { location: { protocol: "http:", hostname: "localhost", href: "http://localhost:5173/" } });
  vi.stubGlobal("localStorage", { getItem: () => "test-token" });
});
afterEach(() => vi.unstubAllGlobals());

for (const status of [400, 401, 403, 409, 429]) it(`does not retry HTTP ${status} in JSON or binary requests`, async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ message: "Rejected", code: "conflict" }), { status, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  const { api, apiBlob } = await import("@beholden/shared/api/browserClient");
  for (const request of [api, apiBlob]) {
    fetch.mockClear();
    await expect(request("/api/test", { method: "POST" })).rejects.toMatchObject({ status, code: "conflict" });
    expect(fetch).toHaveBeenCalledTimes(1);
  }
});

it("does not replay a committed write after an ambiguous network failure", async () => {
  let writes = 0;
  const fetch = vi.fn(async () => { writes++; throw new TypeError("Response connection lost"); });
  vi.stubGlobal("fetch", fetch);
  const { api } = await import("@beholden/shared/api/browserClient");
  await expect(api("/api/test", { method: "POST" })).rejects.toThrow("Response connection lost");
  expect(writes).toBe(1);
});

it("retries safe reads on proxy failure but never retries aborts", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response("proxy", { status: 502 })).mockResolvedValueOnce(new Response('{"ok":true}', { headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  const { api } = await import("@beholden/shared/api/browserClient");
  await expect(api("/api/test")).resolves.toEqual({ ok: true });
  expect(fetch.mock.calls[1]?.[0]).toBe("http://localhost:5174/api/test");
  fetch.mockReset().mockRejectedValue(new DOMException("Aborted", "AbortError"));
  await expect(api("/api/test")).rejects.toMatchObject({ name: "AbortError" });
  expect(fetch).toHaveBeenCalledTimes(1);
});
