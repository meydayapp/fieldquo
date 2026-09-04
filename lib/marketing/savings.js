// lib/marketing/savings.js
//
// The maths behind /savings, and every coefficient it uses, in one table.
//
// ══ What this page is, and what the bar actually is ════════════════════════
//
// This is marketing, and it is allowed to argue for us. The competitor whose
// shape this page borrows publishes the same thing and argues for theirs; a
// calculator that refuses to make our case is not neutral, it is just a worse
// version of the page it is sitting next to.
//
// So the bar is not timidity. The bar is TRUTH UNDER CHECKING: a contractor
// who takes any row on this page to his own books has to find it true. That
// is a harder bar than being small, and it is the only one that matters,
// because an inflated total is not merely a dead control — it is a dead
// control that argues, and it is checked months later by somebody who has
// already paid us.
//
// The rules this file is built to, in order:
//
//   1. Every line item traces to a mechanism that EXISTS. The proof path is
//      carried beside the sentence, the same way lib/marketing/featureMatrix.js
//      carries one, because a saving attributed to something we do not ship is
//      a lie with arithmetic on top.
//   2. Every coefficient is a row in ASSUMPTIONS — a name, a value, what it
//      represents, and the reasoning for that value. There is no number inside
//      a formula. A magic number in a total is an assertion nobody can argue
//      with, which is the opposite of what this page should invite.
//   3. Where a range is defensible we take the honest-but-favourable end of
//      it, not the most timid — and the reasoning says which end and why. What
//      we do NOT do is take an end nobody could defend. The two are different
//      and the table is where the difference is visible.
//   4. Absence is not zero and not a default. A question the visitor has not
//      answered produces no line, with the reason printed — AGENTS.md failure
//      class 5.
//   5. The total is held to the revenue the visitor typed in. A tool that
//      claims to save a business more than it turns over has stopped
//      describing that business.
//
// ══ The line item this page has that theirs does not ═══════════════════════
//
// Producing the quote. Their calculator does not price it at all, and it is
// probably the largest thing a contractor does that software can shorten: the
// published range for building one detailed quote is two to three hours of
// desk work, and the same job on a loaded price book is minutes. The whole
// distance between those two figures is saved rates and material recipes, a
// measurement you did not have to take by hand, and one button that sends it.
// See quote_desk_minutes_today and quote_desk_minutes_fieldquo for where each
// end came from, whose figure it is, and which end of a range was taken.
//
// Both ends of that pair moved on 2026-09-03 and this paragraph moved with
// them. It used to say "45–90 minutes… and the ones who already work from
// templates report 10–15", and it was the last place on the page still citing
// the two sources the rows themselves had dropped — a header describing a
// model that no longer existed, which is the comment-shaped version of the
// thing this whole file is built to prevent.
//
// ══ The line item that is not ours, and stays out ══════════════════════════
//
// An accounting-package sync. We do not have one. It is one of their four
// lines and porting it would have advertised, at a precise annual figure, a
// feature a buyer would go looking for on the second day. featureMatrix.js is
// the record: it lists what we ship, and that is not in it.
//
// ══ Two errors that inflate a calculator enormously ════════════════════════
//
// Getting money sooner is worth the COST of the money for the days saved, not
// the money itself; and a job you would otherwise not have won is worth its
// MARGIN, not its invoice. Both are handled explicitly below.
//
// There is a third case that looks like those two and is not, so it is worth
// saying plainly rather than leaving somebody to "fix" it later: work that has
// already been DONE and never billed is recovered at its full price, not at
// margin. The labour is spent and the materials are bought whichever way the
// invoice goes out. Discounting that to margin would not be conservative, it
// would be wrong. It is the reason under_billing and change_orders carry no
// margin coefficient and quotes_chased does.

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
 * year" and "one job in a hundred grows and never gets re-invoiced" are not
 * the same kind of claim and a table that prints them identically is hiding
 * the only distinction a reader cares about.
 *
 *   arithmetic  a definition. There is nothing to disagree with.
 *   product     read off FieldQuo's own code or price list. Checkable by us.
 *   reported    a figure contractors themselves gave, supplied to us as a
 *               range. We say it is theirs, we say what the range was, and we
 *               say which end we took. We did not run the survey and we do not
 *               claim to have.
 *   estimate    a judgement we cannot measure. The reasoning says which way it
 *               leans and what would move it.
 */
export const ASSUMPTION_BASIS = Object.freeze([
  "arithmetic",
  "product",
  "reported",
  "estimate",
]);

/**
 * Every coefficient in this file.
 *
 * `display` is what the workings print. It is validated against `value` at
 * module load (see validateAssumptions) rather than trusted, because a share
 * whose label says 30% and whose value is 0.25 is a lie that survives every
 * review — the label is what a reader checks and the value is what the total
 * uses. Every unit is checked, not just shares: "45 minutes" and "5 days" can
 * drift from their values exactly as easily as a percentage can.
 */
const ASSUMPTION_ROWS = [
  {
    // ── Now a DEFAULT rather than the driver ───────────────────────────────
    //
    // quotesPerMonth's own help says "this drives the largest line on the
    // page, so we ask rather than assume" — and the very next term in that
    // same line was assumed. The page stated the principle and broke it on the
    // neighbouring factor. There is now a question for this (quoteDeskMinutes)
    // and this row is what the arithmetic falls back to when it is left blank,
    // so an unanswered calculator still produces exactly the number it did
    // before and nothing regresses.
    key: "quote_desk_minutes_today",
    label: "Desk time an estimate takes you today, when you do not tell us",
    value: 120,
    unit: "minutes",
    display: "120 minutes",
    represents:
      "The part of producing one estimate that happens at a desk — working out the quantities, pricing them, writing the thing up and formatting it. Not the drive and not the walkthrough; those are left out of this page entirely, and the note further down says so.",
    reasoning:
      "Raised from 45, because 45 was under the published floor rather than conservative. Blaze Estimating puts the range at 120–180 minutes — most builders spend two to three hours building a single detailed quote (blazeestimating.com/how-long-does-a-construction-estimate-take). One contractor's own experience agrees with the bottom of it: FieldQuo's owner runs a cabinet business, prices jobs weekly, and puts the same work at about two hours with no travel in it at all — quantities, pricing, writing it up, sending. We take that bottom end, 120. The top of the same published range, 180, is equally reported and would make this line half again as large; taking it would be the drift this table exists to refuse. The scope of the row has not changed and travel is still excluded — only the number moved. If it is wrong for your trade, the box above this table is where you say so, and your answer replaces ours.",
    basis: "reported",
  },
  {
    key: "quote_desk_minutes_fieldquo",
    label: "Desk time the same estimate takes with a price book",
    value: 1,
    unit: "minutes",
    display: "1 minute",
    represents:
      "The same desk work, when the rates, the material quantities and the wording are already saved and the measurements did not have to be taken by hand.",
    reasoning:
      "Lowered from 15, and the reason it moved is that 15 described a different product: it cited contractors working from saved templates in OTHER software — an honest source for a weaker mechanism, and not for this one. What FieldQuo does is not a template. Your rates and material recipes are already in the price book, a roof or a lot is measured off the address rather than by hand, and one button sends it in your colours. A minute is FieldQuo's owner's figure for that path on his own jobs. Marked as OUR ESTIMATE and not as contractors' reported figures, deliberately, and the distinction is the point of this column: it is one operator's number with no range behind it, and a row that claimed a survey it does not have would be exactly the citation-shaped sentence with no citation this table refuses. Not marked as read off our own price list either — the interactions are countable and we counted them (a roofing quote is about four, because one satellite click fills the sloped area and the pitch together and the tear-off, the steep-pitch surcharge and every linear-foot detail price themselves; a staircase is about the same, because one complexity pick seeds all seven rates) — but how long four interactions take a human is not something a codebase can measure, and we are not going to dress a judgement up as a reading. Which way it leans, since that is what this basis owes you: generous. An interior painting quote still needs the dimensions of every room typed, and a countertop still needs a supplier cost per line, because stone has no rate card to default from. One number across four trades flatters the slower two, and what would move it is splitting the row per trade.",
    basis: "estimate",
  },
  {
    key: "tools_paper_admin_share",
    label: "Office time reclaimed — paper and spreadsheets today",
    value: 0.3,
    unit: "share",
    display: "30%",
    represents:
      "The share of the remaining office hours you told us about — scheduling, invoicing and chasing the paperwork, NOT writing quotes — that stops existing when it is one system instead of three places you re-type into.",
    reasoning:
      "Raised from a quarter, and only because the question underneath it changed: writing quotes is now its own line and has been taken out of the hours you report here. What is left is the part we remove hardest — an approved quote becomes the invoice with nobody re-keying it, and the job carries its own schedule — so it is a larger fraction of a smaller number. It is still not everything: the phone calls, the chasing of materials and the answering of clients are in there and they do not go away.",
    basis: "estimate",
  },
  {
    key: "tools_apps_admin_share",
    label: "Office time reclaimed — separate apps today",
    value: 0.2,
    unit: "share",
    display: "20%",
    represents:
      "The same share, for a business already running a few apps that do not talk to each other.",
    reasoning:
      "You have already bought back the worst of it. What is left is the copying between apps, which is less than the copying from paper — so this stays well under the figure above rather than being a token reduction, and it moved by the same amount for the same reason.",
    basis: "estimate",
  },
  {
    key: "under_billing_paper_share",
    label: "Work you did and did not charge for — paper and spreadsheets today",
    value: 0.012,
    unit: "share",
    display: "1.2%",
    represents:
      "The share of a year's work that was inside the job you agreed, was done, and never made it onto the invoice: a line item dropped when the invoice was typed up from memory, a material run nobody put against the job, hours nobody logged, the wrong tax rate for where the work was.",
    reasoning:
      "The comparison this page sits beside puts this at 1.8% of a year for a business on paper. We are not in a position to verify their figure and we do not need to: what we can defend is the part of it our own mechanism reaches. The invoice is generated from the approved quote rather than re-keyed, which removes the commonest error outright; costing runs against the quoted price so work that ran over is visible before the invoice goes rather than after; materials and hours land against the job that incurred them; the tax comes from the service address. That is most of the list but not all of it, and none of it makes anybody log an hour they chose not to log — so this is set at two thirds of the figure the comparison rests on rather than matching it.",
    basis: "estimate",
  },
  {
    key: "under_billing_apps_share",
    label: "Work you did and did not charge for — separate apps today",
    value: 0.006,
    unit: "share",
    display: "0.6%",
    represents:
      "The same, for a business already invoicing from an app.",
    reasoning:
      "Half the figure above, on the same reasoning that halves it in the comparison: an app already catches some of this. The re-keying between the quote app and the invoice app is what it does not catch, and that is the step this removes.",
    basis: "estimate",
  },
  {
    key: "change_order_paper_share",
    label: "Extras agreed on site and never invoiced — paper today",
    value: 0.014,
    unit: "share",
    display: "1.4%",
    represents:
      "The share of a year's work that is extra the client ASKED FOR after the price was agreed — the scope grew — which was done and never added to the bill.",
    reasoning:
      "This is not the row above and the two must not be read as one: that one is work already inside the job that fell off the invoice, this one is work the job did not originally contain. Extras go unbilled because at the moment they are agreed the paperwork is already out, and redoing it feels like a bigger job than eating the cost. Amending an invoice here takes about a minute from a phone, keeps the original version, and records the reason and the person — so the reason it goes unwritten is the reason that is removed. The comparison puts this at 2% of a year; ours is set near seventy per cent of that, because a fast amendment removes the excuse but still needs somebody to open it.",
    basis: "estimate",
  },
  {
    key: "change_order_apps_share",
    label: "Extras agreed on site and never invoiced — separate apps today",
    value: 0.009,
    unit: "share",
    display: "0.9%",
    represents: "The same, for a business already invoicing from an app.",
    reasoning:
      "Lower for the same reason as the row above and by the same proportion against the comparison's own 1.25%: an app makes a second invoice easier than a duplicate book does. What it does not do is keep the first version beside the second, which is the part that stops the conversation about what was agreed.",
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
    value: 0.04,
    unit: "share",
    display: "4%",
    represents:
      "Of the quotes you send that do not turn into work, the share that turns into work anyway once a scheduled follow-up chases them for you.",
    reasoning:
      "We have no measurement of this and will not pretend otherwise. Raised from three in a hundred to four, deliberately: a sequence that fires on its own schedule and never forgets is a different thing from a contractor who means to ring back and does not. Four is still below every figure published for follow-up sequences that we are aware of and would not cite without having read, and what comes back is counted at margin, which is what keeps this line from carrying the total.",
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
      "A job you have not yet won is not money in your pocket — you still have to do it. Counting a recovered job at its full invoice value is the single biggest way a calculator like this inflates a total, so recovered work is counted at margin only. Note that this coefficient does NOT apply to work already done and never billed: there the cost is already spent, so recovering the bill recovers all of it. Thirty per cent is conservative for trades where materials and labour dominate; if you know your own, it is the number to substitute.",
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
      "A definition. It is not discounted for holidays, which would cut the office-hours line by a few per cent — the hours you gave us are a typical week, and pretending you take five weeks off is as much an invention as pretending you take none.",
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
      "A definition. The jobs and quotes figures you gave us are treated as a typical month and repeated twelve times; a seasonal trade has a busy half and a quiet one, and we have no way to ask about that without turning the questions above into twenty.",
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
  {
    key: "minutes_per_hour",
    label: "Minutes in an hour",
    value: 60,
    unit: "count",
    display: "60",
    represents:
      "Turning minutes saved on a quote into a share of the hourly cost you told us about.",
    reasoning:
      "A definition. It is here rather than written into the formula because a bare 60 inside a multiplication is indistinguishable from a coefficient somebody chose, and this file's whole argument is that you can tell the difference by looking at the table.",
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
 * What a share prints as.
 *
 * Two decimals, trailing zeros trimmed, so 0.012 is "1.2%" and 0.3 is "30%".
 * The naive Math.round(v * 100) that was here before this file grew fractional
 * shares would have printed 1.2% and 0.6% both as "1%", and the display check
 * below would have happily agreed with itself while the page told two
 * different businesses the same number.
 */
const sharePercent = (value) => `${Number((value * 100).toFixed(2))}%`;

/**
 * "1 minute", "120 minutes", "5 days", "30%".
 *
 * Not cosmetic. quote_desk_minutes_fieldquo is ONE, and validateAssumptions
 * compares `display` against `value` at module load — so an unpluralised
 * `${value} minutes` leaves exactly two options, both bad: print "1 minutes"
 * at a stranger, or write "1 minute" into display and have the validator
 * reject the row that is actually correct. The same pair of digits reaches the
 * page through the table, through the validator and through the quote line's
 * workings, so all three go through one function rather than three templates
 * that agree until one of them is edited.
 *
 * Returns null for a unit nobody has taught it, which is what makes the
 * validator's "unknown unit" branch reachable instead of decorative.
 */
const UNIT_WORDS = { minutes: ["minute", "minutes"], days: ["day", "days"] };

export function unitLabel(value, unit) {
  if (unit === "share") return sharePercent(value);
  if (unit === "count") return String(value);
  const words = UNIT_WORDS[unit];
  if (!words) return null;
  return `${value} ${value === 1 ? words[0] : words[1]}`;
}

/**
 * The table checks itself at load.
 *
 * Three failures this catches that review does not: a share whose printed
 * label has drifted from its value, the same drift in a minutes or days row —
 * "45 minutes" is exactly as easy to leave behind as a percentage — and a row
 * with no reasoning, which is a magic number that has been given a name and
 * nothing else.
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

    const expected = unitLabel(row.value, row.unit);
    if (expected === null) problems.push(`${row.key}: unknown unit "${row.unit}"`);
    else if (row.display !== expected) {
      problems.push(`${row.key}: display "${row.display}" is not ${expected}`);
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
 * ══ Why quotes a month is no longer optional ═══════════════════════════════
 *
 * It used to be, and the largest thing this page can honestly claim was
 * therefore missing from most totals. Producing quotes is the biggest block of
 * desk work software can shorten, and it is a number every contractor knows
 * about his own business. Asking it is a better trade than defaulting it, and
 * defaulting it was never available: a default here would invent the answer to
 * the question that now moves the total most.
 *
 * ══ Why office hours EXCLUDE quote writing ═════════════════════════════════
 *
 * Because the quote line prices it, and a question that says "quoting,
 * scheduling and invoicing" while a separate line prices the quoting counts
 * the same hour twice. The label and the help text both say so, and the two
 * builders read disjoint inputs so that nobody can re-merge them by accident.
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
    key: "quotesPerMonth",
    kind: "number",
    required: true,
    min: 0,
    max: 5000,
    label: "Quotes you send in a month",
    help: "All of them, won or not. This drives the largest line on the page, so we ask rather than assume.",
  }),
  Object.freeze({
    // ── The first OPTIONAL question on this page ───────────────────────────
    //
    // quotesPerMonth, directly above, says "this drives the largest line on
    // the page, so we ask rather than assume". The very next factor in that
    // same line — the minutes — was assumed. The page stated its own principle
    // and broke it on the neighbouring term, and the owner found it by trying
    // to type his own figure and having nowhere to put it.
    //
    // Optional rather than required, and that is the whole design: a blank
    // falls back to quote_desk_minutes_today, so the calculator still produces
    // a complete estimate for somebody who does not know their own number.
    // That is NOT "padding absent data with a default" in the sense AGENTS.md
    // forbids — the fallback is a published row in the table below, printed
    // with its provenance, and the workings say which of the two produced the
    // figure. An invented default is one nobody can see; this one is on the
    // page with its reasoning beside it.
    key: "quoteDeskMinutes",
    kind: "number",
    required: false,
    min: 0,
    max: 480,
    label: "How long one quote takes you today, in minutes",
    help: "Working out the quantities, pricing them, writing it up and sending it. NOT the drive and not the walk round the job — those are left out of this page altogether, deliberately. Leave it blank and we use the figure in the table below instead, and the workings will say we did.",
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
    // The unit belongs on the box that asks for money, not only in a note
    // further down the page. See CURRENCY_NOTE.
    help: "Before tax. In whichever money you invoice in — we do not convert.",
    money: true,
  }),
  Object.freeze({
    key: "adminHoursPerWeek",
    kind: "number",
    required: true,
    min: 0,
    max: 168,
    label: "Hours a week the office spends on scheduling, invoicing and chasing paperwork",
    help: "Not the time spent writing quotes — that is the question above, and counting it here as well would count the same hour twice. Everyone's hours added together, in a typical week.",
  }),
  Object.freeze({
    key: "hourlyCost",
    kind: "number",
    required: true,
    min: 0,
    max: 1000,
    label: "What an hour of that time costs you",
    help: "Wage plus what you carry on top of it. If it is your own time — and writing quotes usually is — what you would bill that hour at. In whichever money you invoice in — we do not convert.",
    money: true,
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
    help: "This moves four of the numbers below, so there is no default — the answer has to come from you.",
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
 * Six claims, each with the files that make it true.
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
 * Ordered strongest first. The quote line leads because it is the one a
 * contractor can check against his own afternoon, and because their calculator
 * does not have it.
 *
 * Every builder returns a plain amount plus the arithmetic that produced it,
 * because a number a contractor cannot reproduce on the back of an envelope is
 * a number he is being asked to take on faith.
 */
export const LINE_BUILDERS = Object.freeze([
  Object.freeze({
    key: "quote_writing",
    label: "The time it takes to price a job",
    // ── "three price options come off one build" was removed, and why ──────
    //
    // It was in this sentence and app/api/quotes/tier-group/route.js was in
    // the proof list under it, and the file is real and does what it says. It
    // is also UNREACHABLE: scripts/check-route-callers.mjs lists that route
    // and its read side under NO_FRONT_DOOR — "no screen creates or shows a
    // trio… blocked on a product decision about how three quotes reach one
    // homeowner". So no contractor can do the thing this line was billing them
    // time for.
    //
    // That is the dead-control rule in its marketing form, and the proof list
    // could not catch it: every assertion under it asks whether the file
    // exists and still contains the mechanism, and both were true. A route
    // with no caller passes every test except being usable.
    mechanism:
      "Your rates and your material quantities are already in the system, the roof or the driveway can be measured from the address instead of by hand, and one button sends it in your colours. What is left is deciding what is in the job — which is your work, not typing.",
    proof: [
      "app/api/products/route.js",
      "app/api/settings/material-recipes/route.js",
      "app/api/measure/roof/route.js",
      "app/api/quotes/[id]/send/route.js",
    ],
    assumptions: Object.freeze([
      "quote_desk_minutes_today",
      "quote_desk_minutes_fieldquo",
      "minutes_per_hour",
      "months_per_year",
    ]),
    omitWhen(v) {
      if (v.quotesPerMonth === 0) {
        return "You told us you send no quotes in a month, so there is no quote-writing time here to shorten.";
      }
      // An answered figure at or below our own produces a negative saving.
      // estimateSavings would clamp it to zero and the workings would still
      // print "−3 minutes saved on each", which is a line arguing against
      // itself. Refused with the reason instead: a contractor who is already
      // that fast is telling us this line does not apply to him, and the page
      // should agree with him rather than quietly show nothing.
      if (
        Number.isFinite(v.quoteDeskMinutes) &&
        v.quoteDeskMinutes <= A("quote_desk_minutes_fieldquo")
      ) {
        return `You told us a quote takes you ${formatAmount(v.quoteDeskMinutes)} minutes, which is already at or under what it takes here, so there is nothing on this line for us to claim.`;
      }
      return null;
    },
    build(v, fmt) {
      // The visitor's own figure when they gave one, the published row when
      // they did not — and the workings SAY which, because a total built on
      // our number and a total built on theirs are different claims and a
      // reader has to be able to tell them apart.
      const answered = Number.isFinite(v.quoteDeskMinutes);
      const today = answered ? v.quoteDeskMinutes : A("quote_desk_minutes_today");
      const saved = today - A("quote_desk_minutes_fieldquo");
      const quotesPerYear = v.quotesPerMonth * A("months_per_year");
      const amount = (quotesPerYear * saved * v.hourlyCost) / A("minutes_per_hour");
      const source = answered
        ? `${unitLabel(today, "minutes")} is the figure you gave us`
        : `${assumptionRow("quote_desk_minutes_today").display} of desk work today is our figure, because you left the box blank`;
      return {
        amount,
        workings: `${fmt(v.quotesPerMonth)} quotes a month × ${assumptionRow("months_per_year").display} months × ${unitLabel(saved, "minutes")} saved on each (${source}; ${assumptionRow("quote_desk_minutes_fieldquo").display} from a price book) × ${fmt(v.hourlyCost)} an hour`,
      };
    },
  }),
  Object.freeze({
    key: "under_billing",
    label: "Work you did and did not charge for",
    mechanism:
      "The invoice is generated from the quote the client approved rather than re-typed from memory, so a line item cannot go missing between the two. What the job actually cost in labour, materials and expenses is set against what you quoted before the invoice goes out, not discovered afterwards. Hours land against the job that incurred them, materials are recorded on the job rather than in a glovebox, and the tax rate comes from the address the work was at.",
    proof: [
      "lib/invoices/createInvoiceFromQuote.js",
      "app/api/jobs/[id]/costing/route.js",
      "app/api/jobs/[id]/materials/route.js",
      "app/api/time-entries/[id]/route.js",
      "lib/tax/documentTax.js",
    ],
    assumptions: Object.freeze([
      "under_billing_paper_share",
      "under_billing_apps_share",
      "months_per_year",
    ]),
    build(v, fmt) {
      const share =
        v.tools === "paper"
          ? A("under_billing_paper_share")
          : A("under_billing_apps_share");
      const revenue = v.projectsPerMonth * A("months_per_year") * v.averageProjectValue;
      const amount = revenue * share;
      const shareRow =
        v.tools === "paper"
          ? assumptionRow("under_billing_paper_share")
          : assumptionRow("under_billing_apps_share");
      // Full value, not margin, and the sentence says why: the work is already
      // done, so there is no cost left to net off.
      return {
        amount,
        workings: `${fmt(revenue)} invoiced a year × ${shareRow.display} of it done and never charged — recovered whole, because the labour and the materials are already spent`,
      };
    },
  }),
  Object.freeze({
    key: "change_orders",
    label: "Extras the client asked for and never got billed",
    mechanism:
      "The client adds something while you are standing there and the invoice is already out. Amending it takes about a minute from your phone: the original version is kept, the new one records what changed and who changed it, and there is no argument later about what was agreed. The reason extras go unwritten is that redoing the paperwork feels bigger than eating the cost — that is the reason this removes.",
    proof: [
      "app/api/invoices/[id]/route.js",
      "app/api/invoices/[id]/lifecycle/route.js",
    ],
    assumptions: Object.freeze([
      "change_order_paper_share",
      "change_order_apps_share",
      "months_per_year",
    ]),
    build(v, fmt) {
      const share =
        v.tools === "paper"
          ? A("change_order_paper_share")
          : A("change_order_apps_share");
      const revenue = v.projectsPerMonth * A("months_per_year") * v.averageProjectValue;
      const amount = revenue * share;
      const shareRow =
        v.tools === "paper"
          ? assumptionRow("change_order_paper_share")
          : assumptionRow("change_order_apps_share");
      return {
        amount,
        workings: `${fmt(revenue)} invoiced a year × ${shareRow.display} of it in extras that were agreed, done, and never added to the bill`,
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
    // Rendered only when the visitor sends more quotes than they win. That
    // silence is printed rather than filled in, which is why it hangs off the
    // builder rather than being an `if` buried in the loop: a line that can be
    // absent has to carry the sentence explaining its absence, or the absence
    // is invisible.
    omitWhen(v) {
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
        workings: `${fmt(unwonValue)} of quotes a year that did not become work × ${assumptionRow("quote_recovery_share").display} chased back × ${assumptionRow("gross_margin").display} margin, because you still have to do the job`,
      };
    },
  }),
  Object.freeze({
    key: "admin_time",
    label: "Office hours you get back",
    mechanism:
      "Scheduling and invoicing are the same system as the quote. The client approves and the invoice is built from it — nobody re-types the job into a second place, and nobody types it into a third to put it in the calendar.",
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
 *
 * This section is also what makes the six lines above believable. Deleting it
 * to make the page shorter would cost more than it saved.
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
    subject: "The drive out and the walk round the job",
    reason:
      "The quote line above counts only the desk work — the measuring up, the pricing, the writing and the sending. Getting there and looking at the work is most of a visit and we do not remove it, so it is not in the total. A calculator that counted the drive would be counting time you are still going to spend.",
  }),
  Object.freeze({
    subject: "Fewer arguments about what was agreed",
    reason:
      "Every version of an invoice is kept with the reason it changed and the name against it. What that is worth the day a client disputes one is real and we cannot put a figure on it, so we have not.",
  }),
  Object.freeze({
    subject: "Work your booking page and website bring in",
    reason:
      "Both are real and both are included. How much work they win depends on your area, your trade and your reputation, and none of that is in the answers above.",
  }),
]);

/**
 * The one thing worth saying beside the total that is not a line item.
 *
 * It is not priced, because pricing it would mean guessing how many calls you
 * take. It is here because "included" and "included if you pay more" are the
 * distinction a buyer is actually shopping on, and it is a distinction we can
 * state as a fact about our own price list rather than a claim about anybody
 * else's.
 *
 * The last sentence is the honest half and stays: talk time is bought by the
 * minute. Saying "AI is included" without it would be the flattering kind of
 * true.
 */
export const AI_WITHOUT_AN_UPGRADE = Object.freeze({
  headline: "The AI is not a bigger plan.",
  body:
    "Quote review before you send, and asking questions about your own numbers in plain English, are on every plan including the smallest one — there is no tier to move up to for them. The phone assistant and the texting are the ones you pay for as you use them, by the minute and by the message, and they still do not need a bigger plan. None of that is in the figures above, because we would have to guess how many calls you take.",
  proof: ["app/api/quotes/[id]/review/route.js", "app/api/ai/copilot/route.js"],
});

/**
 * What money every figure on this page is in.
 *
 * ══ Why the numbers are printed bare, and why that needs a sentence ════════
 *
 * formatAmount() emits no symbol on purpose: this page cannot know what money
 * a visitor thinks in, /pricing removed its IP geo read deliberately, and a
 * guess that picks a symbol is a guess that names a price in a currency. The
 * decision is right and it is recorded in three places in the code.
 *
 * It was recorded NOWHERE a visitor could see. The owner read his own page and
 * hit exactly that: the calculator asks "what an hour of that time costs you"
 * with no unit beside it, prints the assumption table with no unit beside it,
 * and said nothing about currency at all until an estimate had been produced —
 * by which point the reader has already typed money into two boxes without
 * being told which money. A correct decision that only exists in a comment is
 * not a decision the reader was given.
 *
 * ══ One string, because there were already two ═════════════════════════════
 *
 * SavingsCalculator carried its own hand-written version of this paragraph
 * under the total, and /pricing carries pricingPage.currencyBasis. Two
 * wordings of one policy is how they drift — the /pricing one already had the
 * concrete half ("Canadian companies are billed in Canadian dollars, US
 * companies in US dollars") that the calculator's did not. This is that
 * wording, extended to say the same thing about the visitor's OWN figures
 * rather than only about ours, and it is exported so the page has one place to
 * render it from and the check has one place to read it.
 *
 * Not a t() key: this whole page is English-only (see the header of
 * app/(marketing)/savings/page.js), and a single translated sentence inside an
 * English calculator is the half-translation failure, not a step toward
 * fixing it.
 */
export const CURRENCY_NOTE = Object.freeze({
  // Short enough to sit under a form field.
  short:
    "Answer in whichever money you invoice in. We do not convert, and every " +
    "figure below stays in the money you typed.",
  long:
    "Type your own money and read the answers back in it: this page does no " +
    "conversion and prints no symbol, because it has no way of knowing which " +
    "one you use and will not guess from where you are sitting. One set of " +
    "prices, too — which money you are billed in comes from the business " +
    "address you give when you sign up: Canadian companies in Canadian " +
    "dollars, US companies in US dollars, the same number either way rather " +
    "than a converted one.",
});

/** The note that has to sit beside the total. */
export const SAVINGS_DISCLOSURE = Object.freeze({
  headline: "These are estimates, and here is exactly what they rest on.",
  body:
    "Every figure on this page is built from the answers you typed and the coefficients in the table below — nothing is measured from your business, because we cannot see it. Where a number is a judgement rather than a definition the table says so, and where it came from contractors rather than from us the table says that too, with the range they reported and which end we took. Two of the lines are worth less than they look and are counted that way: money arriving sooner is worth the cost of waiting for it, not the money itself, and a job you have not yet won is worth its margin, not its invoice. Two others are worth their full value and the table explains why — work already done and never billed has no cost left to net off. If a line looks wrong against your own books, your books are right.",
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
  // Held to the revenue the visitor typed. The quote and office-hours lines are
  // built from hours and a wage and know nothing about turnover, so on extreme
  // answers — a one-job-a-year business with a full-time office, or fifty
  // quotes a month against two small jobs — they alone can exceed everything
  // the business makes. A total larger than the business is not a conservative
  // estimate that needs tuning; it is a claim that has stopped describing
  // anybody, and printing it would discredit the lines that were right.
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
    // Allowed to be negative, and shown when it is. A shop with two office
    // hours a week and four small jobs a month does not get its money back on
    // this, and a calculator that cannot say so is an advertisement.
    netAfterCost: cost.fits ? total - cost.yearAtMonthly : null,
    paysForItself: cost.fits ? total > cost.yearAtMonthly : null,
  };
}
