"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useUIConfig } from "@/components/ui-config-provider";
import { cn } from "@/lib/utils";

const MAX_WIDTH_CLASSES: Record<string, string> = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

const DENSITY_PADDING: Record<string, string> = {
  compact: "py-3 sm:py-4",
  comfortable: "py-6 sm:py-10",
  spacious: "py-8 sm:py-16",
};

interface LayoutShellProps {
  title: string;
  subtitle: string;
  titleHref: string;
  authSlot: React.ReactNode;
  children: React.ReactNode;
  navMode?: "dashboard" | "admin";
}

const ADMIN_NAV = [
  { href: "/admin/event-monitoring", label: "Monitoring" },
  { href: "/admin/event-sources", label: "Sources" },
  { href: "/admin/sources", label: "Airtable sources" },
  { href: "/admin/sources/research", label: "AI source research" },
  { href: "/admin/sources/candidates", label: "Source candidates" },
  { href: "/admin/event-review", label: "Review queue" },
  { href: "/admin/events/candidates", label: "AI event candidates" },
  { href: "/events", label: "\u2190 Back to dashboard" },
];

export function LayoutShell({
  title,
  subtitle,
  titleHref,
  authSlot,
  children,
  navMode = "dashboard",
}: LayoutShellProps) {
  const { config } = useUIConfig();
  const pathname = usePathname();
  const maxW = MAX_WIDTH_CLASSES[config.layout.maxWidth] || "max-w-6xl";
  const mainPadding = DENSITY_PADDING[config.layout.contentDensity] || "py-6 sm:py-10";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems =
    navMode === "admin"
      ? ADMIN_NAV
      : config.visibility.navItems.filter((item) => item.visible);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/events") return pathname === "/events";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div
          className={`mx-auto flex ${maxW} flex-wrap items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {subtitle}
            </p>
            <Link href={titleHref} className="text-lg font-semibold tracking-tight sm:text-xl">
              {title}
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Desktop nav */}
          <div className="hidden items-center gap-4 md:flex">
            <nav className="flex flex-wrap gap-2 text-sm font-medium">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    isActive(item.href) && "bg-primary/10 text-primary",
                  )}
                  href={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {authSlot}
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileMenuOpen && (
          <div className={`mx-auto ${maxW} border-t px-3 pb-3 md:hidden`}>
            <nav className="flex flex-col gap-2 pt-2 text-sm font-medium">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground",
                    isActive(item.href) && "bg-primary/10 text-primary",
                  )}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-2 border-t pt-2">{authSlot}</div>
          </div>
        )}
      </div>
      <main className={`mx-auto ${maxW} px-3 sm:px-4 ${mainPadding}`}>{children}</main>
    </div>
  );
}
