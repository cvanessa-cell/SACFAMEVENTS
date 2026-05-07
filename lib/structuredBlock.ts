import {
  STRUCTURED_BLOCK_END,
  STRUCTURED_BLOCK_START,
} from "@/lib/constants";

/**
 * Parses the machine-readable footer embedded in Calendar descriptions.
 */
export function parseStructuredFamilyEventFinderBlock(
  description: string,
): Record<string, string> {
  const start = description.indexOf(STRUCTURED_BLOCK_START);
  const end = description.indexOf(STRUCTURED_BLOCK_END);
  if (start === -1 || end === -1 || end <= start) return {};

  const body = description
    .slice(start + STRUCTURED_BLOCK_START.length, end)
    .trim()
    .split("\n");

  const out: Record<string, string> = {};
  for (const line of body) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}
