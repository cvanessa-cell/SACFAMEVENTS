import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover family events | Sacramento & Placer County",
  description:
    "Browse curated family-friendly events in Sacramento and Placer County — storytimes, festivals, parks, free outings, and activities great for toddlers and young kids.",
  openGraph: {
    title: "Sacramento Family Events — Discover local activities",
    description:
      "Find family-friendly events near you in Sacramento and Placer County. Filter by date, city, free events, and toddler-friendly picks.",
    type: "website",
  },
};

export default function DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
