import type { ReferencedFile } from "../types";

const LINE_PATH =
  /\b(?:src|app|pages|components|lib|prisma|supabase|migrations|backend|frontend|tests?|scripts|packages)(?:[/\\][A-Za-z0-9_@.\-/+\\]+)+\.(?:ts|tsx|js|jsx|json|sql|md|mjs|cjs|css|scss|py|prisma)\b/gi;

const PKG_MANIFEST =
  /\b(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig(?:\.\w+)?\.json|next\.config\.(?:m?[jt]s|\.ts)|tailwind\.config\.(?:m?[jt]s|\.ts)|vite\.config\.(?:m?[jt]s|\.ts)|vitest(?:\.\w+)?\.config\.(?:m?[jt]s|\.ts)|\.env\.example|README\.md|prisma\/schema\.prisma)\b/gi;

const REL_PATH = /\B(?:\.{1,2}\/[\w\-./]+\.(?:ts|tsx|js|jsx|json|sql|md|css|tsx?))\b/g;

function guessMention(snippet: string): ReferencedFile["mentionType"] {
  const lower = snippet.toLowerCase();
  if (/\b(delete|removed|unlink)\b/.test(lower)) return "deleted";
  if (/\b(create(?:d)?|added|write|wrote)\b/.test(lower)) return "created";
  if (/\b(edit|chang|modify|patch|updated|replac)\b/.test(lower)) return "modified";
  if (/\b(read|opening|inspect|load)\b/.test(lower)) return "read";
  if (/\b(test|vitest|jest|spec)\b/.test(lower)) return "tested";
  return "mentioned";
}

export function extractFileReferences(text: string): ReferencedFile[] {
  const seen = new Set<string>();
  const out: ReferencedFile[] = [];

  const consume = (m: RegExpExecArray | null, contextStart: number, contextLen: number) => {
    if (!m) return;
    const fp = normalizePathSep(m[0]);
    const key = fp.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const ctxSlice = text.slice(
      Math.max(0, m.index - contextStart),
      Math.min(text.length, m.index + contextLen),
    );
    out.push({
      filePath: fp,
      mentionType: guessMention(ctxSlice),
    });
  };

  LINE_PATH.lastIndex = 0;
  let mm: RegExpExecArray | null;
  while ((mm = LINE_PATH.exec(text))) consume(mm, 80, 80);

  PKG_MANIFEST.lastIndex = 0;
  while ((mm = PKG_MANIFEST.exec(text))) consume(mm, 40, 40);

  REL_PATH.lastIndex = 0;
  while ((mm = REL_PATH.exec(text))) consume(mm, 60, 60);

  return out;
}

function normalizePathSep(p: string): string {
  return p.replace(/\\/g, "/");
}
