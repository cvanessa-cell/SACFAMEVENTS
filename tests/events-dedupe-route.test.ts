import { afterEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  familyEvent: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  eventReviewNote: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("POST /api/events/dedupe auth", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    setEnv({ CRON_SECRET: undefined });
  });

  it("rejects unauthenticated callers", async () => {
    setEnv({ CRON_SECRET: "test-secret" });
    const { POST } = await import("@/app/api/events/dedupe/route");
    const res = await POST(new Request("http://localhost/api/events/dedupe", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(mockPrisma.familyEvent.findMany).not.toHaveBeenCalled();
  });

  it("rejects wrong bearer token", async () => {
    setEnv({ CRON_SECRET: "test-secret" });
    const { POST } = await import("@/app/api/events/dedupe/route");
    const res = await POST(
      new Request("http://localhost/api/events/dedupe", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("runs dedupe when authorized", async () => {
    setEnv({ CRON_SECRET: "test-secret" });
    mockPrisma.familyEvent.findMany.mockResolvedValue([]);
    const { POST } = await import("@/app/api/events/dedupe/route");
    const res = await POST(
      new Request("http://localhost/api/events/dedupe", {
        method: "POST",
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockPrisma.familyEvent.findMany).toHaveBeenCalled();
  });
});
