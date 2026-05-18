import { Suspense } from "react";

import { OperationsConsoleGuide } from "@/components/admin/OperationsConsoleGuide";
import { GoogleAuthWidget } from "@/components/GoogleAuthWidget";
import { LayoutShell } from "@/components/layout-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LayoutShell
      title="Operations console"
      subtitle="Sacramento Family Event Finder · Admin"
      titleHref="/admin/event-monitoring"
      navMode="admin"
      authSlot={
        <Suspense
          fallback={
            <div className="text-xs text-muted-foreground">Google …</div>
          }
        >
          <GoogleAuthWidget returnPath="/admin/event-review" />
        </Suspense>
      }
    >
      <div className="space-y-6">
        <OperationsConsoleGuide />
        {children}
      </div>
    </LayoutShell>
  );
}

