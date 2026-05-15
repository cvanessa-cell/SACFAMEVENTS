import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { createEventExtractionJob } from "@/lib/openai/createEventExtractionJob";
import { toFacebookEventsUrl } from "@/lib/events/facebookParser";
import {
  firecrawlFetch,
  isFirecrawlConfigured,
} from "@/lib/events/firecrawlFetcher";
import { parseICal, icalEventsToText } from "@/lib/events/icalParser";
import { parseRssFeed, rssItemsToText } from "@/lib/events/rssParser";
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

async function fetchSourceText(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<{ text: string; status: number }> {
  const { timeoutMs = 15000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "FamilyEventsMonitor/1.0 (+public-source-checker)",
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    return { text: await res.text(), status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches a source's content. For `facebook_public` and `firecrawl` strategies,
 * uses the Firecrawl headless-browser API to render JS and bypass anti-bot
 * defenses. For everything else, uses a plain fetch.
 */
async function fetchForStrategy(
  sourceUrl: string,
  fetchStrategy: string,
): Promise<{ text: string; status: number }> {
  if (fetchStrategy === "facebook_public") {
    if (!isFirecrawlConfigured()) {
      throw new Error(
        "FIRECRAWL_API_KEY required for Facebook sources (Facebook blocks direct HTTP requests). Add the key in .env — see .env.example.",
      );
    }
    const eventsUrl = toFacebookEventsUrl(sourceUrl) ?? sourceUrl;
    const result = await firecrawlFetch(eventsUrl);
    return { text: result.text, status: result.status };
  }

  if (fetchStrategy === "firecrawl") {
    if (!isFirecrawlConfigured()) {
      throw new Error(
        "FIRECRAWL_API_KEY required for firecrawl-strategy sources.",
      );
    }
    const result = await firecrawlFetch(sourceUrl);
    return { text: result.text, status: result.status };
  }

  return fetchSourceText(sourceUrl);
}

function normalizeForStrategy(raw: string, fetchStrategy: string): string {
  switch (fetchStrategy) {
    case "rss_parse": {
      const feed = parseRssFeed(raw);
      return rssItemsToText(feed);
    }
    case "ical_parse": {
      const cal = parseICal(raw);
      return icalEventsToText(cal);
    }
    case "facebook_public":
    case "firecrawl":
      // Firecrawl already returns clean markdown — only collapse whitespace.
      return raw.replace(/\s+/g, " ").trim();
    default:
      return normalizeFetchedContent(raw);
  }
}

export async function checkSingleSource(sourceId: string) {
  const source = await prisma.eventSource.findUnique({ where: { id: sourceId } });
  if (!source) {
    return { status: "failed" as const, error: "Source not found" };
  }
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
    const { text, status } = await fetchForStrategy(
      source.sourceUrl,
      source.fetchStrategy,
    );
    const normalized = normalizeForStrategy(text, source.fetchStrategy);
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
