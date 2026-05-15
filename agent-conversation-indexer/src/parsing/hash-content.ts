import { createHash } from "node:crypto";

export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Short stable ID from arbitrary string */
export function idFromDedupePart(s: string, len = 32): string {
  return hashContent(s).slice(0, len);
}
