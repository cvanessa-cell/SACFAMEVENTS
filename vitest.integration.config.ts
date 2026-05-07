import path from "node:path";

import { defineConfig } from "vitest/config";

/** Live credential checks — run with `npm run test:integration`. */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.integration.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
