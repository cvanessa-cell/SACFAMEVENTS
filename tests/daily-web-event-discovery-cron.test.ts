import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/events/dailyWebEventDiscoveryService", () => ({
  runDailyWebEventDiscovery: vi.fn().mockResolvedValue({
    ok: true,
    runAt: new Date().toISOString(),
    dateWindow: { startDate: "2026-05-17", endDate: "2026-05-31" },
    sourcePreferencesLoaded: 0,
    candidatesFound: 0,
    candidatesValid: 0,
    duplicatesSkipped: 0,
    eventsSelected: 0,
    eventsCreated: 0,
    dryRun: true,
    errors: [],
    selectedEvents: [],
  }),
}));

vi.mock("@/lib/project/activityHeartbeat", () => ({
  markProjectActivity: vi.fn(),
}));

function setEnv(values: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("cron discover-web-events", () => {
  beforeEach(() => {
    setEnv({
      CRON_SECRET: "test-secret",
      NODE_ENV: "test",
      SACFAM_DAILY_WEB_EVENT_DISCOVERY_DRY_RUN: "true",
    });
  });

  afterEach(() => {
    setEnv({ CRON_SECRET: undefined });
  });

  it("rejects wrong CRON_SECRET", async () => {
    const { GET } = await import("@/app/api/cron/discover-web-events/route");
    const res = await GET(
      new Request("http://localhost/api/cron/discover-web-events", {
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("accepts valid CRON_SECRET", async () => {
    const { GET } = await import("@/app/api/cron/discover-web-events/route");
    const res = await GET(
      new Request("http://localhost/api/cron/discover-web-events", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(200);
  });
});
