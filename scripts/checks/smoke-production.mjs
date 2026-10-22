import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import net from "node:net";
import WebSocket from "ws";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const directory = await mkdtemp(path.join(tmpdir(), "beholden-production-"));
const listener = net.createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const inheritedEnv = { ...process.env };
delete inheritedEnv.BEHOLDEN_WEB_DIST;
delete inheritedEnv.BEHOLDEN_WEB_PLAYER_DIST;
// Use an isolated working directory as well as a temporary database, so local
// .env files and real campaign data cannot affect this check.
const child = spawn(process.execPath, [path.join(repo, "server/dist/runtime/main.js")], {
  cwd: directory,
  env: {
    ...inheritedEnv,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: String(port),
    BEHOLDEN_DATA_DIR: directory,
    BEHOLDEN_DB_PATH: path.join(directory, "smoke.db"),
    BEHOLDEN_ADMIN_USER: "smoke-admin",
    BEHOLDEN_ADMIN_PASS: "smoke-test-password",
    BEHOLDEN_JWT_SECRET: "isolated-production-smoke-test-signing-key",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", (chunk) => { logs += chunk; });
child.stderr.on("data", (chunk) => { logs += chunk; });
let socket;
try {
  let ready = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    if (child.exitCode !== null) throw new Error(`Production server exited: ${logs}`);
    try {
      const response = await fetch(`${origin}/api/health`);
      ready = response.ok && (await response.json()).database === "ready";
    } catch { /* wait for the listening socket */ }
    if (ready) break;
    await delay(100);
  }
  assert.ok(ready, `Production server did not become healthy: ${logs}`);
  for (const route of ["/", "/campaigns/smoke", "/player/", "/player/characters/smoke"]) {
    const response = await fetch(`${origin}${route}`);
    assert.equal(response.status, 200, route);
    const html = await response.text();
    const script = /<script[^>]+src="([^"]+)"/.exec(html)?.[1];
    assert.ok(script, `No entry script at ${route}`);
    assert.ok(script.startsWith(route.startsWith("/player") ? "/player/assets/" : "/assets/"), script);
    const asset = await fetch(`${origin}${script}`);
    assert.equal(asset.status, 200, script);
    assert.match(asset.headers.get("content-type"), /javascript/);
  }
  const login = await fetch(`${origin}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ username: "smoke-admin", password: "smoke-test-password" }),
  });
  assert.equal(login.status, 200, await login.clone().text());
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "Login must set a session cookie");
  assert.equal((await login.json()).user.isAdmin, true);
  socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { cookie, origin }, handshakeTimeout: 5_000 });
  await once(socket, "open");
  socket.close();
  await once(socket, "close");
  // Fresh startup must find the bundled SRD data, not silently skip seeding.
  assert.match(logs, /Imported \d+ default SRD compendium entries/);
  console.log("Production smoke passed: fresh database/SRD, both SPAs and assets, login worker, authenticated WebSocket.");
} finally {
  socket?.terminate();
  if (child.exitCode === null) {
    const stopped = once(child, "exit");
    child.kill();
    await stopped;
  }
  await rm(directory, { recursive: true, force: true });
}
