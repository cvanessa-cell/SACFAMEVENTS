import { describe, expect, it } from "vitest";

import { indexerConfigSchema } from "../src/config";
import type { NormalizedConversation } from "../src/types";
import { eligibleActions } from "../src/sinks/linear/create-issues-from-actions";

function stubConv(actions: NormalizedConversation["actionItems"]): NormalizedConversation {
  return {
    id: "cid",
    projectName: "x",
    projectRoot: "/r",
    sourceType: "exported_file",
    importedAt: "",
    rawText: "",
    redactedText: "",
    contentHash: "",
    dedupeKey: "",
    filesReferenced: [],
    commandsRun: [],
    errors: [],
    decisions: [],
    actionItems: actions,
    tags: [],
    metadata: {},
  };
}

describe("eligibleActions", () => {
  const cfg = indexerConfigSchema.parse({});

  it("filters out follow-up type", () => {
    const c = stubConv([
      {
        title: "Do something later",
        description: "Needs follow-up polish",
        type: "follow-up",
        confidence: 0.95,
        status: "new",
      },
    ]);
    expect(eligibleActions(c, cfg)).toHaveLength(0);
  });

  it("keeps high-confidence bugs below threshold default", () => {
    const c = stubConv([
      {
        title: "Fix crash on save",
        type: "bug",
        confidence: 0.71,
        status: "new",
      },
    ]);
    expect(eligibleActions(c, cfg).length).toBe(1);
  });
});
