import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { isOneDriveConfigured, getOneDriveFolderLink } from "@/lib/onedrive";

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

  const url = await getOneDriveFolderLink(link.companyName ?? "");
  if (!url) {
    return NextResponse.json(
      { error: "No OneDrive folder yet for this client (nothing has been archived, or the folder isn't accessible)." },
      { status: 404 },
    );
  }
  return NextResponse.redirect(url);
}
