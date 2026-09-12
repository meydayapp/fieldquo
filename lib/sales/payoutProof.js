// lib/sales/payoutProof.js
//
// Marking a payout batch paid, with something to show for it.
//
// ══ Why "paid" needs proof ════════════════════════════════════════════════
//
// lib/sales/payouts.js is explicit that no money moves from this build: a
// batch closes to `ready`, a person pays it through Wise or Interac or Upwork,
// and a person marks it `paid`. Before this file, "marks it paid" was a status
// flip and nothing else — the rep's Pay screen said "Paid 15 Sep" on the
// strength of one click, and if the transfer had not actually gone out there
// was nothing on either side to notice it with.
//
// So a batch cannot be marked paid with NEITHER a file NOR a reference. The rep
// must be able to see what was sent: a receipt or transfer screenshot they can
// open, or a transfer reference they can look up at their bank. One of the two
// is the floor; "paid" with nothing behind it is a claim the rep cannot check,
// and a rep in Kyiv checking whether a Wise transfer landed is exactly the
// person this record exists for. The owner's words: "I should be able to say
// where and when I paid them."
//
// ══ Superadmin only, re-read at the write ═════════════════════════════════
//
// Paying reps is FieldQuo's own money leaving. That is the class
// SUPERADMIN_ONLY_PERMISSIONS in lib/platform/permissions.js exists for
// ("these move money"), so the role is checked here, on the admin row the
// route just read — not trusted from a screen that hid the button.
//
// ══ The folder is FieldQuo's, never a company's ═══════════════════════════
//
// The receipt goes to Cloudinary under fieldquo/platform/payouts/<batchId>.
// Every other upload path in the product files under a COMPANY's folder,
// because every other upload is a tenant's asset. This one is not: it is
// FieldQuo paying its own staff, and a receipt filed under some company's
// folder would be FieldQuo's payroll sitting inside a customer's media. The
// folder is built here, from the batch id only, and asserted by
// scripts/check-sales-payout-proof.mjs.
//
// ══ Update, never delete ══════════════════════════════════════════════════
//
// Proof can be added to a batch already marked paid — the transfer went out on
// Friday and the screenshot is found on Monday — and a later save replaces the
// fields. Nothing here clears a field or removes an asset: a payment record
// that can be blanked is not a record.
//
// ══ The amount is re-summed, as everywhere else ═══════════════════════════
//
// The push the rep receives says what was paid. That figure comes from
// payableTotalFor — the ledger rows in the batch, summed now — for the reason
// lib/sales/payouts.js gives: totalCentsAtClose "is deliberately NOT what
// anyone pays from".
import { db } from "@/lib/db";
import { safeFilename } from "@/lib/media/validate";
import { payableTotalFor } from "./payouts";
import { centsToMoney } from "./money";
import {
  PAID_STATUS,
  READY_STATUS,
  classifyProofFile,
  normaliseProofFields,
  proofFolderFor,
  proofProblem,
  weekLabel,
} from "./payoutProofRules";

// The rules live in ./payoutProofRules (browser-safe) and are re-exported
// here so server callers keep one import.
export * from "./payoutProofRules";

/**
 * Mark a batch paid, or add proof to one already paid.
 *
 * @param batchId   the batch.
 * @param admin     the PlatformAdmin row the route read for THIS request —
 *                  `{ id, role }`. Refused unless role is "superadmin".
 * @param fields    { paymentReference, paidVia, paymentNote } — raw, trimmed here.
 * @param file      optional `{ buffer, type, size, name }` — the receipt.
 * @param deps      injectable: prisma, upload, push, appSentence, now — so
 *                  scripts/check-sales-payout-proof.mjs executes this against
 *                  a scripted database and a recording uploader.
 *
 * @returns { ok: true, batch, cents, notified } or { ok: false, status, error }.
 */
export async function markBatchPaid({ batchId, admin, fields = {}, file = null, deps = {} } = {}) {
  const prisma = deps.prisma || db;
  const now = deps.now ? deps.now() : new Date();

  // Superadmin, from the row the route just read. Not "admin", not "support":
  // this is FieldQuo's money leaving, the class SUPERADMIN_ONLY_PERMISSIONS
  // names, and a role is never taken from the request body.
  if (!admin?.id || admin.role !== "superadmin") {
    return { ok: false, status: 403, error: "Only a superadmin can mark a payout paid." };
  }

  let folder;
  try {
    folder = proofFolderFor(batchId);
  } catch {
    return { ok: false, status: 400, error: "That batch id is not valid." };
  }

  const batch = await prisma.salesPayoutBatch.findUnique({
    where: { id: String(batchId) },
    select: {
      id: true,
      salesRepId: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      paidAt: true,
      proofUrl: true,
      proofPublicId: true,
      proofFilename: true,
      paymentReference: true,
      paidVia: true,
      paymentNote: true,
    },
  });
  if (!batch) return { ok: false, status: 404, error: "No such payout batch." };

  // Only a closed batch can be paid. An `open` one is still accruing — paying
  // it would pay a figure that changes tomorrow — and closing is the Monday
  // cron's job (app/api/cron/sales-payouts), not this button's.
  if (batch.status !== READY_STATUS && batch.status !== PAID_STATUS) {
    return {
      ok: false,
      status: 409,
      error: `This batch is "${batch.status}", not ready. Only a closed (ready) batch can be marked paid.`,
    };
  }

  const text = normaliseProofFields(fields);

  let classified = null;
  if (file) {
    classified = classifyProofFile(file);
    if (!classified.ok) return { ok: false, status: 400, error: classified.error };
  }

  const problem = proofProblem({
    hasFile: Boolean(file),
    paymentReference: text.paymentReference,
    existing: batch,
  });
  if (problem) return { ok: false, status: 400, error: problem };

  // Upload BEFORE the write, so a failed upload leaves the batch exactly as
  // it was rather than paid-with-a-dangling-url. Into FieldQuo's own folder.
  let uploaded = null;
  if (file) {
    const upload = deps.upload || (await import("@/lib/cloudinary")).uploadBuffer;
    // A PDF keeps an extension on its public id, for the reason
    // lib/media/validate.js's uploadPublicId gives: Cloudinary serves a raw
    // asset's Content-Type from that extension, and without one the browser
    // downloads a mystery file instead of opening the receipt.
    const publicId =
      classified.resourceType === "raw" ? `${globalThis.crypto.randomUUID()}.pdf` : undefined;
    const result = await upload(file.buffer, {
      folder,
      publicId,
      resourceType: classified.resourceType,
    });
    uploaded = {
      proofUrl: result.secure_url || result.url,
      proofPublicId: result.public_id,
      proofFilename: safeFilename(file.name) || (classified.kind === "document" ? "receipt.pdf" : "receipt"),
    };
  }

  const alreadyPaid = batch.status === PAID_STATUS;

  // Only fields that were GIVEN are written. A later "add proof" with an empty
  // reference box must not blank the reference recorded on Friday.
  const data = {
    ...(uploaded || {}),
    ...(text.paymentReference ? { paymentReference: text.paymentReference } : {}),
    ...(text.paidVia ? { paidVia: text.paidVia } : {}),
    ...(text.paymentNote ? { paymentNote: text.paymentNote } : {}),
  };
  if (!alreadyPaid) {
    data.status = PAID_STATUS;
    // The server's clock: "when I paid them" is the moment the superadmin
    // says so, and it is stamped once — a later proof upload does not move it.
    data.paidAt = now;
  }

  const [updated, total] = await Promise.all([
    prisma.salesPayoutBatch.update({
      where: { id: batch.id },
      data,
      select: {
        id: true,
        salesRepId: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        paidAt: true,
        totalCentsAtClose: true,
        proofUrl: true,
        proofPublicId: true,
        proofFilename: true,
        paymentReference: true,
        paidVia: true,
        paymentNote: true,
      },
    }),
    payableTotalFor(batch.id, prisma),
  ]);

  // Who marked it, when, with what — the durable trail beside the row.
  await prisma.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: alreadyPaid ? "sales_payout_proof_added" : "sales_payout_marked_paid",
      details: {
        batchId: batch.id,
        salesRepId: batch.salesRepId,
        cents: total.cents,
        paidVia: updated.paidVia || null,
        paymentReference: updated.paymentReference || null,
        proofPublicId: updated.proofPublicId || null,
      },
    },
  });

  // Tell the rep, in their language, once — on the transition to paid, not on
  // a later proof upload. Best-effort and off the request path, the way every
  // push in lib/notify/push.js is: a push service being down must not un-pay
  // a batch. The amount is in the body on the owner's instruction — it is
  // the rep's own pay, sent to the rep's own device.
  let notified = false;
  if (!alreadyPaid) {
    notified = true;
    const push = deps.push || (await import("@/lib/notify/push")).pushToReps;
    const sentence = deps.appSentence || (await import("@/lib/notify/push")).appSentence;
    void push({
      salesRepIds: [batch.salesRepId],
      payload: async (language) => ({
        title: await sentence(language, "app.salesPay.paidPushTitle"),
        body: await sentence(language, "app.salesPay.paidPushBody", {
          week: weekLabel(batch.periodStart, batch.periodEnd, language),
          amount: centsToMoney(total.cents),
        }),
        tag: `sales-payout-${batch.id}`,
        url: "/sales/pay",
      }),
    });
  }

  return { ok: true, batch: updated, cents: total.cents, driftedFromClose: total.driftedFromClose, notified };
}
