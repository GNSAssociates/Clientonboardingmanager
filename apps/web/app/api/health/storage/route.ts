import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Document-storage diagnostics (operator-only).
 *
 * Client ID uploads need somewhere to go: this server's own disk, and the
 * client's OneDrive folder. A missing directory or a read-only mount is
 * invisible from outside, and an upload that fails for that reason looks to
 * the director like the portal is broken.
 *
 * Reports what the RUNNING process can see (booleans and paths, never secrets)
 * and, with &probe=1, actually writes and deletes a file so a permissions
 * problem shows up as a real error rather than "configured".
 *
 * Locked with AUTH_SHIM_SECRET, passed as ?key= — same pattern as
 * /api/health/mail. Returns 404 when unset or wrong, so it is invisible to
 * probing.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.AUTH_SHIM_SECRET ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!secret || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { DOC_ROOT } = await import("@/lib/doc-store");
  const canSign = Boolean(process.env.AUTH_SHIM_SECRET);

  const graphConfigured = Boolean(
    (process.env.ENTRA_TENANT_ID?.trim() || process.env.MS_GRAPH_TENANT_ID?.trim()) &&
      (process.env.ENTRA_CLIENT_ID?.trim() || process.env.MS_GRAPH_CLIENT_ID?.trim()) &&
      (process.env.ENTRA_CLIENT_SECRET?.trim() || process.env.MS_GRAPH_CLIENT_SECRET?.trim()),
  );

  const result: Record<string, unknown> = {
    localDisk: { root: DOC_ROOT, canSignLinks: canSign },
    onedrive: { configured: graphConfigured },
    canAcceptUploads: canSign,
  };

  if (req.nextUrl.searchParams.get("probe") === "1") {
    // The disk: write a file, read it back, remove it. Nothing short of that
    // distinguishes "the directory is configured" from "uploads will work".
    try {
      const { mkdir, writeFile, readFile, unlink, statfs } = await import("node:fs/promises");
      const { join } = await import("node:path");
      await mkdir(DOC_ROOT, { recursive: true });
      const probeFile = join(DOC_ROOT, `.healthcheck-${Date.now()}`);
      await writeFile(probeFile, "ok");
      const readBack = (await readFile(probeFile, "utf8")) === "ok";
      await unlink(probeFile);
      let freeMb: number | null = null;
      try {
        const fs = await statfs(DOC_ROOT);
        freeMb = Math.round((Number(fs.bavail) * Number(fs.bsize)) / 1048576);
      } catch {
        /* older kernels have no statfs here; the write test is the part that matters */
      }
      (result.localDisk as Record<string, unknown>).probe = { ok: readBack, writable: true, freeMb };
    } catch (e) {
      (result.localDisk as Record<string, unknown>).probe = {
        ok: false,
        writable: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }

    // OneDrive: fetch a Graph token and check the drive responds.
    if (graphConfigured) {
      try {
        const { probeOneDrive } = await import("@/lib/onedrive");
        (result.onedrive as Record<string, unknown>).probe = await probeOneDrive();
      } catch (e) {
        (result.onedrive as Record<string, unknown>).probe = {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
  }

  return NextResponse.json(result);
}
