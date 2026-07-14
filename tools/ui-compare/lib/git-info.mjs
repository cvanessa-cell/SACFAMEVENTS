import { spawn } from "node:child_process";

export async function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `git ${args.join(" ")} failed (${code})`));
    });
  });
}

export async function detectMainBranch(repoRoot) {
  for (const branch of ["main", "master"]) {
    try {
      await runGit(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], repoRoot);
      return branch;
    } catch {
      // try next
    }
  }
  return "main";
}

function parseShortStat(output) {
  if (!output.trim()) {
    return { files: 0, insertions: 0, deletions: 0, summary: "No file changes" };
  }
  const match = output.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
  if (!match) return { files: 0, insertions: 0, deletions: 0, summary: output.trim() };
  const files = Number(match[1] || 0);
  const insertions = Number(match[2] || 0);
  const deletions = Number(match[3] || 0);
  return {
    files,
    insertions,
    deletions,
    summary: `${files} file(s), +${insertions} / -${deletions} lines`,
  };
}

async function safeDiffStat(repoRoot, args) {
  try {
    const stat = await runGit(["diff", "--shortstat", ...args], repoRoot);
    return parseShortStat(stat);
  } catch {
    return { files: 0, insertions: 0, deletions: 0, summary: "Unable to compute diff" };
  }
}

export async function loadRepoOverview(repoRoot) {
  const mainBranch = await detectMainBranch(repoRoot);
  const mainCommit = await runGit(["rev-parse", mainBranch], repoRoot);
  const currentBranch = await runGit(["branch", "--show-current"], repoRoot).catch(() => "");
  const porcelain = await runGit(["status", "--porcelain"], repoRoot).catch(() => "");
  const dirty = porcelain.trim().length > 0;

  const localRaw = await runGit(["branch", "--format=%(refname:short)"], repoRoot);
  const localBranches = localRaw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const remoteRaw = await runGit(["branch", "-r", "--format=%(refname:short)"], repoRoot).catch(() => "");
  const remoteBranches = remoteRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.endsWith("/HEAD"));

  const mainDescription = `Baseline at ${mainCommit.slice(0, 7)}. Other versions are described relative to this branch.`;

  const branches = [];
  for (const name of [...new Set([...localBranches, ...remoteBranches])]) {
    if (name === mainBranch) continue;
    const isRemote = name.startsWith("origin/");
    let commitsAhead = 0;
    let commitLines = [];
    try {
      const countRaw = await runGit(
        ["rev-list", "--count", `${mainBranch}..${name}`],
        repoRoot,
      );
      commitsAhead = Number(countRaw) || 0;
      if (commitsAhead > 0) {
        const logRaw = await runGit(
          ["log", "--oneline", "-n", "5", `${mainBranch}..${name}`],
          repoRoot,
        );
        commitLines = logRaw.split(/\r?\n/).filter(Boolean);
      }
    } catch {
      // branch may not share history
    }

    const diffStat = await safeDiffStat(repoRoot, [mainBranch, "...", name]);
    const relative =
      commitsAhead === 0
        ? `Same commits as ${mainBranch} (UI may still differ if worktree is stale). ${diffStat.summary} vs ${mainBranch}.`
        : `${commitsAhead} commit(s) ahead of ${mainBranch}. ${diffStat.summary} vs ${mainBranch}.`;

    branches.push({
      id: name,
      name,
      kind: isRemote ? "remote" : "local",
      commitsAhead,
      recentCommits: commitLines,
      diffStat,
      description: relative,
    });
  }

  const uncommittedStat = dirty
    ? await safeDiffStat(repoRoot, [])
    : { files: 0, insertions: 0, deletions: 0, summary: "Working tree clean" };

  const changedFiles = dirty
    ? porcelain.split(/\r?\n/).map((line) => line.slice(3).trim()).filter(Boolean)
    : [];

  const uncommitted = {
    id: "working-copy",
    name: "Uncommitted changes",
    kind: "working-copy",
    dirty,
    currentBranch: currentBranch || "(detached)",
    changedFiles,
    diffStat: uncommittedStat,
    description: dirty
      ? `Local edits on top of ${currentBranch || "HEAD"} (${uncommittedStat.summary}). Not on any branch until committed.`
      : "No uncommitted edits in the project folder.",
  };

  return {
    repoRoot,
    mainBranch,
    mainCommit,
    currentBranch,
    dirty,
    main: {
      id: "main",
      name: mainBranch,
      kind: "main",
      commit: mainCommit,
      description: mainDescription,
    },
    branches,
    uncommitted,
  };
}

export async function commitChanges(repoRoot, { message }) {
  if (!message?.trim()) throw new Error("Commit message is required.");
  await runGit(["add", "-A"], repoRoot);
  const status = await runGit(["status", "--porcelain"], repoRoot);
  if (!status.trim()) throw new Error("Nothing to commit.");
  await runGit(["commit", "-m", message.trim()], repoRoot);
  return loadRepoOverview(repoRoot);
}
