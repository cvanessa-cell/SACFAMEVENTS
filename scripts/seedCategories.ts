import "dotenv/config";

const DEFAULT_CATEGORIES = [
  {
    categoryName: "Master Calendars",
    calendarPrefix: "CAL",
    description: "Multi-venue compilations",
    defaultColor: "#2563EB",
    active: true,
  },
  {
    categoryName: "Libraries & Storytime",
    calendarPrefix: "STORY TIME",
    description: "",
    defaultColor: "#F97316",
    active: true,
  },
  {
    categoryName: "Parks",
    calendarPrefix: "PARK",
    description: "",
    defaultColor: "#16A34A",
    active: true,
  },
];

async function main() {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.warn("Missing AIRTABLE_* env vars — nothing uploaded.");
    return;
  }
  console.table(DEFAULT_CATEGORIES);
  console.info("Awaiting category upsert helpers (Milestone 2).");
}

void main();
