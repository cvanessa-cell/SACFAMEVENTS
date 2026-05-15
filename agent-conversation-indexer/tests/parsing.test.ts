import { describe, expect, it } from "vitest";

import { extractCommands } from "../src/parsing/extract-commands";
import { extractDecisions } from "../src/parsing/extract-decisions";
import { extractErrors } from "../src/parsing/extract-errors";
import { extractActionItems } from "../src/parsing/extract-actions";
import { extractFileReferences } from "../src/parsing/extract-code-references";
import { extractTags, extractUserRequest } from "../src/parsing/extract-metadata";

const SAMPLE = `
User: Goal: Fix the Supabase SSR flow in lib/supabase/server.ts

Request:
We need migrations for prisma/schema and better tests.

Decision: Switched auth to PKCE cookies because SSR required it.

npm run build
git status -sb

TODO: investigate timeout in playwright-report

Supabase migration failed — test failed — TypeError at app/page.tsx root

Next steps — remaining work on dashboard UI hooking Airtable and Zapier.
`;

describe("parsing extracts", () => {
  it("extracts user request style block", () => {
    expect(extractUserRequest(SAMPLE)?.toLowerCase()).toContain("fix the supabase");
  });

  it("detects referenced files", () => {
    const files = extractFileReferences(SAMPLE);
    expect(files.some((f) => f.filePath.includes("lib/supabase/server.ts"))).toBe(true);
    expect(files.some((f) => f.filePath.includes("app/page.tsx"))).toBe(true);
  });

  it("captures npm/git commands", () => {
    const cmds = extractCommands(SAMPLE).map((c) => c.command);
    expect(cmds.some((c) => c.includes("npm run build"))).toBe(true);
    expect(cmds.some((c) => c.includes("git status"))).toBe(true);
  });

  it("collects error-like lines", () => {
    const errs = extractErrors(SAMPLE);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.some((e) => e.message.toLowerCase().includes("typeerror"))).toBe(true);
  });

  it("collects decision lines", () => {
    const d = extractDecisions(SAMPLE);
    expect(d.some((x) => x.text.toLowerCase().includes("pkce"))).toBe(true);
  });

  it("collects action items", () => {
    const a = extractActionItems(SAMPLE);
    expect(a.length).toBeGreaterThan(0);
  });

  it("builds tags from keywords", () => {
    const t = extractTags(SAMPLE, []);
    expect(t).toContain("supabase");
    expect(t).toContain("airtable");
  });
});
