import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

export default defineConfig(({ mode }) => {
  // Read root .env files; deployment environment variables take precedence.
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const WEB_PORT = Number(env.WEB_PORT ?? 5173);
  const SERVER_PORT = Number(env.SERVER_PORT ?? 5174);
  const APP_VERSION = (JSON.parse(fs.readFileSync(path.resolve(__dirname, "../server/package.json"), "utf8")) as { version: string }).version;
  const allowedHosts = [
    "localhost",
    "127.0.0.1",
    ...(env.WEB_DM_ALLOWED_HOSTS ?? "").split(",").map((host) => host.trim()).filter(Boolean),
  ];

  return {
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    define: {
      __SERVER_PORT__: SERVER_PORT,
      __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
    build: {
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
            if (normalizedId.includes("/shared/src/domain/") || normalizedId.includes("/shared/src/api/")) {
              return "shared-domain";
            }
            if (normalizedId.includes("/src/store/")) return "dm-store";
            // Deliberately no manual bucket for src/drawers/: the drawer implementations
            // are lazy-loaded per drawer type (see drawers/registry.tsx), and grouping them
            // into one forced chunk name pulls in everything that reaches ANY of them,
            // including the glue that App.tsx imports eagerly. Left to Rollup's automatic
            // splitting, each drawer implementation gets its own small on-demand chunk.
            if (normalizedId.includes("/src/domain/")) return "dm-domain";
            if (normalizedId.includes("/src/services/")) return "dm-services";
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
