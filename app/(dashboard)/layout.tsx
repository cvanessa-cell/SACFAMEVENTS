import { Suspense } from "react";

import { GoogleAuthWidget } from "@/components/GoogleAuthWidget";
import { LayoutShell } from "@/components/layout-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LayoutShell
      title="Dashboard"
      subtitle="Sacramento Family Event Finder"
      titleHref="/events"
      navMode="dashboard"
      authSlot={
        <Suspense
          fallback={
            <div className="text-xs text-muted-foreground">Google …</div>
          }
        >
          <GoogleAuthWidget returnPath="/settings" />
        </Suspense>
      }
    >
      {children}
    </LayoutShell>
  );
}
