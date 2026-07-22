import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { triggerAgent, TriggerAgentInput } from "@gns/core";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const input = TriggerAgentInput.parse(body);

  try {
    const result = await triggerAgent(session, input);
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
