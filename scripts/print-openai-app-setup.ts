import "dotenv/config";

import { getOpenAiAppStatusSnapshot, resolveMcpEndpointUrl } from "@/lib/openai-app/openaiAppEnv";

const ENV_KEYS = [
  "SACFAM_OPENAI_APP_ENABLED",
  "SACFAM_DAILY_WEB_EVENT_DISCOVERY_ENABLED",
  "SACFAM_DAILY_WEB_EVENT_DISCOVERY_DRY_RUN",
  "OPENAI_API_KEY",
  "OPENAI_DAILY_EVENT_MODEL",
  "AIRTABLE_API_KEY",
  "AIRTABLE_BASE_ID",
  "PUBLIC_APP_BASE_URL",
  "APP_BASE_URL",
  "CRON_SECRET",
  "DATABASE_URL",
] as const;

function present(key: string): boolean {
  const v = process.env[key]?.trim();
  return !!v;
}

function main(): void {
  const snapshot = getOpenAiAppStatusSnapshot();
  const mcpUrl = resolveMcpEndpointUrl();

  console.log("\n=== SacFamEvents Daily Event Finder — OpenAI App Setup ===\n");
  console.log(`MCP URL: ${mcpUrl}`);
  console.log(`PUBLIC_APP_BASE_URL: ${process.env.PUBLIC_APP_BASE_URL?.trim() || "(not set)"}`);
  console.log(`APP_BASE_URL: ${process.env.APP_BASE_URL?.trim() || "(not set)"}`);
  console.log("\nEnvironment checklist:");
  for (const key of ENV_KEYS) {
    console.log(`  ${present(key) ? "✓" : "✗"} ${key}`);
  }

  console.log("\nRuntime status (no secrets):");
  console.log(JSON.stringify(snapshot, null, 2));

  console.log("\n=== Manual ChatGPT connector setup (required) ===\n");
  console.log("There is no official API/CLI to create the connector in your OpenAI account.");
  console.log("After deploying this app with HTTPS and env vars:\n");
  console.log("1. Enable Developer Mode: ChatGPT → Settings → Apps & Connectors → Advanced");
  console.log("2. Settings → Connectors → Create (or Developer Mode → Create app)");
  console.log(`3. Paste MCP URL: ${mcpUrl}`);
  console.log('4. Name: SacFamEvents Daily Event Finder');
  console.log(
    "5. Description: Finds Sacramento-area family events using OpenAI web search and saves reviewed candidates to Airtable.",
  );
  console.log("6. Open a new chat → add the connector → test discover_family_events (dryRun: true)");
  console.log(
    "7. Then save_discovered_events with discovery_run_id, eventIndexes, confirmSave: true\n",
  );
}

main();
