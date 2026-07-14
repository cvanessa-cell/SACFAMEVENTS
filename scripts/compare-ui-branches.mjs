#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export function sanitizeBranchFolderName(branchName) {
  return branchName
    .replace(/^refs\/heads\//, "")
    .replace(/^refs\/remotes\//, "")
    .replace(/^origin\//, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "selected-branch";
}

export function routeToSlug(route) {
  const normalized = route.trim() || "/";
  if (normalized === "/") return "home";
  return normalized
    .replace(/[?#].*$/, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "route";
}

export function detectPackageManager(files) {
  const fileSet = new Set(files);
  if (fileSet.has("pnpm-lock.yaml")) return "pnpm";
  if (fileSet.has("yarn.lock")) return "yarn";
  if (fileSet.has("package-lock.json")) return "npm";
  if (fileSet.has("bun.lockb") || fileSet.has("bun.lock")) return "bun";
  return "npm";
}

export async function isPortAvailable(port, host = "127.0.0.1") {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.once("error", () => resolvePort(false));
    server.once("listening", () => {
      server.close(() => resolvePort(true));
    });
    server.listen(port, host);
  });
}

const scriptPath = fileURLToPath(import.meta.url);
const isMain = resolve(process.argv[1] || "") === scriptPath;

if (isMain) {
  main().catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rl = createInterface({ input, output });
  const children = [];

  const cleanupChildren = () => {
    for (const child of children) {
      if (!child.killed) child.kill("SIGTERM");
    }
  };

  process.on("SIGINT", () => {
    cleanupChildren();
    process.exit(130);
  });
  process.on("SIGTERM", cleanupChildren);

  try {
    const repoRoot = await git(["rev-parse", "--show-toplevel"], process.cwd());
    const currentBranch = await git(["branch", "--show-current"], repoRoot).catch(() => "");
    const dirty = (await git(["status", "--porcelain"], repoRoot)).trim().length > 0;
    const mainBranch = args["main-branch"] || await detectMainBranch(repoRoot, rl);
    const localBranches = await listLocalBranches(repoRoot);
    const remoteBranches = await listRemoteBranches(repoRoot);
    const worktrees = await listWorktrees(repoRoot);

    printRepoInspection({
      repoRoot,
      mainBranch,
      currentBranch,
      dirty,
      localBranches,
      remoteBranches,
      worktrees,
    });

    if (dirty) {
      console.warn("\nWarning: this working tree has uncommitted changes.");
      console.warn("Separate branch worktrees will not include those changes unless you choose current-working-copy mode.\n");
    }

    const selection = await selectComparisonTarget({
      args,
      rl,
      localBranches,
      remoteBranches,
      currentBranch,
      dirty,
    });

    const mainPort = await choosePort(Number(args["main-port"] || 3131), "main", rl);
    const branchPort = await choosePort(Number(args["branch-port"] || 3132), "branch", rl);
    const routes = parseRoutes(
      args.routes || "/,/discover,/events,/admin/event-monitoring,/admin/events/web-discovery",
    );
    const compareParent = resolve(repoRoot, "..", "sacfam-ui-compare");
    const mainWorktree = join(compareParent, "main");
    const branchFolder = selection.currentWorkingCopy
      ? "current-working-copy"
      : sanitizeBranchFolderName(selection.branch);
    const branchWorktree = selection.currentWorkingCopy
      ? repoRoot
      : join(compareParent, branchFolder);

    mkdirSync(compareParent, { recursive: true });

    const mainCommit = await git(["rev-parse", mainBranch], repoRoot);
    await ensureWorktree({
      repoRoot,
      targetPath: mainWorktree,
      label: "clean main",
      commitish: mainCommit,
      rl,
      autoReuse: true,
    });

    let branchCommit = "current-working-copy";
    if (selection.currentWorkingCopy) {
      console.warn("Current working copy mode: comparing clean main against this directory, including uncommitted changes.");
    } else {
      branchCommit = await git(["rev-parse", selection.branch], repoRoot);
      await ensureWorktree({
        repoRoot,
        targetPath: branchWorktree,
        label: selection.branch,
        commitish: branchCommit,
        rl,
      });
    }

    if (!args["skip-install"]) {
      await maybeInstallDependencies(mainWorktree, "main", rl);
      if (!selection.currentWorkingCopy) {
        await maybeInstallDependencies(branchWorktree, "branch", rl);
      } else {
        await maybeInstallDependencies(branchWorktree, "current working copy", rl);
      }
    }

    const mainServer = startDevServer(mainWorktree, "main", mainPort);
    const branchServer = startDevServer(branchWorktree, "branch", branchPort);
    children.push(mainServer, branchServer);

    await waitForUrl(`http://localhost:${mainPort}`, "main");
    await waitForUrl(`http://localhost:${branchPort}`, "branch");

    const mainUrl = `http://localhost:${mainPort}`;
    const branchUrl = `http://localhost:${branchPort}`;

    console.log("\nMain:");
    console.log(mainUrl);
    console.log("\nSelected branch:");
    console.log(branchUrl);

    if (args.open || await confirm(rl, "Open both URLs in the browser?", false)) {
      await openBrowser(mainUrl);
      await openBrowser(branchUrl);
    }

    if (!args["skip-screenshots"]) {
      await maybeGenerateVisualReport({
        repoRoot,
        mainUrl,
        branchUrl,
        mainCommit,
        branchCommit,
        branchName: selection.currentWorkingCopy ? "current-working-copy" : selection.branch,
        routes,
        rl,
      });
    }

    let preference = "neither";
    if (!args["skip-preference"]) {
      preference = await promptPreferredVersion(rl, { mainUrl, branchUrl, selection });
      await applyPreferredVersion({
        preference,
        repoRoot,
        mainWorktree,
        branchWorktree,
        mainCommit,
        selection,
        mainServer,
        branchServer,
        children,
        rl,
      });
    } else if (args.cleanup) {
      await maybeCleanupWorktrees({ repoRoot, mainWorktree, branchWorktree, selection, rl });
    }

    if (preference === "neither") {
      printCleanupCommands({ mainWorktree, branchWorktree, selection });
    }
    console.log("\nDev servers are still running. Press Ctrl+C to stop them.");
    await new Promise(() => {});
  } finally {
    rl.close();
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

async function git(args, cwd) {
  const result = await run("git", args, cwd, { collect: true });
  return result.stdout.trim();
}

function run(command, args, cwd, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32",
      stdio: options.collect ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (options.collect) {
      child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    }
    child.on("close", (code) => {
      if (code === 0) resolveRun({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}\n${stderr}`));
    });
  });
}

async function detectMainBranch(repoRoot, rl) {
  for (const branch of ["main", "master"]) {
    try {
      await git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], repoRoot);
      return branch;
    } catch {
      // Try the next conventional branch name.
    }
  }
  const answer = await rl.question("Could not detect main/master. Enter the branch to use as main: ");
  if (!answer.trim()) throw new Error("A main branch is required.");
  return answer.trim();
}

async function listLocalBranches(repoRoot) {
  const outputBranches = await git(["branch", "--format=%(refname:short)"], repoRoot);
  return outputBranches.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

async function listRemoteBranches(repoRoot) {
  const outputBranches = await git(["branch", "-r", "--format=%(refname:short)"], repoRoot);
  return outputBranches
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.endsWith("/HEAD"));
}

async function listWorktrees(repoRoot) {
  const outputTrees = await git(["worktree", "list", "--porcelain"], repoRoot);
  const entries = [];
  let current = null;
  for (const line of outputTrees.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      if (current) entries.push(current);
      current = { path: line.slice("worktree ".length) };
    } else if (current && line.startsWith("HEAD ")) {
      current.head = line.slice("HEAD ".length);
    } else if (current && line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
    } else if (current && line === "detached") {
      current.detached = true;
    }
  }
  if (current) entries.push(current);
  return entries;
}

function printRepoInspection({ repoRoot, mainBranch, currentBranch, dirty, localBranches, remoteBranches, worktrees }) {
  console.log(`Repository: ${repoRoot}`);
  console.log(`Default main branch: ${mainBranch}`);
  console.log(`Current branch: ${currentBranch || "(detached HEAD)"}`);
  console.log(`Uncommitted changes: ${dirty ? "yes" : "no"}`);
  console.log("\nLocal branches:");
  localBranches.forEach((branch) => console.log(`  - ${branch}`));
  console.log("\nRemote branches:");
  remoteBranches.forEach((branch) => console.log(`  - ${branch}`));
  console.log("\nExisting worktrees:");
  worktrees.forEach((tree) => {
    console.log(`  - ${tree.path} ${tree.branch ? `[${tree.branch}]` : "[detached]"}`);
  });
}

async function selectComparisonTarget({ args, rl, localBranches, remoteBranches, dirty }) {
  if (args["current-working-copy"]) return { currentWorkingCopy: true };
  if (args.branch) return { branch: args.branch, currentWorkingCopy: false };

  const choices = [
    ...localBranches.map((branch) => ({ label: branch, branch })),
    ...remoteBranches.map((branch) => ({ label: branch, branch })),
  ];
  if (dirty) choices.push({ label: "Compare current working copy, including uncommitted changes", currentWorkingCopy: true });

  console.log("\nSelect a branch to compare against main:");
  choices.forEach((choice, index) => console.log(`${index + 1}. ${choice.label}`));

  while (true) {
    const answer = await rl.question("Enter number: ");
    const selected = choices[Number(answer) - 1];
    if (selected) return selected;
    console.log("Please choose a valid number.");
  }
}

async function choosePort(defaultPort, label, rl) {
  let port = defaultPort;
  while (!(await isPortAvailable(port))) {
    console.warn(`Port ${port} for ${label} is already in use.`);
    const answer = await rl.question(`Enter a different ${label} port: `);
    port = Number(answer);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      port = defaultPort + 10;
      console.warn(`Invalid port. Trying ${port}.`);
    }
  }
  return port;
}

function parseRoutes(routesArg) {
  return routesArg.split(",").map((route) => route.trim()).filter(Boolean);
}

async function ensureWorktree({ repoRoot, targetPath, label, commitish, rl, autoReuse = false }) {
  if (existsSync(targetPath)) {
    const isWorktree = await git(["-C", targetPath, "rev-parse", "--is-inside-work-tree"], repoRoot)
      .then((value) => value === "true")
      .catch(() => false);
    if (!isWorktree) {
      throw new Error(`${targetPath} exists but is not a valid git worktree. The script will not delete it automatically.`);
    }
    const existingHead = await git(["-C", targetPath, "rev-parse", "HEAD"], repoRoot).catch(() => "");
    const existingDirty = (await git(["-C", targetPath, "status", "--porcelain"], repoRoot).catch(() => "")).trim().length > 0;
    if (existingDirty) {
      console.warn(`${label} worktree at ${targetPath} has uncommitted changes. The script will not reset or stash them.`);
    }
    if (existingHead && existingHead !== commitish) {
      console.warn(`${label} worktree is at ${existingHead}, but requested commit is ${commitish}.`);
    }
    if (autoReuse) {
      console.log(`${label} worktree already exists at ${targetPath}. Reusing it as-is.`);
    } else {
      const reuse = await confirm(rl, `${label} worktree already exists at ${targetPath}. Reuse it as-is?`, true);
      if (!reuse) {
        throw new Error("Stopped without modifying or deleting the existing worktree.");
      }
    }
    return;
  }

  console.log(`Creating ${label} worktree at ${targetPath}`);
  await run("git", ["worktree", "add", "--detach", targetPath, commitish], repoRoot);
}

async function maybeInstallDependencies(worktreePath, label, rl) {
  if (existsSync(join(worktreePath, "node_modules"))) return;
  const install = await confirm(rl, `${label} is missing node_modules. Install dependencies?`, true);
  if (!install) return;

  const packageManager = detectPackageManager(listRootFiles(worktreePath));
  const { command, args } = installCommand(packageManager);
  console.log(`Installing dependencies for ${label} with ${command} ${args.join(" ")}`);
  await run(command, args, worktreePath);
}

function listRootFiles(path) {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function installCommand(packageManager) {
  if (packageManager === "pnpm") return { command: "pnpm", args: ["install", "--frozen-lockfile"] };
  if (packageManager === "yarn") return { command: "yarn", args: ["install", "--frozen-lockfile"] };
  if (packageManager === "bun") return { command: "bun", args: ["install", "--frozen-lockfile"] };
  return { command: "npm", args: ["ci"] };
}

function devCommand(packageManager, port) {
  if (packageManager === "pnpm") return { command: "pnpm", args: ["dev", "--", "-p", String(port)] };
  if (packageManager === "yarn") return { command: "yarn", args: ["dev", "-p", String(port)] };
  if (packageManager === "bun") return { command: "bun", args: ["dev", "--", "-p", String(port)] };
  return { command: "npm", args: ["run", "dev", "--", "-p", String(port)] };
}

/** Install deps in a git worktree when node_modules is missing (non-interactive). */
export async function ensureWorktreeDependencies(worktreePath, label) {
  if (existsSync(join(worktreePath, "node_modules", "next"))) return;
  const packageManager = detectPackageManager(listRootFiles(worktreePath));
  const { command, args } = installCommand(packageManager);
  console.log(`[${label}] Installing dependencies in ${worktreePath}…`);
  await run(command, args, worktreePath);
}

/**
 * Start Next dev on an explicit port. Uses `next dev -p` directly so a fixed
 * port inside package.json "dev" (e.g. next dev -p 3333) cannot override compare ports.
 */
export function startDevServer(worktreePath, label, port) {
  const packageJsonPath = join(worktreePath, "package.json");
  if (!existsSync(packageJsonPath)) throw new Error(`${worktreePath} does not contain package.json.`);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (!packageJson.scripts?.dev) throw new Error(`${worktreePath} does not have a dev script.`);

  const nextBin = join(
    worktreePath,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "next.cmd" : "next",
  );
  const env = {
    ...process.env,
    PORT: String(port),
    UI_COMPARE_EMBED: "1",
  };

  let child;
  if (existsSync(nextBin)) {
    console.log(`Starting ${label}: next dev -p ${port} (in ${worktreePath})`);
    child = spawn(nextBin, ["dev", "-p", String(port), "--hostname", "127.0.0.1"], {
      cwd: worktreePath,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
  } else {
    const packageManager = detectPackageManager(listRootFiles(worktreePath));
    const { command, args } = devCommand(packageManager, port);
    console.log(`Starting ${label}: ${command} ${args.join(" ")}`);
    child = spawn(command, args, {
      cwd: worktreePath,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
  }

  child.stdout.on("data", (chunk) => prefixLog(label, chunk));
  child.stderr.on("data", (chunk) => prefixLog(label, chunk));
  return child;
}

function prefixLog(label, chunk) {
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line.trim()) console.log(`[${label}] ${line}`);
  }
}

async function waitForUrl(url, label) {
  const timeoutMs = 90_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // Server is still starting.
    }
    await sleep(1500);
  }
  throw new Error(`${label} did not respond at ${url} within ${timeoutMs / 1000}s.`);
}

async function openBrowser(url) {
  const command = process.platform === "win32"
    ? "start"
    : process.platform === "darwin"
      ? "open"
      : "xdg-open";
  await run(command, process.platform === "win32" ? ["", url] : [url], process.cwd()).catch(() => {
    console.warn(`Could not open ${url}.`);
  });
}

async function maybeGenerateVisualReport({ repoRoot, mainUrl, branchUrl, mainCommit, branchCommit, branchName, routes, rl }) {
  const tooling = await loadVisualTooling();
  if (!tooling.ok) {
    console.warn("\nScreenshot diff tools are not installed.");
    console.warn("Needed packages: playwright, pixelmatch, pngjs");
    const install = await confirm(rl, "Install them as dev dependencies now?", false);
    if (!install) {
      console.warn("Skipping screenshot diff. The side-by-side dev servers are still running.");
      return;
    }
    await run("npm", ["install", "-D", "playwright", "pixelmatch", "pngjs"], repoRoot);
  }

  const { chromium } = await import("playwright");
  const pixelmatch = (await import("pixelmatch")).default;
  const { PNG } = await import("pngjs");

  const timestamp = timestampFolderName();
  const reportRoot = join(repoRoot, "ui-diff-report", timestamp);
  const mainShotDir = join(reportRoot, "screenshots", "main");
  const branchShotDir = join(reportRoot, "screenshots", "branch");
  const diffShotDir = join(reportRoot, "screenshots", "diff");
  mkdirSync(mainShotDir, { recursive: true });
  mkdirSync(branchShotDir, { recursive: true });
  mkdirSync(diffShotDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const routeResults = [];

  try {
    for (const route of routes) {
      const slug = routeToSlug(route);
      const mainPath = join(mainShotDir, `${slug}.png`);
      const branchPath = join(branchShotDir, `${slug}.png`);
      const diffPath = join(diffShotDir, `${slug}.png`);

      await capture(page, `${mainUrl}${route}`, mainPath);
      await capture(page, `${branchUrl}${route}`, branchPath);
      const diffResult = createPixelDiff({ mainPath, branchPath, diffPath, PNG, pixelmatch });

      routeResults.push({
        route,
        slug,
        mainScreenshot: toReportPath(reportRoot, mainPath),
        branchScreenshot: toReportPath(reportRoot, branchPath),
        diffScreenshot: toReportPath(reportRoot, diffPath),
        mismatchPixels: diffResult.mismatchPixels,
        totalPixels: diffResult.totalPixels,
        mismatchPercentage: diffResult.mismatchPercentage,
        mainUrl: `${mainUrl}${route}`,
        branchUrl: `${branchUrl}${route}`,
      });
      console.log(`Captured ${route}: ${diffResult.mismatchPercentage.toFixed(2)}% mismatch`);
    }
  } finally {
    await browser.close();
  }

  const summary = {
    branchName,
    mainCommit,
    branchCommit,
    generatedAt: new Date().toISOString(),
    mainUrl,
    branchUrl,
    routes: routeResults,
  };
  writeFileSync(join(reportRoot, "summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(reportRoot, "report.html"), renderReport(summary));
  console.log(`\nVisual diff report: ${join(reportRoot, "report.html")}`);
}

async function loadVisualTooling() {
  try {
    await import("playwright");
    await import("pixelmatch");
    await import("pngjs");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

async function capture(page, url, path) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 }).catch(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  });
  await page.screenshot({ path, fullPage: true });
}

function createPixelDiff({ mainPath, branchPath, diffPath, PNG, pixelmatch }) {
  const mainImage = PNG.sync.read(readFileSync(mainPath));
  const branchImage = PNG.sync.read(readFileSync(branchPath));
  const width = Math.max(mainImage.width, branchImage.width);
  const height = Math.max(mainImage.height, branchImage.height);
  const normalizedMain = normalizePng(mainImage, width, height, PNG);
  const normalizedBranch = normalizePng(branchImage, width, height, PNG);
  const diff = new PNG({ width, height });
  const mismatchPixels = pixelmatch(
    normalizedMain.data,
    normalizedBranch.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 },
  );
  writeFileSync(diffPath, PNG.sync.write(diff));
  const totalPixels = width * height;
  return {
    mismatchPixels,
    totalPixels,
    mismatchPercentage: totalPixels ? (mismatchPixels / totalPixels) * 100 : 0,
  };
}

function normalizePng(image, width, height, PNG) {
  if (image.width === width && image.height === height) return image;
  const normalized = new PNG({ width, height, fill: true });
  PNG.bitblt(image, normalized, 0, 0, image.width, image.height, 0, 0);
  return normalized;
}

function renderReport(summary) {
  const rows = summary.routes.map((route) => `
    <section>
      <h2>${escapeHtml(route.route)}</h2>
      <p>
        <a href="${route.mainUrl}">main page</a>
        <a href="${route.branchUrl}">branch page</a>
        <strong>${route.mismatchPercentage.toFixed(2)}% mismatch</strong>
      </p>
      <div class="grid">
        <figure><figcaption>Main</figcaption><img src="${route.mainScreenshot}" /></figure>
        <figure><figcaption>Branch</figcaption><img src="${route.branchScreenshot}" /></figure>
        <figure><figcaption>Diff</figcaption><img src="${route.diffScreenshot}" /></figure>
      </div>
    </section>
  `).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>UI Branch Comparison</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #17201a; background: #fbfaf7; }
    code { background: #eee9df; padding: 2px 5px; border-radius: 4px; }
    section { border-top: 1px solid #d8d1c2; padding: 24px 0; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start; }
    figure { margin: 0; background: #fff; border: 1px solid #d8d1c2; border-radius: 8px; overflow: hidden; }
    figcaption { font-weight: 700; padding: 10px 12px; border-bottom: 1px solid #d8d1c2; }
    img { display: block; width: 100%; height: auto; }
    a { margin-right: 12px; color: #315c42; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>UI Branch Comparison</h1>
  <p><strong>Compared branch:</strong> <code>${escapeHtml(summary.branchName)}</code></p>
  <p><strong>Main commit:</strong> <code>${escapeHtml(summary.mainCommit)}</code></p>
  <p><strong>Branch commit:</strong> <code>${escapeHtml(summary.branchCommit)}</code></p>
  <p><strong>Generated:</strong> ${escapeHtml(summary.generatedAt)}</p>
  <p><strong>Main URL:</strong> <a href="${summary.mainUrl}">${summary.mainUrl}</a></p>
  <p><strong>Branch URL:</strong> <a href="${summary.branchUrl}">${summary.branchUrl}</a></p>
  ${rows}
</body>
</html>`;
}

function timestampFolderName() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

function toReportPath(reportRoot, filePath) {
  return relative(reportRoot, filePath).replaceAll("\\", "/");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function promptPreferredVersion(rl, { mainUrl, branchUrl, selection }) {
  const branchLabel = selection.currentWorkingCopy
    ? "Current working copy (includes uncommitted changes)"
    : selection.branch;

  console.log("\nReview both versions in the browser, then choose which to keep.");
  console.log(`  1. Main — ${mainUrl}`);
  console.log(`  2. ${branchLabel} — ${branchUrl}`);
  console.log("  3. Keep both for now (no cleanup)");

  while (true) {
    const answer = (await rl.question("Which version do you prefer? Enter 1, 2, or 3: ")).trim();
    if (answer === "1") return "main";
    if (answer === "2") return "branch";
    if (answer === "3") return "neither";
    console.log("Please enter 1, 2, or 3.");
  }
}

async function applyPreferredVersion({
  preference,
  repoRoot,
  mainWorktree,
  branchWorktree,
  mainCommit,
  selection,
  mainServer,
  branchServer,
  children,
  rl,
}) {
  if (preference === "neither") {
    console.log("\nNo cleanup applied.");
    return;
  }

  const preferMain = preference === "main";
  const preferredLabel = preferMain ? "main" : (selection.currentWorkingCopy ? "current working copy" : selection.branch);
  const discardedLabel = preferMain
    ? (selection.currentWorkingCopy ? "current working copy" : selection.branch)
    : "clean main";

  console.log(`\nKeeping ${preferredLabel}. Removing ${discardedLabel} where possible.`);

  stopDevServer(preferMain ? branchServer : mainServer, children);
  console.log(`Stopped dev server for ${discardedLabel}.`);

  if (preferMain) {
    if (selection.currentWorkingCopy) {
      const dirty = (await git(["status", "--porcelain"], repoRoot)).trim().length > 0;
      if (dirty) {
        console.warn("\nPreferring main will discard uncommitted changes in your project folder.");
        const reset = await confirm(rl, `Reset ${repoRoot} to clean main (${mainCommit.slice(0, 7)})?`, false);
        if (reset) {
          await run("git", ["reset", "--hard", mainCommit], repoRoot);
          console.log("Project folder reset to clean main.");
        } else {
          console.log("Project folder left unchanged.");
        }
      } else {
        console.log("Project folder already matches clean main.");
      }
    } else {
      await removeWorktreeIfExists(repoRoot, branchWorktree, selection.branch, rl);
    }
    console.log(`Main comparison worktree kept at ${mainWorktree}`);
    console.log(`Main UI still available at the main dev server port until you press Ctrl+C.`);
    return;
  }

  await removeWorktreeIfExists(repoRoot, mainWorktree, "clean main", rl, { auto: true });

  if (selection.currentWorkingCopy) {
    console.log(`Kept your project folder at ${repoRoot} with current changes.`);
    console.log(`Branch/current UI still available at the branch dev server port until you press Ctrl+C.`);
    return;
  }

  console.log(`Kept branch worktree at ${branchWorktree}`);
  const checkout = await confirm(rl, `Check out ${selection.branch} in your primary project folder?`, false);
  if (checkout) {
    await run("git", ["checkout", selection.branch], repoRoot);
    console.log(`Checked out ${selection.branch} in ${repoRoot}`);
  }
  console.log(`Branch UI still available at the branch dev server port until you press Ctrl+C.`);
}

function stopDevServer(child, children) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  const index = children.indexOf(child);
  if (index >= 0) children.splice(index, 1);
}

async function removeWorktreeIfExists(repoRoot, treePath, label, rl, { auto = false } = {}) {
  const resolvedTree = resolve(treePath);
  const resolvedRepo = resolve(repoRoot);
  if (!existsSync(resolvedTree)) return;
  if (resolvedTree === resolvedRepo) {
    console.log(`Skipped worktree removal for primary project folder (${resolvedTree}).`);
    return;
  }

  let remove = auto;
  if (!auto) {
    remove = await confirm(rl, `Remove ${label} worktree at ${resolvedTree}?`, false);
  }
  if (!remove) {
    console.log(`Kept ${label} worktree at ${resolvedTree}`);
    return;
  }

  try {
    await run("git", ["worktree", "remove", resolvedTree], repoRoot);
    console.log(`Removed ${label} worktree at ${resolvedTree}`);
  } catch (error) {
    console.warn(`Could not remove ${label} worktree automatically: ${error?.message || error}`);
    console.warn(`Run manually: git worktree remove "${resolvedTree}"`);
  }
}

async function maybeCleanupWorktrees({ repoRoot, mainWorktree, branchWorktree, selection, rl }) {
  const paths = selection.currentWorkingCopy ? [mainWorktree] : [mainWorktree, branchWorktree];
  for (const treePath of paths) {
    const remove = await confirm(rl, `Remove worktree ${treePath}?`, false);
    if (remove) await run("git", ["worktree", "remove", treePath], repoRoot);
  }
}

function printCleanupCommands({ mainWorktree, branchWorktree, selection }) {
  console.log("\nManual cleanup commands, if you later want to remove these worktrees:");
  console.log("git worktree list");
  console.log(`git worktree remove "${mainWorktree}"`);
  if (!selection.currentWorkingCopy) {
    console.log(`git worktree remove "${branchWorktree}"`);
  }
}

async function confirm(rl, question, defaultValue) {
  const suffix = defaultValue ? "Y/n" : "y/N";
  const answer = (await rl.question(`${question} (${suffix}) `)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return answer === "y" || answer === "yes";
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
