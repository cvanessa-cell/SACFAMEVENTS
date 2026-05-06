import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendSlackSignal } from "@/lib/slack/projectSignals";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

function buildDecisionSignature(input: {
  severity: "info" | "warning" | "critical";
  summary: string;
  rationale: string;
  recommendedAction: string;
}): string {
  return JSON.stringify({
    severity: input.severity,
    summary: input.summary,
    rationale: input.rationale,
    recommendedAction: input.recommendedAction,
  });
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [
    changedSources24h,
    failedChecks24h,
    aiFailed24h,
    jobsSent24h,
    jobsCompleted24h,
    newEvents24h,
    approvedEvents24h,
    needsReviewCount,
  ] = await Promise.all([
    prisma.sourceFetchLog.count({ where: { status: "changed", createdAt: { gte: since } } }),
    prisma.sourceFetchLog.count({ where: { status: "failed", createdAt: { gte: since } } }),
    prisma.aiEventExtractionJob.count({ where: { status: "failed", updatedAt: { gte: since } } }),
    prisma.aiEventExtractionJob.count({ where: { status: "sent", updatedAt: { gte: since } } }),
    prisma.aiEventExtractionJob.count({ where: { status: "completed", updatedAt: { gte: since } } }),
    prisma.familyEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.familyEvent.count({ where: { status: "approved", updatedAt: { gte: since } } }),
    prisma.familyEvent.count({ where: { status: "needs_review" } }),
  ]);

  const autoDecisionEnabled = envBool("SLACK_AUTO_DECISION_ENABLED", true);
  const failedCheckThreshold = envNumber("SLACK_DECISION_FAILED_CHECKS_THRESHOLD", 3);
  const aiFailedThreshold = envNumber("SLACK_DECISION_AI_FAILED_THRESHOLD", 2);
  const reviewBacklogThreshold = envNumber("SLACK_DECISION_REVIEW_BACKLOG_THRESHOLD", 25);
  const decisionCooldownHours = envNumber("SLACK_DECISION_COOLDOWN_HOURS", 24);
  const inactivePauseDays = envNumber("SLACK_DECISION_PAUSE_AFTER_INACTIVE_DAYS", 3);

  await sendSlackSignal({
    type: "digest",
    severity: failedChecks24h > 0 || aiFailed24h > 0 ? "warning" : "info",
    module: "eventPipeline",
    summary: "24h event pipeline digest",
    impact:
      needsReviewCount > 0
        ? `${needsReviewCount} events currently waiting for admin review.`
        : "No pending review backlog.",
    recommendedAction:
      failedChecks24h > 0 || aiFailed24h > 0
        ? "Prioritize source/webhook failure triage before adding new extraction features."
        : "Pipeline healthy. Continue improving extraction quality and review ergonomics.",
    metadata: {
      changed_sources_24h: changedSources24h,
      failed_source_checks_24h: failedChecks24h,
      ai_failed_jobs_24h: aiFailed24h,
      ai_jobs_sent_24h: jobsSent24h,
      ai_jobs_completed_24h: jobsCompleted24h,
      new_events_24h: newEvents24h,
      approved_events_24h: approvedEvents24h,
      needs_review_open: needsReviewCount,
    },
  });

  if (autoDecisionEnabled) {
    const conditions = {
      failedChecksHigh: failedChecks24h >= failedCheckThreshold,
      aiFailuresHigh: aiFailed24h >= aiFailedThreshold,
      reviewBacklogHigh: needsReviewCount >= reviewBacklogThreshold,
      completionLag: jobsSent24h > jobsCompleted24h,
    };

    let decisionSummary = "Maintain current extraction strategy and continue quality tuning.";
    let decisionRationale = "No high-risk pipeline indicators crossed configured thresholds.";
    let decisionSeverity: "info" | "warning" | "critical" = "info";
    let recommendedAction =
      "Focus Cursor prompts on extraction precision improvements and review UX enhancements.";

    if (conditions.failedChecksHigh || conditions.aiFailuresHigh || conditions.reviewBacklogHigh) {
      decisionSeverity = conditions.aiFailuresHigh || conditions.failedChecksHigh ? "critical" : "warning";
      decisionSummary = "Prioritize pipeline reliability over new feature work.";
      decisionRationale =
        "One or more health indicators exceeded thresholds (source failures, AI failures, or review backlog).";
      recommendedAction =
        "Generate Cursor tasks for source-check resilience, webhook parsing robustness, and review queue reduction.";
    } else if (conditions.completionLag) {
      decisionSeverity = "warning";
      decisionSummary = "Prioritize extraction throughput and completion monitoring.";
      decisionRationale = "Jobs sent in the last 24h exceed completed jobs, indicating possible processing lag.";
      recommendedAction =
        "Investigate webhook processing latency and add targeted retries/alerts before expanding source coverage.";
    }

    const signature = buildDecisionSignature({
      severity: decisionSeverity,
      summary: decisionSummary,
      rationale: decisionRationale,
      recommendedAction,
    });
    const previous = await prisma.slackDecisionState.findUnique({
      where: { id: "singleton" },
    });
    const nowMs = Date.now();
    const inactiveMs = inactivePauseDays * 24 * 60 * 60 * 1000;
    const cooldownMs = decisionCooldownHours * 60 * 60 * 1000;
    const isInactive =
      !previous?.lastHumanActivityAt ||
      nowMs - previous.lastHumanActivityAt.getTime() >= inactiveMs;
    const inCooldown =
      Boolean(previous?.lastDecisionPostedAt) &&
      nowMs - previous.lastDecisionPostedAt.getTime() < cooldownMs;
    const changed = previous?.lastSignature !== signature;
    if (changed && !isInactive && !inCooldown) {
      await sendSlackSignal({
        type: "decision",
        severity: decisionSeverity,
        module: "eventPipeline",
        summary: decisionSummary,
        suspectedCause: decisionRationale,
        recommendedAction,
        metadata: {
          changed_sources_24h: changedSources24h,
          failed_source_checks_24h: failedChecks24h,
          ai_failed_jobs_24h: aiFailed24h,
          ai_jobs_sent_24h: jobsSent24h,
          ai_jobs_completed_24h: jobsCompleted24h,
          needs_review_open: needsReviewCount,
          thresholds: {
            failed_checks: failedCheckThreshold,
            ai_failed: aiFailedThreshold,
            review_backlog: reviewBacklogThreshold,
          },
        },
      });
      await prisma.slackDecisionState.upsert({
        where: { id: "singleton" },
        create: {
          id: "singleton",
          lastSignature: signature,
          lastSummary: decisionSummary,
          lastDecisionPostedAt: new Date(),
        },
        update: {
          lastSignature: signature,
          lastSummary: decisionSummary,
          lastDecisionPostedAt: new Date(),
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    summary: {
      changedSources24h,
      failedChecks24h,
      aiFailed24h,
      jobsSent24h,
      jobsCompleted24h,
      newEvents24h,
      approvedEvents24h,
      needsReviewCount,
    },
  });
}

export async function POST(req: Request) {
  return GET(req);
}
