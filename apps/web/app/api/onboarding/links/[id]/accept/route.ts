import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";

const FIRM_INFO: Record<string, { name: string; email: string }> = {
  gns: { name: "GNS Associates", email: "info@gnsassociates.co.uk" },
  llp: { name: "GNS Associates LLP", email: "info@gnsassociates-llp.co.uk" },
  galaxy: { name: "Galaxy Accountants", email: "info@galaxyaccountants.co.uk" },
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = params.id;
  const body = await req.json();

  const {
    prevFirmName,
    prevEmail,
    prevPhone,
    noPrevAccountant,
    docsAcknowledged,
    authorised,
  } = body;

  if (!authorised) {
    return NextResponse.json({ error: "Declaration not accepted" }, { status: 400 });
  }

  try {
    const db = getDb();

    const link = await db.transaction((tx) =>
      getOnboardingLinkByToken(tx, token)
    );

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (new Date(link.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Link has expired" }, { status: 410 });
    }

    if (link.status === "accepted") {
      return NextResponse.json({ error: "Already accepted" }, { status: 409 });
    }

    // Mark as accepted
    await db.transaction((tx) =>
      updateOnboardingLink(tx, link.id, {
        status: "accepted",
        acceptedAt: new Date(),
      })
    );

    const firm = FIRM_INFO[link.firmSlug || "gns"];
    const services = (link.services as Array<{ name: string; price: number }> || []);
    const totalMonthly = services.reduce((s, sv) => s + sv.price, 0);

    // --- EMAIL 1: To Previous Accountant ---
    // Sent only if they had a previous accountant
    if (!noPrevAccountant && prevEmail) {
      const prevAccountantEmailBody = `
Dear ${prevFirmName || "Previous Accountant"},

We are writing to inform you that ${link.companyName} (Company No. ${link.companyNumber}) has appointed ${firm.name} as their new accountants with effect from today.

The director has authorised us to contact you to request the professional handover of their accounting records, including:
- Latest filed accounts
- CT600 and tax computations
- Payroll records (if applicable)
- VAT returns history
- Any outstanding matters

Please confirm by return email whether you are able to provide these records and confirm there are no outstanding fees or matters we should be aware of.

If you have any questions, please contact us at ${firm.email}.

Yours faithfully,
${firm.name}
`.trim();

      console.log("📧 [EMAIL → Previous Accountant]");
      console.log(`  To: ${prevEmail} (${prevFirmName})`);
      console.log(`  Subject: Professional Clearance Request — ${link.companyName}`);
      console.log(`  Body preview: ${prevAccountantEmailBody.substring(0, 100)}...`);

      // TODO: await mailer.send({ to: prevEmail, subject: `Professional Clearance Request — ${link.companyName}`, text: prevAccountantEmailBody });
    }

    // --- EMAIL 2: To the Firm (GNS / LLP / Galaxy) ---
    const firmNotificationBody = `
New Client Onboarding Completed

Company: ${link.companyName} (${link.companyNumber})
Director: ${link.directorName} <${link.clientEmail}>
Firm: ${firm.name}

Services Agreed:
${services.map((s) => `  - ${s.name}: £${s.price}/month`).join("\n")}
Total Monthly: £${totalMonthly}

Previous Accountant:
${noPrevAccountant ? "None (new business)" : `${prevFirmName} — ${prevEmail} — ${prevPhone}`}

Documents Acknowledged: ${docsAcknowledged?.join(", ") || "None"}

Action Required:
1. Create client record in the system
2. ${!noPrevAccountant ? "Await professional clearance response from previous accountant" : "No clearance required — new business"}
3. Schedule onboarding call with ${link.directorName}
`.trim();

    console.log("📧 [EMAIL → Firm]");
    console.log(`  To: ${firm.email}`);
    console.log(`  Subject: New Client Onboarding — ${link.companyName}`);
    console.log(`  Body preview: ${firmNotificationBody.substring(0, 100)}...`);

    // TODO: await mailer.send({ to: firm.email, subject: `New Client Onboarding — ${link.companyName}`, text: firmNotificationBody });

    // --- EMAIL 3: Confirmation to Client ---
    console.log("📧 [EMAIL → Client]");
    console.log(`  To: ${link.clientEmail}`);
    console.log(`  Subject: Engagement Confirmed — Welcome to ${firm.name}`);

    // TODO: await mailer.send({ to: link.clientEmail, subject: `Engagement Confirmed — Welcome to ${firm.name}`, ... });

    return NextResponse.json({
      success: true,
      message: !noPrevAccountant
        ? "Engagement accepted. Previous accountant has been contacted and firm notified."
        : "Engagement accepted. Firm has been notified.",
    });
  } catch (error) {
    console.error("Error accepting engagement:", error);
    return NextResponse.json({ error: "Failed to accept engagement" }, { status: 500 });
  }
}
