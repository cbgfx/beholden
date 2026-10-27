import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import type { ServerContext } from "../server/context.js";
import { registerWebUiRoutes } from "./webUi.js";

test("hashed SPA assets are immutable while HTML remains revalidated", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-web-ui-"));
  const dmDist = path.join(root, "dm");
  const playerDist = path.join(root, "player");
  fs.mkdirSync(path.join(dmDist, "assets"), { recursive: true });
  fs.mkdirSync(path.join(playerDist, "assets"), { recursive: true });
  fs.writeFileSync(path.join(dmDist, "index.html"), "dm index");
  fs.writeFileSync(path.join(dmDist, "assets", "app-hash.js"), "dm asset");
  fs.writeFileSync(path.join(playerDist, "index.html"), "player index");
  fs.writeFileSync(path.join(playerDist, "assets", "app-hash.js"), "player asset");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const app = express();
  registerWebUiRoutes(app, {
    paths: {
      webDistDir: dmDist,
      hasWebDist: true,
      webPlayerDistDir: playerDist,
      hasWebPlayerDist: true,
    },
  } as unknown as ServerContext);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  for (const assetPath of ["/assets/app-hash.js", "/player/assets/app-hash.js"]) {
    const response = await fetch(`${baseUrl}${assetPath}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /public/);
    assert.match(response.headers.get("cache-control") ?? "", /max-age=31536000/);
    assert.match(response.headers.get("cache-control") ?? "", /immutable/);
  }

  for (const htmlPath of ["/", "/index.html", "/player", "/player/", "/player/index.html"]) {
    const response = await fetch(`${baseUrl}${htmlPath}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }

  // Client-side routes still get the app shell...
  for (const routePath of ["/campaign/abc", "/player/character/abc"]) {
    const response = await fetch(`${baseUrl}${routePath}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /html/);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }

  for (const filePath of ["/assets/retired-build.js", "/player/assets/retired-build.js"]) {
    const response = await fetch(`${baseUrl}${filePath}`);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type") ?? "", /text\/plain/);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }

  // ...but a request for a file that does not exist is a 404, not a page of HTML.
  for (const filePath of ["/character-banners/old.webp", "/favicon-missing.png", "/player/nope.js"]) {
    const response = await fetch(`${baseUrl}${filePath}`);
    assert.equal(response.status, 404, `${filePath} should 404`);
    assert.doesNotMatch(response.headers.get("content-type") ?? "", /html/);
  }
});

test("player hosts open the player app at the root while other hosts keep the DM app", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-web-ui-hosts-"));
  const dmDist = path.join(root, "dm");
  const playerDist = path.join(root, "player");
  fs.mkdirSync(path.join(dmDist, "assets"), { recursive: true });
  fs.mkdirSync(path.join(playerDist, "assets"), { recursive: true });
  fs.writeFileSync(path.join(dmDist, "index.html"), "dm index");
  fs.writeFileSync(path.join(playerDist, "index.html"), "player index");
  fs.writeFileSync(path.join(playerDist, "assets", "app-hash.js"), "player asset");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const previous = process.env.BEHOLDEN_PLAYER_HOSTS;
  process.env.BEHOLDEN_PLAYER_HOSTS = "player.example.test";
  t.after(() => {
    if (previous === undefined) delete process.env.BEHOLDEN_PLAYER_HOSTS;
    else process.env.BEHOLDEN_PLAYER_HOSTS = previous;
  });

  const app = express();
  registerWebUiRoutes(app, {
    paths: { webDistDir: dmDist, hasWebDist: true, webPlayerDistDir: playerDist, hasWebPlayerDist: true },
  } as unknown as ServerContext);
  // Stand-in for an API route registered after the web UI routes.
  app.get("/api/ping", (_req, res) => { res.type("text/plain").send("pong"); });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert(address && typeof address === "object");

  // Raw requests so the Host header can be chosen per call.
  const get = (host: string, requestPath: string) => new Promise<{ status: number; body: string }>((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: address.port, path: requestPath, headers: { host } }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    }).on("error", reject);
  });

  assert.equal((await get("player.example.test", "/")).body, "player index");
  assert.equal((await get("player.example.test", "/character/abc")).body, "player index");
  assert.equal((await get("player.example.test", "/player/character/abc")).body, "player index");
  assert.equal((await get("player.example.test", "/player/assets/app-hash.js")).body, "player asset");
  assert.equal((await get("player.example.test", "/api/ping")).body, "pong");
  assert.equal((await get("dm.example.test", "/")).body, "dm index");
  assert.equal((await get("dm.example.test", "/player/")).body, "player index");
});
