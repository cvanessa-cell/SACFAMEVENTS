import { SourceTable } from "@/components/SourceTable";

export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Family Event Sources</h1>
        <p className="text-muted-foreground">
          Live data from your Airtable base (table &quot;Family Event
          Sources&quot;). Mock rows render here when Airtable credentials are
          missing or the API is unreachable.
        </p>
      </header>
      <SourceTable />
    </div>
  );
}
