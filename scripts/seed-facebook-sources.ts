/**
 * Seeds curated Facebook Page sources for Sacramento-area family events.
 *
 * These pages are public and post regular events relevant to families with
 * young children. The source checker uses the `facebook_public` strategy
 * which rewrites them to `mbasic.facebook.com` for scraping.
 *
 * Run: `npx tsx scripts/seed-facebook-sources.ts`
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";

interface FacebookSourceSeed {
  name: string;
  url: string;
  category: string;
  region?: string;
  city?: string;
  county?: string;
  trustedSourceScore?: number;
  notes?: string;
}

const FACEBOOK_SOURCES: FacebookSourceSeed[] = [
  {
    name: "Sacramento4Kids (Facebook)",
    url: "https://www.facebook.com/Sacramento4Kids",
    category: "regional calendar",
    region: "Sacramento region",
    county: "Sacramento",
    trustedSourceScore: 0.85,
    notes: "Long-running Sacramento family events aggregator on FB.",
  },
  {
    name: "Sacramento Parent Magazine (Facebook)",
    url: "https://www.facebook.com/SacramentoParent",
    category: "parent magazine",
    region: "Sacramento region",
    county: "Sacramento",
    trustedSourceScore: 0.8,
    notes: "Posts weekly family event roundups.",
  },
  {
    name: "Visit Sacramento (Facebook)",
    url: "https://www.facebook.com/visitsacramento",
    category: "tourism",
    region: "Sacramento region",
    city: "Sacramento",
    county: "Sacramento",
    trustedSourceScore: 0.75,
    notes: "Official Sacramento tourism — festivals, parades, civic events.",
  },
  {
    name: "Sacramento Public Library (Facebook)",
    url: "https://www.facebook.com/saclibrary",
    category: "library",
    region: "Sacramento region",
    city: "Sacramento",
    county: "Sacramento",
    trustedSourceScore: 0.9,
    notes: "Storytimes, craft programs, summer reading events.",
  },
  {
    name: "Placer County Library (Facebook)",
    url: "https://www.facebook.com/placercountylibrary",
    category: "library",
    region: "Placer County",
    county: "Placer",
    trustedSourceScore: 0.9,
    notes: "Storytimes and family programs across Placer County branches.",
  },
  {
    name: "Roseville Parks, Recreation & Libraries (Facebook)",
    url: "https://www.facebook.com/RosevilleParksRecLib",
    category: "parks and rec",
    region: "Placer County",
    city: "Roseville",
    county: "Placer",
    trustedSourceScore: 0.85,
    notes: "Roseville rec programs, classes, and family events.",
  },
  {
    name: "Rocklin Parks & Recreation (Facebook)",
    url: "https://www.facebook.com/RocklinParks",
    category: "parks and rec",
    region: "Placer County",
    city: "Rocklin",
    county: "Placer",
    trustedSourceScore: 0.85,
    notes: "Rocklin city parks and recreation programs.",
  },
  {
    name: "City of Folsom (Facebook)",
    url: "https://www.facebook.com/CityofFolsom",
    category: "city government",
    region: "Sacramento region",
    city: "Folsom",
    county: "Sacramento",
    trustedSourceScore: 0.8,
    notes: "Folsom community events, concerts, parades.",
  },
  {
    name: "Fairytale Town (Facebook)",
    url: "https://www.facebook.com/fairytaletown",
    category: "kids attraction",
    region: "Sacramento region",
    city: "Sacramento",
    county: "Sacramento",
    trustedSourceScore: 0.9,
    notes: "Special events, member nights, themed days.",
  },
  {
    name: "Sacramento Zoo (Facebook)",
    url: "https://www.facebook.com/SacramentoZoo",
    category: "kids attraction",
    region: "Sacramento region",
    city: "Sacramento",
    county: "Sacramento",
    trustedSourceScore: 0.9,
    notes: "Zoo-hosted family events and seasonal programs.",
  },
  {
    name: "Funderland (Facebook)",
    url: "https://www.facebook.com/FunderlandPark",
    category: "kids attraction",
    region: "Sacramento region",
    city: "Sacramento",
    county: "Sacramento",
    trustedSourceScore: 0.8,
    notes: "Small amusement park geared at young children.",
  },
  {
    name: "Crocker Art Museum (Facebook)",
    url: "https://www.facebook.com/CrockerArtMuseum",
    category: "museum",
    region: "Sacramento region",
    city: "Sacramento",
    county: "Sacramento",
    trustedSourceScore: 0.85,
    notes: "Family art days, exhibits, weekend programs.",
  },
  {
    name: "Powerhouse Science Center (Facebook)",
    url: "https://www.facebook.com/PowerhouseScience",
    category: "museum",
    region: "Sacramento region",
    city: "Sacramento",
    county: "Sacramento",
    trustedSourceScore: 0.85,
    notes: "STEM events and family science nights.",
  },
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const seed of FACEBOOK_SOURCES) {
    const existing = await prisma.eventSource.findUnique({
      where: { sourceUrl: seed.url },
    });
    if (existing) {
      await prisma.eventSource.update({
        where: { sourceUrl: seed.url },
        data: {
          name: seed.name,
          category: seed.category,
          region: seed.region,
          city: seed.city,
          county: seed.county,
          sourceType: "facebook_public",
          fetchStrategy: "facebook_public",
          checkFrequencyMinutes: 720,
          trustedSourceScore: seed.trustedSourceScore ?? 0.75,
          notes: seed.notes,
          enabled: true,
        },
      });
      updated += 1;
    } else {
      await prisma.eventSource.create({
        data: {
          name: seed.name,
          category: seed.category,
          region: seed.region,
          city: seed.city,
          county: seed.county,
          sourceUrl: seed.url,
          sourceType: "facebook_public",
          fetchStrategy: "facebook_public",
          checkFrequencyMinutes: 720,
          trustedSourceScore: seed.trustedSourceScore ?? 0.75,
          notes: seed.notes,
          enabled: true,
        },
      });
      created += 1;
    }
  }

  console.log(`Facebook sources seeded: ${created} created, ${updated} updated.`);
}

void main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
