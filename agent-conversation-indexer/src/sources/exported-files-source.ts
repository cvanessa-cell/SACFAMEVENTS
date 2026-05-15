import fs from "node:fs";
import path from "node:path";

import type { RawSourcePayload } from "../types";

const EXTS = new Set([".md", ".txt", ".json", ".jsonl"]);

export function loadExportedFiles(importDir: string): RawSourcePayload[] {
  if (!fs.existsSync(importDir)) return [];

  const out: RawSourcePayload[] = [];

  function walk(dir: string) {
    for (const name of fs.readdirSync(dir)) {
      const fp = path.join(dir, name);
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) walk(fp);
      else {
        const ext = path.extname(name).toLowerCase();
        if (!EXTS.has(ext)) continue;
        const rawText = fs.readFileSync(fp, "utf8");
        out.push({
          sourceType: "exported_file",
          sourcePath: fp,
          rawText,
          suggestedTitle: deriveTitle(rawText, name),
          conversationDate: stat.mtime?.toISOString(),
          metadata: { importFileSize: stat.size },
        });
      }
    }
  }

  walk(importDir);
  return out;
}

function deriveTitle(raw: string, fname: string): string {
  const h1 = raw.match(/^#\s+(.+)/m)?.[1];
  if (h1) return h1.trim().slice(0, 140);
  return fname.replace(/\.\w+$/, "");
}
