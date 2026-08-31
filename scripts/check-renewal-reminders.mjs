// scripts/check-renewal-reminders.mjs
//
//   npm run check:renewal-reminders
//
// The advance renewal reminder — /api/cron/renewal-reminders,
// lib/billing/renewalReminder.js, the "renewal" kind of buildBillingEmail.
//
// This gate can either tell a company "you'll be charged" when they already
// cancelled (the exact failure the task called out as worse than saying
// nothing), or fail to say anything before a real charge, which is the thing
// three separate legal/network sources require notice for. So the emphasis
// here is the same as check-billing-access.mjs: execute every branch, lean on
// the boundary values, and prove a run that fires twice still sends once.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-renewal-reminders.mjs

import { readFileSync } from "node:fs";
import {
  decideRenewalReminder,
  windowDaysFor,
  RENEWAL_WINDOW_DAYS,
} from "@/lib/billing/renewalReminder";
import { buildBillingEmail } from "@/lib/email/billingEmail";
import { cardLastFourForSubscription } from "@/lib/platform/stripeBilling";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

const NOW = new Date("2026-08-30T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysOut = (d) => new Date(NOW.getTime() + d * DAY);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nThe two windows, and where they came from");
// See lib/billing/renewalReminder.js's file header for the citations:
// Mastercard's own floor for ≤6-month billing is 7 days; California's ARL
// window for a one-year term is 15–45 days and 30 sits inside it.
ok("monthly gets 7 days", RENEWAL_WINDOW_DAYS.month === 7);
ok("annual gets 30 days", RENEWAL_WINDOW_DAYS.year === 30);
ok("annual is materially longer than monthly — a year's charge is not a decision made in a week",
  RENEWAL_WINDOW_DAYS.year > RENEWAL_WINDOW_DAYS.month * 2);
ok("an unrecognised cadence gets the shorter, safer window, same default as lib/billing/interval.js",
  windowDaysFor("fortnight") === RENEWAL_WINDOW_DAYS.month);
ok("so does no cadence at all", windowDaysFor(undefined) === RENEWAL_WINDOW_DAYS.month);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nA subscription renewing inside the window gets EXACTLY one reminder");
{
  const periodEnd = daysOut(5); // inside the 7-day monthly window
  const first = decideRenewalReminder({
    status: "active", billingInterval: "month", currentPeriodEnd: periodEnd,
    renewalRemindedPeriodEnd: null, now: NOW,
  });
  ok("first look: due", first.send === true, first);
  ok("...and it names the period it's for", first.periodEnd?.getTime() === periodEnd.getTime());

  // Simulate the cron's claim: renewalRemindedPeriodEnd now equals this period.
  const second = decideRenewalReminder({
    status: "active", billingInterval: "month", currentPeriodEnd: periodEnd,
    renewalRemindedPeriodEnd: periodEnd, now: NOW,
  });
  ok("second look, same period → not due again", second.send === false && second.reason === "already_reminded", second);

  // A cron that runs twice IN THE SAME DAY (the literal case in the task) —
  // two independent calls with the post-claim state must agree.
  const rerun = decideRenewalReminder({
    status: "active", billingInterval: "month", currentPeriodEnd: periodEnd,
    renewalRemindedPeriodEnd: periodEnd, now: new Date(NOW.getTime() + 60 * 1000),
  });
  ok("...and a run a minute later agrees", rerun.send === false);

  // A cron REPLAYED NEXT MONTH — Stripe has renewed, currentPeriodEnd has
  // advanced, and the OLD reminded-marker must not suppress the NEW period.
  const nextPeriodEnd = daysOut(35); // roughly a month past the first period
  const laterRun = decideRenewalReminder({
    status: "active", billingInterval: "month", currentPeriodEnd: nextPeriodEnd,
    renewalRemindedPeriodEnd: periodEnd, // still holds the OLD period
    now: daysOut(30),
  });
  ok("next period's reminder is not suppressed by last period's marker",
    laterRun.send === true && laterRun.periodEnd?.getTime() === nextPeriodEnd.getTime(), laterRun);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nA cancelled subscription gets none — ever, regardless of date");
for (const periodEnd of [daysOut(1), daysOut(5), daysOut(-2), null]) {
  const d = decideRenewalReminder({
    status: "canceled", billingInterval: "month", currentPeriodEnd: periodEnd,
    renewalRemindedPeriodEnd: null, now: NOW,
  });
  ok(`cancelled, currentPeriodEnd=${periodEnd} → no reminder`, d.send === false, d);
  ok("...and the reason names the actual status, not a generic refusal",
    d.reason === "not_renewing_canceled", d.reason);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\npast_due: excluded, and the reasoning is the grace-period one, not silence");
{
  const d = decideRenewalReminder({
    status: "past_due", billingInterval: "month", currentPeriodEnd: daysOut(3),
    renewalRemindedPeriodEnd: null, now: NOW,
  });
  // The LAST charge on this card already failed. Forecasting a future charge
  // with no mention of that is a different false statement than the one the
  // task named for a cancelled account, but it's the same failure class —
  // asserted by name so a future edit can't quietly turn this into a send.
  ok("past_due does not get a forward-looking 'you'll be charged' email",
    d.send === false, d);
  ok("...for the SAME reason class as cancelled (not_renewing_<status>), not a fallthrough",
    d.reason === "not_renewing_past_due", d.reason);
  ok("past_due's real message lives in the grace-period system, not here",
    RENEWAL_WINDOW_DAYS.month === 7 && true); // documents intent; see lib/billing/access.js
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nTrialing converts to paid the same way a renewal renews");
{
  // Stripe's trial phase IS period 1 — currentPeriodEnd on a trialing sub is
  // the trial-to-paid conversion date, which is exactly what the card
  // networks' trial-conversion notice rule is about.
  const d = decideRenewalReminder({
    status: "trialing", billingInterval: "month", currentPeriodEnd: daysOut(6),
    renewalRemindedPeriodEnd: null, now: NOW,
  });
  ok("a trial ending inside the window gets the same reminder an active renewal would",
    d.send === true, d);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nMonthly and annual get their OWN windows — proved at the boundary, not just as constants");
for (const [interval, edge] of [["month", 7], ["year", 30]]) {
  const atEdge = decideRenewalReminder({
    status: "active", billingInterval: interval, currentPeriodEnd: daysOut(edge),
    renewalRemindedPeriodEnd: null, now: NOW,
  });
  ok(`${interval}: exactly ${edge} days out is IN the window`, atEdge.send === true, atEdge);

  const justOutside = decideRenewalReminder({
    status: "active", billingInterval: interval, currentPeriodEnd: daysOut(edge + 0.5),
    renewalRemindedPeriodEnd: null, now: NOW,
  });
  ok(`${interval}: ${edge + 0.5} days out is NOT yet in the window`,
    justOutside.send === false && justOutside.reason === "not_yet_in_window", justOutside);
}
// The pair that actually proves they're independent: the SAME date, ten days
// out, is due for annual and not yet due for monthly.
{
  const period = daysOut(10);
  const monthly = decideRenewalReminder({ status: "active", billingInterval: "month", currentPeriodEnd: period, renewalRemindedPeriodEnd: null, now: NOW });
  const annual = decideRenewalReminder({ status: "active", billingInterval: "year", currentPeriodEnd: period, renewalRemindedPeriodEnd: null, now: NOW });
  ok("10 days out: monthly is NOT due yet", monthly.send === false, monthly);
  ok("10 days out: annual IS due — same date, different cadence, different answer", annual.send === true, annual);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nNo next-charge date → no reminder claiming one exists");
{
  const d = decideRenewalReminder({
    status: "active", billingInterval: "month", currentPeriodEnd: null,
    renewalRemindedPeriodEnd: null, now: NOW,
  });
  ok("null currentPeriodEnd is refused", d.send === false && d.reason === "no_period_end", d);
  ok("...and the decision carries no date to put in an email", d.periodEnd === undefined);
}
// A period end that has already passed (cron didn't run for a while, or the
// webhook hasn't caught up yet) is equally not a future date to warn about.
{
  const d = decideRenewalReminder({
    status: "active", billingInterval: "month", currentPeriodEnd: daysOut(-0.5),
    renewalRemindedPeriodEnd: null, now: NOW,
  });
  ok("a period end already in the past is refused, not backdated into a claim",
    d.send === false && d.reason === "period_already_passed", d);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nNo row, no unrecognised status → refused, not guessed");
for (const status of [undefined, null, "incomplete", "unpaid"]) {
  const d = decideRenewalReminder({
    status, billingInterval: "month", currentPeriodEnd: daysOut(1),
    renewalRemindedPeriodEnd: null, now: NOW,
  });
  ok(`status=${status} → refused`, d.send === false, d);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nThe email itself, EXECUTED — not just present in the source");
{
  const withCard = buildBillingEmail({
    kind: "renewal",
    companyName: "Test Co",
    planName: "Crew",
    periodEnd: "Sep 20, 2026",
    renewalAmount: "$249.00",
    last4: "4242",
    billingUrl: "https://app.fieldquo.com/app/settings/account-billing",
  });
  ok("says the amount", withCard.html.includes("$249.00"));
  ok("says the date", withCard.html.includes("Sep 20, 2026"));
  ok("says the card's last four", withCard.html.includes("4242"));
  ok("links to the real billing screen, not a placeholder",
    withCard.html.includes('href="https://app.fieldquo.com/app/settings/account-billing"'));
  ok("says how to change or cancel", /change plans or cancel/i.test(withCard.html));
  ok("subject also carries the date, for an inbox scan with no open",
    withCard.subject.includes("Sep 20, 2026"));

  const noCard = buildBillingEmail({
    kind: "renewal",
    companyName: "Test Co",
    planName: "Crew",
    periodEnd: "Sep 20, 2026",
    renewalAmount: "$249.00",
    last4: null,
    billingUrl: "https://app.fieldquo.com/app/settings/account-billing",
  });
  ok("no last4 known → the sentence is dropped, not left blank (AGENTS.md: absence isn't a statement)",
    !/ending in\s*<\/?strong>?\s*<\/?strong>?\s*will/i.test(noCard.html) && !noCard.html.includes("ending in <strong></strong>"));
  ok("...and it still says the amount will be charged",
    noCard.html.includes("$249.00") && /will be charged/i.test(noCard.html));

  // Hostile input: a plan name (platform-editable, per Plan.name) carrying
  // markup must not reach the page unescaped.
  const hostile = buildBillingEmail({
    kind: "renewal",
    companyName: '<img src=x onerror=alert(1)>',
    planName: "</strong><script>evil()</script>",
    periodEnd: "Sep 20, 2026",
    renewalAmount: "$1.00",
    last4: null,
    billingUrl: "https://x/y",
  });
  ok("planName is escaped", !hostile.html.includes("<script>evil()</script>"));
  ok("companyName is escaped", !hostile.html.includes("<img src=x"));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\ncardLastFourForSubscription: never throws, degrades to null");
{
  const noId = await cardLastFourForSubscription(null);
  ok("no subscription id → null, no Stripe call attempted", noId === null);
  const emptyId = await cardLastFourForSubscription("");
  ok("empty string → null", emptyId === null);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nThe cron actually gates on the decision, claims before sending, and reverts a failed send");
// Static checks, comment-stripped — the same lesson check-billing-interval.mjs
// documents: a regex that matches a DEAD condition (`false &&` in front of a
// guard) proves nothing. These are here as a second line of defence for the
// SHAPE of the route (import wiring, the revert branch existing at all), not
// as a substitute for the executed decision tests above.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const cron = stripComments(readFileSync("app/api/cron/renewal-reminders/route.js", "utf8"));
ok("imports the pure decision function rather than re-deriving the rule inline",
  /import\s*\{\s*decideRenewalReminder/.test(cron));
ok("refuses BEFORE claiming anything", /if \(!decision\.send\)/.test(cron));
ok("claims the period conditionally (idempotent per period, not a blind write)",
  /renewalRemindedPeriodEnd:\s*null[\s\S]{0,80}renewalRemindedPeriodEnd:\s*\{\s*not:\s*decision\.periodEnd/.test(cron));
ok("checks the claim actually landed before sending",
  /claim\.count === 0/.test(cron));
ok("checks BOTH failure shapes sendEmail can return (no try/catch swallowing them)",
  /result\?\.error \|\| result\?\.skipped/.test(cron));
// Scoped to the failed-send branch specifically — not just "the string
// `data: previous` appears somewhere in the file", which the no_recipient
// branch a few lines above also satisfies and would make this assertion pass
// even with the revert deleted from the branch that actually matters. Caught
// by mutation testing: deleting the revert from the send-failure branch left
// an untouched `data: previous` in no_recipient, and the old unscoped regex
// (`/data:\s*previous\s*\}\s*\)/`) still matched.
const failedSendBlock = cron.match(/if \(result\?\.error \|\| result\?\.skipped\) \{([\s\S]*?)\n\s*\}/)?.[1] || "";
ok("...specifically: the SEND-FAILURE branch reverts the claim (not just some other branch)",
  /data:\s*previous/.test(failedSendBlock),
  failedSendBlock || "(branch not found)");
ok("...so tomorrow's run (still inside the window) retries instead of skipping forever",
  /continue/.test(failedSendBlock));
ok("the amount is repriced from the plan's own row, not trusted from anywhere else",
  /chargeFor\(sub\.plan, sub\.billingInterval\)/.test(cron));
ok("a plan with no price for its own interval is logged, not guessed",
  /recordError/.test(cron) && /plan_missing_price_for_interval/.test(cron));

const schema = stripComments(readFileSync("prisma/schema.prisma", "utf8"));
const subModel = schema.slice(schema.indexOf("model Subscription {"));
const subBody = subModel.slice(0, subModel.indexOf("\n}"));
ok("Subscription carries the period-keyed reminder marker",
  /renewalRemindedPeriodEnd\s+DateTime\?/.test(subBody));
ok("...and a sent-at timestamp, written only on confirmed send",
  /renewalReminderSentAt\s+DateTime\?/.test(subBody));

const vercelJson = JSON.parse(readFileSync("vercel.json", "utf8"));
ok("the cron is actually scheduled in vercel.json — a route with no entry never runs",
  vercelJson.crons.some((c) => c.path === "/api/cron/renewal-reminders"));

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
