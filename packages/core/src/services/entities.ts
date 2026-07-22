import { entityConfigSchema } from "@gns/config";
import {
  getEntity,
  insertAudit,
  insertEntity,
  listEntities,
  updateEntityRow,
  withSession,
  type EntityRow,
  type NewEntity,
} from "@gns/db";
import type { z } from "zod";
import type { AuthSession } from "../auth";
import { NotFoundError } from "../errors";
import { authorize } from "../rbac";

/**
 * Entities service (M1, BR-ENT-*). The single entry point for entity reads and
 * writes: authorises the session, runs inside an RLS-scoped transaction, and
 * writes an audit row atomically with every mutation.
 */
export const createEntitySchema = entityConfigSchema;
export const updateEntitySchema = entityConfigSchema.partial();
// Use z.input so schema-defaulted fields (e.g. brand) are optional for callers;
// .parse() fills the defaults to produce the output shape persisted to the DB.
export type CreateEntityInput = z.input<typeof createEntitySchema>;
export type UpdateEntityInput = z.input<typeof updateEntitySchema>;

function toColumns(input: Partial<CreateEntityInput>): Partial<NewEntity> {
  return {
    ...(input.code !== undefined && { code: input.code }),
    ...(input.legalName !== undefined && { legalName: input.legalName }),
    ...(input.tradingName !== undefined && { tradingName: input.tradingName }),
    ...(input.brand !== undefined && { brand: input.brand }),
    ...(input.address !== undefined && { address: input.address }),
    ...(input.bankDetails !== undefined && { bankDetails: input.bankDetails }),
    ...(input.signatory !== undefined && { signatory: input.signatory }),
    ...(input.amlSupervisor !== undefined && { amlSupervisor: input.amlSupervisor }),
    ...(input.vatNumber !== undefined && { vatNumber: input.vatNumber }),
    ...(input.companyNumber !== undefined && { companyNumber: input.companyNumber }),
  };
}

export function listEntitiesForSession(session: AuthSession): Promise<EntityRow[]> {
  authorize(session, "configure_entities");
  return withSession(session, (tx) => listEntities(tx));
}

/**
 * Entities within the session's scope, for lead creation etc. Lighter than
 * configure_entities — any staff who can create a case may pick among their
 * entities. RLS restricts the result to the session's entity scope.
 */
export function listAccessibleEntities(session: AuthSession): Promise<EntityRow[]> {
  authorize(session, "create_case");
  return withSession(session, (tx) => listEntities(tx));
}

export async function getEntityForSession(
  session: AuthSession,
  id: string,
): Promise<EntityRow> {
  authorize(session, "configure_entities");
  const row = await withSession(session, (tx) => getEntity(tx, id));
  if (!row) throw new NotFoundError("Entity not found");
  return row;
}

export async function createEntity(
  session: AuthSession,
  input: CreateEntityInput,
): Promise<EntityRow> {
  authorize(session, "configure_entities");
  const data = createEntitySchema.parse(input);
  return withSession(session, async (tx) => {
    const row = await insertEntity(tx, toColumns(data) as NewEntity);
    await insertAudit(tx, {
      entityId: row.id,
      actorId: session.userId,
      actorType: "user",
      action: "entity.created",
      resourceType: "entities",
      resourceId: row.id,
      after: row,
    });
    return row;
  });
}

export async function updateEntity(
  session: AuthSession,
  id: string,
  input: UpdateEntityInput,
): Promise<EntityRow> {
  authorize(session, "configure_entities");
  const data = updateEntitySchema.parse(input);
  return withSession(session, async (tx) => {
    const before = await getEntity(tx, id);
    if (!before) throw new NotFoundError("Entity not found");
    const row = await updateEntityRow(tx, id, toColumns(data));
    if (!row) throw new NotFoundError("Entity not found");
    await insertAudit(tx, {
      entityId: id,
      actorId: session.userId,
      actorType: "user",
      action: "entity.updated",
      resourceType: "entities",
      resourceId: id,
      before,
      after: row,
    });
    return row;
  });
}
