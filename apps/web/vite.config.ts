import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiHost = process.env.API_HOST ?? "localhost";
const apiPort = process.env.API_PORT ?? "3000";
const webPort = Number(process.env.WEB_PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "packages/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    host: true,
    port: webPort,
    // The browser only ever talks to the web origin; /api is proxied to the api container.
    proxy: {
      "/api": {
        target: `http://${apiHost}:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: webPort,
  },
});
