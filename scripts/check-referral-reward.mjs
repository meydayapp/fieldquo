// scripts/check-referral-reward.mjs
//
// What a referral is actually worth, on both cadences.
//
// ══ What it used to be ═════════════════════════════════════════════════════
//
// The referrer got a Stripe customer-balance credit equal to the amount the
// REFERRED company had just paid. That is "a free month" only while both sit on
// the same tier — a Scale referrer who introduced a Solo company received $129
// against a $389 bill: a third of a month, described as a month.
//
// It is a month of the product now, on both sides, which is one sentence a
// contractor can be told. The owner set both sides at ONE month, overriding the
// three in AGENTS.md; that file was corrected rather than left to disagree with
// the code.
//
// ══ The two things that must not happen ════════════════════════════════════
//
//   * A second referral must EXTEND the first, not replace it. Extending from
//     "now" instead of from the end of what they already hold would quietly
//     shorten a stacked reward, and nobody would notice — the subscriber just
//     gets billed a month earlier than they were promised.
//   * A free month must not trigger a renewal. The month is a DEFERRAL of the
//     next invoice; an annual subscriber given a free month must not be charged
//     for a second year in order to receive it.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-referral-reward.mjs

import { readFileSync } from "node:fs";
import { nextAccessEnd, addMonths } from "@/lib/referrals/extendAccess";
import { REFEREE_BONUS_MONTHS, REFERRER_BONUS_MONTHS } from "@/lib/referrals";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
const day = (d) => new Date(d).toISOString().slice(0, 10);
const NOW = new Date("2026-08-27T12:00:00Z");

console.log("\nBoth sides get the same thing");
ok("the referee gets one month", REFEREE_BONUS_MONTHS === 1, REFEREE_BONUS_MONTHS);
ok("the referrer gets one month", REFERRER_BONUS_MONTHS === 1, REFERRER_BONUS_MONTHS);
// The whole point of the change: a reward measured in TIME, not in the other
// company's money.
ok(
  "and they are equal — one sentence describes the programme",
  REFEREE_BONUS_MONTHS === REFERRER_BONUS_MONTHS,
);

console.log("\nThe owner's worked example: an annual year ending 2027-08-27");
let end = new Date("2027-08-27T00:00:00Z");
const got = [];
for (let i = 0; i < 3; i++) {
  const r = nextAccessEnd({ periodEnd: end, paying: true, months: 1, now: NOW });
  got.push(day(r.until));
  // Stripe reports the new trial_end as current_period_end, so the next
  // referral reads it as the anchor — which is what makes them stack.
  end = r.until;
}
ok("one referral: free to 2027-09-27", got[0] === "2027-09-27", got[0]);
ok("a second: extended to 2027-10-27, not back to September", got[1] === "2027-10-27", got[1]);
ok("a third: 2027-11-27", got[2] === "2027-11-27", got[2]);

console.log("\nMonth to month — the credit lands on the next month");
const monthly = nextAccessEnd({
  periodEnd: new Date("2026-09-27T00:00:00Z"),
  paying: true,
  months: 1,
  now: NOW,
});
ok("a monthly period ending 09-27 runs to 10-27", day(monthly.until) === "2026-10-27", day(monthly.until));
ok("...which is exactly one skipped monthly charge", monthly.from === "period");

console.log("\nStill on trial");
const trial = nextAccessEnd({
  trialEndsAt: new Date("2026-09-26T00:00:00Z"),
  paying: false,
  months: 1,
  now: NOW,
});
ok("the trial is pushed out a month", day(trial.until) === "2026-10-26", day(trial.until));
ok("...from the trial, not from today", trial.from === "trial");

console.log("\nA date in the past never shortens the reward");
// A stale column, or a lapsed subscription. Anchoring to it would hand back a
// month that has already gone by — a reward worth nothing, silently.
for (const [label, args] of [
  ["a stale period end", { periodEnd: new Date("2020-01-01"), paying: true }],
  ["an expired trial", { trialEndsAt: new Date("2020-01-01"), paying: false }],
  ["no dates at all", { paying: false }],
  ["null dates", { periodEnd: null, trialEndsAt: null, paying: true }],
  ["a junk date", { periodEnd: "not a date", paying: true }],
]) {
  const r = nextAccessEnd({ ...args, months: 1, now: NOW });
  ok(`${label} -> a full month from today`, day(r.until) === "2026-09-27" && r.from === "now", day(r.until));
}

console.log("\nCalendar arithmetic, where months are not 30 days");
ok("Jan 31 + 1 month clamps to Feb 28", day(addMonths(new Date("2027-01-31T00:00:00Z"), 1)) === "2027-02-28");
ok("...and to Feb 29 in a leap year", day(addMonths(new Date("2028-01-31T00:00:00Z"), 1)) === "2028-02-29");
ok("Dec 31 + 1 crosses the year", day(addMonths(new Date("2027-12-31T00:00:00Z"), 1)) === "2028-01-31");

console.log("\nThe gift is not taken back on the next invoice");
const src = readFileSync("lib/referrals/extendAccess.js", "utf8");
// Without this, Stripe prorates the deferred period and bills it back — giving
// the month with one hand and invoicing it with the other.
ok('proration_behavior is "none"', /proration_behavior:\s*"none"/.test(src));
ok("the deferral is trial_end on the live subscription", /trial_end:/.test(src));
// The period end is read from Stripe, not from our column: that column is
// written by a webhook, and extending from a stale one silently shortens or
// doubles the reward.
ok("the anchor is read from Stripe, not from our row",
  /stripe\.subscriptions\.retrieve/.test(src));

const ref = readFileSync("lib/referrals/index.js", "utf8");
ok("the referrer's reward is access, not a balance credit",
  /extendAccessByMonths\(referrer\.id, REFERRER_BONUS_MONTHS\)/.test(ref));
// A row with no appliedTrialEndsAt is a reward owed and visibly unpaid. A
// missing row is a reward nobody can find, and the same referral pays twice.
ok("the credit row is written even when the extension fails",
  /appliedTrialEndsAt: grant\.ok \? grant\.until : null/.test(ref));

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
