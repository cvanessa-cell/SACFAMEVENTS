import type { ExtractedDecision } from "../types";
import { hashContent } from "./hash-content";

const DEC_LINE =
  /^(?:[-*]|\d+\.)?\s*(Decision|Chose|We will|I implemented|The best approach|Root cause|Fixed by|Changed to)\b[:\s]+(.+)/i;

export function extractDecisions(text: string): ExtractedDecision[] {
  const out: ExtractedDecision[] = [];
  const seen = new Set<string>();

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const m = line.match(DEC_LINE);
    if (!m || m.length < 3) continue;
    const seed = `${m[1]}:${m[2]}`;
    const key = hashContent(seed.toLowerCase());
    if (seen.has(key)) continue;
    seen.add(key);

    let rationale: string | undefined;
    let relatedFile: string | undefined;

    const fileMatch = m[2].match(/\b([A-Za-z0-9_@./~-]+\.(?:tsx?|jsx?|json|sql|md))\b/);
    if (fileMatch) relatedFile = fileMatch[1];

    const because = /because\s+(.+)/i.exec(m[2]);
    if (because) rationale = because[1].trim().slice(0, 600);

    out.push({
      text: m[2].trim().slice(0, 900),
      rationale,
      relatedFile,
    });
  }

  return out;
}
