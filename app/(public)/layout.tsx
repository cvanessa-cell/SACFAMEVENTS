import { PublicSiteHeader } from "@/components/PublicSiteHeader";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/[0.06] via-background to-muted/30">
      <PublicSiteHeader />

      <main className="flex-1">{children}</main>

      <footer className="mt-auto border-t border-border/60 bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className="text-center text-sm text-muted-foreground">
            Sacramento Family Event Finder &middot; Helping families discover local events in
            Sacramento &amp; Placer County
          </p>
        </div>
      </footer>
    </div>
  );
}
