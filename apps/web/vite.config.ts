import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { apiRuntimeCaching } from "./src/pwa/runtime-caching";

const apiHost = process.env.API_HOST ?? "localhost";
const apiPort = process.env.API_PORT ?? "3000";
const webPort = Number(process.env.WEB_PORT ?? 5173);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // the app registers the worker itself (virtual:pwa-register/react)
      injectRegister: null,
      includeAssets: ["icons/*.png", "favicon.svg"],
      manifest: {
        name: "Multiplication Learning",
        short_name: "Mult Learning",
        description: "Earn screen time by mastering the multiplication table.",
        theme_color: "#0f172a",
        background_color: "#f1f5f9",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        // the app shell is precached, the api is never cached
        runtimeCaching: [...apiRuntimeCaching],
        navigateFallback: "index.html",
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
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
