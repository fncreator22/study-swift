#!/usr/bin/env node
/**
 * Vercel Build Script using Build Output API
 * https://vercel.com/docs/build-output-api/v3
 *
 * Produces:
 *   .vercel/output/static/          ← dist/client/ (static assets)
 *   .vercel/output/functions/ssr.func/ ← SSR serverless function
 *   .vercel/output/config.json      ← routing rules
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// ─── 1. Run Vite build with VERCEL=1 ─────────────────────────────────────────
console.log("▲ Running Vite build (VERCEL=1)…");
execSync("vite build", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, VERCEL: "1" },
});

// ─── 2. Prepare .vercel/output structure ─────────────────────────────────────
const outputDir = path.join(root, ".vercel", "output");
const staticDir = path.join(outputDir, "static");
const funcDir = path.join(outputDir, "functions", "ssr.func");

// Clean previous output
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(staticDir, { recursive: true });
fs.mkdirSync(funcDir, { recursive: true });

// ─── 3. Copy static client assets ────────────────────────────────────────────
console.log("▲ Copying static assets…");
copyDir(path.join(root, "dist", "client"), staticDir);

// ─── 4. Copy SSR function (ssr/ → ssr.func/) ─────────────────────────────────
console.log("▲ Copying SSR function…");
copyDir(path.join(root, "ssr"), funcDir);

// ─── 5. Write function config ─────────────────────────────────────────────────
const funcConfig = {
  runtime: "nodejs20.x",
  handler: "server.js",
  launcherType: "Nodejs",
  shouldAddHelpers: true,
};
fs.writeFileSync(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(funcConfig, null, 2)
);

// ─── 6. Write routing config ──────────────────────────────────────────────────
console.log("▲ Writing routing config…");
const config = {
  version: 3,
  routes: [
    // Static assets with long-lived cache
    {
      src: "^/assets/(.+)$",
      headers: { "cache-control": "public, max-age=31536000, immutable" },
      continue: true,
    },
    // Serve static files from the static output directory
    { handle: "filesystem" },
    // All other requests → SSR function
    { src: "/(.*)", dest: "/ssr" },
  ],
};
fs.writeFileSync(
  path.join(outputDir, "config.json"),
  JSON.stringify(config, null, 2)
);

console.log("▲ Build Output API structure ready at .vercel/output/");

// ─── Helper ───────────────────────────────────────────────────────────────────
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠ Source not found, skipping: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
