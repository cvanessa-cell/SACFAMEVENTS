/**
 * Structured logging utility.
 *
 * Outputs JSON lines in production for easy ingestion by log aggregators
 * (Vercel, Datadog, etc.) and human-readable messages in development.
 *
 * Swap this out for a full observability SDK (Sentry, Axiom, etc.) when
 * you need error tracking with stack traces, breadcrumbs, and alerting.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: Error | unknown;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function serializeError(err: unknown): Record<string, unknown> | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: IS_PRODUCTION ? err.stack?.split("\n").slice(0, 5).join("\n") : err.stack,
    };
  }
  return { raw: String(err) };
}

function formatStructured(level: LogLevel, payload: LogPayload): string {
  return JSON.stringify({
    level,
    ts: new Date().toISOString(),
    msg: payload.message,
    ctx: payload.context,
    ...(payload.data ?? {}),
    ...(payload.error ? { error: serializeError(payload.error) } : {}),
  });
}

function formatDev(level: LogLevel, payload: LogPayload): string {
  const prefix = payload.context ? `[${payload.context}]` : "";
  const dataStr = payload.data
    ? " " + JSON.stringify(payload.data)
    : "";
  return `${level.toUpperCase()} ${prefix} ${payload.message}${dataStr}`;
}

function write(level: LogLevel, payload: LogPayload) {
  const line = IS_PRODUCTION
    ? formatStructured(level, payload)
    : formatDev(level, payload);

  switch (level) {
    case "debug":
      if (!IS_PRODUCTION) console.debug(line);
      break;
    case "info":
      console.log(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      if (payload.error && !IS_PRODUCTION) {
        console.error(payload.error);
      }
      break;
  }
}

export const logger = {
  debug(message: string, context?: string, data?: Record<string, unknown>) {
    write("debug", { message, context, data });
  },
  info(message: string, context?: string, data?: Record<string, unknown>) {
    write("info", { message, context, data });
  },
  warn(message: string, context?: string, data?: Record<string, unknown>) {
    write("warn", { message, context, data });
  },
  error(
    message: string,
    error?: unknown,
    context?: string,
    data?: Record<string, unknown>,
  ) {
    write("error", { message, context, data, error });
  },
};
