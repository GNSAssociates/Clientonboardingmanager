/**
 * Dropbox archive engine.
 *
 * Saves engagement letters into the firm's Dropbox:
 *   /Client Onboarding/{Company Name}/Engagement Letter - {Company} - {date}.html
 *   /Client Onboarding/{Company Name}/SIGNED - Engagement Letter - {Company} - {date}.html
 *
 * Configuration (set when ready — nothing breaks while unset):
 *   DROPBOX_ACCESS_TOKEN — a Dropbox app access token (scoped: files.content.write)
 *
 * Optional: DROPBOX_REFRESH_TOKEN + DROPBOX_APP_KEY + DROPBOX_APP_SECRET for
 * auto-refreshing tokens (Dropbox short-lived token flow).
 */

async function getAccessToken(): Promise<string | undefined> {
  const direct = process.env.DROPBOX_ACCESS_TOKEN?.trim();
  const refresh = process.env.DROPBOX_REFRESH_TOKEN?.trim();
  const appKey = process.env.DROPBOX_APP_KEY?.trim();
  const appSecret = process.env.DROPBOX_APP_SECRET?.trim();

  // Prefer refresh-token flow when configured (long-lived)
  if (refresh && appKey && appSecret) {
    try {
      const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refresh,
          client_id: appKey,
          client_secret: appSecret,
        }),
      });
      if (res.ok) {
        const json = await res.json() as { access_token?: string };
        if (json.access_token) return json.access_token;
      }
    } catch (e) {
      console.error('Dropbox token refresh failed:', e);
    }
  }
  return direct;
}

const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, '-').trim();

export function isDropboxConfigured(): boolean {
  return Boolean(process.env.DROPBOX_ACCESS_TOKEN || process.env.DROPBOX_REFRESH_TOKEN);
}

/**
 * Upload a file to the client's folder. Returns the Dropbox path on success,
 * null when unconfigured or failed. Never throws.
 */
export async function uploadToClientFolder(opts: {
  companyName: string;
  fileName: string;
  content: string | Buffer;
}): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const path = `/Client Onboarding/${sanitize(opts.companyName)}/${sanitize(opts.fileName)}`;
  try {
    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', autorename: false, mute: true }),
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(typeof opts.content === 'string' ? Buffer.from(opts.content, 'utf8') : opts.content),
    });
    if (!res.ok) {
      console.error('Dropbox upload failed:', res.status, await res.text().catch(() => ''));
      return null;
    }
    console.log(`✓ Dropbox: saved ${path}`);
    return path;
  } catch (e) {
    console.error('Dropbox upload error:', e);
    return null;
  }
}
