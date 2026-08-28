// lib/marketing/savings.js
//
// The maths behind /savings, and every coefficient it uses, in one table.
//
// ══ What this page is, and why it is dangerous ═════════════════════════════
//
// A savings calculator is a marketing page that prints a number with a dollar
// sign on it. That is a financial claim made to a stranger, and unlike a
// feature row it cannot be checked by looking — it is checked months later,
// against the contractor's own books, by somebody who has already paid us. An
// inflated total is therefore the most expensive kind of dead control this
// repo sweeps for: it does not merely fail to work, it argues.
//
// So the rules this file is built to, in order:
//
//   1. Every line item traces to a mechanism that EXISTS. The proof path is
//      carried beside the sentence, the same way lib/marketing/featureMatrix.js
//      carries one, because a saving attributed to something we do not ship is
//      a lie with arithmetic on top.
//   2. Every coefficient is a row in ASSUMPTIONS — a name, a value, what it
//      represents, and the reasoning for that value. There is no number inside
//      a formula. A magic number in a total is an assertion nobody can argue
//      with, which is the opposite of what this page should invite.
//   3. Every judgement is biased LOW. Where a range was arguable the bottom of
//      it was taken. A contractor who times their own admin week and finds our
//      figure conservative believes the rest of the page; one who finds it
//      generous stops believing all of it, including the parts that are true.
//   4. Absence is not zero and not a default. A question the visitor has not
//      answered produces no line, with the reason printed — AGENTS.md failure
//      class 5. The one input we could plausibly have defaulted (which tools
//      they use today) changes two coefficients, so defaulting it would be
//      inventing the answer to the question that moves the total most.
//   5. The total is held to the revenue the visitor typed in. A tool that
//      claims to save a business more than it turns over has stopped
//      describing that business.
//
// ══ Two line items a competitor's calculator has, and this one does not ════
//
// The shape of this page was taken from a competitor's; the substance was not.
// Two of their four line items price mechanisms FieldQuo does not have, and
// featureMatrix.js is the record of that: it lists what we ship, and neither is
// in it. Porting their formula would have advertised two features we cannot
// deliver, at a precise annual figure, on a page a buyer reads before paying.
// The shape is fair game. The line items had to be built from our own
// mechanisms, and there are three of them.
//
// ══ Cash flow is not profit, and a won job is not its price ════════════════
//
// Two errors are easy to make here and both inflate a total enormously.
// Getting money sooner is worth the COST of the money for the days saved, not
// the money itself; and a job you would otherwise not have won is worth its
// margin, not its invoice. Both are handled explicitly below, and both are the
// reason our totals are smaller than a competitor's on the same inputs.

import {
  SEAT_LADDER,
  tierFor,
  defaultAnnualPrice,
  ANNUAL_FREE_MONTHS,
} from "@/lib/pricing/ladder";

/* ═══════════════════════════════════════════════════════════════════════════
   The assumptions
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Where a number came from. Printed beside every row, because "52 weeks in a
 * year" and "three quotes in a hundred come back if you chase them" are not
 * the same kind of claim and a table that prints them identically is hiding
 * the only distinction a reader cares about.
 *
 *   arithmetic  a definition. There is nothing to disagree with.
 *   product     read off FieldQuo's own code or price list. Checkable by us.
 *   estimate    a judgement we cannot measure. Biased low on purpose, and the
 *               reasoning says which way it is biased and why.
 */
export const ASSUMPTION_BASIS = Object.freeze(["arithmetic", "product", "estimate"]);

/**
 * Every coefficient in this file.
 *
 * `display` is what the workings print. It is validated against `value` at
 * module load (see validateAssumptions) rather than trusted, because a share
 * whose label says 30% and whose value is 0.25 is a lie that survives every
 * review — the label is what a reader checks and the value is what the total
 * uses.
 */
const ASSUMPTION_ROWS = [
  {
    key: "tools_paper_admin_share",
    label: "Admin time reclaimed — paper and spreadsheets today",
    value: 0.25,
    unit: "share",
    display: "25%",
    represents:
      "The share of the office hours you told us about that stop existing when quoting, scheduling and invoicing are one system instead of three places you re-type into.",
    reasoning:
      "An approved quote becomes the invoice without anyone re-keying it, and the job carries its own schedule — so the copying between the pad, the calendar and the invoice book goes away. The rest of an admin week does not: phone calls, chasing materials, answering clients. One hour in four of what you reported is a judgement, not a stopwatch reading, and it is set at the low end so that a contractor who times their own week finds it modest.",
    basis: "estimate",
  },
  {
    key: "tools_apps_admin_share",
    label: "Admin time reclaimed — separate apps today",
    value: 0.15,
    unit: "share",
    display: "15%",
    represents:
      "The same share, for a business already running a few apps that do not talk to each other.",
    reasoning:
      "You have already bought back the worst of it. What is left is the copying between apps, which is less than the copying from paper — so this is deliberately well under the figure above rather than a token reduction.",
    basis: "estimate",
  },
  {
    key: "tools_paper_invoice_days",
    label: "Days sooner the invoice is raised — paper and spreadsheets today",
    value: 5,
    unit: "days",
    display: "5 days",
    represents:
      "How much earlier the invoice goes out when it is built from the approved quote the moment the client approves, rather than written up when someone next sits down with the paperwork.",
    reasoning:
      "This is about when the invoice is RAISED, not how the client pays it. A paperwork evening that happens about weekly means an average job waits several days for its invoice; five is under half a week and ignores the jobs that wait a fortnight.",
    basis: "estimate",
  },
  {
    key: "tools_apps_invoice_days",
    label: "Days sooner the invoice is raised — separate apps today",
    value: 3,
    unit: "days",
    display: "3 days",
    represents: "The same, for a business already invoicing from an app.",
    reasoning:
      "An app you already have shortens this but does not remove it, because the invoice still has to be typed from the quote by hand. Three days is the conservative end.",
    basis: "estimate",
  },
  {
    key: "cost_of_money",
    label: "What waiting for your money costs, a year",
    value: 0.08,
    unit: "share",
    display: "8%",
    represents:
      "The annual cost of not having money you have earned — what you pay to borrow it, or what it would have earned working.",
    reasoning:
      "We do not know what you borrow at. Eight per cent is at the bottom of what a small trades business pays for operating credit; an overdraft or a card costs several times that, and a business that is never short of cash values it at less. We would rather be under for everyone than right for some.",
    basis: "estimate",
  },
  {
    key: "quote_recovery_share",
    label: "Quotes that went quiet and come back when chased",
    value: 0.03,
    unit: "share",
    display: "3%",
    represents:
      "Of the quotes you send that do not turn into work, the share that turns into work anyway once a scheduled follow-up chases them for you.",
    reasoning:
      "We have no measurement of this and will not pretend otherwise. Three in a hundred is set low enough that it does not carry the total: on a typical set of answers this is the smallest of the three lines. If chasing quotes were worth ten times this to you, this page would still not say so.",
    basis: "estimate",
  },
  {
    key: "gross_margin",
    label: "The share of a job that is actually yours",
    value: 0.3,
    unit: "share",
    display: "30%",
    represents:
      "What is left of a job's price after the materials and the labour to do it.",
    reasoning:
      "A job you win is not money in your pocket — you have to do it. Counting a recovered job at its full invoice value is the single biggest way a calculator like this inflates a total, so the recovered work above is counted at margin only. Thirty per cent is a conservative figure for trades where materials and labour dominate; if you know your own, it is the number to substitute.",
    basis: "estimate",
  },
  {
    key: "weeks_per_year",
    label: "Weeks in a year",
    value: 52,
    unit: "count",
    display: "52",
    represents: "Turning a weekly figure into an annual one.",
    reasoning:
      "A definition. It is not discounted for holidays, which would cut the admin line by a few per cent — the hours you gave us are a typical week, and pretending you take five weeks off is as much an invention as pretending you take none.",
    basis: "arithmetic",
  },
  {
    key: "months_per_year",
    label: "Months in a year",
    value: 12,
    unit: "count",
    display: "12",
    represents: "Turning a monthly figure into an annual one.",
    reasoning:
      "A definition. The jobs figure you gave us is treated as a typical month and repeated twelve times; a seasonal trade has a busy half and a quiet one, and we have no way to ask about that without turning seven questions into twenty.",
    basis: "arithmetic",
  },
  {
    key: "days_per_year",
    label: "Days in a year",
    value: 365,
    unit: "count",
    display: "365",
    represents: "Turning a cost of money per year into a cost per day waited.",
    reasoning:
      "A definition. Calendar days rather than working days, which is the conservative choice here: counting only working days would make each day of waiting worth about forty per cent more.",
    basis: "arithmetic",
  },
];

export const ASSUMPTIONS = Object.freeze(ASSUMPTION_ROWS.map((r) => Object.freeze({ ...r })));

const ASSUMPTION_INDEX = new Map(ASSUMPTIONS.map((r) => [r.key, r]));

/**
 * The row, or a throw.
 *
 * Throwing rather than returning zero is deliberate: a mistyped key that
 * silently reads as nothing would quietly delete a line item from a total and
 * the page would still render a confident figure. A page that fails to build
 * is a better outcome than a page that under-claims for a reason nobody can
 * see — and this is the same argument the check script makes from outside.
 */
export function assumptionRow(key) {
  const row = ASSUMPTION_INDEX.get(key);
  if (!row) throw new Error(`savings: no assumption named "${key}"`);
  return row;
}

/** The value alone. Every coefficient in every formula below arrives here. */
const A = (key) => assumptionRow(key).value;

/**
 * The table checks itself at load.
 *
 * Two failures this catches that review does not: a share whose printed label
 * has drifted from its value, and a row with no reasoning — which is a magic
 * number that has been given a name and nothing else.
 */
export function validateAssumptions() {
  const problems = [];
  const seen = new Set();
  for (const row of ASSUMPTIONS) {
    if (seen.has(row.key)) problems.push(`duplicate assumption "${row.key}"`);
    seen.add(row.key);
    if (!Number.isFinite(row.value)) problems.push(`${row.key}: value is not a number`);
    if (!ASSUMPTION_BASIS.includes(row.basis)) problems.push(`${row.key}: unknown basis`);
    if (!row.represents || !row.reasoning) problems.push(`${row.key}: missing reasoning`);
    if (row.unit === "share") {
      const expected = `${Math.round(row.value * 100)}%`;
      if (row.display !== expected) {
        problems.push(`${row.key}: display "${row.display}" is not ${expected}`);
      }
    }
  }
  return problems;
}

{
  const problems = validateAssumptions();
  if (problems.length) throw new Error(`savings assumptions: ${problems.join("; ")}`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   The questions
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * What we ask, and the bounds each answer has to fall inside.
 *
 * ══ Why an out-of-range answer is refused rather than clamped ══════════════
 *
 * Clamping 300 admin hours a week to 168 substitutes a number the visitor did
 * not give and then prints a total built on it. Every bound below is either a
 * fact (a week has 168 hours) or a limit past which the answer is certainly a
 * typo, and in both cases the honest response is to say the answer cannot be
 * read — not to quietly answer a different question.
 *
 * `seats` and `crew` are asked separately because that is the distinction the
 * price list is built on (see SEAT_LADDER): crew are free, and a business that
 * reports its whole headcount as seats is quoted a tier it does not need.
 */
export const INPUT_FIELDS = Object.freeze([
  Object.freeze({
    key: "seats",
    kind: "number",
    required: true,
    min: 0,
    max: 500,
    label: "People who write quotes, jobs or invoices",
    help: "Anyone in the office or on the road who creates or changes the paperwork. This is what a plan is priced on.",
  }),
  Object.freeze({
    key: "crew",
    kind: "number",
    required: true,
    min: 0,
    max: 2000,
    label: "People in the field who just need their schedule",
    help: "They see their work, clock in and upload photos. They are included free on every plan, so this changes the price only by deciding which plan fits.",
  }),
  Object.freeze({
    key: "projectsPerMonth",
    kind: "number",
    required: true,
    min: 0,
    max: 2000,
    label: "Jobs you finish in a month",
    help: "Completed work, not enquiries.",
  }),
  Object.freeze({
    key: "averageProjectValue",
    kind: "number",
    required: true,
    min: 0,
    max: 5000000,
    label: "What an average job invoices for",
    help: "Before tax.",
  }),
  Object.freeze({
    key: "adminHoursPerWeek",
    kind: "number",
    required: true,
    min: 0,
    max: 168,
    label: "Hours a week the office spends on quoting, scheduling and invoicing",
    help: "Everyone's hours added together, in a typical week.",
  }),
  Object.freeze({
    key: "hourlyCost",
    kind: "number",
    required: true,
    min: 0,
    max: 1000,
    label: "What an hour of that time costs you",
    help: "Wage plus what you carry on top of it. If it is your own time, what you would bill that hour at.",
  }),
  Object.freeze({
    key: "tools",
    kind: "choice",
    required: true,
    options: Object.freeze([
      Object.freeze({
        value: "paper",
        label: "Paper, spreadsheets and a shared calendar",
      }),
      Object.freeze({
        value: "separate_apps",
        label: "A few apps that do not talk to each other",
      }),
    ]),
    label: "How you run it today",
    help: "This moves two of the numbers below, so there is no default — the answer has to come from you.",
  }),
  Object.freeze({
    key: "quotesPerMonth",
    kind: "number",
    required: false,
    min: 0,
    max: 5000,
    label: "Quotes you send in a month",
    help: "Optional. Leave it blank and we simply will not estimate the follow-up line — we will say so rather than guess.",
  }),
]);

/**
 * One typed answer, read strictly.
 *
 * Form state is strings, so "8" has to parse. Everything else — blank, a word,
 * a boolean, an object, a number that is not finite — is ABSENT, not zero.
 * The distinction is the whole point: zero jobs a month is an answer, and no
 * answer is not.
 *
 * @returns {{state: "absent"|"out_of_range"|"ok", value: number|null}}
 */
function readNumber(raw, field) {
  if (raw === null || raw === undefined) return { state: "absent", value: null };
  if (typeof raw === "boolean") return { state: "absent", value: null };
  if (typeof raw === "object") return { state: "absent", value: null };
  const text = String(raw).trim();
  if (text === "") return { state: "absent", value: null };
  const n = Number(text);
  if (!Number.isFinite(n)) return { state: "absent", value: null };
  if (n < field.min || n > field.max) return { state: "out_of_range", value: n };
  return { state: "ok", value: n };
}

function readChoice(raw, field) {
  const text = typeof raw === "string" ? raw.trim() : "";
  const hit = field.options.find((o) => o.value === text);
  return hit ? { state: "ok", value: hit.value } : { state: "absent", value: null };
}

/** Every answer, sorted into usable, unanswered and unreadable. */
export function readInputs(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const values = {};
  const missing = [];
  const outOfRange = [];

  for (const field of INPUT_FIELDS) {
    const read =
      field.kind === "choice"
        ? readChoice(source[field.key], field)
        : readNumber(source[field.key], field);

    if (read.state === "ok") values[field.key] = read.value;
    else if (read.state === "out_of_range") outOfRange.push(field.key);
    else if (field.required) missing.push(field.key);
  }

  return { values, missing, outOfRange };
}

/* ═══════════════════════════════════════════════════════════════════════════
   The line items
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Three claims, each with the file that makes it true.
 *
 * `assumptions` lists every coefficient the builder reads. It is not
 * decoration: scripts/check-savings.mjs reads the A("...") calls straight out
 * of each builder's source and requires the two lists to match exactly, so a
 * coefficient can neither be used without being declared nor declared without
 * being used. That is also why the assumption keys are written as literals
 * inside the ternaries below rather than looked up from a map — a lookup would
 * make the coefficients invisible to the check, and an invisible coefficient
 * is the magic number this file exists to abolish.
 *
 * Every builder returns a plain amount plus the arithmetic that produced it,
 * because a number a contractor cannot reproduce on the back of an envelope is
 * a number he is being asked to take on faith.
 */
export const LINE_BUILDERS = Object.freeze([
  Object.freeze({
    key: "admin_time",
    label: "Office hours you get back",
    mechanism:
      "Quoting, scheduling and invoicing are one system. The client approves the quote and the invoice is built from it — nobody re-types the job into a second place, and nobody types it into a third to schedule it.",
    proof: [
      "lib/invoices/createInvoiceFromQuote.js",
      "app/api/invoices/route.js",
    ],
    assumptions: Object.freeze([
      "tools_paper_admin_share",
      "tools_apps_admin_share",
      "weeks_per_year",
    ]),
    build(v, fmt) {
      const share =
        v.tools === "paper" ? A("tools_paper_admin_share") : A("tools_apps_admin_share");
      const hours = v.adminHoursPerWeek * share;
      const amount = hours * A("weeks_per_year") * v.hourlyCost;
      const shareRow =
        v.tools === "paper"
          ? assumptionRow("tools_paper_admin_share")
          : assumptionRow("tools_apps_admin_share");
      return {
        amount,
        workings: `${fmt(v.adminHoursPerWeek)} hours a week × ${shareRow.display} × ${assumptionRow("weeks_per_year").display} weeks × ${fmt(v.hourlyCost)} an hour`,
      };
    },
  }),
  Object.freeze({
    key: "invoice_sooner",
    label: "What the invoice going out sooner is worth",
    mechanism:
      "The invoice exists the moment the quote is approved, rather than waiting for the evening someone does the paperwork — and an invoice that goes past its date is chased on a schedule you set, without you remembering.",
    proof: [
      "lib/invoices/createInvoiceFromQuote.js",
      "app/api/cron/follow-ups/route.js",
    ],
    assumptions: Object.freeze([
      "tools_paper_invoice_days",
      "tools_apps_invoice_days",
      "days_per_year",
      "cost_of_money",
      "months_per_year",
    ]),
    build(v, fmt) {
      const days =
        v.tools === "paper" ? A("tools_paper_invoice_days") : A("tools_apps_invoice_days");
      const revenue = v.projectsPerMonth * A("months_per_year") * v.averageProjectValue;
      const amount = revenue * (days / A("days_per_year")) * A("cost_of_money");
      const daysRow =
        v.tools === "paper"
          ? assumptionRow("tools_paper_invoice_days")
          : assumptionRow("tools_apps_invoice_days");
      return {
        amount,
        // Said in full, because this is the line most easily mistaken for found
        // money: it is the cost of the wait, not the invoice.
        workings: `${fmt(revenue)} invoiced a year, ${daysRow.display} sooner, at ${assumptionRow("cost_of_money").display} a year for the money`,
      };
    },
  }),
  Object.freeze({
    key: "quotes_chased",
    label: "Work you would not have chased",
    mechanism:
      "A quote that goes quiet gets followed up on your schedule and in your words. What comes back is counted at what it leaves you, not at what it invoices.",
    proof: [
      "app/api/cron/follow-ups/route.js",
      "app/api/settings/follow-up-rules/route.js",
    ],
    assumptions: Object.freeze([
      "months_per_year",
      "quote_recovery_share",
      "gross_margin",
    ]),
    // Only rendered when the visitor answered the optional question AND sends
    // more quotes than they win. Both silences are printed rather than filled
    // in, which is the whole reason this hangs off the builder rather than
    // being an `if` buried in the loop: a line that can be absent has to carry
    // the sentence explaining its absence, or the absence is invisible.
    omitWhen(v) {
      if (v.quotesPerMonth === undefined) {
        return "You have not told us how many quotes you send, so we have not put a number on this.";
      }
      if (v.quotesPerMonth <= v.projectsPerMonth) {
        return "You win everything you quote, on the numbers you gave us. There is nothing here to chase.";
      }
      return null;
    },
    build(v, fmt) {
      const unwonPerMonth = v.quotesPerMonth - v.projectsPerMonth;
      const unwonValue = unwonPerMonth * A("months_per_year") * v.averageProjectValue;
      const amount = unwonValue * A("quote_recovery_share") * A("gross_margin");
      return {
        amount,
        workings: `${fmt(unwonValue)} of quotes a year that did not become work × ${assumptionRow("quote_recovery_share").display} chased back × ${assumptionRow("gross_margin").display} margin`,
      };
    },
  }),
]);

/**
 * Why a line is not there.
 *
 * A missing line is printed with this sentence beside it. The alternative —
 * dropping it silently — leaves a visitor comparing two totals that were built
 * from different numbers of line items with nothing on the page saying so.
 */
function omissionFor(builder, v) {
  return typeof builder.omitWhen === "function" ? builder.omitWhen(v) : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   What we deliberately do not price
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Real features, left out of the total on purpose.
 *
 * This is the same device as MATRIX_EXCLUSIONS in featureMatrix.js and it is
 * here for the same reason: an absence that is written down is a decision, and
 * an absence that is not is an oversight waiting to be "corrected" by the next
 * person who wants the total to look better. Every one of these could be given
 * a percentage. Each percentage would be invented.
 */
export const NOT_COUNTED = Object.freeze([
  Object.freeze({
    subject: "The receptionist answering while you are up a ladder",
    reason:
      "It answers, takes the details and books the visit — but it bills by the minute on top of your plan, and we know neither how many calls you miss nor how many of them were work. Pricing it would be two guesses stacked on a cost we would have had to leave out.",
  }),
  Object.freeze({
    subject: "Clients paying by card from their phone",
    reason:
      "They can, and the money settles into your account. But card processing has a fee, and we do not know what it costs you to get paid today. Counting the speed and ignoring the fee would flatter this total in the one direction it must not be flattered.",
  }),
  Object.freeze({
    subject: "Fewer mistakes on the paperwork",
    reason:
      "An invoice built from the quote cannot be mistyped from it. How often that costs you money today is something only your books know, and a percentage from us would be a number we made up.",
  }),
  Object.freeze({
    subject: "Work your booking page and website bring in",
    reason:
      "Both are real and both are included. How much work they win depends on your area, your trade and your reputation, and none of that is in the seven answers above.",
  }),
]);

/** The note that has to sit beside the total. */
export const SAVINGS_DISCLOSURE = Object.freeze({
  headline: "These are estimates, and here is exactly what they rest on.",
  body:
    "Every figure on this page is built from the answers you typed and the coefficients in the table below — nothing is measured from your business, because we cannot see it. Where a number is a judgement rather than a definition, the table says so and says which way we biased it, which is always downwards. Two of the three lines are worth less than they look: money arriving sooner is worth the cost of waiting for it, not the money itself, and a job you win is worth its margin, not its invoice. If a line looks wrong against your own books, your books are right.",
});

/* ═══════════════════════════════════════════════════════════════════════════
   The estimate
   ═══════════════════════════════════════════════════════════════════════════ */

// Rounded DOWN, everywhere, and not just for tidiness: flooring each line means
// the printed lines always add up to the printed total, and it means every
// rounding decision on the page goes the direction that understates.
const floorAmount = (n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** Plain integer formatting. No symbol — see the currency note on the page. */
export function formatAmount(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  // A fixed locale, not the visitor's: this string is rendered on the server
  // and again in the browser, and a locale that differs between the two is a
  // hydration mismatch that shows up as flickering numbers.
  return Math.round(v).toLocaleString("en-CA", { maximumFractionDigits: 0 });
}

/**
 * What a plan for this shape of business costs.
 *
 * Read off SEAT_LADDER through tierFor, never restated. Retyping 99 here would
 * mean a repricing that updated the price list left a marketing page quoting
 * the old number beside a saving — and the saving is the number that gets
 * argued about, so nobody would notice the price.
 *
 * A roster that fits no rung returns fits:false rather than the top tier. The
 * ladder's own comment makes the argument: seating twelve people on a plan for
 * ten bills them for ten and locks two out.
 */
export function subscriptionCost({ seats, crew } = {}) {
  const tier = tierFor({ seats, crew });
  if (!tier) {
    return {
      fits: false,
      tierKey: null,
      label: null,
      monthly: 0,
      yearAtMonthly: 0,
      yearCommitted: 0,
      monthsPerYear: A("months_per_year"),
      payForMonths: A("months_per_year") - ANNUAL_FREE_MONTHS,
    };
  }
  return {
    fits: true,
    tierKey: tier.tierKey,
    label: tier.label,
    monthly: tier.price,
    yearAtMonthly: tier.price * A("months_per_year"),
    yearCommitted: defaultAnnualPrice(tier.price),
    // "Pay for ten, get twelve" is the ladder's own phrasing of its annual
    // deal, and both numbers are computed from it here so the page renders the
    // sentence without doing arithmetic of its own. A page that subtracts is a
    // second place the deal is defined.
    monthsPerYear: A("months_per_year"),
    payForMonths: A("months_per_year") - ANNUAL_FREE_MONTHS,
    includedSeats: tier.seats,
    includedCrew: tier.crewSeats,
  };
}

/** The largest business the published ladder has a price for. */
export const LADDER_CEILING = Object.freeze({
  seats: Math.max(...SEAT_LADDER.map((t) => t.seats)),
  crew: Math.max(...SEAT_LADDER.map((t) => t.crewSeats)),
});

/**
 * The whole estimate, from raw form state.
 *
 * Never throws on bad input, never returns NaN, never returns a negative or
 * infinite saving, and never returns a total larger than the revenue it was
 * given. Those four are guarantees rather than observations: they are asserted
 * against hostile input by scripts/check-savings.mjs, which is the only reason
 * to believe them.
 */
export function estimateSavings(raw) {
  const { values: v, missing, outOfRange } = readInputs(raw);

  if (missing.length || outOfRange.length) {
    return {
      ready: false,
      missing: Object.freeze([...missing]),
      outOfRange: Object.freeze([...outOfRange]),
      annualRevenue: 0,
      lines: Object.freeze([]),
      omitted: Object.freeze([]),
      total: 0,
      capped: false,
      cost: null,
      netAfterCost: null,
      paysForItself: null,
    };
  }

  const annualRevenue = floorAmount(
    v.projectsPerMonth * A("months_per_year") * v.averageProjectValue,
  );

  const lines = [];
  const omitted = [];
  for (const builder of LINE_BUILDERS) {
    const reason = omissionFor(builder, v);
    if (reason) {
      omitted.push({ key: builder.key, label: builder.label, reason });
      continue;
    }
    const built = builder.build(v, formatAmount);
    lines.push({
      key: builder.key,
      label: builder.label,
      mechanism: builder.mechanism,
      proof: builder.proof,
      assumptions: builder.assumptions,
      // Clamped at zero here rather than trusted: a builder is arithmetic over
      // numbers a stranger typed, and a negative line item would read as us
      // charging them for a feature.
      raw: Number.isFinite(built.amount) && built.amount > 0 ? built.amount : 0,
      workings: built.workings,
    });
  }

  // ── The cap ──────────────────────────────────────────────────────────────
  //
  // Held to the revenue the visitor typed. The admin line is built from hours
  // and a wage and knows nothing about turnover, so on extreme answers — a
  // one-job-a-year business with a full-time office — it alone can exceed
  // everything the business makes. A total larger than the business is not a
  // conservative estimate that needs tuning; it is a claim that has stopped
  // describing anybody, and printing it would discredit the three lines that
  // were right.
  const rawTotal = lines.reduce((sum, l) => sum + l.raw, 0);
  const capped = rawTotal > annualRevenue;
  const factor = capped && rawTotal > 0 ? annualRevenue / rawTotal : 1;

  const priced = lines.map((l) => Object.freeze({ ...l, amount: floorAmount(l.raw * factor) }));
  const total = priced.reduce((sum, l) => sum + l.amount, 0);

  const cost = subscriptionCost({ seats: v.seats, crew: v.crew });

  return {
    ready: true,
    missing: Object.freeze([]),
    outOfRange: Object.freeze([]),
    values: Object.freeze({ ...v }),
    annualRevenue,
    lines: Object.freeze(priced),
    omitted: Object.freeze(omitted.map((o) => Object.freeze(o))),
    total,
    capped,
    cost: Object.freeze(cost),
    // A year at the monthly rate, because that is what most people will pay and
    // quoting the committed rate against a year of savings would be comparing
    // our best case with their conservative one.
    //
    // Allowed to be negative, and shown when it is. A shop with two admin hours
    // a week and four small jobs a month does not get its money back on this,
    // and a calculator that cannot say so is an advertisement.
    netAfterCost: cost.fits ? total - cost.yearAtMonthly : null,
    paysForItself: cost.fits ? total > cost.yearAtMonthly : null,
  };
}
