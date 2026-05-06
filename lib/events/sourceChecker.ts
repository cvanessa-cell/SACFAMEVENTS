import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { createEventExtractionJob } from "@/lib/openai/createEventExtractionJob";
import { notifySourceCheckFailure, notifySourceContentChanged } from "@/lib/slack/projectSignals";

export function normalizeFetchedContent(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stableHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function fetchSourceText(url: string, timeoutMs = 15000): Promise<{ text: string; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "FamilyEventsMonitor/1.0 (+public-source-checker)" },
    });
    return { text: await res.text(), status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkSingleSource(sourceId: string) {
  const source = await prisma.eventSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("Source not found");
  if (!source.enabled || source.fetchStrategy === "disabled" || source.fetchStrategy === "manual_review") {
    await prisma.sourceFetchLog.create({
      data: {
        sourceId: source.id,
        startedAt: new Date(),
        finishedAt: new Date(),
        status: "skipped",
      },
    });
    return { status: "skipped" as const };
  }

  const startedAt = new Date();
  try {
    const { text, status } = await fetchSourceText(source.sourceUrl);
    const normalized = normalizeFetchedContent(text);
    const hash = stableHash(normalized);
    const changed = hash !== source.lastContentHash;

    await prisma.sourceFetchLog.create({
      data: {
        sourceId: source.id,
        startedAt,
        finishedAt: new Date(),
        status: changed ? "changed" : "unchanged",
        httpStatus: status,
        contentHash: hash,
        contentLength: normalized.length,
      },
    });

    await prisma.eventSource.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: new Date(),
        lastSuccessAt: new Date(),
        lastStatus: changed ? "changed" : "unchanged",
        lastError: null,
        ...(changed
          ? { lastContentHash: hash, lastSnapshotText: normalized.slice(0, 60000) }
          : {}),
      },
    });

    if (!changed) return { status: "unchanged" as const };

    const change = await prisma.sourceChange.create({
      data: {
        sourceId: source.id,
        oldHash: source.lastContentHash,
        newHash: hash,
        changeSummary: "Source content hash changed.",
        changedTextExcerpt: normalized.slice(0, 2500),
        fullSnapshotText: normalized.slice(0, 60000),
        status: "pending_ai",
      },
    });

    const job = await createEventExtractionJob({
      sourceChangeId: change.id,
      sourceName: source.name,
      sourceUrl: source.sourceUrl,
      sourceCategory: source.category,
      changedText: normalized,
    });

    await notifySourceContentChanged({
      sourceId: source.id,
      sourceName: source.name,
      sourceChangeId: change.id,
      aiJobId: job.id,
    });

    return { status: "changed" as const, sourceChangeId: change.id, aiJobId: job.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown source fetch error";
    await prisma.sourceFetchLog.create({
      data: {
        sourceId: source.id,
        startedAt,
        finishedAt: new Date(),
        status: "failed",
        errorMessage: message,
      },
    });
    await prisma.eventSource.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: new Date(),
        lastFailureAt: new Date(),
        lastStatus: "failed",
        lastError: message,
      },
    });
    await notifySourceCheckFailure({
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.sourceUrl,
      error: message,
    });
    return { status: "failed" as const, error: message };
  }
}

export async function checkDueSources(batchSize: number) {
  const now = Date.now();
  const sources = await prisma.eventSource.findMany({
    where: {
      enabled: true,
      fetchStrategy: { notIn: ["disabled", "manual_review"] },
    },
    orderBy: [{ lastCheckedAt: "asc" }, { createdAt: "asc" }],
  });

  const due = sources.filter((s) => {
    if (!s.lastCheckedAt) return true;
    const intervalMs = Math.max(1, s.checkFrequencyMinutes) * 60 * 1000;
    return s.lastCheckedAt.getTime() + intervalMs <= now;
  });

  const results = [];
  for (const source of due.slice(0, batchSize)) {
    results.push({ sourceId: source.id, ...(await checkSingleSource(source.id)) });
  }
  return results;
}
