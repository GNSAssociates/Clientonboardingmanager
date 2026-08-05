import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { isOneDriveConfigured, getOneDriveFolderLink, ensureClientFolder } from "@/lib/onedrive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Open the client's OneDrive folder. Resolves the folder's web URL from Graph
 * and 302-redirects the staff user to it (opens in OneDrive/SharePoint).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isOneDriveConfigured()) {
    return NextResponse.json({ error: "OneDrive is not configured." }, { status: 503 });
  }

  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.id));
  if (!link) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Create the folder on demand if nothing has been archived yet, so "Open
  // folder" always works instead of erroring for a brand-new client.
  let url = await getOneDriveFolderLink(link.companyName ?? "");
  if (!url) url = await ensureClientFolder(link.companyName ?? "");
  if (!url) {
    return NextResponse.json(
      { error: "Could not open or create the client's OneDrive folder (check Graph permissions)." },
      { status: 502 },
    );
  }
  return NextResponse.redirect(url);
}
