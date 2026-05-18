import { glossaryDefinitionAny } from "@/lib/admin/operationsConsoleGlossary";
import { cn } from "@/lib/utils";

interface GlossaryHintProps {
  term: string;
  definition?: string;
  className?: string;
}

/** Inline muted definition pulled from the operations console glossary. */
export function GlossaryHint({ term, definition, className }: GlossaryHintProps) {
  const text = definition ?? glossaryDefinitionAny(term);
  if (!text) return null;
  return (
    <p className={cn("text-xs leading-snug text-muted-foreground", className)} title={text}>
      {text}
    </p>
  );
}

interface GlossaryTitleProps {
  term: string;
  definition?: string;
  children: React.ReactNode;
  className?: string;
}

/** Wraps a control with a glossary tooltip (native title). */
export function GlossaryTitle({ term, definition, children, className }: GlossaryTitleProps) {
  const text = definition ?? glossaryDefinitionAny(term);
  return (
    <span className={className} title={text}>
      {children}
    </span>
  );
}
