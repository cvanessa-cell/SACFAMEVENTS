import type { IndexerConfig } from "../../config";
import { listMetaTables } from "./airtable-client";
import { A as Schema } from "./schema";

const REQUIRED = [
  Schema.conversation.dedupeKey,
  Schema.action.dedupeKey,
  Schema.fileRef.dedupeKey,
  Schema.error.dedupeKey,
  Schema.decision.dedupeKey,
];

export async function ensureBaseSchema(
  cfg: IndexerConfig,
  log: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void },
): Promise<{ ok: boolean; message: string }> {
  if (cfg.indexerDryRun) {
    return { ok: true, message: "Dry-run: skipped Airtable schema probe." };
  }

  const tables = await listMetaTables(cfg);
  if (!tables) {
    return {
      ok: false,
      message:
        "Could not read base schema (metadata API may need schema.bases:read). Create tables manually per README; sync will still attempt row writes.",
    };
  }

  const names = new Set(tables.map((t) => t.name));
  const need = [
    cfg.airtableConversationsTable,
    cfg.airtableActionItemsTable,
    cfg.airtableFilesTable,
    cfg.airtableErrorsTable,
    cfg.airtableDecisionsTable,
  ];
  const missing = need.filter((n) => !names.has(n));
  if (missing.length) {
    log.warn(`Missing Airtable tables: ${missing.join(", ")}`);
    return { ok: false, message: `Create tables: ${missing.join(", ")}` };
  }

  log.info("Airtable metadata: required table names present.");
  return {
    ok: true,
    message: `Tables found. Ensure field names match spec (incl. ${REQUIRED.join(", ")}).`,
  };
}
