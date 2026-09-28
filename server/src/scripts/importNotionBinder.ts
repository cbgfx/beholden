import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { getRuntimeConfig } from "../config/runtime.js";
import { getPaths } from "../config/paths.js";
import { openDb } from "../lib/db.js";
import { importNotionZip } from "../services/binders/notionImport.js";

for (const candidate of [path.resolve(".env"), path.resolve("..", ".env"), path.resolve("..", "..", ".env")]) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

const valueAfter = (flag: string) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const zipPath = path.resolve(valueAfter("--zip") ?? "../Notion.zip");
const binderId = valueAfter("--binder");
const commit = process.argv.includes("--commit");
if (!binderId) {
  console.error("Usage: npm -w server run binder:notion-import -- --binder <id> [--zip ../Notion.zip] [--commit]");
  process.exit(1);
}
if (!fs.existsSync(zipPath)) {
  console.error(`Notion ZIP not found: ${zipPath}`);
  process.exit(1);
}
const runtime = getRuntimeConfig();
const paths = getPaths({ dataDir: runtime.dataDir, ...(runtime.dbPath ? { dbPath: runtime.dbPath } : {}) });
const db = openDb(paths.dbPath);
try {
  const summary = importNotionZip(db, binderId, fs.readFileSync(zipPath), commit);
  console.log(JSON.stringify({ mode: commit ? "commit" : "dry-run", database: paths.dbPath, binderId, zipPath, ...summary }, null, 2));
  if (!commit) console.log("\nDry run only. Re-run with --commit after reviewing this report.");
} finally {
  db.close();
}
