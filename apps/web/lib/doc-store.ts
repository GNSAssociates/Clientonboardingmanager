/**
 * Where client documents live now that Supabase is gone.
 *
 * The files sit on this server's own disk, in a directory outside the deploy
 * tree so that releasing a new build never goes near them. Nothing is served
 * from a static path: a document is reachable only through a link this app
 * signs, carrying the path, an expiry and an HMAC of both. A link that leaks
 * stops working in minutes, and one that is edited stops working at once.
 *
 * These are passports and proofs of address. The rules that follow are the
 * reason this is a module and not four lines inside the upload route.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { join, resolve, dirname, extname } from "node:path";

/** Outside /opt/gns-onboarding on purpose — deploys replace that directory. */
export const DOC_ROOT = process.env.DOCUMENT_STORE_DIR || "/opt/gns-onboarding-data/documents";

/** How long a link to someone's passport should live. Minutes, not months. */
export const VIEW_MINUTES = Number(process.env.DOCUMENT_LINK_MINUTES || 15);

function signingSecret(): string {
  const s = process.env.AUTH_SHIM_SECRET ?? "";
  if (!s) throw new Error("AUTH_SHIM_SECRET is not set — document links cannot be signed.");
  return s;
}

/**
 * Resolve a stored path against the document root, refusing anything that
 * climbs out of it. "../../etc/passwd" arrives as a path like any other, and
 * the only safe check is on the resolved result, not on the text.
 */
export function safeJoin(relative: string): string {
  const full = resolve(join(DOC_ROOT, relative));
  const root = resolve(DOC_ROOT);
  if (full !== root && !full.startsWith(root + "/")) {
    throw new Error("Refusing a document path that points outside the store.");
  }
  return full;
}

/** Store the bytes and return the reference that goes in the database. */
export async function putDocument(relative: string, data: ArrayBuffer | Buffer): Promise<string> {
  const full = safeJoin(relative);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(data as ArrayBuffer));
  return `local:${relative}`;
}

export async function readDocument(relative: string): Promise<Buffer> {
  return readFile(safeJoin(relative));
}

export async function documentExists(relative: string): Promise<boolean> {
  try {
    return (await stat(safeJoin(relative))).isFile();
  } catch {
    return false;
  }
}

function signature(relative: string, expires: number): string {
  return createHmac("sha256", signingSecret())
    .update(`${relative}:${expires}`)
    .digest("base64url");
}

/**
 * A link good for a few minutes. Returns null for anything that is not a
 * locally stored document, so callers can pass any stored reference in.
 */
export function signLocalUrl(ref: string | null | undefined, minutes = VIEW_MINUTES): string | null {
  if (!ref || !ref.startsWith("local:")) return null;
  const relative = ref.slice("local:".length);
  const expires = Math.floor(Date.now() / 1000) + minutes * 60;
  const sig = signature(relative, expires);
  return `/api/documents/file/${relative.split("/").map(encodeURIComponent).join("/")}?exp=${expires}&sig=${sig}`;
}

/** True only for a signature that matches and has not expired. */
export function verifySignature(relative: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig) return false;
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(signature(relative, expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function mimeForPath(p: string): string {
  return MIME_BY_EXT[extname(p).toLowerCase()] ?? "application/octet-stream";
}
