/**
 * Send the engagement letter straight from the intake form.
 *
 * The wizard still exists for work that needs pricing argued through. This is
 * the other case, which is most of them: the partner already agreed a monthly
 * fee in the meeting, and the only thing standing between that and a letter
 * was retyping it into six screens.
 *
 * It does not invent a second way to send. The intake is translated into the
 * payload the existing create route takes, and that route does the work — so
 * the letter, the clearance request, the OneDrive folder and the email log all
 * behave exactly as they do from the wizard.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { intakeBlockers, intakeToCreatePayload, type IntakeForm } from "@/lib/intake";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) return NextResponse.json({ error: "No draft token." }, { status: 400 });

  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, token));
  if (!link) return NextResponse.json({ error: "That draft no longer exists." }, { status: 404 });

  if (link.status !== "draft") {
    return NextResponse.json(
      { error: "An engagement letter has already been sent for this client." },
      { status: 409 },
    );
  }

  const meta = (link.letterMeta ?? {}) as Record<string, unknown>;
  const intake = meta.intake as IntakeForm | undefined;
  if (!intake) {
    return NextResponse.json({ error: "No intake form is saved against this client." }, { status: 400 });
  }

  // Checked again here, not only in the browser: the form is the thing people
  // see, but this is the thing that sends.
  const blockers = intakeBlockers(intake);
  if (blockers.length) {
    return NextResponse.json(
      { error: `Still needed before sending: ${blockers.join(", ")}.` },
      { status: 400 },
    );
  }

  const payload = { ...intakeToCreatePayload(intake), draftToken: token };

  try {
    /* Straight to the existing route, cookies and all, so one code path sends
       every engagement letter this practice issues. */
    const origin = req.nextUrl.origin;
    const res = await fetch(`${origin}/api/onboarding/links/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: (body as { error?: string }).error ?? "The engagement letter could not be sent." },
        { status: res.status },
      );
    }

    return NextResponse.json({
      ok: true,
      token,
      clearanceSent: Boolean(intake.previousAccountant?.email?.trim()),
      detail: body,
    });
  } catch (e) {
    console.error("sending from intake failed:", e);
    return NextResponse.json({ error: "The engagement letter could not be sent." }, { status: 500 });
  }
}
