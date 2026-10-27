/**
 * Hands back a stored client document — but only to a link this app signed.
 *
 * There is deliberately no session check here. These links are given to the
 * client themselves as well as to staff, and the signature plus the expiry is
 * what makes them safe: a few minutes of life, and useless the moment anyone
 * edits the path or the expiry. That is the same bargain the Supabase signed
 * URLs made, kept on our own disk.
 */
import { NextRequest, NextResponse } from "next/server";
import { readDocument, verifySignature, mimeForPath, documentExists } from "@/lib/doc-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const relative = (params.path ?? []).join("/");
  const exp = req.nextUrl.searchParams.get("exp");
  const sig = req.nextUrl.searchParams.get("sig");

  // One answer for a bad signature, an expired link and a file that is not
  // there, so this cannot be used to find out which documents exist.
  const refuse = () => NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!relative || !verifySignature(relative, exp, sig)) return refuse();

  try {
    if (!(await documentExists(relative))) return refuse();
    const body = await readDocument(relative);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": mimeForPath(relative),
        "Content-Length": String(body.length),
        "Content-Disposition": `inline; filename="${relative.split("/").pop()?.replace(/"/g, "") ?? "document"}"`,
        // Signed and short-lived: never let a proxy keep a copy.
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("document read failed:", e);
    return refuse();
  }
}
