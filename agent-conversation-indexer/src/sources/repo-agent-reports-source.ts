import fs from "node:fs";
import path from "node:path";

import type { RawSourcePayload } from "../types";

const PATTERNS = [
  /files changed/i,
  /commands run/i,
  /tests run/i,
  /final report/i,
  /cursor response/i,
  /agent response/i,
  /implementation complete/i,
  /acceptance criteria/i,
  /root cause/i,
  /next steps/i,
  /remaining todos/i,
];

const SKIP = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "extension/chrome/dist",
]);

const EXT = new Set([".md", ".txt", ".json", ".log"]);
const MAX_BYTES = 2_500_000;

export function loadRepoAgentReports(projectRoot: string): RawSourcePayload[] {
  const out: RawSourcePayload[] = [];
  walk(projectRoot, projectRoot, out);
  return out;
}

function walk(dir: string, projectRoot: string, acc: RawSourcePayload[]) {
  const base = path.basename(dir);
  if (SKIP.has(base)) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(fp, projectRoot, acc);
      continue;
    }
    const ext = path.extname(ent.name).toLowerCase();
    if (!EXT.has(ext)) continue;

    try {
      const rel = path.relative(projectRoot, fp);
      /* avoid double-scanning indexer imports/output */
      if (rel.startsWith(`agent-conversation-indexer${path.sep}`)) continue;

      const st = fs.statSync(fp);
      if (st.size > MAX_BYTES) continue;
      const text = fs.readFileSync(fp, "utf8");
      const hit = PATTERNS.some((r) => r.test(text));
      if (!hit) continue;

      acc.push({
        sourceType: "repo_agent_report",
        sourcePath: rel,
        rawText: text,
        suggestedTitle: `Report: ${ent.name}`,
        conversationDate: st.mtime.toISOString(),
        metadata: { matcher: true },
      });
    } catch {
      /* skip */
    }
  }
}
