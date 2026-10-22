import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
await build({
  absWorkingDir: fileURLToPath(new URL("../", import.meta.url)),
  entryPoints: ["src/main.ts"],
  outfile: "dist/runtime/main.js",
  bundle: true,
  platform: "node",
  target: "node26",
  format: "esm",
  packages: "external",
  // Compile workspace TypeScript into the bundle. Installed packages, including
  // native SQLite/Sharp bindings, continue to load through Node normally.
  plugins: [{
    name: "compile-shared-workspace",
    setup(builder) {
      builder.onResolve({ filter: /^@beholden\/shared(?:\/|$)/ }, (args) => ({
        path: require.resolve(args.path),
      }));
    },
  }],
});
