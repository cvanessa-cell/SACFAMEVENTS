export type RedactOptions = {
  redactSecrets: boolean;
  redactEmails: boolean;
  redactPhones: boolean;
};

const PLACEHOLDER = {
  secret: "[REDACTED_SECRET]",
  token: "[REDACTED_TOKEN]",
  jwt: "[REDACTED_TOKEN]",
  cookie: "[REDACTED_TOKEN]",
  env: "[REDACTED_SECRET]",
  keyblock: "[REDACTED_SECRET]",
  password: "[REDACTED_SECRET]",
  url: "[REDACTED_SECRET]",
  email: "[REDACTED_EMAIL]",
  phone: "[REDACTED_PHONE]",
} as const;

function redactSuspiciousEnvAssignments(text: string): string {
  return text.replace(
    /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*((?:[^\r\n\\]|\\.)+)$/gm,
    (_full, lead: string, name: string, value: string) => {
      const n = String(name);
      const v = String(value);
      if (/API|SECRET|KEY|TOKEN|PASSWORD|DATABASE_URL|PRIVATE/i.test(n) && v.trim().length > 0) {
        return `${lead}${n}=${PLACEHOLDER.env}`;
      }
      return `${lead}${n}=${v}`;
    },
  );
}

function applySequential(input: string, patterns: Array<{ rx: RegExp; rep: string }>): string {
  let out = input;
  for (const { rx, rep } of patterns) {
    out = out.replace(rx, rep);
  }
  return out;
}

/**
 * Redact obvious secrets before any external sync or LLM call.
 */
export function redactSensitiveData(text: string, opts: RedactOptions): string {
  let out = text;

  const patternsCommon: Array<{ rx: RegExp; rep: string }> = [];

  if (opts.redactSecrets) {
    patternsCommon.push(
      { rx: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi, rep: `Bearer ${PLACEHOLDER.token}` },
      { rx: /\bsk-[A-Za-z0-9_-]{20,}\b/gi, rep: PLACEHOLDER.secret },
      {
        rx: /\bsbp_[a-zA-Z0-9_]+\b/gi,
        rep: PLACEHOLDER.secret,
      },
      { rx: /\bpat[A-Za-z0-9]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/gi, rep: PLACEHOLDER.token },
      { rx: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, rep: PLACEHOLDER.jwt },
      {
        rx: /\bpostgres(?:ql)?:\/\/[^\s"'`]+/gi,
        rep: PLACEHOLDER.url,
      },
      {
        rx: /\bmysql:\/\/[^\s"'`]+/gi,
        rep: PLACEHOLDER.url,
      },
      {
        rx: /\bmongodb(?:\+srv)?:\/\/[^\s"'`]+/gi,
        rep: PLACEHOLDER.url,
      },
      {
        rx: /\bredis:\/\/[^\s"'`]+/gi,
        rep: PLACEHOLDER.url,
      },
      {
        rx: /\bsupabase\s+service\s+role\s*[:=]\s*[^\s\n]+/gi,
        rep: `supabase service role: ${PLACEHOLDER.secret}`,
      },
      {
        rx: /\bservice_role_[A-Za-z0-9_\-]+\b/gi,
        rep: PLACEHOLDER.secret,
      },
      { rx: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, rep: PLACEHOLDER.keyblock },
      { rx: /\b[A-Za-z0-9_-]*password\b\s*[:=]\s*([^\s\n]+)/gi, rep: `password=${PLACEHOLDER.password}` },
      { rx: /Set-Cookie:\s*[^\n]+/gi, rep: `Set-Cookie: ${PLACEHOLDER.cookie}` },
      { rx: /\bcookie:\s*[^\n]+/gi, rep: `cookie: ${PLACEHOLDER.cookie}` },
      { rx: /\.env[^\s]*\s*=>\s*\{[^\}]{0,12000}\}/gi, rep: `{${PLACEHOLDER.env}}` },
    );

    patternsCommon.push({
      rx: /(^|\n)\s*(\b[A-Za-z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PRIVATE|PWD))\s*[:=]\s*(["']?)([A-Za-z0-9_\-./+=]{16,})\3/gm,
      rep: `$1$2=${PLACEHOLDER.secret}`,
    });

    patternsCommon.push(
      {
        rx: /(^|\n)\s*([A-Za-z0-9_]+)\s*=\s*((?:sk-|pk_live_|rk_live_|whsec_|xox[baprs]-)[A-Za-z0-9\-_/+=]{16,})\s*(?=\r?\n|$)/gi,
        rep: `$1$2=${PLACEHOLDER.secret}`,
      },
    );

    // Webhook URLs with tokens
    patternsCommon.push({
      rx: /https:\/\/hooks\.slack\.com\/services\/[^\s"'`\)]+/gi,
      rep: PLACEHOLDER.url,
    });

    patternsCommon.push({
      rx: /https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/[^\s"'`\)]+/gi,
      rep: PLACEHOLDER.url,
    });

    patternsCommon.push({ rx: /https:\/\/[^\s"'`]+\?(?:[^\s"'`]*[?&](?:token|key|secret)=)[^\s"'`]*/gi, rep: PLACEHOLDER.url });
  }

  out = applySequential(out, patternsCommon);

  if (opts.redactSecrets) {
    out = redactSuspiciousEnvAssignments(out);
  }

  if (opts.redactEmails) {
    const emailRx = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
    out = out.replace(emailRx, PLACEHOLDER.email);
  }

  if (opts.redactPhones) {
    const phoneRx = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;
    out = out.replace(phoneRx, PLACEHOLDER.phone);
  }

  return out;
}
