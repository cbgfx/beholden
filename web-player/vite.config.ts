import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

export default defineConfig(({ mode }) => {
  // Read root .env files; deployment environment variables take precedence.
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const WEB_PORT = Number(env.WEB_PLAYER_PORT ?? 5175);
  const SERVER_PORT = Number(env.SERVER_PORT ?? 5174);
  const APP_VERSION = (JSON.parse(fs.readFileSync(path.resolve(__dirname, "../server/package.json"), "utf8")) as { version: string }).version;
  const allowedHosts = [
    "localhost",
    "127.0.0.1",
    ...(env.WEB_PLAYER_ALLOWED_HOSTS ?? "").split(",").map((host) => host.trim()).filter(Boolean),
  ];

  return {
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    define: {
      __SERVER_PORT__: SERVER_PORT,
      __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
    base: "/",
    build: {
      outDir: "dist",
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replaceAll("\\", "/");
            const locale = /\/src\/i18n\/locales\/([^/]+)\//.exec(normalizedId)?.[1];
            if (locale && locale !== "en") return `locale-${locale}`;
            if (normalizedId.includes("/node_modules/react-router-dom/")) return "vendor-router";
            if (normalizedId.includes("/node_modules/react/") || normalizedId.includes("/node_modules/react-dom/")) {
              return "vendor-react";
            }
            // Character transfer validation is only needed on the lazy home screen. Keeping it out
            // of the broad shared-domain chunk avoids making Zod part of every player-app startup.
            if (normalizedId.includes("/shared/src/domain/characterExport")) return "character-export-schema";
            if (normalizedId.includes("/shared/src/domain/") || normalizedId.includes("/shared/src/api/")) {
              return "shared-domain";
            }
            if (normalizedId.includes("/src/domain/character/")) return "player-character-domain";

            // Keep heavy character rules in a dedicated async chunk that can be cached across
            // CharacterView, CharacterCreatorView, and LevelUpView.
            if (
              normalizedId.includes("/domain/character/parseFeatureEffects") ||
              normalizedId.includes("/domain/character/parseFeatureEffectsDerived")
            ) {
              return "character-feature-effects";
            }

            return undefined;
          },
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: WEB_PORT,
      strictPort: true,
      allowedHosts,
      fs: {
        // shared/ sits outside this app's root, and its icons load their SVGs through an
        // import.meta.glob. Without this, Vite (and Vitest, which uses the same config) refuses to
        // read them: "Denied ID .../shared/src/icons/svg/....svg?raw".
        allow: [path.resolve(__dirname, "..")],
      },
      proxy: {
        "/api": {
          target: `http://localhost:${SERVER_PORT}`,
          configure: (proxy) => {
            proxy.on("error", () => {});
          },
        },
        "/campaign-images": {
          target: `http://localhost:${SERVER_PORT}`,
          configure: (proxy) => {
            proxy.on("error", () => {});
          },
        },
        "/player-images": {
          target: `http://localhost:${SERVER_PORT}`,
          configure: (proxy) => {
            proxy.on("error", () => {});
          },
        },
        "/character-images": {
          target: `http://localhost:${SERVER_PORT}`,
          configure: (proxy) => {
            proxy.on("error", () => {});
          },
        },
        "/binder-mortal-images": {
          target: `http://localhost:${SERVER_PORT}`,
          configure: (proxy) => {
            proxy.on("error", () => {});
          },
        },
        "/ws": {
          target: `http://localhost:${SERVER_PORT}`,
          ws: true,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on("error", () => {});
            proxy.on("proxyReqWs", (_proxyReq, _req, socket) => {
              socket.on("error", () => {});
            });
          },
        },
      },
    },
    preview: {
      host: "0.0.0.0",
      port: WEB_PORT,
      strictPort: true,
      allowedHosts,
    },
  };
});
