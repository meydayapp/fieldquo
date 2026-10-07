// lib/portal/payableInvoice.js
//
// What a portal client may pay, and how much — resolved from the database,
// never from the browser (non-negotiable #5). The same rules
// app/api/portal/[token]/pay/route.js applies inline, for the second portal
// pay route (app/api/portal/[token]/card-pay — the card form that can add a
// credit-card fee).
//
// Why a module and not a refactor of the pay route: that route is a working
// money path with five check scripts reading its source and executing it
// against scripted databases; moving its lookups would be a rewrite of a
// control that works, to gain nothing for its own callers. Instead
// scripts/check-client-card-surcharge.mjs holds THIS file to the same
// predicates the pay route has (issued-only, family latest, refreshed
// ledger, stage scoped to company + invoice + `requested`), so the two
// cannot drift apart silently. A future change to one is a failing check
// until the other matches.
//
// The rules, restated briefly:
//   - the invoice must belong to THIS token's client and have been ISSUED
//     (a draft's id is guessable; hiding a button is not access control);
//   - the CURRENT version of the family is what is charged, and an unsent
//     amendment makes neither version payable;
//   - the balance is refreshed from every payment in the family first;
//   - a stageId only NAMES a JobPaymentStage of this invoice that is still
//     `requested`; its amount is that row's UNCOVERED share (money already
//     received covers the stages in sequence), capped at the balance — and a
//     stage already covered falls back to the balance, never asks again;
//   - a requestId only NAMES an open InvoicePaymentRequest of this invoice
//     (the office's "different amount"); its amount is what that row still
//     asks for, capped at the balance. A stage, when both are named, wins.

import { latestInFamily, refreshFamilyLedger } from "@/lib/invoices/family";
import { invoiceBalanceCents } from "@/lib/stripe";
import { stageRemainingCents, requestRemainingCents } from "@/lib/invoices/paymentRequest";

const paidCentsOf = (invoice) => Math.round(Number(invoice?.amountPaid || 0) * 100);

/**
 * What a `requested` stage still asks for, from the ledger: its share less
 * what the money received in sequence already covers. `undefined` when the
 * stage is covered — the caller then charges the balance, as for a stage it
 * does not recognise. Shared by this file and the pay route so the two pay
 * paths cannot price one stage two ways.
 *
 * @param stage  the row the caller already found (company, invoice and
 *               `requested` checked there) — { amountCents }
 */
export async function stageShareCents(db, { companyId, current, stageId, stage }) {
  if (!stage) return undefined;
  const all = await db.jobPaymentStage.findMany({
    where: { companyId, invoiceId: current.id },
    select: { id: true, seq: true, label: true, amountCents: true, status: true },
  });
  const left = stageRemainingCents({
    stages: all,
    paidCents: paidCentsOf(current),
    stageId,
    balanceCents: invoiceBalanceCents(current),
  });
  // null: the stage was not in the list just read (it was found a moment
  // ago, so only a concurrent re-point gets here) — its own share, capped by
  // the caller at the balance, exactly as before this rule existed.
  if (left == null) return stage.amountCents;
  return left > 0 ? left : undefined;
}

/**
 * What an open "different amount" request still asks for, or `undefined`
 * when the link names none of this invoice's open requests or it is spent.
 * The figure is read from the row and the ledger — never from the browser.
 */
export async function requestShareCents(db, { companyId, current, requestId }) {
  if (!requestId || typeof requestId !== "string") return undefined;
  const row = await db.invoicePaymentRequest.findFirst({
    where: { id: requestId, companyId, invoiceId: current.id, status: "open" },
    select: { amountCents: true, paidCentsAtRequest: true },
  });
  if (!row) return undefined;
  const left = requestRemainingCents({
    amountCents: row.amountCents,
    paidCentsAtRequest: row.paidCentsAtRequest,
    paidCents: paidCentsOf(current),
    balanceCents: invoiceBalanceCents(current),
  });
  return left > 0 ? left : undefined;
}

/**
 * @returns {Promise<
 *   { ok: true, client, invoice, current, company, stageAmountCents, chargeCents, balanceCents }
 *   | { ok: false, status: number, error: string }
 * >}
 */
export async function resolvePortalCharge(db, { token, invoiceId, stageId = null, requestId = null }) {
  if (!invoiceId) return { ok: false, status: 400, error: "invoiceId is required" };

  const client = await db.client.findUnique({ where: { portalToken: token } });
  if (!client) return { ok: false, status: 404, error: "Portal link not found" };

  const invoice = await db.invoice.findFirst({
    where: {
      id: invoiceId,
      clientId: client.id,
      OR: [{ sentAt: { not: null } }, { status: { not: "draft" } }],
    },
    include: { client: true },
  });
  if (!invoice) return { ok: false, status: 404, error: "Invoice not found" };

  const currentRow = await latestInFamily(db, invoice.id, {
    select: { id: true, sentAt: true, status: true },
  });
  if (
    currentRow &&
    currentRow.id !== invoice.id &&
    !(currentRow.sentAt || currentRow.status !== "draft")
  ) {
    return { ok: false, status: 409, error: "This invoice has been updated — please refresh the page." };
  }
  await refreshFamilyLedger(db, invoice.id);
  const current = await latestInFamily(db, invoice.id, { include: { client: true } });
  if (!current) return { ok: false, status: 404, error: "Invoice not found" };

  const company = await db.company.findUnique({ where: { id: client.companyId } });
  // A demo walks the pay step without Stripe, so it is not refused for
  // lacking an account — and holding one changes nothing.
  if (!company || (!company.isDemo && (!company.stripeAccountId || !company.stripeChargesEnabled))) {
    return { ok: false, status: 400, error: "This company can't accept online payments yet" };
  }

  let stageAmountCents;
  if (stageId) {
    const stage = await db.jobPaymentStage.findFirst({
      // companyId, not just invoiceId — scripts/check-tenant-scope.mjs
      // requires a by-id lookup on a tenant model to be company-scoped.
      where: {
        id: stageId,
        companyId: client.companyId,
        invoiceId: current.id,
        status: "requested",
      },
      select: { amountCents: true },
    });
    stageAmountCents = await stageShareCents(db, { companyId: client.companyId, current, stageId, stage });
  }
  let requestAmountCents;
  if (stageAmountCents == null && requestId) {
    requestAmountCents = await requestShareCents(db, { companyId: client.companyId, current, requestId });
  }

  const balanceCents = invoiceBalanceCents(current);
  const amountCents = stageAmountCents ?? requestAmountCents;
  const chargeCents =
    amountCents == null
      ? balanceCents
      : Math.max(0, Math.min(amountCents, balanceCents));

  return { ok: true, client, invoice, current, company, stageAmountCents, requestAmountCents, chargeCents, balanceCents };
}
