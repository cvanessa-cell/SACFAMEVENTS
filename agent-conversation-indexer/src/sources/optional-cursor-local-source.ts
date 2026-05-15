import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { RawSourcePayload } from "../types";

const MAX_BYTES = 500_000;

function candidateRoots(): string[] {
  const h = os.homedir();
  const plat = os.platform();
  const out: string[] = [];
  if (plat === "win32") {
    out.push(
      path.join(h, "AppData", "Roaming", "Cursor"),
      path.join(h, ".cursor"),
    );
  } else if (plat === "darwin") {
    out.push(
      path.join(h, "Library", "Application Support", "Cursor"),
      path.join(h, ".cursor"),
    );
  } else {
    out.push(path.join(h, ".config", "Cursor"), path.join(h, ".cursor"));
  }
  return out;
}

/** Only reads allowlisted plain-text / small json-ish files — no cookies DB. */
export function loadOptionalCursorLocal(opts: {
  allowedAbsolutePaths: string[];
  indexerRoot?: string;
}): RawSourcePayload[] {
  if (!opts.allowedAbsolutePaths.length) return [];

  const out: RawSourcePayload[] = [];
  for (const root of opts.allowedAbsolutePaths) {
    if (!root || !fs.existsSync(root)) continue;
    const st = fs.statSync(root);
    if (st.isFile()) ingestFile(root, out);
    else readTree(root, out);
  }

  return out;
}

export function describeCursorStorageCandidates(logger: {
  warn: (...a: unknown[]) => void;
  info: (...a: unknown[]) => void;
}): string[] {
  const c = candidateRoots();
  logger.info(`Optional Cursor candidate roots (may not contain plaintext transcripts):\n${c.join("\n")}`);
  logger.warn(
    "Cursor local conversation storage was often not safely discoverable as plaintext. Prefer manual exports in agent-conversation-indexer/imports/.",
  );
  return c;
}

function readTree(absDir: string, acc: RawSourcePayload[]) {
  let ents: fs.Dirent[];
  try {
    ents = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }

  const low = absDir.toLowerCase();
  if (low.includes("cookies") || low.includes("cookies-journal")) return;

  for (const e of ents) {
    const fp = path.join(absDir, e.name);
    try {
      if (e.isDirectory()) {
        if (["Cache", "GPUCache", "Code Cache", "CachedData"].includes(e.name)) continue;
        readTree(fp, acc);
      } else {
        ingestFile(fp, acc);
      }
    } catch {
      /* skip */
    }
  }
}

function ingestFile(fp: string, acc: RawSourcePayload[]) {
  const ext = path.extname(fp).toLowerCase();
  if (![".md", ".txt", ".json", ".jsonl", ".log"].includes(ext)) return;
  const st = fs.statSync(fp);
  if (st.size > MAX_BYTES) return;
  const raw = fs.readFileSync(fp, "utf8");
  acc.push({
    sourceType: "cursor_local_optional",
    sourcePath: fp,
    rawText: raw,
    suggestedTitle: path.basename(fp),
    conversationDate: st.mtime.toISOString(),
    metadata: { optionalLocal: true },
  });
}
