import { NextRequest, NextResponse } from "next/server";
import { getDb, listEmailLogByToken } from "@gns/db";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Every email sent to/about this client, newest first — "what we sent and when".
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const rows = await db.transaction((tx) => listEmailLogByToken(tx, params.id));
  return NextResponse.json({
    emails: rows.map((r) => ({
      id: r.id,
      templateKey: r.templateKey,
      toEmail: r.toEmail,
      toName: r.toName,
      subject: r.subject,
      provider: r.provider,
      success: r.success,
      error: r.error,
      sentAt: r.sentAt,
    })),
  });
}
