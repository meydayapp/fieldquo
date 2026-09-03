// scripts/check-dashboard-rank.mjs
//
//   npm run check:dashboard-rank
//
// The dashboard's RANKING: what goes first, what is allowed to be a number,
// and what has to be absent.
//
// ══ Why this is a second dashboard check ═══════════════════════════════════
//
// scripts/check-dashboard.mjs guards the ARITHMETIC — that an amended invoice
// is one document, that the panel and the balance sheet agree to the cent,
// that a refusal comes back as a refusal. None of that changed here and none
// of it is repeated here.
//
// What changed is the ORDER and the RULES OF PRINTING: which block appears
// first, when a comparison may be shown, when a percentage may be shown, and
// what a member who was refused sees instead of a zero. Those decisions were
// deliberately moved out of the JSX and into lib/dashboard/rank.js so they can
// be executed rather than read — a React tree that fetches its own data cannot
// be run in a check script, and "I looked at it and it seemed right" is how
// every one of the bugs in AGENTS.md's failure-class list shipped.
//
// ══ What each section proves ═══════════════════════════════════════════════
//
//   1  the sample floor is never a typed digit anywhere in this feature
//   2  no overdue invoices → the block does not render an empty accusation
//   3  one overdue invoice → it is named, with who and how much
//   4  a month with no prior month → NO delta is invented
//   5  conversion below the floor → the count, and no percentage at all
//   6  showPricing off → every money figure ABSENT, none of them zero
//   7  no data anywhere → the page still renders, and claims nothing
//   8  every figure carries tabular numerals
//   9  the order on the page is the ranked order
//  10  the radius token and the classes finally agree, measured
//
// Verified by mutation: every assertion below was broken in the source,
// confirmed to FAIL here, and restored from a copy — never with git checkout,
// which restores the commit rather than the work.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-dashboard-rank.mjs

import { readFileSync } from "node:fs";
import {
  buildDashboardRank,
  overdueInvoices,
  needsTodayHasWork,
  RATE_FLOOR,
} from "@/lib/dashboard/rank";
import { RATE_FLOOR as KPIS_RATE_FLOOR } from "@/lib/analytics/kpis";
import { SAMPLE_FLOOR } from "@/lib/analytics/winLoss";
import { buildReceivables, buildRevenueTrend } from "@/lib/analytics/receivables";

let pass = 0;
const failures = [];
const ok = (label, condition, detail) => {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
  }
};

// Noon UTC, same reasoning as check-dashboard.mjs: a date pinned at midnight
// lands on the previous day west of Greenwich and quietly changes every age.
const AS_OF = new Date("2026-08-29T12:00:00Z");
const at = (iso) => new Date(`${iso}T12:00:00Z`);

const inv = (over = {}) => ({
  id: over.id,
  companyId: "co_1",
  parentInvoiceId: null,
  version: 1,
  invoiceNumber: over.invoiceNumber || "INV-1",
  status: "sent",
  total: 0,
  dueDate: null,
  sentAt: at("2026-06-01"),
  createdAt: at("2026-06-01"),
  clientId: "cl_1",
  client: { id: "cl_1", name: "Tremblay", email: "t@example.com" },
  ...over,
});

/** The payload shape app/api/analytics/receivables/route.js sends. */
const moneyPayload = ({ invoices = [], payments = [], months = 6, everRecorded = true }) => ({
  currency: "CAD",
  canRemind: true,
  periods: [3, 6, 12],
  automaticReminder: null,
  receivables: buildReceivables({ invoices, payments, asOf: AS_OF }),
  revenue: buildRevenueTrend({ payments, months, everRecorded, asOf: AS_OF }),
});

/** The payload shape app/api/analytics/overview/route.js sends. */
const overviewPayload = (over = {}) => ({
  revenue: 0,
  quotesSent: 0,
  quotesAccepted: 0,
  conversionRate: null,
  priorConversionRate: null,
  goal: null,
  canEditGoal: false,
  ...over,
});

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. The floor is argued for once and imported everywhere\n");
//
// Three modules have an opinion about how small a sample is too small to print
// a percentage from, and all three have to be the same number. lib/dashboard/
// rank.js imports winLoss's SAMPLE_FLOOR rather than kpis.js's RATE_FLOOR for
// a bundle-size reason it states in its own header — this is the assertion
// that stops that choice from becoming a second, drifting floor.

ok("kpis.RATE_FLOOR and winLoss.SAMPLE_FLOOR are the same number", KPIS_RATE_FLOOR === SAMPLE_FLOOR, `${KPIS_RATE_FLOOR} vs ${SAMPLE_FLOOR}`);
ok("...and the dashboard uses it rather than a digit of its own", RATE_FLOOR === KPIS_RATE_FLOOR, RATE_FLOOR);

const rankSrc = readFileSync("lib/dashboard/rank.js", "utf8");
ok(
  "...which is why rank.js contains no bare comparison against a literal 10",
  !/[<>]=?\s*10\b/.test(rankSrc.replace(/^\s*\/\/.*$/gm, "")),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. Nothing is overdue — the block does not accuse anybody\n");
//
// The failure this prevents: a heading that says work is waiting, over an empty
// list. Every invoice below is owed; not one of them is LATE. An invoice with
// no due date is deliberately in the fixture, because aging it from the day it
// was raised is exactly how a debt nobody agreed to gets manufactured.

const NOT_LATE = moneyPayload({
  invoices: [
    inv({ id: "a", invoiceNumber: "INV-200", total: 1000, dueDate: at("2026-09-30") }),
    inv({ id: "b", invoiceNumber: "INV-201", total: 500, dueDate: null }),
  ],
});
const notLate = buildDashboardRank({ overview: overviewPayload(), money: NOT_LATE, upcomingCount: 0 });

ok("both invoices are still owed", notLate.metrics.find((m) => m.id === "owed").amount === 1500, notLate.metrics.find((m) => m.id === "owed").amount);
ok("...and NONE of them is overdue", notLate.needsToday.rows.length === 0, notLate.needsToday.rows.length);
ok("...so the block has no work to show", needsTodayHasWork(notLate, 0) === false);
ok(
  "...and the undated one is not aged into the list",
  !notLate.needsToday.rows.some((r) => r.dueState === "undated"),
);
// The automation lines are a separate source with their own gates. One of them
// having work is enough to render the block — the overdue list being empty is
// not a reason to hide a call nobody has dealt with.
ok("...unless something else is waiting, which still opens it", needsTodayHasWork(notLate, 2) === true);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. One overdue invoice — named, with who and how much\n");
//
// A count is not the fix. "2 past due" tells a contractor nothing they can act
// on; the row has to carry the client and the amount, which is what the block
// exists to do.

const ONE_LATE = moneyPayload({
  invoices: [
    inv({
      id: "late",
      invoiceNumber: "INV-300",
      total: 2400,
      dueDate: at("2026-07-15"),
      client: { id: "cl_9", name: "Boisvert", email: "b@example.com" },
    }),
    inv({ id: "soon", invoiceNumber: "INV-301", total: 800, dueDate: at("2026-09-20") }),
  ],
});
const oneLate = buildDashboardRank({ overview: overviewPayload(), money: ONE_LATE, upcomingCount: 3 });
const row = oneLate.needsToday.rows[0];

ok("exactly one row", oneLate.needsToday.rows.length === 1, oneLate.needsToday.rows.length);
ok("...with the client's name on it", row?.client?.name === "Boisvert", row?.client?.name);
ok("...and the amount owed, not the face value", row?.owed === 2400, row?.owed);
ok("...and how late it is, counted from the DUE date", row?.daysPastDue === 45, row?.daysPastDue);
ok("...the not-yet-due invoice is not in the list", !oneLate.needsToday.rows.some((r) => r.id === "soon"));
ok("...the block therefore has work", needsTodayHasWork(oneLate, 0) === true);
ok("...and the row carries the id a reminder may chase", Boolean(row?.id), row?.id);

// Overflow: past the first few, the rest is a link and not fifteen rows.
const MANY = moneyPayload({
  invoices: Array.from({ length: 9 }, (_, i) =>
    inv({
      id: `l${i}`,
      invoiceNumber: `INV-4${i}`,
      total: 100 + i,
      dueDate: at("2026-07-0" + ((i % 9) + 1)),
    }),
  ),
});
const many = buildDashboardRank({ overview: overviewPayload(), money: MANY, upcomingCount: 0 });
ok("a long overdue list is capped", many.needsToday.rows.length === 5, many.needsToday.rows.length);
ok("...and says how many it did not name", many.needsToday.moreCount === 4, many.needsToday.moreCount);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. No prior month — and therefore no comparison\n");
//
// "▲ $3,110 on August" is a factual claim, and lib/analytics/trend.js's
// compare() is the one place allowed to make it. It returns null when the
// prior is null, and this asserts the dashboard passes a null rather than a
// zero — the difference between "we cannot compare" and "last month was
// nothing", which are opposite sentences.

const firstMonth = buildDashboardRank({
  overview: overviewPayload({ revenue: 8400, quotesSent: 12, quotesAccepted: 5, conversionRate: 5 / 12 }),
  money: null,
  upcomingCount: 0,
});
ok("the hero prints its figure", firstMonth.hero.amount === 8400, firstMonth.hero.amount);
ok("...and NO delta, because no prior revenue is on the wire", firstMonth.hero.delta === null, JSON.stringify(firstMonth.hero.delta));
ok("...not a zero-valued delta, which would render as 'flat'", firstMonth.hero.delta !== 0);
ok(
  "...and quotes sent has none either, for the same reason",
  firstMonth.metrics.find((m) => m.id === "quotesSent").delta === null,
);
ok(
  "...while conversion, which HAS a prior on the wire, still has none when the prior is null",
  firstMonth.metrics.find((m) => m.id === "conversion").delta === null,
);

// The other half of the same rule: when a prior IS supplied the delta appears.
// Without this, `delta: null` everywhere would pass section 4 by being broken.
const withPrior = buildDashboardRank({
  overview: overviewPayload({
    revenue: 8400,
    priorRevenue: 5290,
    quotesSent: 14,
    quotesAccepted: 5,
    conversionRate: 5 / 14,
    priorConversionRate: 0.25,
  }),
  money: null,
  upcomingCount: 0,
});
ok("a real prior produces a real delta", withPrior.hero.delta?.direction === "up", JSON.stringify(withPrior.hero.delta));
ok("...of the right size", Math.round(withPrior.hero.delta.deltaAbs) === 3110, withPrior.hero.delta?.deltaAbs);
ok(
  "...and conversion compares in points, not as a ratio of ratios",
  Math.round(withPrior.metrics.find((m) => m.id === "conversion").delta.deltaAbs * 100) === 11,
  Math.round(withPrior.metrics.find((m) => m.id === "conversion").delta?.deltaAbs * 100),
);

// The received-money series makes the same refusal one level down: the
// headline compares the last two COMPLETE months and never the one we are
// standing in. Measuring a four-day-old month against a finished one would
// manufacture a collapse on the 2nd of every month — which is a confident
// wrong number, the worst kind a panel can print.
const trend = buildRevenueTrend({
  payments: [
    { invoiceId: "x", amount: 900, date: at("2026-06-10") },
    { invoiceId: "y", amount: 1400, date: at("2026-07-10") },
    // Four days into August, on the 29th. If this were compared to July the
    // panel would announce a crash every month.
    { invoiceId: "z", amount: 120, date: at("2026-08-02") },
  ],
  months: 3,
  everRecorded: true,
  asOf: AS_OF,
});
ok("the current month is flagged partial", trend.series.at(-1).partial === true);
ok(
  "...and the headline is the last two COMPLETE months, not this one",
  trend.headline?.month === "2026-07" && trend.headline?.priorMonth === "2026-06",
  `${trend.headline?.month} vs ${trend.headline?.priorMonth}`,
);
ok(
  "...so the part-month never becomes the collapse",
  trend.headline?.direction === "up",
  trend.headline?.direction,
);
// And a company that has never taken a payment gets a sentence, not a flat
// line at the axis — which is what makes hero.received null in section 7.
ok(
  "a company that has never been paid has no series at all",
  buildRevenueTrend({ payments: [], months: 6, everRecorded: false, asOf: AS_OF }).available === false,
);

// ── The delta that is null today but will not be forever ──────────────────
//
// `quotesSent` computes a delta that is always null right now, because the
// overview payload carries no prior count. A dollar sign in front of it the
// day that payload changes is the kind of thing nobody notices until a
// customer does, so the count branch is wired NOW rather than when it fires.
const tilesSrc = readFileSync("app/components/dashboard/SecondaryMetrics.js", "utf8");
const deltaSrc = readFileSync("app/components/dashboard/Delta.js", "utf8");
ok('the count tiles ask Delta for a count, not for money', /kind="count"/.test(tilesSrc));
ok("...and Delta has a count branch to answer with", /kind === "count"/.test(deltaSrc) && /app\.dash\.delta\.countUp/.test(deltaSrc));
ok("...that does not reach for formatMoney", !/kind === "count"[\s\S]{0,600}formatMoney/.test(deltaSrc));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. A percentage off a small sample is not printed\n");
//
// Under RATE_FLOOR sent quotes there is no rate — not a greyed one, not one
// with a footnote. The counts are shown instead, which is the whole statement
// the data supports.

const thin = buildDashboardRank({
  overview: overviewPayload({ quotesSent: 4, quotesAccepted: 2, conversionRate: 0.5, priorConversionRate: 0.2 }),
  money: null,
  upcomingCount: 0,
});
const thinConv = thin.metrics.find((m) => m.id === "conversion");
ok("below the floor, no percentage", thinConv.percent === null, thinConv.percent);
ok("...but the counts are there", thinConv.accepted === 2 && thinConv.sent === 4, `${thinConv.accepted}/${thinConv.sent}`);
ok("...it says so", thinConv.belowFloor === true);
ok("...it reports the floor rather than making the screen know it", thinConv.floor === RATE_FLOOR, thinConv.floor);
ok(
  "...and no delta either, because a comparison of an unprintable rate is worse",
  thinConv.delta === null,
  JSON.stringify(thinConv.delta),
);

// Exactly at the floor it prints — an off-by-one here silently suppresses a
// figure a company has earned.
const atFloor = buildDashboardRank({
  overview: overviewPayload({
    quotesSent: RATE_FLOOR,
    quotesAccepted: 4,
    conversionRate: 4 / RATE_FLOOR,
    priorConversionRate: null,
  }),
  money: null,
  upcomingCount: 0,
});
const atConv = atFloor.metrics.find((m) => m.id === "conversion");
ok("at the floor exactly, the percentage prints", atConv.percent === 40, atConv.percent);
ok("...with its sample beside it", atConv.sent === RATE_FLOOR && atConv.accepted === 4, `${atConv.accepted}/${atConv.sent}`);
ok("...and belowFloor is false", atConv.belowFloor === false);

// One under the floor it does not.
const underFloor = buildDashboardRank({
  overview: overviewPayload({
    quotesSent: RATE_FLOOR - 1,
    quotesAccepted: 4,
    conversionRate: 4 / (RATE_FLOOR - 1),
  }),
  money: null,
  upcomingCount: 0,
});
ok(
  "one under the floor, it does not",
  underFloor.metrics.find((m) => m.id === "conversion").percent === null,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. showPricing off — every money figure ABSENT, none of them 0\n");
//
// This is the bug the whole page's header comment is about. Both endpoints
// refuse a member without showPricing (requireToggle in
// app/api/analytics/overview/route.js, and again in
// app/api/analytics/receivables/route.js), the page holds `null` for a refusal,
// and null must produce NOTHING. "$0 revenue, 0 quotes sent, $0 owed" to a
// crew member is not a missing figure, it is a false statement about the
// business.

const refused = buildDashboardRank({ overview: null, money: null, upcomingCount: 7 });

ok("the hero is not known", refused.hero.known === false);
ok("...and holds no amount", refused.hero.amount === null, refused.hero.amount);
ok("...and no sparkline series", refused.hero.received === null);
for (const id of ["quotesSent", "conversion", "owed"]) {
  const m = refused.metrics.find((x) => x.id === id);
  ok(`the ${id} tile is not known`, m.known === false);
  ok(`...and carries no figure`, (m.value ?? m.percent ?? m.amount ?? null) === null, JSON.stringify(m));
}
ok(
  "the one tile that is not money survives",
  refused.metrics.find((m) => m.id === "booked").known === true &&
    refused.metrics.find((m) => m.id === "booked").value === 7,
);
ok("...and the overdue list is 'not known', not 'none'", refused.needsToday.known === false);
ok("...so the block shows no rows", refused.needsToday.rows.length === 0);
ok("overdueInvoices(null) is null and never []", overdueInvoices(null) === null);

// The gate itself, at the source, scoped to the one handler that carries it —
// a page that renders a refusal perfectly is no use if the route stopped
// refusing.
const overviewRoute = readFileSync("app/api/analytics/overview/route.js", "utf8");
const overviewGet = braceBody(overviewRoute, "export async function GET");
ok("GET /api/analytics/overview still gates on showPricing", Boolean(overviewGet) && /requireToggle\(\s*full\s*,\s*"showPricing"/.test(overviewGet));
const receivablesRoute = readFileSync("app/api/analytics/receivables/route.js", "utf8");
const receivablesGet = braceBody(receivablesRoute, "export async function GET");
ok("GET /api/analytics/receivables still gates on showPricing", Boolean(receivablesGet) && /requireToggle\(\s*full\s*,\s*"showPricing"/.test(receivablesGet));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. Nothing at all — the page still renders, and claims nothing\n");
//
// A brand new company. Both endpoints answer, with genuine emptiness rather
// than a refusal — which is a different state again, and the one where a real
// 0 IS the truth.

const EMPTY = moneyPayload({ invoices: [], payments: [], everRecorded: false });
const empty = buildDashboardRank({ overview: overviewPayload(), money: EMPTY, upcomingCount: 0 });

ok("it does not throw", true);
ok("the hero is known and genuinely zero", empty.hero.known === true && empty.hero.amount === 0);
ok("...with no delta invented out of the zero", empty.hero.delta === null);
ok("...and no sparkline, because no payment was ever recorded", empty.hero.received === null);
const emptyOwed = empty.metrics.find((m) => m.id === "owed");
ok("owed says 'never billed anybody', not '$0.00'", emptyOwed.noInvoices === true);
ok("...and does not also claim everything is settled", emptyOwed.nothingOutstanding === false);
ok("conversion has no rate and no counts to hide", empty.metrics.find((m) => m.id === "conversion").percent === null);
ok("the needs block is empty rather than unknown", empty.needsToday.known === true && empty.needsToday.rows.length === 0);
ok("...and renders away", needsTodayHasWork(empty, 0) === false);

// Called with literally nothing — the state the page holds for one frame
// before any fetch answers.
const nothing = buildDashboardRank();
ok("buildDashboardRank() with no arguments is safe", nothing.metrics.length === 4);
ok("...and knows nothing", nothing.metrics.every((m) => m.known === false));
ok("...including the visit count, which is null and not 0", nothing.metrics.find((m) => m.id === "booked").value === null);

// Everything settled is a THIRD state, and it is not the other two.
const SETTLED = moneyPayload({
  invoices: [inv({ id: "s", invoiceNumber: "INV-500", total: 300, status: "paid" })],
  payments: [{ id: "p", invoiceId: "s", amount: 300, date: at("2026-07-02"), invoice: { companyId: "co_1" } }],
});
const settled = buildDashboardRank({ overview: overviewPayload(), money: SETTLED, upcomingCount: 0 });
const settledOwed = settled.metrics.find((m) => m.id === "owed");
ok("'everything is settled' is not 'never billed'", settledOwed.nothingOutstanding === true && settledOwed.noInvoices === false);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n8. Every figure on the ranked top carries tabular numerals\n");
//
// Proportional digits have different widths, so a column of money has a
// wandering decimal point and cannot be read down the column. There were
// exactly zero occurrences of tabular-nums on this page and 235 elsewhere in
// the app, which made it an omission rather than a decision.
//
// The rule is structural rather than a spelling check: every formatMoney()
// call on these files has to sit INSIDE a <Figure> or <FigureText>, which are
// the only two places the declaration is written. A figure added later cannot
// arrive with proportional digits without breaking this.

const RANKED_FILES = [
  "app/app/page.js",
  "app/components/dashboard/NeedsToday.js",
  "app/components/dashboard/HeroRevenue.js",
  "app/components/dashboard/SecondaryMetrics.js",
  "app/components/dashboard/Delta.js",
];
// Deliberately NOT in scope, and named rather than silently skipped:
// OnboardingProgress, RevenueGoalCard, AwaitingPayment, MigrationNotice and
// CircularProgress are the panels BELOW the fold, untouched by this rebuild.
// Widening the rule to them means editing them first, not exempting them.

const figureSrc = readFileSync("app/components/dashboard/Figure.js", "utf8");
for (const name of ["Figure", "FigureText"]) {
  const body = braceBody(figureSrc, `export function ${name}(`);
  ok(`<${name}> applies tabular-nums`, Boolean(body) && body.includes("tabular-nums"), body ? "no class" : "function not found");
}

for (const file of RANKED_FILES) {
  const src = readFileSync(file, "utf8");
  const spans = [...elementRanges(src, "Figure"), ...elementRanges(src, "FigureText")];
  const inside = (i) => spans.some(([s, e]) => i > s && i < e);

  // A native `title=` tooltip is drawn by the browser's own chrome. No
  // stylesheet of ours reaches it, so a figure in one cannot carry tabular
  // digits and is not asked to. Named as an exemption rather than left as a
  // hole the rule quietly steps around.
  const tooltips = attributeRanges(src, "title");
  const exempt = (i) => tooltips.some(([s, e]) => i > s && i < e);

  const stray = [];
  for (const m of src.matchAll(/formatMoney\(/g)) {
    // Figure.js is the definition; every other file is a call site.
    if (!inside(m.index) && !exempt(m.index)) stray.push(`char ${m.index}`);
  }
  ok(
    `${file}: every formatMoney() sits inside a <Figure>/<FigureText>`,
    stray.length === 0,
    stray.join(", "),
  );

  // The idiom that WAS on this page — `${Number(q.total).toLocaleString()}` —
  // formats a number with no currency and no tabular class. Dates take
  // arguments; this bare form does not, which is what tells them apart.
  ok(
    `${file}: no bare .toLocaleString() on a number`,
    !/\.toLocaleString\(\)/.test(src),
  );
}

// A positive counterpart, so the rule above cannot pass by the file simply
// having no figures in it any more.
const pageSrc = readFileSync("app/app/page.js", "utf8");
ok(
  "app/app/page.js still renders money at all",
  (pageSrc.match(/formatMoney\(/g) || []).length >= 8,
  (pageSrc.match(/formatMoney\(/g) || []).length,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n9. The order on the page is the ranked order\n");
//
// Scoped to the brace-matched body of ONE function. `indexOf(a) < indexOf(b)`
// passes trivially when `a` is absent (-1 is less than everything), so every
// marker is asserted PRESENT before any of them is compared.

const dashboardBody = braceBody(pageSrc, "export default function DashboardPage(");
ok("DashboardPage's body was found", Boolean(dashboardBody));

const ORDER = [
  ["the block that needs a person", "<NeedsToday"],
  ["the hero figure", "<HeroRevenue"],
  ["the four supporting metrics", "<SecondaryMetrics"],
  ['the "everything else" rule', "app.dash.rest.title"],
  ["the received-money chart", 'id="money-received"'],
  ["recent quotes", "app.dash.recentQuotes"],
];
const at_ = ORDER.map(([label, marker]) => {
  const i = dashboardBody ? dashboardBody.indexOf(marker) : -1;
  ok(`${label} is on the page`, i >= 0, marker);
  return i;
});
for (let i = 1; i < ORDER.length; i++) {
  ok(
    `${ORDER[i][0]} comes after ${ORDER[i - 1][0]}`,
    at_[i - 1] >= 0 && at_[i] >= 0 && at_[i - 1] < at_[i],
    `${at_[i - 1]} then ${at_[i]}`,
  );
}

// The appointment count is the one figure on this page with no endpoint of its
// own to refuse it, and it used to read 0 for a failed load. `useState(null)`
// is what makes the tile absent instead.
ok(
  "the visit count starts at null, not 0",
  /setUpcomingCount\s*\]\s*=\s*useState\(null\)/.test(pageSrc) ||
    /const \[upcomingCount, setUpcomingCount\] = useState\(null\)/.test(pageSrc),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n10. The radius token and the classes agree — and the card is visible\n");

const css = readFileSync("app/globals.css", "utf8");
ok("the radius token is still 0", /--radius:\s*0\s*;/.test(css));
ok(
  "...and the whole scale is still computed from it, so no rung is secretly round",
  ["sm", "md", "xl", "2xl", "3xl", "4xl"].every((r) =>
    new RegExp(`--radius-${r}:\\s*calc\\(var\\(--radius\\)`).test(css),
  ) && /--radius-lg:\s*var\(--radius\)/.test(css),
);

for (const file of ["app/app/page.js", ...RANKED_FILES.slice(1), "app/components/dashboard/surface.js"]) {
  const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const rounded = [...src.matchAll(/\brounded-[a-z0-9]+/g)]
    .map((m) => m[0])
    // rounded-full is 9999px, not a rung on the zeroed scale — pills really
    // are round and always were.
    .filter((c) => c !== "rounded-full");
  ok(`${file}: no radius class the token has already zeroed`, rounded.length === 0, rounded.join(", "));
}

// ── The card edge, measured rather than described ──────────────────────────
//
// #ffffff on #f6f8fb is 1.06:1 — the fill does nothing and the border does all
// the work. The border was #d7e2ef, which is 1.23:1 against the page. The new
// edge composites the ink token at 20% over the card's own white (border-box
// clipping, so the card paints under its border) and has to beat that.
//
// Comments stripped FIRST. This file explains its own edge at length, and a
// scan that read the explanation as the implementation passed a card whose
// class had been put back to `border-border` — the exact false pass the
// AGENTS.md note about positive containment rules warns about.
const surface = readFileSync("app/components/dashboard/surface.js", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");
const edge = surface.match(/border-foreground\/(\d+)/);
ok("the dashboard card carries an edge derived from the ink token", Boolean(edge), "border-border, still invisible");
ok("...and a real shadow, which is the only lift a 1.06:1 fill can get", /shadow-\[/.test(surface));

const hex = (name) => {
  const m = css.match(new RegExp(`\\n\\s*--${name}:\\s*(#[0-9a-fA-F]{6})`));
  return m ? m[1] : null;
};
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = ([r, g, b]) => {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const mix = (fg, bg, alpha) => fg.map((c, i) => Math.round(alpha * c + (1 - alpha) * bg[i]));

const page = rgb(hex("background"));
const card = rgb(hex("card"));
const oldBorder = rgb(hex("border"));
// The alpha comes from the class the card actually carries, not from a number
// typed here — so weakening the edge in surface.js moves this measurement
// instead of leaving it describing a card that no longer exists.
const newBorder = edge
  ? mix(rgb(hex("foreground")), card, Number(edge[1]) / 100)
  : rgb(hex("border"));

const fill = ratio(card, page);
const before = ratio(oldBorder, page);
const after = ratio(newBorder, page);
console.log(
  `       card fill vs page ${fill.toFixed(3)}:1 · border was ${before.toFixed(3)}:1 · now ${after.toFixed(3)}:1`,
);
ok("the fill alone really is the problem (under 1.1:1)", fill < 1.1, fill.toFixed(3));
ok("the new edge is measurably stronger than the old one", after > before, `${after.toFixed(3)} vs ${before.toFixed(3)}`);
ok("...and clears 1.4:1 against the page", after >= 1.4, after.toFixed(3));

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The brace-matched body of ONE named function, comments and string literals
 * skipped.
 *
 * Naive brace counting reads `"{count} more overdue"` and `` `?${qs}` `` as
 * structure, and a rule scoped by a naive matcher is scoped to whatever the
 * miscount happened to cover. Template literals re-enter code at `${`, which
 * is where the interesting braces on this page actually live.
 */
function braceBody(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) return null;

  // ── Skip the PARAMETER list before looking for the body ──────────────────
  //
  // `function Figure({ className = "", children })` opens a brace that is not
  // the body, and taking it scoped the whole tabular-nums rule to a
  // destructuring pattern — which contains no classes, so the rule failed for
  // the right reason by accident and would have passed for the wrong one on
  // any function without destructured props. Walk the parens first.
  let i = src.indexOf("(", start);
  if (i < 0) return null;
  let parens = 0;
  for (; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) break;
    }
  }
  i = src.indexOf("{", i);
  if (i < 0) return null;

  const open = i;
  let depth = 0;
  // A stack of template-literal depths: entering `${` pushes, its closing `}`
  // pops back into the template.
  const tmpl = [];

  for (; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];

    if (c === "/" && next === "/") {
      i = src.indexOf("\n", i);
      if (i < 0) break;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) break;
      i = end + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (c === "`") {
      // Walk the template, stopping at an interpolation so its braces count.
      i++;
      while (i < src.length) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === "`") break;
        if (src[i] === "$" && src[i + 1] === "{") {
          tmpl.push(depth);
          depth++;
          i += 2;
          break;
        }
        i++;
      }
      // If we broke on an interpolation, fall through and keep counting from
      // there; otherwise the `i` now sits on the closing backtick.
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (tmpl.length && depth === tmpl[tmpl.length - 1]) {
        // Back inside the template literal — resume scanning it.
        tmpl.pop();
        i++;
        while (i < src.length) {
          if (src[i] === "\\") {
            i += 2;
            continue;
          }
          if (src[i] === "`") break;
          if (src[i] === "$" && src[i + 1] === "{") {
            tmpl.push(depth);
            depth++;
            i += 1;
            break;
          }
          i++;
        }
        continue;
      }
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/**
 * The character ranges covered by `<Tag …>…</Tag>` in a JSX file.
 *
 * `(?![A-Za-z])` matters: `<Figure` is a prefix of `<FigureText`, and a rule
 * that matched the prefix would treat every FigureText as an unclosed Figure
 * and pair the wrong tags. A self-closing `<Tag … />` covers no children and
 * is skipped, so a figure written that way fails the rule rather than
 * accidentally passing it.
 */
/**
 * The character ranges of `name={ … }` JSX attribute values, brace-matched.
 *
 * Only used for `title`, and only to exempt it — see the call site.
 */
function attributeRanges(src, name) {
  const re = new RegExp(`\\b${name}=\\{`, "g");
  const out = [];
  for (const m of src.matchAll(re)) {
    let depth = 0;
    for (let i = m.index + m[0].length - 1; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) {
          out.push([m.index, i]);
          break;
        }
      }
    }
  }
  return out;
}

function elementRanges(src, tag) {
  const re = new RegExp(`<(/?)${tag}(?![A-Za-z0-9_])`, "g");
  const stack = [];
  const out = [];
  for (const m of src.matchAll(re)) {
    if (m[1] === "/") {
      const open = stack.pop();
      if (open !== undefined) out.push([open, m.index + m[0].length]);
      continue;
    }
    const gt = src.indexOf(">", m.index);
    if (gt < 0) continue;
    if (src[gt - 1] === "/") continue; // self-closing: no children to cover
    stack.push(m.index);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
