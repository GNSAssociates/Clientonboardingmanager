import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PUBLIC build marker — no login required.
 *
 * Deploys on this host have repeatedly appeared to succeed (green CI, updated
 * marker files) while the live app kept serving old code, and there was no way
 * to tell from outside. This reports which commit the RUNNING process actually
 * booted from, so "is it deployed?" is answerable in one request.
 *
 * The marker is captured ONCE at module load, not per request: reading it live
 * would describe the filesystem rather than the process, and would announce a
 * freshly-uploaded build as live while the old one was still serving — exactly
 * the false signal that made these problems so hard to diagnose.
 */
const MARKER_PATHS = [
  path.join(process.cwd(), "DEPLOY_INFO.txt"),
  path.join(process.cwd(), "..", "DEPLOY_INFO.txt"),
  path.join(process.cwd(), "..", "..", "DEPLOY_INFO.txt"),
];

const BUILD_INFO: string = (() => {
  for (const p of MARKER_PATHS) {
    try {
      const v = fs.readFileSync(p, "utf8").trim();
      if (v) return v;
    } catch {
      /* try the next candidate */
    }
  }
  return "unknown (no DEPLOY_INFO.txt found)";
})();

const STARTED_AT = new Date().toISOString();

export async function GET() {
  return new NextResponse(
    `RUNNING: ${BUILD_INFO}\nprocess started ${STARTED_AT}\n`,
    { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
