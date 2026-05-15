import { syncApprovedEventToAirtable } from "@/lib/airtable";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const CTX = "autoReview";

interface ReviewVerdict {
  eventId: string;
  title: string;
  action: "approved" | "rejected";
  reasons: string[];
}

interface AutoReviewResult {
  processed: number;
  approved: number;
  rejected: number;
  verdicts: ReviewVerdict[];
}

/**
 * Checks each `needs_review` event against quality/completeness rules.
 * Events that pass all checks are approved (and synced to Airtable).
 * Events that fail critical checks are rejected.
 */
export async function runAutoReview(): Promise<AutoReviewResult> {
  const events = await prisma.familyEvent.findMany({
    where: { status: "needs_review" },
    include: { source: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  if (events.length === 0) {
    logger.info("No events pending review", CTX);
    return { processed: 0, approved: 0, rejected: 0, verdicts: [] };
  }

  logger.info(`Auto-reviewing ${events.length} events`, CTX);
  const verdicts: ReviewVerdict[] = [];

  for (const ev of events) {
    const failures = evaluateEvent(ev);

    if (failures.length === 0) {
      await prisma.familyEvent.update({
        where: { id: ev.id },
        data: { status: "approved" },
      });
      await prisma.eventReviewNote.create({
        data: {
          familyEventId: ev.id,
          note: "Auto-approved: passed all verification checks.",
        },
      });

      try {
        await syncApprovedEventToAirtable(ev);
      } catch (err) {
        logger.error(
          `Airtable sync failed for auto-approved event ${ev.id}`,
          err,
          CTX,
        );
      }

      verdicts.push({
        eventId: ev.id,
        title: ev.title,
        action: "approved",
        reasons: ["passed_all_checks"],
      });
    } else {
      await prisma.familyEvent.update({
        where: { id: ev.id },
        data: { status: "rejected" },
      });
      await prisma.eventReviewNote.create({
        data: {
          familyEventId: ev.id,
          note: `Auto-rejected: ${failures.join(", ")}.`,
        },
      });

      verdicts.push({
        eventId: ev.id,
        title: ev.title,
        action: "rejected",
        reasons: failures,
      });
    }
  }

  const approved = verdicts.filter((v) => v.action === "approved").length;
  const rejected = verdicts.filter((v) => v.action === "rejected").length;

  logger.info(
    `Auto-review complete: ${approved} approved, ${rejected} rejected out of ${events.length}`,
    CTX,
  );

  return { processed: events.length, approved, rejected, verdicts };
}

/**
 * Returns an array of failure reasons. Empty array = event passes verification.
 */
function evaluateEvent(ev: {
  title: string;
  description?: string | null;
  startDatetime?: Date | null;
  endDatetime?: Date | null;
  city?: string | null;
  venueName?: string | null;
  address?: string | null;
  sourceEventUrl?: string | null;
  confidence?: number | null;
  ageRange?: string | null;
  priceText?: string | null;
  familyFriendlyScore?: number | null;
}): string[] {
  const failures: string[] = [];

  if (!ev.title || ev.title.trim().length < 3) {
    failures.push("missing_or_short_title");
  }

  if (!ev.startDatetime) {
    failures.push("missing_start_date");
  } else {
    const now = new Date();
    const sixMonthsOut = new Date(now);
    sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);

    if (ev.startDatetime < now) {
      failures.push("event_in_past");
    }
    if (ev.startDatetime > sixMonthsOut) {
      failures.push("event_too_far_in_future");
    }
  }

  if (!ev.city && !ev.venueName && !ev.address) {
    failures.push("no_location_info");
  }

  if (
    typeof ev.confidence === "number" &&
    ev.confidence < 0.4
  ) {
    failures.push("low_confidence");
  }

  if (
    typeof ev.familyFriendlyScore === "number" &&
    ev.familyFriendlyScore < 0.3
  ) {
    failures.push("low_family_friendly_score");
  }

  if (looksLikeSpamOrAd(ev.title, ev.description)) {
    failures.push("spam_or_ad_content");
  }

  return failures;
}

const SPAM_PATTERNS = [
  /\b(buy now|order now|limited offer|act fast|click here)\b/i,
  /\b(viagra|casino|crypto|forex|weight loss)\b/i,
  /\${2,}/,
  /!!{3,}/,
];

function looksLikeSpamOrAd(
  title: string,
  description?: string | null,
): boolean {
  const text = `${title} ${description ?? ""}`;
  return SPAM_PATTERNS.some((p) => p.test(text));
}
