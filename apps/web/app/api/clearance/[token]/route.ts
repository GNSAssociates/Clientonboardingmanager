import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";
import { getFirm } from "@/lib/firms";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const db = getDb();
    const link = await db.transaction((tx) =>
      getOnboardingLinkByToken(tx, params.token)
    );

    if (!link) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Clearance tokens are derived from the onboarding token with a prefix
    // so they are tied to a specific link. We reuse the same token for simplicity.
    const firm = getFirm(link.firmSlug || "gns");

    return NextResponse.json({
      companyName: link.companyName,
      companyNumber: link.companyNumber,
      directorName: link.directorName,
      firmName: firm.legalName,
      firmEmail: firm.email,
      firmLogo: firm.logo,
      firmAccent: firm.accentColor,
      firmRegStatement: firm.regStatement,
      requestedAt: link.acceptedAt
        ? new Date(link.acceptedAt).toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric",
          })
        : new Date().toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric",
          }),
    });
  } catch (err) {
    console.error("Clearance GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
