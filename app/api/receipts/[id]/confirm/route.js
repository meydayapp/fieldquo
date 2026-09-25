// app/api/receipts/[id]/confirm/route.js
//
// The tap that books a receipt. Nothing else does — the suggestions only
// suggest (lib/receipts/suggest.js).
//
// Body:
//   parts: [{ kind: "job"|"overhead"|"general", jobId?, category?,
//             lineIndexes?: number[], amountCents?: number }]
//   totalCents?, taxCents?   the person's correction of a misread figure
//   vendorName?, date?       likewise
//   acknowledgeDuplicate?    true once the person has seen the warning
//
// ══ Who may put it where ═══════════════════════════════════════════════════
//
// Re-checked here from a freshly loaded member, whatever the screen offered:
//
//   office (expenses: everyone's)  any of the company's live jobs, overhead,
//                                  or general
//   everyone else                  only THEIR jobs (a visit assigned to them
//                                  or time they clocked there). Overhead and
//                                  "not sure" are the office's call — the
//                                  crew's way to say so is "let the office
//                                  decide" (PATCH ../ { action: "office" }).
//
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { mayTouchReceipt, receiptScope, seesAllReceipts } from "@/lib/receipts/access";
import { linkableJobWhere } from "@/lib/receipts/candidates";
import { validateReceipt } from "@/lib/receipts/validate";
import { allocate, normaliseTarget } from "@/lib/receipts/allocate";
import { confirmReceipt, recordReceiptPrices, CONFIRMABLE } from "@/lib/receipts/record";
import { recordActivity } from "@/lib/activity/log";

/** Why a split was refused, as a sentence. The codes come from allocate(). */
const REFUSED = {
  no_parts: "Choose where this receipt goes.",
  too_many_parts: "A receipt can be split into at most 12 parts.",
  no_total: "The total couldn't be read. Type the total from the receipt.",
  tax_exceeds_total: "The tax can't be more than the total.",
  job_missing: "Choose a job for each part that goes to a job.",
  cannot_split_refund: "A refund can only go to one place.",
  lines_do_not_add_up:
    "The lines on this receipt don't add up to its total, so it can't be split by line. Split it by amount instead.",
  bad_line: "One of the lines chosen isn't on this receipt.",
  line_twice: "A line can only go to one place.",
  group_not_positive: "Each part needs at least one line that costs something.",
  lines_unassigned: "Every line has to go somewhere — some lines aren't assigned yet.",
  amount_not_positive: "Each part needs an amount above zero.",
  amounts_do_not_add_up: "The parts have to add up to the receipt's total exactly.",
  mixed_split: "Split either by line or by amount, not both.",
};

const asCents = (v) => (Number.isInteger(v) ? v : undefined);

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  const receipt = await db.receipt.findFirst({
    where: { id, companyId: member.companyId, ...receiptScope(full, member.userId) },
  });
  if (!receipt || !mayTouchReceipt(full, member.userId, receipt)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!CONFIRMABLE.includes(receipt.status)) {
    return NextResponse.json(
      { error: receipt.status === "reading" ? "This receipt is still being read." : "This receipt is already settled." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const office = seesAllReceipts(full);
  const parts = Array.isArray(body.parts) ? body.parts : [];
  const targets = parts.map(normaliseTarget);

  // ── Where each part may go, checked against the database ────────────────
  if (!office && targets.some((t) => t.kind !== "job")) {
    return NextResponse.json(
      { error: "Only the office can book a receipt to overhead. Choose one of your jobs, or let the office decide." },
      { status: 403 },
    );
  }
  const jobIds = [...new Set(targets.filter((t) => t.kind === "job" && t.jobId).map((t) => t.jobId))];
  if (jobIds.length) {
    const allowed = await db.job.findMany({
      where: {
        id: { in: jobIds },
        ...linkableJobWhere({ companyId: member.companyId, userId: member.userId, seesAll: office }),
      },
      select: { id: true },
    });
    if (allowed.length !== jobIds.length) {
      return NextResponse.json(
        { error: office ? "One of those jobs isn't available." : "You can only book receipts to jobs you're on." },
        { status: 403 },
      );
    }
  }

  // ── The duplicate warning is answered, not skipped ──────────────────────
  if (receipt.duplicateOfId && body.acknowledgeDuplicate !== true) {
    return NextResponse.json(
      {
        error: "This looks like a receipt that was already captured. Check it before booking it twice.",
        duplicate: true,
        duplicateOfId: receipt.duplicateOfId,
      },
      { status: 409 },
    );
  }

  const validation = receipt.extract
    ? validateReceipt(receipt.extract)
    : { totalCents: null, taxCents: null, taxBreakdown: null, canSplitByLines: false, reconciliation: { lines: [] } };
  const result = allocate(validation, parts, {
    totalCents: asCents(body.totalCents),
    taxCents: body.taxCents === null ? undefined : asCents(body.taxCents),
  });
  if (!result.ok) {
    return NextResponse.json({ error: REFUSED[result.reason] || "That split doesn't work.", code: result.reason }, { status: 400 });
  }

  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? `${body.date}T12:00:00.000Z` : null;
  const booked = await confirmReceipt({
    receipt,
    rows: result.rows,
    edits: { vendorName: typeof body.vendorName === "string" ? body.vendorName : undefined, date },
    confirmedById: member.userId || null,
  });
  if (!booked.ok) {
    return NextResponse.json({ error: "This receipt was already booked.", code: booked.reason }, { status: 409 });
  }

  // The price book, after the money is safe. Never fails the confirm.
  const prices = await recordReceiptPrices({ receipt, rows: result.rows, expenseIds: booked.expenseIds });

  await recordActivity(member, {
    action: "receipt.confirmed",
    entityType: "receipt",
    entityId: id,
    summary: `Booked a receipt${receipt.vendorName ? ` from ${receipt.vendorName}` : ""} as ${result.rows.length} expense${result.rows.length === 1 ? "" : "s"}`,
    metadata: {
      expenseIds: booked.expenseIds,
      parts: result.rows.map((r) => ({ kind: r.target.kind, jobId: r.target.jobId, amountCents: r.amountCents })),
    },
  });

  return NextResponse.json({ ok: true, expenseIds: booked.expenseIds, pricesRecorded: prices });
}
