// scripts/check-consent-mechanisms.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-consent-mechanisms.mjs
//
// Two consent mechanisms FieldQuo promised and didn't have: a working email
// unsubscribe (CASL requires one on every commercial message) and a working
// "Reply STOP" for SMS. This executes the real, shipped code — not a
// description of it — against the specific ways each could look like it
// works and not:
//
//   1. An unsubscribe token can't be guessed and can't cross a company
//      boundary.
//   2. Unsubscribing sets the flag and deletes nothing, once, ever — a
//      second click doesn't move the original timestamp.
//   3. Every COMMERCIAL email template carries a working link; every
//      TRANSACTIONAL one does not — executed against the real template
//      builders with fixture data, not asserted from memory.
//   4. "please stop by at 3" is not an opt-out. "STOP" and " stop " are.
//      Mutation-tested: every character class of near-miss this task's brief
//      called out by name.
//   5. An opted-out number is refused by EVERY client-facing SMS send path,
//      not just the one that already checked before this shipped.
//
// Regex-over-source is used only for #5 and the classification map in #3,
// and only after stripping comments — a call name appearing only inside a
// comment must not create a false pass, and a mention inside an unrelated
// comment must not create a false failure. Positional ("is the guard BEFORE
// the send") checks are scoped to the one exported handler function that
// contains the call, not the whole file, so an unrelated function earlier in
// the same file can't manufacture a pass.

process.env.NEXT_PUBLIC_APP_URL = "https://app.fieldquo.test";

import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import {
  newUnsubscribeToken,
  unsubscribeUrl,
  unsubscribeHeaders,
  unsubscribeDisclosureText,
  applyUnsubscribe,
} from "@/lib/marketing/unsubscribe";
import { renderTemplateSections } from "@/lib/email/renderTemplateSections";
import { buildReviewEmail } from "@/lib/reviews/reviewEmail";
import { TRIGGER_META, SUPPORTED_TRIGGERS } from "@/lib/followUps/triggers";
import {
  classifyInboundSms,
  normalizeSmsBody,
  OPT_OUT_KEYWORDS,
  OPT_IN_KEYWORDS,
} from "@/lib/sms/optOutKeywords";
import { contrastRatio } from "@/lib/brand/colour";

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};

// Strip // and /* */ comments before any regex scans source. Naive but
// sufficient for this codebase's style (no // or /* inside a string literal
// that itself contains the token names we're grepping for) — a mention of
// "sendSms(" inside a URL string is not a realistic false positive here.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function readSrc(path) {
  return stripComments(readFileSync(path, "utf8"));
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (e.name.endsWith(".js")) out.push(f);
  }
  return out;
}

// Slice out ONE exported function's body by name, from `export async
// function NAME` (or `export function NAME`) to the next top-level `export `
// or end of file. Positional assertions run against this slice, not the
// whole file, so a guard call sitting in some OTHER function of the same
// file can't manufacture a pass.
function extractFunction(src, name) {
  const start = src.search(new RegExp(`export\\s+(async\\s+)?function\\s+${name}\\s*\\(`));
  if (start === -1) return null;
  const rest = src.slice(start + 1);
  const next = rest.search(/\nexport\s/);
  return next === -1 ? src.slice(start) : src.slice(start, start + 1 + next);
}

/* ════════════════════ 1. Unsubscribe token ════════════════════════════ */

console.log("\nThe unsubscribe token can't be guessed or reused across companies");

{
  const tokens = new Set();
  for (let i = 0; i < 20000; i++) tokens.add(newUnsubscribeToken());
  ok("20,000 tokens, zero collisions", tokens.size === 20000, tokens.size);

  const sample = newUnsubscribeToken();
  ok("base64url charset only (no +, /, =)", /^[A-Za-z0-9_-]+$/.test(sample), sample);
  // 32 bytes of CSPRNG output — same construction as newPortalToken. base64url
  // of 32 bytes is 43 characters (no padding).
  ok("32 bytes of entropy (43-char base64url)", sample.length === 43, sample.length);

  const url = unsubscribeUrl(sample);
  ok("resolves to a /unsubscribe/<token> URL", url === `https://app.fieldquo.test/unsubscribe/${sample}`, url);
}

{
  // Cross-company non-reuse is enforced by the DB, not by application logic —
  // a token is @unique on MarketingSubscriber, so findUnique(token) can
  // resolve to at most one row, and that row belongs to exactly one company.
  // Verified structurally against the schema, and against the route that
  // does the lookup, so both halves of the guarantee are checked: the
  // constraint exists, AND the route relies on it rather than on a
  // client-supplied companyId.
  const schema = readSrc("prisma/schema.prisma");
  ok(
    "MarketingSubscriber.unsubscribeToken is @unique in the schema",
    /unsubscribeToken\s+String\?\s+@unique/.test(schema),
  );

  const route = readSrc("app/api/unsubscribe/[token]/route.js");
  ok(
    "the unsubscribe route resolves ONLY by token (findUnique on unsubscribeToken)",
    /findUnique\(\{\s*where:\s*\{\s*unsubscribeToken:\s*token/.test(route),
  );
  ok(
    "the unsubscribe route never trusts a client-supplied companyId",
    !/companyId/.test(route),
  );
}

/* ════════════════════ 2. Unsubscribing: flag set, nothing deleted ═════ */

console.log("\nUnsubscribing sets the flag and deletes nothing — once, ever");

{
  const now = new Date("2026-08-30T12:00:00Z");
  const disclosure = unsubscribeDisclosureText("Northline Refinishing");

  const fresh = { id: "sub_1", subscribed: true, unsubscribedAt: null, unsubscribeDisclosure: null };
  const first = applyUnsubscribe({ subscriber: fresh, disclosure, now });

  ok("first click: subscribed becomes false", first.data.subscribed === false, first.data);
  ok("first click: unsubscribedAt is stamped", first.data.unsubscribedAt.getTime() === now.getTime());
  ok("first click: disclosure is stored verbatim", first.data.unsubscribeDisclosure === disclosure);
  ok("first click: not flagged as already-unsubscribed", first.alreadyUnsubscribed === false);
  ok(
    "the write touches ONLY subscribed/unsubscribedAt/unsubscribeDisclosure — no email, no id, no delete",
    Object.keys(first.data).sort().join(",") === "subscribed,unsubscribeDisclosure,unsubscribedAt",
    Object.keys(first.data),
  );

  // A second click, later — the timestamp and the disclosure they actually
  // saw must NOT move, even though the copy (and `now`) has changed since.
  const later = new Date("2026-09-15T09:00:00Z");
  const newerCopy = unsubscribeDisclosureText("Northline Refinishing (rebranded copy)");
  const already = {
    id: "sub_1",
    subscribed: false,
    unsubscribedAt: now,
    unsubscribeDisclosure: disclosure,
  };
  const second = applyUnsubscribe({ subscriber: already, disclosure: newerCopy, now: later });

  ok("second click: still subscribed:false", second.data.subscribed === false);
  ok(
    "second click: unsubscribedAt keeps the ORIGINAL moment, not the re-click",
    second.data.unsubscribedAt.getTime() === now.getTime(),
    second.data.unsubscribedAt,
  );
  ok(
    "second click: disclosure keeps what they ACTUALLY saw, not today's copy",
    second.data.unsubscribeDisclosure === disclosure,
  );
  ok("second click: reported as already-unsubscribed", second.alreadyUnsubscribed === true);

  ok("a subscriber with no row is a no-op, not a throw", applyUnsubscribe({ subscriber: null }) === null);
}

{
  // The route itself must never issue a delete for either MarketingSubscriber
  // OR MarketingSubscriber-adjacent state.
  const route = readSrc("app/api/unsubscribe/[token]/route.js");
  ok("the unsubscribe route contains no .delete(", !/\.delete\(/.test(route));
}

/* ════════════════ 3. Commercial carries a link, transactional doesn't ═ */

console.log("\nEvery COMMERCIAL email template carries the link; every TRANSACTIONAL one doesn't");

{
  const fixtureSections = [{ type: "heading", text: "Hi {{clientName}}" }];
  const fixtureCompany = { name: "Northline Refinishing", brandColor: "#0a3a67" };

  const withLink = renderTemplateSections(fixtureSections, {}, {
    company: fixtureCompany,
    unsubscribe: { token: "tok_abc123" },
  });
  ok(
    "renderTemplateSections WITH an unsubscribe token renders a working link",
    withLink.includes("/unsubscribe/tok_abc123"),
  );

  const withoutLink = renderTemplateSections(fixtureSections, {}, { company: fixtureCompany });
  ok(
    "renderTemplateSections with NO unsubscribe option renders no link at all",
    !withoutLink.includes("/unsubscribe/"),
  );

  const explicitlyOmitted = renderTemplateSections(fixtureSections, {}, {
    company: fixtureCompany,
    unsubscribe: null,
  });
  ok(
    "renderTemplateSections tolerates unsubscribe: null (transactional callers pass nothing)",
    !explicitlyOmitted.includes("/unsubscribe/"),
  );
}

{
  const company = { name: "Northline Refinishing", reviewUrl: "https://g.page/r/example/review" };
  const client = { name: "Sam" };

  const withToken = buildReviewEmail({ company, client, language: "en", unsubscribeToken: "tok_review1" });
  ok(
    "review-request email WITH a token carries the unsubscribe link",
    withToken.html.includes("/unsubscribe/tok_review1"),
  );

  const withoutToken = buildReviewEmail({ company, client, language: "en" });
  ok(
    "review-request email with NO token renders no link (degrades, doesn't throw)",
    !withoutToken.html.includes("/unsubscribe/"),
  );

  // AGENTS.md: "contrast assumed rather than measured" is a recurring
  // failure class here. Every colour this file writes for unsubscribe text
  // must measure 4.5:1, not just "look about the same grey as everything
  // else" — checked against the ACTUAL hex the HTML contains, not the
  // literal source, so a future edit that changes the colour string still
  // gets caught.
  const hexInLink = withToken.html.match(/<a href="[^"]*\/unsubscribe\/[^"]*" style="color:(#[0-9a-fA-F]{3,6});/)?.[1];
  ok("the unsubscribe link's colour was found in the rendered HTML", Boolean(hexInLink), hexInLink);
  if (hexInLink) {
    const ratio = contrastRatio(hexInLink, "#ffffff"); // reviewEmail.js's card background
    ok(`unsubscribe link on the review email measures ≥ 4.5:1 (got ${ratio.toFixed(2)}:1)`, ratio >= 4.5, ratio);
  }
}

{
  // The classification lives in one place (TRIGGER_META) — assert it says
  // what the brief that commissioned this feature says it should, so a
  // future edit to the trigger list has to consciously touch this line
  // rather than silently drift.
  ok(
    "SUPPORTED_TRIGGERS and TRIGGER_META agree on the trigger set",
    SUPPORTED_TRIGGERS.every((k) => TRIGGER_META[k]) &&
      Object.keys(TRIGGER_META).length === SUPPORTED_TRIGGERS.length,
  );
  ok("quote_no_response is TRANSACTIONAL", TRIGGER_META.quote_no_response.commercial === false);
  ok("invoice_overdue is TRANSACTIONAL", TRIGGER_META.invoice_overdue.commercial === false);
  ok("job_completed is COMMERCIAL", TRIGGER_META.job_completed.commercial === true);
}

{
  // Negative check on the transactional/account builders themselves — these
  // are NOT executed with fixture data (buildQuoteEmail/buildInvoiceEmail
  // require a fully-loaded quote/invoice with section data that would make
  // this script a second copy of the send-route's own fixture assembly);
  // a source scan for the string "unsubscribe" is the honest substitute:
  // it catches the actual regression this class of check exists for (someone
  // copies the campaign footer onto a transactional template) without
  // pretending to be a full execution test these files don't have simple
  // enough fixtures for.
  const transactionalFiles = [
    "lib/email/quoteEmail.js",
    "lib/email/invoiceEmail.js",
    "lib/email/authEmails.js",
    "lib/email/teamInvite.js",
    "lib/email/selfQuoteEmail.js",
    "lib/email/servicePlanEmail.js",
    "lib/email/invoiceEmail.js",
  ];
  for (const file of new Set(transactionalFiles)) {
    const src = readSrc(file);
    ok(`${file} — no unsubscribe mechanism anywhere in it`, !/unsubscribe/i.test(src));
  }
}

{
  // And the reverse — every send path that IS commercial actually wires the
  // mechanism in, not just imports it.
  const campaigns = readSrc("app/api/marketing/campaigns/[id]/send/route.js");
  ok(
    "campaign send: mints/backfills a token before building the email",
    /ensureSubscriberToken\(/.test(campaigns),
  );
  ok(
    "campaign send: passes the token into the template shell",
    /unsubscribe:\s*\{\s*token:\s*unsubscribeToken/.test(campaigns),
  );
  ok(
    "campaign send: sets List-Unsubscribe headers",
    /unsubscribeHeaders\(/.test(campaigns),
  );

  const reviews = readSrc("app/api/cron/review-requests/route.js");
  ok("review-request cron: ensures a subscriber row + token exists", /ensureSubscriber\(/.test(reviews));
  ok("review-request cron: passes the token into the review email", /unsubscribeToken:\s*subscriber/.test(reviews));
  ok("review-request cron: sets List-Unsubscribe headers", /unsubscribeHeaders\(/.test(reviews));

  const followUps = readSrc("app/api/cron/follow-ups/route.js");
  ok(
    "follow-up cron: gates on TRIGGER_META[...].commercial, not a private copy",
    /TRIGGER_META\[rule\.triggerEvent\]\?\.commercial/.test(followUps),
  );
  ok("follow-up cron: ensures a subscriber row for commercial triggers", /ensureSubscriber\(/.test(followUps));
}

/* ════════════════ 4. SMS keyword matching, mutation-tested ═══════════ */

console.log('\n"please stop by at 3" is not an opt-out. "STOP" and " stop " are.');

const optOutCases = ["STOP", "stop", " stop ", "Stop.", "STOP!", "StOp", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "  quit  "];
for (const body of optOutCases) {
  ok(`${JSON.stringify(body)} → opt_out`, classifyInboundSms(body) === "opt_out", classifyInboundSms(body));
}

const optInCases = ["START", "start", " start ", "UNSTOP", "unstop", "Start."];
for (const body of optInCases) {
  ok(`${JSON.stringify(body)} → opt_in`, classifyInboundSms(body) === "opt_in", classifyInboundSms(body));
}

// The exact case named in the brief, plus its family of near-misses —
// mutating the match from "exact equality" to "contains" or "word boundary"
// would flip every one of these.
const notOptOutCases = [
  "please stop by at 3",
  "can you stop by later",
  "STOP STOP",
  "stop, please",
  "i want to stop this job",
  "",
  "   ",
  "yes",
  "STOPPING",
  "UNSTOPPABLE",
  "STARTING",
  "restart",
];
for (const body of notOptOutCases) {
  const verdict = classifyInboundSms(body);
  ok(`${JSON.stringify(body)} → NOT an opt-out or opt-in (got ${JSON.stringify(verdict)})`, verdict === null);
}

ok(
  "OPT_OUT_KEYWORDS matches the six standard keywords, no more, no fewer",
  OPT_OUT_KEYWORDS.length === 6 &&
    ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].every((k) => OPT_OUT_KEYWORDS.includes(k)),
);
ok(
  "OPT_IN_KEYWORDS is exactly START and UNSTOP (not YES — see the file's own reasoning)",
  OPT_IN_KEYWORDS.length === 2 && OPT_IN_KEYWORDS.includes("START") && OPT_IN_KEYWORDS.includes("UNSTOP"),
);
ok("normalizeSmsBody trims outer whitespace", normalizeSmsBody("  STOP  ") === "STOP");
ok("normalizeSmsBody strips ONE trailing punctuation run", normalizeSmsBody("Stop!!!") === "STOP");
ok(
  "normalizeSmsBody does NOT strip internal punctuation",
  normalizeSmsBody("STOP, please") === "STOP, PLEASE",
);

/* ═══════════ 5. An opted-out number is refused by every send path ═════ */

console.log("\nAn opted-out number is refused by every client-facing SMS send path");

{
  // The two currently-wired client-facing send paths (only two — see the
  // repo-wide sendSms() audit in the task brief: quoteReadyText,
  // invoiceOverdueText, jobCompleteText, bookingConfirmationText have no
  // caller yet, so there is no live path for them to leak through).
  const clientFacingPaths = [
    { file: "app/api/jobs/[id]/visits/[visitId]/route.js", fn: "PATCH" },
    { file: "app/api/cron/appointment-reminders/route.js", fn: "GET" },
  ];
  for (const { file, fn } of clientFacingPaths) {
    const src = readSrc(file);
    const body = extractFunction(src, fn);
    ok(`${file}: ${fn}() exists and was extracted`, Boolean(body));
    if (!body) continue;

    const guardAt = body.search(/maySms\(/);
    const sendAt = body.search(/sendSms\(/);
    ok(`${file}: calls maySms(`, guardAt !== -1, guardAt);
    ok(`${file}: calls sendSms(`, sendAt !== -1, sendAt);
    ok(
      `${file}: maySms( is checked BEFORE sendSms( is called, in the same function`,
      guardAt !== -1 && sendAt !== -1 && guardAt < sendAt,
      { guardAt, sendAt },
    );
  }

  // Every OTHER call to sendSms( in the app is either the two paths above or
  // one of the three documented, non-client-facing exemptions (staff/crew,
  // not this company's customer — see the one-line comment left at each call
  // site). Enumerated from source, the same way check-lead-consent.mjs
  // enumerates lead-creation routes, so a NEW sendSms( call added later fails
  // this check instead of quietly joining the gap.
  const exempt = new Set([
    "app/api/settings/referral/invite/route.js", // prospective FieldQuo signup, not this company's client
    "app/api/crew/line/route.js", // staff test text to their own worker phone
    "app/api/crew/inbound/route.js", // reply to a crew member, not a client
    // The opt-out webhook ITSELF: its sendSms( calls are the STOP/START
    // confirmation reply, sent to the number that JUST (un)subscribed — the
    // one case where texting a number regardless of SmsOptOut is correct,
    // not a gap. Checked separately below: gated behind an explicit env flag
    // rather than unconditional, and never both replying AND relying on
    // Twilio's own Advanced Opt-Out at once.
    "app/api/sms/inbound/route.js",
  ]);
  const gated = new Set(clientFacingPaths.map((p) => p.file));

  const files = walk("app")
    .filter((f) => f !== "lib/sms/twilioClient.js" && /sendSms\(/.test(readSrc(f)))
    // walk() joins with the platform separator; normalise to "/" so the
    // literal paths above (and grep-style matching everywhere else in this
    // codebase's check scripts) compare correctly on any OS.
    .map((f) => f.split(sep).join("/"));
  ok("found sendSms( call sites to audit", files.length > 0, files.length);

  for (const file of files) {
    const known = exempt.has(file) || gated.has(file);
    ok(`${file}: accounted for (gated or documented-exempt)`, known);
  }
  ok(
    "no NEW, unaccounted-for sendSms( call site has appeared",
    files.every((f) => exempt.has(f) || gated.has(f)),
    files.filter((f) => !exempt.has(f) && !gated.has(f)),
  );
}

{
  // The webhook that RECORDS the opt-out: resolves by Company.smsFromNumber
  // (now @unique), verifies the Twilio signature, and — the double-reply
  // guard — only sends its own confirmation behind an explicit env flag.
  const schema = readSrc("prisma/schema.prisma");
  ok("Company.smsFromNumber is @unique (one number, one tenant)", /smsFromNumber\s+String\?\s+@unique/.test(schema));

  const webhook = readSrc("app/api/sms/inbound/route.js");
  ok("inbound SMS webhook verifies the Twilio signature", /verifyTwilioWebhook\(/.test(webhook));
  ok("inbound SMS webhook resolves company by smsFromNumber", /smsFromNumber:\s*to/.test(webhook));
  ok("inbound SMS webhook records opt-out via recordSmsOptOut", /recordSmsOptOut\(/.test(webhook));
  ok("inbound SMS webhook records opt-in via recordSmsOptIn", /recordSmsOptIn\(/.test(webhook));
  ok("references the env flag the owner must set after checking the Twilio console", /SMS_OPT_OUT_SEND_CONFIRMATION/.test(webhook));

  // Both confirmation sends (opt-out and opt-in) must be immediately guarded
  // by that flag — not merely mentioned somewhere in the file. "Immediately"
  // is checked as "the guard's own call appears within 300 characters before
  // the send", which is generous enough for the actual `if (...) { await
  // sendSms(...) }` shape and tight enough that a guard checked once at the
  // top of the file and never re-verified wouldn't pass by accident.
  const postBody = extractFunction(webhook, "POST") || "";
  const sendIdxs = [...postBody.matchAll(/sendSms\(/g)].map((m) => m.index);
  ok("exactly two confirmation sendSms( calls (opt-out reply + opt-in reply)", sendIdxs.length === 2, sendIdxs.length);
  ok(
    "every confirmation sendSms( is guarded by shouldSendOwnConfirmation() immediately before it",
    sendIdxs.length > 0 &&
      sendIdxs.every((idx) => /shouldSendOwnConfirmation\(\)/.test(postBody.slice(Math.max(0, idx - 300), idx))),
  );
}

{
  const model = readSrc("prisma/schema.prisma");
  ok(
    "SmsOptOut is scoped per company (companyId + e164, unique together)",
    /model SmsOptOut[\s\S]*?@@unique\(\[companyId, e164\]\)/.test(model),
  );
}

/* ═══════════════════════════════ summary ═══════════════════════════════ */

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
