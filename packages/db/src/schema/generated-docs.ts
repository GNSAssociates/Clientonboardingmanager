import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { actorStamps, softDelete, timestamps } from "./_shared";
import { esignStatusEnum, generatedDocTypeEnum } from "./enums";
import { entities } from "./tenancy";
import { clients } from "./clients";
import { onboardingCases } from "./cases";

/**
 * Generated documents + e-sign envelopes (A3 §3.5, FR-DOC-*, M4).
 * generated_documents — letter PDFs created by the template engine
 * esign_envelopes     — one envelope per send; tracks signing lifecycle
 * esign_events        — append-only webhook event log from the e-sign provider
 */

export const generatedDocuments = pgTable(
  "generated_documents",
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
    type: generatedDocTypeEnum("type").notNull(),
    templateKey: text("template_key").notNull(),
    storagePath: text("storage_path"),
    mimeType: text("mime_type").notNull().default("application/pdf"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    templateData: jsonb("template_data").$type<Record<string, unknown>>().default({}),
    ...timestamps,
    ...actorStamps,
    ...softDelete,
  },
  (t) => ({
    byCase: index("idx_gen_docs_case").on(t.caseId, t.type),
  }),
);

export const esignEnvelopes = pgTable(
  "esign_envelopes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => onboardingCases.id),
    generatedDocId: uuid("generated_doc_id").references(() => generatedDocuments.id),
    provider: text("provider").notNull().default("dropbox_sign"),
    providerRef: text("provider_ref"),
    status: esignStatusEnum("status").notNull().default("draft"),
    signers: jsonb("signers")
      .$type<Array<{ name: string; email: string; signedAt?: string }>>()
      .default([]),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
    ...actorStamps,
  },
  (t) => ({
    byCase: index("idx_esign_case").on(t.caseId, t.status),
    byProviderRef: index("idx_esign_provider_ref").on(t.provider, t.providerRef),
  }),
);

export const esignEvents = pgTable(
  "esign_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    envelopeId: uuid("envelope_id")
      .notNull()
      .references(() => esignEnvelopes.id),
    eventType: text("event_type").notNull(),
    signerEmail: text("signer_email"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().default({}),
  },
  (t) => ({
    byEnvelope: index("idx_esign_events_envelope").on(t.envelopeId, t.occurredAt),
  }),
);
