import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  getAirtableBaseUrl,
  getAirtableInterfaceUrl,
  getAirtableTableUrl,
  type AirtableWorkflowTableKey,
} from "@/lib/airtable/airtableLinks";

interface OpenInAirtableLinksProps {
  table?: AirtableWorkflowTableKey;
  showInterface?: boolean;
  showBase?: boolean;
}

export function OpenInAirtableLinks({
  table,
  showInterface = true,
  showBase = false,
}: OpenInAirtableLinksProps) {
  const interfaceUrl = getAirtableInterfaceUrl();
  const baseUrl = getAirtableBaseUrl();
  const tableUrl = table ? getAirtableTableUrl(table) : null;

  if (!interfaceUrl && !baseUrl && !tableUrl) {
    return (
      <p className="text-xs text-muted-foreground">
        Set <code className="text-[11px]">AIRTABLE_BASE_ID</code> in{" "}
        <code className="text-[11px]">.env</code> to enable Airtable links.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tableUrl ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={tableUrl} target="_blank" rel="noopener noreferrer">
            Open table in Airtable
          </Link>
        </Button>
      ) : null}
      {showInterface && interfaceUrl ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={interfaceUrl} target="_blank" rel="noopener noreferrer">
            Open Interface
          </Link>
        </Button>
      ) : null}
      {showBase && baseUrl ? (
        <Button variant="ghost" size="sm" asChild>
          <Link href={baseUrl} target="_blank" rel="noopener noreferrer">
            Open base
          </Link>
        </Button>
      ) : null}
      {showInterface && !interfaceUrl && baseUrl ? (
        <span className="text-xs text-muted-foreground">
          Add <code className="text-[11px]">AIRTABLE_INTERFACE_URL</code> after you build the
          Interface (see docs/SACFAM_AIRTABLE_INTERFACE_SETUP.md).
        </span>
      ) : null}
    </div>
  );
}
