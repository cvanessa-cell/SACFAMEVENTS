import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";

function toBool(v: string): boolean {
  return String(v).trim().toLowerCase() === "true";
}

async function main() {
  const csvPath = path.join(process.cwd(), "data", "family-event-sources.template.csv");
  const raw = await fs.readFile(csvPath, "utf8");
  const [header, ...rows] = raw.split(/\r?\n/).filter(Boolean);
  const keys = header.split(",");

  let created = 0;
  for (const row of rows) {
    const values = row.split(",");
    const item = Object.fromEntries(keys.map((k, i) => [k, values[i] ?? ""]));
    if (!item.name || !item.source_url) continue;
    await prisma.eventSource.upsert({
      where: { sourceUrl: item.source_url },
      create: {
        name: item.name,
        category: item.category || null,
        region: item.region || null,
        city: item.city || null,
        county: item.county || null,
        sourceUrl: item.source_url,
        sourceType: item.source_type || "unknown",
        fetchStrategy: item.fetch_strategy || "direct_fetch",
        checkFrequencyMinutes: Number(item.check_frequency_minutes || "360"),
        enabled: toBool(item.enabled || "true"),
        trustedSourceScore: Number(item.trusted_source_score || "0.5"),
        notes: item.notes || null,
      },
      update: {
        name: item.name,
        category: item.category || null,
        region: item.region || null,
        city: item.city || null,
        county: item.county || null,
        sourceType: item.source_type || "unknown",
        fetchStrategy: item.fetch_strategy || "direct_fetch",
        checkFrequencyMinutes: Number(item.check_frequency_minutes || "360"),
        enabled: toBool(item.enabled || "true"),
        trustedSourceScore: Number(item.trusted_source_score || "0.5"),
        notes: item.notes || null,
      },
    });
    created += 1;
  }

  console.log(`Seeded/updated ${created} event sources.`);
}

void main();
