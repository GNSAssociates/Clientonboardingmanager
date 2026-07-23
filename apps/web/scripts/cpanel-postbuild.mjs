#!/usr/bin/env node
// After a CPANEL_BUILD=1 `next build`, copy the two things the standalone
// output doesn't include on its own (per Next.js docs): the static assets
// folder and the public folder. Run this once, right after the build,
// before pointing cPanel's Node.js App at the standalone server.js.
import { cpSync, existsSync, writeFileSync } from "node:fs";
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

// cPanel's Passenger loads the startup file with require(), but the Next
// standalone server.js is an ES module ("type":"module") — requiring it throws
// ERR_REQUIRE_ESM and Passenger 503s. This CommonJS shim bridges the gap:
// point cPanel's "Application startup file" at loader.cjs instead of server.js.
writeFileSync(
  path.join(standaloneAppDir, "loader.cjs"),
  [
    "// cPanel/Passenger entry shim: Passenger require()s this CJS file, which",
    "// dynamically imports the ESM Next standalone server (server.js).",
    "import('./server.js').catch((err) => {",
    "  console.error('Failed to start Next standalone server:', err);",
    "  process.exit(1);",
    "});",
    "",
  ].join("\n"),
);
console.log("Wrote loader.cjs (cPanel Passenger entry shim)");

// Touching tmp/restart.txt tells Passenger/LiteSpeed to restart the app on the
// next request — so an FTP deploy that updates this file restarts the app
// automatically, no cPanel clicks needed. A fresh timestamp per build makes
// the FTP sync always see it as changed.
import { mkdirSync } from "node:fs";
const tmpDir = path.join(standaloneAppDir, "tmp");
mkdirSync(tmpDir, { recursive: true });
writeFileSync(path.join(tmpDir, "restart.txt"), `deployed ${new Date().toISOString()}\n`);
console.log("Wrote tmp/restart.txt (auto-restart trigger)");

console.log("\ncPanel build ready. Startup file for cPanel's Node.js App:");
console.log(`  ${path.relative(process.cwd(), path.join(standaloneAppDir, "server.js"))}`);
