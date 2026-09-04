// lib/sales/commissionPlanAdmin.js
//
// Dollars in a form box, cents in the column. One conversion, in one place.
//
// ══ What was missing, and what it cost ════════════════════════════════════
//
// `SalesCommissionPlan` held the only numbers that decide what FieldQuo pays a
// rep, and `salesCommissionPlan.create` appeared nowhere in the repository —
// no route, no screen, no seed. amountForMilestone() returns null without a
// plan and earnMilestone() refuses a null amount, so a rep could be invited,
// accept, claim leads, dial, and earn nothing on every milestone, with no
// screen anywhere to fix it. The rules were right and unreachable.
//
// ══ Why the browser sends DOLLARS and the server converts ═════════════════
//
// A superadmin types 20, not 2000. Somebody has to multiply, and the choice is
// which side does it:
//
//   - the screen converts and posts cents → the multiplication is in a client
//     bundle, and the route has to trust or re-derive it. Two places that can
//     disagree about a factor of 100 is how a rep gets paid $0.20.
//   - the screen posts what was typed, the ROUTE converts once, through the
//     one function below → there is exactly one multiplication, it runs on the
//     server, and scripts/check-sales-commission.mjs executes it.
//
// The second. The screen imports the same function only to say NO before the
// request goes out, so the sentence the field goes red with is literally the
// sentence the server refuses with — the discipline lib/sales/repAdmin.js
// already set for the rep form.
//
// This is not the "browser never sends money amounts" rule (non-negotiable #5)
// being bent: that rule is about CLIENT-FACING pricing, where the browser
// must never be able to name a price the server then honours. Here the amount
// IS the superadmin's decision — it is what the form is for — and the server
// still refuses anything it cannot parse, bound and round exactly.
//
// ══ Why zero is refused ═══════════════════════════════════════════════════
//
// earnMilestone() writes nothing for a non-positive amount. So a milestone set
// to $0 would look like a decision on the screen and behave, in the ledger and
// in the funnel on /platform/sales/performance, exactly like a rep with no
// plan at all: no row, no trace, an unexplained hole in stage 2 or 3. That is
// the dead-control failure this codebase is swept for, so the save refuses and
// says why. A plan that deliberately pays for only some milestones needs a
// product decision (an explicit "not paid" state that the ledger can record),
// not a zero that reads as one.
import { blankNumberMessage, numberOrNull } from "@/lib/platform/numericField";

/**
 * The money columns, and which milestone each one pays.
 *
 * `milestone` is not decoration: it is asserted against amountForMilestone()
 * in scripts/check-sales-commission.mjs, so a form box labelled "activation"
 * cannot end up writing the column that pays retention. That mistake is
 * invisible on screen and only shows up as the wrong figure in somebody's
 * payout.
 *
 * `label` is the FORM field's label, used in refusal sentences. The milestone's
 * human name ("Activated", "Renewed", "Still paying") is MILESTONE_LABELS' job
 * and is passed down from the route, so no screen invents a second vocabulary.
 */
export const PLAN_MONEY_FIELDS = [
  {
    key: "activationCents",
    dollarKey: "activation",
    milestone: "activation",
    label: "Activation amount",
  },
  {
    key: "firstPaymentCents",
    dollarKey: "firstPayment",
    milestone: "first_payment",
    label: "Next billing cycle amount",
  },
  {
    key: "retentionCents",
    dollarKey: "retention",
    milestone: "retention",
    label: "Retention amount",
  },
];

export const MAX_PLAN_NAME = 80;

// A fat finger on a money field is the expensive kind. $100,000 for one
// milestone is far above anything this programme could mean and far below
// anything a legitimate edit would hit, so it is a bound rather than a policy.
export const MAX_AMOUNT_DOLLARS = 100000;

// Ten years. The lower bound is 1 because retentionDays is a WINDOW — zero
// days would earn the retention milestone the instant a subscription opened,
// which is milestone 1's job, on a trial that has not started paying.
export const MIN_RETENTION_DAYS = 1;
export const MAX_RETENTION_DAYS = 3650;

/**
 * The owner's stated terms: $20 on activation, $40 at the next billing cycle,
 * $65 at 60 days. Identical to the schema defaults, and kept here as well so
 * the screen can offer them as a one-click prefill rather than asking somebody
 * to remember three numbers — and so the check can assert that what the screen
 * offers is still what he said.
 */
export const STANDARD_PLAN = {
  name: "Standard closer plan",
  activation: "20",
  firstPayment: "40",
  retention: "65",
  retentionDays: "60",
};

/** Cents back into a form box. "2000" → "20.00". */
export function dollarsFromCents(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "";
  return (n / 100).toFixed(2);
}

/**
 * THE boundary. Dollars as typed → whole cents, or a refusal naming the field.
 *
 * Everything it refuses is a way a wrong number reaches an Int column looking
 * like a decision:
 *
 *   ""       → Number("") is 0 and 0 is finite. A cleared box is not "pays
 *              nothing"; numberOrNull is the repo's existing answer to that,
 *              and this is the fifth screen to need it.
 *   "1e3"    → parses to 1000 and nobody typing money means that.
 *   "20.005" → a third of a cent. Rounding it silently stores a number the
 *              admin did not type; refusing says which field and why.
 *   0, -5    → see the header. Nothing is written for a non-positive amount.
 *
 * @returns {{ cents: number } | { error: string }}
 */
export function centsFromDollars(value, label = "This amount") {
  const dollars = numberOrNull(value);
  if (dollars === null) return { error: blankNumberMessage(label) };
  if (typeof value === "string" && /e/i.test(value.trim())) {
    return { error: `${label} must be a plain number of dollars, like 20 or 20.50.` };
  }
  if (dollars < 0) {
    return { error: `${label} cannot be negative. A commission is paid, never charged.` };
  }
  const exact = dollars * 100;
  const cents = Math.round(exact);
  // Floating point: 20.10 * 100 is 2010.0000000000002, so the comparison has
  // to allow the representation error while still catching a real third of a
  // cent. 1e-6 of a cent is far below anything a person can type.
  if (Math.abs(exact - cents) > 1e-6) {
    return { error: `${label} is more precise than a cent. Round it to two decimal places.` };
  }
  if (cents <= 0) {
    return {
      error:
        `${label} must be more than $0. A milestone worth nothing writes no ledger row at ` +
        `all — it would look like a setting and behave exactly like a rep with no plan.`,
    };
  }
  if (cents > MAX_AMOUNT_DOLLARS * 100) {
    return { error: `${label} is above $${MAX_AMOUNT_DOLLARS.toLocaleString()}. Check the figure.` };
  }
  return { cents };
}

/**
 * The retention window, in whole days.
 *
 * @returns {{ days: number } | { error: string }}
 */
export function retentionDaysFrom(value, label = "Retention window") {
  const n = numberOrNull(value);
  if (n === null) return { error: blankNumberMessage(label) };
  if (!Number.isInteger(n)) {
    return { error: `${label} must be a whole number of days.` };
  }
  if (n < MIN_RETENTION_DAYS) {
    return {
      error:
        `${label} must be at least ${MIN_RETENTION_DAYS} day. A window of zero would pay the ` +
        `retention milestone the moment a subscription opened, which is what activation is for.`,
    };
  }
  if (n > MAX_RETENTION_DAYS) {
    return { error: `${label} is above ${MAX_RETENTION_DAYS} days. Check the figure.` };
  }
  return { days: n };
}

export function planNameProblem(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "Give the plan a name — it is what you pick from on a rep's row.";
  if (trimmed.length > MAX_PLAN_NAME) {
    return `A plan name is at most ${MAX_PLAN_NAME} characters.`;
  }
  return null;
}

/**
 * A request body → the columns to write, or one refusal sentence.
 *
 * `partial` is for PATCH: only the keys actually present are converted, so an
 * edit that renames a plan does not have to resend three amounts (and cannot
 * accidentally rewrite them with a stale copy of the form).
 *
 * @returns {{ value: object } | { error: string }}
 */
export function shapePlanInput(body = {}, { partial = false } = {}) {
  const value = {};

  const touchesName = !partial || "name" in body;
  if (touchesName) {
    const problem = planNameProblem(body.name);
    if (problem) return { error: problem };
    value.name = String(body.name).trim();
  }

  for (const field of PLAN_MONEY_FIELDS) {
    if (partial && !(field.dollarKey in body)) continue;
    const converted = centsFromDollars(body[field.dollarKey], field.label);
    if (converted.error) return { error: converted.error };
    value[field.key] = converted.cents;
  }

  if (!partial || "retentionDays" in body) {
    const window = retentionDaysFrom(body.retentionDays, "Retention window");
    if (window.error) return { error: window.error };
    value.retentionDays = window.days;
  }

  if ("active" in body) {
    if (typeof body.active !== "boolean") {
      return { error: "active must be true or false." };
    }
    value.active = body.active;
  }

  if (partial && Object.keys(value).length === 0) {
    return { error: "Nothing to change." };
  }

  return { value };
}

/**
 * The same refusal, asked by the screen before the request goes out.
 *
 * Deliberately the SAME function underneath rather than a looser client copy:
 * a form that validates one way and a server that refuses another is two rules
 * pretending to be one, and the one nobody looks at is the one that rots.
 */
export function planDraftProblem(draft = {}) {
  const shaped = shapePlanInput(draft, { partial: false });
  return shaped.error || null;
}
