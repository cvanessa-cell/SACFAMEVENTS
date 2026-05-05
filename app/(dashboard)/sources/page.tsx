import { SourceTable } from "@/components/SourceTable";

export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Family Event Sources</h1>
        <p className="text-muted-foreground">
          Data is authored in your Airtable base (table &quot;Family Event
          Sources&quot;). This UI will load live rows in the next milestone.
        </p>
      </header>
      <SourceTable />
    </div>
  );
}
