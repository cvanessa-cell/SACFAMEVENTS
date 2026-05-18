"use server";

import { revalidatePath } from "next/cache";

import { readDailyWebEventDiscoveryConfig } from "@/lib/events/dailyWebEventDiscoveryEnv";
import {
  runDailyWebEventDiscovery,
  type DailyWebEventDiscoverySummary,
} from "@/lib/events/dailyWebEventDiscoveryService";

const PATHS = ["/admin/events/web-discovery", "/admin/event-review", "/events"];

function revalidate() {
  for (const p of PATHS) revalidatePath(p);
}

export async function runWebDiscoveryDryRunAction(): Promise<DailyWebEventDiscoverySummary> {
  const config = readDailyWebEventDiscoveryConfig();
  const summary = await runDailyWebEventDiscovery({
    dryRun: true,
    limit: config.limit,
    lookaheadDays: config.lookaheadDays,
  });
  revalidate();
  return summary;
}

export async function runWebDiscoveryAndSaveAction(): Promise<DailyWebEventDiscoverySummary> {
  const config = readDailyWebEventDiscoveryConfig();
  const summary = await runDailyWebEventDiscovery({
    dryRun: false,
    limit: config.limit,
    lookaheadDays: config.lookaheadDays,
  });
  revalidate();
  return summary;
}
