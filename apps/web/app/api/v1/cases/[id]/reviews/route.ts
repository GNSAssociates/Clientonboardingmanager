import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createReviewTask, getReviewSummary, CreateReviewTaskInput } from "@gns/core";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const summary = await getReviewSummary(session, params.id);
    return NextResponse.json(summary);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const input = CreateReviewTaskInput.parse({ ...body, caseId: params.id });
  try {
    const task = await createReviewTask(session, input);
    return NextResponse.json(task, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
