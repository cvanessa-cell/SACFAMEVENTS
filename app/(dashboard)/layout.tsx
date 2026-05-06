import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sacramento Family Event Finder
            </p>
            <Link href="/events" className="text-xl font-semibold">
              Dashboard
            </Link>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm font-medium text-muted-foreground">
            <Link className="hover:text-foreground" href="/events">
              Events
            </Link>
            <Link className="hover:text-foreground" href="/sources">
              Sources
            </Link>
            <Link className="hover:text-foreground" href="/settings">
              Settings &amp; automation
            </Link>
            <Link className="hover:text-foreground" href="/admin/event-monitoring">
              Event monitoring
            </Link>
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
    </div>
  );
}
