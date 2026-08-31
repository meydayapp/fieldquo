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
// notice actually fires near the end of the window rather than the column
// just quietly gaining a sibling nothing reads either, and prove the email's
// register is the empathetic one the owner asked for, not just present in
// the source as a comment saying it should be.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-grace-warning.mjs

import { readFileSync } from "node:fs";
import {
  graceWarningDecision,
  REMIND_AT_OR_BELOW_DAYS,
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
  const pastDueSince = ago(1); // daysLeft = 6, nowhere near the reminder window
  const first = graceWarningDecision({
    status: "past_due", pastDueSince, graceWarnedAt: null, graceFinalWarnedAt: null, now: NOW,
  });
  ok("first look: grace_start", first.action === "grace_start", first);
  ok("...and it carries the days remaining", first.daysLeft === 6, first);
  ok("...and a lock date GRACE_DAYS after pastDueSince",
    first.lockAt.getTime() === pastDueSince.getTime() + GRACE_DAYS * DAY, first.lockAt);

  // Simulate the cron's claim landing: graceWarnedAt now equals NOW.
  const second = graceWarningDecision({
    status: "past_due", pastDueSince, graceWarnedAt: NOW, graceFinalWarnedAt: null, now: NOW,
  });
  ok("second look, same run → not due again (not yet in the reminder window)",
    second.action === "grace_wait" && second.reason === "not_yet_final_window", second);

  // A cron that runs twice IN THE SAME invocation window (the literal replay
  // case in the task) — two independent calls against the post-claim state
  // must agree with each other, not just with themselves.
  const rerun = graceWarningDecision({
    status: "past_due", pastDueSince, graceWarnedAt: NOW, graceFinalWarnedAt: null,
    now: new Date(NOW.getTime() + 60 * 1000),
  });
  ok("...and a run a minute later agrees", rerun.action === "grace_wait", rerun);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nThe SECOND notice (grace_remind) fires near the end, and only once — the number-release pattern");
{
  // 3 days left: grace_start already sent, reminder window (<=2) not reached yet.
  const notYet = graceWarningDecision({
    status: "past_due", pastDueSince: ago(4), graceWarnedAt: ago(3), graceFinalWarnedAt: null, now: NOW,
  });
  ok("3 days left, grace_start already sent → grace_wait, not the reminder window yet",
    notYet.action === "grace_wait" && notYet.reason === "not_yet_final_window", notYet);

  // Exactly at the boundary: 2 days left.
  const atEdge = graceWarningDecision({
    status: "past_due", pastDueSince: ago(5), graceWarnedAt: ago(4), graceFinalWarnedAt: null, now: NOW,
  });
  ok(`exactly ${REMIND_AT_OR_BELOW_DAYS} days left → grace_remind`,
    atEdge.action === "grace_remind" && atEdge.daysLeft === REMIND_AT_OR_BELOW_DAYS, atEdge);
  ok("...and it carries the same lockAt as grace_start would have",
    atEdge.lockAt.getTime() === ago(5).getTime() + GRACE_DAYS * DAY, atEdge.lockAt);

  // One tick before the boundary: 3 days left must NOT fire the reminder
  // (covered by notYet above with concrete numbers; this restates it with
  // the constant so a change to the threshold constant is what the
  // assertion tracks).
  const justOutside = graceWarningDecision({
    status: "past_due", pastDueSince: ago(GRACE_DAYS - (REMIND_AT_OR_BELOW_DAYS + 1)),
    graceWarnedAt: ago(1), graceFinalWarnedAt: null, now: NOW,
  });
  ok(`${REMIND_AT_OR_BELOW_DAYS + 1} days left is NOT yet the reminder window`,
    justOutside.action === "grace_wait", justOutside);

  // Once both are sent, nothing more goes out for the rest of the episode —
  // TWO notices, not a rentDecision-style repeating cadence.
  const bothSent = graceWarningDecision({
    status: "past_due", pastDueSince: ago(6), graceWarnedAt: ago(5), graceFinalWarnedAt: ago(1), now: NOW,
  });
  ok("both already sent → grace_wait, reason names it",
    bothSent.action === "grace_wait" && bothSent.reason === "both_sent", bothSent);

  // Running the reminder claim twice in the same run: the SECOND call
  // (post-claim, graceFinalWarnedAt now set) must not fire again.
  const reminderRerun = graceWarningDecision({
    status: "past_due", pastDueSince: ago(5), graceWarnedAt: ago(4), graceFinalWarnedAt: NOW, now: NOW,
  });
  ok("reminder claimed → a same-run replay sends nothing more",
    reminderRerun.action === "grace_wait" && reminderRerun.reason === "both_sent", reminderRerun);
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

  // One tick before that boundary is still a live notice opportunity.
  const justBeforeLock = graceWarningDecision({
    status: "past_due", pastDueSince: ago(GRACE_DAYS - 0.01), graceWarnedAt: null, graceFinalWarnedAt: null, now: NOW,
  });
  ok("a hair before locked → still notifies (grace_start, if not yet sent)",
    justBeforeLock.action === "grace_start", justBeforeLock);
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
  ok("fresh episode after a cleared marker → grace_start again, not suppressed by history",
    relapse.action === "grace_start", relapse);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nNo pastDueSince (our bug, not theirs) still gets a notice, clock starts now");
{
  const d = graceWarningDecision({
    status: "past_due", pastDueSince: null, graceWarnedAt: null, graceFinalWarnedAt: null, now: NOW,
  });
  ok("null pastDueSince → grace_start with the FULL window, same as accessFor()'s own fallback",
    d.action === "grace_start" && d.daysLeft === GRACE_DAYS, d);
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
console.log("\nThe email itself, EXECUTED — content, and the empathetic register the owner asked for");
{
  const lockDateExample = "Sep 6, 2026";

  const first = buildBillingEmail({
    kind: "grace",
    companyName: "Test Co",
    daysLeft: 6,
    lockDate: lockDateExample,
    reminder: false,
    billingUrl: "https://app.fieldquo.com/app/settings/account-billing",
  });
  ok("says what happened", /weren.t able to charge/i.test(first.html));
  ok("names the likely innocent cause up front (fraud hold / expired card)",
    /fraud hold|expired/i.test(first.html));
  ok("says what it means right now: read-only", /read-only/i.test(first.html));
  ok("says nothing has been deleted", /nothing has been deleted/i.test(first.html));
  ok("says exactly how many days remain", first.html.includes("6 days"));
  ok("links to the one fix", first.html.includes('href="https://app.fieldquo.com/app/settings/account-billing"'));

  const reminderEmail = buildBillingEmail({
    kind: "grace",
    companyName: "Test Co",
    daysLeft: 1,
    lockDate: lockDateExample,
    reminder: true,
    billingUrl: "https://app.fieldquo.com/app/settings/account-billing",
  });
  ok("reminder: singular day phrasing, not '1 days'", reminderEmail.html.includes("1 day") && !reminderEmail.html.includes("1 days"));
  ok("reminder: states the firm lock date — a fact, not a threat",
    reminderEmail.subject.includes(lockDateExample) && reminderEmail.html.includes(lockDateExample));
  ok("reminder: still explicitly says nothing has been deleted",
    /nothing has been deleted/i.test(reminderEmail.html));
  ok("reminder: still says read-only, the true current state",
    /read-only/i.test(reminderEmail.html));

  // ── Tone, executed against both notices ─────────────────────────────────
  //
  // The owner's exact instruction: no threats, no urgency language, no
  // capitals, nothing that reads as a collections notice. Checked as
  // regexes against the ACTUAL rendered copy, not asserted by a comment
  // saying "this is calm" — a comment cannot regress, wording can.
  //
  // Scoped to the READABLE TEXT, not the raw HTML: the page shell
  // (`<!DOCTYPE html>`, `<meta charset="utf-8" />`) carries its own
  // punctuation and capitals that have nothing to do with the copy a person
  // reads, and checking the tag soup instead of the text would make these
  // assertions fail on boilerplate no editor ever touches.
  const textOnly = (html) => html.replace(/<[^>]+>/g, " ");
  for (const [label, email] of [["grace_start", first], ["grace_remind", reminderEmail]]) {
    const text = textOnly(email.html);
    ok(`${label}: no threatening language (terminate/forfeit/lose access/collections)`,
      !/terminat|forfeit|lose access|collections?\b|overdue\b|delinquent/i.test(text), text);
    ok(`${label}: no urgency language ("last chance", "urgent", "act now", "immediately")`,
      !/last chance|urgent|act now|immediately|right now to avoid|final notice/i.test(text + email.subject),
      text + email.subject);
    ok(`${label}: no exclamation marks — a calm register, not a shout`,
      !text.includes("!") && !email.subject.includes("!"));
    // No shouting in caps: every run of 3+ consecutive uppercase LETTERS in
    // the visible text is a genuine all-caps word. "FieldQuo" is mixed case
    // so this pattern can't match it.
    const shouted = text.match(/\b[A-Z]{3,}\b/g) || [];
    ok(`${label}: no ALL-CAPS words`, shouted.length === 0, shouted);
  }

  // Hostile input: Company.name is user-editable and must not reach the page
  // unescaped.
  const hostile = buildBillingEmail({
    kind: "grace",
    companyName: '<img src=x onerror=alert(1)>',
    daysLeft: 2,
    lockDate: lockDateExample,
    reminder: true,
    billingUrl: "https://x/y",
  });
  ok("companyName is escaped", !hostile.html.includes("<img src=x"));

  // No billingUrl → no dangling CTA (defensive; every real caller passes one).
  const noUrl = buildBillingEmail({ kind: "grace", companyName: "Test Co", daysLeft: 4, lockDate: lockDateExample, reminder: false });
  ok("no billingUrl → no href printed", !noUrl.html.includes("href=\"undefined\""));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nThe cron actually gates on the decision, claims per-notice before sending, and reverts a failed send");
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
ok("refuses anything that isn't grace_start/grace_remind before claiming",
  /decision\.action !== "grace_start" && decision\.action !== "grace_remind"/.test(cron));
ok("the claim is guarded on the specific field still being null (idempotent per notice, not a blind write)",
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

// The reminder's copy needs a real date, not just a day count — check the
// route actually computes and passes one, rather than the email module's
// `lockDate` parameter being wired to nothing.
ok("the cron formats decision.lockAt for the email (not left for the email module to invent)",
  /formatDateOnly\(decision\.lockAt\)/.test(cron));

const schema = stripComments(readFileSync("prisma/schema.prisma", "utf8"));
const subModel = schema.slice(schema.indexOf("model Subscription {"));
const subBody = subModel.slice(0, subModel.indexOf("\n}"));
ok("Subscription carries the first-notice marker",
  /graceWarnedAt\s+DateTime\?/.test(subBody));
ok("...and its own second-notice marker, not a boolean bolted onto the first",
  /graceFinalWarnedAt\s+DateTime\?/.test(subBody));

// Both clearing sites must null BOTH markers — a JS-level assertion for the
// same reason as the cron's own regexes: grepping the whole file for
// "graceFinalWarnedAt: null" would also pass if it appeared in an unrelated
// function, so each is scoped to its own function body.
const accessSrc = stripComments(readFileSync("lib/billing/access.js", "utf8"));
const clearFn = accessSrc.slice(accessSrc.indexOf("export async function clearPastDue"));
const clearBody = clearFn.slice(0, clearFn.indexOf("\n}") + 2);
ok("clearPastDue() nulls graceWarnedAt", /graceWarnedAt:\s*null/.test(clearBody));
ok("clearPastDue() ALSO nulls graceFinalWarnedAt — a relapse must get both notices again, not just the first",
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
