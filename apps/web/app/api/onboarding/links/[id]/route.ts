import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = params.id;

  try {
    const db = getDb();
    const link = await db.transaction((tx) =>
      getOnboardingLinkByToken(tx, token)
    );

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const now = new Date();
    if (link.expiresAt < now) {
      return NextResponse.json(
        { error: "Link has expired", status: "expired" },
        { status: 410 }
      );
    }

    return NextResponse.json(link);
  } catch (error) {
    console.error("Error fetching link:", error);
    return NextResponse.json(
      { error: "Failed to fetch link" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = params.id;
  const body = await req.json();

  try {
    const db = getDb();
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

    // TODO: Create client + case + send emails
    // This would integrate with services from @gns/core

    return NextResponse.json({
      success: true,
      message: "Engagement accepted. Previous accountant will be contacted.",
    });
  } catch (error) {
    console.error("Error accepting engagement:", error);
    return NextResponse.json(
      { error: "Failed to accept engagement" },
      { status: 500 }
    );
  }
}
