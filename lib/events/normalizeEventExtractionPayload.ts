import {
  eventExtractionSchema,
  type EventExtractionResult,
} from "@/lib/events/eventExtractionSchema";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildSourceSummary(raw: Record<string, unknown>): string {
  const direct = asString(raw.source_summary);
  if (direct) return direct;

  const reviewReason = asString(raw.review_reason);
  if (reviewReason) return reviewReason;

  const status = asString(raw.status);
  if (status) return `Status: ${status}`;

  const summary = raw.summary;
  if (typeof summary === "string") return summary;
  if (asRecord(summary)) return JSON.stringify(summary);

  const source = asRecord(raw.source);
  if (source) {
    const name = asString(source.name);
    const url = asString(source.url);
    if (name && url) return `${name} (${url})`;
    if (name) return name;
  }

  const sourceName = asString(raw.source_name);
  const sourceUrl = asString(raw.source_url);
  if (sourceName && sourceUrl) return `${sourceName} (${sourceUrl})`;
  if (sourceName) return sourceName;

  return "";
}

function mapIrrelevantContent(
  raw: Record<string, unknown>,
): Array<{ text: string; reason: string }> {
  const out: Array<{ text: string; reason: string }> = [];

  for (const key of [
    "irrelevant_content",
    "irrelevant_or_excluded",
    "irrelevant_or_noise",
    "noise_content",
  ]) {
    const items = raw[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const rec = asRecord(item);
      if (!rec) continue;
      out.push({
        text:
          asString(rec.text) ??
          asString(rec.title) ??
          asString(rec.type) ??
          JSON.stringify(rec),
        reason:
          asString(rec.reason) ??
          asString(rec.classification) ??
          "irrelevant_or_noise",
      });
    }
  }

  const findings = raw.findings;
  if (Array.isArray(findings)) {
    for (const item of findings) {
      const rec = asRecord(item);
      if (!rec) continue;
      const reason = asString(rec.reason);
      if (!reason) continue;
      out.push({
        text: reason,
        reason: asString(rec.classification) ?? "finding",
      });
    }
  }

  const detections = raw.detections;
  if (Array.isArray(detections)) {
    for (const item of detections) {
      const rec = asRecord(item);
      if (!rec) continue;
      out.push({
        text:
          asString(rec.text) ??
          asString(rec.title) ??
          asString(rec.type) ??
          JSON.stringify(rec),
        reason: asString(rec.reason) ?? asString(rec.kind) ?? "detection",
      });
    }
  }

  return out;
}

function pickEventArray(raw: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const key of keys) {
    const value = raw[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function normalizeWarnings(raw: Record<string, unknown>): string[] {
  if (!Array.isArray(raw.warnings)) return [];
  return raw.warnings.filter((entry): entry is string => typeof entry === "string");
}

/**
 * Maps legacy/alternate OpenAI extraction payloads onto the canonical schema.
 * Structured output usually matches already; this covers drift and older jobs.
 */
export function normalizeEventExtractionPayload(raw: unknown): EventExtractionResult {
  const obj = asRecord(raw);
  if (!obj) {
    throw new Error("Extraction payload must be a JSON object");
  }

  // Only skip normalization when the model returned the canonical shape.
  if (typeof obj.source_summary === "string") {
    const direct = eventExtractionSchema.safeParse(raw);
    if (direct.success) return direct.data;
  }

  return eventExtractionSchema.parse({
    source_summary: buildSourceSummary(obj),
    new_events: pickEventArray(obj, "new_events", "events"),
    updated_events: pickEventArray(obj, "updated_events"),
    cancelled_events: pickEventArray(obj, "cancelled_events"),
    irrelevant_content: mapIrrelevantContent(obj),
    warnings: normalizeWarnings(obj),
  });
}
