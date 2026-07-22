/**
 * OneDrive archive engine (Microsoft Graph).
 *
 * GNS runs on Microsoft 365, so engagement letters and client documents are
 * archived to OneDrive:
 *   /Client Onboarding/{Company Name}/Engagement Letter - {Company} - {date}.html
 *   /Client Onboarding/{Company Name}/SIGNED - Engagement Letter - ...
 *   /Client Onboarding/{Company Name}/{uploaded ID documents}
 *
 * Configuration (Vercel env vars — see setup steps in the admin guide):
 *   ENTRA_TENANT_ID       — Microsoft Entra (Azure AD) tenant id
 *   ENTRA_CLIENT_ID       — App registration (application) id
 *   ENTRA_CLIENT_SECRET   — App registration client secret
 *   ONEDRIVE_USER_EMAIL   — whose OneDrive to store in (default info@gnsassociates.co.uk)
 *   ONEDRIVE_ROOT_FOLDER  — root folder name (default "Client Onboarding")
 *
 * The app registration needs the APPLICATION permission Files.ReadWrite.All
 * (Microsoft Graph) with admin consent. Without config this module is a no-op.
 */

const GRAPH = 'https://graph.microsoft.com/v1.0';

export function isOneDriveConfigured(): boolean {
  return Boolean(
    process.env.ENTRA_TENANT_ID?.trim() &&
    process.env.ENTRA_CLIENT_ID?.trim() &&
    process.env.ENTRA_CLIENT_SECRET?.trim()
  );
}

async function getGraphToken(): Promise<string | null> {
  const tenant = process.env.ENTRA_TENANT_ID?.trim();
  const clientId = process.env.ENTRA_CLIENT_ID?.trim();
  const secret = process.env.ENTRA_CLIENT_SECRET?.trim();
  if (!tenant || !clientId || !secret) return null;

  try {
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: secret,
        scope: 'https://graph.microsoft.com/.default',
      }),
    });
    if (!res.ok) {
      console.error('Graph token failed:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const json = await res.json() as { access_token?: string };
    return json.access_token ?? null;
  } catch (e) {
    console.error('Graph token error:', e);
    return null;
  }
}

const sanitize = (s: string) => s.replace(/[\\/:*?"<>|#%]/g, '-').trim();

/**
 * Probe a specific mailbox's OneDrive drive — returns the actual Graph error so
 * we can tell WHY archiving fails (blocked site, unprovisioned drive, missing
 * permission) rather than just "null". Diagnostics only.
 */
export async function probeOneDrive(userEmail?: string): Promise<{ ok: boolean; user: string; error?: string; driveType?: string }> {
  const user = userEmail?.trim() || process.env.ONEDRIVE_USER_EMAIL?.trim() || 'info@gnsassociates.co.uk';
  const token = await getGraphToken();
  if (!token) return { ok: false, user, error: 'Could not obtain a Graph token (check ENTRA_* env vars).' };
  try {
    const res = await fetch(`${GRAPH}/users/${encodeURIComponent(user)}/drive?$select=id,driveType`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
      return { ok: false, user, error: `${res.status}: ${body.error?.message ?? 'drive not accessible'}` };
    }
    const j = await res.json() as { driveType?: string };
    return { ok: true, user, driveType: j.driveType };
  } catch (e) {
    return { ok: false, user, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Resolve a shareable link to the client's OneDrive folder so any staff member
 * in the organization can open it. Uses Graph's createLink (scope: organization)
 * to generate an org-wide sharing link — avoids the "request access" page that
 * the raw webUrl would show to non-owners. Falls back to webUrl if createLink
 * fails (e.g. policy blocks sharing links). Returns null when OneDrive is not
 * configured or the folder doesn't exist yet. Never throws.
 */
export async function getOneDriveFolderLink(companyName: string, userEmail?: string): Promise<string | null> {
  const token = await getGraphToken();
  if (!token) return null;
  const user = userEmail?.trim() || process.env.ONEDRIVE_USER_EMAIL?.trim() || 'info@gnsassociates.co.uk';
  const root = process.env.ONEDRIVE_ROOT_FOLDER?.trim() || 'Client Onboarding';
  const folderPath = `${sanitize(root)}/${sanitize(companyName)}`;
  const encodedPath = folderPath.split('/').map(encodeURIComponent).join('/');
  const itemUrl = `${GRAPH}/users/${encodeURIComponent(user)}/drive/root:/${encodedPath}`;
  try {
    // First confirm the folder exists and get its id + webUrl
    const res = await fetch(`${itemUrl}?$select=id,webUrl`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const item = await res.json() as { id?: string; webUrl?: string };
    if (!item.id) return item.webUrl ?? null;

    // Create an organization-scoped sharing link so any staff can open it
    const linkRes = await fetch(
      `${GRAPH}/users/${encodeURIComponent(user)}/drive/items/${item.id}/createLink`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'edit', scope: 'organization' }),
      },
    );
    if (linkRes.ok) {
      const linkData = await linkRes.json() as { link?: { webUrl?: string } };
      if (linkData.link?.webUrl) return linkData.link.webUrl;
    }

    // Fallback: return the raw webUrl (may require access request)
    return item.webUrl ?? null;
  } catch (e) {
    console.error('OneDrive folder link error:', e);
    return null;
  }
}

/**
 * Upload a file into the client's OneDrive folder. Small files use a single
 * PUT; larger files (>4MB) use a Graph upload session. Returns the OneDrive
 * path on success, null when unconfigured or failed. Never throws.
 */
export async function uploadToOneDrive(opts: {
  companyName: string;
  fileName: string;
  content: string | Buffer | ArrayBuffer;
  mimeType?: string;
  userEmail?: string;
}): Promise<string | null> {
  const token = await getGraphToken();
  if (!token) return null;

  const user = opts.userEmail?.trim() || process.env.ONEDRIVE_USER_EMAIL?.trim() || 'info@gnsassociates.co.uk';
  const root = process.env.ONEDRIVE_ROOT_FOLDER?.trim() || 'Client Onboarding';
  const itemPath = `${sanitize(root)}/${sanitize(opts.companyName)}/${sanitize(opts.fileName)}`;
  const encodedPath = itemPath.split('/').map(encodeURIComponent).join('/');
  const base = `${GRAPH}/users/${encodeURIComponent(user)}/drive/root:/${encodedPath}`;

  const buf: Buffer = typeof opts.content === 'string'
    ? Buffer.from(opts.content, 'utf8')
    : Buffer.isBuffer(opts.content) ? opts.content : Buffer.from(opts.content);

  try {
    if (buf.byteLength <= 4 * 1024 * 1024) {
      // Simple upload (≤4MB) — Graph auto-creates the folder path
      const res = await fetch(`${base}:/content?@microsoft.graph.conflictBehavior=replace`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': opts.mimeType ?? 'application/octet-stream',
        },
        body: new Uint8Array(buf),
      });
      if (!res.ok) {
        console.error('OneDrive upload failed:', res.status, await res.text().catch(() => ''));
        return null;
      }
    } else {
      // Upload session for large files
      const sessRes = await fetch(`${base}:/createUploadSession`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
      });
      if (!sessRes.ok) {
        console.error('OneDrive session failed:', sessRes.status, await sessRes.text().catch(() => ''));
        return null;
      }
      const { uploadUrl } = await sessRes.json() as { uploadUrl: string };
      const chunkSize = 5 * 1024 * 1024;
      for (let start = 0; start < buf.byteLength; start += chunkSize) {
        const end = Math.min(start + chunkSize, buf.byteLength);
        const chunk = buf.subarray(start, end);
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Length': String(chunk.byteLength),
            'Content-Range': `bytes ${start}-${end - 1}/${buf.byteLength}`,
          },
          body: new Uint8Array(chunk),
        });
        if (!putRes.ok && putRes.status !== 202) {
          console.error('OneDrive chunk failed:', putRes.status, await putRes.text().catch(() => ''));
          return null;
        }
      }
    }
    console.log(`✓ OneDrive: saved /${itemPath}`);
    return `/${itemPath}`;
  } catch (e) {
    console.error('OneDrive upload error:', e);
    return null;
  }
}
