// lib/invoices/family.js
//
// Every version of an invoice shares ONE ledger.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// Amending a sent invoice creates a new Invoice row (parentInvoiceId → the
// root, version + 1): a snapshot, so the document a client already received
// keeps saying what it said. But a Payment row points at ONE Invoice row — the
// version the checkout session or the office named when the money came in.
// Every recorder then read `invoice.payments` off that single row and cached
// the result on it. So an invoice paid $200 on v1 and amended to v2 showed v2
// owing the full amount (v2 had no Payment rows), v1 still holding the $200,
// and the client portal listing BOTH as payable: a client could pay twice,
// and the office list, which shows the root, kept the old total.
//
// Carrying the cached amountPaid onto v2 would only have hidden it. The next
// payment on v2 recomputes from v2's own rows and silently drops the $200
// again — a fix that reads as fixed and isn't.
//
// ══ The rule ═══════════════════════════════════════════════════════════════
//
//   The FAMILY (root + every version) owns the payments.
//   The LATEST version is the current document; its total is what is owed.
//   State = computeInvoiceState(latest.total, family payments), cached on
//   the latest. Every list and every pay path resolves to the latest.
//
// ══ Payment rows are never re-pointed ══════════════════════════════════════
//
// recordStripePayment's idempotency is (invoiceId, stripePaymentIntentId), and
// a redelivered webhook carries the ORIGINAL invoiceId. Moving the row to a
// newer version would make the replay miss that check and collide with the
// global @unique on stripePaymentIntentId — a 500 Stripe would retry for ever.
// The row stays where it was written; the family query finds it.
//
// Every function takes the Prisma client as its first argument so the
// change-order billing transaction can pass `tx` — the same shape
// lib/marketing/unsubscribe.js uses, for the same reason.

import { computeInvoiceState } from "./computeInvoiceState";

/** The id every version of this invoice hangs off. Pure. */
export function familyRootId(invoice) {
  return invoice?.parentInvoiceId || invoice?.id || null;
}

/**
 * Every Invoice row in the family: the root and all of its versions, from ANY
 * member's id. Empty when the id names nothing.
 *
 * @returns {Promise<Array<{id: string, version: number, parentInvoiceId: string|null}>>}
 */
export async function familyMembers(db, invoiceId) {
  if (!invoiceId) return [];
  const row = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, parentInvoiceId: true },
  });
  if (!row) return [];
  const rootId = row.parentInvoiceId || row.id;
  return db.invoice.findMany({
    where: { OR: [{ id: rootId }, { parentInvoiceId: rootId }] },
    select: { id: true, version: true, parentInvoiceId: true },
    orderBy: { version: "asc" },
  });
}

/**
 * Every Payment row against any version of this invoice — the ledger.
 * `select` narrows the columns; the default is what computeInvoiceState reads.
 */
export async function familyPayments(db, invoiceId, { select, orderBy } = {}) {
  const members = await familyMembers(db, invoiceId);
  if (!members.length) return [];
  return db.payment.findMany({
    where: { invoiceId: { in: members.map((m) => m.id) } },
    ...(select ? { select } : {}),
    ...(orderBy ? { orderBy } : {}),
  });
}

/**
 * The current document: the highest version in the family, loaded with the
 * caller's own `include`/`select` so each site gets exactly the row shape it
 * already worked with. Null when the id names nothing.
 */
export async function latestInFamily(db, invoiceId, { include, select } = {}) {
  const members = await familyMembers(db, invoiceId);
  if (!members.length) return null;
  const top = members.reduce((a, b) => (Number(b.version) > Number(a.version) ? b : a));
  return db.invoice.findUnique({
    where: { id: top.id },
    ...(include ? { include } : {}),
    ...(select ? { select } : {}),
  });
}

/**
 * Recompute the family ledger against the latest version and cache it there.
 *
 * Called by every path where money is about to move or has just moved, so the
 * number a client is charged and the number the office sees are both derived
 * from the Payment rows — never from a cache that could have been written
 * before this rule existed. This is what makes an invoice amended BEFORE this
 * change heal the first time anyone looks at it.
 *
 * @returns {Promise<{latest: object, state: object}|null>}
 */
export async function refreshFamilyLedger(db, invoiceId) {
  const latest = await latestInFamily(db, invoiceId);
  if (!latest) return null;
  const payments = await familyPayments(db, latest.id);
  const state = computeInvoiceState({
    total: latest.total,
    payments,
    priorStatus: latest.status,
  });
  const updated = await db.invoice.update({
    where: { id: latest.id },
    data: {
      amountPaid: state.amountPaid,
      amountDue: state.amountDue,
      amountRefunded: state.amountRefunded,
      status: state.status,
      paidDate: state.isPaid ? latest.paidDate || new Date() : latest.paidDate,
    },
  });
  return { latest: updated, state, payments };
}

/**
 * From a list that may contain several versions of the same invoice, keep only
 * the latest of each family, in the order the family first appeared. Pure —
 * the portal and the office list both hand it rows they already loaded.
 */
export function latestPerFamily(rows) {
  const best = new Map();
  for (const r of rows || []) {
    const key = r.parentInvoiceId || r.id;
    const cur = best.get(key);
    if (!cur || Number(r.version || 1) > Number(cur.version || 1)) best.set(key, r);
  }
  const seen = new Set();
  const out = [];
  for (const r of rows || []) {
    const key = r.parentInvoiceId || r.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(best.get(key));
  }
  return out;
}
