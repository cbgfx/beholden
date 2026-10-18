import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/** Use the nearest .env, preserving injected values unless local startup overrides them. */
export function loadEnvironment({
  cwd = process.cwd(),
  env = process.env,
  override = false,
}: { cwd?: string; env?: NodeJS.ProcessEnv; override?: boolean } = {}): void {
  const file = [".", "..", path.join("..", "..")]
    .map((relative) => path.resolve(cwd, relative, ".env"))
    .find((candidate) => existsSync(candidate));
  if (!file) return;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, "utf8")))) {
    if (override || env[key] === undefined) env[key] = value;
  }
}
