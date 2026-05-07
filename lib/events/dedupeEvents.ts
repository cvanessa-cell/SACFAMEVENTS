import type { Prisma } from "@prisma/client";

function normalize(v?: string | null): string {
  return (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildDuplicateKey(input: {
  title: string;
  date: Date | null;
  city?: string | null;
  venueName?: string | null;
  sourceEventUrl?: string | null;
}): string {
  const dateKey = input.date ? input.date.toISOString().slice(0, 10) : "unknown-date";
  return [
    normalize(input.title),
    dateKey,
    normalize(input.city),
    normalize(input.venueName),
    normalize(input.sourceEventUrl),
  ].join("|");
}

export function likelyDuplicateWhere(input: {
  title: string;
  date: Date | null;
  venueName?: string | null;
  sourceEventUrl?: string | null;
  registrationUrl?: string | null;
}): Prisma.FamilyEventWhereInput {
  const dateStart =
    input.date != null
      ? new Date(new Date(input.date).toISOString().slice(0, 10))
      : null;
  const dateEnd = dateStart ? new Date(dateStart.getTime() + 24 * 60 * 60 * 1000) : null;

  return {
    OR: [
      input.sourceEventUrl ? { sourceEventUrl: input.sourceEventUrl } : undefined,
      input.registrationUrl ? { registrationUrl: input.registrationUrl } : undefined,
      dateStart && dateEnd
        ? {
            startDatetime: {
              gte: dateStart,
              lt: dateEnd,
            },
            title: {
              contains: input.title.slice(0, 24),
              mode: "insensitive",
            },
          }
        : undefined,
      input.venueName
        ? {
            venueName: { equals: input.venueName, mode: "insensitive" },
            title: { contains: input.title.slice(0, 24), mode: "insensitive" },
          }
        : undefined,
    ].filter(Boolean) as Prisma.FamilyEventWhereInput[],
  };
}
