export const dynamic = "force-dynamic";

import { GoogleAccountsCard } from "@/components/GoogleAccountsCard";
import { SettingsPanel } from "@/components/SettingsPanel";

export default function SettingsRoutePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Settings &amp; automation</h1>
        <p className="max-w-3xl text-muted-foreground">
          Connect one or more Google accounts, pick a default calendar per
          account, and configure scheduler cadence, auto-confirmation
          thresholds, default reminders, and Zapier delivery. Values persist in
          Postgres so cron jobs and API routes share the same source of truth.
        </p>
      </header>
      <GoogleAccountsCard />
      <SettingsPanel />
    </div>
  );
}
