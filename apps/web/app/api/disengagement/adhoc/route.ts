/**
 * A disengagement for a client who was never onboarded through this system.
 *
 * Most of the practice's several hundred clients predate it. They still leave,
 * and when they do the letter and the record are needed just the same — so
 * this creates the client record and hands straight back to the normal
 * disengagement route rather than growing a second, parallel way of doing it.
 *
 * The record is a normal client row marked `origin: "legacy"`, so a client
 * entered here appears on the client list, the compliance screen and the
 * disengagement list like any other. Nothing about them is special except that
 * we never sent them an engagement link.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID, randomBytes } from "node:crypto";
import { getDb, createOnboardingLink } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { getFirm } from "@/lib/firms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    companyName?: string;
    companyNumber?: string;
    directorName?: string;
    clientEmail?: string;
    clientAddress?: string;
    firmSlug?: string;
  };

  const companyName = (body.companyName ?? "").trim();
  if (!companyName) {
    return NextResponse.json({ error: "A client name is required." }, { status: 400 });
  }

  // The email is optional: a client being disengaged by post is a normal case,
  // and refusing to record them because we have no address for them would mean
  // the departure goes unrecorded entirely.
  const clientEmail = (body.clientEmail ?? "").trim();
  if (clientEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail)) {
    return NextResponse.json({ error: "That email address does not look right." }, { status: 400 });
  }

  const firmSlug = body.firmSlug && getFirm(body.firmSlug) ? body.firmSlug : "gns";
  const token = randomBytes(32).toString("hex");

  try {
    const db = getDb();
    const row = await db.transaction((tx) =>
      createOnboardingLink(tx, {
        id: randomUUID(),
        token,
        companyName,
        companyNumber: (body.companyNumber ?? "").trim() || null,
        directorName: (body.directorName ?? "").trim() || null,
        clientEmail: clientEmail || "",
        firmSlug,
        // "accepted" because they are a client of the firm — that is what the
        // status means here. It is not a claim that anyone signed anything,
        // which is why origin records where the row came from.
        status: "accepted",
        services: [],
        // Required by the table. There was no engagement link, so these mark
        // when the record was created rather than pretending a link was sent;
        // the expiry is in the past because there is nothing to open.
        sentAt: new Date(),
        expiresAt: new Date(),
        acceptanceData: {
          origin: "legacy",
          addedBy: session.userId,
          addedAt: new Date().toISOString(),
          ...((body.clientAddress ?? "").trim() ? { clientAddress: body.clientAddress!.trim() } : {}),
        },
      }),
    );

    return NextResponse.json({ ok: true, token: row.token, companyName });
  } catch (e) {
    console.error("could not create a legacy client record:", e);
    return NextResponse.json({ error: "Could not create the client record." }, { status: 500 });
  }
}
