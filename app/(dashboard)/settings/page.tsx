import { SettingsPanel } from "@/components/SettingsPanel";

export default function SettingsRoutePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Settings &amp; automation</h1>
        <p className="max-w-3xl text-muted-foreground">
          Configure reminders, scheduler cadence, and optional Zapier webhooks.
          Values persist in SQLite (Prisma) on this machine; master event data stays
          in Airtable.
        </p>
      </header>
      <SettingsPanel />
    </div>
  );
}
