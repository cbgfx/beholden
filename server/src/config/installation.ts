import path from "node:path";
import { fileURLToPath } from "node:url";

// Both src/config/installation.ts and the production bundle at
// dist/runtime/main.js are two directories below the server root.
export const serverRootDir = fileURLToPath(new URL("../../", import.meta.url));
export const repoRootDir = path.resolve(serverRootDir, "..");
