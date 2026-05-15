import type { ExtractedError } from "../types";
import { hashContent } from "./hash-content";

const ERR_LINE =
  /(?:error|failed|failure|exception|stack trace|TypeError|ReferenceError|Prisma|P1001|P2002|P2003|P2025|SQLITE_|ENOTFOUND|EADDRINUSE|timeout|deadline_exceeded|ERR_|build failed|test failed)/i;

export function extractErrors(text: string): ExtractedError[] {
  const lines = text.split("\n");
  const out: ExtractedError[] = [];
  const seen = new Set<string>();

  const push = (message: string, extra?: Partial<ExtractedError>) => {
    const key = hashContent(message.toLowerCase().slice(0, 240));
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ message: message.trim().slice(0, 2000), ...extra });
  };

  let carry = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (ERR_LINE.test(trimmed) || /^at\s+/.test(trimmed) || carry) {
      if (ERR_LINE.test(trimmed) && carry && carry.length > 20) {
        push(carry);
        carry = "";
      }
      if (ERR_LINE.test(trimmed)) {
        carry = trimmed;
      } else if (carry) {
        carry += `\n${trimmed}`;
        if (carry.length > 4000) {
          push(carry);
          carry = "";
        }
      }
    }
  }
  if (carry.length > 10) push(carry);

  return out;
}
