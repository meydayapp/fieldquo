// scripts/check-grace-warning.mjs
//
//   npm run check:grace-warning
//
// The past-due grace warning — /api/cron/grace-warning,
// lib/billing/graceWarning.js, the "grace" kind of buildBillingEmail.
//
// Subscription.graceWarnedAt carried the doc comment "set when the 'you have
// N days left' email goes out" for a long time with nothing ever setting it
// — a field written only in reverse (nulled on recovery) and never forward.
// So the emphasis here, same as check-renewal-reminders.mjs, is: execute
// every branch, lean on the boundary values, and prove a run that fires
// twice still sends once — plus, specific to this gate, prove the SECOND
// warning actually fires near the end of the window rather than the column
// just quietly gaining a sibling nothing reads either.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-grace-warning.mjs

import { readFileSync } from "node:fs";
import {
  graceWarningDecision,
  FINAL_WARNING_AT_OR_BELOW_DAYS,
} from "@/lib/billing/graceWarning";
import { GRACE_DAYS } from "@/lib/billing/access";
import { buildBillingEmail } from "@/lib/email/billingEmail";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

const NOW = new Date("2026-08-30T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (d) => new Date(NOW.getTime() - d * DAY);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nA past-due subscription inside the window warns exactly once");
{
  const pastDueSince = ago(1); // daysLeft = 6, nowhere near the final window
  const first = graceWarningDecision({
    status: "past_due", pastDueSince, graceWarnedAt: null, graceFinalWarnedAt: null, now: NOW,
  });
  ok("first look: warn_first", first.action === "warn_first", first);
  ok("...and it carries the days remaining", first.daysLeft === 6, first);

  // Simulate the cron's claim landing: graceWarnedAt now equals NOW.
  const second = graceWarningDecision({
    status: "past_due", pastDueSince, graceWarnedAt: NOW, graceFinalWarnedAt: null, now: NOW,
  });
  ok("second look, same run → not due again (not yet in the final window)",
    second.action === "wait" && second.reason === "not_yet_final_window", second);

  // A cron that runs twice IN THE SAME invocation window (the literal replay
  // case in the task) — two independent calls against the post-claim state
  // must agree with each other, not just with themselves.
  const rerun = graceWarningDecision({
    status: "past_due", pastDueSince, graceWarnedAt: NOW, graceFinalWarnedAt: null,
    now: new Date(NOW.getTime() + 60 * 1000),
  });
  ok("...and a run a minute later agrees", rerun.action === "wait", rerun);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nThe SECOND warning fires near the end, and only once");
{
  // 3 days left: first already sent, final window (<=2) not reached yet.
  const notYet = graceWarningDecision({
    status: "past_due", pastDueSince: ago(4), graceWarnedAt: ago(3), graceFinalWarnedAt: null, now: NOW,
  });
  ok("3 days left, first already sent → wait, not final yet",
    notYet.action === "wait" && notYet.reason === "not_yet_final_window", notYet);

  // Exactly at the boundary: 2 days left.
  const atEdge = graceWarningDecision({
    status: "past_due", pastDueSince: ago(5), graceWarnedAt: ago(4), graceFinalWarnedAt: null, now: NOW,
  });
  ok(`exactly ${FINAL_WARNING_AT_OR_BELOW_DAYS} days left → warn_final`,
    atEdge.action === "warn_final" && atEdge.daysLeft === FINAL_WARNING_AT_OR_BELOW_DAYS, atEdge);

  // One tick before the boundary: 3 days left must NOT fire final (covered by
  // notYet above with concrete numbers; this restates it with the constant so
  // a change to the threshold constant is what the assertion tracks).
  const justOutside = graceWarningDecision({
    status: "past_due", pastDueSince: ago(GRACE_DAYS - (FINAL_WARNING_AT_OR_BELOW_DAYS + 1)),
    graceWarnedAt: ago(1), graceFinalWarnedAt: null, now: NOW,
  });
  ok(`${FINAL_WARNING_AT_OR_BELOW_DAYS + 1} days left is NOT yet the final window`,
    justOutside.action === "wait", justOutside);

  // Once both are sent, nothing more goes out for the rest of the episode.
  const bothSent = graceWarningDecision({
    status: "past_due", pastDueSince: ago(6), graceWarnedAt: ago(5), graceFinalWarnedAt: ago(1), now: NOW,
  });
  ok("both already sent → wait, reason names it", bothSent.action === "wait" && bothSent.reason === "both_sent", bothSent);

  // Running the final-warning claim twice in the same run: the SECOND call
  // (post-claim, graceFinalWarnedAt now set) must not fire again.
  const finalRerun = graceWarningDecision({
    status: "past_due", pastDueSince: ago(5), graceWarnedAt: ago(4), graceFinalWarnedAt: NOW, now: NOW,
  });
  ok("final warning claimed → a same-run replay sends nothing more",
    finalRerun.action === "wait" && finalRerun.reason === "both_sent", finalRerun);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nAn active subscription gets nothing");
for (const status of ["active", "trialing"]) {
  const d = graceWarningDecision({
    status, pastDueSince: null, graceWarnedAt: null, graceFinalWarnedAt: null, now: NOW,
  });
  ok(`${status} → skip`, d.action === "skip", d);
  ok(`...and the reason names the actual status`, d.reason === `not_past_due_${status}`, d.reason);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nA CANCELLED subscription gets nothing — cancelling is a different situation, not a payment failure");
{
  const d = graceWarningDecision({
    status: "canceled", pastDueSince: ago(3), graceWarnedAt: null, graceFinalWarnedAt: null, now: NOW,
  });
  ok("cancelled → skip", d.action === "skip", d);
  ok("...with its OWN reason, not a fallthrough to the generic not_past_due_ case",
    d.reason === "cancelled_different_situation", d.reason);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nGrace already expired before anyone warned — the judgement call, executed");
{
  // pastDueSince far enough back that accessFor() already reports "locked".
  const d = graceWarningDecision({
    status: "past_due", pastDueSince: ago(GRACE_DAYS + 5), graceWarnedAt: null, graceFinalWarnedAt: null, now: NOW,
  });
  ok("already locked, never warned → skip, not a backdated 'you have 0 days left'",
    d.action === "skip" && d.reason === "grace_expired", d);

  // Exactly at the boundary: GRACE_DAYS elapsed is the first instant locked.
  const atLock = graceWarningDecision({
    status: "past_due", pastDueSince: ago(GRACE_DAYS), graceWarnedAt: null, graceFinalWarnedAt: null, now: NOW,
  });
  ok(`exactly ${GRACE_DAYS} days elapsed → locked → skip`, atLock.action === "skip" && atLock.reason === "grace_expired", atLock);

  // One tick before that boundary is still a live warning opportunity.
  const justBeforeLock = graceWarningDecision({
    status: "past_due", pastDueSince: ago(GRACE_DAYS - 0.01), graceWarnedAt: null, graceFinalWarnedAt: null, now: NOW,
  });
  ok("a hair before locked → still warns (warn_first, if not yet sent)",
    justBeforeLock.action === "warn_first", justBeforeLock);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nRecovery, then relapse: clearPastDue nulled the marker, so it warns again");
{
  // This models exactly what lib/billing/access.js's clearPastDue() does on
  // recovery: pastDueSince, graceWarnedAt and graceFinalWarnedAt are all
  // nulled. A LATER, independent past-due episode starts clean.
  const relapse = graceWarningDecision({
    status: "past_due", pastDueSince: ago(0.1), graceWarnedAt: null, graceFinalWarnedAt: null, now: NOW,
  });
  ok("fresh episode after a cleared marker → warn_first again, not suppressed by history",
    relapse.action === "warn_first", relapse);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nNo pastDueSince (our bug, not theirs) still gets a warning, clock starts now");
{
  const d = graceWarningDecision({
    status: "past_due", pastDueSince: null, graceWarnedAt: null, graceFinalWarnedAt: null, now: NOW,
  });
  ok("null pastDueSince → warn_first with the FULL window, same as accessFor()'s own fallback",
    d.action === "warn_first" && d.daysLeft === GRACE_DAYS, d);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nNo row, no unrecognised status → skipped, not guessed");
for (const status of [undefined, null, "incomplete", "unpaid"]) {
  const d = graceWarningDecision({
    status, pastDueSince: ago(1), graceWarnedAt: null, graceFinalWarnedAt: null, now: NOW,
  });
  ok(`status=${status} → skip`, d.action === "skip", d);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nThe email itself, EXECUTED — not just present in the source");
{
  const first = buildBillingEmail({
    kind: "grace",
    companyName: "Test Co",
    daysLeft: 6,
    finalWarning: false,
    billingUrl: "https://app.fieldquo.com/app/settings/account-billing",
  });
  ok("says what happened (payment didn't go through)", /didn.t go through/i.test(first.html));
  ok("says what it means right now: read-only", /read-only/i.test(first.html));
  ok("says nothing has been deleted", /nothing has been deleted/i.test(first.html));
  ok("says exactly how many days remain", first.html.includes("6 days"));
  ok("does not threaten — no cancel/terminate/lose access language",
    !/terminat|forfeit|lose access|delete(?!d)/i.test(first.html));
  ok("links to the one fix", first.html.includes('href="https://app.fieldquo.com/app/settings/account-billing"'));
  ok("subject is the softer first-warning framing, not 'last chance'",
    !/last chance/i.test(first.subject));

  const final = buildBillingEmail({
    kind: "grace",
    companyName: "Test Co",
    daysLeft: 1,
    finalWarning: true,
    billingUrl: "https://app.fieldquo.com/app/settings/account-billing",
  });
  ok("final notice: singular day phrasing, not '1 days'", final.html.includes("1 day") && !final.html.includes("1 days"));
  ok("final notice: subject signals urgency", /last chance/i.test(final.subject));
  ok("final notice: still explicitly says nothing has been deleted",
    /nothing has been deleted/i.test(final.html));
  ok("final notice: still says read-only, the true current state, not a threat about the future",
    /read-only/i.test(final.html));

  // Hostile input: Company.name is user-editable and must not reach the page
  // unescaped.
  const hostile = buildBillingEmail({
    kind: "grace",
    companyName: '<img src=x onerror=alert(1)>',
    daysLeft: 2,
    finalWarning: true,
    billingUrl: "https://x/y",
  });
  ok("companyName is escaped", !hostile.html.includes("<img src=x"));

  // No billingUrl → no dangling CTA (defensive; every real caller passes one).
  const noUrl = buildBillingEmail({ kind: "grace", companyName: "Test Co", daysLeft: 4, finalWarning: false });
  ok("no billingUrl → no href printed", !noUrl.html.includes("href=\"undefined\""));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nThe cron actually gates on the decision, claims per-warning before sending, and reverts a failed send");
// Static checks, comment-stripped — the same lesson check-renewal-reminders.mjs
// documents: a regex that matches a DEAD condition, or an unscoped one that
// matches an unrelated branch a few lines away, proves nothing. These are a
// second line of defence for the SHAPE of the route, not a substitute for the
// executed decision tests above.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const cron = stripComments(readFileSync("app/api/cron/grace-warning/route.js", "utf8"));

ok("imports the pure decision function rather than re-deriving the rule inline",
  /import\s*\{\s*graceWarningDecision/.test(cron));
ok("queries ONLY status past_due — cancelled must never even be a candidate row",
  /where:\s*\{\s*status:\s*"past_due"\s*\}/.test(cron));
ok("refuses anything that isn't warn_first/warn_final before claiming",
  /decision\.action !== "warn_first" && decision\.action !== "warn_final"/.test(cron));
ok("the claim is guarded on the specific field still being null (idempotent per warning, not a blind write)",
  /where:\s*\{\s*id:\s*sub\.id,\s*\[field\]:\s*null\s*\}/.test(cron));
ok("checks the claim actually landed before sending",
  /claim\.count === 0/.test(cron));
ok("checks BOTH failure shapes sendEmail can return (no try/catch swallowing them)",
  /result\?\.error \|\| result\?\.skipped/.test(cron));

// Scoped to the failed-send branch specifically, the exact trap
// check-renewal-reminders.mjs's comment warns about: an unscoped regex for
// `data: { [field]: null }` also matches the no_recipient branch a few lines
// above, and would keep passing even with the revert deleted from the branch
// that actually matters.
const failedSendBlock = cron.match(/if \(result\?\.error \|\| result\?\.skipped\) \{([\s\S]*?)\n\s*\}/)?.[1] || "";
ok("...specifically: the SEND-FAILURE branch reverts the claim (not just some other branch)",
  /data:\s*\{\s*\[field\]:\s*null\s*\}/.test(failedSendBlock),
  failedSendBlock || "(branch not found)");
ok("...so a later run (still inside the window, in most cases) retries instead of skipping forever",
  /continue/.test(failedSendBlock));

// Same trap, other branch: no_recipient must ALSO revert, scoped to itself
// rather than trusted because "some `[field]: null` exists somewhere".
const noRecipientBlock = cron.match(/if \(!to\) \{([\s\S]*?)\n\s*\}/)?.[1] || "";
ok("the no-recipient branch reverts the claim too",
  /data:\s*\{\s*\[field\]:\s*null\s*\}/.test(noRecipientBlock),
  noRecipientBlock || "(branch not found)");

const schema = stripComments(readFileSync("prisma/schema.prisma", "utf8"));
const subModel = schema.slice(schema.indexOf("model Subscription {"));
const subBody = subModel.slice(0, subModel.indexOf("\n}"));
ok("Subscription carries the first-warning marker",
  /graceWarnedAt\s+DateTime\?/.test(subBody));
ok("...and its own final-warning marker, not a boolean bolted onto the first",
  /graceFinalWarnedAt\s+DateTime\?/.test(subBody));

// Both clearing sites must null BOTH markers — a JS-level assertion for the
// same reason as the cron's own regexes: grepping the whole file for
// "graceFinalWarnedAt: null" would also pass if it appeared in an unrelated
// function, so each is scoped to its own function body.
const accessSrc = stripComments(readFileSync("lib/billing/access.js", "utf8"));
const clearFn = accessSrc.slice(accessSrc.indexOf("export async function clearPastDue"));
const clearBody = clearFn.slice(0, clearFn.indexOf("\n}") + 2);
ok("clearPastDue() nulls graceWarnedAt", /graceWarnedAt:\s*null/.test(clearBody));
ok("clearPastDue() ALSO nulls graceFinalWarnedAt — a relapse must get both warnings again, not just the first",
  /graceFinalWarnedAt:\s*null/.test(clearBody));

const reconcileSrc = stripComments(readFileSync("app/api/settings/subscription/reconcile/route.js", "utf8"));
ok("the reconcile route's nowLive branch nulls both grace markers together",
  /nowLive[\s\S]{0,40}graceWarnedAt:\s*null,\s*graceFinalWarnedAt:\s*null/.test(reconcileSrc));

const vercelJson = JSON.parse(readFileSync("vercel.json", "utf8"));
ok("the cron is actually scheduled in vercel.json — a route with no entry never runs",
  vercelJson.crons.some((c) => c.path === "/api/cron/grace-warning"));

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
