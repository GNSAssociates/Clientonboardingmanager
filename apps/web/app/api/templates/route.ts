import { NextRequest, NextResponse } from "next/server";
import { getDb, listEmailTemplates, upsertEmailTemplate } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { EMAIL_TEMPLATES, TEMPLATE_VARIABLES, templateDef } from "@/lib/email-templates-lib";

export const dynamic = "force-dynamic";

// List all editable email templates — the 7 built-in ones (with their current
// override-or-default subject/body) plus any staff-created custom templates —
// and the variable reference.
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const rows = await db.transaction((tx) => listEmailTemplates(tx));
  const globalRows = rows.filter((o) => o.firmSlug === "");
  const byKey = new Map(globalRows.map((o) => [o.key, o]));

  const builtIn = EMAIL_TEMPLATES.map((t) => {
    const o = byKey.get(t.key);
    return {
      key: t.key,
      name: t.name,
      audience: t.audience,
      description: t.description,
      ctaLabel: t.ctaLabel ?? null,
      subject: o?.subject ?? t.defaultSubject,
      body: o?.body ?? t.defaultBody,
      defaultSubject: t.defaultSubject,
      defaultBody: t.defaultBody,
      isOverridden: Boolean(o),
      isCustom: false,
      updatedAt: o?.updatedAt ?? null,
    };
  });

  const custom = globalRows
    .filter((o) => o.isCustom)
    .map((o) => ({
      key: o.key,
      name: o.name ?? o.key,
      audience: o.audience ?? "Client",
      description: o.description ?? "",
      ctaLabel: o.ctaLabel ?? null,
      subject: o.subject ?? "",
      body: o.body ?? "",
      defaultSubject: o.subject ?? "",
      defaultBody: o.body ?? "",
      isOverridden: true,
      isCustom: true,
      updatedAt: o.updatedAt,
    }));

  return NextResponse.json({ templates: [...builtIn, ...custom], variables: TEMPLATE_VARIABLES });
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "template";
}

// Create a brand-new custom template (not one of the 7 built-in ones) — e.g.
// an alternate professional clearance letter for a specific scenario.
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    name?: string; audience?: string; description?: string; ctaLabel?: string;
    subject?: string; body?: string;
  };
  if (!body.name?.trim() || !body.subject?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "name, subject and body are required" }, { status: 400 });
  }

  const db = getDb();
  let key = `custom_${slugify(body.name)}`;
  // Avoid colliding with a built-in key or an existing custom template.
  const existingKeys = new Set([
    ...EMAIL_TEMPLATES.map((t) => t.key),
    ...(await db.transaction((tx) => listEmailTemplates(tx))).map((r) => r.key),
  ]);
  if (existingKeys.has(key)) key = `${key}_${Date.now().toString(36)}`;
  if (templateDef(key)) key = `${key}_${Date.now().toString(36)}`;

  const row = await db.transaction((tx) =>
    upsertEmailTemplate(tx, key, {
      name: body.name!.trim(),
      audience: body.audience || "Client",
      description: body.description || "",
      ctaLabel: body.ctaLabel || null,
      subject: body.subject!,
      body: body.body!,
      isCustom: true,
      updatedBy: session.displayName ?? session.userId ?? "staff",
    })
  );

  return NextResponse.json({ success: true, key: row.key });
}
