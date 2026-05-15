#!/usr/bin/env node
import path from "node:path";

import { indexerConfigSchema, loadIndexerEnv, readProcessEnv } from "./config";
import { generateReportOnly, runIndexer, runLinearSync, runNotionSync } from "./run-pipeline";

function repoRoot(): string {
  const arg = parseArg("repo");
  const root = arg ? path.resolve(arg) : process.cwd();
  return root;
}

function parseArg(key: string): string | undefined {
  const prefixed = `--${key}=`;
  const hit = process.argv.find((a) => a.startsWith(prefixed));
  if (hit) return hit.slice(prefixed.length);
  const idx = process.argv.indexOf(`--${key}`);
  if (idx >= 0) return process.argv[idx + 1];
  return undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function mapSource(flag?: string): "exported" | "logs" | "cursor" | "reports" | "local" | "all" {
  switch ((flag ?? "all").toLowerCase()) {
    case "exported":
      return "exported";
    case "logs":
      return "logs";
    case "cursor":
      return "cursor";
    case "reports":
      return "reports";
    case "local":
      return "local";
    default:
      return "all";
  }
}

async function doctor(): Promise<void> {
  loadIndexerEnv(process.cwd());
  const parsed = indexerConfigSchema.safeParse(readProcessEnv());
  console.log(parsed.success ? "[OK] Config validates with zod schema." : "[WARN] Partial config issues:");
  if (!parsed.success && parsed.error) console.log(parsed.error.issues.slice(0, 12));

  console.log(`
Summary:
  INDEXER_DRY_RUN defaults to TRUE — no sinks without explicit env.
  Airtable writes need AIRTABLE_API_KEY + AIRTABLE_BASE_ID + INDEXER_DRY_RUN=false.
  Notion/Linear remain opt-in — set NOTION_ENABLED / LINEAR_ENABLED to true when ready.
`);
}

async function main(): Promise<void> {
  const [, , cmdRaw = "help"] = process.argv;
  const cmd = cmdRaw.toLowerCase();
  const source = mapSource(parseArg("source"));

  if (cmd === "help" || cmd === "-h") {
    console.log(`Usage:
  tsx agent-conversation-indexer/src/cli.ts doctor
  tsx agent-conversation-indexer/src/cli.ts scan [--dry-run|--live] [--source=all|exported|logs|cursor|reports|local]
  tsx agent-conversation-indexer/src/cli.ts sync [--source=exported] [--live]
  tsx agent-conversation-indexer/src/cli.ts report [--source=all]
  tsx agent-conversation-indexer/src/cli.ts notion-sync [--source=all]
  tsx agent-conversation-indexer/src/cli.ts linear-sync [--source=all]
  tsx agent-conversation-indexer/src/cli.ts all --dry-run
`);
    return;
  }

  if (cmd === "doctor") {
    await doctor();
    return;
  }

  const root = repoRoot();

  if (cmd === "scan") {
    const dry = hasFlag("--live") ? false : hasFlag("--dry-run") ? true : true;
    await runIndexer({ repoRoot: root, source, dryRunOverride: dry, skipExternal: false });
    return;
  }

  if (cmd === "sync") {
    /** Default: respect env INDEXER_DRY_RUN; `--live` forces writes. */
    const dryRun = hasFlag("--live") ? false : undefined;
    if (dryRun === false) await runIndexer({ repoRoot: root, source, dryRunOverride: false });
    else await runIndexer({ repoRoot: root, source });
    return;
  }

  if (cmd === "report") {
    await generateReportOnly(root, source);
    console.log("Wrote agent-conversation-indexer/output/project-agent-index.md");
    return;
  }

  if (cmd === "notion-sync") {
    await runNotionSync(root, source);
    return;
  }

  if (cmd === "linear-sync") {
    await runLinearSync(root, source);
    return;
  }

  if (cmd === "all") {
    const dry = !hasFlag("--live");
    await runIndexer({ repoRoot: root, source, dryRunOverride: dry });
    await generateReportOnly(root, source);
    console.log("Completed `all`: dry-run + report (see output/).");
    return;
  }

  console.error("Unknown command:", cmd);
  process.exitCode = 1;
}

void main();
