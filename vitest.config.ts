import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [["tests/**/*.test.tsx", "jsdom"]],
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
      "agent-conversation-indexer/tests/**/*.test.ts",
    ],
    coverage: { reporter: ["text", "html"] },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
