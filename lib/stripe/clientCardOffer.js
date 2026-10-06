// lib/stripe/clientCardOffer.js
//
// The light half of the portal's card form (lib/stripe/clientCardCharge.js):
// whether a client may be shown the credit-card fee at all, and the two
// narrow reads that decision needs. No Stripe client and no payment
// recorder in its import graph, on purpose — the portal's GET route and the
// settings route import this, and pulling the whole charge/settle chain into
// every portal page load (and into the harnesses that execute that route,
// scripts/check-white-label-meta.mjs among them) would cost something for
// nothing.

import { clientCardSurchargeOffer } from "@/lib/stripe/clientCardSurcharge";

/**
 * The publishable key Stripe.js needs in the browser, or null. Read at
 * request time and handed to the page as data (rather than inlined at build
 * time), so setting it in Vercel takes effect on the next request. Public by
 * design — it is the key Stripe expects in every page that loads Stripe.js.
 * Anything that is not a pk_live_/pk_test_ key is refused, so a secret key
 * pasted into the wrong variable never reaches a browser. Without it there
 * is no card form, so no fee can apply anywhere: the portal keeps its hosted
 * Checkout button and the settings card says why.
 */
export function stripePublishableKey() {
  const key = String(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").trim();
  return /^pk_(live|test)_[A-Za-z0-9]+$/.test(key) ? key : null;
}

/** The job site an invoice is for, for the Quebec rule — job first, then quote. */
export async function invoiceSiteAddress(db, invoiceId) {
  if (!invoiceId) return null;
  const row = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { job: { select: { siteAddress: true } }, quote: { select: { siteAddress: true } } },
  });
  return row?.job?.siteAddress || row?.quote?.siteAddress || null;
}

/**
 * The client fields the decision reads. Narrow on purpose: the portal's own
 * query is an allow-list that excludes the address (scripts/check-public-
 * payload.mjs), and this never leaves the server.
 */
export async function clientJurisdictionRow(db, clientId) {
  if (!clientId) return null;
  return db.client.findUnique({
    where: { id: clientId },
    select: { address: true, province: true, country: true, postalCode: true },
  });
}

/**
 * Whether the portal should show the card form (and the up-front "a 2.4%
 * fee applies to credit cards" line) for this invoice. Null when no fee can
 * apply — the portal then keeps its hosted Checkout button, unchanged.
 */
export function portalCardOffer({ company, client, siteAddress, onlinePayments }) {
  if (!onlinePayments || company?.isDemo) return null;
  if (!stripePublishableKey()) return null;
  const offer = clientCardSurchargeOffer({ company, client, siteAddress });
  return offer.applies ? { rateBps: offer.rateBps } : null;
}
