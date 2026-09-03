// lib/receipts/demoReceipt.js
//
// What happens instead of a vision call when the company scanning is a sales
// demo.
//
// ══ The hazard ═════════════════════════════════════════════════════════════
//
// Smaller than the demo email and demo SMS hazards, and real anyway: a receipt
// scan is the most expensive single model call in the product — one photograph
// at `imageDetail: "high"` plus a long structured reply — and a demo account is
// exactly where somebody photographs the same receipt eleven times to show how
// fast it is. lib/demo/simulatedSpend.js's header is the general form of it: a
// demo must not put FieldQuo's card in front of a vendor.
//
// ══ Substitution, not refusal ══════════════════════════════════════════════
//
// The owner's distinction, carried over verbatim from lib/email/demoMail.js: a
// demo must not spend, but this must not become "demos can't scan receipts",
// which breaks the thing the demo exists to show. A rep needs to watch the
// upload go up, the fields fill in, the mismatch banner appear, and the cost
// land on the job's material line.
//
// So all of that still happens with the SAME return shape a real scan returns
// ({ ok: true, data }), and the only thing that changes is that no model is
// called. The canned receipt below is deliberately ORDINARY — it adds up — so
// the walkthrough shows the happy path; the mismatch case is a real receipt's
// job to demonstrate, not a trap to spring on a prospect.
//
// ══ Why the record is an ActivityLog row ═══════════════════════════════════
//
// Same answer demoMail.js and demoSms.js give, and deliberately the same table
// rather than a third one: the activity trail renders arbitrary dotted verbs by
// their `summary`, so a row written here is visible to the rep today with no UI
// change. Written with `action: "receipt.simulated"`, never the caller's own
// verb — two facts, and collapsing them would make one unrecoverable.
import { recordActivity } from "@/lib/activity/log";

/**
 * A plausible trade-counter receipt, in the exact shape extractReceipt returns
 * AFTER normaliseExtraction — because that is what the route hands on.
 *
 * The amounts are strings for the same reason the real ones are: nothing on
 * this path is allowed to hand the screen a number that did not come out of
 * lib/receipts/reconcile.js.
 */
export function simulatedExtraction() {
  return {
    merchantName: "Northline Building Supply",
    merchantAddress: "1180 Rue Sainte-Catherine O, Montréal QC",
    merchantContact: "(514) 555-0142",
    transactionDate: "14/08/2026",
    transactionDateIso: "2026-08-14",
    receiptNumber: "TKT-88401",
    paymentMethod: "VISA",
    currencyCode: "CAD",
    items: [
      { description: "Primer, 3.78 L", quantity: "2", unitPrice: "42.50", lineTotal: "85.00" },
      { description: "Sandpaper 180 grit, 25 pk", quantity: "1", unitPrice: "18.75", lineTotal: "18.75" },
      { description: "Painter's tape 48 mm", quantity: "4", unitPrice: "7.95", lineTotal: "31.80" },
    ],
    printedSubtotal: "135.55",
    printedTax: "20.30",
    printedTotal: "155.85",
    fileDisplayName: "Northline Building Supply, 14 Aug",
    summary: "Primer, sandpaper and tape from Northline Building Supply.",
    unreadable: [],
  };
}

/**
 * The demo branch of a receipt scan.
 *
 * @param member  from memberOrRefusal — needed for the activity row's actor.
 * @param imageUrl  recorded so "which photo did that come from" stays
 *                  answerable, exactly as demoMail stores the whole letter.
 * @returns the same { ok: true, data } a real extraction returns.
 */
export async function simulatedReceiptScan({ member, imageUrl } = {}) {
  const data = simulatedExtraction();

  await recordActivity(member, {
    action: "receipt.simulated",
    entityType: "receipt",
    summary: "Receipt scan simulated — this is a demo company, so no AI call was made.",
    metadata: { imageUrl: imageUrl || null, extraction: data },
  });

  return { ok: true, data, simulated: true };
}
