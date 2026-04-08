import { createReadStream, existsSync, statSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");
const indexPath = path.join(distDir, "index.html");
const port = Number(process.env.PORT || 4175);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Cache-Control": filePath.includes(`${path.sep}assets${path.sep}`)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  });
  createReadStream(filePath).pipe(res);
}

function safeResolve(urlPath) {
  const rawPath = decodeURIComponent((urlPath || "/").split("?")[0]);
  const relativePath = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "");
  const resolved = path.resolve(distDir, relativePath);
  return resolved.startsWith(distDir) ? resolved : indexPath;
}

await access(indexPath);

const server = http.createServer(async (req, res) => {
  try {
    const candidate = safeResolve(req.url || "/");
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      sendFile(res, candidate);
      return;
    }

    const html = await readFile(indexPath);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    res.end(html);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Failed to serve frontend.");
    console.error(error);
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Serving web-player from ${distDir} on port ${port}`);
});
