import type { ExtractedActionItem } from "../types";
import { hashContent } from "./hash-content";

const FOLLOW =
  /\b(?:TODO|TBD|FIXME|next step(?:s)?|remaining|follow[- ]up|needs to|needs\s|should\b|must\b|acceptance criteria.*(?:not|incomplete)|unresolved|blocker)\b/i;

function guessType(line: string): ExtractedActionItem["type"] {
  const l = line.toLowerCase();
  if (/\bbug|fix|regression|fail(?:ed|ing)\b/.test(l)) return "bug";
  if (/\bmigrat|schema|prisma|supabase sql\b/.test(l)) return "migration";
  if (/\btest|spec|vitest|jest\b/.test(l)) return "test";
  if (/\bdocument|readme|docs\b/.test(l)) return "docs";
  if (/\brefactor\b/.test(l)) return "refactor";
  if (/\bsetup|bootstrap|configure|install\b/.test(l)) return "setup";
  if (/\binvestigat|spike\b/.test(l)) return "investigation";
  return "follow-up";
}

function confidence(line: string): number {
  let c = 0.55;
  if (/TODO|FIXME|TBD/i.test(line)) c += 0.15;
  if (/\b(next step|follow[- ]up|blocker)/i.test(line)) c += 0.15;
  if (/\bmust|should\b/i.test(line)) c += 0.1;
  return Math.min(0.98, c);
}

export function extractActionItems(text: string): ExtractedActionItem[] {
  const out: ExtractedActionItem[] = [];
  const seen = new Set<string>();

  for (const raw of text.split("\n")) {
    const line = raw.trim().replace(/^[-*]+\s*/, "");
    if (line.length < 12 || line.length > 500) continue;
    if (!FOLLOW.test(line)) continue;
    const key = hashContent(line.toLowerCase());
    if (seen.has(key)) continue;
    seen.add(key);

    const type = guessType(line);
    const prio =
      /\burgent|P0|P1|blocker|critical\b/i.test(line) ? ("high" as const) : undefined;

    out.push({
      title: line.replace(/^[A-Za-z]+:\s*/, "").slice(0, 180),
      description: line,
      type,
      priority: prio,
      confidence: confidence(line),
      status: "new",
    });
  }

  return out;
}
