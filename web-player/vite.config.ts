import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const WEB_PORT = Number(process.env.WEB_PLAYER_PORT ?? 5175);
const SERVER_PORT = Number(process.env.SERVER_PORT ?? 5174);

const allowedHosts = [
  "player.beholdenapp.com",
  "localhost",
  "127.0.0.1",
];

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  define: {
    __SERVER_PORT__: SERVER_PORT,
  },
  base: "/",
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          return id.includes("react-router-dom") ? "vendor-router" : undefined;
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
