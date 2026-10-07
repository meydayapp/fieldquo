// lib/invoices/paymentRequest.js
//
// "Request payment" with a choice: the next scheduled payment, the full
// balance, or a different amount the office types. And the two figures a
// client may then pay from the link: what was asked, or everything owed.
//
// ══ The owner's case ═════════════════════════════════════════════════════
//
// TrueFinish, INV-2026-0022, $8,927 on a 30 / 30 / 40 schedule. The client
// wanted to pay $6,500 now. The invoice page could only ask for the next
// stage, and the client's pay page could only take the stage the link
// named. "Request payment should say request full amount or maybe portion
// amount."
//
// ══ Who may type a number ════════════════════════════════════════════════
//
// The OFFICE types the different amount — staff, signed in, on their own
// company's invoice. That is not the browser non-negotiable #5 means: it is
// the contractor deciding what to bill, the same way they type a line price.
// The server still decides whether the figure is allowed (more than nothing,
// no more than the balance it computes itself) and stores it.
//
// The CLIENT never types one. Their link carries a request id; the amount is
// read from that row, re-derived against the ledger at the moment they pay,
// and capped at the balance. Their only choice is between two figures the
// server computed — this one, or the whole balance — and the whole balance is
// simply the pay path with no request named, the path that has always existed.
//
// ══ How money larger than one stage lands on the schedule ════════════════
//
// The rule lib/invoices/sendAsk.js already keeps: the Payment rows are the
// ledger, and what has been collected covers the stages IN SEQUENCE — the
// deposit before the progress payment, the progress payment before the
// balance — skipping waived and zero stages. Nothing is stored per stage, so
// there is no second record of "paid" that could disagree with the invoice.
// stageCoverage below spells that out per stage, and scripts/check-payment-
// request.mjs proves it picks the same next stage invoiceSendAsk picks.
//
// $6,500 on the case above: Deposit $2,678.10 paid, Job start $2,678.10 paid,
// Job end $3,570.80 with $1,143.80 covered and $2,427.00 still due — which is
// also exactly the invoice's balance.
//
// ══ A request's remaining amount ═════════════════════════════════════════
//
// A request remembers what had been collected when it was made. Whatever has
// come in since counts against it — by card through its own link, by cheque,
// by anything — so a $6,500 request with $6,500 received since is spent, and
// its link falls back to the balance rather than asking twice.
//
// Pure. Cents in, cents out.

export const REQUEST_CHOICES = Object.freeze(["next_stage", "balance", "custom"]);

const int = (v) => {
  const n = Math.round(Number(v) || 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * A typed amount, in dollars, to cents — STRICTLY.
 *
 * Accepts a finite number, or a string of digits with at most one "." and at
 * most two decimals. Refuses everything else rather than guessing:
 *
 *   "6,500.00"  → refused. parseFloat reads it as 6; Number reads it as NaN;
 *                 a German office means 6.5. A comma is a question, not a
 *                 number, and the input on the page sends a plain number.
 *   "6500.005"  → refused. Fractions of a cent are a typo.
 *   "1e4", "", " ", null, NaN, Infinity, {}, [] → refused.
 *
 * @returns {{ ok: true, cents: number } | { ok: false, code: "invalid_amount" }}
 */
export function parseAmountCents(input) {
  let n;
  if (typeof input === "number") {
    n = input;
  } else if (typeof input === "string") {
    const s = input.trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return { ok: false, code: "invalid_amount" };
    n = Number(s);
  } else {
    return { ok: false, code: "invalid_amount" };
  }
  if (!Number.isFinite(n)) return { ok: false, code: "invalid_amount" };
  const cents = Math.round(n * 100);
  // Two decimals at most, tested on the number itself so 0.1 + 0.2 style
  // representations still pass and 6500.005 does not.
  if (Math.abs(n * 100 - cents) > 1e-6) return { ok: false, code: "invalid_amount" };
  return { ok: true, cents };
}

/**
 * The office's different amount, held to the balance the SERVER computed.
 *
 * @returns {{ ok: true, cents } | { ok: false, code }}
 *   code ∈ "invalid_amount" | "not_positive" | "over_balance" | "nothing_owed"
 */
export function validateCustomAmount({ input, balanceCents } = {}) {
  const balance = Math.max(0, int(balanceCents));
  if (balance <= 0) return { ok: false, code: "nothing_owed" };
  const parsed = parseAmountCents(input);
  if (!parsed.ok) return parsed;
  if (parsed.cents <= 0) return { ok: false, code: "not_positive" };
  if (parsed.cents > balance) return { ok: false, code: "over_balance", balanceCents: balance };
  return { ok: true, cents: parsed.cents };
}

/**
 * Every stage, with what the money collected so far covers of it.
 *
 * Same allocation as invoiceSendAsk (lib/invoices/sendAsk.js): waived and
 * zero stages take nothing, the rest are covered in `seq` order.
 *
 * @param stages     JobPaymentStage rows { id, seq, label, amountCents, status }
 * @param paidCents  net paid on the invoice family, in cents
 * @returns [{ id, seq, label, status, amountCents, coveredCents, remainingCents,
 *             state: "paid" | "part_paid" | "unpaid" | "waived" }] in seq order
 */
export function stageCoverage({ stages = [], paidCents = 0 } = {}) {
  const list = (Array.isArray(stages) ? stages : [])
    .filter((s) => s && typeof s === "object")
    .sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0));
  let left = Math.max(0, int(paidCents));
  return list.map((s) => {
    const amount = Math.max(0, int(s.amountCents));
    if (s.status === "waived" || amount <= 0) {
      return { id: s.id, seq: s.seq, label: s.label, status: s.status, amountCents: amount, coveredCents: 0, remainingCents: 0, state: "waived" };
    }
    const covered = Math.min(amount, left);
    left -= covered;
    const remaining = amount - covered;
    return {
      id: s.id,
      seq: s.seq,
      label: s.label,
      status: s.status,
      amountCents: amount,
      coveredCents: covered,
      remainingCents: remaining,
      state: remaining === 0 ? "paid" : covered > 0 ? "part_paid" : "unpaid",
    };
  });
}

/**
 * What ONE stage still asks for: its uncovered remainder, never more than the
 * invoice's balance. 0 when the money already received covers it. null when
 * the stage is not in the list (the caller falls back to the balance, as a
 * link naming an unknown stage always has).
 */
export function stageRemainingCents({ stages = [], paidCents = 0, stageId, balanceCents } = {}) {
  if (!stageId) return null;
  const row = stageCoverage({ stages, paidCents }).find((s) => s.id === stageId);
  if (!row) return null;
  const balance = Math.max(0, int(balanceCents));
  return Math.max(0, Math.min(row.remainingCents, balance));
}

/**
 * What a stored request still asks for. Everything collected since the
 * request was made counts against it; capped at the balance; never negative.
 */
export function requestRemainingCents({ amountCents, paidCentsAtRequest = 0, paidCents = 0, balanceCents } = {}) {
  const amount = Math.max(0, int(amountCents));
  const since = Math.max(0, int(paidCents) - Math.max(0, int(paidCentsAtRequest)));
  const balance = Math.max(0, int(balanceCents));
  return Math.max(0, Math.min(amount - since, balance));
}

/**
 * The three choices the office's dialog offers, all computed here.
 *
 * @returns {{
 *   balanceCents: number,
 *   collectedCents: number,
 *   nextStage: { id, label, index, count, requestCents } | null,
 *   stages: ReturnType<typeof stageCoverage>,
 * }}
 *   nextStage is null when there is no schedule, or when every stage is
 *   covered and only a change-order balance is left — then "next scheduled
 *   payment" is not a thing that exists and the dialog does not offer it.
 */
export function requestOptions({ totalCents, paidCents, stages = [] } = {}) {
  const total = Math.max(0, int(totalCents));
  const collected = Math.max(0, int(paidCents));
  const balance = Math.max(0, total - collected);
  const coverage = stageCoverage({ stages, paidCents: collected });
  const live = coverage.filter((s) => s.state !== "waived");
  const idx = live.findIndex((s) => s.remainingCents > 0);
  const next =
    balance > 0 && idx >= 0
      ? {
          id: live[idx].id,
          label: live[idx].label,
          index: idx + 1,
          count: live.length,
          requestCents: Math.min(live[idx].remainingCents, balance),
          status: live[idx].status,
        }
      : null;
  return { balanceCents: balance, collectedCents: collected, nextStage: next, stages: coverage };
}

/**
 * The client's two choices on a link that names a request or a stage: the
 * figure asked for, and the whole balance. Only the first when they are the
 * same figure (a choice between two identical buttons is not a choice); only
 * the balance when the request is spent.
 *
 * @returns [{ choice: "requested" | "balance", cents }]
 */
export function clientPayChoices({ requestedCents, balanceCents } = {}) {
  const balance = Math.max(0, int(balanceCents));
  if (balance <= 0) return [];
  const asked = requestedCents == null ? null : Math.max(0, Math.min(int(requestedCents), balance));
  if (asked == null || asked <= 0) return [{ choice: "balance", cents: balance }];
  if (asked >= balance) return [{ choice: "requested", cents: balance }];
  return [
    { choice: "requested", cents: asked },
    { choice: "balance", cents: balance },
  ];
}
