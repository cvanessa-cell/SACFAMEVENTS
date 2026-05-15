import fs from "node:fs";
import path from "node:path";

import type { RawSourcePayload } from "../types";

const MAX_BYTES = 400_000;

export function loadCursorProjectFiles(projectRoot: string): RawSourcePayload[] {
  const cursorDir = path.join(projectRoot, ".cursor");
  if (!fs.existsSync(cursorDir) || !fs.statSync(cursorDir).isDirectory()) return [];

  const out: RawSourcePayload[] = [];
  collectMdAndJson(cursorDir, projectRoot, out);
  return out;
}

function collectMdAndJson(absDir: string, projectRoot: string, acc: RawSourcePayload[]) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const fp = path.join(absDir, ent.name);
    if (ent.isDirectory()) {
      collectMdAndJson(fp, projectRoot, acc);
      continue;
    }
    const ext = path.extname(ent.name).toLowerCase();
    if (!(ext === ".md" || ent.name === "mcp.json")) continue;

    try {
      const st = fs.statSync(fp);
      if (st.size > MAX_BYTES) continue;
      const raw = fs.readFileSync(fp, "utf8");

      /** Treat as conversational only if sizable narrative */
      if (raw.length < 280 && ent.name !== "mcp.json") continue;

      acc.push({
        sourceType: "cursor_project_file",
        sourcePath: path.relative(projectRoot, fp),
        rawText: raw.startsWith("{") ? `## Cursor config JSON\n${raw}` : raw,
        suggestedTitle:
          ent.name === "mcp.json" ? ".cursor MCP configuration snapshot" : ent.name.replace(/\.md$/i, ""),
        conversationDate: st.mtime.toISOString(),
        metadata: { kind: ext === ".md" ? "markdown" : "json" },
      });
    } catch {
      /* skip */
    }
  }
}
