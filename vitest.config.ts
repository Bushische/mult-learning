import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // The workspace package is consumed from source so tests never depend on
      // a stale `packages/shared/dist` build.
      "packages/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
      // vite-plugin-pwa is a build-time plugin — the tests use the stub instead
      "virtual:pwa-register/react": fileURLToPath(
        new URL("./apps/web/src/test/pwa-register-stub.ts", import.meta.url),
      ),
      "virtual:pwa-register": fileURLToPath(
        new URL("./apps/web/src/test/pwa-register-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    // Bare skeleton: the gate must be green before any task adds the first test.
    passWithNoTests: true,
  },
});
