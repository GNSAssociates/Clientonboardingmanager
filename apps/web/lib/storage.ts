/**
 * Client-folder archive facade.
 *
 * GNS's primary document store is OneDrive (Microsoft 365). Dropbox remains as
 * an optional fallback. Whichever is configured receives the file:
 *   /Client Onboarding/{Company Name}/{file}
 *
 * Never throws — archiving must never block onboarding.
 */
import { uploadToOneDrive, isOneDriveConfigured } from './onedrive';
import { uploadToClientFolder as uploadToDropbox, isDropboxConfigured } from './dropbox';

export interface ArchiveResult { provider: 'onedrive' | 'dropbox'; path: string }

export function isArchiveConfigured(): boolean {
  return isOneDriveConfigured() || isDropboxConfigured();
}

export async function archiveToClientFolder(opts: {
  companyName: string;
  fileName: string;
  content: string | Buffer | ArrayBuffer;
  mimeType?: string;
}): Promise<ArchiveResult | null> {
  if (isOneDriveConfigured()) {
    const path = await uploadToOneDrive(opts);
    if (path) return { provider: 'onedrive', path };
  }
  if (isDropboxConfigured()) {
    const buf = typeof opts.content === 'string' || Buffer.isBuffer(opts.content)
      ? opts.content
      : Buffer.from(opts.content);
    const path = await uploadToDropbox({ companyName: opts.companyName, fileName: opts.fileName, content: buf });
    if (path) return { provider: 'dropbox', path };
  }
  return null;
}
