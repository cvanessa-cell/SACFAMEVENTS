import cron from "node-cron";

let activeJob: ReturnType<typeof cron.schedule> | undefined;

/** Local-only cron bootstrap; deployment targets will swap adapters. */
export function startManualSchedulerCron(
  cronExpression: string,
  handler: () => Promise<void>,
): void {
  if (process.env.DISABLE_SCHEDULER_CRON === "1") return;
  activeJob?.stop();
  activeJob = cron.schedule(cronExpression, () => void handler(), {
    timezone:
      process.env.DEFAULT_TIMEZONE?.trim() ?? "America/Los_Angeles",
  });
}

export function stopManualSchedulerCron(): void {
  activeJob?.stop();
}
