import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adapters } from "@gns/integrations";
import { sendFollowup, SendFollowupInput } from "@gns/core";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const input = SendFollowupInput.parse({ ...body, caseId: params.id });

  const mailer = adapters.mailer!;

  try {
    const result = await sendFollowup(session, input, mailer);
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
