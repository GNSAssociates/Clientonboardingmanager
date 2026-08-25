import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, getDocumentSubmissions } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { getFirm } from "@/lib/firms";
import { DOCUMENT_TYPES, REQUIRED_DOC_IDS } from "@/lib/document-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Staff-only CLIENT SUMMARY export: company, director, services + fees, status.
 *
 * Three formats from one place, because the practice needs different things:
 *   ?format=csv   → opens straight in Excel (default; no dependency, never fails)
 *   ?format=docx  → Word, for pasting into letters or file notes
 *   ?format=pdf   → a fixed record to file or send
 *
 * Deliberately a SUMMARY, not the full record: no bank details (we never hold
 * any), no audit trail, no signed HTML. Use the JSON export for everything.
 */

/** A service is priced at its own frequency — £600 "annually" is £50 a month. */
function toMonthly(price: number, frequency?: string): number {
  return frequency === "annually" ? price / 12 : frequency === "quarterly" ? price / 3 : price;
}
function toAnnual(price: number, frequency?: string): number {
  return frequency === "annually" ? price : frequency === "quarterly" ? price * 4 : price * 12;
}
const money = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-").trim();

interface SummaryService {
  name: string;
  price: number;
  frequency?: string;
  oneoff?: boolean;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.id));
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
  const lm = (link.letterMeta ?? {}) as Record<string, unknown>;
  const firm = getFirm(link.firmSlug || "gns");
  const gc = (acc.gocardless ?? {}) as { mandateId?: string; ddConfirmed?: boolean; success?: boolean };

  const submissions = await db
    .transaction((tx) => getDocumentSubmissions(tx, params.id))
    .catch(() => [] as Array<{ docType: string; status: string }>);
  const receivedRequired = REQUIRED_DOC_IDS.filter((id) =>
    submissions.some((r) => r.docType === id && r.status === "uploaded"),
  ).length;

  const services = ((link.services ?? []) as SummaryService[]) ?? [];
  const recurring = services.filter((s) => !s.oneoff);
  const oneoff = services.filter((s) => s.oneoff);
  const monthlyTotal = recurring.reduce((t, s) => t + toMonthly(s.price, s.frequency), 0);
  const annualTotal = recurring.reduce((t, s) => t + toAnnual(s.price, s.frequency), 0);
  const oneoffTotal = oneoff.reduce((t, s) => t + s.price, 0);

  const statusLabel =
    link.status === "accepted" ? "Signed"
    : link.status === "archived" ? "Archived"
    : link.status === "pending_dd" ? "Awaiting Direct Debit"
    : "Sent — awaiting signature";

  const dateStr = (v: unknown) =>
    v ? new Date(v as string).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";

  // ── Shared content model, so all three formats say exactly the same thing ──
  const title = `Client Summary — ${link.companyName ?? "Client"}`;
  const facts: Array<[string, string]> = [
    ["Firm", firm.legalName],
    ["Company", link.companyName ?? "—"],
    ["Company number", link.companyNumber ?? "—"],
    ["Client type", (lm.clientType as string) ?? "—"],
    ["Address", (lm.clientAddress as string) ?? "—"],
    ["Director", link.directorName ?? "—"],
    ["Email", link.clientEmail],
    ["Status", statusLabel],
    ["Engagement sent", dateStr(link.sentAt)],
    ["Signed", dateStr(link.acceptedAt)],
    ["Signed by", (acc.signatureName as string) ?? "—"],
    ["Payment method", (lm.paymentMethod as string) === "manual" ? "Manual invoice" : "Direct Debit (GoCardless)"],
    ["Direct Debit mandate", gc.mandateId ? `Confirmed (${gc.mandateId})` : gc.ddConfirmed ? "Confirmed" : "Not set up"],
    ["Previous accountant", link.prevAccountantFirmName ?? (acc.noPrevAccountant ? "None — client confirmed" : "—")],
    ["ID documents received", `${receivedRequired} of ${REQUIRED_DOC_IDS.length} required`],
  ];

  const feeRows: Array<[string, string, string]> = [
    ...recurring.map((s) => [
      s.name,
      `${money(s.price)} ${s.frequency === "annually" ? "/yr" : s.frequency === "quarterly" ? "/qtr" : "/mo"}`,
      `${money(toAnnual(s.price, s.frequency))} /yr`,
    ] as [string, string, string]),
    ...oneoff.map((s) => [`${s.name} (one-off)`, money(s.price), "—"] as [string, string, string]),
  ];

  const totals: Array<[string, string]> = [
    ["Total recurring (monthly)", `${money(monthlyTotal)} /mo`],
    ["Total recurring (annual equivalent)", `${money(annualTotal)} /yr`],
    ...(oneoffTotal > 0 ? ([["Total one-off (upfront)", money(oneoffTotal)]] as Array<[string, string]>) : []),
  ];

  const docs = DOCUMENT_TYPES.map((dt) => {
    const row = submissions.find((r) => r.docType === dt.id);
    return [dt.label, row?.status === "uploaded" ? "Received" : dt.required ? "Outstanding" : "Optional"] as [string, string];
  });

  const format = (req.nextUrl.searchParams.get("format") ?? "csv").toLowerCase();
  const baseName = safeName(`Client Summary - ${link.companyName ?? "client"}`);

  // ── CSV (opens in Excel) ─────────────────────────────────────────────────
  if (format === "csv" || format === "xlsx" || format === "excel") {
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push(esc(title));
    lines.push("");
    lines.push(esc("CLIENT DETAILS"));
    for (const [k, v] of facts) lines.push(`${esc(k)},${esc(v)}`);
    lines.push("");
    lines.push(esc("SERVICES & FEES"));
    lines.push(`${esc("Service")},${esc("Price")},${esc("Annual equivalent")}`);
    for (const r of feeRows) lines.push(r.map(esc).join(","));
    lines.push("");
    for (const [k, v] of totals) lines.push(`${esc(k)},${esc(v)}`);
    lines.push("");
    lines.push(esc("ID DOCUMENTS"));
    for (const [k, v] of docs) lines.push(`${esc(k)},${esc(v)}`);
    // BOM so Excel reads the £ signs and accents correctly.
    return new NextResponse("﻿" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  }

  // ── Word ─────────────────────────────────────────────────────────────────
  if (format === "docx" || format === "word") {
    const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, WidthType } = await import("docx");

    const row = (cells: string[], bold = false) =>
      new TableRow({
        children: cells.map(
          (c) =>
            new TableCell({
              width: { size: Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun({ text: c, bold })] })],
            }),
        ),
      });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: firm.legalName }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Client details", heading: HeadingLevel.HEADING_2 }),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: facts.map(([k, v]) => row([k, v])) }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Services & fees", heading: HeadingLevel.HEADING_2 }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                row(["Service", "Price", "Annual equivalent"], true),
                ...feeRows.map((r) => row([...r])),
                ...totals.map(([k, v]) => row([k, v, ""], true)),
              ],
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "ID documents", heading: HeadingLevel.HEADING_2 }),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: docs.map(([k, v]) => row([k, v])) }),
          ],
        },
      ],
    });

    const buf = await Packer.toBuffer(doc);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${baseName}.docx"`,
      },
    });
  }

  // ── PDF ──────────────────────────────────────────────────────────────────
  // pdf-lib, NOT @react-pdf/renderer: the latter does not run on this cPanel host.
  if (format === "pdf") {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([595, 842]); // A4
    const M = 50;
    let y = 792;
    const accent = rgb(0.31, 0.27, 0.9);

    const nl = (h: number) => {
      y -= h;
      if (y < 60) {
        page = pdf.addPage([595, 842]);
        y = 792;
      }
    };
    // pdf-lib's standard fonts are WinAnsi: a literal £ is fine, but strip
    // anything outside that range rather than letting encoding throw.
    const clean = (t: string) => t.replace(/[^\x20-\x7E£ -ÿ]/g, "-");
    const text = (t: string, x: number, size = 10, f = font, color = rgb(0.1, 0.1, 0.1)) =>
      page.drawText(clean(t), { x, y, size, font: f, color });

    text(title, M, 16, bold, accent); nl(20);
    text(firm.legalName, M, 10); nl(8);
    text(`Produced ${new Date().toLocaleDateString("en-GB")}`, M, 8, font, rgb(0.5, 0.5, 0.5)); nl(24);

    const section = (heading: string) => {
      text(heading.toUpperCase(), M, 11, bold, accent);
      nl(16);
    };
    const pair = (k: string, v: string) => {
      text(k, M, 9, font, rgb(0.4, 0.4, 0.4));
      text(v, M + 190, 9, bold);
      nl(15);
    };

    section("Client details");
    for (const [k, v] of facts) pair(k, v);
    nl(10);

    section("Services & fees");
    text("Service", M, 9, bold); text("Price", M + 260, 9, bold); text("Annual", M + 380, 9, bold);
    nl(15);
    for (const [n, p1, p2] of feeRows) {
      text(n.length > 45 ? n.slice(0, 44) + "…" : n, M, 9);
      text(p1, M + 260, 9);
      text(p2, M + 380, 9);
      nl(14);
    }
    nl(4);
    for (const [k, v] of totals) {
      text(k, M, 9, bold);
      text(v, M + 380, 9, bold);
      nl(14);
    }
    nl(10);

    section("ID documents");
    for (const [k, v] of docs) pair(k, v);

    const bytes = await pdf.save();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format. Use csv, docx or pdf." }, { status: 400 });
}
