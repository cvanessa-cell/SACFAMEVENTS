"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

export function PublicSiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/discover" className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20">
            <Calendar className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 leading-tight">
            <span className="block truncate text-base font-semibold tracking-tight text-foreground">
              Sacramento Family Events
            </span>
            <span className="hidden truncate text-xs text-muted-foreground sm:block">
              Sacramento &amp; Placer County
            </span>
          </div>
        </Link>

        <nav className="flex shrink-0 items-center gap-1 text-sm font-medium">
          <Link
            href="/discover"
            className={cn(
              "rounded-full px-3 py-2 transition-colors",
              pathname === "/discover"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Discover
          </Link>
          <a
            href="https://calendar.google.com/calendar"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Calendar
            <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </a>
        </nav>
      </div>
    </header>
  );
}
