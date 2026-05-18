import { OPERATIONS_CONSOLE_GLOSSARY } from "@/lib/admin/operationsConsoleGlossary";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface OperationsConsoleGuideProps {
  /** Show only these section ids; default is all sections. */
  sections?: string[];
  defaultOpen?: boolean;
}

export function OperationsConsoleGuide({
  sections,
  defaultOpen = false,
}: OperationsConsoleGuideProps) {
  const visible = sections
    ? OPERATIONS_CONSOLE_GLOSSARY.filter((s) => sections.includes(s.id))
    : OPERATIONS_CONSOLE_GLOSSARY;

  return (
    <Card className="border-primary/20 bg-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Operations console field guide</CardTitle>
        <CardDescription>
          Definitions for badges, buttons, stats, and navigation across the admin console.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.map((section) => (
          <details
            key={section.id}
            className="group rounded-lg border border-border/60 bg-background/80"
            open={defaultOpen}
          >
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                {section.title}
                <span className="text-xs font-normal text-muted-foreground group-open:hidden">
                  Show definitions
                </span>
              </span>
            </summary>
            <dl className="space-y-2 border-t px-3 py-2">
              {section.items.map((item) => (
                <div key={item.term} className="text-sm">
                  <dt className="font-medium text-foreground">{item.term}</dt>
                  <dd className="mt-0.5 text-muted-foreground">{item.definition}</dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}
