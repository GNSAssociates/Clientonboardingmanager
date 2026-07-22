import { eq, and, gt, sql } from "drizzle-orm";
import { getDb } from "../client";
import { users } from "../schema/tenancy";
import { userCredentials, authSessions, twoFactorCodes } from "../schema/auth";
import { userRoles } from "../schema/tenancy";
import { roles } from "../schema/tenancy";

const db = () => getDb();

// ── User + credential operations ──────────────────────────────────────────────

export async function findUserByEmail(email: string) {
  const rows = await db()
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      status: users.status,
      entityId: users.entityId,
    })
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return rows[0] ?? null;
}

export async function findUserWithCredentials(email: string) {
  const rows = await db()
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      status: users.status,
      entityId: users.entityId,
      passwordHash: userCredentials.passwordHash,
      twoFactorEnabled: userCredentials.twoFactorEnabled,
    })
    .from(users)
    .leftJoin(userCredentials, eq(users.id, userCredentials.userId))
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const rows = await db()
    .select({ roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
  return rows.map((r) => r.roleName);
}

export async function getUserEntityIds(userId: string): Promise<string[]> {
  const rows = await db()
    .select({ entityId: userRoles.entityId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  return rows.map((r) => r.entityId).filter((id): id is string => id !== null);
}

export async function createUserWithCredentials(data: {
  email: string;
  displayName: string;
  passwordHash: string;
  entityId?: string;
}) {
  const [user] = await db()
    .insert(users)
    .values({
      email: data.email.toLowerCase().trim(),
      displayName: data.displayName,
      authProvider: "local",
      entityId: data.entityId,
      status: "active",
    })
    .returning();
  await db().insert(userCredentials).values({
    userId: user.id,
    passwordHash: data.passwordHash,
  });
  return user;
}

export async function updatePasswordHash(userId: string, passwordHash: string) {
  await db()
    .update(userCredentials)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(userCredentials.userId, userId));
}

// ── Password reset tokens ─────────────────────────────────────────────────────

export async function setResetToken(userId: string, token: string, expiresAt: Date) {
  const existing = await db()
    .select({ id: userCredentials.id })
    .from(userCredentials)
    .where(eq(userCredentials.userId, userId))
    .limit(1);
  if (existing.length === 0) return;
  await db()
    .update(userCredentials)
    .set({ resetToken: token, resetTokenExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(userCredentials.userId, userId));
}

export async function findUserByResetToken(token: string) {
  const rows = await db()
    .select({
      userId: userCredentials.userId,
      resetTokenExpiresAt: userCredentials.resetTokenExpiresAt,
    })
    .from(userCredentials)
    .where(eq(userCredentials.resetToken, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function clearResetToken(userId: string) {
  await db()
    .update(userCredentials)
    .set({ resetToken: null, resetTokenExpiresAt: null, updatedAt: new Date() })
    .where(eq(userCredentials.userId, userId));
}

// ── Session management ────────────────────────────────────────────────────────

export async function createAuthSession(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  rememberMe: boolean;
}) {
  const [row] = await db().insert(authSessions).values(data).returning();
  return row;
}

export async function findAuthSession(tokenHash: string) {
  const rows = await db()
    .select()
    .from(authSessions)
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteAuthSession(tokenHash: string) {
  await db().delete(authSessions).where(eq(authSessions.tokenHash, tokenHash));
}

export async function deleteUserSessions(userId: string) {
  await db().delete(authSessions).where(eq(authSessions.userId, userId));
}

// ── 2FA codes ─────────────────────────────────────────────────────────────────

export async function create2FACode(userId: string, code: string, expiresAt: Date) {
  await db().delete(twoFactorCodes).where(eq(twoFactorCodes.userId, userId));
  const [row] = await db()
    .insert(twoFactorCodes)
    .values({ userId, code, expiresAt })
    .returning();
  return row;
}

export async function verify2FACode(userId: string, code: string) {
  const rows = await db()
    .select()
    .from(twoFactorCodes)
    .where(
      and(
        eq(twoFactorCodes.userId, userId),
        eq(twoFactorCodes.code, code),
        eq(twoFactorCodes.used, false),
        gt(twoFactorCodes.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (rows.length === 0) return false;
  await db()
    .update(twoFactorCodes)
    .set({ used: true, updatedAt: new Date() })
    .where(eq(twoFactorCodes.id, rows[0].id));
  return true;
}

export async function increment2FAAttempts(userId: string) {
  await db()
    .update(twoFactorCodes)
    .set({ attempts: sql`${twoFactorCodes.attempts} + 1` })
    .where(and(eq(twoFactorCodes.userId, userId), eq(twoFactorCodes.used, false)));
}

// ── Staff management ──────────────────────────────────────────────────────────

export async function listAllStaff() {
  const staffRows = await db()
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      status: users.status,
      entityId: users.entityId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(sql`${users.deletedAt} IS NULL`)
    .orderBy(users.createdAt);

  const allRoles = await db()
    .select({
      userId: userRoles.userId,
      roleName: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id));

  const roleMap = new Map<string, string[]>();
  for (const r of allRoles) {
    const arr = roleMap.get(r.userId) ?? [];
    arr.push(r.roleName);
    roleMap.set(r.userId, arr);
  }

  return staffRows.map((s) => ({
    ...s,
    roles: roleMap.get(s.id) ?? [],
  }));
}

export async function assignRole(userId: string, roleName: string, entityId?: string) {
  const [role] = await db()
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, roleName as any))
    .limit(1);
  if (!role) throw new Error(`Role "${roleName}" not found`);
  await db()
    .insert(userRoles)
    .values({ userId, roleId: role.id, entityId })
    .onConflictDoNothing();
}

export async function removeUserRoles(userId: string) {
  await db().delete(userRoles).where(eq(userRoles.userId, userId));
}

export async function updateUserStatus(userId: string, status: "active" | "disabled") {
  await db()
    .update(users)
    .set({ status, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function deleteUser(userId: string) {
  await db()
    .update(users)
    .set({ deletedAt: new Date() })
    .where(eq(users.id, userId));
  await deleteUserSessions(userId);
}

