import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/openai-app/openaiAppEnv", () => ({
  checkOpenAiAppAvailability: vi.fn(),
  getOpenAiAppStatusSnapshot: vi.fn(() => ({
    openAiAppEnabled: false,
    mcpEndpointUrl: "http://localhost:3333/mcp",
  })),
}));

import { checkOpenAiAppAvailability } from "@/lib/openai-app/openaiAppEnv";
import { handleGetDailyEventDiscoveryStatus } from "@/lib/openai-app/mcpTools";

describe("openai-app MCP tools", () => {
  beforeEach(() => {
    vi.mocked(checkOpenAiAppAvailability).mockReset();
  });

  it("returns safe error when app disabled", async () => {
    vi.mocked(checkOpenAiAppAvailability).mockReturnValue({
      ok: false,
      reason: "openai_app_disabled",
      message: "SACFAM_OPENAI_APP_ENABLED is false.",
    });

    const result = await handleGetDailyEventDiscoveryStatus();
    const text = result.content[0]?.text ?? "";
    expect(text).toContain("openAiAppEnabled");
    expect(text).not.toMatch(/sk-/);
  });
});
