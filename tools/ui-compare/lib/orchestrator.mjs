import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import {
  ensureWorktreeDependencies,
  isPortAvailable,
  sanitizeBranchFolderName,
  startDevServer,
} from "../../../scripts/compare-ui-branches.mjs";
import { detectMainBranch, runGit } from "./git-info.mjs";

const DEFAULT_ROUTES = [
  "/",
  "/discover",
  "/events",
  "/admin/event-monitoring",
  "/admin/events/web-discovery",
];

const sessions = new Map();

async function waitForUrl(url, child, label) {
  const timeoutMs = 180_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(
        `${label} dev server exited before ${url} was ready (code ${child.exitCode}). Check the terminal running ui-compare for errors.`,
      );
    }
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // still starting
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(
    `Server did not respond at ${url} within 3 minutes. First compare may need npm install in git worktrees — check the ui-compare terminal output.`,
  );
}

async function ensureWorktree(repoRoot, targetPath, commitish) {
  if (existsSync(targetPath)) return;
  mkdirSync(resolve(targetPath, ".."), { recursive: true });
  await new Promise((resolveRun, reject) => {
    const child = spawn("git", ["worktree", "add", "--detach", targetPath, commitish], {
      cwd: repoRoot,
      shell: process.platform === "win32",
      stdio: "inherit",
    });
    child.on("close", (code) => (code === 0 ? resolveRun() : reject(new Error("worktree add failed"))));
  });
}

async function resolveTarget(repoRoot, targetId, compareParent, mainBranch) {
  if (targetId === "working-copy") {
    return { path: repoRoot, label: "Uncommitted changes", commit: "working-copy" };
  }
  if (targetId === "main") {
    const mainCommit = await runGit(["rev-parse", mainBranch], repoRoot);
    const mainPath = join(compareParent, "main");
    await ensureWorktree(repoRoot, mainPath, mainCommit);
    return { path: mainPath, label: mainBranch, commit: mainCommit };
  }
  const commit = await runGit(["rev-parse", targetId], repoRoot);
  const folder = sanitizeBranchFolderName(targetId);
  const branchPath = join(compareParent, folder);
  await ensureWorktree(repoRoot, branchPath, commit);
  return { path: branchPath, label: targetId, commit };
}

async function pickPort(preferred) {
  let port = preferred;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await isPortAvailable(port)) return port;
    port += 1;
  }
  throw new Error(`No free port near ${preferred}`);
}

export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

export async function startComparison(repoRoot, { leftId, rightId, routes = DEFAULT_ROUTES }) {
  if (!leftId || !rightId) throw new Error("Select a left and right version to compare.");
  if (leftId === rightId) throw new Error("Choose two different versions.");

  const mainBranch = await detectMainBranch(repoRoot);
  const compareParent = resolve(repoRoot, "..", "sacfam-ui-compare");

  const [left, right] = await Promise.all([
    resolveTarget(repoRoot, leftId, compareParent, mainBranch),
    resolveTarget(repoRoot, rightId, compareParent, mainBranch),
  ]);

  await ensureWorktreeDependencies(left.path, "left");
  await ensureWorktreeDependencies(right.path, "right");

  const leftPort = await pickPort(3131);
  const rightPort = await pickPort(leftPort === 3131 ? 3132 : leftPort + 1);

  const leftChild = startDevServer(left.path, "left", leftPort);
  const rightChild = startDevServer(right.path, "right", rightPort);

  const leftUrl = `http://127.0.0.1:${leftPort}`;
  const rightUrl = `http://127.0.0.1:${rightPort}`;

  await Promise.all([
    waitForUrl(leftUrl, leftChild, "Left"),
    waitForUrl(rightUrl, rightChild, "Right"),
  ]);

  const sessionId = randomUUID();
  const session = {
    id: sessionId,
    repoRoot,
    left: { id: leftId, label: left.label, commit: left.commit, port: leftPort, url: leftUrl },
    right: { id: rightId, label: right.label, commit: right.commit, port: rightPort, url: rightUrl },
    routes,
    children: [leftChild, rightChild],
    createdAt: new Date().toISOString(),
  };
  sessions.set(sessionId, session);
  return session;
}

export function stopSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  for (const child of session.children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  sessions.delete(sessionId);
  return true;
}
