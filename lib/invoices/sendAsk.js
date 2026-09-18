// lib/invoices/sendAsk.js
//
// What the manual "Send" on an invoice asks the client for.
//
// ══ The bug this replaces ════════════════════════════════════════════════
//
// The send route emailed the invoice with no requestAmount, so the email
// headlined the FULL balance — even on a job whose company had set a
// deposit / progress / completion schedule and whose deposit the client had
// already paid. The scheduled stage emails (lib/paymentSchedule/run.js, the
// 06:10 cron) knew the schedule; the button beside them did not, and a
// homeowner who had paid 30% on acceptance got a hand-sent email asking
// for 100%.
//
// ══ The rule ═════════════════════════════════════════════════════════════
//
//   no schedule            ask for the balance (total − net paid)
//   a schedule             ask for the FIRST stage the money received has
//                          not yet covered, allocating payments to stages
//                          in sequence — the deposit is covered before the
//                          progress payment, whatever the client typed in
//                          the memo line
//   everything collected   refuse; there is nothing to ask for
//
// Payments are the ledger. A JobPaymentStage has no "paid" status of its
// own — the portal's checkout and the office's recorded payments land on
// the invoice, and the stage rows say what was ASKED, not what arrived —
// so "collected" is computeInvoiceState's net paid, never a stage flag.
//
// A stage's due date is deliberately not consulted here: the person
// pressing Send is choosing to ask now. The cron asks on the date; the
// button asks on demand, for the same stage the cron would ask for next.
// The result says which, so the screen and the activity line can print it.
//
// Pure. Cents in, cents out; scripts/check-invoice-send-ask.mjs runs the
// three schedules the brief named — none, deposit + balance, three stages.

const toCents = (v) => Math.round((Number(v) || 0) * 100);

/**
 * @param totalCents  the invoice total in cents
 * @param paidCents   net paid (after refunds) in cents
 * @param stages      JobPaymentStage rows for this invoice, any order:
 *                    { id, seq, label, amountCents, status }
 * @returns { kind: "nothing_owed", remainingCents: 0, collectedCents }
 *        | { kind: "balance", requestCents, remainingCents, collectedCents, stage: null }
 *        | { kind: "stage", requestCents, remainingCents, collectedCents,
 *            stage: { id, seq, label, amountCents, status, index, count } }
 */
export function invoiceSendAsk({ totalCents, paidCents, stages = [] } = {}) {
  const total = Math.max(0, Math.round(Number(totalCents) || 0));
  const collected = Math.max(0, Math.round(Number(paidCents) || 0));
  const remaining = Math.max(0, total - collected);
  if (remaining === 0) return { kind: "nothing_owed", requestCents: 0, remainingCents: 0, collectedCents: collected, stage: null };

  const live = (Array.isArray(stages) ? stages : [])
    .filter((s) => s && typeof s === "object" && s.status !== "waived" && Math.round(Number(s.amountCents) || 0) > 0)
    .sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0));
  if (!live.length) return { kind: "balance", requestCents: remaining, remainingCents: remaining, collectedCents: collected, stage: null };

  let left = collected;
  for (let i = 0; i < live.length; i++) {
    const s = live[i];
    const amount = Math.round(Number(s.amountCents) || 0);
    const covered = Math.min(amount, left);
    left -= covered;
    const uncovered = amount - covered;
    if (uncovered > 0) {
      return {
        kind: "stage",
        // Never more than is owed on the whole invoice — a change order that
        // shrank the total after the schedule was frozen must not be asked
        // for twice.
        requestCents: Math.min(uncovered, remaining),
        remainingCents: remaining,
        collectedCents: collected,
        stage: { id: s.id, seq: s.seq, label: s.label, amountCents: amount, status: s.status, index: i + 1, count: live.length },
      };
    }
  }
  // Every stage covered and something still owed: the schedule was frozen
  // on a smaller total (a change order added work). The balance is the
  // honest ask; it is not any stage.
  return { kind: "balance", requestCents: remaining, remainingCents: remaining, collectedCents: collected, stage: null };
}

/** The same, from an invoice row with `total` and `amountPaid` in dollars. */
export function invoiceSendAskFor(invoice, stages = []) {
  return invoiceSendAsk({ totalCents: toCents(invoice?.total), paidCents: toCents(invoice?.amountPaid), stages });
}
