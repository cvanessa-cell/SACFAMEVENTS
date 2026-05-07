export type FamilyEventZapierPayload = {
  airtableEventId?: string;
  localEventId?: string;
  eventName: string;
  date: string;
  startTime?: string;
  endTime?: string;
  city?: string;
  venue?: string;
  address?: string;
  category?: string;
  ageRange?: string;
  cost?: string;
  free?: boolean;
  registrationRequired?: boolean;
  indoorOutdoor?: string;
  recurring?: boolean;
  kidFriendlyNotes?: string;
  description?: string;
  eventLink?: string;
  sourceName?: string;
  sourceType?: string;
  sourceLink?: string;
  screenshotUrl?: string;
  googleMapsLink?: string;
  reminderPreference?: string;
  status?: string;
  confidenceScore?: number;
  lastCheckedDate?: string;
};

export async function sendEventToZapier(payload: FamilyEventZapierPayload) {
  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("Missing ZAPIER_WEBHOOK_URL environment variable.");
  }

  if (!payload.eventName || !payload.date) {
    throw new Error("Zapier payload requires eventName and date.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const secret = process.env.ZAPIER_WEBHOOK_SECRET?.trim();
  if (secret) {
    headers["X-Webhook-Secret"] = secret;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Zapier webhook failed: ${response.status} ${text}`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      ok: true,
      raw: text,
    };
  }
}
