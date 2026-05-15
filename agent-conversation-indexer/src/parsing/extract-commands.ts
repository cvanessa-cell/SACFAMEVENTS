import type { CommandRun } from "../types";

const START =
  /^\s*\$?\s*(npm|pnpm|yarn|bun|npx|git|node|tsx|ts-node|prisma|supabase|pytest|docker|pwsh|powershell|curl)\b/i;

const LINE_CMD =
  /(?:^|\n)\s*\$?\s*((?:npm|pnpm|yarn|bun|npx)\s+(?:run\s+\S+|install|exec|test|lint|build|dev|preview|[^\n]+))\s*$/gim;

const GIT_BLOCK = /(?:^|\n)\s*(git\s+[a-z0-9][^\n]*)$/gim;

const DOCKER_RUN = /\bdocker\s+(?:run|build|compose|exec)\s+[^\n]+/gi;

/**
 * Bound command length per line so we avoid swallowing transcripts.
 */
const MAX_LEN = 800;

export function extractCommands(text: string): CommandRun[] {
  const cmds = new Set<string>();

  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.length < 4 || t.length > MAX_LEN) continue;
    if (START.test(t)) {
      cmds.add(t.replace(/^\$\s*/, "").slice(0, MAX_LEN));
    }
  }

  let m: RegExpExecArray | null;
  LINE_CMD.lastIndex = 0;
  while ((m = LINE_CMD.exec(text))) {
    cmds.add(m[1].trim().slice(0, MAX_LEN));
  }

  GIT_BLOCK.lastIndex = 0;
  while ((m = GIT_BLOCK.exec(text))) {
    cmds.add(m[1].trim().slice(0, MAX_LEN));
  }

  DOCKER_RUN.lastIndex = 0;
  while ((m = DOCKER_RUN.exec(text))) {
    cmds.add(m[0].trim().slice(0, MAX_LEN));
  }

  return [...cmds].filter(Boolean).map((command) => ({ command }));
}
