import { and, eq, gt } from "drizzle-orm";
import { onboardingLinks } from "../schema/onboarding-links";
import type { Tx } from "../client";

export type OnboardingLinkRow = typeof onboardingLinks.$inferSelect;

export async function createOnboardingLink(
  tx: Tx,
  data: typeof onboardingLinks.$inferInsert,
): Promise<OnboardingLinkRow> {
  const [row] = await tx.insert(onboardingLinks).values(data).returning();
  return row!;
}

export async function getOnboardingLinkByToken(tx: Tx, token: string) {
  const [row] = await tx
    .select()
    .from(onboardingLinks)
    .where(eq(onboardingLinks.token, token));
  return row ?? null;
}

export async function getOnboardingLinkById(tx: Tx, id: string) {
  const [row] = await tx
    .select()
    .from(onboardingLinks)
    .where(eq(onboardingLinks.id, id));
  return row ?? null;
}

export async function listLinksByEntity(tx: Tx, entityId: string) {
  return tx
    .select()
    .from(onboardingLinks)
    .where(eq(onboardingLinks.entityId, entityId))
    .orderBy(onboardingLinks.createdAt);
}

export async function updateOnboardingLink(
  tx: Tx,
  id: string,
  data: Partial<typeof onboardingLinks.$inferInsert>,
) {
  const [row] = await tx
    .update(onboardingLinks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(onboardingLinks.id, id))
    .returning();
  return row ?? null;
}

export async function getOnboardingStats(tx: Tx, entityId: string) {
  const allLinks = await tx
    .select()
    .from(onboardingLinks)
    .where(eq(onboardingLinks.entityId, entityId));

  const sent = allLinks.filter((l) => l.status === "sent").length;
  const accepted = allLinks.filter((l) => l.status === "accepted").length;
  const expired = allLinks.filter((l) => l.status === "expired").length;

  return { total: allLinks.length, sent, accepted, expired, links: allLinks };
}

export async function markExpiredLinks(tx: Tx, entityId: string) {
  const now = new Date();
  const expiredLinks = await tx
    .select()
    .from(onboardingLinks)
    .where(
      and(
        eq(onboardingLinks.entityId, entityId),
        eq(onboardingLinks.status, "sent"),
        gt(onboardingLinks.expiresAt, now),
      ),
    );

  for (const link of expiredLinks) {
    await tx
      .update(onboardingLinks)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(onboardingLinks.id, link.id));
  }
}
