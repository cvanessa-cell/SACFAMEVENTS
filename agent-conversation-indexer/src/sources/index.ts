import type { ResolvedPaths } from "../config";
import type { RawSourcePayload } from "../types";
import { loadExportedFiles } from "./exported-files-source";
import { loadProjectLogs } from "./project-logs-source";
import { loadCursorProjectFiles } from "./cursor-project-source";
import { loadRepoAgentReports } from "./repo-agent-reports-source";
import { loadOptionalCursorLocal } from "./optional-cursor-local-source";
import type { IndexerConfig } from "../config";

export type SourceFilter = "exported" | "logs" | "cursor" | "reports" | "local" | "all";

export function collectRawSources(opts: {
  cfg: IndexerConfig;
  paths: ResolvedPaths;
  source: SourceFilter;
}): RawSourcePayload[] {
  const { cfg, paths, source } = opts;
  const out: RawSourcePayload[] = [];

  if (source === "exported" || source === "all") {
    out.push(...loadExportedFiles(paths.importDir));
  }
  if (source === "logs" || source === "all") {
    out.push(...loadProjectLogs(paths.projectRootResolved));
  }
  if (source === "cursor" || source === "all") {
    out.push(...loadCursorProjectFiles(paths.projectRootResolved));
  }
  if (source === "reports" || source === "all") {
    out.push(...loadRepoAgentReports(paths.projectRootResolved));
  }
  if ((source === "local" || source === "all") && cfg.indexerAllowCursorLocalScan) {
    out.push(
      ...loadOptionalCursorLocal({
        allowedAbsolutePaths: cfg.cursorLocalAllowedPaths,
        indexerRoot: paths.repoRoot,
      }),
    );
  }

  return out;
}
