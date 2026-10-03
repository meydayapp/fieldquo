// lib/whiteLabel/metadataLoaders.js
//
// The company behind a client-facing token, for that page's <head>
// (lib/whiteLabel/pageMetadata.js). One narrow read per page: the three
// brand columns and, where a document label is printed, its language.
//
// ── Each loader mirrors its page's own gate ───────────────────────────────
//
// A head is public in a way the body is not: Apple, Meta and Google fetch it
// to draw a preview for whoever the link was forwarded to. So a loader names
// a company only where the page itself would — a quote only once it is
// publicly readable (the /q gate), a portal invoice only once it has been
// issued (the portal API's own filter) — and never returns anything but the
// company's brand and a document number.
//
// ── A failed read is a plain head, not a broken page ─────────────────────
//
// Most of these pages render their body from a client-side fetch; the server
// page itself touches the database once at most. If generateMetadata threw on
// a Neon blip, the homeowner would get an error screen for a page whose body
// would have loaded fine. So every loader answers null on error, and the
// caller falls back to neutralClientMetadata.

import { db } from "@/lib/db";
import { CLIENT_META_COMPANY_SELECT } from "@/lib/whiteLabel/pageMetadata";
import { isPubliclyReadable } from "@/lib/quotes/shareToken";

const COMPANY = { select: { ...CLIENT_META_COMPANY_SELECT, defaultLanguage: true } };

const quiet = async (fn) => {
  try {
    return (await fn()) || null;
  } catch (err) {
    console.error("[white-label meta] read failed:", err?.message);
    return null;
  }
};

const isToken = (t) => typeof t === "string" && t.length > 0 && t.length <= 256;

/** /portal/[token] and its children: the client's company. */
export function portalCompany(token) {
  if (!isToken(token)) return null;
  return quiet(async () => {
    const client = await db.client.findUnique({
      where: { portalToken: token },
      select: { language: true, company: COMPANY },
    });
    return client?.company ? { company: client.company, client } : null;
  });
}

/**
 * /portal/[token]/invoices/[id]: the company, and the invoice's number and
 * language — only for an invoice of THIS client that has been issued, the
 * same predicate app/api/portal/[token]/route.js lists invoices by. Any
 * other id still gets the company (the portal shows it), without a number.
 */
export function portalInvoiceMeta(token, invoiceId) {
  if (!isToken(token)) return null;
  return quiet(async () => {
    const client = await db.client.findUnique({
      where: { portalToken: token },
      select: { id: true, language: true, company: COMPANY },
    });
    if (!client?.company) return null;
    const invoice =
      typeof invoiceId === "string" && invoiceId
        ? await db.invoice.findFirst({
            where: {
              id: invoiceId,
              clientId: client.id,
              OR: [{ sentAt: { not: null } }, { status: { not: "draft" } }],
            },
            select: { invoiceNumber: true, language: true },
          })
        : null;
    return { company: client.company, client, invoice };
  });
}

/** /q/[token]: only once the quote is publicly readable. */
export function readableQuoteMeta(token) {
  if (!isToken(token)) return null;
  return quiet(async () => {
    const quote = await db.quote.findFirst({
      where: { shareToken: token },
      select: {
        status: true,
        quoteNumber: true,
        language: true,
        client: { select: { language: true } },
        company: COMPANY,
      },
    });
    return quote?.company && isPubliclyReadable(quote.status) ? quote : null;
  });
}

/**
 * /design/[token]: the kitchen designer opens on the quote's share token and
 * its API (app/api/kitchen-design/[token]) answers with the company's name
 * whatever the status, so the head says no more than the page.
 */
export function quoteCompanyByShareToken(token) {
  if (!isToken(token)) return null;
  return quiet(async () => {
    const quote = await db.quote.findFirst({ where: { shareToken: token }, select: { company: COMPANY } });
    return quote?.company || null;
  });
}

/** /co/[token]: the job's company (app/api/public/change-orders/[token]). */
export function changeOrderCompany(token) {
  if (!isToken(token)) return null;
  return quiet(async () => {
    const co = await db.changeOrder.findUnique({
      where: { shareToken: token },
      select: { job: { select: { company: COMPANY } } },
    });
    return co?.job?.company || null;
  });
}

/** /survey/[token]. */
export function surveyCompany(token) {
  if (!isToken(token)) return null;
  return quiet(async () => {
    const row = await db.satisfactionResponse.findUnique({ where: { token }, select: { company: COMPANY } });
    return row?.company || null;
  });
}

/**
 * /visit/[token]. Same minimum length lib/booking/manageVisit.js's
 * loadVisitByToken refuses below, so the head never names a company for a
 * token the page would 404.
 */
export function visitCompany(token) {
  if (typeof token !== "string" || token.length < 16 || token.length > 256) return null;
  return quiet(async () => {
    const booking = await db.booking.findUnique({
      where: { manageToken: token },
      select: { eventType: { select: { company: COMPANY } } },
    });
    return booking?.eventType?.company || null;
  });
}

/** /w/[token]: the document-signature row's company. */
export function waiverCompany(token) {
  if (!isToken(token)) return null;
  return quiet(async () => {
    const row = await db.documentSignature.findUnique({ where: { token }, select: { company: COMPANY } });
    return row?.company || null;
  });
}

/** /unsubscribe/[token]: the subscriber row's company. */
export function unsubscribeCompany(token) {
  if (!isToken(token)) return null;
  return quiet(async () => {
    const row = await db.marketingSubscriber.findUnique({
      where: { unsubscribeToken: token },
      select: { company: COMPANY },
    });
    return row?.company || null;
  });
}

/** /plan/[token]: the service plan's company (app/api/plan/[token]). */
export function servicePlanCompany(token) {
  if (!isToken(token)) return null;
  return quiet(async () => {
    const plan = await db.servicePlan.findUnique({ where: { authToken: token }, select: { company: COMPANY } });
    return plan?.company || null;
  });
}
