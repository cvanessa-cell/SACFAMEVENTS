/**
 * Airtable config for the daily web event discovery workflow (legacy Family Events tables).
 */

export interface FamilyEventsAirtableConfig {
  apiKey: string;
  baseId: string;
  familyEventsTable: string;
  familyEventSourcesTable: string;
}

export function getFamilyEventsAirtableConfig(): FamilyEventsAirtableConfig | null {
  const apiKey = process.env.AIRTABLE_API_KEY?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!apiKey || !baseId) return null;
  return {
    apiKey,
    baseId,
    familyEventsTable:
      process.env.AIRTABLE_FAMILY_EVENTS_TABLE?.trim() ||
      process.env.AIRTABLE_EVENTS_TABLE?.trim() ||
      "Family Events",
    familyEventSourcesTable:
      process.env.AIRTABLE_FAMILY_EVENT_SOURCES_TABLE?.trim() ||
      process.env.AIRTABLE_SOURCES_TABLE?.trim() ||
      "Family Event Sources",
  };
}

export function isFamilyEventsAirtableConfigured(): boolean {
  return getFamilyEventsAirtableConfig() !== null;
}
