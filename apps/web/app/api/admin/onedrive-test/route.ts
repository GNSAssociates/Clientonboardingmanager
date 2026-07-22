import { NextRequest, NextResponse } from "next/server";
import { isOneDriveConfigured, uploadToOneDrive, getOneDriveFolderLink, probeOneDrive } from "@/lib/onedrive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// build marker: onedrive default -> info@ (admin@ blocked, 423)

/**
 * OneDrive diagnostics. GET reports whether it's configured; POST performs a
 * real test upload into a "_Diagnostics" folder and returns the stored path +
 * the folder's web URL, so archiving can be verified end-to-end.
 * Guarded by the same secret as the email test.
 */
function authed(req: NextRequest): boolean {
  const key = req.nextUrl.searchParams.get("key");
  const allowed = [process.env.CRON_SECRET, process.env.EMAIL_TEST_KEY].filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(key ?? "");
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    configured: isOneDriveConfigured(),
    user: process.env.ONEDRIVE_USER_EMAIL ?? "info@gnsassociates.co.uk",
    rootFolder: process.env.ONEDRIVE_ROOT_FOLDER ?? "Client Onboarding",
  });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOneDriveConfigured()) {
    return NextResponse.json({ ok: false, error: "OneDrive is not configured (ENTRA_* env vars missing)." }, { status: 503 });
  }

  // Optional { user } overrides which mailbox's OneDrive to test, so we can
  // check e.g. info@ vs admin@ without changing env + redeploying.
  const body = await req.json().catch(() => ({})) as { user?: string };
  const userEmail = body.user?.trim() || undefined;

  // First a lightweight drive probe — surfaces the REAL Graph error.
  const probe = await probeOneDrive(userEmail);
  if (!probe.ok) {
    return NextResponse.json({ stage: "probe", ...probe }, { status: 502 });
  }

  const company = "_Diagnostics";
  const path = await uploadToOneDrive({
    companyName: company,
    fileName: `onedrive-test-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`,
    content: `OneDrive archive test — ${new Date().toISOString()}`,
    mimeType: "text/plain",
    userEmail,
  });

  if (!path) {
    return NextResponse.json({ ok: false, stage: "upload", user: probe.user, error: "Drive is reachable but the upload failed — check Files.ReadWrite.All is granted with admin consent." }, { status: 502 });
  }

  const folderUrl = await getOneDriveFolderLink(company, userEmail);
  return NextResponse.json({ ok: true, user: probe.user, driveType: probe.driveType, path, folderUrl });
}
