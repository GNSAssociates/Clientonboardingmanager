import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { addFinding, signOffReview, AddFindingInput, SignOffReviewInput } from "@gns/core";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; reviewId: string } },
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  if (body.action === "sign_off") {
    const input = SignOffReviewInput.parse({ reviewTaskId: params.reviewId, summary: body.summary });
    try {
      const row = await signOffReview(session, input);
      return NextResponse.json(row);
    } catch (e: unknown) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  const input = AddFindingInput.parse({ ...body, reviewTaskId: params.reviewId, caseId: params.id });
  try {
    const finding = await addFinding(session, input);
    return NextResponse.json(finding, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
