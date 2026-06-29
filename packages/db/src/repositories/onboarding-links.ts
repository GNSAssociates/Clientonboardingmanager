import { and, desc, eq, gt, sql } from "drizzle-orm";
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

export async function listLinksByFirmSlug(tx: Tx, firmSlug: string) {
  return tx
    .select()
    .from(onboardingLinks)
    .where(eq(onboardingLinks.firmSlug, firmSlug))
    .orderBy(desc(onboardingLinks.createdAt));
}

export async function listAllLinks(tx: Tx) {
  return tx
    .select()
    .from(onboardingLinks)
    .orderBy(desc(onboardingLinks.createdAt));
}

export async function getStatsByFirmSlug(tx: Tx, firmSlug: string) {
  const links = await listLinksByFirmSlug(tx, firmSlug);
  const sent = links.filter((l) => l.status === "sent").length;
  const accepted = links.filter((l) => l.status === "accepted").length;
  const expired = links.filter((l) => l.status === "expired").length;
  const expiringWithin7Days = links.filter((l) => {
    if (l.status !== "sent") return false;
    const diff = new Date(l.expiresAt).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const monthlyRevenue = links
    .filter((l) => l.status === "accepted" && l.services)
    .reduce((sum, l) => {
      const svcs = l.services as Array<{ price: number }> ?? [];
      return sum + svcs.reduce((s, sv) => s + sv.price, 0);
    }, 0);
  const pendingClearance = links.filter(
    (l) => l.status === "accepted" && l.prevAccountantEmail && !l.prevAccountantFollowUpSentAt
  ).length;
  return { total: links.length, sent, accepted, expired, expiringWithin7Days, monthlyRevenue, pendingClearance, links };
}

export async function getAllFirmsStats(tx: Tx) {
  const links = await listAllLinks(tx);
  const slugs = [...new Set(links.map((l) => l.firmSlug ?? "gns"))];
  return slugs.map((slug) => {
    const firmLinks = links.filter((l) => (l.firmSlug ?? "gns") === slug);
    const accepted = firmLinks.filter((l) => l.status === "accepted").length;
    const sent = firmLinks.filter((l) => l.status === "sent").length;
    const expired = firmLinks.filter((l) => l.status === "expired").length;
    const monthlyRevenue = firmLinks
      .filter((l) => l.status === "accepted" && l.services)
      .reduce((sum, l) => {
        const svcs = l.services as Array<{ price: number }> ?? [];
        return sum + svcs.reduce((s, sv) => s + sv.price, 0);
      }, 0);
    return { slug, total: firmLinks.length, sent, accepted, expired, monthlyRevenue };
  });
}

export async function incrementFollowUp(
  tx: Tx,
  id: string,
  type: "client" | "prevAccountant",
) {
  const link = await getOnboardingLinkById(tx, id);
  if (!link) return null;
  if (type === "client") {
    return updateOnboardingLink(tx, id, {
      clientFollowUpCount: (link.clientFollowUpCount ?? 0) + 1,
      clientFollowUpSentAt: new Date(),
    });
  } else {
    return updateOnboardingLink(tx, id, {
      prevAccountantFollowUpCount: (link.prevAccountantFollowUpCount ?? 0) + 1,
      prevAccountantFollowUpSentAt: new Date(),
    });
  }
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
