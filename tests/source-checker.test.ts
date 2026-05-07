import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  eventSource: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  sourceFetchLog: { create: vi.fn() },
  sourceChange: { create: vi.fn() },
};
const mockCreateEventExtractionJob = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/openai/createEventExtractionJob", () => ({ createEventExtractionJob: mockCreateEventExtractionJob }));

describe("source checker", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates no source change when hash unchanged", async () => {
    const { stableHash, checkSingleSource } = await import("@/lib/events/sourceChecker");
    mockPrisma.eventSource.findUnique.mockResolvedValue({
      id: "src_1",
      enabled: true,
      fetchStrategy: "direct_fetch",
      sourceUrl: "https://example.com",
      lastContentHash: stableHash("same"),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, text: async () => "same" }));
    const result = await checkSingleSource("src_1");
    expect(result.status).toBe("unchanged");
    expect(mockPrisma.sourceChange.create).not.toHaveBeenCalled();
  });

  it("creates source change when hash changed", async () => {
    const { checkSingleSource } = await import("@/lib/events/sourceChecker");
    mockPrisma.eventSource.findUnique.mockResolvedValue({
      id: "src_2",
      name: "Source",
      category: "city calendars",
      enabled: true,
      fetchStrategy: "direct_fetch",
      sourceUrl: "https://example.com",
      lastContentHash: "old",
    });
    mockPrisma.sourceChange.create.mockResolvedValue({ id: "change_1" });
    mockCreateEventExtractionJob.mockResolvedValue({ id: "job_1" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, text: async () => "different content" }));
    const result = await checkSingleSource("src_2");
    expect(result.status).toBe("changed");
    expect(mockPrisma.sourceChange.create).toHaveBeenCalled();
    expect(mockCreateEventExtractionJob).toHaveBeenCalled();
  });
});
