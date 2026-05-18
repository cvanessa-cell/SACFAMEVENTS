/**
 * Public Airtable URLs for admin deep links. Does not expose API keys.
 */

const TABLE_IDS = {
  eventSources: "tblBJT4KAtUYKtV9I",
  sourceResearchRuns: "tblQ6kig948uYfdvU",
  sourceCandidates: "tblmek2qKf6nmR8pJ",
  eventCandidates: "tblqAm11SlU9CK2nM",
  familyEvents: "tblO5N7AazG7R5Jpb",
  familyEventSources: "tblVDVVweYhfGvhox",
} as const;

export type AirtableWorkflowTableKey = keyof Pick<
  typeof TABLE_IDS,
  "eventSources" | "sourceResearchRuns" | "sourceCandidates" | "eventCandidates"
>;

function baseId(): string | null {
  const id = process.env.AIRTABLE_BASE_ID?.trim();
  return id && id.startsWith("app") ? id : null;
}

export function getAirtableBaseUrl(): string | null {
  const id = baseId();
  return id ? `https://airtable.com/${id}` : null;
}

/** Full Interface URL after you build/share it in Airtable (optional). */
export function getAirtableInterfaceUrl(): string | null {
  const fromEnv = process.env.AIRTABLE_INTERFACE_URL?.trim();
  if (fromEnv) return fromEnv;
  const interfaceId = process.env.AIRTABLE_INTERFACE_ID?.trim();
  const id = baseId();
  if (interfaceId && id && interfaceId.startsWith("pbd")) {
    return `https://airtable.com/${id}/${interfaceId}`;
  }
  return null;
}

export function getAirtableTableUrl(
  table: AirtableWorkflowTableKey | "familyEvents" | "familyEventSources",
): string | null {
  const id = baseId();
  const tableId = TABLE_IDS[table];
  return id ? `https://airtable.com/${id}/${tableId}` : null;
}

export const AIRTABLE_INTERFACE_SETUP = {
  existingInterfaceName: "Family Events/Things To Do",
  existingInterfaceId: "pbdularoo4IXbBnDP",
  recommendedNewInterfaceName: "SacFam Source Research",
} as const;
