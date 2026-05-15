/** First-line / prompt-style user request heuristic */
export function extractUserRequest(text: string): string | undefined {
  const head = text.slice(0, 12_000);
  const markers = [/^(?:User|Requester|Goal|Task|Objective)\s*:\s*(.+)$/im, /^#\s*(.+)$/m];

  for (const rx of markers) {
    const m = head.match(rx);
    if (m?.[1]) return m[1].trim().slice(0, 4000);
  }

  const userBlock =
    /\bUser\s*(?:request|prompt|said|message)\b[:\s]+([\s\S]{20,}?)(?=Assistant|Agent|$)/i.exec(head);
  if (userBlock?.[1]) return userBlock[1].trim().slice(0, 4000);

  const trimmed = head.trim().split(/\n\s*\n/)[0];
  if (trimmed && trimmed.length > 40) return trimmed.slice(0, 4000);

  return undefined;
}

const TAG_TERMS =
  /\b(marketing|airtable|supabase|zapier|notion|linear|mcp|campaign|dashboard|lead capture|nurture|calendar|auth|database|migration|ui|tests?|build|bug|provider|webhook|automation|compliance)\b/gi;

export function extractTags(text: string, existing?: string[]): string[] {
  const set = new Set<string>();
  for (const t of existing ?? []) set.add(t);

  TAG_TERMS.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_TERMS.exec(text))) {
    const word = m[1].toLowerCase();
    if (word === "test") set.add("tests");
    else set.add(word);
  }
  return [...set];
}
