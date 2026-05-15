"use server";

import { revalidatePath } from "next/cache";

import {
  approveSourceCandidate,
  rejectSourceCandidate,
  runSourceResearch,
} from "@/lib/sources/sourceResearchService";
import {
  approveEventCandidate,
  rejectEventCandidate,
  runEventMonitorForSource,
} from "@/lib/sources/eventMonitorService";

const PATHS_TO_REVALIDATE = [
  "/admin/event-monitoring",
  "/admin/event-sources",
  "/admin/event-review",
  "/admin/sources/research",
  "/admin/sources/research-runs",
  "/admin/sources",
  "/admin/sources/candidates",
  "/admin/events/monitor-runs",
  "/admin/events/candidates",
];

function revalidateAdmin() {
  for (const p of PATHS_TO_REVALIDATE) revalidatePath(p);
}

export async function runSourceResearchAction(formData: FormData): Promise<void> {
  const requestedRaw = formData.get("requestedSourceCount");
  const requestedSourceCount =
    typeof requestedRaw === "string" && requestedRaw.trim()
      ? Number.parseInt(requestedRaw, 10)
      : undefined;
  const targetRegion =
    typeof formData.get("targetRegion") === "string"
      ? String(formData.get("targetRegion"))
      : undefined;
  const requestedBy =
    typeof formData.get("requestedBy") === "string"
      ? String(formData.get("requestedBy"))
      : null;
  await runSourceResearch({
    requestedBy,
    requestedSourceCount: Number.isFinite(requestedSourceCount as number)
      ? (requestedSourceCount as number)
      : undefined,
    targetRegion,
  });
  revalidateAdmin();
}

export async function approveSourceCandidateAction(formData: FormData): Promise<void> {
  const candidateId = String(formData.get("candidateId") ?? "");
  if (!candidateId) return;
  const note =
    typeof formData.get("note") === "string"
      ? String(formData.get("note"))
      : null;
  await approveSourceCandidate({ candidateId, note });
  revalidateAdmin();
}

export async function rejectSourceCandidateAction(formData: FormData): Promise<void> {
  const candidateId = String(formData.get("candidateId") ?? "");
  if (!candidateId) return;
  const note =
    typeof formData.get("note") === "string"
      ? String(formData.get("note"))
      : null;
  await rejectSourceCandidate(candidateId, note);
  revalidateAdmin();
}

export async function runEventMonitorAction(formData: FormData): Promise<void> {
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!sourceId) return;
  await runEventMonitorForSource({ sourceId });
  revalidateAdmin();
}

export async function approveEventCandidateAction(formData: FormData): Promise<void> {
  const candidateId = String(formData.get("candidateId") ?? "");
  if (!candidateId) return;
  const note =
    typeof formData.get("note") === "string"
      ? String(formData.get("note"))
      : null;
  await approveEventCandidate(candidateId, { note });
  revalidateAdmin();
}

export async function rejectEventCandidateAction(formData: FormData): Promise<void> {
  const candidateId = String(formData.get("candidateId") ?? "");
  if (!candidateId) return;
  const note =
    typeof formData.get("note") === "string"
      ? String(formData.get("note"))
      : null;
  await rejectEventCandidate(candidateId, note);
  revalidateAdmin();
}
