import { describe, expect, it, vi } from "vitest";

import { indexerConfigSchema } from "../src/config";

describe("cli doctor prerequisites", () => {
  it("parses isolated defaults as dry-run-safe with zod schema", async () => {
    vi.restoreAllMocks();
    const parsed = indexerConfigSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.indexerDryRun).toBe(true);
    expect(parsed.data.notionEnabled).toBe(false);
    expect(parsed.data.linearEnabled).toBe(false);
  });
});
