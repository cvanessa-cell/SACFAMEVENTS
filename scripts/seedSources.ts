import "dotenv/config";

type SourceSeed = {
  sourceName: string;
  sourceType: string;
  cityArea?: string;
  links: {
    website?: string;
    facebook?: string;
    source?: string;
  };
  bestFor?: string;
};

/** Curated anchors from workshop notes – expand toward 100+ via `/api/events/discover` + OpenAI. */
export const SAMPLE_SOURCES: SourceSeed[] = [
  {
    sourceName: "Sacramento4Kids Events Calendar",
    sourceType: "Regional calendar",
    cityArea: "Sacramento region",
    links: {
      website: "https://sacramento4kids.com",
    },
    bestFor: "Family calendar roundups",
  },
  {
    sourceName: "Roseville City School District",
    sourceType: "School District",
    cityArea: "Roseville",
    links: { website: "https://www.rcsdk8.org/" },
    bestFor: "District-wide events",
  },
  {
    sourceName: "Facebook Group: Real Moms of Sac and Placer County",
    sourceType: "Facebook Group",
    cityArea: "Sacramento / Placer",
    links: { facebook: "https://www.facebook.com/groups/example" },
    bestFor: "Community posted pop-ups",
  },
  {
    sourceName: "BusyKids Play Town and Coffee Shop",
    sourceType: "Indoor Play",
    cityArea: "Roseville",
    links: { website: "https://www.busykids.ca/" },
    bestFor: "Open play specials",
  },
];

async function main() {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.warn("Missing AIRTABLE_* env vars — nothing uploaded.");
    return;
  }

  console.log(
    `Prepared ${SAMPLE_SOURCES.length} seed rows. Upsert batches will arrive after write endpoints land.`,
  );
}

void main();
