/**
 * Seeds the database with realistic demo data for all key models.
 * Run with: npx tsx scripts/seed-demo-data.ts
 *
 * Safe to re-run — uses upsert where possible and skips existing records.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";

const SOURCES = [
  {
    name: "Sacramento4Kids Events Calendar",
    category: "Regional calendar",
    region: "Sacramento / Placer",
    city: "Sacramento",
    county: "Sacramento",
    sourceUrl: "https://sacramento4kids.com/events",
    sourceType: "html",
    fetchStrategy: "direct_fetch",
    enabled: true,
    trustedSourceScore: 0.9,
  },
  {
    name: "City of Roseville Parks & Rec",
    category: "Parks & Recreation",
    region: "Sacramento / Placer",
    city: "Roseville",
    county: "Placer",
    sourceUrl: "https://www.roseville.ca.us/government/departments/parks_recreation_and_libraries/events",
    sourceType: "html",
    fetchStrategy: "direct_fetch",
    enabled: true,
    trustedSourceScore: 0.85,
  },
  {
    name: "Folsom City Zoo Sanctuary",
    category: "Zoo / Animals",
    region: "Sacramento / Placer",
    city: "Folsom",
    county: "Sacramento",
    sourceUrl: "https://www.folsom.ca.us/zoo",
    sourceType: "html",
    fetchStrategy: "direct_fetch",
    enabled: true,
    trustedSourceScore: 0.8,
  },
  {
    name: "Sacramento Public Library Events",
    category: "Library",
    region: "Sacramento / Placer",
    city: "Sacramento",
    county: "Sacramento",
    sourceUrl: "https://www.saclibrary.org/Events",
    sourceType: "html",
    fetchStrategy: "direct_fetch",
    enabled: true,
    trustedSourceScore: 0.9,
  },
  {
    name: "Rocklin Community Events RSS",
    category: "Community",
    region: "Sacramento / Placer",
    city: "Rocklin",
    county: "Placer",
    sourceUrl: "https://www.rocklin.ca.us/events/rss",
    sourceType: "rss",
    fetchStrategy: "rss_parse",
    enabled: true,
    trustedSourceScore: 0.75,
  },
  {
    name: "Lincoln Community Calendar (iCal)",
    category: "Community",
    region: "Sacramento / Placer",
    city: "Lincoln",
    county: "Placer",
    sourceUrl: "https://www.lincolnca.gov/events.ics",
    sourceType: "ical",
    fetchStrategy: "ical_parse",
    enabled: true,
    trustedSourceScore: 0.7,
  },
];

function futureDate(daysFromNow: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const EVENTS = [
  {
    title: "Storytime at the Sacramento Library",
    description: "Weekly storytime for kids ages 2-5 with songs, rhymes, and a craft activity.",
    city: "Sacramento",
    county: "Sacramento",
    venueName: "Sacramento Central Library",
    address: "828 I Street, Sacramento, CA 95814",
    start: futureDate(3, 10),
    end: futureDate(3, 11),
    ageRange: "2-5",
    priceText: "Free",
    familyFriendlyScore: 0.95,
    confidence: 0.92,
    status: "approved",
  },
  {
    title: "Folsom Zoo Safari Day",
    description: "Special family day at the Folsom City Zoo Sanctuary with keeper talks and animal encounters.",
    city: "Folsom",
    county: "Sacramento",
    venueName: "Folsom City Zoo Sanctuary",
    address: "403 Stafford St, Folsom, CA 95630",
    start: futureDate(5, 9),
    end: futureDate(5, 14),
    ageRange: "All ages",
    priceText: "$5 per person",
    familyFriendlyScore: 0.98,
    confidence: 0.95,
    status: "approved",
  },
  {
    title: "Roseville Farmers Market",
    description: "Family-friendly farmers market with live music, face painting, and local produce.",
    city: "Roseville",
    county: "Placer",
    venueName: "Vernon Street Town Square",
    address: "311 Vernon St, Roseville, CA 95678",
    start: futureDate(7, 8),
    end: futureDate(7, 13),
    ageRange: "All ages",
    priceText: "Free admission",
    familyFriendlyScore: 0.9,
    confidence: 0.88,
    status: "needs_review",
  },
  {
    title: "Kids Art Workshop – Paint Your Pet",
    description: "Children ages 6-12 can paint a portrait of their favorite pet or animal with guided instruction.",
    city: "Rocklin",
    county: "Placer",
    venueName: "Blue Line Arts",
    address: "405 Vernon St, Roseville, CA 95678",
    start: futureDate(10, 14),
    end: futureDate(10, 16),
    ageRange: "6-12",
    priceText: "$15 per child",
    familyFriendlyScore: 0.92,
    confidence: 0.85,
    status: "needs_review",
  },
  {
    title: "Family Movie Night in the Park",
    description: "Free outdoor movie screening of a family-friendly film. Bring blankets and snacks!",
    city: "Sacramento",
    county: "Sacramento",
    venueName: "McKinley Park",
    address: "3255 H St, Sacramento, CA 95816",
    start: futureDate(14, 19),
    end: futureDate(14, 22),
    ageRange: "All ages",
    priceText: "Free",
    familyFriendlyScore: 0.97,
    confidence: 0.9,
    status: "approved",
  },
  {
    title: "Lincoln STEM Fair",
    description: "Interactive science and engineering exhibits for elementary and middle school students.",
    city: "Lincoln",
    county: "Placer",
    venueName: "Lincoln Community Center",
    address: "6400 Joiner Pkwy, Lincoln, CA 95648",
    start: futureDate(21, 10),
    end: futureDate(21, 15),
    ageRange: "5-14",
    priceText: "Free",
    familyFriendlyScore: 0.94,
    confidence: 0.78,
    status: "needs_review",
  },
  {
    title: "Cancelled: Spring Egg Hunt",
    description: "Annual community egg hunt — cancelled due to scheduling conflict.",
    city: "Roseville",
    county: "Placer",
    venueName: "Maidu Park",
    address: "1550 Maidu Dr, Roseville, CA 95661",
    start: futureDate(2, 10),
    end: futureDate(2, 12),
    ageRange: "3-10",
    priceText: "Free",
    familyFriendlyScore: 0.85,
    confidence: 0.7,
    status: "cancelled",
  },
];

async function main() {
  console.log("Seeding demo data...\n");

  // --- Sources ---
  let sourcesCreated = 0;
  const sourceIds: string[] = [];
  for (const s of SOURCES) {
    const result = await prisma.eventSource.upsert({
      where: { sourceUrl: s.sourceUrl },
      create: {
        name: s.name,
        category: s.category,
        region: s.region,
        city: s.city,
        county: s.county,
        sourceUrl: s.sourceUrl,
        sourceType: s.sourceType,
        fetchStrategy: s.fetchStrategy,
        enabled: s.enabled,
        trustedSourceScore: s.trustedSourceScore,
      },
      update: { name: s.name },
    });
    sourceIds.push(result.id);
    sourcesCreated++;
  }
  console.log(`  Sources: ${sourcesCreated} upserted`);

  // --- Events ---
  let eventsCreated = 0;
  for (let i = 0; i < EVENTS.length; i++) {
    const ev = EVENTS[i];
    const sourceId = sourceIds[i % sourceIds.length];
    const existing = await prisma.familyEvent.findFirst({
      where: { title: ev.title, sourceId },
    });
    if (existing) continue;

    await prisma.familyEvent.create({
      data: {
        title: ev.title,
        description: ev.description,
        city: ev.city,
        county: ev.county,
        venueName: ev.venueName,
        address: ev.address,
        startDatetime: ev.start,
        endDatetime: ev.end,
        ageRange: ev.ageRange,
        priceText: ev.priceText,
        familyFriendlyScore: ev.familyFriendlyScore,
        confidence: ev.confidence,
        status: ev.status,
        sourceId,
      },
    });
    eventsCreated++;
  }
  console.log(`  Events: ${eventsCreated} created`);

  // --- Automation Settings ---
  await prisma.appAutomationSettings.upsert({
    where: { id: "singleton" },
    create: {
      automationEnabled: false,
      frequency: "daily",
      preferredRunTime: "08:00",
      maxSourcesPerRun: 20,
      onlyActiveSources: true,
      autoConfirmHighConfidence: true,
      minConfidenceAutoConfirm: 0.88,
    },
    update: {},
  });
  console.log("  Automation settings: singleton ensured");

  // --- Slack decision state ---
  await prisma.slackDecisionState.upsert({
    where: { id: "singleton" },
    create: {},
    update: {},
  });
  console.log("  Slack decision state: singleton ensured");

  console.log("\nDemo seed complete.");
  await prisma.$disconnect();
}

void main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
