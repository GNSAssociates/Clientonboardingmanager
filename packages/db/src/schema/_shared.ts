import { timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Common column groups applied to (almost) every business table (A3 §1).
 * - timestamps: created/updated (UTC)
 * - soft delete: deletedAt (partial indexes exclude soft-deleted rows)
 * - actor stamps: created/updated by (FK enforced at table level where needed)
 */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const actorStamps = {
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};
