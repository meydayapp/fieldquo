// lib/paymentSchedule/validate.js
//
// The gate between "what a browser posted to Settings → Company" and what
// gets written to PaymentScheduleStage. Mirrors lib/servicePlans/validate.js:
// a persisted template must always be usable, so every check that matters
// happens here, once, rather than being re-derived (or skipped) by whichever
// route writes the rows.
//
// A schedule that fails validation is never written. That's what keeps
// lib/quotes/quoteLifecycle.js's "does this company have a structured
// schedule" check simple — it only ever finds a valid one or none at all,
// never one that's been silently saved half-broken.

import {
  PAYMENT_SCHEDULE_TRIGGERS,
  validateSchedulePercentages,
} from "./engine";

const MAX_STAGES = 12; // generous; nobody is billing a job in more than a dozen parts
const MAX_LABEL_LENGTH = 80;

/**
 * @param input  the raw array a browser posted: [{ label, trigger,
 *               percentage }], in the order the contractor wants them fired.
 * @returns {{ valid: boolean, errors: string[], stages: object[]|null }}
 *   `stages` is null when invalid — never a best-effort guess at what the
 *   contractor meant. `errors` are keys, not sentences: the API route runs
 *   them through t() so a validation message is never English-only on a
 *   screen the interface catalogue otherwise translates (app.* is EN/FR —
 *   see app/i18n/appMessages.js's own header for why only those two).
 */
export function validatePaymentScheduleInput(input) {
  const errors = [];

  if (!Array.isArray(input)) {
    return { valid: false, errors: ["not_an_array"], stages: null };
  }
  if (input.length === 0) {
    // An empty schedule is a valid REQUEST — it means "turn structured
    // billing off, go back to the free-text path" — but it's not something
    // this function builds stage rows for. The caller (the API route)
    // handles the empty case by deleting the company's template, not by
    // calling this.
    return { valid: false, errors: ["empty"], stages: null };
  }
  if (input.length > MAX_STAGES) {
    errors.push("too_many_stages");
  }

  const stages = input.map((raw, i) => {
    const label = String(raw?.label ?? "").trim().slice(0, MAX_LABEL_LENGTH);
    const trigger = String(raw?.trigger ?? "");
    const percentage = Number(raw?.percentage);

    if (!label) errors.push(`stage_${i}_label_required`);
    if (!PAYMENT_SCHEDULE_TRIGGERS.includes(trigger)) errors.push(`stage_${i}_bad_trigger`);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      errors.push(`stage_${i}_bad_percentage`);
    }

    return { seq: i, label, trigger, percentage: Number.isFinite(percentage) ? percentage : 0 };
  });

  const { valid: sumsTo100, sum } = validateSchedulePercentages(stages);
  if (!sumsTo100) {
    errors.push("percentages_must_sum_to_100");
  }

  return {
    valid: errors.length === 0,
    errors,
    stages: errors.length === 0 ? stages : null,
    sum,
  };
}
