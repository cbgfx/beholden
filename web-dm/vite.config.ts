import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);
const SERVER_PORT = Number(process.env.SERVER_PORT ?? 5174);

const allowedHosts = [
  "dm.beholdenapp.com",
  "localhost",
  "127.0.0.1",
];

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  define: {
    __SERVER_PORT__: SERVER_PORT,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");
          if (normalizedId.includes("/node_modules/react-router-dom/")) return "vendor-router";
          if (normalizedId.includes("/node_modules/react/") || normalizedId.includes("/node_modules/react-dom/")) {
            return "vendor-react";
          }
          if (normalizedId.includes("/shared/src/domain/") || normalizedId.includes("/shared/src/api/")) {
            return "shared-domain";
          }
          if (normalizedId.includes("/src/store/")) return "dm-store";
          if (normalizedId.includes("/src/drawers/")) return "dm-drawers";
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
});
