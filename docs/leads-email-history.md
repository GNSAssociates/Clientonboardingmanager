# Leads: email history and draft replies

Opening a lead shows everything between GNS and that person:

- **Emails** to or from the lead's email address, found in **info@ and every staff mailbox** (any folder: Inbox, Sent Items, archive). Both directions, with attachment names; anything that looks like a quote or engagement letter is tagged **QUOTE**.
- **Emails the platform sent itself** (from the email log).
- **Calls, WhatsApp, meetings and texts**, logged with **Log a call, WhatsApp or meeting**.
- **Every change**: stage, owner, follow-up date, notes, firm, intake started, drafts saved.

A **New** lead moves to **Contacted** by itself once a GNS reply is found, or when an outgoing call or WhatsApp is logged.

**Draft reply** checks an Instant Fee Quote against today's website prices (`apps/web/lib/quote-rules.ts`), shows staff any line that has changed, and writes a reply using today's figures. **Save to Outlook drafts** puts it in the Drafts folder of whoever pressed it. It is never sent from the platform.

## How inquiries are kept apart from day-to-day mail

Nothing reads info@ to find leads. A lead is created only by a website form submission (the WordPress plugin) or by **Add lead**. Email history then searches for **that lead's exact address**, so HMRC, Companies House, suppliers and clients never appear on a lead.

An enquiry that arrives as a plain email (not via a form) is added with **Add lead**; its emails then appear automatically.

## One-off setup: Microsoft 365 permissions (admin)

The platform already uses an Entra app registration to send mail (Mail.Send). Two more **application** permissions are needed:

| Permission | Used for |
|---|---|
| `Mail.Read` | Email history on a lead |
| `Mail.ReadWrite` | Saving draft replies to Outlook Drafts |

1. Entra admin centre → **App registrations** → the platform's app (same client id as `ENTRA_CLIENT_ID`) → **API permissions** → **Add a permission** → Microsoft Graph → **Application permissions** → tick `Mail.Read` and `Mail.ReadWrite` → **Grant admin consent**.
2. **Restrict it to GNS staff mailboxes.** Without this, the two permissions cover every mailbox in the tenant. In Exchange Online PowerShell, with a mail-enabled security group containing info@ and the staff mailboxes:
   ```powershell
   New-ApplicationAccessPolicy -AppId <ENTRA_CLIENT_ID> -PolicyScopeGroupId gns-platform-mailboxes@gnsassociates.co.uk -AccessRight RestrictAccess -Description "GNS platform: staff mailboxes only"
   Test-ApplicationAccessPolicy -AppId <ENTRA_CLIENT_ID> -Identity info@gnsassociates.co.uk
   ```
   This also restricts `Mail.Send`, so include every mailbox the platform sends from.

Until this is done, the lead timeline shows calls, WhatsApp and changes, with a note that emails are not available yet, and Draft reply offers **Copy text** and **Open in mail app** instead of saving to Outlook.

## Settings (optional)

| Variable | Default | Meaning |
|---|---|---|
| `LEADS_MAIL_DOMAINS` | `gnsassociates.co.uk,gnsuk.com` | Our own domains: mail from these is "sent by GNS". Staff accounts on these domains are searched. |
| `LEADS_MAILBOXES` | (none) | Extra shared mailboxes to search, comma-separated, e.g. `quotes@gnsassociates.co.uk`. info@ (`MAIL_FROM_EMAIL`) is always searched. |

## Keeping prices in step with the website

`quote-rules.ts` mirrors the calculator on `/instant-fee-quote/` (the "Instant Quote" snippet plus Custom CSS & JS #20452). When the website's prices change, update the price points there; otherwise every quote will show as "differs from today's prices". Tests: `npx tsx apps/web/scripts/test-quote-rules.mts`.
