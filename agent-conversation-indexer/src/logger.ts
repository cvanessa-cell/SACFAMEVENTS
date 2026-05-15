type Level = "info" | "warn" | "error" | "debug";

function stamp(): string {
  return new Date().toISOString();
}

export function createLogger(verbose = false): {
  info: (...a: unknown[]) => void;
  warn: (...a: unknown[]) => void;
  error: (...a: unknown[]) => void;
  debug: (...a: unknown[]) => void;
  setVerbose: (v: boolean) => void;
} {
  let dbg = verbose;
  const emit = (level: Level, args: unknown[]) => {
    const line = `[${stamp()}][agent-indexer][${level}] ${args.map(String).join(" ")}`;
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else if (level === "debug") {
      if (dbg) console.debug(line);
    } else console.log(line);
  };
  return {
    info: (...a: unknown[]) => emit("info", a),
    warn: (...a: unknown[]) => emit("warn", a),
    error: (...a: unknown[]) => emit("error", a),
    debug: (...a: unknown[]) => emit("debug", a),
    setVerbose: (v: boolean) => {
      dbg = v;
    },
  };
}

export const log = createLogger(process.env.AGENT_INDEXER_VERBOSE === "true");
