import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // The real package throws outside a React Server Components build; tests import server code directly.
      "server-only": fileURLToPath(new URL("./lib/server/test-server-only.ts", import.meta.url)),
    },
  },
  // No real Meta calls from tests: the key starts empty; tests that need one set a fake key and mock fetch.
  test: { environment: "node", include: ["lib/**/*.test.ts"], testTimeout: 30_000, env: { MODEL_API_KEY: "" } },
});
