"use client";

import { useQuery } from "@tanstack/react-query";
import * as React from "react";

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
import type { FamilyEventSource } from "@/lib/sources";

type SourcesPayload = {
  source: "airtable" | "mock";
  count: number;
  records: FamilyEventSource[];
  warning?: string;
  airtableError?: boolean;
};

async function fetchSources(): Promise<SourcesPayload> {
  const res = await fetch("/api/sources", { cache: "no-store" });
  const body = (await res.json()) as SourcesPayload;
  if (!res.ok && !body.records) throw new Error("Failed to load sources");
  return body;
}

export function SourceTable() {
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["family-event-sources"],
    queryFn: fetchSources,
  });

  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");

  const records = React.useMemo(
    () => data?.records ?? [],
    [data?.records],
  );

  const types = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of records) if (r.sourceType) set.add(r.sourceType);
    return Array.from(set).sort();
  }, [records]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (typeFilter !== "all" && r.sourceType !== typeFilter) return false;
      if (!q) return true;
      const haystack =
        `${r.sourceName} ${r.cityArea} ${r.bestFor} ${r.notes} ${r.website} ${r.facebook}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [records, search, typeFilter]);

  const isMock = data?.source === "mock";

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Family Event Sources</CardTitle>
          <CardDescription>
            {isLoading
              ? "Loading…"
              : data
                ? `${data.count} ${data.count === 1 ? "row" : "rows"} from ${
                    isMock ? "mock data" : "Airtable"
                  }`
                : "No data yet"}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data ? (
            <Badge variant={isMock ? "secondary" : "default"}>
              {isMock ? "Mock" : "Live"}
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data?.warning ? (
          <div
            className={`rounded border p-3 text-sm ${
              data.airtableError
                ? "border-destructive/50 text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {data.warning}
          </div>
        ) : null}
        {error ? (
          <div className="rounded border border-destructive/50 p-3 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load sources"}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Search name, city, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground sm:ml-auto">
            Showing {filtered.length} of {records.length}
          </span>
        </div>

        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">City / Area</th>
                <th className="px-3 py-2">Links</th>
                <th className="px-3 py-2">Best for</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                    Loading sources…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                    No sources match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.airtableRecordId} className="border-t">
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">{r.sourceName}</div>
                      {r.notes ? (
                        <div className="text-xs text-muted-foreground">
                          {r.notes}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {r.sourceType || "—"}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {r.cityArea || "—"}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col gap-1 text-xs">
                        {r.website ? (
                          <a
                            href={r.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            Website
                          </a>
                        ) : null}
                        {r.facebook ? (
                          <a
                            href={r.facebook}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            Facebook
                          </a>
                        ) : null}
                        {r.sourceLink &&
                        r.sourceLink !== r.website &&
                        r.sourceLink !== r.facebook ? (
                          <a
                            href={r.sourceLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            Source
                          </a>
                        ) : null}
                        {!r.website && !r.facebook && !r.sourceLink ? "—" : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                      {r.bestFor || "—"}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Badge variant={r.active ? "default" : "secondary"}>
                        {r.active ? "Active" : "Paused"}
                      </Badge>
                      {r.priority ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Priority: {r.priority}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
