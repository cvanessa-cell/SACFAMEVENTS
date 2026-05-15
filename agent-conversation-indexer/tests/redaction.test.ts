import { describe, expect, it } from "vitest";

import { redactSensitiveData } from "../src/parsing/redact-sensitive-data";

const baseSecrets = {
  redactSecrets: true,
  redactEmails: false,
  redactPhones: false,
};
const emailsOn = {
  ...baseSecrets,
  redactEmails: true,
};
const phonesOn = {
  ...baseSecrets,
  redactPhones: true,
};

describe("redactSensitiveData", () => {
  it("redacts bearer tokens", () => {
    expect(redactSensitiveData("Authorization Bearer abc.def.ghi secret", baseSecrets)).toContain("[REDACTED_TOKEN]");
  });

  it("redacts sk- style keys", () => {
    const out = redactSensitiveData("key sk-live-abcdefghijklmnopqrstuvwxyz12", baseSecrets);
    expect(out).not.toContain("sk-live-");
    expect(out).toContain("[REDACTED_SECRET]");
  });

  it("redacts database URLs", () => {
    const out = redactSensitiveData("conn postgres://user:pass@host:5432/db", baseSecrets);
    expect(out).toContain("[REDACTED_SECRET]");
    expect(out).not.toContain("postgres://user");
  });

  it("redacts env-like secret assignment lines", () => {
    const out = redactSensitiveData('OPENAI_API_KEY="sk-proj-123456789012345678901234"', baseSecrets);
    expect(out).not.toContain("sk-proj");
  });

  it("redacts emails when enabled", () => {
    const out = redactSensitiveData("contact me@example.com please", emailsOn);
    expect(out).toContain("[REDACTED_EMAIL]");
    expect(out).not.toContain("example.com");
  });

  it("redacts phone-like strings when enabled", () => {
    const out = redactSensitiveData("call 916-555-0100", phonesOn);
    expect(out).toContain("[REDACTED_PHONE]");
  });
});
