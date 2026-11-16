# Website enquiries → Leads

Every WPForms enquiry on the GNS websites is sent straight to **Staff Portal → Leads**, as well as the usual email to info@.

## Why this way

| Option | Verdict |
|---|---|
| **WordPress sends each submission to the platform** (this) | ✅ Instant, works on WPForms Lite and Pro, nothing to log in to, survives the platform being down (queued and retried). |
| Read the WordPress database from the platform | ❌ WPForms Lite does not store entries at all, and opening the WordPress database to another server is a security risk. |
| Read the info@ mailbox | ⚠️ Possible later as a catch-all for enquiries that do not come through a form. It needs Microsoft Graph mailbox access and breaks whenever the email template changes, so it is a backup, not the main route. |

Phone calls, direct emails and referrals are added by hand with **Add lead**.

## Setup (about 10 minutes, once per website)

1. **Make a secret.** Any long random string, 24 characters or more. For example, in PowerShell:
   ```
   -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | % {[char]$_})
   ```
2. **Platform:** add `LEADS_WEBHOOK_SECRET=<the secret>` to the app's environment on cPanel (and Vercel if used), then restart. The amber "website is not connected" banner on the Leads screen disappears.
3. **WordPress, from WP admin (easiest):** zip [`gns-leads-bridge.php`](gns-leads-bridge.php) inside a `gns-leads-bridge/` folder, then **Plugins → Add New → Upload Plugin**, activate it, and open **Settings → GNS Leads**. Pick the firm, paste the secret, press **Save and test**; it says "Connected" when the platform accepts the secret.

   **Or with file access:** copy the file to `wp-content/mu-plugins/` (it then cannot be deactivated by accident) and add to `wp-config.php`:
   ```php
   define( 'GNS_LEADS_URL',    'https://YOUR-APP-DOMAIN/api/leads/inbound?firm=gns' );
   define( 'GNS_LEADS_SECRET', '<the secret>' );
   ```
   Use `firm=llp` or `firm=galaxy` on those firms' sites.
4. **Test:** submit the contact form. The enquiry appears under Leads within a minute.

To check the connection without sending a lead:
```
curl -H "X-GNS-Leads-Secret: <the secret>" https://YOUR-APP-DOMAIN/api/leads/inbound
```
`"authorised": true` means the website and the platform agree on the secret.

## Using WPForms Webhooks (Elite) or Zapier instead

Point it at the same URL, method POST, with the header `X-GNS-Leads-Secret: <the secret>`. Flat field names such as `name`, `email`, `phone`, `company`, `message` are recognised automatically.

## Contact Form 7 and past enquiries

- **Contact Form 7** forms (Quick Contact, Switch to GNS) are forwarded too, as they are submitted.
- **Send past enquiries** (Settings → GNS Leads) sends what is already saved in WordPress by *Database for WPForms* and *Contact Form 7 Database* to Leads, with the original dates. It only sends enquiries from before live forwarding started, and is safe to press more than once.
- Newsletter and feedback forms are never sent (matched by form title). Set **Only these forms** to override.

On gnsassociates.co.uk (checked 16 Nov 2026): WPForms Lite (stores no entries itself), *Database for WPForms* holds 77 Contact Form and 17 Instant Fee Quote submissions; *Contact Form 7 Database* holds 5. All form notifications go to info@gnsassociates.co.uk, sent from info@gnsuk.com.

## What happens to an enquiry

- Fields are matched by type (email, phone, name) and then by label, so renaming "Phone" to "Mobile number" on the form does not break anything. Fields that are not recognised are still shown on the lead.
- Obvious spam (link-stuffed messages, no way to reply, honeypot filled) is filed under **Spam**, never deleted, and can be moved back with **Not spam**.
- A repeat of the same submission (a retry, a double-click) is stored once.
- When the enquirer agrees to become a client, **Start intake** opens the partner intake form already filled in from the lead.
