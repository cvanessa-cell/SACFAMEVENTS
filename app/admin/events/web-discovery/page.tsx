export const dynamic = "force-dynamic";

import { WebDiscoveryPanel } from "@/app/admin/events/web-discovery/WebDiscoveryPanel";
import { readDailyWebEventDiscoveryConfig } from "@/lib/events/dailyWebEventDiscoveryEnv";

export default function WebDiscoveryPage() {
  const config = readDailyWebEventDiscoveryConfig();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">Web event discovery</h1>
        <p className="text-sm text-muted-foreground">
          Daily OpenAI web search for new family-friendly events. Airtable source
          preferences guide search; the public web is the primary discovery surface.
        </p>
      </div>
      <WebDiscoveryPanel
        enabled={config.enabled}
        dryRun={config.dryRun}
        limit={config.limit}
        lookaheadDays={config.lookaheadDays}
        model={config.model}
        hasOpenAiKey={config.hasOpenAiKey}
        hasAirtableConfig={config.hasAirtableConfig}
      />
    </div>
  );
}
