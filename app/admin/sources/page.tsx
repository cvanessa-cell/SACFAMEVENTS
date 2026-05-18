export const dynamic = "force-dynamic";

import Link from "next/link";

import { OpenInAirtableLinks } from "@/components/admin/OpenInAirtableLinks";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { readSacfamAgentConfig } from "@/lib/ai/sacfamAgentEnv";
import { listEventSourceRecords } from "@/lib/airtable/eventSourceCatalogRepository";

interface PageProps {
  searchParams?: { q?: string; status?: string; automation?: string };
}

function statusVariant(status?: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "approved") return "default";
  if (status === "rejected" || status === "archived") return "destructive";
  if (status === "paused") return "secondary";
  return "outline";
}

export default async function AirtableSourcesPage({ searchParams }: PageProps) {
  const config = readSacfamAgentConfig();
  const q = searchParams?.q?.trim().toLowerCase() ?? "";
  const status = searchParams?.status ?? "approved";
  const automation = searchParams?.automation ?? "all";
  const result = await listEventSourceRecords();
  const sources = result.ok ? result.records : [];
  const filtered = sources.filter((record) => {
    const f = record.fields;
    const haystack = `${f["Source Name"] ?? ""} ${f["Website / Social Link"] ?? ""} ${
      f["Source Category"] ?? ""
    } ${f["City / Area Served"] ?? ""}`.toLowerCase();
    const matchesQuery = !q || haystack.includes(q);
    const matchesStatus = status === "all" || (f.Status ?? "") === status;
    const matchesAutomation =
      automation === "all" ||
      (automation === "ready" &&
        (f["Automation Fit"] === "excellent" || f["Automation Fit"] === "good"));
    return matchesQuery && matchesStatus && matchesAutomation;
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Airtable source catalog</h1>
        <p className="text-sm text-muted-foreground">
          Approved source records in the SacFamEvents Airtable source database.
          Operational monitoring still uses the Prisma event-source table.
        </p>
        <OpenInAirtableLinks table="eventSources" />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Connection status</CardTitle>
          <CardDescription>
            Airtable writes are server-side and controlled by feature flags.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Airtable config</p>
            <Badge variant={config.hasAirtableConfig ? "default" : "secondary"}>
              {config.hasAirtableConfig ? "configured" : "missing"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Write flag</p>
            <Badge variant={config.airtableWriteEnabled ? "default" : "secondary"}>
              {config.airtableWriteEnabled ? "enabled" : "disabled"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Table</p>
            <p className="font-mono text-sm">{config.airtableTables.eventSources}</p>
          </div>
        </CardContent>
      </Card>

      {!result.ok ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {result.message}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="space-y-3">
            <div>
              <CardTitle>Sources ({filtered.length} shown)</CardTitle>
              <CardDescription>
                Default view shows approved sources. Use Automation Ready to
                find sources that should be connected first.
              </CardDescription>
            </div>
            <form className="flex flex-wrap gap-2" action="/admin/sources" method="get">
              <Input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search name, URL, city..."
                className="sm:w-64"
              />
              <select
                name="status"
                defaultValue={status}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {["approved", "proposed", "rejected", "paused", "archived", "all"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                name="automation"
                defaultValue={automation}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">all automation fits</option>
                <option value="ready">automation ready</option>
              </select>
              <button className="h-9 rounded-md border px-3 text-sm" type="submit">
                Apply
              </button>
              <Link href="/admin/sources/candidates" className="self-center text-sm text-primary underline">
                Review candidates
              </Link>
            </form>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2">Source</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Area</th>
                    <th className="py-2">Automation</th>
                    <th className="py-2">Score</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((record) => {
                    const f = record.fields;
                    return (
                      <tr key={record.id} className="border-b align-top last:border-b-0">
                        <td className="py-2">
                          <p className="font-medium">{f["Source Name"]}</p>
                          {f["Website / Social Link"] ? (
                            <a
                              href={f["Website / Social Link"]}
                              className="text-xs text-primary underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open source URL
                            </a>
                          ) : null}
                        </td>
                        <td className="py-2">{f["Source Category"]}</td>
                        <td className="py-2">{f["City / Area Served"]}</td>
                        <td className="py-2">
                          <Badge variant="outline">{f["Automation Fit"] ?? "unknown"}</Badge>
                        </td>
                        <td className="py-2">{f["Relevance Score"] ?? "—"}</td>
                        <td className="py-2">
                          <Badge variant={statusVariant(f.Status)}>{f.Status ?? "unknown"}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
