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

  for (const htmlPath of ["/", "/player"]) {
    const response = await fetch(`${baseUrl}${htmlPath}`);
    assert.equal(response.status, 200);
    assert.doesNotMatch(response.headers.get("cache-control") ?? "", /immutable/);
  }
});
