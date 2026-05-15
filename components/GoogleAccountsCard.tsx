import Link from "next/link";

import {
  disconnectGoogleAccountAction,
  refreshAccountCalendarsAction,
  setAccountDefaultCalendarAction,
  setDefaultGoogleAccountAction,
} from "@/app/settings/actions";
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

const RETURN_TO_SETTINGS = "/settings";

export async function GoogleAccountsCard() {
  const configured = Boolean(getGoogleEnv());
  const accounts = configured
    ? await listGoogleAccounts().catch(() => [] as GoogleAccountSummary[])
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google accounts &amp; calendars</CardTitle>
        <CardDescription>
          Connect one or more Google accounts. Each account exposes its
          calendars; pick which one is the export target. The same FamilyEvent
          can be pushed to multiple (account, calendar) pairs and every export
          is recorded on the review card.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!configured ? (
          <ConfigMissing />
        ) : (
          <>
            {accounts.length === 0 ? (
              <NoAccounts />
            ) : (
              <div className="space-y-3">
                {accounts.map((a) => (
                  <AccountRow key={a.id} account={a} />
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 border-t pt-4 text-sm">
              <a
                href={`/api/calendar/auth?return=${encodeURIComponent(
                  RETURN_TO_SETTINGS,
                )}`}
                className="rounded-md border bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                + Connect another Google account
              </a>
              {accounts.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  Adding the same account again will refresh its tokens and
                  calendar list.
                </span>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ConfigMissing() {
  return (
    <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <div className="font-medium text-destructive">OAuth env vars missing</div>
      <p className="text-muted-foreground">
        Populate <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>,
        and <code>GOOGLE_REDIRECT_URI</code> (e.g.{" "}
        <code>http://localhost:3333/api/calendar/callback</code>) in{" "}
        <code>.env</code>, then reload.
      </p>
    </div>
  );
}

function NoAccounts() {
  return (
    <div className="rounded border bg-muted/30 p-3 text-sm">
      <div className="font-medium">No Google accounts connected</div>
      <p className="text-muted-foreground">
        Click <strong>Connect another Google account</strong> below to grant
        Calendar access. You&rsquo;ll be redirected to Google&rsquo;s consent
        screen and back.
      </p>
    </div>
  );
}

function AccountRow({ account }: { account: GoogleAccountSummary }) {
  const calendars =
    account.calendars.length > 0
      ? account.calendars
      : [
          {
            id: `primary-${account.id}`,
            calendarId: "primary",
            summary: "Primary",
            description: null,
            timeZone: null,
            primary: true,
            accessRole: null,
            backgroundColor: null,
          } satisfies GoogleAccountSummary["calendars"][number],
        ];
  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-3">
        {account.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={account.picture}
            alt={account.email}
            className="h-8 w-8 rounded-full border"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted text-xs">
            {(account.name ?? account.email).slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className="truncate">{account.name ?? account.email}</span>
            {account.isDefault ? (
              <Badge variant="success">Default account</Badge>
            ) : null}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {account.email}
            {account.lastUsedAt
              ? ` · last used ${account.lastUsedAt.toLocaleString()}`
              : ""}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!account.isDefault ? (
            <form action={setDefaultGoogleAccountAction}>
              <input type="hidden" name="accountId" value={account.id} />
              <button
                type="submit"
                className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                title="Use this account as the default for new exports"
              >
                Set default
              </button>
            </form>
          ) : null}
          <form action={refreshAccountCalendarsAction}>
            <input type="hidden" name="accountId" value={account.id} />
            <button
              type="submit"
              className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
              title="Re-fetch the list of calendars from Google"
            >
              Refresh calendars
            </button>
          </form>
          <form action={disconnectGoogleAccountAction}>
            <input type="hidden" name="accountId" value={account.id} />
            <button
              type="submit"
              className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
            >
              Disconnect
            </button>
          </form>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {calendars.map((cal) => {
          const isDefault = account.defaultCalendarId === cal.calendarId;
          return (
            <div
              key={cal.id}
              className="flex flex-col gap-2 rounded border bg-background p-2 text-xs"
              style={
                cal.backgroundColor
                  ? { borderColor: cal.backgroundColor }
                  : undefined
              }
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 rounded-full border"
                  style={{
                    backgroundColor: cal.backgroundColor ?? "#cbd5e1",
                  }}
                />
                <span className="truncate font-medium">{cal.summary}</span>
                {cal.primary ? (
                  <Badge variant="outline">Primary</Badge>
                ) : null}
                {isDefault ? (
                  <Badge variant="success">Export target</Badge>
                ) : null}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {cal.timeZone ?? "—"}
                {cal.accessRole ? ` · ${cal.accessRole}` : ""}
              </div>
              {!isDefault ? (
                <form action={setAccountDefaultCalendarAction}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <input
                    type="hidden"
                    name="calendarId"
                    value={cal.calendarId}
                  />
                  <input
                    type="hidden"
                    name="calendarSummary"
                    value={cal.summary}
                  />
                  <button
                    type="submit"
                    className="w-full rounded border px-2 py-1 text-[11px] hover:bg-accent"
                  >
                    Use as default
                  </button>
                </form>
              ) : (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  Default export target for this account.
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <Link
          href={`/api/calendar/auth?return=${encodeURIComponent(RETURN_TO_SETTINGS)}`}
          className="text-primary underline"
          prefetch={false}
        >
          Re-authorize this account
        </Link>
        <span>
          Tokens persist in Postgres (<code>GoogleAccount</code>); refresh handled
          automatically.
        </span>
      </div>
    </div>
  );
}
