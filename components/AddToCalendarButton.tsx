"use client";

import { useMutation } from "@tanstack/react-query";
import * as React from "react";

import { Button } from "@/components/ui/button";

async function postAddToCalendar(ids: string[]) {
  const res = await fetch("/api/events/add-to-calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventIds: ids,
      reminder: { useDefault: true },
    }),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    message?: string;
    issues?: unknown;
  };
  if (!res.ok) {
    throw new Error(
      typeof body.message === "string"
        ? body.message
        : "Failed to validate calendar payload",
    );
  }
  if (body.ok === false) {
    throw new Error(
      body.message ??
        "Google Calendar export is still being wired — check OAuth env vars.",
    );
  }
  return body as { ok: boolean; message?: string };
}

export function AddToCalendarButton({
  ids,
}: {
  ids: string[];
}) {
  const [msg, setMsg] = React.useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => postAddToCalendar(ids),
    onSuccess: (body) => setMsg(body.message ?? "Events exported."),
    onError: (e: Error) => setMsg(e.message),
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        disabled={ids.length === 0 || m.isPending}
        onClick={() => m.mutate()}
      >
        {m.isPending ? "Working…" : "Add selected to Google Calendar"}
      </Button>
      {msg ? <span className="text-sm text-muted-foreground">{msg}</span> : null}
    </div>
  );
}

async function postSendToZapier(ids: string[]) {
  const res = await fetch("/api/events/send-to-zapier", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventIds: ids }),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    message?: string;
    results?: { localEventId: string; ok: boolean; message?: string }[];
    issues?: unknown;
  };
  if (!res.ok) {
    throw new Error(
      typeof body.message === "string"
        ? body.message
        : "Failed to send events to Zapier",
    );
  }
  if (body.ok === false && !body.results?.length) {
    throw new Error(body.message ?? "Zapier export failed.");
  }
  return body as {
    ok: boolean;
    message?: string;
    results?: { localEventId: string; ok: boolean; message?: string }[];
  };
}

/** Optional Zapier Catch Hook bridge; Google Calendar OAuth remains primary. */
export function SendToZapierButton({
  ids,
  onSettled,
}: {
  ids: string[];
  /** Fire after Zapier mutation finishes (reload event list after Airtable patch). */
  onSettled?: () => void;
}) {
  const [msg, setMsg] = React.useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => postSendToZapier(ids),
    onSuccess: (body) => {
      if (body.results?.some((r) => !r.ok)) {
        const failed = body.results.filter((r) => !r.ok);
        setMsg(
          `${body.message ?? "Partial failure."} (${failed.length} failed)`,
        );
        return;
      }
      setMsg(body.message ?? "Sent to Zapier.");
    },
    onError: (e: Error) => setMsg(e.message),
    onSettled: () => onSettled?.(),
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="secondary"
        disabled={ids.length === 0 || m.isPending}
        onClick={() => m.mutate()}
      >
        {m.isPending ? "Sending…" : "Send to Zapier"}
      </Button>
      {msg ? <span className="text-sm text-muted-foreground">{msg}</span> : null}
    </div>
  );
}
