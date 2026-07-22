import { NextRequest, NextResponse } from "next/server";
import { getDb, upsertEmailTemplate, deleteEmailTemplate, getEmailTemplate } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { templateDef, renderEmailTemplate } from "@/lib/email-templates-lib";
import { getFirm } from "@/lib/firms";

export const dynamic = "force-dynamic";

// Save changes to a template — either an override of a built-in template's
// subject/body, or an edit to a staff-created custom template (which also
// allows changing name/audience/description/ctaLabel).
export async function PUT(req: NextRequest, { params }: { params: { key: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const def = templateDef(params.key);
  const existing = def ? null : await db.transaction((tx) => getEmailTemplate(tx, params.key));
  if (!def && !existing?.isCustom) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as {
    subject?: string; body?: string; name?: string; audience?: string; description?: string; ctaLabel?: string;
  };

  await db.transaction((tx) =>
    upsertEmailTemplate(tx, params.key, {
      name: def ? def.name : (body.name ?? existing!.name ?? params.key),
      subject: body.subject ?? (def ? def.defaultSubject : existing!.subject ?? ""),
      body: body.body ?? (def ? def.defaultBody : existing!.body ?? ""),
      ...(def ? {} : {
        audience: body.audience ?? existing!.audience ?? "Client",
        description: body.description ?? existing!.description ?? "",
        ctaLabel: body.ctaLabel ?? existing!.ctaLabel ?? null,
        isCustom: true,
      }),
      updatedBy: session.displayName ?? session.userId ?? "staff",
    })
  );
  return NextResponse.json({ success: true });
}

// Reset a built-in template to its code default, or permanently delete a
// custom template (it has no code default to fall back to).
export async function DELETE(_req: NextRequest, { params }: { params: { key: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  await db.transaction((tx) => deleteEmailTemplate(tx, params.key));
  return NextResponse.json({ success: true });
}

// Preview a template with sample data.
export async function POST(req: NextRequest, { params }: { params: { key: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { subject?: string; body?: string; firmSlug?: string };
  const firm = getFirm(body.firmSlug || "gns");

  const db = getDb();
  const isBuiltIn = !!templateDef(params.key);
  const existing = isBuiltIn ? null : await db.transaction((tx) => getEmailTemplate(tx, params.key));
  if (!isBuiltIn && !existing) return NextResponse.json({ error: "Unknown template" }, { status: 404 });

  const customFallback = isBuiltIn ? undefined : {
    ctaLabel: existing!.ctaLabel, defaultSubject: existing!.subject ?? "", defaultBody: existing!.body ?? "",
  };

  const rendered = renderEmailTemplate(
    params.key, firm,
    {
      directorName: "Sample Director", companyName: "SAMPLE CLIENT LTD", companyNumber: "12345678",
      firmName: firm.name, firmLegalName: firm.legalName, firmEmail: firm.email, firmPhone: firm.phone,
      prevFirmName: "Previous Accountants Ltd", expiresAt: "31 August 2026",
      today: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      followUpNumber: 1,
    },
    { subject: body.subject, body: body.body },
    "https://clientonboardingmanager-web.vercel.app/onboarding/engage/sample",
    customFallback,
  );
  if (!rendered) return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  return new NextResponse(rendered.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
