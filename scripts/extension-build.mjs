import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const outdir = path.join(repoRoot, "extension", "chrome", "dist");

mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: [
    path.join(repoRoot, "extension", "chrome", "popup.ts"),
    path.join(repoRoot, "extension", "chrome", "contentScript.ts"),
  ],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome118"],
  outdir,
  entryNames: "[name]",
});

console.log(`Built popup + content bundles into ${outdir}`);
