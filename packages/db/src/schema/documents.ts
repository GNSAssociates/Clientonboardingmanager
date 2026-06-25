import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { actorStamps, softDelete, timestamps } from "./_shared";
import {
  classificationSourceEnum,
  documentCategoryEnum,
  documentStatusEnum,
} from "./enums";
import { entities } from "./tenancy";
import { clients } from "./clients";
import { checklistItems, onboardingCases } from "./cases";

/**
 * Document management (A3 §3.4, FR-COL-1..6, M3).
 * documents          — logical record for a client document (one per requirement)
 * document_versions  — append-only; each upload creates a new version
 * document_classifications — AI + manual classification results (confidence, HITL flag)
 */

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => onboardingCases.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    checklistItemId: uuid("checklist_item_id").references(() => checklistItems.id),
    label: text("label").notNull(),
    category: documentCategoryEnum("category").notNull().default("other"),
    status: documentStatusEnum("status").notNull().default("pending"),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    storagePath: text("storage_path"),
    hash: text("hash"),
    notes: text("notes"),
    verifiedBy: uuid("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
    ...actorStamps,
    ...softDelete,
  },
  (t) => ({
    byCase: index("idx_documents_case").on(t.caseId, t.status),
    byChecklist: index("idx_documents_checklist").on(t.checklistItemId),
    byClient: index("idx_documents_client").on(t.clientId),
  }),
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    versionNumber: integer("version_number").notNull().default(1),
    storagePath: text("storage_path").notNull(),
    hash: text("hash").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    uploadedBy: uuid("uploaded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byDocument: index("idx_doc_versions_doc").on(t.documentId, t.versionNumber),
  }),
);

export const documentClassifications = pgTable(
  "document_classifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    documentVersionId: uuid("document_version_id").references(() => documentVersions.id),
    source: classificationSourceEnum("source").notNull().default("agent"),
    category: documentCategoryEnum("category").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    reasoning: text("reasoning"),
    needsReview: boolean("needs_review").notNull().default(false),
    confirmedBy: uuid("confirmed_by"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byDocument: index("idx_doc_classifications_doc").on(t.documentId),
  }),
);
