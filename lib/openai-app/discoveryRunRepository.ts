import type { Prisma } from "@prisma/client";

import type { DailyWebEvent } from "@/lib/events/dailyWebEventDiscoverySchema";
import { prisma } from "@/lib/prisma";

const DEFAULT_TTL_HOURS = 24;

export interface DiscoveryRunSummary {
  candidatesFound: number;
  candidatesValid: number;
  duplicatesSkipped: number;
  dateWindow: { startDate: string; endDate: string };
}

export async function createDiscoveryRun(input: {
  city?: string;
  lookaheadDays: number;
  limit: number;
  dryRun: boolean;
  startDate: string;
  endDate: string;
  candidates: DailyWebEvent[];
  summary?: DiscoveryRunSummary;
}): Promise<{ discovery_run_id: string; expiresAt: string }> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + DEFAULT_TTL_HOURS);

  const row = await prisma.openAiAppDiscoveryRun.create({
    data: {
      expiresAt,
      status: "pending",
      city: input.city ?? null,
      lookaheadDays: input.lookaheadDays,
      limit: input.limit,
      dryRun: input.dryRun,
      startDate: input.startDate,
      endDate: input.endDate,
      candidatesJson: input.candidates as unknown as Prisma.InputJsonValue,
      summaryJson: input.summary
        ? (input.summary as unknown as Prisma.InputJsonValue)
        : undefined,
    },
  });

  return { discovery_run_id: row.id, expiresAt: expiresAt.toISOString() };
}

export async function getDiscoveryRun(
  discoveryRunId: string,
): Promise<
  | {
      ok: true;
      run: {
        id: string;
        status: string;
        expiresAt: Date;
        startDate: string;
        endDate: string;
        candidates: DailyWebEvent[];
      };
    }
  | { ok: false; reason: "not_found" | "expired" | "already_saved"; message: string }
> {
  const row = await prisma.openAiAppDiscoveryRun.findUnique({
    where: { id: discoveryRunId },
  });
  if (!row) {
    return { ok: false, reason: "not_found", message: "Discovery run not found." };
  }
  if (row.status === "saved") {
    return {
      ok: false,
      reason: "already_saved",
      message: "This discovery run was already saved.",
    };
  }
  if (row.expiresAt < new Date() || row.status === "expired") {
    await prisma.openAiAppDiscoveryRun.update({
      where: { id: row.id },
      data: { status: "expired" },
    });
    return { ok: false, reason: "expired", message: "Discovery run has expired." };
  }

  const candidates = row.candidatesJson as unknown as DailyWebEvent[];
  return {
    ok: true,
    run: {
      id: row.id,
      status: row.status,
      expiresAt: row.expiresAt,
      startDate: row.startDate,
      endDate: row.endDate,
      candidates: Array.isArray(candidates) ? candidates : [],
    },
  };
}

export async function markDiscoveryRunSaved(discoveryRunId: string): Promise<void> {
  await prisma.openAiAppDiscoveryRun.update({
    where: { id: discoveryRunId },
    data: { status: "saved" },
  });
}
