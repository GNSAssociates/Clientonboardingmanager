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
  // Accept either naming scheme: ENTRA_* or MS_GRAPH_* (same Entra app).
  return Boolean(
    (process.env.ENTRA_TENANT_ID?.trim() || process.env.MS_GRAPH_TENANT_ID?.trim()) &&
    (process.env.ENTRA_CLIENT_ID?.trim() || process.env.MS_GRAPH_CLIENT_ID?.trim()) &&
    (process.env.ENTRA_CLIENT_SECRET?.trim() || process.env.MS_GRAPH_CLIENT_SECRET?.trim())
  );
}

export async function getGraphToken(): Promise<string | null> {
  // Accept either naming: ENTRA_* (main app) or MS_GRAPH_* (invoice app) — both
  // point at the same Entra app registration that holds the Graph permissions.
  const tenant = (process.env.ENTRA_TENANT_ID ?? process.env.MS_GRAPH_TENANT_ID)?.trim();
  const clientId = (process.env.ENTRA_CLIENT_ID ?? process.env.MS_GRAPH_CLIENT_ID)?.trim();
  const secret = (process.env.ENTRA_CLIENT_SECRET ?? process.env.MS_GRAPH_CLIENT_SECRET)?.trim();
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
/**
 * Client lifecycle stages, mirrored as folders in OneDrive so the drive tells the
 * same story as the app dashboard. A client folder MOVES between these; it is
 * never deleted, which also keeps the AML record intact.
 */
export const CLIENT_STAGES = {
  active: '01 Active Clients',
  info_received: '02 Client Info Received',
  completed: '03 Completed Clients',
} as const;
export type ClientStage = keyof typeof CLIENT_STAGES;

function graphUser(userEmail?: string): string {
  return userEmail?.trim() || process.env.ONEDRIVE_USER_EMAIL?.trim() || 'info@gnsassociates.co.uk';
}
function graphRoot(): string {
  return sanitize(process.env.ONEDRIVE_ROOT_FOLDER?.trim() || 'Client Onboarding');
}
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}
function stagePath(companyName: string, stage: ClientStage): string {
  return `${graphRoot()}/${sanitize(CLIENT_STAGES[stage])}/${sanitize(companyName)}`;
}
/** Pre-stage layout: folders used to sit directly under the root. */
function legacyPath(companyName: string): string {
  return `${graphRoot()}/${sanitize(companyName)}`;
}

async function itemAt(path: string, user: string, token: string): Promise<{ id: string; webUrl?: string } | null> {
  try {
    const res = await fetch(
      `${GRAPH}/users/${encodeURIComponent(user)}/drive/root:/${encodePath(path)}?$select=id,webUrl`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const item = await res.json() as { id?: string; webUrl?: string };
    return item.id ? { id: item.id, webUrl: item.webUrl } : null;
  } catch {
    return null;
  }
}

/**
 * Find the client folder wherever it currently lives — any stage, or the legacy
 * flat location. Clients created before stages existed still resolve, so nothing
 * has to be migrated by hand.
 */
async function findClientFolder(
  companyName: string,
  user: string,
  token: string,
): Promise<{ path: string; id: string; webUrl?: string } | null> {
  const candidates: string[] = [
    ...(Object.keys(CLIENT_STAGES) as ClientStage[]).map((s) => stagePath(companyName, s)),
    legacyPath(companyName),
  ];
  for (const path of candidates) {
    const item = await itemAt(path, user, token);
    if (item) return { path, ...item };
  }
  return null;
}

async function createFolderPath(segments: string[], user: string, token: string): Promise<void> {
  let parentPath = '';
  for (const seg of segments) {
    const childrenUrl = parentPath
      ? `${GRAPH}/users/${encodeURIComponent(user)}/drive/root:/${encodePath(parentPath)}:/children`
      : `${GRAPH}/users/${encodeURIComponent(user)}/drive/root/children`;
    try {
      // conflictBehavior "fail" -> 409 when it already exists, which is fine:
      // we only need the folder to exist, not to recreate it.
      await fetch(childrenUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: seg, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
      });
    } catch (e) {
      console.error('OneDrive create folder error:', e);
    }
    parentPath = parentPath ? `${parentPath}/${seg}` : seg;
  }
}

async function shareLinkFor(id: string, user: string, token: string, fallback?: string): Promise<string | null> {
  try {
    const linkRes = await fetch(
      `${GRAPH}/users/${encodeURIComponent(user)}/drive/items/${id}/createLink`,
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
  } catch (e) {
    console.error('OneDrive createLink error:', e);
  }
  return fallback ?? null;
}

/**
 * Organisation-scoped sharing link to the client folder, wherever it sits.
 * Returns null when OneDrive is not configured or the folder does not exist yet.
 * Never throws.
 */
export async function getOneDriveFolderLink(companyName: string, userEmail?: string): Promise<string | null> {
  const token = await getGraphToken();
  if (!token) return null;
  const user = graphUser(userEmail);
  const found = await findClientFolder(companyName, user, token);
  if (!found) return null;
  return shareLinkFor(found.id, user, token, found.webUrl);
}

/**
 * Ensure the client folder exists and return its shareable link.
 *
 * Called when the CLIENT IS CREATED, not merely when someone opens OneDrive, so
 * the drive is ready from day one. If the folder already exists in any stage (or
 * the legacy flat location) it is left exactly where it is.
 */
export async function ensureClientFolder(
  companyName: string,
  userEmail?: string,
  stage: ClientStage = 'active',
): Promise<string | null> {
  const token = await getGraphToken();
  if (!token) return null;
  const user = graphUser(userEmail);

  const found = await findClientFolder(companyName, user, token);
  if (found) return shareLinkFor(found.id, user, token, found.webUrl);

  await createFolderPath(
    [graphRoot(), sanitize(CLIENT_STAGES[stage]), sanitize(companyName)].filter(Boolean),
    user,
    token,
  );
  return getOneDriveFolderLink(companyName, userEmail);
}

/**
 * Move the client folder into another stage. Used instead of deleting: an
 * archived client keeps every document in OneDrive, the folder just moves out of
 * the active list so neither dashboard is cluttered. No-op when already in place.
 */
export async function moveClientFolderToStage(
  companyName: string,
  stage: ClientStage,
  userEmail?: string,
): Promise<{ moved: boolean; reason?: string }> {
  const token = await getGraphToken();
  if (!token) return { moved: false, reason: 'OneDrive not configured' };
  const user = graphUser(userEmail);

  const found = await findClientFolder(companyName, user, token);
  if (!found) return { moved: false, reason: 'Client folder not found' };

  const target = stagePath(companyName, stage);
  if (found.path === target) return { moved: true };

  // Make sure the destination stage folder exists before moving into it.
  await createFolderPath([graphRoot(), sanitize(CLIENT_STAGES[stage])], user, token);

  try {
    const res = await fetch(`${GRAPH}/users/${encodeURIComponent(user)}/drive/items/${found.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentReference: { path: `/drive/root:/${graphRoot()}/${sanitize(CLIENT_STAGES[stage])}` },
        name: sanitize(companyName),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { moved: false, reason: `Graph ${res.status} ${detail.slice(0, 200)}` };
    }
    return { moved: true };
  } catch (e) {
    return { moved: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** Resolve the folder path to upload into, creating it under Active if absent. */
async function clientFolderPathForUpload(companyName: string, user: string, token: string): Promise<string> {
  const found = await findClientFolder(companyName, user, token);
  if (found) return found.path;
  await createFolderPath(
    [graphRoot(), sanitize(CLIENT_STAGES.active), sanitize(companyName)].filter(Boolean),
    user,
    token,
  );
  return stagePath(companyName, 'active');
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

  const user = graphUser(opts.userEmail);
  // Upload into the client folder wherever it currently lives (any stage, or the
  // legacy flat location), so files follow the client as their stage changes.
  const folderPath = await clientFolderPathForUpload(opts.companyName, user, token);
  const itemPath = `${folderPath}/${sanitize(opts.fileName)}`;
  const encodedPath = encodePath(itemPath);
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
