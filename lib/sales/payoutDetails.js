// lib/sales/payoutDetails.js
//
// How a rep is engaged, and where their money goes.
//
// ══ Two facts nobody had recorded ═════════════════════════════════════════
//
// The commission ledger has always known what a rep is OWED — three milestones
// a company, summed into a weekly batch — and nothing anywhere knew how to pay
// it. There was no payout method, no account to send it to, and no record of
// whether the person is a freelancer or an employee.
//
// The second one is not paperwork. An employee accrues paid leave and a
// freelancer does not, and a payroll surface that guessed would either invent
// a holiday balance nobody owes or withhold one somebody earned.
//
// ══ Nothing here is defaulted into a claim ════════════════════════════════
//
// `engagement` has no default even though every rep today is a freelancer,
// because a default is exactly what makes the first employee silently wrong.
// Absence of a statement is not a statement — AGENTS.md failure class #5.
//
// Pure. scripts/check-sales-payout-details.mjs executes it.

/** How the person is engaged. Stated, never inferred from anything else. */
// ══ Why every entry below names a catalogue key ═══════════════════════════
//
// This is the screen where a rep says how they want to be paid, and it was
// entirely English: the method names, the note under each one explaining what
// the money costs on the way, and the label on the field asking for their
// account. Being told in a language you do not read that "fees depend on the
// receiving account's country" is worse than not being told.
//
// The keys sit BESIDE the English rather than replacing it. This file is pure
// and scripts/check-sales-payout-details.mjs executes it under bare node, so
// it cannot import a translator; and payoutReadiness()'s problems reach an API
// error body where there is no reader to consult. English stays the fallback.
export const ENGAGEMENTS = Object.freeze([
  {
    key: "freelancer",
    label: "Freelancer",
    labelKey: "app.salesPay.engagement.freelancer.label",
    noteKey: "app.salesPay.engagement.freelancer.note",
    /// What it means for what FieldQuo owes beyond commission.
    note:
      "Invoices for their commission. No paid leave, no vacation accrual, no statutory " +
      "deductions withheld by FieldQuo — they account for their own.",
    accruesPaidLeave: false,
  },
  {
    key: "employee",
    label: "Employee",
    labelKey: "app.salesPay.engagement.employee.label",
    noteKey: "app.salesPay.engagement.employee.note",
    note:
      "On payroll. Paid leave accrues, and statutory deductions are FieldQuo's to withhold " +
      "and remit.",
    accruesPaidLeave: true,
  },
]);

/**
 * Where the money goes.
 *
 * Upwork is on this list because it is how the first reps are actually
 * engaged. Leaving it off would have meant a record saying "bank transfer"
 * about money that moves as a milestone release — the same amount, a different
 * place, and a payout run that cannot tell them apart pays somebody twice or
 * not at all.
 */
export const PAYOUT_METHODS = Object.freeze([
  {
    key: "upwork",
    labelKey: "app.salesPay.method.upwork.label",
    handleLabelKey: "app.salesPay.method.upwork.handleLabel",
    noteKey: "app.salesPay.method.upwork.note",
    label: "Upwork",
    /// What the free-text handle means for THIS method. The screen labels the
    /// field with it, so a rep is never asked for "your details".
    handleLabel: "Upwork contract or profile link",
    note:
      "Released against the contract's milestones. Upwork's own fee applies and comes off " +
      "what lands, so the figure in the ledger is what FieldQuo sends, not what arrives.",
  },
  {
    key: "paypal",
    labelKey: "app.salesPay.method.paypal.label",
    handleLabelKey: "app.salesPay.method.paypal.handleLabel",
    noteKey: "app.salesPay.method.paypal.note",
    label: "PayPal",
    handleLabel: "PayPal email address",
    note: "Sent as a PayPal transfer. Fees depend on the receiving account's country and type.",
  },
  {
    key: "interac",
    labelKey: "app.salesPay.method.interac.label",
    handleLabelKey: "app.salesPay.method.interac.handleLabel",
    noteKey: "app.salesPay.method.interac.note",
    label: "Interac e-Transfer",
    handleLabel: "Email address registered for Interac",
    note: "Canadian accounts only. Usually free and same-day.",
  },
  {
    // Added because the list had no honest answer for a rep outside Canada who
    // is not on Upwork. PayPal works but converts at its own rate, and a bank
    // transfer across a border arrives light by an amount nobody can predict
    // in advance — which is the one thing a person deciding how to be paid
    // most wants to know.
    key: "wise",
    labelKey: "app.salesPay.method.wise.label",
    handleLabelKey: "app.salesPay.method.wise.handleLabel",
    noteKey: "app.salesPay.method.wise.note",
    label: "Wise",
    handleLabel: "The email address on your Wise account, or your Wise account details",
    note:
      "Best for a rep outside Canada. Converts at the mid-market rate with the fee shown " +
      "up front, so what arrives is predictable — and it can land in your own currency.",
  },
  {
    key: "bank_transfer",
    labelKey: "app.salesPay.method.bank_transfer.label",
    handleLabelKey: "app.salesPay.method.bank_transfer.handleLabel",
    noteKey: "app.salesPay.method.bank_transfer.note",
    label: "Bank transfer",
    handleLabel: "Account details, or the IBAN",
    note: "Slowest to arrive and cheapest to send. Best for a rep being paid a large batch.",
  },
]);

const ENGAGEMENT_KEYS = new Set(ENGAGEMENTS.map((e) => e.key));
const METHOD_KEYS = new Set(PAYOUT_METHODS.map((m) => m.key));

export const isEngagement = (v) => ENGAGEMENT_KEYS.has(String(v ?? ""));
export const isPayoutMethod = (v) => METHOD_KEYS.has(String(v ?? ""));

/** One method's shape, or null. Used to label the handle field. */
export function payoutMethod(key) {
  return PAYOUT_METHODS.find((m) => m.key === key) || null;
}

/** One engagement's shape, or null. */
export function engagement(key) {
  return ENGAGEMENTS.find((e) => e.key === key) || null;
}

/**
 * Can this rep actually be paid?
 *
 * Every reason is returned, not the first one. A rep missing both a method and
 * an engagement should be told both, or they fix one, come back, and are told
 * the other — which is how a two-minute task becomes two days.
 */
export function payoutReadiness(rep = {}) {
  const problems = [];
  if (!isEngagement(rep.engagement)) {
    problems.push({
      code: "no_engagement",
      titleKey: "app.salesPay.readiness.noEngagement.title",
      fixKey: "app.salesPay.readiness.noEngagement.fix",
      title: "Nobody has said whether this rep is a freelancer or an employee.",
      fix:
        "It decides whether paid leave accrues, and whether FieldQuo withholds anything. It is " +
        "not guessed from anything else.",
    });
  }
  if (!isPayoutMethod(rep.payoutMethod)) {
    problems.push({
      code: "no_method",
      titleKey: "app.salesPay.readiness.noMethod.title",
      fixKey: "app.salesPay.readiness.noMethod.fix",
      title: "No payout method on record.",
      fix: "PayPal, Interac, a bank transfer, or an Upwork contract — the rep chooses.",
    });
  } else if (!String(rep.payoutHandle ?? "").trim()) {
    // A method with no destination is worse than no method: it reads as
    // configured on every screen that checks only the method.
    const m = payoutMethod(rep.payoutMethod);
    problems.push({
      code: "no_handle",
      // Two sentences, and the second one NAMES A FIELD. Its English builds
      // that name by lower-casing the handle label, which is an English
      // typographic rule and not a universal one — German capitalises the
      // noun, and half these languages do not lower-case a label at all. So
      // the key takes the method and the field name as VALUES, already
      // resolved by the screen against its own catalogue.
      titleKey: m ? "app.salesPay.readiness.noHandle.title" : null,
      fixKey: m ? "app.salesPay.readiness.noHandle.fix" : null,
      params: { methodKey: m?.labelKey || null, handleKey: m?.handleLabelKey || null },
      title: `${m?.label || "That method"} is chosen, but there is nowhere to send it.`,
      fix: `Add the ${m?.handleLabel?.toLowerCase() || "destination"}.`,
    });
  }
  return { ready: problems.length === 0, problems };
}

/**
 * How stale the payout details are, in days, or null when never confirmed.
 *
 * Payout details are the field most likely to be silently wrong: somebody
 * closes a bank account and the record does not find out. Reported so a screen
 * can say how old it is rather than presenting it as current.
 */
export function payoutAgeDays(confirmedAt, now = new Date()) {
  if (!confirmedAt) return null;
  const then = new Date(confirmedAt);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.floor((now - then) / 86_400_000));
}
