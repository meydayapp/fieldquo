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
//     `requested`; its amount comes from that row, capped at the balance.

import { latestInFamily, refreshFamilyLedger } from "@/lib/invoices/family";
import { invoiceBalanceCents } from "@/lib/stripe";

/**
 * @returns {Promise<
 *   { ok: true, client, invoice, current, company, stageAmountCents, chargeCents, balanceCents }
 *   | { ok: false, status: number, error: string }
 * >}
 */
export async function resolvePortalCharge(db, { token, invoiceId, stageId = null }) {
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
    if (stage) stageAmountCents = stage.amountCents;
  }

  const balanceCents = invoiceBalanceCents(current);
  const chargeCents =
    stageAmountCents == null
      ? balanceCents
      : Math.max(0, Math.min(stageAmountCents, balanceCents));

  return { ok: true, client, invoice, current, company, stageAmountCents, chargeCents, balanceCents };
}
