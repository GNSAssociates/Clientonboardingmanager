# CRM sync (crm.gnsuk.com → platform)

The platform keeps a read-only copy of everything in the GNS CRM: every company record and all 13 related datasets (directors and officers, PSCs, PSC statements, filing history, charges, insolvency, disqualifications, exemptions, officer appointments, previous names, registers, UK establishments, SIC codes). It is shown under **Staff Portal → CRM**.

The CRM's API documentation is in the project folder: `api-docs/companies-house-api-developer-guide.pdf` and `api-docs/companies_house_api_public_fields.pdf`. Despite the title, it documents the CRM's own API, which serves the CRM's database. It is not the live Companies House service, so data is as fresh as the CRM's own sync.

## What it does

- **Read-only.** Only GET requests; nothing in the CRM can be changed from here.
- **Matches clients by company number** and writes the CRM id to `onboarding_links.external_ref` (migration 0031). A client already linked to a *different* CRM id is left alone.
- **Links directors and PSCs** to people already recorded on that client (`document_people.external_ref`) by name ("SMITH, Jane" = "Jane Smith"). People are **never added**: the CRM has no email addresses, and nobody is chased for ID unless a person asks.
- **Flags ID verification** due in the next 30 days (from each director's `verification_due_date`).
- **Companies the CRM stops listing** are marked "No longer in CRM", not deleted.

## How it runs

About 6 list requests plus one detail request per company (the detail call returns all datasets at once): ~520 requests for 514 companies. They go **one at a time**, 150 ms apart, in batches of 20–50 seconds, so the cPanel process limit and request timeouts are never at risk. Progress is saved, so a batch can be resumed by the next cron tick or the next press of **Sync now / Resume sync**.

## Setup

1. **cPanel → Setup Node.js App → the onboarding app → Environment variables:**
   - `CRM_API_KEY`: the full token issued by the CRM for this integration, including the part before the `|`.
   - `CRON_SECRET`: if not already set, a random 16+ character value.
   - Save, then **Restart**.
2. **Staff Portal → CRM → Sync now** for the first full pull (about 2–4 minutes; keep the page open, or it resumes overnight).
3. **Nightly sync: cPanel → Cron Jobs**, add:
   ```
   */10 0-5 * * *   curl -s "https://practiceagents.co.uk/api/crm/sync/cron?key=YOUR_CRON_SECRET" > /dev/null
   ```
   Every 10 minutes between midnight and 6am it carries on a sync in progress, and starts a new one if none finished in the last 20 hours.

## If something goes wrong

| Screen says | Meaning |
|---|---|
| "The CRM did not accept the API key (401)" | `CRM_API_KEY` is wrong or incomplete; it must include `integration_id|`. |
| "integration is inactive or revoked (403)" | Ask the CRM's developer to reactivate the integration. |
| "Could not load" on a company | That one request failed (shown on the company); the next sync retries it. |
