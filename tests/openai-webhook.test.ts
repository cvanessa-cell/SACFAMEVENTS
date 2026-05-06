import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  aiEventExtractionJob: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  sourceChange: {
    update: vi.fn(),
  },
};

const mockUpsertExtractedEvents = vi.fn();
const mockRetrieve = vi.fn();
const mockUnwrap = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/events/upsertExtractedEvents", () => ({ upsertExtractedEvents: mockUpsertExtractedEvents }));
vi.mock("@/lib/openai/client", () => ({
  getOpenAIClient: () => ({
    webhooks: { unwrap: mockUnwrap },
    responses: { retrieve: mockRetrieve },
  }),
}));

describe("processOpenAIWebhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.OPENAI_WEBHOOK_SECRET = "sec_test";
  });

  it("rejects invalid signatures", async () => {
    mockUnwrap.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const { processOpenAIWebhook } = await import("@/lib/openai/webhookProcessor");
    const result = await processOpenAIWebhook("{}", {});
    expect(result.status).toBe(400);
  });

  it("marks failed jobs on response.failed", async () => {
    mockUnwrap.mockReturnValue({ type: "response.failed", data: { id: "resp_1" } });
    mockPrisma.aiEventExtractionJob.findUnique.mockResolvedValue({
      id: "job_1",
      sourceChangeId: "change_1",
      sourceChange: { source: {} },
    });
    const { processOpenAIWebhook } = await import("@/lib/openai/webhookProcessor");
    const result = await processOpenAIWebhook("{}", {});
    expect(result.status).toBe(200);
    expect(mockPrisma.aiEventExtractionJob.update).toHaveBeenCalled();
    expect(mockPrisma.sourceChange.update).toHaveBeenCalled();
  });

  it("handles response.completed retrieval + parse", async () => {
    mockUnwrap.mockReturnValue({ type: "response.completed", data: { id: "resp_2" } });
    mockPrisma.aiEventExtractionJob.findUnique.mockResolvedValue({
      id: "job_2",
      sourceChangeId: "change_2",
      sourceChange: { id: "change_2", source: { id: "src_1" } },
    });
    mockRetrieve.mockResolvedValue({
      output_text: JSON.stringify({
        source_summary: "ok",
        new_events: [],
        updated_events: [],
        cancelled_events: [],
        irrelevant_content: [],
        warnings: [],
      }),
    });
    const { processOpenAIWebhook } = await import("@/lib/openai/webhookProcessor");
    const result = await processOpenAIWebhook("{}", {});
    expect(result.status).toBe(200);
    expect(mockRetrieve).toHaveBeenCalledWith("resp_2");
    expect(mockUpsertExtractedEvents).toHaveBeenCalled();
  });
});
