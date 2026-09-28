import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import type express from "express";
import { corsMiddleware, createInMemoryRateLimiter, isImageUploadRequest, securityHeadersMiddleware } from "./security.js";
import { prepareUploadedImage } from "../lib/imageHelpers.js";

type FakeResponse = express.Response & { statusCode: number; body: unknown; headers: Record<string, string> };

function fakeRequest(method: string, path: string): express.Request {
  return { method, path, headers: {}, ip: "10.0.0.7", socket: { remoteAddress: "10.0.0.7" } } as unknown as express.Request;
}

function fakeResponse(): FakeResponse {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { res.headers[name.toLowerCase()] = value; },
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; },
  };
  return res as unknown as FakeResponse;
}

test("only image upload posts land in the upload bucket", () => {
  assert.equal(isImageUploadRequest({ method: "POST", path: "/api/players/p1/image" }), true);
  assert.equal(isImageUploadRequest({ method: "POST", path: "/api/me/characters/c1/image" }), true);
  assert.equal(isImageUploadRequest({ method: "POST", path: "/api/binders/b1/mortals/m1/image" }), true);
  // Reading a character, deleting a portrait, or posting anything else is ordinary API traffic.
  assert.equal(isImageUploadRequest({ method: "GET", path: "/api/players/p1/image" }), false);
  assert.equal(isImageUploadRequest({ method: "DELETE", path: "/api/players/p1/image" }), false);
  assert.equal(isImageUploadRequest({ method: "POST", path: "/api/players/p1" }), false);
  assert.equal(isImageUploadRequest({ method: "POST", path: "/campaign-images/p1/image" }), false);
});

test("the upload limiter refuses a flood of uploads without touching other requests", () => {
  const limiter = createInMemoryRateLimiter({
    windowMs: 60_000,
    max: 2,
    keyPrefix: "upload:",
    appliesTo: isImageUploadRequest,
  });

  const run = (req: express.Request) => {
    const res = fakeResponse();
    let passed = false;
    limiter(req, res, () => { passed = true; });
    return { passed, res };
  };

  assert.equal(run(fakeRequest("POST", "/api/players/p1/image")).passed, true);
  assert.equal(run(fakeRequest("POST", "/api/players/p2/image")).passed, true);

  const blocked = run(fakeRequest("POST", "/api/players/p3/image"));
  assert.equal(blocked.passed, false, "the third upload in the window is refused");
  assert.equal(blocked.res.statusCode, 429);
  assert.ok(Number(blocked.res.headers["retry-after"]) > 0, "clients are told when to come back");

  // The rest of the API is untouched by this limiter, however many uploads were just refused.
  for (let index = 0; index < 5; index += 1) {
    assert.equal(run(fakeRequest("GET", "/api/campaigns")).passed, true);
  }
});

test("a dedicated login bucket throttles one account and IP without consuming ordinary API traffic", () => {
  const limiter = createInMemoryRateLimiter({
    windowMs: 60_000, max: 2, keyPrefix: "login:",
    appliesTo: (req) => req.path === "/api/auth/login" && req.method === "POST",
  });
  const login = fakeRequest("POST", "/api/auth/login");
  login.body = { username: "Admin" };
  const run = (req: express.Request) => {
    const res = fakeResponse(); let passed = false;
    limiter(req, res, () => { passed = true; });
    return { res, passed };
  };
  assert.equal(run(login).passed, true);
  assert.equal(run(fakeRequest("GET", "/api/campaigns")).passed, true);
  assert.equal(run(login).passed, true);
  assert.equal(run(login).res.statusCode, 429);
});

test("forwarded client addresses are ignored unless proxy trust is explicitly enabled", () => {
  const previous = process.env.BEHOLDEN_TRUST_PROXY;
  delete process.env.BEHOLDEN_TRUST_PROXY;
  try {
    const limiter = createInMemoryRateLimiter({ windowMs: 60_000, max: 1 });
    const first = fakeRequest("GET", "/api/campaigns");
    first.headers["x-forwarded-for"] = "198.51.100.1";
    const second = fakeRequest("GET", "/api/campaigns");
    second.headers["x-forwarded-for"] = "198.51.100.2";
    limiter(first, fakeResponse(), () => {});
    const blocked = fakeResponse();
    limiter(second, blocked, () => assert.fail("spoofed forwarding header bypassed the bucket"));
    assert.equal(blocked.statusCode, 429);
  } finally {
    if (previous === undefined) delete process.env.BEHOLDEN_TRUST_PROXY;
    else process.env.BEHOLDEN_TRUST_PROXY = previous;
  }
});

test("disallowed origins are rejected and security headers are applied", () => {
  const denied = fakeRequest("POST", "/api/me/profile");
  denied.headers.origin = "https://evil.example";
  const deniedResponse = fakeResponse();
  let deniedPassed = false;
  corsMiddleware(new Set(["beholden.example"]))(denied, deniedResponse, () => { deniedPassed = true; });
  assert.equal(deniedPassed, false);
  assert.equal(deniedResponse.statusCode, 403);

  const headersResponse = fakeResponse();
  securityHeadersMiddleware()(fakeRequest("GET", "/api/auth/me"), headersResponse, () => {});
  assert.equal(headersResponse.headers["x-content-type-options"], "nosniff");
  assert.equal(headersResponse.headers["x-frame-options"], "DENY");
  assert.equal(headersResponse.headers["referrer-policy"], "no-referrer");
});

test("uploads are normalised to a small WebP, and non-images are refused", async () => {
  const tall = await sharp({
    create: { width: 1200, height: 900, channels: 3, background: { r: 10, g: 120, b: 200 } },
  }).png().toBuffer();

  const prepared = await prepareUploadedImage({ mimetype: "image/png", buffer: tall });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;

  const meta = await sharp(prepared.image).metadata();
  assert.equal(meta.format, "webp");
  assert.ok((meta.width ?? 0) <= 360 && (meta.height ?? 0) <= 360, "downscaled to fit 360px");
  assert.ok(prepared.image.length < tall.length, "the stored file is smaller than what was sent");

  assert.deepEqual(await prepareUploadedImage(undefined), { ok: false, message: "No file" });
  assert.deepEqual(
    await prepareUploadedImage({ mimetype: "application/pdf", buffer: Buffer.from("%PDF-1.4") }),
    { ok: false, message: "Unsupported image type" },
  );
  assert.deepEqual(
    await prepareUploadedImage({ mimetype: "image/png", buffer: Buffer.from("not an image at all") }),
    { ok: false, message: "Could not process image" },
  );
});

test("an animated GIF is stored as a single still frame", async () => {
  const frames = await sharp({
    create: { width: 60, height: 180, channels: 3, background: { r: 200, g: 30, b: 30 } },
  }).gif({ loop: 0 }).toBuffer();

  const prepared = await prepareUploadedImage({ mimetype: "image/gif", buffer: frames });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;

  const meta = await sharp(prepared.image).metadata();
  assert.equal(meta.format, "webp");
  assert.ok((meta.pages ?? 1) <= 1, "no animation is carried into the stored portrait");
});
