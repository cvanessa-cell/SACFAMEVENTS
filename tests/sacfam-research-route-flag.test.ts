import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  sourceResearchRun: { create: vi.fn(), update: vi.fn() },
  sourceResearchCandidate: { create: vi.fn() },
  eventSource: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/airtable/eventSourceCatalogRepository", () => ({
  listExistingAirtableSourcesForDedupe: vi.fn(async () => []),
  createEventSourceRecord: vi.fn(async () => ({
    ok: false,
    message: "disabled in tests",
  })),
}));
vi.mock("@/lib/airtable/sourceCandidateRepository", () => ({
  createSourceCandidateRecords: vi.fn(async () => ({
    ok: false,
    message: "disabled in tests",
  })),
  updateSourceCandidateByCandidateId: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/airtable/sourceResearchRunRepository", () => ({
  createSourceResearchRunRecord: vi.fn(async () => ({
    ok: false,
    message: "disabled in tests",
  })),
  updateSourceResearchRunRecord: vi.fn(async () => ({ ok: true })),
}));

function setEnv(values: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("/api/admin/sources/research route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setEnv({
      CRON_SECRET: "test-secret",
      OPENAI_API_KEY: undefined,
      SACFAM_AI_SOURCE_AGENT_ENABLED: "true",
    });
  });

  afterEach(() => {
    setEnv({ CRON_SECRET: undefined, SACFAM_AI_SOURCE_AGENT_ENABLED: undefined });
  });

  it("rejects unauthorized callers with 401", async () => {
    const { POST } = await import("@/app/api/admin/sources/research/route");
    const res = await POST(new Request("http://localhost/", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("returns a graceful 400 with openai_key_missing reason when no API key", async () => {
    const { POST } = await import("@/app/api/admin/sources/research/route");
    const res = await POST(
      new Request("http://localhost/", {
        method: "POST",
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; reason?: string };
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("openai_key_missing");
    expect(mockPrisma.sourceResearchRun.create).not.toHaveBeenCalled();
  });

  it("returns a graceful 400 when the flag is off", async () => {
    setEnv({ OPENAI_API_KEY: "test-key", SACFAM_AI_SOURCE_AGENT_ENABLED: "false" });
    const { POST } = await import("@/app/api/admin/sources/research/route");
    const res = await POST(
      new Request("http://localhost/", {
        method: "POST",
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; reason?: string };
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("source_agent_flag_off");
  });
});
