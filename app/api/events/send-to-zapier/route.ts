import { NextResponse } from "next/server";

import {
  patchAirtableEventZapierStatus,
  fetchFamilyEventsFromAirtable,
  isAirtableConfigured,
} from "@/lib/airtable";
import { familyEventToZapierPayload } from "@/lib/eventFormatting";
import { MOCK_FAMILY_EVENTS } from "@/lib/mockEvents";
import { prisma } from "@/lib/prisma";
import { sendEventToZapier } from "@/lib/zapier";
import { zapierExportPayloadSchema, type FamilyEvent } from "@/lib/validation";

export const dynamic = "force-dynamic";

function zapierGloballyDisabled(): boolean {
  return process.env.ZAPIER_ENABLED?.trim().toLowerCase() === "false";
}

async function loadEvents(): Promise<FamilyEvent[]> {
  if (!isAirtableConfigured()) return MOCK_FAMILY_EVENTS;
  try {
    return await fetchFamilyEventsFromAirtable();
  } catch {
    return MOCK_FAMILY_EVENTS;
  }
}

function eventSelectionKey(ev: FamilyEvent): string {
  return ev.airtableRecordId ?? ev.eventName;
}

export async function POST(req: Request) {
  if (zapierGloballyDisabled()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Zapier webhook export is disabled (ZAPIER_ENABLED=false).",
      },
      { status: 503 },
    );
  }

  const parsedBody = zapierExportPayloadSchema.safeParse(await req.json());
  if (!parsedBody.success) {
    return NextResponse.json(
      { ok: false, issues: parsedBody.error.flatten() },
      { status: 422 },
    );
  }

  const { eventIds } = parsedBody.data;

  if (!process.env.ZAPIER_WEBHOOK_URL?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Set ZAPIER_WEBHOOK_URL to your Zapier Catch Hook URL to enable outbound webhooks.",
      },
      { status: 503 },
    );
  }

  const events = await loadEvents();
  const byKey = new Map(events.map((e) => [eventSelectionKey(e), e]));
  const missing = eventIds.filter((id) => !byKey.has(id));
  if (missing.length) {
    return NextResponse.json(
      {
        ok: false,
        message: "Some selected events were not found in the current dataset.",
        missing,
      },
      { status: 422 },
    );
  }

  const results: {
    localEventId: string;
    ok: boolean;
    message?: string;
    zapierResponse?: unknown;
  }[] = [];

  for (const localEventId of eventIds) {
    const ev = byKey.get(localEventId)!;
    const payload = familyEventToZapierPayload(ev, localEventId);

    try {
      const zapierResponse = await sendEventToZapier(payload);
      const zapJson =
        zapierResponse && typeof zapierResponse === "object"
          ? JSON.stringify(zapierResponse).slice(0, 2000)
          : String(zapierResponse).slice(0, 2000);

      await prisma.zapierWebhookLog.create({
        data: {
          selectionKey: localEventId,
          airtableRecordId: ev.airtableRecordId ?? null,
          eventNameSnapshot: ev.eventName,
          status: "success",
          httpStatus: 200,
          detail: zapJson,
        },
      });

      await patchAirtableEventZapierStatus(ev.airtableRecordId, {
        status: "Sent",
        detail: "Webhook accepted",
      });

      results.push({
        localEventId,
        ok: true,
        message: "Sent to Zapier",
        zapierResponse,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      await prisma.zapierWebhookLog.create({
        data: {
          selectionKey: localEventId,
          airtableRecordId: ev.airtableRecordId ?? null,
          eventNameSnapshot: ev.eventName,
          status: "error",
          httpStatus: null,
          detail: message.slice(0, 2000),
        },
      });

      await patchAirtableEventZapierStatus(ev.airtableRecordId, {
        status: "Error",
        detail: message.slice(0, 500),
      });

      results.push({
        localEventId,
        ok: false,
        message,
      });
    }
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({
    ok: allOk,
    message: allOk
      ? `Sent ${results.length} event(s) to Zapier.`
      : "Some Zapier webhook calls failed.",
    results,
  });
}
