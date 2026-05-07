"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coming soon</CardTitle>
        <CardDescription>
          Prisma-backed automation flags (cron / Vercel / GitHub / Zapier) will be editable here once the OAuth + scheduler services are finalized.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>For now configure environment variables in <code>.env</code>, run Prisma migrations, and connect Google OAuth scopes from the documentation.</p>
      </CardContent>
    </Card>
  );
}
