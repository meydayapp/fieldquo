// lib/quotes/viewAlert.js
//
// "The client opened the quote" as an ALERT — the owner, 2026-10-14: "is
// there a way for a company to be notified when the client has opened the
// quote?". Quote.viewedAt/viewCount already recorded the open
// (lib/quotes/quoteViews.js decides whether it counts); this is the part
// that tells somebody.
//
// Called by POST /api/public/quotes/[token]/viewed ONLY after that route has
// recorded the open — so a staff preview, a support session, a bot and a
// prefetch, none of which are recorded, can never alert either. The verdict
// is reused, not re-derived.
//
// ══ Once, then once a day ════════════════════════════════════════════════
//
// The first recorded open alerts. A re-open alerts again only when the last
// alert is VIEW_ALERT_GAP_HOURS old (lib/notifications/clientAlerts.js
// viewAlertDue), as "opened quote Q-12 (3rd time)" — a homeowner scrolling
// the quote on the couch, closing it and opening it again is one alert.
// claimViewAlert makes the same test inside one conditional UPDATE, so two
// tabs opening at the same instant alert once: the row is the lock.

import { notifyEvent } from "@/lib/notifications/notify";
import { viewAlertDue, quotePeople, VIEW_ALERT_GAP_HOURS } from "@/lib/notifications/clientAlerts";

/**
 * Take the right to alert for this open. True for exactly one caller per
 * window. Raw SQL so Quote.updatedAt does not move — reading a quote is not
 * an edit to it (the same reason the view counter is raw).
 */
export async function claimViewAlert(prisma, { quoteId, lastAlertAt = null, now = new Date() }) {
  if (!quoteId || !viewAlertDue({ lastAlertAt, now })) return false;
  const claimed = await prisma.$executeRaw`UPDATE "Quote" SET "viewAlertedAt" = NOW() WHERE "id" = ${quoteId} AND ("viewAlertedAt" IS NULL OR "viewAlertedAt" <= NOW() - (${VIEW_ALERT_GAP_HOURS} * INTERVAL '1 hour'))`;
  return Number(claimed) === 1;
}

/**
 * The alert itself: bell + push, and the email or text each person chose,
 * to the quote's own people and the owners/admins (catalog "quote.viewed",
 * peopleScoped). Scoped to the quote's company by construction — the
 * companyId is read off the quote row, never taken from the request.
 *
 * @param count  the running total of client opens after this one
 */
export async function alertQuoteViewed(prisma, { quoteId, count, notify = notifyEvent }) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      companyId: true,
      quoteNumber: true,
      createdById: true,
      assignedToId: true,
      client: { select: { name: true } },
    },
  });
  if (!quote?.companyId) return { created: false, reason: "no_quote" };
  return notify({
    companyId: quote.companyId,
    type: "quote.viewed",
    entityId: quote.id,
    params: {
      quoteNumber: quote.quoteNumber || "",
      clientName: quote.client?.name || "",
      count: Math.max(1, Math.trunc(Number(count) || 1)),
    },
    // The homeowner opened it — no member did.
    actorUserId: null,
    actorName: "Client (quote link)",
    peopleUserIds: quotePeople(quote.createdById, quote.assignedToId),
  });
}
