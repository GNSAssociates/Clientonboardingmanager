/**
 * AI KYC / ID verification (Claude vision).
 *
 * Reads an uploaded identity document (passport / driving licence / national ID)
 * and returns the extracted fields plus a match check against the expected
 * identity (director / PSC name and, optionally, date of birth from Companies
 * House). Pure outbound HTTPS to the Anthropic API — no local model, no extra
 * process (NPROC-safe). Never throws; returns { ok:false, error } on failure.
 */

export interface KycInput {
  base64: string;
  mediaType: string; // image/jpeg | image/png | application/pdf
  expectedName?: string;
  expectedDob?: string; // any parseable form; compared loosely
}

export interface KycExtract {
  documentType: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  documentNumber: string | null;
  issuingCountry: string | null;
  expiryDate: string | null;
  legible: boolean;
}

export interface KycResult {
  ok: boolean;
  error?: string;
  extract?: KycExtract;
  nameMatch?: boolean | null;
  dobMatch?: boolean | null;
  expired?: boolean | null;
  notes?: string[];
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Loose name match: every expected token appears in the document name (order-free). */
function namesMatch(expected: string, found: string): boolean {
  const e = norm(expected).split(" ").filter(Boolean);
  const f = new Set(norm(found).split(" ").filter(Boolean));
  if (!e.length || !f.size) return false;
  const hits = e.filter((t) => f.has(t)).length;
  return hits >= Math.max(2, e.length - 1); // allow one missing token (middle name etc.)
}

function datesMatch(a?: string | null, b?: string | null): boolean | null {
  if (!a || !b) return null;
  const pa = new Date(a), pb = new Date(b);
  if (isNaN(+pa) || isNaN(+pb)) return null;
  return pa.getUTCFullYear() === pb.getUTCFullYear() && pa.getUTCMonth() === pb.getUTCMonth() && pa.getUTCDate() === pb.getUTCDate();
}

const PROMPT = `You are a KYC document reader for a UK accountancy firm. Read the identity document in the image and return ONLY a compact JSON object (no prose, no code fences) with exactly these keys:
{"documentType": "passport|driving_licence|national_id|other|unclear", "fullName": string|null, "dateOfBirth": "YYYY-MM-DD"|null, "documentNumber": string|null, "issuingCountry": string|null, "expiryDate": "YYYY-MM-DD"|null, "legible": true|false}
Rules: use null when a field is not visible. Convert any date to YYYY-MM-DD. fullName should be the person's name in natural order (Forename Surname). Set legible=false if the document is too blurry or cropped to read reliably.`;

export function isKycConfigured(): boolean {
  return Boolean((process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY)?.trim());
}

export async function verifyIdDocument(input: KycInput): Promise<KycResult> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY)?.trim();
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY is not configured." };

  const model = process.env.KYC_MODEL?.trim() || process.env.CLAUDE_MODEL?.trim() || "claude-sonnet-5";
  const isPdf = /pdf/i.test(input.mediaType);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": process.env.ANTHROPIC_VERSION ?? "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              isPdf
                ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.base64 } }
                : { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.base64 } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("KYC vision call failed:", res.status, body);
      return { ok: false, error: `Vision API error (${res.status}).` };
    }

    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (json.content || []).map((b) => b.text ?? "").join("").trim();
    const jsonStr = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let extract: KycExtract;
    try {
      extract = JSON.parse(jsonStr) as KycExtract;
    } catch {
      console.error("KYC: could not parse model output:", text.slice(0, 300));
      return { ok: false, error: "Could not read the document (unparseable result)." };
    }

    const notes: string[] = [];
    if (!extract.legible) notes.push("Document image is low quality — re-upload a clearer copy.");

    const nameMatch = input.expectedName && extract.fullName ? namesMatch(input.expectedName, extract.fullName) : null;
    if (nameMatch === false) notes.push(`Name on document ("${extract.fullName}") does not match the expected "${input.expectedName}".`);

    const dobMatch = datesMatch(input.expectedDob, extract.dateOfBirth);
    if (dobMatch === false) notes.push("Date of birth does not match Companies House records.");

    let expired: boolean | null = null;
    if (extract.expiryDate) {
      const exp = new Date(extract.expiryDate);
      if (!isNaN(+exp)) { expired = exp.getTime() < Date.now(); if (expired) notes.push(`Document expired on ${extract.expiryDate}.`); }
    }

    return { ok: true, extract, nameMatch, dobMatch, expired, notes };
  } catch (e) {
    console.error("KYC verify error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error." };
  }
}
