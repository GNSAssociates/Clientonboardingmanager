import nodemailer from "nodemailer";

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

export async function sendMail(opts: MailOptions): Promise<void> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@gnsassociates.co.uk";
  const transporter = getTransporter();

  if (!transporter) {
    // Dev fallback — log to console until SMTP is configured
    console.log("─────────────────────────────────────────────");
    console.log(`📧 [EMAIL] To: ${opts.to}`);
    console.log(`   Subject: ${opts.subject}`);
    console.log(`   (SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env.local)`);
    console.log("─────────────────────────────────────────────");
    return;
  }

  await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo ?? from,
  });
}
