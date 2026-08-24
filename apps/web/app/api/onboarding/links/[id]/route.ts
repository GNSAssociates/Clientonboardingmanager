import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { moveClientFolderToStage } from "@/lib/onedrive";
import { getSession } from "@/lib/auth/session";

// Staff edits: pause/resume the client document chase, move a client to another
// firm, or correct core details (name / director / email).
const VALID_FIRMS = new Set(["gns", "llp", "galaxy"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    stopClientChase?: boolean;
    firmSlug?: string;
    companyName?: string;
    directorName?: string;
    clientEmail?: string;
  };
  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.id));
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};

  if (body.stopClientChase !== undefined) {
    const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
    updates.acceptanceData = { ...acc, stopClientChase: body.stopClientChase };
  }
  if (body.firmSlug !== undefined) {
    if (!VALID_FIRMS.has(body.firmSlug)) {
      return NextResponse.json({ error: "Unknown firm" }, { status: 400 });
    }
    updates.firmSlug = body.firmSlug;
  }
  if (typeof body.companyName === "string" && body.companyName.trim()) {
    updates.companyName = body.companyName.trim();
  }
  if (typeof body.directorName === "string") {
    updates.directorName = body.directorName.trim() || null;
  }
  if (typeof body.clientEmail === "string" && body.clientEmail.trim()) {
    updates.clientEmail = body.clientEmail.trim();
    updates.directorEmail = body.clientEmail.trim();
  }

  if (Object.keys(updates).length) {
    await db.transaction((tx) =>
      updateOnboardingLink(tx, link.id, updates as Parameters<typeof updateOnboardingLink>[2])
    );
  }
  return NextResponse.json({ success: true, ...updates });
}

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

    // Record the first time the client opens the letter — feeds the signature
    // audit report's "Document viewed" event. Non-fatal.
    const meta = (link.letterMeta ?? {}) as Record<string, unknown>;
    if (link.status === "sent" && !meta.firstViewedAt) {
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim()
        || req.headers.get("x-real-ip") || null;
      try {
        await db.transaction((tx) =>
          updateOnboardingLink(tx, link.id, {
            letterMeta: { ...meta, firstViewedAt: now.toISOString(), firstViewIp: ip },
          })
        );
      } catch (e) {
        console.error("Failed to record first view (non-fatal):", e);
      }
    }

    // SECURITY: this endpoint is unauthenticated — possession of the onboarding
    // token is the only credential, and that token travels by email, sits in
    // browser history and can be forwarded. Returning the raw row would ship
    // acceptanceData with it, which holds the client's full bank account number
    // and sort code in clear, plus the stored letter HTML. Return only the
    // fields the signing page actually renders.
    return NextResponse.json({
      id: link.id,
      token: link.token,
      companyName: link.companyName,
      companyNumber: link.companyNumber,
      clientEmail: link.clientEmail,
      directorName: link.directorName,
      firmSlug: link.firmSlug,
      services: link.services,
      status: link.status,
      sentAt: link.sentAt,
      expiresAt: link.expiresAt,
      acceptedAt: link.acceptedAt,
      // Only the two presentation flags the signing page branches on — the rest
      // of letterMeta is internal (pricing workings, partner routing, drafts).
      letterMeta: {
        sendMode: (link.letterMeta as Record<string, unknown> | null)?.sendMode ?? null,
        paymentMethod: (link.letterMeta as Record<string, unknown> | null)?.paymentMethod ?? null,
      },
    });
  } catch (error) {
    console.error("Error fetching link:", error);
    return NextResponse.json(
      { error: "Failed to fetch link" },
      { status: 500 }
    );
  }
}

// Delete a client / onboarding record and everything linked to it. Staff only.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = params.id;
  try {
    const db = getDb();
    const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, token));
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // ARCHIVE, never delete. This is a regulated practice: the engagement, the
    // signed letter and the AML/KYC trail must survive. Archiving hides the client
    // from the working lists and moves their OneDrive folder into
    // "03 Completed Clients", so neither dashboard is cluttered while every
    // document stays exactly where it was.
    await db.execute(sql`UPDATE onboarding_links SET status = 'archived' WHERE token = ${token}`);

    const moved = await moveClientFolderToStage(link.companyName ?? "", "completed").catch(
      (e: unknown) => ({ moved: false, reason: e instanceof Error ? e.message : String(e) }),
    );
    if (!moved.moved && moved.reason) {
      // The client IS archived in the app either way — moving the drive folder is
      // a best-effort tidy-up, so report it rather than failing the request.
      console.warn("Archive: OneDrive folder not moved:", moved.reason);
    }

    return NextResponse.json({
      success: true,
      archived: true,
      oneDriveMoved: moved.moved,
      oneDriveReason: moved.moved ? undefined : moved.reason,
    });
  } catch (error) {
    console.error("Error archiving client:", error);
    return NextResponse.json({ error: "Failed to archive client" }, { status: 500 });
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
