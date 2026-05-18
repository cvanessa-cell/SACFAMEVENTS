import type { FamilyEvent } from "@/lib/validation";
import { Badge } from "@/components/ui/badge";

export interface EventTitleLinkProps {
  event: FamilyEvent;
  className?: string;
}

export function EventTitleLink({ event, className = "" }: EventTitleLinkProps) {
  const url = event.eventLink?.trim();
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`font-semibold text-primary underline underline-offset-4 hover:text-primary/90 ${className}`}
      >
        {event.eventName}
      </a>
    );
  }
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <span className="font-semibold">{event.eventName}</span>
      <Badge variant="warning" className="text-xs font-normal">
        URL missing — needs review
      </Badge>
    </span>
  );
}
