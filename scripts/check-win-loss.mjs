// scripts/check-win-loss.mjs
//
// The report that tells a contractor WHY, and the six ways it could lie.
//
// ══ What was wrong ═════════════════════════════════════════════════════════
//
// `Quote.declineReason` has existed, and been written on decline through both
// doors, for as long as lib/quotes/quoteLifecycle.js has. The only things that
// ever READ it were FieldQuo's own console — app/platform/TenantBoard.js counts
// it, lib/analytics/tenantData.js ships it to the platform AI. So the product
// collected why a contractor loses work, showed it to us, and never showed it
// to them. The dashboard showed the bare win rate, which is exactly the number
// the field's own schema comment says is not enough:
//
//   "'You lose 60% of quotes on price' and 'you lose 60% on timing' describe
//    two completely different businesses and call for opposite responses."
//
// Worse: the back office had nowhere to TYPE one. PATCH /api/quotes/[id] has
// always accepted `declineReason`, and app/app/quote-approval/[id]/page.js
// posted `{ status }` alone — so the field was writable only from the public
// approval link, which does not ask either. A column nobody can write is the
// same failure as a column nobody reads, one step earlier.
//
// ══ What this file refuses to let happen ═══════════════════════════════════
//
// A report built on an optional free-text field has one characteristic way of
// going wrong, and it is not arithmetic: it invents. The silent losses get
// folded into "other", or into "price", or quietly dropped so the three
// recorded reasons can be drawn as a pie that reads like the whole picture.
// Each of those turns an absence into a claim the client never made, and the
// contractor then reprices a business that was losing on timing.
//
// So the assertions below are mostly about ABSENCE:
//
//   * null is never counted as a category, and never becomes a verbatim row
//   * unexplained losses are their own number, always printed
//   * a sample under the floor prints no percentage at all
//   * a missing decision date is dropped from the average, never nought days
//   * a quote still out is neither won nor lost
//   * an empty period reports emptiness, never a 0% win rate
//   * a crew member is refused the whole thing — it is the rate card in
//     aggregate plus every client's name (non-negotiable #4)
//
// ══ How it runs ════════════════════════════════════════════════════════════
//
// The builder is pure, so it is EXECUTED against scripted rows rather than
// read. The route is executed too, against a stub database, using
// scripts/check-crew-access.mjs section 10's technique — because a regex over
// a route file proves a gate is written down and not that it refuses.
//
// The screen that captures the reason is JSX and nothing here can parse it, so
// that one claim is matched as source text, positionally, and this file says so
// rather than pretending otherwise.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-win-loss.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { register } from "node:module";

import { buildWinLoss, toOpportunities, SAMPLE_FLOOR } from "@/lib/analytics/winLoss";
import { PERMISSION_PRESETS } from "@/lib/permissions";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

// ═══════════════════════════════════════════════════════════════════════════
// The fixtures — one quarter of a small painting shop
// ═══════════════════════════════════════════════════════════════════════════
//
// Deliberately awkward, because every awkward row here is a real one:
//   * a quote accepted before acceptedAt existed (no decision stamp)
//   * a quote re-sent after it was declined (decision BEFORE the send date)
//   * a reason that is three spaces (somebody tabbed through the box)
//   * a Good/Better/Best trio, which is three rows and one decision
//   * a quote that left draft and was never stamped sent
//   * a quote just outside the period

const FROM = "2026-04-01";
const TO = "2026-06-30";
const d = (s) => new Date(`${s}T12:00:00.000Z`);

const SAM = "u_sam";
const DANA = "u_dana";
const NAMES = { [SAM]: "Sam Ortiz", [DANA]: "Dana Wu" };

let seq = 0;
function q(over) {
  seq += 1;
  const authorId = over.createdById === undefined ? SAM : over.createdById;
  return {
    id: `q${seq}`,
    quoteNumber: `Q-${1000 + seq}`,
    status: "sent",
    total: 1000,
    acceptedTotal: null,
    sentAt: null,
    acceptedAt: null,
    declinedAt: null,
    declineReason: null,
    tierGroupId: null,
    companyId: "co",
    client: { name: "A. Client" },
    ...over,
    createdById: authorId,
    createdBy: authorId ? { name: NAMES[authorId] || null } : null,
  };
}

const CHEAPER = "Went with a cheaper bid, about $400 under.";
const TIMING = "Timing — they need it done in March.";

const QUOTES = [
  // ── Won ────────────────────────────────────────────────────────────────
  q({ status: "accepted", sentAt: d("2026-04-05"), acceptedAt: d("2026-04-08"), total: 1000, acceptedTotal: 1100 }),
  q({ status: "accepted", sentAt: d("2026-04-06"), acceptedAt: d("2026-04-11"), total: 2000 }),
  // Accepted before acceptedAt existed. No decision stamp at all.
  q({ status: "accepted", sentAt: d("2026-04-07"), acceptedAt: null, total: 3000 }),
  q({ status: "accepted", sentAt: d("2026-05-01"), acceptedAt: d("2026-05-02"), total: 1500, createdById: DANA }),
  q({ status: "accepted", sentAt: d("2026-05-02"), acceptedAt: d("2026-05-12"), total: 2500, createdById: DANA }),

  // ── The Good/Better/Best trio: three rows, ONE decision ────────────────
  q({ tierGroupId: "tg1", status: "sent", sentAt: d("2026-05-10"), total: 5000 }),
  q({ tierGroupId: "tg1", status: "accepted", sentAt: d("2026-05-10"), acceptedAt: d("2026-05-15"), total: 8000, acceptedTotal: 8000 }),
  q({ tierGroupId: "tg1", status: "sent", sentAt: d("2026-05-10"), total: 12000 }),

  // ── Lost ───────────────────────────────────────────────────────────────
  q({ status: "declined", sentAt: d("2026-04-10"), declinedAt: d("2026-04-20"), total: 900, declineReason: CHEAPER }),
  q({ status: "declined", sentAt: d("2026-04-12"), declinedAt: d("2026-04-14"), total: 1200, declineReason: TIMING, createdById: DANA }),
  q({ status: "declined", sentAt: d("2026-04-15"), declinedAt: d("2026-04-16"), total: 800 }),
  // Declined before declinedAt existed.
  q({ status: "declined", sentAt: d("2026-04-16"), declinedAt: null, total: 700, createdById: DANA }),
  // Re-sent AFTER it was declined: sentAt moved, declinedAt did not (first
  // answer wins, by design). The span is negative and unusable.
  q({ status: "declined", sentAt: d("2026-05-20"), declinedAt: d("2026-05-01"), total: 600, declineReason: "   ", createdById: DANA }),
  // No author recorded.
  q({ status: "declined", sentAt: d("2026-06-01"), declinedAt: d("2026-06-04"), total: 1100, createdById: null }),

  // ── Still out ──────────────────────────────────────────────────────────
  q({ status: "sent", sentAt: d("2026-06-10"), total: 4000 }),
  q({ status: "sent", sentAt: d("2026-06-11"), total: 5000, createdById: DANA }),
  q({ status: "sent", sentAt: d("2026-06-12"), total: 6000, createdById: null }),

  // ── Outside the period, and undated ────────────────────────────────────
  q({ status: "declined", sentAt: d("2026-03-01"), declinedAt: d("2026-03-05"), total: 4444, declineReason: "Too expensive." }),
  q({ status: "declined", sentAt: null, declinedAt: d("2026-05-05"), total: 3333, declineReason: "Legacy row, never stamped sent." }),
];

const report = buildWinLoss({ from: FROM, to: TO, quotes: QUOTES });

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. What went out, and what came back\n");
//
// Fifteen opportunities from eighteen in-range rows: the trio is one.

ok("15 opportunities in the period", report.counts.sent === 15, report.counts.sent);
ok("6 won", report.counts.won === 6, report.counts.won);
ok("6 lost", report.counts.lost === 6, report.counts.lost);
ok("3 still out", report.counts.outstanding === 3, report.counts.outstanding);
ok(
  "won + lost + outstanding accounts for every one of them",
  report.counts.won + report.counts.lost + report.counts.outstanding === report.counts.sent,
);

// The one that makes a tiered shop's numbers readable at all. Nothing marks
// the losing options declined when the client picks one, so three rows would
// otherwise score as one win and two quotes hanging forever.
const tiered = toOpportunities(QUOTES).filter((o) => o.tiered);
ok("the Good/Better/Best trio collapses to ONE opportunity", tiered.length === 1, tiered.length);
ok("…and it is a win, because a sibling was accepted", tiered[0]?.outcome === "won", tiered[0]?.outcome);
ok("…valued at what they actually signed, not at the highest option",
  tiered[0]?.value === 8000, tiered[0]?.value);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. A quote still out is neither won nor lost\n");
//
// The commonest way a win/loss report lies: divide wins by everything sent,
// and every quote a client is still thinking about counts as a loss. A busy
// month then reads as a bad one, which is the exact opposite of the truth.

ok("the rate divides by DECIDED quotes", report.winRate.n === 12, report.winRate.n);
ok("…which is won + lost, not sent", report.counts.decided === 12, report.counts.decided);
ok("…so the rate is 50%, not 6/15", Math.round(report.winRate.value * 100) === 50,
  report.winRate.value);
ok("the three still out are reported on their own", report.counts.outstanding === 3);
ok("…and their value is not in the lost column",
  report.value.outstanding.amount === 15000 && report.value.lost.amount === 5300,
  [report.value.outstanding.amount, report.value.lost.amount]);
ok("value won is what was signed", report.value.won.amount === 18100, report.value.won.amount);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. null is nobody saying — never a category\n");
//
// The failure this whole task exists to prevent. Four of six losses here are
// silent: one has no reason at all, three have nothing usable (one of them is
// three spaces, which is somebody tabbing through the box, not an answer).

ok("6 losses, 2 of them explained", report.reasons.lost === 6 && report.reasons.explained === 2,
  [report.reasons.lost, report.reasons.explained]);
ok("4 unexplained, reported as its OWN number",
  report.reasons.unexplained === 4, report.reasons.unexplained);
ok("…explained + unexplained is every loss and nothing else",
  report.reasons.explained + report.reasons.unexplained === report.reasons.lost);

// Every verbatim row is somebody's actual sentence. Nothing was invented to
// fill a row, and nothing silent was given a label.
const GIVEN = new Set(
  QUOTES.map((row) => (typeof row.declineReason === "string" ? row.declineReason.trim() : ""))
    .filter(Boolean),
);
const said = report.reasons.verbatim.flatMap((v) => v.reasons);
ok("every reason shown was typed by somebody", said.every((s) => GIVEN.has(s)), said);
ok("…and there are exactly as many rows as explained losses",
  report.reasons.verbatim.length === report.reasons.explained, report.reasons.verbatim.length);
ok("no verbatim row carries an empty reason",
  report.reasons.verbatim.every((v) => v.reasons.length > 0 && v.reasons.every((s) => s.trim())));
// The three-space reason is silence.
ok("a whitespace-only reason counts as UNEXPLAINED, not as a reason",
  !said.some((s) => s.trim() === ""), said);
// No bucket named anything. If a taxonomy ever appears, these keys appear too.
ok("the payload has no category bucket to hide a null in",
  !("categories" in report.reasons) && !("groups" in report.reasons) && !("other" in report.reasons),
  Object.keys(report.reasons));
// Newest first, so a contractor reads what happened last week before what
// happened in April.
const order = report.reasons.verbatim.map((v) => v.decidedAt);
ok("verbatim reasons are newest first",
  order.length === 2 && order[0] > order[1], order);

// The note that should be shouting when most losses are silent.
const codes = report.notes.map((n) => n.code);
ok("the report says out loud that most losses are unexplained",
  codes.includes("mostly_unexplained"), codes);
const note = report.notes.find((n) => n.code === "mostly_unexplained");
ok("…carrying the counts, not a percentage",
  note?.unexplained === 4 && note?.lost === 6 && !("share" in note), note);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. A small sample prints no percentage\n");
//
// The floor is ten DECIDED quotes, and the reason is arithmetic rather than
// taste: at ten, one quote flipping moves the rate by ten points, and at any
// larger n by less. Below that the rate moves further than any change a
// contractor could act on, so the honest output is the counts and a sentence.

ok(`the floor is ${SAMPLE_FLOOR} decided quotes`, SAMPLE_FLOOR === 10, SAMPLE_FLOOR);
ok("…and it is published in the payload, not hidden in the lib",
  report.sampleFloor === SAMPLE_FLOOR, report.sampleFloor);

const nine = buildWinLoss({
  from: FROM,
  to: TO,
  quotes: [
    ...Array.from({ length: 5 }, (_, i) =>
      q({ status: "accepted", sentAt: d("2026-04-05"), acceptedAt: d(`2026-04-0${i + 6}`), total: 100 })),
    ...Array.from({ length: 4 }, () =>
      q({ status: "declined", sentAt: d("2026-04-05"), declinedAt: d("2026-04-09"), total: 100 })),
  ],
});
ok("nine decisions: no rate is returned at all", nine.winRate.value === null, nine.winRate.value);
ok("…with the reason named", nine.winRate.suppressed === "below_floor", nine.winRate.suppressed);
ok("…and the sample size beside it", nine.winRate.n === 9, nine.winRate.n);
ok("…while the COUNTS are still given — 5 of 9 is honest at any n",
  nine.counts.won === 5 && nine.counts.lost === 4);
ok("…and the report says the sample is short",
  nine.notes.some((n) => n.code === "below_floor" && n.decided === 9), nine.notes);

// Ten is the floor, not a threshold it has to clear.
const ten = buildWinLoss({
  from: FROM,
  to: TO,
  quotes: [
    ...Array.from({ length: 5 }, () =>
      q({ status: "accepted", sentAt: d("2026-04-05"), acceptedAt: d("2026-04-09"), total: 100 })),
    ...Array.from({ length: 5 }, () =>
      q({ status: "declined", sentAt: d("2026-04-05"), declinedAt: d("2026-04-09"), total: 100 })),
  ],
});
ok("ten decisions: the rate appears", ten.winRate.value === 0.5, ten.winRate.value);

// The same floor governs the unexplained SHARE. Six losses is not enough to
// say "two thirds of your losses are silent" as a percentage — but "4 of 6" is
// printable, and the page prints that.
ok("the unexplained share is suppressed on six losses",
  report.reasons.unexplainedShare.value === null &&
    report.reasons.unexplainedShare.suppressed === "below_floor",
  report.reasons.unexplainedShare);

// And segmentation obeys it per bucket rather than in aggregate.
ok("neither estimator clears the floor, so no table is offered",
  report.byEstimator.rows.length === 0 && report.byEstimator.suppressed === "below_floor",
  report.byEstimator);
ok("…and the quote with no author is counted, not assigned to somebody",
  report.byEstimator.unattributed === 1, report.byEstimator.unattributed);

const bigger = buildWinLoss({
  from: FROM,
  to: TO,
  quotes: [
    ...Array.from({ length: 8 }, () => q({ status: "accepted", sentAt: d("2026-04-05"), acceptedAt: d("2026-04-09"), total: 100, createdById: SAM })),
    ...Array.from({ length: 4 }, () => q({ status: "declined", sentAt: d("2026-04-05"), declinedAt: d("2026-04-09"), total: 100, createdById: SAM })),
    ...Array.from({ length: 3 }, () => q({ status: "accepted", sentAt: d("2026-04-05"), acceptedAt: d("2026-04-09"), total: 100, createdById: DANA })),
    ...Array.from({ length: 9 }, () => q({ status: "declined", sentAt: d("2026-04-05"), declinedAt: d("2026-04-09"), total: 100, createdById: DANA })),
  ],
});
ok("two people with twelve decisions each DO get a table",
  bigger.byEstimator.rows.length === 2, bigger.byEstimator.rows.length);
ok("…best win rate first", bigger.byEstimator.rows[0]?.winRate > bigger.byEstimator.rows[1]?.winRate,
  bigger.byEstimator.rows.map((r) => r.winRate));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. A missing decision date is dropped, never counted as zero\n");
//
// The acceptedAt/declinedAt schema comment states this rule in so many words:
// "absence is not 'decided instantly', and any average must drop nulls rather
// than treat them as zero". Two rows here have no stamp, and one has a
// decision BEFORE its send date because it was re-sent afterwards.

ok("nine decisions are measurable", report.timeToDecision.measured === 9,
  report.timeToDecision.measured);
ok("three are not, and are reported as such", report.timeToDecision.dropped === 3,
  report.timeToDecision.dropped);
ok("measured + dropped is every decision",
  report.timeToDecision.measured + report.timeToDecision.dropped === report.counts.decided);
// If the three nulls were counted as zero days the median would fall to 3 → 2
// and the mean from 4.4 to 3.3. Both are asserted so either mistake fails.
ok("the median is 3 days", report.timeToDecision.medianDays === 3, report.timeToDecision.medianDays);
ok("the mean is 4.4 days — not 3.3, which is what nulls-as-zero would give",
  report.timeToDecision.meanDays === 4.4, report.timeToDecision.meanDays);

const noStamps = buildWinLoss({
  from: FROM,
  to: TO,
  quotes: [q({ status: "accepted", sentAt: d("2026-04-05"), acceptedAt: null, total: 100 })],
});
ok("with NO measurable decision the average is null, not zero",
  noStamps.timeToDecision.medianDays === null && noStamps.timeToDecision.meanDays === null,
  noStamps.timeToDecision);
ok("…and it says how many it could not measure", noStamps.timeToDecision.dropped === 1);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. An empty period reports emptiness, not a 0% win rate\n");
//
// "0%" is a statement about the contractor's selling. A month with nothing in
// it does not make that statement, and a card that renders one would have the
// contractor explaining a number that describes no event.

const empty = buildWinLoss({ from: FROM, to: TO, quotes: [] });
ok("hasData is false", empty.hasData === false);
ok("the win rate is null, NOT 0", empty.winRate.value === null, empty.winRate.value);
ok("…and says nothing has been decided", empty.winRate.suppressed === "none_yet",
  empty.winRate.suppressed);
ok("every count is zero, which is a fact about the period",
  empty.counts.sent === 0 && empty.counts.decided === 0);
ok("the report names the absence", empty.notes.some((n) => n.code === "no_activity"), empty.notes);
ok("no verbatim rows are conjured out of nothing", empty.reasons.verbatim.length === 0);

// Everything sent and nothing answered is a DIFFERENT emptiness, and says so.
const allOut = buildWinLoss({
  from: FROM,
  to: TO,
  quotes: [q({ status: "sent", sentAt: d("2026-04-05"), total: 100 })],
});
ok("a period where nothing has been answered yet is not a 0% win rate",
  allOut.winRate.value === null && allOut.winRate.suppressed === "none_yet", allOut.winRate);
ok("…and it is told apart from an empty one",
  allOut.hasData === true && allOut.notes.some((n) => n.code === "all_outstanding"), allOut.notes);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. Absence outside the period is stated, not dated by guess\n");

ok("the March quote is in no figure", !said.includes("Too expensive."), said);
ok("the never-sent quote belongs to no period", report.excluded.undated === 1,
  report.excluded.undated);
ok("…and the report says so rather than filing it under 'this quarter'",
  report.notes.some((n) => n.code === "undated_excluded" && n.count === 1), report.notes);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n8. Hostile input: no NaN, no Infinity, no division by zero\n");
//
// Most of the real bugs in this repo were found by executing pure functions
// against input nobody would write on purpose. A money figure that renders as
// "$NaN" is what makes a working restriction look like a broken product.

function badNumbers(value, path = "$", found = []) {
  if (typeof value === "number" && !Number.isFinite(value)) found.push(path);
  else if (Array.isArray(value)) value.forEach((v, i) => badNumbers(v, `${path}[${i}]`, found));
  else if (value && typeof value === "object" && !(value instanceof Date))
    for (const [k, v] of Object.entries(value)) badNumbers(v, `${path}.${k}`, found);
  return found;
}

const HOSTILE = [
  null,
  undefined,
  "not an object",
  42,
  {},
  { status: "declined" },
  { id: "h1", status: "accepted", sentAt: "banana", acceptedAt: "also banana", total: "abc" },
  { id: "h2", status: "declined", sentAt: d("2026-04-05"), declinedAt: d("2026-04-06"), total: NaN, declineReason: 12345 },
  { id: "h3", status: "declined", sentAt: d("2026-04-05"), declinedAt: d("2026-04-06"), total: Infinity, declineReason: { text: "nope" } },
  { id: "h4", status: "accepted", sentAt: d("2026-04-05"), acceptedAt: d("2026-04-06"), total: undefined, acceptedTotal: "1e400" },
  { id: "h5", status: "accepted", sentAt: d("2026-04-05"), acceptedAt: d("1970-01-01"), total: 100 },
  { id: "h6", status: "weird_status", sentAt: d("2026-04-05"), total: 100 },
  { id: "h7", status: "declined", sentAt: d("2026-04-05"), declinedAt: d("2026-04-06"), total: 100, declineReason: "\n\t  \n" },
];

let hostile = null;
let threw = null;
try {
  hostile = buildWinLoss({ from: FROM, to: TO, quotes: HOSTILE });
} catch (err) {
  threw = err;
}
ok("junk rows do not throw", threw === null, threw?.message);
ok("…and produce no NaN or Infinity anywhere in the payload",
  hostile && badNumbers(hostile).length === 0, hostile && badNumbers(hostile));
ok("a non-string reason is not a reason",
  hostile && !hostile.reasons.verbatim.some((v) => v.reasons.some((s) => typeof s !== "string")));
ok("…and neither is whitespace with newlines in it",
  hostile && hostile.reasons.verbatim.every((v) => v.reasons.every((s) => s.trim().length > 0)),
  hostile && hostile.reasons.verbatim);
ok("an unreadable total is not silently added in as zero",
  hostile && hostile.value.lost.unpriced > 0, hostile && hostile.value.lost);
ok("an unrecognised status is neither won nor lost",
  hostile && hostile.counts.outstanding >= 1, hostile && hostile.counts);

// The two range guards, which are the only things this builder refuses over.
for (const [label, args] of [
  ["a backwards range", { from: TO, to: FROM, quotes: [] }],
  ["a nonsense date", { from: "banana", to: TO, quotes: [] }],
  ["a missing range", { quotes: [] }],
]) {
  let caught = null;
  try {
    buildWinLoss(args);
  } catch (err) {
    caught = err;
  }
  ok(`${label} is refused with a 400, not answered with zeroes`, caught?.status === 400,
    caught?.message);
}

// Division by zero, directly: every rate in an all-zero report.
ok("no rate divides by zero",
  [empty.winRate.value, empty.reasons.unexplainedShare.value].every((v) => v === null),
  [empty.winRate, empty.reasons.unexplainedShare]);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n9. The route, EXECUTED — a crew member is refused\n");
//
// Section 8 of scripts/check-crew-access.mjs says why a regex is not enough
// here: it proves a gate is written down, passes happily against a guard
// disabled with `false &&`, and is exactly how a check comes to certify a hole.
// So the real GET handler runs, with "@/lib/db", "@/lib/currentMember" and
// "next/server" swapped for stubs, and the assertions are made against the
// status and the body that come back.
//
// What is being protected: every figure on this report is what clients were
// quoted — the rate card in aggregate — beside every client's name and, in the
// verbatim block, sentences a homeowner said about the company's prices.

globalThis.__FQ_ROWS = { member: [], quote: [], company: [] };

function matchWhere(row, where = {}) {
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    const value = row[key];
    if (cond === null) {
      if (value !== null && value !== undefined) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond) {
        if (!cond.in.includes(value)) return false;
        continue;
      }
      if ("gte" in cond || "lte" in cond) {
        if (value == null) return false;
        const ts = value instanceof Date ? value.getTime() : new Date(value).getTime();
        if ("gte" in cond && ts < cond.gte.getTime()) return false;
        if ("lte" in cond && ts > cond.lte.getTime()) return false;
        continue;
      }
      if (!matchWhere(value, cond)) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}

function project(row, spec = {}) {
  if (!row || !spec.select) return row;
  const out = {};
  for (const [key, sub] of Object.entries(spec.select)) {
    out[key] = sub === true ? row[key] : project(row[key], sub);
  }
  return out;
}

function stubModel(name) {
  const all = () => globalThis.__FQ_ROWS[name] || [];
  return {
    async findMany(args = {}) {
      return all().filter((r) => matchWhere(r, args.where)).map((r) => project(r, args));
    },
    async findUnique(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? project(hit, args) : null;
    },
    async count(args = {}) {
      return all().filter((r) => matchWhere(r, args.where)).length;
    },
  };
}

globalThis.__FQ_DB = new Proxy(
  { member: stubModel("member"), quote: stubModel("quote"), company: stubModel("company") },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Loud, not quiet: a check must never pass because a query it did not
      // model answered "nothing".
      throw new Error(`dbStub: db.${String(prop)} is not scripted in this check`);
    },
  },
);

globalThis.__FQ_MEMBER = async () => globalThis.__FQ_SESSION;

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "next/server": "fq-stub:next",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    return { format: "module", shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  }
  if (url === "fq-stub:member") {
    return { format: "module", shortCircuit: true,
      source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);" };
  }
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const winLossRoute = await import("@/app/api/analytics/win-loss/route.js");

globalThis.__FQ_ROWS.company = [{ id: "co", currency: "CAD" }];
globalThis.__FQ_ROWS.quote = QUOTES.map((row) => ({ ...row, companyId: "co" }));
globalThis.__FQ_ROWS.member = [
  { id: "m_crew", userId: "u_crew", role: "employee", companyId: "co", permissions: { ...PERMISSION_PRESETS.worker.values } },
  { id: "m_est", userId: SAM, role: "employee", companyId: "co", permissions: { ...PERMISSION_PRESETS.estimator.values } },
  { id: "m_disp", userId: "u_disp", role: "supervisor", companyId: "co", permissions: { ...PERMISSION_PRESETS.dispatcher.values } },
  { id: "m_mgr", userId: "u_mgr", role: "supervisor", companyId: "co", permissions: { ...PERMISSION_PRESETS.manager.values } },
  { id: "m_owner", userId: "u_owner", role: "owner", companyId: "co", permissions: null },
  // Predates the grid entirely. hasLevel and hasToggle both FALL OPEN on a
  // member with no permissions object, deliberately and codebase-wide — the
  // note in lib/permissions/enforce.js says why: existing members predate the
  // grid and defaulting them to no access would lock out working accounts on
  // deploy. Asserted rather than left implicit, so that if that decision is
  // ever reversed this route is on the list of things to re-check.
  { id: "m_legacy", userId: "u_legacy", role: "employee", companyId: "co", permissions: null },
];

const url = (from = FROM, to = TO) =>
  `http://localhost/api/analytics/win-loss?from=${from}&to=${to}`;

async function callAs(memberId, from, to) {
  globalThis.__FQ_SESSION = globalThis.__FQ_ROWS.member.find((m) => m.id === memberId);
  return winLossRoute.GET({ url: url(from, to) });
}

const asCrew = await callAs("m_crew");
ok("Crew is REFUSED", asCrew.status === 403, asCrew.status);
ok("…with a sentence, not a permission map",
  typeof asCrew.body.error === "string" &&
    !/showPricing|quotes:/.test(asCrew.body.error), asCrew.body);
ok("…and no counts ride along on the refusal",
  asCrew.body.counts === undefined && asCrew.body.reasons === undefined, Object.keys(asCrew.body));

for (const [label, id] of [
  ["an Estimator", "m_est"],
  ["a Dispatcher", "m_disp"],
  ["a Manager", "m_mgr"],
  ["an owner with no grid at all", "m_owner"],
  ["a member predating the grid (documented fall-open)", "m_legacy"],
]) {
  const res = await callAs(id);
  ok(`${label} may read it`, res.status === 200, res.status);
}
// The boundary that matters: it is the GRID that refuses, not the role. Crew
// and the legacy member share the `employee` role and land on opposite sides.
ok("…so it is the grid refusing Crew, not the coarse role",
  globalThis.__FQ_ROWS.member.find((m) => m.id === "m_crew").role === "employee" &&
    globalThis.__FQ_ROWS.member.find((m) => m.id === "m_legacy").role === "employee");

const asEstimator = await callAs("m_est");
ok("the executed route returns the same arithmetic as the builder",
  asEstimator.body.counts.won === 6 &&
    asEstimator.body.counts.lost === 6 &&
    asEstimator.body.counts.outstanding === 3,
  asEstimator.body.counts);
ok("…the unexplained losses among it", asEstimator.body.reasons.unexplained === 4,
  asEstimator.body.reasons.unexplained);
ok("…and the never-sent quote counted as excluded, from its own query",
  asEstimator.body.excluded.undated === 1, asEstimator.body.excluded);
ok("…with no NaN in the wire payload", badNumbers(asEstimator.body).length === 0,
  badNumbers(asEstimator.body));

// The empty period, end to end rather than in the builder alone.
const asEstimatorEmpty = await callAs("m_est", "2020-01-01", "2020-01-31");
ok("an empty period comes back as absence over the wire",
  asEstimatorEmpty.status === 200 &&
    asEstimatorEmpty.body.hasData === false &&
    asEstimatorEmpty.body.winRate.value === null,
  asEstimatorEmpty.body.winRate);

const backwards = await callAs("m_est", TO, FROM);
ok("a backwards range is a 400, not three empty columns", backwards.status === 400, backwards.status);
const nonsense = await callAs("m_est", "yesterday", TO);
ok("a nonsense date is a 400 before Prisma ever sees it", nonsense.status === 400, nonsense.status);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n10. The back office can now type one — the change this began with\n");
//
// JSX, so this is the one section that reads source instead of running it, and
// it is matched positionally so that deleting the field or replacing it with a
// constant fails rather than passing on a stray mention.

const approval = readFileSync(
  join(ROOT, "app/app/quote-approval/[id]/page.js"),
  "utf8",
);
ok("the decline PATCH carries declineReason",
  /declineReason:\s*trimmed/.test(approval), false);
ok("…only on a decline, and only when something was typed",
  /status === "declined" && trimmed \? \{ declineReason: trimmed \} : \{\}/.test(approval), false);
ok("…the box is optional and free text, not a dropdown",
  /<textarea/.test(approval) && !/<select[^>]*decline/i.test(approval));
ok("…capped where the server caps it, so nothing is silently truncated",
  /maxLength=\{500\}/.test(approval) &&
    /slice\(0, 500\)/.test(readFileSync(join(ROOT, "lib/quotes/quoteLifecycle.js"), "utf8")));
ok("…and a blank box stays blank rather than becoming a category",
  /const trimmed = reason\.trim\(\);/.test(approval));
ok("what was typed is READ BACK on the same screen",
  /quote\.declineReason/.test(approval));

// The field is no longer console-only: something in /app reads it.
const page = readFileSync(join(ROOT, "app/app/analytics/win-loss/page.js"), "utf8");
ok("the contractor's own app renders the reasons",
  /reasons\.verbatim\.map/.test(page));
ok("…and the unexplained count beside them",
  /reasons\.unexplained/.test(page));
ok("…and the page is reachable from the Insights screen",
  /\/app\/analytics\/win-loss/.test(
    readFileSync(join(ROOT, "app/app/analytics/benchmark/page.js"), "utf8"),
  ));
// No percentage is computed on the page — the API decides whether one exists.
ok("the page never computes a rate of its own",
  !/counts\.won\s*\/\s*counts/.test(page) && !/\/\s*counts\.decided/.test(page));

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
