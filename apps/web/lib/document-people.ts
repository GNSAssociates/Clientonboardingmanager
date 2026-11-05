/**
 * The people a client's identity documents belong to.
 *
 * Identity documents were stored one row per company per document type, keyed
 * on (onboarding_token, doc_type). For a company with two directors that is
 * wrong in three ways at once: the second director's passport OVERWRITES the
 * first, the chaser stops as soon as any one person uploads, and the client
 * then reports as complete with one of two directors verified. The firm's
 * record said CDD was done when it was not.
 *
 * So documents belong to a person, not to a company. Each person gets their
 * own opaque link, their own required items and their own chase. "Complete"
 * means every person is complete.
 *
 * Schema changes apply themselves on first use, idempotently, the same way
 * handover-store.ts does — migrations are not run as part of deployment here,
 * and a second mechanism would be worse than following the existing one.
 */
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@gns/db";

/** Why we hold identity documents for this person. */
export type PersonRole = "director" | "psc" | "shareholder" | "other";

export interface DocumentPerson {
  /** Opaque per-person token; this is what their upload link carries. */
  ref: string;
  linkToken: string;
  name: string;
  email: string;
  role: PersonRole;
  addedAt: string;
}

let ready: Promise<void> | null = null;

export function ensureDocumentPeople(): Promise<void> {
  if (!ready) {
    const db = getDb();
    ready = (async () => {
      await db.execute(
        sql.raw(`
        CREATE TABLE IF NOT EXISTS document_people (
          ref         text PRIMARY KEY,
          link_token  text NOT NULL,
          name        text NOT NULL,
          email       text NOT NULL DEFAULT '',
          role        text NOT NULL DEFAULT 'director',
          added_at    timestamptz NOT NULL DEFAULT now()
        )
      `),
      );
      await db.execute(
        sql.raw(`CREATE INDEX IF NOT EXISTS document_people_link_idx ON document_people (link_token)`),
      );
      /* Submissions gain the person they belong to. Nullable, because every
         row that already exists predates this and is backfilled below rather
         than discarded — those documents are real and already verified. */
      await db.execute(
        sql.raw(`ALTER TABLE document_submissions ADD COLUMN IF NOT EXISTS person_ref text`),
      );
      await db.execute(
        sql.raw(
          `CREATE INDEX IF NOT EXISTS doc_sub_person_idx ON document_submissions (person_ref)`,
        ),
      );
      /* Whether anyone has actually ASKED this person for this document.
         Separate from status, which records what has arrived.

         Adding the second and third director to clients who signed long ago
         creates their rows immediately, and the chaser runs nightly over every
         accepted client — so without this, switching the feature on would have
         emailed several hundred existing clients about documents nobody had
         requested from them. New rows start 'not_requested'; a deliberate
         request moves them to 'requested', and only then are they chased.

         Rows that predate this column have no value, and the chaser reads a
         NULL as 'requested' so the clients currently being chased keep being
         chased rather than silently going quiet. */
      await db.execute(
        sql.raw(
          `ALTER TABLE document_submissions ADD COLUMN IF NOT EXISTS request_state text`,
        ),
      );
    })();
  }
  return ready;
}

/** A short, non-guessable token. Not sequential: a person must not be able to
 *  reach another person's upload page by editing the URL. */
function newRef(): string {
  return randomBytes(18).toString("base64url");
}

function normaliseEmail(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export async function listPeople(linkToken: string): Promise<DocumentPerson[]> {
  await ensureDocumentPeople();
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT ref, link_token, name, email, role, added_at
    FROM document_people
    WHERE link_token = ${linkToken}
    ORDER BY added_at
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    ref: String(r.ref),
    linkToken: String(r.link_token),
    name: String(r.name),
    email: String(r.email ?? ""),
    role: (String(r.role ?? "director") as PersonRole),
    addedAt: new Date(r.added_at as string).toISOString(),
  }));
}

export async function getPersonByRef(ref: string): Promise<DocumentPerson | null> {
  await ensureDocumentPeople();
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT ref, link_token, name, email, role, added_at
    FROM document_people WHERE ref = ${ref} LIMIT 1
  `)) as unknown as Array<Record<string, unknown>>;
  const r = rows[0];
  if (!r) return null;
  return {
    ref: String(r.ref),
    linkToken: String(r.link_token),
    name: String(r.name),
    email: String(r.email ?? ""),
    role: (String(r.role ?? "director") as PersonRole),
    addedAt: new Date(r.added_at as string).toISOString(),
  };
}

/**
 * Add a person, or return the one already recorded.
 *
 * Matched on name within the client rather than on email, because a husband
 * and wife who are both directors frequently share one mailbox. Matching on
 * email would silently merge two people into one and ask for a single set of
 * documents covering both of them.
 */
export async function addPerson(args: {
  linkToken: string;
  name: string;
  email?: string | null;
  role?: PersonRole;
}): Promise<DocumentPerson> {
  await ensureDocumentPeople();
  const db = getDb();
  const name = args.name.replace(/[\s ]+/g, " ").trim();
  if (!name) throw new Error("A person needs a name.");

  const existing = (await listPeople(args.linkToken)).find(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return existing;

  const person: DocumentPerson = {
    ref: newRef(),
    linkToken: args.linkToken,
    name,
    email: normaliseEmail(args.email),
    role: args.role ?? "director",
    addedAt: new Date().toISOString(),
  };
  await db.execute(sql`
    INSERT INTO document_people (ref, link_token, name, email, role)
    VALUES (${person.ref}, ${person.linkToken}, ${person.name}, ${person.email}, ${person.role})
  `);
  return person;
}

export async function updatePerson(ref: string, patch: { name?: string; email?: string; role?: PersonRole }): Promise<void> {
  await ensureDocumentPeople();
  const db = getDb();
  if (patch.name !== undefined) {
    const name = patch.name.replace(/[\s ]+/g, " ").trim();
    if (!name) throw new Error("A person needs a name.");
    await db.execute(sql`UPDATE document_people SET name = ${name} WHERE ref = ${ref}`);
  }
  if (patch.email !== undefined) {
    await db.execute(sql`UPDATE document_people SET email = ${normaliseEmail(patch.email)} WHERE ref = ${ref}`);
  }
  if (patch.role !== undefined) {
    await db.execute(sql`UPDATE document_people SET role = ${patch.role} WHERE ref = ${ref}`);
  }
}

/**
 * Remove a person, but never one who has already supplied something.
 *
 * Deleting them would orphan verified identity documents and leave the client
 * looking complete with a person silently dropped from the record.
 */
export async function removePerson(ref: string): Promise<{ removed: boolean; reason?: string }> {
  await ensureDocumentPeople();
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT count(*)::int AS n FROM document_submissions
    WHERE person_ref = ${ref} AND status = 'uploaded'
  `)) as unknown as Array<{ n: number }>;
  if ((rows[0]?.n ?? 0) > 0) {
    return { removed: false, reason: "This person has already uploaded documents, so they cannot be removed." };
  }
  await db.execute(sql`DELETE FROM document_submissions WHERE person_ref = ${ref}`);
  await db.execute(sql`DELETE FROM document_people WHERE ref = ${ref}`);
  return { removed: true };
}

/**
 * Attach the pre-existing document rows for a client to a person.
 *
 * Every row written before this feature has no person. They are real
 * documents, already verified in most cases, so they are assigned to the
 * client's signing director rather than deleted or left dangling — which
 * would make an onboarded client look like they had supplied nothing.
 */
export async function backfillPerson(linkToken: string, person: DocumentPerson): Promise<number> {
  await ensureDocumentPeople();
  const db = getDb();
  const res = (await db.execute(sql`
    UPDATE document_submissions
       SET person_ref = ${person.ref}
     WHERE onboarding_token = ${linkToken} AND person_ref IS NULL
  `)) as unknown as { rowCount?: number };
  return res?.rowCount ?? 0;
}
