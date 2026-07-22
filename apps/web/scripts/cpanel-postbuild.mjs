#!/usr/bin/env node
// After a CPANEL_BUILD=1 `next build`, copy the two things the standalone
// output doesn't include on its own (per Next.js docs): the static assets
// folder and the public folder. Run this once, right after the build,
// before pointing cPanel's Node.js App at the standalone server.js.
import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const standaloneAppDir = path.join(appDir, ".next/standalone/apps/web");

if (!existsSync(standaloneAppDir)) {
  console.error(`Standalone output not found at ${standaloneAppDir}.`);
  console.error("Did the build run with CPANEL_BUILD=1? (pnpm run build:cpanel)");
  process.exit(1);
}

const copies = [
  [path.join(appDir, "public"), path.join(standaloneAppDir, "public")],
  [path.join(appDir, ".next/static"), path.join(standaloneAppDir, ".next/static")],
];

for (const [src, dest] of copies) {
  if (!existsSync(src)) { console.warn(`Skipping missing ${src}`); continue; }
  cpSync(src, dest, { recursive: true });
  console.log(`Copied ${path.relative(appDir, src)} -> ${path.relative(appDir, dest)}`);
}

console.log("\ncPanel build ready. Startup file for cPanel's Node.js App:");
console.log(`  ${path.relative(process.cwd(), path.join(standaloneAppDir, "server.js"))}`);
