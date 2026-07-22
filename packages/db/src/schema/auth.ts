import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { users } from "./tenancy";

export const userCredentials = pgTable("user_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id)
    .unique(),
  passwordHash: text("password_hash").notNull(),
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at", { withTimezone: true }),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(true),
  ...timestamps,
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    rememberMe: boolean("remember_me").notNull().default(false),
    ...timestamps,
  },
  (t) => ({
    byUser: index("idx_auth_sessions_user").on(t.userId),
    byExpiry: index("idx_auth_sessions_expiry").on(t.expiresAt),
  }),
);

export const twoFactorCodes = pgTable(
  "two_factor_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    code: text("code").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    used: boolean("used").notNull().default(false),
    ...timestamps,
  },
  (t) => ({
    byUser: index("idx_2fa_codes_user").on(t.userId),
  }),
);
