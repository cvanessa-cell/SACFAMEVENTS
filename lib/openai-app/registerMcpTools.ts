import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  handleDiscoverFamilyEvents,
  handleGetDailyEventDiscoveryStatus,
  handleListRecentDiscoveredEvents,
  handleSaveDiscoveredEvents,
} from "@/lib/openai-app/mcpTools";

export function registerSacFamOpenAiMcpTools(server: McpServer): void {
  server.registerTool(
    "discover_family_events",
    {
      title: "Discover family events",
      description:
        "Search the public web for family-friendly Sacramento/Placer events. Returns discovery_run_id and ranked candidates with clickable event_url values. Does not write to Airtable.",
      inputSchema: {
        city: z.string().optional(),
        lookaheadDays: z.number().int().min(1).max(60).optional(),
        limit: z.number().int().min(1).max(9).optional(),
        dryRun: z.boolean().optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args) => handleDiscoverFamilyEvents(args),
  );

  server.registerTool(
    "save_discovered_events",
    {
      title: "Save discovered events",
      description:
        "Save selected event indexes from a prior discover_family_events run to Airtable as Need Review. Requires discovery_run_id, eventIndexes, and confirmSave=true.",
      inputSchema: {
        discovery_run_id: z.string().min(1),
        eventIndexes: z.array(z.number().int().min(1)).min(1),
        confirmSave: z.boolean(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args) => handleSaveDiscoveredEvents(args),
  );

  server.registerTool(
    "get_daily_event_discovery_status",
    {
      title: "Discovery status",
      description:
        "Return OpenAI/Airtable/discovery configuration status and MCP endpoint URL (no secrets).",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => handleGetDailyEventDiscoveryStatus(),
  );

  server.registerTool(
    "list_recent_discovered_events",
    {
      title: "List recent discovered events",
      description:
        "List recent Airtable Family Events created by the daily OpenAI web discovery automation.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).optional(),
        days: z.number().int().min(1).max(90).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args) => handleListRecentDiscoveredEvents(args),
  );
}
