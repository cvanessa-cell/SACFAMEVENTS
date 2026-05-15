export const dynamic = "force-dynamic";

import Link from "next/link";

import {
  addEventToCalendarAction,
  reviewEventAction,
} from "@/app/admin/actions";
import { AutoReviewButton } from "@/app/admin/event-review/AutoReviewButton";
import { MapEmbed } from "@/components/MapEmbed";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getGoogleEnv,
  listGoogleAccounts,
  type GoogleAccountSummary,
} from "@/lib/googleCalendar";
import { prisma } from "@/lib/prisma";

interface PageProps {
  searchParams?: { status?: string; q?: string };
}

const STATUS_FILTERS = [
  "needs_review",
  "approved",
  "rejected",
  "duplicate",
  "exported_to_calendar",
  "cancelled",
  "all",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function confidenceTone(confidence: number | null): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (confidence == null) return { label: "n/a", variant: "secondary" };
  if (confidence >= 0.85) return { label: confidence.toFixed(2), variant: "default" };
  if (confidence >= 0.6)
    return { label: confidence.toFixed(2), variant: "outline" };
  return { label: confidence.toFixed(2), variant: "destructive" };
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" | "success" {
  switch (status) {
    case "exported_to_calendar":
      return "success";
    case "approved":
      return "default";
    case "rejected":
    case "cancelled":
      return "destructive";
    case "duplicate":
      return "outline";
    default:
      return "secondary";
  }
}

function formatDateTime(start: Date | null, end: Date | null): string {
  if (!start) return "Date TBD";
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  };
  const startStr = start.toLocaleString("en-US", opts);
  if (!end) return startStr;
  const endStr = end.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
  return `${startStr} – ${endStr}`;
}

interface CalendarExportSummary {
  id: string;
  accountId: string | null;
  accountEmail: string;
  accountName: string | null;
  calendarId: string;
  calendarSummary: string | null;
  googleEventId: string;
  htmlLink: string | null;
  exportedAt: Date;
}

export default async function EventReviewPage({ searchParams }: PageProps) {
  const statusParam = (searchParams?.status ?? "needs_review") as StatusFilter;
  const status: StatusFilter = STATUS_FILTERS.includes(statusParam)
    ? statusParam
    : "needs_review";
  const q = searchParams?.q?.trim() ?? "";

  const where = status === "all" ? {} : { status };

  const [events, statusCounts, googleAccounts] = await Promise.all([
    prisma.familyEvent.findMany({
      where: {
        ...where,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { city: { contains: q, mode: "insensitive" as const } },
                { venueName: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        source: true,
        reviewNotes: { orderBy: { createdAt: "desc" }, take: 3 },
        calendarExports: { orderBy: { exportedAt: "desc" } },
      },
      take: 100,
    }),
    prisma.familyEvent.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    listGoogleAccounts().catch(() => [] as GoogleAccountSummary[]),
  ]);

  const googleConfigured = Boolean(getGoogleEnv());
  const googleConnected = googleAccounts.length > 0;

  const counts = new Map(
    statusCounts.map((c) => [c.status, c._count._all] as const),
  );
  const total = statusCounts.reduce((acc, c) => acc + c._count._all, 0);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">Review queue</h1>
          <AutoReviewButton
            needsReviewCount={counts.get("needs_review") ?? 0}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Approve high-confidence extractions, reject false positives, mark
          duplicates. Approved events can be pushed to any of your connected
          Google Calendars.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total events" value={total} />
        <StatCard
          label="Needs review"
          value={counts.get("needs_review") ?? 0}
          tone="info"
        />
        <StatCard label="Approved" value={counts.get("approved") ?? 0} />
        <StatCard
          label="Exported to calendar"
          value={counts.get("exported_to_calendar") ?? 0}
        />
      </section>

      <CalendarStatusBanner
        configured={googleConfigured}
        accounts={googleAccounts}
      />

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <CardTitle>
              {events.length} of {counts.get(status) ?? total} ·{" "}
              <span className="font-mono text-base">{status}</span>
            </CardTitle>
            <CardDescription>
              Use the filter to focus on a status; recently-updated rows
              surface first.
            </CardDescription>
          </div>
          <form
            method="get"
            action="/admin/event-review"
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Title, city, venue…"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm sm:w-56"
            />
            <select
              name="status"
              defaultValue={status}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s} {counts.has(s) ? `(${counts.get(s)})` : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
            >
              Apply
            </button>
            {q || status !== "needs_review" ? (
              <Link
                href="/admin/event-review"
                className="text-xs text-muted-foreground underline"
              >
                Clear
              </Link>
            ) : null}
          </form>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Queue is empty for this filter — nothing to review.
            </p>
          ) : (
            events.map((e) => {
              const conf = confidenceTone(e.confidence);
              const locationQuery =
                [e.venueName, e.address, e.city].filter(Boolean).join(", ") ||
                "";
              const exports: CalendarExportSummary[] = e.calendarExports.map(
                (x) => ({
                  id: x.id,
                  accountId: x.accountId,
                  accountEmail: x.accountEmailSnapshot,
                  accountName: x.accountNameSnapshot,
                  calendarId: x.calendarId,
                  calendarSummary: x.calendarSummarySnapshot,
                  googleEventId: x.googleEventId,
                  htmlLink: x.htmlLink,
                  exportedAt: x.exportedAt,
                }),
              );
              const canExport =
                (e.status === "approved" ||
                  e.status === "exported_to_calendar") &&
                e.startDatetime;
              return (
                <article
                  key={e.id}
                  className="rounded border p-4 text-sm"
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold">{e.title}</h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(e.status)}>
                          {e.status === "exported_to_calendar"
                            ? "Exported to calendar"
                            : e.status}
                        </Badge>
                        <Badge variant={conf.variant}>
                          confidence {conf.label}
                        </Badge>
                        {e.duplicateKey ? (
                          <Badge variant="outline">
                            dup-key {e.duplicateKey.slice(0, 12)}
                          </Badge>
                        ) : null}
                        {exports.length > 0 ? (
                          <Badge variant="success">
                            {exports.length} calendar{" "}
                            {exports.length === 1 ? "export" : "exports"}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ReviewButton
                        eventId={e.id}
                        nextStatus="approved"
                        label="Approve"
                      />
                      <ReviewButton
                        eventId={e.id}
                        nextStatus="duplicate"
                        label="Duplicate"
                        variant="outline"
                      />
                      <ReviewButton
                        eventId={e.id}
                        nextStatus="rejected"
                        label="Reject"
                        variant="destructive"
                      />
                      {e.status !== "needs_review" ? (
                        <ReviewButton
                          eventId={e.id}
                          nextStatus="needs_review"
                          label="Reopen"
                          variant="ghost"
                        />
                      ) : null}
                    </div>
                  </div>

                  <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 text-xs">
                    <DescItem
                      label="When"
                      value={formatDateTime(e.startDatetime, e.endDatetime)}
                    />
                    <DescItem
                      label="Where"
                      value={locationQuery || "—"}
                    />
                    <DescItem
                      label="Source"
                      value={e.source?.name ?? "—"}
                    />
                    <DescItem label="Audience" value={e.ageRange ?? "—"} />
                    <DescItem label="Price" value={e.priceText ?? "—"} />
                    <DescItem
                      label="Updated"
                      value={e.updatedAt.toLocaleString()}
                    />
                  </dl>

                  {e.description ? (
                    <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">
                      {e.description}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    {e.sourceEventUrl ? (
                      <a
                        href={e.sourceEventUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Original event link
                      </a>
                    ) : null}
                    {e.registrationUrl ? (
                      <a
                        href={e.registrationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Registration link
                      </a>
                    ) : null}
                  </div>

                  {locationQuery ? (
                    <details className="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-xs">
                      <summary className="cursor-pointer font-medium">
                        Map preview
                      </summary>
                      <div className="mt-2">
                        <MapEmbed query={locationQuery} height={180} />
                      </div>
                    </details>
                  ) : null}

                  {canExport ? (
                    <CalendarExportPanel
                      eventId={e.id}
                      accounts={googleAccounts}
                      exports={exports}
                      configured={googleConfigured}
                      connected={googleConnected}
                    />
                  ) : exports.length > 0 ? (
                    <CalendarExportPanel
                      eventId={e.id}
                      accounts={googleAccounts}
                      exports={exports}
                      configured={googleConfigured}
                      connected={googleConnected}
                      readOnly
                    />
                  ) : null}

                  {e.reviewNotes.length > 0 ? (
                    <div className="mt-3 space-y-1 border-t pt-2">
                      <div className="text-xs font-medium">Review notes</div>
                      <ul className="space-y-0.5 text-xs text-muted-foreground">
                        {e.reviewNotes.map((n) => (
                          <li key={n.id}>
                            <span className="font-mono">
                              {n.createdAt.toLocaleDateString()}:
                            </span>{" "}
                            {n.note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CalendarExportPanel({
  eventId,
  accounts,
  exports,
  configured,
  connected,
  readOnly = false,
}: {
  eventId: string;
  accounts: GoogleAccountSummary[];
  exports: CalendarExportSummary[];
  configured: boolean;
  connected: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-xs dark:bg-emerald-950/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <CalendarCheckIcon />
          Calendar exports
        </div>
        {exports.length > 0 ? (
          <span className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {exports.length} active
          </span>
        ) : (
          <span className="text-muted-foreground">No exports yet</span>
        )}
      </div>

      {exports.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {exports.map((x) => (
            <li
              key={x.id}
              className="flex flex-wrap items-center gap-2 rounded border border-emerald-200/60 bg-background/60 px-2 py-1"
            >
              <CheckIcon />
              <span className="font-medium">
                {x.calendarSummary || x.calendarId}
              </span>
              <span className="text-muted-foreground">
                · {x.accountName ? `${x.accountName} (${x.accountEmail})` : x.accountEmail}
              </span>
              <span className="text-muted-foreground">
                · {x.exportedAt.toLocaleString()}
              </span>
              {x.htmlLink ? (
                <a
                  href={x.htmlLink}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-primary underline"
                >
                  Open in Google Calendar →
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!readOnly ? (
        <div className="mt-3 border-t border-emerald-200/60 pt-3">
          {!configured ? (
            <p className="text-muted-foreground">
              Google OAuth is not configured. Set <code>GOOGLE_CLIENT_ID</code>,{" "}
              <code>GOOGLE_CLIENT_SECRET</code>, and{" "}
              <code>GOOGLE_REDIRECT_URI</code> to enable export.
            </p>
          ) : !connected ? (
            <p>
              <Link
                className="text-primary underline"
                href={`/api/calendar/auth?return=${encodeURIComponent(
                  "/admin/event-review",
                )}`}
                prefetch={false}
              >
                Connect a Google account
              </Link>{" "}
              to enable export.
            </p>
          ) : (
            <CalendarPicker eventId={eventId} accounts={accounts} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function CalendarPicker({
  eventId,
  accounts,
}: {
  eventId: string;
  accounts: GoogleAccountSummary[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground">
        Pick a calendar to add this event to:
      </p>
      <div className="grid gap-2">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="rounded border bg-background/60 p-2"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {account.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={account.picture}
                  alt={account.email}
                  className="h-5 w-5 rounded-full"
                />
              ) : null}
              <span>{account.name ?? account.email}</span>
              {account.isDefault ? <Badge variant="success">Default</Badge> : null}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {(account.calendars.length > 0
                ? account.calendars
                : [
                    {
                      id: `primary-${account.id}`,
                      calendarId: "primary",
                      summary: "Primary",
                      primary: true,
                    } as GoogleAccountSummary["calendars"][number],
                  ]
              ).map((cal) => (
                <form
                  key={cal.id}
                  action={addEventToCalendarAction}
                  className="inline"
                >
                  <input type="hidden" name="eventId" value={eventId} />
                  <input
                    type="hidden"
                    name="accountId"
                    value={account.id}
                  />
                  <input
                    type="hidden"
                    name="calendarId"
                    value={cal.calendarId}
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                    style={
                      cal.backgroundColor
                        ? {
                            borderColor: cal.backgroundColor,
                          }
                        : undefined
                    }
                    title={`Add to ${cal.summary} (${account.email})`}
                  >
                    + {cal.summary}
                    {cal.primary ? " (primary)" : ""}
                  </button>
                </form>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarStatusBanner({
  configured,
  accounts,
}: {
  configured: boolean;
  accounts: GoogleAccountSummary[];
}) {
  if (configured && accounts.length > 0) {
    return (
      <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <div className="font-semibold">
          {accounts.length} Google account{accounts.length === 1 ? "" : "s"}{" "}
          connected
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          {accounts.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5"
            >
              {a.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.picture}
                  alt={a.email}
                  className="h-4 w-4 rounded-full"
                />
              ) : null}
              {a.email}
              {a.isDefault ? (
                <Badge variant="success">Default</Badge>
              ) : null}
            </span>
          ))}
        </div>
        <div className="mt-2 text-xs">
          <Link
            className="text-primary underline"
            href={`/api/calendar/auth?return=${encodeURIComponent(
              "/admin/event-review",
            )}`}
            prefetch={false}
          >
            + Add another Google account
          </Link>
          {" · "}
          <Link className="text-primary underline" href="/settings">
            Manage in Settings →
          </Link>
        </div>
      </div>
    );
  }
  if (!configured) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
        Google OAuth env vars are missing
        (<code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>,{" "}
        <code>GOOGLE_REDIRECT_URI</code>). Calendar export is disabled until
        these are populated in <code>.env</code> / Vercel.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/30">
      No Google account is connected.{" "}
      <Link
        className="text-primary underline"
        href={`/api/calendar/auth?return=${encodeURIComponent(
          "/admin/event-review",
        )}`}
        prefetch={false}
      >
        Sign in with Google →
      </Link>
    </div>
  );
}

function ReviewButton({
  eventId,
  nextStatus,
  label,
  variant = "default",
}: {
  eventId: string;
  nextStatus: string;
  label: string;
  variant?: "default" | "outline" | "destructive" | "ghost";
}) {
  const cls =
    variant === "destructive"
      ? "border-destructive/40 text-destructive hover:bg-destructive/10"
      : variant === "outline"
        ? "border-input bg-background hover:bg-accent"
        : variant === "ghost"
          ? "border-transparent text-muted-foreground hover:bg-accent"
          : "border-input bg-background hover:bg-accent";
  return (
    <form action={reviewEventAction} className="inline">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="status" value={nextStatus} />
      <button
        type="submit"
        className={`rounded-md border px-2 py-1 text-xs ${cls}`}
      >
        {label}
      </button>
    </form>
  );
}

function DescItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warn" | "info";
}) {
  const accent =
    tone === "warn"
      ? "text-destructive"
      : tone === "info"
        ? "text-primary"
        : "";
  return (
    <div className="rounded border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-emerald-600 dark:text-emerald-400"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CalendarCheckIcon() {
  return (
    <svg
      aria-hidden
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-emerald-700 dark:text-emerald-300"
    >
      <rect x={3} y={4} width={18} height={18} rx={2} ry={2} />
      <line x1={16} y1={2} x2={16} y2={6} />
      <line x1={8} y1={2} x2={8} y2={6} />
      <line x1={3} y1={10} x2={21} y2={10} />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
}
