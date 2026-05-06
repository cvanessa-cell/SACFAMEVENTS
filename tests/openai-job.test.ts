import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();
const mockPrisma = {
  aiEventExtractionJob: { create: vi.fn() },
  sourceChange: { update: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/openai/client", () => ({
  getOpenAIClient: () => ({ responses: { create: mockCreate } }),
}));

describe("createEventExtractionJob", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.OPENAI_MODEL = "gpt-5.5";
  });

  it("creates background response job", async () => {
    mockCreate.mockResolvedValue({ id: "resp_123" });
    mockPrisma.aiEventExtractionJob.create.mockResolvedValue({ id: "job_123" });
    const { createEventExtractionJob } = await import("@/lib/openai/createEventExtractionJob");
    await createEventExtractionJob({
      sourceChangeId: "change_1",
      sourceName: "Source",
      sourceUrl: "https://example.com",
      changedText: "text",
    });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ background: true }));
  });
});
