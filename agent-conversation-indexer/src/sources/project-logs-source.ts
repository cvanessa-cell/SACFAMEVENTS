import fs from "node:fs";
import path from "node:path";

import type { RawSourcePayload } from "../types";

const FOLDERS = [
  "logs",
  "reports",
  "agent-reports",
  "debug",
  "runs",
  "output",
  "artifacts",
  "tmp",
  "test-results",
  "coverage",
  "playwright-report",
  "cypress",
  "docs",
  "notes",
];

const EXTS = new Set([".md", ".txt", ".json", ".jsonl", ".log"]);

const SKIP_DIR = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "agent-conversation-indexer",
]);

const MAX_BYTES = 2_000_000;

export function loadProjectLogs(projectRoot: string): RawSourcePayload[] {
  const out: RawSourcePayload[] = [];

  for (const rel of FOLDERS) {
    const dir = path.join(projectRoot, rel);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    walk(dir, projectRoot, out);
  }

  return out;
}

function walk(dir: string, projectRoot: string, acc: RawSourcePayload[]) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR.has(ent.name)) continue;
      walk(fp, projectRoot, acc);
      continue;
    }
    const ext = path.extname(ent.name).toLowerCase();
    if (!EXTS.has(ext)) continue;

    try {
      const st = fs.statSync(fp);
      if (st.size > MAX_BYTES) continue;
      const rawText = fs.readFileSync(fp, "utf8");
      acc.push({
        sourceType: "project_log",
        sourcePath: path.relative(projectRoot, fp) || fp,
        rawText,
        suggestedTitle: `log:${path.basename(fp)}`,
        conversationDate: st.mtime.toISOString(),
        metadata: {},
      });
    } catch {
      /* skip */
    }
  }
}
