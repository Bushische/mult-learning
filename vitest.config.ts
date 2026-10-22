import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Bare skeleton: the gate must be green before any task adds the first test.
    passWithNoTests: true,
  },
});
