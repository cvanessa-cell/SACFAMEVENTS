import { describe, expect, it } from "vitest";

import { hashContent } from "../src/parsing/hash-content";
import { normalizeConversation } from "../src/parsing/normalize-conversation";

describe("dedupe hashing", () => {
  it("matches same transcript and diverges after edit", () => {
    const a = "hello transcript";
    const b = "hello transcript!";
    expect(hashContent(a)).toBe(hashContent(a));
    expect(hashContent(a)).not.toBe(hashContent(b));
  });

  it("produces identical dedupe key for unchanged redacted corpus", () => {
    const paths = {
      importDir: "/tmp/i",
      outputDir: "/tmp/o",
      projectRootResolved: "/repo",
      projectName: "testproj",
      repoRoot: "/repo",
    };

    const n1 = normalizeConversation({
      sourceType: "exported_file",
      sourcePath: "/repo/x.md",
      rawText: "Same body",
      importedAtIso: "2026-05-08T12:00:00Z",
      paths,
      redactOpts: { redactSecrets: true, redactEmails: false, redactPhones: false },
    });
    const n2 = normalizeConversation({
      sourceType: "exported_file",
      sourcePath: "/repo/x.md",
      rawText: "Same body",
      importedAtIso: "2026-05-08T13:00:00Z",
      paths,
      redactOpts: { redactSecrets: true, redactEmails: false, redactPhones: false },
    });
    expect(n1.dedupeKey).toBe(n2.dedupeKey);
    expect(n1.contentHash).toBe(n2.contentHash);

    const n3 = normalizeConversation({
      sourceType: "exported_file",
      sourcePath: "/repo/y.md",
      rawText: "Different path",
      importedAtIso: "2026-05-08T12:00:00Z",
      paths,
      redactOpts: { redactSecrets: true, redactEmails: false, redactPhones: false },
    });
    expect(n3.dedupeKey).not.toBe(n1.dedupeKey);
  });
});
