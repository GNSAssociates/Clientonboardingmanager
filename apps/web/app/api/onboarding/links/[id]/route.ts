import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { moveClientFolderToStage } from "@/lib/onedrive";
import { getSession } from "@/lib/auth/session";
import { getFirm } from "@/lib/firms";
import { tidyName } from "@/lib/format";
import { buildLetterHtml, type LetterService, type CustomFee, type ScopeRow, type ChDetails } from "@/lib/letter-html";
import { loadEngagementLetterOverrides } from "@/lib/template-overrides.server";
import { resolve648 } from "@/lib/form-648-shared";

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
    /* Changeable after the letter has gone out. Plans change between sending
       and signing — the client asks to pay by invoice, or turns out to have no
       previous accountant — and the alternative was reissuing the engagement. */
    paymentMethod?: "dd" | "manual";
    includeClearance?: boolean;
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
    updates.companyName = tidyName(body.companyName);
  }
  if (typeof body.directorName === "string") {
    updates.directorName = tidyName(body.directorName) || null;
  }
  if (typeof body.clientEmail === "string" && body.clientEmail.trim()) {
    updates.clientEmail = body.clientEmail.trim();
    updates.directorEmail = body.clientEmail.trim();
  }

  /* WHO SIGNS, AND WHERE IT GOES, CAN CHANGE BEFORE SIGNATURE — BUT NOT AFTER.
     A signed letter is the executed contract and the audit certificate hashes
     it; editing the signatory or the email on one would rewrite who entered
     into an agreement that has already been entered into. Refuse, rather than
     quietly producing a contract that disagrees with its own signature. */
  /* Both of these live in letterMeta and both change what the contract SAYS —
     the Direct Debit clause, and whether the client is asked for their previous
     accountant — so they are rebuilt into the letter like any identity edit. */
  const meta0 = (link.letterMeta ?? {}) as Record<string, unknown>;
  let nextMeta = meta0;
  if (body.paymentMethod === "dd" || body.paymentMethod === "manual") {
    nextMeta = { ...nextMeta, paymentMethod: body.paymentMethod };
  }
  if (typeof body.includeClearance === "boolean") {
    nextMeta = { ...nextMeta, includeClearance: body.includeClearance,
                 clearanceMode: body.includeClearance ? "client" : "none" };
  }
  /* FORM 64-8 IS FIXED WHEN THE LINK IS CREATED AND CANNOT BE CHANGED HERE.
     Unlike the Direct Debit clause or the clearance question, this one is not
     merely wording — it is an HMRC authorisation. A link that has been sent is
     already in front of a client, who may have read it, part-completed it, or
     be reading it right now; switching the 64-8 on or off underneath them
     would change what they are being asked to authorise mid-flow. So it is
     decided once, in the wizard, and an engagement that went out without a
     64-8 never acquires one. Rejected loudly rather than ignored, so a caller
     that thinks it is changing something is told that it is not. */
  if ("include648" in body || "taxes648" in body) {
    return NextResponse.json(
      { error: "Form 64-8 is set when the engagement is created and cannot be changed after sending. Create a new engagement instead." },
      { status: 400 },
    );
  }

  const metaChanged = nextMeta !== meta0;
  if (metaChanged) updates.letterMeta = nextMeta;

  const identityChanged =
    updates.companyName !== undefined ||
    updates.directorName !== undefined ||
    updates.clientEmail !== undefined ||
    metaChanged;
  if (identityChanged && link.status === "accepted") {
    return NextResponse.json(
      { error: "This engagement has been signed. The signatory, email, payment method and clearance setting cannot be changed on an executed contract." },
      { status: 409 },
    );
  }

  /* The letter body names the signatory, and it is stored as HTML when the link
     is created — so changing the name in the database alone left the client
     reading a contract addressed to the previous person. Rebuild the stored
     letter from the corrected details. This is NOT a reissue: same link, same
     token, nothing re-sent; only the copy the client opens is brought back into
     agreement with who is actually signing it. */
  if (identityChanged && link.status !== "accepted") {
    try {
      const nextCompanyName = (updates.companyName as string) ?? link.companyName ?? "";
      const nextDirectorName = (updates.directorName as string | null) ?? link.directorName ?? undefined;
      const firm = getFirm((updates.firmSlug as string) ?? link.firmSlug ?? "gns");
      const meta = (nextMeta ?? {}) as {
        partnerName?: string; customFees?: CustomFee[]; scopeRows?: ScopeRow[];
        clientAddress?: string; ch?: ChDetails | null; regBody?: string;
        paymentMethod?: string; includeAnnexA?: boolean; clientType?: string;
        clientName?: string; utr?: string; softwareItems?: Array<{ name: string; price: number }>;
      };
      const overrides = await loadEngagementLetterOverrides(firm.slug);
      updates.letterHtml = buildLetterHtml({
        firm,
        ...overrides,
        regBody: meta.regBody ?? firm.regBody,
        companyName: nextCompanyName,
        companyNumber: link.companyNumber ?? undefined,
        clientAddress: meta.clientAddress,
        directorName: nextDirectorName,
        partnerName: meta.partnerName,
        services: (link.services ?? []) as LetterService[],
        customFees: meta.customFees ?? [],
        scopeRows: meta.scopeRows,
        ch: meta.ch ?? null,
        dateStr: new Date(link.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
        paymentMethod: meta.paymentMethod,
        includeAnnexA: meta.includeAnnexA,
        clientType: meta.clientType,
        clientName: meta.clientName,
        utr: meta.utr,
        softwareItems: meta.softwareItems,
      });
    } catch (e) {
      // Better a correct database record with a stale letter than a failed edit.
      console.error("Could not rebuild the letter after an identity change:", e);
    }
  }

  if (Object.keys(updates).length) {
    await db.transaction((tx) =>
      updateOnboardingLink(tx, link.id, updates as Parameters<typeof updateOnboardingLink>[2])
    );
  }
  // letterHtml is large and of no use to the caller; report it as a flag only.
  const { letterHtml, ...rest } = updates;
  return NextResponse.json({ success: true, ...rest, letterRebuilt: letterHtml !== undefined });
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
      /* Whatever we already hold about the outgoing accountant, so the signing
         page can present it for confirmation instead of making the client type
         details we are already sitting on. Safe to expose to the token holder:
         it is the client's own previous accountant, and it is what we would
         otherwise be asking them for on this very page. */
      prevAccountant: {
        firmName: link.prevAccountantFirmName,
        email: link.prevAccountantEmail,
        phone: ((link.acceptanceData as Record<string, unknown> | null)?.prevPhone as string) ?? null,
        address: ((link.acceptanceData as Record<string, unknown> | null)?.prevFirmAddress as string) ?? null,
      },
      // Only the presentation flags the signing page branches on — the rest of
      // letterMeta is internal (pricing workings, partner routing, drafts).
      letterMeta: {
        sendMode: (link.letterMeta as Record<string, unknown> | null)?.sendMode ?? null,
        paymentMethod: (link.letterMeta as Record<string, unknown> | null)?.paymentMethod ?? null,
        // Whether this client is asked for their previous accountant at all.
        // Defaults to true so every letter issued before this flag existed
        // keeps asking, exactly as it does today.
        includeClearance: (link.letterMeta as Record<string, unknown> | null)?.includeClearance !== false,
        /* The 64-8, and the taxes it would authorise, so the signing page can
           show the client what they are about to authorise and let them untick
           any of it. Resolved rather than read raw, so an engagement issued
           before this existed reports no 64-8 instead of defaulting to one. */
        ...(() => {
          const r = resolve648({ letterMeta: link.letterMeta as Record<string, unknown> | null, signed: false });
          return { include648: r.included, taxes648: r.included ? r.taxes : null };
        })(),
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
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Default is ARCHIVE. Permanent deletion is opt-in; whether it is allowed
  // depends on whether anything was actually signed — checked below, once the
  // link has been loaded.
  const permanent = req.nextUrl.searchParams.get("permanent") === "1";

  const token = params.id;
  try {
    const db = getDb();
    const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, token));
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

    /* An UNSIGNED engagement — a draft, an unanswered link, an expired one — is
       not a regulated record. Nothing was agreed, nothing was signed, and there
       is no AML trail to preserve; it is a typo or a change of mind. Any staff
       member may delete those outright. Once a letter is SIGNED it becomes a
       contract and the retention rules apply, so it stays admin-only, and the
       proper action for a real client is Archive. */
    const isSigned = link.status === "accepted" || Boolean(link.signedHtml);
    if (permanent && isSigned && !session.isAdmin) {
      return NextResponse.json(
        { error: "This engagement has been signed. Only an admin can permanently delete it — archive it instead." },
        { status: 403 },
      );
    }

    if (permanent) {
      // Hard delete — everything linked to this token goes. Used to clear dummy
      // records during setup/testing. The OneDrive folder is deliberately NOT
      // touched: deleting client folders from the practice drive is far more
      // dangerous than leaving an empty one behind, and it can be removed by hand.
      await db.execute(sql`DELETE FROM professional_clearance_requests WHERE link_token = ${token}`);
      await db.execute(sql`DELETE FROM document_submissions WHERE onboarding_token = ${token}`);
      await db.execute(sql`DELETE FROM onboarding_links WHERE token = ${token}`);
      console.warn(
        `PERMANENT DELETE of onboarding link ${token} (${link.companyName ?? "unnamed"}) by ${session.userId}`,
      );
      return NextResponse.json({
        success: true,
        permanent: true,
        note: "Database records deleted. Any OneDrive folder was left in place.",
      });
    }

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
