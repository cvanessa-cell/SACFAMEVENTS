import { createMcpHandler } from "mcp-handler";

import { registerSacFamOpenAiMcpTools } from "@/lib/openai-app/registerMcpTools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    registerSacFamOpenAiMcpTools(server);
  },
  {
    serverInfo: {
      name: "sacfam-daily-event-finder",
      version: "1.0.0",
    },
  },
  {
    // Route file is already at /mcp; basePath "" → streamable HTTP endpoint /mcp
    basePath: "",
    maxDuration: 60,
    disableSse: true,
    sessionIdGenerator: undefined,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
