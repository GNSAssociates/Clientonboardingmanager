import { and, eq, isNull } from "drizzle-orm";
import { getDb, type Tx } from "../client";
import { entities } from "../schema/tenancy";

/**
 * Entities data access (A2 §5). Pure queries operating on a transaction handle
 * provided by withSession() so RLS context is always applied. Authorisation and
 * audit are the service layer's job (@gns/core), not the repository's.
 */
export type EntityRow = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

export function listEntities(tx: Tx): Promise<EntityRow[]> {
  return tx.select().from(entities).where(isNull(entities.deletedAt));
}

/**
 * Unscoped list of entity ids — used only by the dev-auth bootstrap to grant
 * entity scope to dev staff sessions (not session-scoped on purpose).
 */
export async function listAllEntityIds(): Promise<string[]> {
  const rows = await getDb()
    .select({ id: entities.id })
    .from(entities)
    .where(isNull(entities.deletedAt));
  return rows.map((r) => r.id);
}

export async function getEntity(tx: Tx, id: string): Promise<EntityRow | undefined> {
  const [row] = await tx
    .select()
    .from(entities)
    .where(and(eq(entities.id, id), isNull(entities.deletedAt)));
  return row;
}

export async function insertEntity(tx: Tx, data: NewEntity): Promise<EntityRow> {
  const [row] = await tx.insert(entities).values(data).returning();
  if (!row) throw new Error("Insert returned no row");
  return row;
}

export async function updateEntityRow(
  tx: Tx,
  id: string,
  data: Partial<NewEntity>,
): Promise<EntityRow | undefined> {
  const [row] = await tx
    .update(entities)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(entities.id, id))
    .returning();
  return row;
}
