/**
 * The partner intake form: saved once, read by everything downstream.
 *
 * Replaces the "New Client Handover — Partner → Sagar" spreadsheet. The whole
 * form is stored on the link in `letterMeta.intake`, so the engagement letter,
 * the clearance request and the handover checklist all read the same copy
 * rather than four people retyping it into four screens.
 *
 * Saving is separate from sending on purpose. A partner fills this in from a
 * meeting and often does not have the last detail; the draft is real from the
 * first save, and "send" is a decision taken afterwards.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID, randomBytes } from "node:crypto";
import { getDb, upsertDraftLink, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { getFirm } from "@/lib/firms";
import { intakeBlockers, type IntakeForm } from "@/lib/intake";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { intake?: IntakeForm; token?: string };
  const intake = body.intake;
  if (!intake || typeof intake !== "object") {
    return NextResponse.json({ error: "No form data was received." }, { status: 400 });
  }

  // A name is the one thing a draft cannot exist without — everything else can
  // be filled in later, and refusing the save would send people back to the
  // spreadsheet this is replacing.
  const clientName = String(intake.clientName ?? "").trim();
  if (!clientName) {
    return NextResponse.json({ error: "The client's name is needed before this can be saved." }, { status: 400 });
  }

  const firmSlug = intake.firmSlug && getFirm(intake.firmSlug) ? intake.firmSlug : "gns";
  const db = getDb();

  try {
    /* Updating an existing draft keeps the token, so a part-filled form picked
       up tomorrow is the same client rather than a second one. */
    if (body.token) {
      const existing = await db.transaction((tx) => getOnboardingLinkByToken(tx, body.token!));
      if (!existing) return NextResponse.json({ error: "That draft no longer exists." }, { status: 404 });

      const meta = (existing.letterMeta ?? {}) as Record<string, unknown>;
      await db.transaction((tx) =>
        updateOnboardingLink(tx, existing.id, {
          companyName: clientName,
          companyNumber: String(intake.companyNumber ?? "").trim() || null,
          directorName: String(intake.contact?.name ?? "").trim() || null,
          clientEmail: String(intake.contact?.email ?? "").trim() || existing.clientEmail,
          firmSlug,
          prevAccountantFirmName: String(intake.previousAccountant?.firmName ?? "").trim() || null,
          prevAccountantEmail: String(intake.previousAccountant?.email ?? "").trim() || null,
          letterMeta: {
            ...meta,
            intake,
            intakeSavedBy: session.userId,
            intakeSavedAt: new Date().toISOString(),
            partnerName: String(intake.partnerName ?? "").trim() || undefined,
          },
        }),
      );
      return NextResponse.json({
        ok: true, token: existing.token,
        blockers: intakeBlockers(intake),
      });
    }

    const token = randomBytes(32).toString("hex");
    const row = await db.transaction((tx) =>
      upsertDraftLink(tx, {
        id: randomUUID(),
        token,
        companyName: clientName,
        companyNumber: String(intake.companyNumber ?? "").trim() || null,
        directorName: String(intake.contact?.name ?? "").trim() || null,
        clientEmail: String(intake.contact?.email ?? "").trim() || "",
        firmSlug,
        services: [],
        prevAccountantFirmName: String(intake.previousAccountant?.firmName ?? "").trim() || null,
        prevAccountantEmail: String(intake.previousAccountant?.email ?? "").trim() || null,
        sentAt: new Date(),
        // A draft is not a live link; the wizard sets a real expiry when it sends.
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        letterMeta: {
          intake,
          intakeSavedBy: session.userId,
          intakeSavedAt: new Date().toISOString(),
          partnerName: String(intake.partnerName ?? "").trim() || undefined,
        },
      }),
    );

    return NextResponse.json({
      ok: true, token: row.token,
      blockers: intakeBlockers(intake),
    });
  } catch (e) {
    console.error("intake save failed:", e);
    return NextResponse.json({ error: "Could not save the intake form." }, { status: 500 });
  }
}

/** Read a saved intake back, so a part-filled form can be resumed. */
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "No token" }, { status: 400 });

  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, token));
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta = (link.letterMeta ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    token: link.token,
    status: link.status,
    intake: (meta.intake as IntakeForm | undefined) ?? null,
    savedAt: (meta.intakeSavedAt as string | undefined) ?? null,
  });
}
