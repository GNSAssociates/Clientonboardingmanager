import { z } from "zod";

/**
 * Per-entity white-label configuration (BR-ENT-1..6).
 *
 * Each practice entity (GNS / LLP / GXY) carries its own branding, bank,
 * authorised signatory, AML supervisor and template set. This schema is the
 * contract for the `entities` table config columns and the admin entity editor.
 */
export const entityBrandSchema = z.object({
  primaryColor: z.string().default("#1f3a5f"),
  accentColor: z.string().default("#2f8f6b"),
  logoUrl: z.string().url().optional(),
  fontFamily: z.string().default("Inter"),
});

export const bankDetailsSchema = z.object({
  accountName: z.string(),
  sortCode: z.string(),
  accountNumber: z.string(),
  bankName: z.string().optional(),
});

export const signatorySchema = z.object({
  name: z.string(),
  role: z.string(),
  email: z.string().email().optional(),
});

export const amlSupervisorSchema = z.object({
  body: z.string(), // e.g. "ICAEW", "ACCA"
  registrationNumber: z.string(),
});

export const entityConfigSchema = z.object({
  code: z.string().min(2).max(8), // GNS, LLP, GXY
  legalName: z.string(),
  tradingName: z.string().optional(),
  brand: entityBrandSchema.default({}),
  address: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    postcode: z.string(),
    country: z.string().default("United Kingdom"),
  }),
  bankDetails: bankDetailsSchema.optional(),
  signatory: signatorySchema,
  amlSupervisor: amlSupervisorSchema,
  vatNumber: z.string().optional(),
  companyNumber: z.string().optional(),
});

export type EntityBrand = z.infer<typeof entityBrandSchema>;
export type BankDetails = z.infer<typeof bankDetailsSchema>;
export type EntityConfig = z.infer<typeof entityConfigSchema>;

/** Entity codes seeded in v1 (confirm exact legal details in PRD §18). */
export const SEED_ENTITY_CODES = ["GNS", "LLP", "GXY"] as const;
export type EntityCode = (typeof SEED_ENTITY_CODES)[number];
