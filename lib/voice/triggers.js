// lib/voice/triggers.js
//
// The moments that queue an outbound call.
//
// Kept out of the route handlers themselves so the rule ("when a quote is
// approved, and the company opted in, and the client can be called, queue a
// confirmation call") lives in one readable place — and so a route that fails
// to queue a call doesn't fail the thing it was actually doing. Every trigger
// is best-effort: approving a quote must succeed even if queuing the call
// throws.
import { db } from "@/lib/db";
import { enqueueOutbound } from "./outboundCall";

/** A quote total as a spoken-friendly string, in the company's currency. */
function money(amount, currency = "CAD") {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n)}`;
  }
}

/** A short "what the work is" line from the quote's line items, or null. */
function serviceSummary(lineItems) {
  if (!Array.isArray(lineItems) || !lineItems.length) return null;
  const names = lineItems
    .map((li) => (li && typeof li === "object" ? li.name || li.description : null))
    .filter(Boolean)
    .slice(0, 3);
  return names.length ? names.join(", ") : null;
}

/**
 * A company approved a client-requested quote — queue a call to confirm and
 * move toward scheduling.
 *
 * Silent no-op (returns null) whenever it shouldn't fire: the feature is off,
 * there's no client phone, or there's no total for the agent to reference. Not
 * an error — most approvals won't queue a call, and that's correct.
 *
 * The consent check is NOT here: enqueueOutbound stores the intent, and
 * placeQueuedCall checks consent at dial time. A quote whose client never
 * agreed to be called simply gets skipped when the cron reaches it, with a
 * readable reason — the same gate every outbound call passes.
 */
export async function onQuoteApproved(quoteId) {
  if (!quoteId) return null;

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      companyId: true,
      clientId: true,
      total: true,
      lineItems: true,
      company: {
        select: { name: true, currency: true, outboundCallsEnabled: true },
      },
      client: { select: { phone: true } },
    },
  });

  if (!quote) return null;
  if (!quote.company?.outboundCallsEnabled) return null;
  if (!quote.client?.phone) return null;

  const total = money(quote.total, quote.company.currency || "CAD");

  return enqueueOutbound({
    companyId: quote.companyId,
    purpose: "quote_approved",
    clientId: quote.clientId,
    quoteId: quote.id,
    context: {
      // A figure a HUMAN approved — the agent may state it, never change it.
      ...(total ? { quoteTotal: total } : {}),
      ...(serviceSummary(quote.lineItems) ? { serviceSummary: serviceSummary(quote.lineItems) } : {}),
    },
  });
}
