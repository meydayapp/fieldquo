// scripts/check-quote-delivery.mjs
//
//   npm run check:quote-delivery
//
// A quote that did not arrive must never look the same as one that did.
//
// ── The two losses this pins ───────────────────────────────────────────────
//
// Manny Conto typed `Macksab  1@hotmail.com` — two spaces, then a digit. He
// had given 26 doors, 7 drawers, photos, an address and a colour. The quote
// bounced. Nothing in the product said so; the contractor worked it out
// himself, asked twice, and by then the momentum was gone.
//
// Basir Mohmand's quote went out on 30 May and sat in his spam folder until
// 24 June, when he wrote "I don't have your email".
//
// Two in a corpus of twenty, both lost to plumbing rather than to a
// competitor. So there are two halves here and this script executes both:
//
//   1. THE ADDRESS IS REFUSED AT CAPTURE, with the fault named. Manny's half.
//      A boolean "that doesn't look like an email" tells somebody who typed a
//      space precisely nothing.
//   2. A REFUSED SEND IS REPORTED, through the one notification path, and is
//      distinguishable from a send that worked.
//
// The bounce half — Basir's — is NOT covered, by anything, and this script
// says so rather than implying otherwise: there is no Resend webhook in this
// deployment. See lib/email/sendFailure.js's header.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  emailProblem,
  emailProblemMessage,
  emailRefusal,
  cleanEmail,
  isValidEmail,
  EMAIL_PROBLEMS,
} from "../lib/validation.js";
import { sendOutcome, SEND_FAILURE_CAUSES } from "../lib/email/sendFailure.js";
import { NOTIFICATION_TYPES, typeProblems } from "../lib/notifications/catalog.js";
import { noteKeysFor, hrefFor } from "../lib/notifications/render.js";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : String(JSON.stringify(extra)).slice(0, 240));
  }
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
// Only code may satisfy a pin — a comment describing a rule is not the rule.
const code = (p) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

// ═══════════════════════════════════════════════════════════════════════════
// 1. The address Manny typed is refused, and the fault is NAMED
// ═══════════════════════════════════════════════════════════════════════════

const MANNY = "Macksab  1@hotmail.com";

ok("the address that lost the job is refused", emailProblem(MANNY) === "spaces");
ok("...and the refusal names the space rather than shrugging",
  /space/i.test(emailProblemMessage(emailProblem(MANNY))), emailProblemMessage("spaces"));
ok("...and says it out loud through emailRefusal",
  emailRefusal(MANNY)?.code === "invalid_email" && /space/i.test(emailRefusal(MANNY).error),
  emailRefusal(MANNY));
ok("...and can never be stored", cleanEmail(MANNY) === null);

// Each fault gets its OWN sentence. A single "invalid email" for all of them
// would be the boolean wearing a longer coat.
{
  const sentences = new Set(EMAIL_PROBLEMS.map((p) => emailProblemMessage(p)));
  ok("every named fault has its own sentence", sentences.size === EMAIL_PROBLEMS.length, [...sentences]);
  ok("...and none of them is empty", [...sentences].every((s) => typeof s === "string" && s.length > 10));
}

for (const [value, expected] of [
  ["", "empty"],
  ["   ", "empty"],
  ["Macksab  1@hotmail.com", "spaces"],
  ["bob at example.com", "spaces"],
  ["bobexample.com", "no_at"],
  ["bob@@example.com", "many_at"],
  ["bob@ex@ample.com", "many_at"],
  ["@example.com", "no_local"],
  ["bob@", "no_domain"],
  ["bob@example", "no_domain_dot"],
  ["bob@.com", "domain_edge"],
  ["bob@example.", "domain_edge"],
  ["bob@ex..ample.com", "domain_edge"],
  ["Bob <bob@example.com>", "spaces"],
  ["bob;alice@example.com", "bad_chars"],
  [`${"a".repeat(250)}@example.com`, "too_long"],
]) {
  ok(`"${String(value).slice(0, 32)}" → ${expected}`, emailProblem(value) === expected, emailProblem(value));
}

for (const good of [
  "macksab1@hotmail.com",
  "  Bob@Example.COM  ",
  "first.last+tag@sub.domain.co.uk",
  "o'brien@example.ie",
]) {
  ok(`"${good.trim()}" is accepted`, emailProblem(good) === null, emailProblem(good));
}

ok("a good address is stored trimmed and lowercased",
  cleanEmail("  Bob@Example.COM  ") === "bob@example.com", cleanEmail("  Bob@Example.COM  "));
ok("the boolean is derived from the problem, not a second regex",
  isValidEmail("bob@example.com") === true && isValidEmail(MANNY) === false);

// An optional field is not a wrong one. Every public intake form takes an
// email OR a phone, and refusing a blank would break the phone-only path.
ok("an absent address is not a refusal when it is optional", emailRefusal("") === null);
ok("...and IS one where the form demands it", emailRefusal("", { required: true })?.problem === "empty");

// ═══════════════════════════════════════════════════════════════════════════
// 2. Every capture point actually calls it
// ═══════════════════════════════════════════════════════════════════════════
//
// The list is the map of where a client/lead/quote-recipient address enters
// this app. A new intake route that skips the validator is the whole bug
// coming back, so this is a source pin rather than a behaviour one — there is
// no way to execute "somebody wrote a tenth route".

const CAPTURE_POINTS = [
  "app/api/self-quote/route.js",
  "app/api/self-quote/kitchen/route.js",
  "app/api/leads/public/route.js",
  "app/api/instant-quote/[companySlug]/request/route.js",
  "app/api/funnels/public/[companySlug]/[funnelSlug]/submit/route.js",
  "app/api/booking/[companySlug]/confirm/route.js",
  "app/api/clients/route.js",
  "app/api/clients/[id]/route.js",
  "app/api/marketing/stops/[id]/route.js",
];
for (const file of CAPTURE_POINTS) {
  const src = code(file);
  ok(`${file} refuses an address it cannot deliver to`, /emailRefusal\(/.test(src));
  ok(`${file} imports it from the one validator`, /from "@\/lib\/validation"/.test(src));
}

// The two bulk paths refuse row by row rather than failing a 2000-row CSV.
for (const file of ["app/api/clients/import/route.js", "app/api/leads/import/route.js"]) {
  ok(`${file} screens each row's address`, /emailProblem\(/.test(code(file)), file);
}
ok("a skipped-for-a-bad-address row is reported, not silently dropped",
  /badEmails/.test(code("app/api/clients/import/route.js")) &&
    /badEmails/.test(code("app/app/clients/import/page.js")));

// The sink normalises, so what is MATCHED and what is STORED are one string.
// They were two: convertLead matched on trim+lowercase and stored the raw
// original, so a repeat enquirer became a second client.
for (const file of [
  "lib/leads/createLead.js",
  "lib/leads/convertLead.js",
  "lib/estimate/createEstimateQuote.js",
]) {
  ok(`${file} stores the address through the one normaliser`, /cleanEmail\(/.test(code(file)), file);
}
ok("convertLead no longer matches on one string and stores another",
  !/String\(lead\.email\)\.trim\(\)\.toLowerCase\(\)/.test(code("lib/leads/convertLead.js")));

// ═══════════════════════════════════════════════════════════════════════════
// 3. A send that did not happen is READ, and is not a success
// ═══════════════════════════════════════════════════════════════════════════
//
// sendEmail never throws: it answers { skipped }, { error } or { id }. The
// follow-up cron used to increment `sent` on a value it never looked at.

ok("a delivered send is ok", sendOutcome({ id: "re_123" }).ok === true);
ok("a demo's simulated send is ok", sendOutcome({ id: "sim_1", simulated: true }).ok === true);
ok("no mail key configured is NOT a success", sendOutcome({ skipped: true }).ok === false);
ok("...and names itself as ours to fix", sendOutcome({ skipped: true }).cause === "unconfigured");
ok("a provider refusal is not a success", sendOutcome({ error: "Domain is not verified" }).ok === false);
ok("...and points at the sending domain, not the client",
  sendOutcome({ error: "The example.com domain is not verified" }).cause === "rejected");
ok("a malformed recipient points at the client record",
  sendOutcome({ error: "Invalid `to` field. Not a valid email address." }).cause === "address");
ok("a lost return value is a failure, never a success",
  sendOutcome(undefined).ok === false && sendOutcome(null).ok === false);
ok("every cause it can produce is in the declared vocabulary",
  [
    sendOutcome({ skipped: true }),
    sendOutcome({ error: "x" }),
    sendOutcome({ error: "Invalid `to` field" }),
    sendOutcome(null),
  ].every((o) => SEND_FAILURE_CAUSES.includes(o.cause)));

// ═══════════════════════════════════════════════════════════════════════════
// 4. …and the contractor is told, through the ONE notification path
// ═══════════════════════════════════════════════════════════════════════════

{
  const meta = NOTIFICATION_TYPES["quote.undelivered"];
  ok("the catalog declares an undelivered quote", Boolean(meta));
  ok("...soundly", typeProblems("quote.undelivered").length === 0, typeProblems("quote.undelivered"));
  ok("...as critical, beside a chargeback", meta.severity === "critical", meta.severity);
  ok("...carrying no money, so it reaches people who cannot see prices", meta.money === false);
  ok("...and opening the quote itself",
    hrefFor({ entityType: meta.entityType, entityId: "q1" }) === "/app/quotes/q1");
  for (const cause of SEND_FAILURE_CAUSES) {
    ok(`the "${cause}" cause renders a secondary line`,
      noteKeysFor({ params: { cause } }).includes(`app.notif.cause.${cause}`));
  }
  // A raw provider string reaching the feed would print vendor English at a
  // contractor reading the app in Punjabi.
  ok("a cause outside the vocabulary renders nothing",
    noteKeysFor({ params: { cause: "Domain is not verified" } }).length === 0);
}

{
  const send = code("app/api/quotes/[id]/send/route.js");
  ok("the send route reads its own result rather than assuming", /sendOutcome\(/.test(send));
  ok("...and raises the feed row on a failure", /reportQuoteNotDelivered\(/.test(send));
  ok("...through the one notification path, not a second one",
    /@\/lib\/email\/sendFailure/.test(send) && !/notifyEvent\(/.test(send));
  // Rule 1 of that route's own header, restated as an assertion: a failed send
  // must leave the quote looking unsent.
  ok("sentAt is still written only after the provider accepted",
    send.indexOf("sentAt: new Date()") > send.indexOf("sendOutcome("), "a failure must not stamp the quote");
  ok("...and a failure still refuses the request loudly",
    /status: 502/.test(send) && /status: 503/.test(send));
}

{
  const cron = code("app/api/cron/follow-ups/route.js");
  ok("the follow-up cron reads the send result", /sendOutcome\(/.test(cron));
  ok("...counts a refused send as failed, not sent", /failed\+\+/.test(cron));
  ok("...and tells somebody about a quote that did not land", /reportQuoteNotDelivered\(/.test(cron));
  ok("...and reports the failures in its own response", /failed,/.test(cron));
  // The old shape, gone: `sent++` unconditionally after a discarded result.
  ok("a chase is no longer counted as delivered without looking",
    !/^\s*await sendEmail\(\{/m.test(cron), "sendEmail's return value must be bound");
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. What is NOT covered, stated rather than implied
// ═══════════════════════════════════════════════════════════════════════════
//
// Basir Mohmand's quote was accepted by the provider and then sat in spam for
// three weeks. Nothing here can see that, because nothing in this deployment
// receives delivery events. If somebody adds the webhook, this assertion is
// what tells them to come back and extend the cause vocabulary.
{
  const hasResendWebhook =
    fs.existsSync(path.join(ROOT, "app/api/webhooks/resend/route.js")) ||
    fs.existsSync(path.join(ROOT, "app/api/resend/webhook/route.js"));
  ok(
    hasResendWebhook
      ? "a Resend webhook exists — extend SEND_FAILURE_CAUSES with the bounce cases"
      : "no Resend webhook exists, and sendFailure.js says so instead of implying otherwise",
    hasResendWebhook
      ? /bounce/i.test(read("lib/email/sendFailure.js"))
      : /no Resend webhook in this deployment/i.test(read("lib/email/sendFailure.js")),
  );
}

console.log(`\ncheck-quote-delivery: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
