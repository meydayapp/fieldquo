// lib/phoneUsage/priceChanges.js
//
// Which "your text and call prices changed" banners a person should see.
//
// The owner's rules, each enforced here rather than in the component:
//   - only companies that actually use FieldQuo texting or calling (a metered
//     text or call in the last 90 days);
//   - only owners and admins — the people who pay; never the crew;
//   - never a demo company;
//   - once per change, dismissible per user (uiState.dismissedNotices, the
//     store the seat-sharing banner already uses, so dismissing on the phone
//     clears the laptop too);
//   - the banner says OUR new price and the date. Nothing here carries the
//     carrier's name, its price, or the multiple — the payload has only the
//     class, our cents and the date, so the screen cannot leak what it never
//     received.

import { db } from "@/lib/db";

export const BANNER_WINDOW_DAYS = 60;
export const USAGE_WINDOW_DAYS = 90;
const DAY = 24 * 60 * 60 * 1000;

export const noticeKeyFor = (changeId) => `phone-price:${changeId}`;

/** PURE: the banners to show, from rows already read. */
export function bannersFor({ role, isDemo = false, usesPhone = false, changes = [], dismissed = [] } = {}) {
  if (isDemo || !usesPhone) return [];
  if (role !== "owner" && role !== "admin") return [];
  return (Array.isArray(changes) ? changes : [])
    .filter((c) => c && c.id && Number.isFinite(Number(c.chargeCents)) && !dismissed.includes(noticeKeyFor(c.id)))
    .map((c) => ({ key: noticeKeyFor(c.id), priceClass: c.priceClass, chargeCents: Number(c.chargeCents), effectiveAt: c.effectiveAt }));
}

/** The same, against the database. Never throws. */
export async function phonePriceBanners(member, dismissed = [], { prisma = db, now = new Date() } = {}) {
  try {
    if (!member?.companyId || member.impersonation) return [];
    const [company, usage, changes] = await Promise.all([
      prisma.company.findUnique({ where: { id: member.companyId }, select: { isDemo: true } }),
      prisma.phoneUsageCharge.findFirst({
        where: { companyId: member.companyId, createdAt: { gte: new Date(now.getTime() - USAGE_WINDOW_DAYS * DAY) } },
        select: { id: true },
      }),
      prisma.phonePriceChange.findMany({
        where: { effectiveAt: { gte: new Date(now.getTime() - BANNER_WINDOW_DAYS * DAY) } },
        orderBy: { effectiveAt: "desc" },
        take: 5,
        select: { id: true, priceClass: true, chargeCents: true, effectiveAt: true },
      }),
    ]);
    return bannersFor({ role: member.role, isDemo: Boolean(company?.isDemo), usesPhone: Boolean(usage), changes, dismissed });
  } catch (err) {
    console.error("[phone-price] couldn't read price changes:", err?.message);
    return [];
  }
}
