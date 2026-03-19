import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);
const SERVER_PORT = Number(process.env.SERVER_PORT ?? 5174);

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  define: {
    __SERVER_PORT__: SERVER_PORT,
  },
  server: {
    host: true,
    port: WEB_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${SERVER_PORT}`,
        configure: (proxy) => { proxy.on("error", () => {}); },
      },
      "/campaign-images": {
        target: `http://127.0.0.1:${SERVER_PORT}`,
        configure: (proxy) => { proxy.on("error", () => {}); },
      },
      "/player-images": {
        target: `http://127.0.0.1:${SERVER_PORT}`,
        configure: (proxy) => { proxy.on("error", () => {}); },
      },
      "/ws": {
        target: `http://127.0.0.1:${SERVER_PORT}`,
        ws: true,
        changeOrigin: true,
        configure: (proxy) => { proxy.on("error", () => {}); },
      },
    },
  },
});