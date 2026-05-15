import { describe, expect, it } from "vitest";

import { indexerConfigSchema } from "../src/config";
import { normalizeConversation } from "../src/parsing/normalize-conversation";
import { buildConversationFields } from "../src/sinks/airtable/sync-conversation";

describe("airtable payloads", () => {
  it("puts only redacted text in synced transcript payload", () => {
    const paths = {
      importDir: "",
      outputDir: "",
      projectRootResolved: "/fake",
      projectName: "p",
      repoRoot: "/fake",
    };

    const n = normalizeConversation({
      sourceType: "exported_file",
      sourcePath: "/fake/a.md",
      rawText:
        'User asked to tune api\nOPENAI_API_KEY="sk-proj-this-should-never-sync"\nBearer abc.def.ghi',
      importedAtIso: "2026-05-08T12:00:00Z",
      paths,
      redactOpts: { redactSecrets: true, redactEmails: false, redactPhones: false },
    });

    const f = buildConversationFields(n, paths);
    const blob = JSON.stringify(f);
    expect(blob.includes("sk-proj-this-should-never-sync")).toBe(false);
    expect(blob.includes("abc.def")).toBe(false);

    expect(String(f["Raw Transcript Redacted"] ?? "")).not.toContain("sk-proj");
  });

  it("includes Dedupe Key and Conversation ID", () => {
    const cfg = indexerConfigSchema.parse({});
    const paths = resolvePaths();
    const n = normalizeConversation({
      sourceType: "exported_file",
      sourcePath: "/fake/z.md",
      rawText: "hello",
      importedAtIso: "2026-05-08T12:00:00Z",
      paths,
      redactOpts: { redactSecrets: true, redactEmails: false, redactPhones: false },
    });
    const f = buildConversationFields(n, paths);
    expect(f["Dedupe Key"]).toBeTruthy();
    expect(f["Conversation ID"]).toBe(n.id);
  });
});

function resolvePaths() {
  return {
    importDir: "",
    outputDir: "",
    projectRootResolved: "/fake",
    projectName: "p",
    repoRoot: "/fake",
  };
}
