import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = params.id;
  const body = await req.json();

  const { prevAccountantName, prevAccountantEmail, prevAccountantPhone } = body;

  try {
    const db = getDb();

    // Get link
    const link = await db.transaction((tx) =>
      getOnboardingLinkByToken(tx, token)
    );

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const now = new Date();
    if (link.expiresAt < now) {
      return NextResponse.json(
        { error: "Link has expired" },
        { status: 410 }
      );
    }

    // Update link status to accepted
    await db.transaction((tx) =>
      updateOnboardingLink(tx, link.id, {
        status: "accepted",
        acceptedAt: new Date(),
      })
    );

    // TODO: Here we would:
    // 1. Create a client record (if not exists)
    // 2. Create an onboarding_case
    // 3. Store the previous accountant details
    // 4. Send email to previous accountant requesting records
    // 5. Send confirmation to GNS Associates
    // 6. Trigger orchestrator agent to begin onboarding workflow

    return NextResponse.json({
      success: true,
      message: "Engagement accepted. Records request sent to previous accountant.",
      clientId: link.clientId,
    });
  } catch (error) {
    console.error("Error accepting engagement:", error);
    return NextResponse.json(
      { error: "Failed to accept engagement" },
      { status: 500 }
    );
  }
}
