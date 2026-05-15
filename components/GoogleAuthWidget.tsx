import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getGoogleEnv, listGoogleAccounts } from "@/lib/googleCalendar";

interface GoogleAuthWidgetProps {
  /** Path to redirect back to after OAuth completes. */
  returnPath?: string;
}

/**
 * Top-bar widget showing Google sign-in state. Server-rendered: queries the
 * connected GoogleAccount rows and surfaces an avatar + email for the default
 * account (with an account switcher dropdown on hover/focus). When no accounts
 * are connected, shows a "Sign in with Google" call-to-action.
 *
 * The dropdown uses native <details>/<summary> to avoid pulling in a JS
 * client-only menu component — keeps this widget purely server-rendered.
 */
export async function GoogleAuthWidget({
  returnPath = "/settings",
}: GoogleAuthWidgetProps) {
  const configured = Boolean(getGoogleEnv());
  if (!configured) {
    return (
      <div className="text-xs text-muted-foreground" aria-label="Google not configured">
        Google not configured
      </div>
    );
  }
  const accounts = await listGoogleAccounts().catch(() => []);

  if (accounts.length === 0) {
    return (
      <a
        href={`/api/calendar/auth?return=${encodeURIComponent(returnPath)}`}
        className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm shadow-sm hover:bg-accent"
      >
        <GoogleGlyph />
        <span>Sign in with Google</span>
      </a>
    );
  }

  const primary = accounts.find((a) => a.isDefault) ?? accounts[0];
  const others = accounts.filter((a) => a.id !== primary.id);

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border bg-card px-2 py-1 text-sm shadow-sm hover:bg-accent">
        {primary.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primary.picture}
            alt={primary.email}
            className="h-7 w-7 rounded-full border"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border bg-muted text-xs">
            {(primary.name ?? primary.email).slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="hidden text-left sm:block">
          <div className="max-w-[14ch] truncate text-xs font-medium leading-tight">
            {primary.name ?? primary.email}
          </div>
          <div className="max-w-[18ch] truncate text-[11px] text-muted-foreground">
            {primary.defaultCalendarSummary ?? primary.defaultCalendarId}
          </div>
        </div>
        <ChevronDown />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-72 rounded-md border bg-popover p-2 text-sm shadow-lg">
        <div className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          Connected Google account{accounts.length === 1 ? "" : "s"}
        </div>
        <AccountLine account={primary} highlight />
        {others.map((a) => (
          <AccountLine key={a.id} account={a} />
        ))}
        <div className="my-1 border-t" />
        <a
          href={`/api/calendar/auth?return=${encodeURIComponent(returnPath)}`}
          className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
        >
          <GoogleGlyph />
          + Add another account
        </a>
        <Link
          href="/settings"
          className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
        >
          <GearIcon /> Manage in Settings
        </Link>
      </div>
    </details>
  );
}

function AccountLine({
  account,
  highlight,
}: {
  account: Awaited<ReturnType<typeof listGoogleAccounts>>[number];
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded px-2 py-1.5 ${
        highlight ? "bg-muted/50" : ""
      }`}
    >
      {account.picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={account.picture}
          alt={account.email}
          className="h-6 w-6 rounded-full border"
        />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded-full border bg-muted text-[10px]">
          {(account.name ?? account.email).slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">
          {account.name ?? account.email}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {account.email}
        </div>
      </div>
      {account.isDefault ? <Badge variant="success">Default</Badge> : null}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5c-7.6 0-14.2 4.3-17.7 10.2z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5.4 0 10.3-2.1 14-5.4l-6.5-5.5C29.5 34.4 26.9 35.5 24 35.5c-5.3 0-9.7-3.4-11.3-8L6 32.4C9.4 38.5 16.2 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.5 5.5c-.5.4 7-5.1 7-15.1 0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx={12} cy={12} r={3} />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
