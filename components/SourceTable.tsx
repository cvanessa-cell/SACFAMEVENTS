import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

export function SourceTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sources preview</CardTitle>
        <CardDescription>
          Connect valid <code>AIRTABLE_*</code> variables to pull live Family Event
          Sources via <code>/api/sources</code> in milestone 2–3.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Expected columns mirror Airtable: Source Name · Source Type · City / Area ·
          Website/Facebook/Source links · scraping metadata · Priority.
        </p>
        <Badge variant="secondary">Inactive until API wired</Badge>
      </CardContent>
    </Card>
  );
}
