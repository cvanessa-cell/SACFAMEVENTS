export const dynamic = "force-dynamic";

import { AlertCircle, CheckCircle2, Clock3, Layers3 } from "lucide-react";
import { OpenInAirtableLinks } from "@/components/admin/OpenInAirtableLinks";
import { SourceCandidatesTable } from "@/components/admin/SourceCandidatesTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { readSacfamAgentConfig } from "@/lib/ai/sacfamAgentEnv";
import { listSourceCandidateRecords } from "@/lib/airtable/sourceCandidateRepository";

interface PageProps {
  searchParams?: {
    category?: string;
    priority?: string;
    verification?: string;
    automation?: string;
    duplicate?: string;
  };
}

export default async function SourceCandidatesPage({ searchParams }: PageProps) {
  const config = readSacfamAgentConfig();
  const result = await listSourceCandidateRecords();
  const candidates = result.ok ? result.records : [];
  const counts = candidates.reduce(
    (acc, record) => {
      const status = record.fields["Import Status"];
      const isDuplicate = Boolean(record.fields["Duplicate Of"]) || status === "duplicate";
      acc.total += 1;
      if (status === "pending_review") acc.pending += 1;
      if (status === "imported") acc.imported += 1;
      if (status === "rejected") acc.rejected += 1;
      if (isDuplicate) acc.duplicates += 1;
      return acc;
    },
    { total: 0, pending: 0, imported: 0, rejected: 0, duplicates: 0 },
  );

  const filtered = candidates.filter((record) => {
    const f = record.fields;
    const isDuplicate = Boolean(f["Duplicate Of"]) || f["Import Status"] === "duplicate";
    const category = searchParams?.category ?? "all";
    const priority = searchParams?.priority ?? "all";
    const verification = searchParams?.verification ?? "all";
    const automation = searchParams?.automation ?? "all";
    const duplicate = searchParams?.duplicate ?? "all";
    return (
      (category === "all" || f["Source Category"] === category) &&
      (priority === "all" || f["Review Priority"] === priority) &&
      (verification === "all" || f["Verification Status"] === verification) &&
      (automation === "all" || f["Automation Fit"] === automation) &&
      (duplicate === "all" ||
        (duplicate === "duplicates" && isDuplicate) ||
        (duplicate === "not_duplicates" && !isDuplicate))
    );
  });

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.08] to-background">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Source candidate review</CardTitle>
          <CardDescription className="max-w-2xl">
            Triage AI-generated source candidates before approving them into the operational
            source catalog. Dry-run mode blocks imports. You can also review in the Airtable
            Interface.
          </CardDescription>
          <OpenInAirtableLinks table="sourceCandidates" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Layers3 className="h-4 w-4" />
              Total
            </p>
            <p className="mt-1 text-2xl font-semibold">{counts.total}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Pending review
            </p>
            <p className="mt-1 text-2xl font-semibold">{counts.pending}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Imported
            </p>
            <p className="mt-1 text-2xl font-semibold">{counts.imported}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Rejected
            </p>
            <p className="mt-1 text-2xl font-semibold">{counts.rejected}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
            <p className="text-xs text-muted-foreground">Duplicates auto-rejected</p>
            <p className="mt-1 text-2xl font-semibold">{counts.duplicates}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Review status</CardTitle>
          <CardDescription>
            AI-generated rows remain proposed until an admin approves them.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Dry-run</p>
            <Badge variant={config.dryRun ? "outline" : "default"}>
              {config.dryRun ? "on (approval blocked)" : "off"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Airtable writes</p>
            <Badge variant={config.airtableWriteEnabled ? "default" : "secondary"}>
              {config.airtableWriteEnabled ? "enabled" : "disabled"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Candidates table</p>
            <p className="font-mono text-sm">{config.airtableTables.sourceCandidates}</p>
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
        <Card className="shadow-sm">
          <CardHeader className="space-y-3">
            <div>
              <CardTitle>Candidates ({filtered.length} shown)</CardTitle>
              <CardDescription>
                Filter by category, priority, verification, automation fit, or duplicate status.
                Use Select all to approve or reject multiple candidates at once.
              </CardDescription>
            </div>
            <form className="grid gap-2 sm:grid-cols-5" action="/admin/sources/candidates" method="get">
              <Input name="category" placeholder="Category or all" defaultValue={searchParams?.category ?? "all"} />
              <Input name="priority" placeholder="Priority or all" defaultValue={searchParams?.priority ?? "all"} />
              <Input name="verification" placeholder="Verification or all" defaultValue={searchParams?.verification ?? "all"} />
              <Input name="automation" placeholder="Automation or all" defaultValue={searchParams?.automation ?? "all"} />
              <div className="flex gap-2">
                <select
                  name="duplicate"
                  defaultValue={searchParams?.duplicate ?? "all"}
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">all</option>
                  <option value="duplicates">duplicates</option>
                  <option value="not_duplicates">not duplicates</option>
                </select>
                <Button className="h-9" type="submit" variant="outline">
                  Apply
                </Button>
              </div>
            </form>
          </CardHeader>
          <CardContent>
            <SourceCandidatesTable
              dryRun={config.dryRun}
              rows={filtered.map((record) => {
                const f = record.fields;
                const candidateId = f["Candidate ID"] ?? null;
                const isDuplicate =
                  Boolean(f["Duplicate Of"]) || f["Import Status"] === "duplicate";
                const importStatus = f["Import Status"];
                const alreadyDecided =
                  importStatus === "imported" ||
                  importStatus === "rejected" ||
                  importStatus === "duplicate";
                return {
                  recordId: record.id,
                  candidateId,
                  sourceName: f["Source Name"] ?? "—",
                  notes: f.Notes,
                  websiteUrl: f["Website / Social Link"],
                  sourceCategory: f["Source Category"],
                  cityOrArea: f["City / Area Served"],
                  eventTypes: f["Event Types"],
                  automationFit: f["Automation Fit"],
                  reviewPriority: f["Review Priority"],
                  relevanceScore: f["Relevance Score"],
                  importStatus,
                  verificationStatus: f["Verification Status"],
                  isDuplicate,
                  canApprove: Boolean(
                    candidateId && !config.dryRun && !f["Duplicate Of"] && !alreadyDecided,
                  ),
                  canReject: Boolean(candidateId && !alreadyDecided),
                };
              })}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
