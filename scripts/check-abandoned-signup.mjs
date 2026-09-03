// scripts/check-abandoned-signup.mjs
//
//   npm run check:abandoned-signup
//
// An abandoned signup is not a customer, and the letter that goes to one must
// go exactly once, to the right person, and never to somebody who paid.
//
// ══ What is being defended ═════════════════════════════════════════════════
//
// app/api/companies/route.js creates the Company at line ~271 and reaches
// Stripe Checkout at line ~493. Closing the tab in between leaves a working
// tenant with no card. Twenty companies in the live database have no
// Subscription row; ten are seeded demos and ten are real people, four of whom
// share one inbox because they retried a checkout that could not succeed.
//
// Three things can go wrong and each is expensive in a different way:
//
//   counting   a person who gave FieldQuo nothing reads as a customer, on the
//              dashboard, in the company list, and in every adoption rate.
//   mailing    the recovery email reaches somebody who DID pay ("why didn't
//              you finish signing up?" to a paying customer), or reaches one
//              person four times, or reaches somebody who asked us to stop.
//   pretending a screen or a control that says one of the above is handled and
//              isn't.
//
// ══ How this file works ════════════════════════════════════════════════════
//
// Sections 1–4 EXECUTE lib/signup/abandoned.js against fixtures. Section 5
// executes the real email builder. Section 6 scans source, and every scan is
// brace-matched to ONE function body via handlerBodies()/balanced() — a
// whole-file `indexOf(a) < indexOf(b)` passes trivially when `a` is absent,
// and passes wrongly when `a` and `b` live in different handlers. Section 7
// mutates lib/signup/abandoned.js and app/api/cron/signup-recovery/route.js on
// disk one bug at a time, re-runs this file as a subprocess, and reports any
// mutation the assertions above did NOT catch. Backups are copies in a temp
// directory; nothing here ever touches git.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-abandoned-signup.mjs

import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import {
  NUDGE_DELAY_HOURS,
  NUDGE_WINDOW_DAYS,
  NUDGE_IS_COMMERCIAL,
  completedSignupWhere,
  decideSignupNudge,
  incompleteSignupWhere,
  isIncompleteSignup,
  nudgeRecipient,
  planSignupNudges,
} from "@/lib/signup/abandoned";
import {
  buildSignupRecoveryEmail,
  SIGNUP_RECOVERY_PAIRS,
} from "@/lib/email/signupRecoveryEmail";
import { contrastRatio } from "@/lib/brand/colour";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { decomment, balanced, handlerBodies } from "./tenantScopeScan.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const fails = [];
function ok(label, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fails.push(label + (detail ? ` — ${detail}` : ""));
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-09-02T12:00:00.000Z");
const ago = (ms) => new Date(NOW.getTime() - ms);

// ── The fixtures the brief names, plus the ones the live data forced ───────
//
// Every one is modelled on a row that actually exists (or, for the completed
// case, on one of the twelve that do). `subscription` is present on EVERY
// fixture — a missing key is a different bug and section 1 tests it on its own.
const SUBSCRIBED = { id: "sub_1" };

const FIXTURES = [
  {
    label: "no subscription, no quotes — the plain abandoned signup",
    company: {
      id: "c_plain", isDemo: false, subscription: null, memberCount: 1,
      email: "coca@example.com", createdAt: ago(10 * DAY), signupNudgeSentAt: null,
      quotes: 0,
    },
    expect: "due",
  },
  {
    label: "abandoned checkout, then USED the product (zan test inc)",
    company: {
      id: "c_used", isDemo: false, subscription: null, memberCount: 1,
      email: "work_test@example.com", createdAt: ago(5 * DAY), signupNudgeSentAt: null,
      quotes: 1,
    },
    // Having used the product does NOT disqualify the nudge. They still never
    // gave a card, and they are the single most interesting person on the list.
    expect: "due",
  },
  {
    label: "completed checkout — must NEVER be nudged",
    company: {
      id: "c_paid", isDemo: false, subscription: SUBSCRIBED, memberCount: 1,
      email: "paid@example.com", createdAt: ago(10 * DAY), signupNudgeSentAt: null,
      quotes: 4,
    },
    expect: "completed_checkout",
  },
  {
    label: "created two minutes ago — too early to nudge",
    company: {
      id: "c_new", isDemo: false, subscription: null, memberCount: 1,
      email: "localfy@example.com", createdAt: ago(2 * 60 * 1000), signupNudgeSentAt: null,
      quotes: 0,
    },
    expect: "too_early",
  },
  {
    label: "already emailed — never a second letter",
    company: {
      id: "c_done", isDemo: false, subscription: null, memberCount: 1,
      email: "already@example.com", createdAt: ago(9 * DAY),
      signupNudgeSentAt: ago(8 * DAY), quotes: 0,
    },
    expect: "already_nudged",
  },
  {
    label: "on FieldQuo's do-not-contact list",
    company: {
      id: "c_stop", isDemo: false, subscription: null, memberCount: 1,
      email: "stop@example.com", createdAt: ago(4 * DAY), signupNudgeSentAt: null,
      quotes: 0,
    },
    suppressed: true,
    expect: "suppressed",
  },
  {
    label: "seeded demo company — excluded",
    company: {
      id: "c_demo", isDemo: true, subscription: null, memberCount: 0,
      email: "demo1@fieldquo.com", createdAt: ago(30 * DAY), signupNudgeSentAt: null,
      quotes: 4,
    },
    expect: "demo",
  },
  {
    label: "abandoned in July — outside the CASL-bounded window",
    company: {
      id: "c_old", isDemo: false, subscription: null, memberCount: 1,
      email: "sunset@example.com", createdAt: ago(56 * DAY), signupNudgeSentAt: null,
      quotes: 0,
    },
    expect: "too_late",
  },
  {
    label: "console-created shell with no owner — nothing was abandoned",
    company: {
      id: "c_shell", isDemo: false, subscription: null, memberCount: 0,
      email: "whiteglove@example.com", createdAt: ago(3 * DAY), signupNudgeSentAt: null,
      quotes: 0,
    },
    expect: "no_owner",
  },
  {
    label: "no email on the signup — nowhere to write",
    company: {
      id: "c_noemail", isDemo: false, subscription: null, memberCount: 1,
      email: null, createdAt: ago(3 * DAY), signupNudgeSentAt: null, quotes: 0,
    },
    expect: "no_recipient",
  },
  {
    label: "no signup date on record — refused rather than guessed",
    company: {
      id: "c_nodate", isDemo: false, subscription: null, memberCount: 1,
      email: "nodate@example.com", createdAt: null, signupNudgeSentAt: null, quotes: 0,
    },
    expect: "no_created_at",
  },
];

const decide = (f) =>
  decideSignupNudge({ company: f.company, suppressed: Boolean(f.suppressed), now: NOW });

// ══════════════════════════════════════════════════════════════════════════
section("1. What an incomplete signup IS");

ok(
  "incompleteSignupWhere asks for the ABSENCE of a subscription",
  JSON.stringify(incompleteSignupWhere()) === JSON.stringify({ subscription: { is: null } }),
  JSON.stringify(incompleteSignupWhere()),
);
ok(
  "completedSignupWhere is its exact complement",
  JSON.stringify(completedSignupWhere()) === JSON.stringify({ subscription: { isNot: null } }),
  JSON.stringify(completedSignupWhere()),
);
ok(
  "neither fragment bakes in the demo filter (the caller composes NOT_DEMO)",
  !JSON.stringify(incompleteSignupWhere()).includes("isDemo") &&
    !JSON.stringify(completedSignupWhere()).includes("isDemo"),
);

ok(
  "a company with no subscription is an incomplete signup",
  isIncompleteSignup({ isDemo: false, subscription: null }) === true,
);
ok(
  "a company WITH a subscription is not",
  isIncompleteSignup({ isDemo: false, subscription: SUBSCRIBED }) === false,
);
ok(
  "a demo is not, however subscriptionless",
  isIncompleteSignup({ isDemo: true, subscription: null }) === false,
);

// The single most dangerous confusion available: a query that forgot to select
// the relation would otherwise read every paying customer as an abandoned
// signup and mail all of them.
let threw = false;
try {
  isIncompleteSignup({ isDemo: false });
} catch {
  threw = true;
}
ok("an UNSELECTED subscription relation throws rather than reading as null", threw);

ok("onboardingStatus is not part of the test anywhere in the module",
  !decomment(read("lib/signup/abandoned.js")).includes("onboardingStatus"));

ok("nudgeRecipient lower-cases and trims", nudgeRecipient("  Work_Test@Example.COM ") === "work_test@example.com");
ok("nudgeRecipient refuses a non-address rather than returning ''",
  nudgeRecipient("") === null && nudgeRecipient("   ") === null && nudgeRecipient("not-an-address") === null);
ok("two blank addresses do not collapse into one recipient",
  nudgeRecipient(null) === null && nudgeRecipient(undefined) === null);

// ══════════════════════════════════════════════════════════════════════════
section("2. The nudge decision, one fixture at a time");

for (const f of FIXTURES) {
  const got = decide(f);
  ok(`${f.label} → ${f.expect}`, got.reason === f.expect, `got "${got.reason}"`);
}

ok(
  "the only fixture that sends is the two that should",
  FIXTURES.filter((f) => decide(f).send).length === 2,
  String(FIXTURES.filter((f) => decide(f).send).map((f) => f.company.id)),
);

// Boundaries, exactly. The delay is a floor and the window is a ceiling, and
// both are tested from both sides so an off-by-one in either direction shows.
const boundary = (ms) => ({
  id: "c_b", isDemo: false, subscription: null, memberCount: 1,
  email: "b@example.com", createdAt: ago(ms), signupNudgeSentAt: null,
});
ok(
  `one second under ${NUDGE_DELAY_HOURS}h is too early`,
  decideSignupNudge({ company: boundary(NUDGE_DELAY_HOURS * HOUR - 1000), now: NOW }).reason === "too_early",
);
ok(
  `exactly ${NUDGE_DELAY_HOURS}h is due`,
  decideSignupNudge({ company: boundary(NUDGE_DELAY_HOURS * HOUR), now: NOW }).send === true,
);
ok(
  `exactly ${NUDGE_WINDOW_DAYS} days is still due`,
  decideSignupNudge({ company: boundary(NUDGE_WINDOW_DAYS * DAY), now: NOW }).send === true,
);
ok(
  `one second past ${NUDGE_WINDOW_DAYS} days is too late`,
  decideSignupNudge({ company: boundary(NUDGE_WINDOW_DAYS * DAY + 1000), now: NOW }).reason === "too_late",
);
ok(
  `the window sits inside CASL's six-month implied-consent limit`,
  NUDGE_WINDOW_DAYS < 180,
);
ok("the module states its own CASL classification as commercial", NUDGE_IS_COMMERCIAL === true);

// A paid company that is ALSO suppressed, ALSO stale, ALSO a demo must still
// report the one refusal that matters, so the reason a reader sees is the
// legally and commercially decisive one.
ok(
  "completed_checkout outranks every other refusal except demo",
  decideSignupNudge({
    company: {
      id: "c_all", isDemo: false, subscription: SUBSCRIBED, memberCount: 0,
      email: null, createdAt: null, signupNudgeSentAt: ago(DAY),
    },
    suppressed: true,
    now: NOW,
  }).reason === "completed_checkout",
);

// ══════════════════════════════════════════════════════════════════════════
section("3. The invariant, walked over every fixture");

// A generic property rather than a list: a NEW reason code added later still
// has to satisfy this, without this file needing to know its name.
for (const f of [...FIXTURES, { label: "boundary", company: boundary(2 * DAY) }]) {
  const got = decideSignupNudge({
    company: f.company,
    suppressed: Boolean(f.suppressed),
    now: NOW,
  });
  if (!got.send) continue;
  const c = f.company;
  const age = NOW.getTime() - new Date(c.createdAt).getTime();
  ok(
    `send=true implies every guard passed — ${f.label}`,
    c.subscription === null &&
      c.isDemo !== true &&
      !f.suppressed &&
      !c.signupNudgeSentAt &&
      Number(c.memberCount) > 0 &&
      Boolean(nudgeRecipient(c.email)) &&
      age >= NUDGE_DELAY_HOURS * HOUR &&
      age <= NUDGE_WINDOW_DAYS * DAY,
  );
}

ok(
  "no fixture with a subscription ever sends",
  FIXTURES.filter((f) => f.company.subscription).every((f) => decide(f).send === false),
);
ok(
  "no demo fixture ever sends",
  FIXTURES.filter((f) => f.company.isDemo).every((f) => decide(f).send === false),
);

// ══════════════════════════════════════════════════════════════════════════
section("4. The batch — one letter per person, not per row");

// The live shape: five "sunset" companies created inside 85 seconds, four of
// them on ONE address. Per-row dedupe sends that person four letters.
// Ordered oldest → newest, the way the live rows were created: s5 is the last
// attempt of the five, which is the one the letter should name.
const SUNSETS = [
  { id: "s1", isDemo: false, subscription: null, memberCount: 1, email: "e.boves@example.com", createdAt: ago(5 * DAY + 80000), signupNudgeSentAt: null },
  { id: "s2", isDemo: false, subscription: null, memberCount: 1, email: "e.boves.1@example.com", createdAt: ago(5 * DAY + 66000), signupNudgeSentAt: null },
  { id: "s3", isDemo: false, subscription: null, memberCount: 1, email: "E.Boves.1@example.com", createdAt: ago(5 * DAY + 64000), signupNudgeSentAt: null },
  { id: "s4", isDemo: false, subscription: null, memberCount: 1, email: "e.boves.1@example.com", createdAt: ago(5 * DAY + 62000), signupNudgeSentAt: null },
  { id: "s5", isDemo: false, subscription: null, memberCount: 1, email: "e.boves.1@example.com", createdAt: ago(5 * DAY + 60000), signupNudgeSentAt: null },
];

const sunsetPlan = planSignupNudges({ companies: SUNSETS, now: NOW });
ok(
  "five companies on two addresses produce exactly two letters",
  sunsetPlan.sends.length === 2,
  `${sunsetPlan.sends.length}`,
);
ok(
  "the addresses are distinct and normalised",
  new Set(sunsetPlan.sends.map((s) => s.to)).size === sunsetPlan.sends.length &&
    sunsetPlan.sends.every((s) => s.to === s.to.toLowerCase()),
);
ok(
  "case alone does not make a second recipient (E.Boves.1 === e.boves.1)",
  sunsetPlan.sends.filter((s) => s.to === "e.boves.1@example.com").length === 1,
);
ok(
  "every one of the five rows is stamped, so tomorrow's run sends nothing",
  new Set(sunsetPlan.sends.flatMap((s) => s.stampCompanyIds)).size === 5,
);
ok(
  "the letter names the NEWEST attempt at each address",
  sunsetPlan.sends.find((s) => s.to === "e.boves.1@example.com")?.company.id === "s5",
);

// Re-running the same plan against the stamped rows must be a no-op.
const stamped = SUNSETS.map((c) => ({ ...c, signupNudgeSentAt: NOW }));
ok(
  "a second run over stamped rows sends nothing",
  planSignupNudges({ companies: stamped, now: NOW }).sends.length === 0,
);

// One stamped sibling blocks a NEW row at the same address for the window.
const oneStamped = [
  { ...SUNSETS[1], signupNudgeSentAt: ago(2 * DAY) },
  { ...SUNSETS[3], signupNudgeSentAt: null },
];
ok(
  "a fresh row at an already-nudged address is refused, not mailed again",
  planSignupNudges({ companies: oneStamped, now: NOW }).sends.length === 0 &&
    planSignupNudges({ companies: oneStamped, now: NOW }).skipped.some(
      (s) => s.reason === "address_already_nudged",
    ),
);

// The stamping rule's dangerous half: a PAYING company sharing an address with
// an abandoned one must never be stamped, because the column would then claim a
// recovery email covered a customer.
const mixed = [
  { id: "m_paid", isDemo: false, subscription: SUBSCRIBED, memberCount: 1, email: "shared@example.com", createdAt: ago(40 * DAY), signupNudgeSentAt: null },
  { id: "m_demo", isDemo: true, subscription: null, memberCount: 0, email: "shared@example.com", createdAt: ago(40 * DAY), signupNudgeSentAt: null },
  { id: "m_old", isDemo: false, subscription: null, memberCount: 1, email: "shared@example.com", createdAt: ago(90 * DAY), signupNudgeSentAt: null },
  { id: "m_due", isDemo: false, subscription: null, memberCount: 1, email: "shared@example.com", createdAt: ago(3 * DAY), signupNudgeSentAt: null },
];
const mixedPlan = planSignupNudges({ companies: mixed, now: NOW });
const mixedStamped = new Set(mixedPlan.sends.flatMap((s) => s.stampCompanyIds));
ok("one letter goes to the shared address", mixedPlan.sends.length === 1);
ok("it goes to the row that is actually due", mixedPlan.sends[0]?.company.id === "m_due");
ok("the PAYING company at that address is never stamped", !mixedStamped.has("m_paid"));
ok("the DEMO at that address is never stamped", !mixedStamped.has("m_demo"));
ok("the lapsed abandoned sibling IS stamped", mixedStamped.has("m_old"));

// Suppression closes the whole address, not one row.
const suppressedPlan = planSignupNudges({
  companies: SUNSETS,
  suppressedAddresses: new Set(["e.boves.1@example.com"]),
  now: NOW,
});
ok(
  "a suppressed address produces no letter for any of its rows",
  suppressedPlan.sends.every((s) => s.to !== "e.boves.1@example.com"),
);
ok(
  "and none of its rows is stamped, so lifting the suppression restores them",
  !new Set(suppressedPlan.sends.flatMap((s) => s.stampCompanyIds)).has("s2"),
);

ok(
  "the whole live population produces no send for anyone who paid",
  planSignupNudges({ companies: FIXTURES.map((f) => f.company), now: NOW }).sends.every(
    (s) => s.company.subscription === null && s.company.isDemo !== true,
  ),
);

// ══════════════════════════════════════════════════════════════════════════
section("5. The letter itself, built rather than read");

const BASE = {
  companyName: "Sunset Painting",
  finishUrl: "https://fieldquo.com/app/settings/account-billing",
  helpUrl: "https://fieldquo.com/contact",
  optOutUrl: "https://fieldquo.com/no-contact/tok",
  mailingAddress: "1 Test Street, Gatineau QC",
};

const en = buildSignupRecoveryEmail({ ...BASE, language: "en" });
ok("it builds", Boolean(en.subject && en.html && en.text));
ok("the subject offers help rather than asking for money",
  /help|hand|finish/i.test(en.subject), en.subject);
ok("the company's own name is in the body", en.html.includes("Sunset Painting"));
ok("the opt-out URL is in the HTML", en.html.includes(BASE.optOutUrl));
ok("the opt-out URL is in the plain-text part too", en.text.includes(BASE.optOutUrl));
ok("the mailing address is in both parts",
  en.html.includes("1 Test Street") && en.text.includes("1 Test Street"));
ok("the CTA points at Account & Billing, never /signup",
  en.html.includes(BASE.finishUrl) && !en.html.includes("/signup"));
ok("the help link reaches a form, not a promise to answer a reply",
  en.html.includes(BASE.helpUrl) && !/reply to this/i.test(en.html));

for (const [name, value] of [
  ["mailing address", { ...BASE, mailingAddress: "" }],
  ["unsubscribe URL", { ...BASE, optOutUrl: "" }],
  ["help URL", { ...BASE, helpUrl: "" }],
  ["finish URL", { ...BASE, finishUrl: "" }],
]) {
  let refused = false;
  try {
    buildSignupRecoveryEmail(value);
  } catch {
    refused = true;
  }
  ok(`a missing ${name} refuses to build rather than shipping a hole`, refused);
}

const fr = buildSignupRecoveryEmail({ ...BASE, language: "fr" });
ok("French is a different letter, not the English one", fr.subject !== en.subject);
ok("French keeps the required footer parts",
  fr.html.includes(BASE.optOutUrl) && fr.html.includes("1 Test Street"));

const KEYS = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.signupRecovery."));
ok("the catalogue carries the letter's keys", KEYS.length >= 10, String(KEYS.length));
ok("every key is translated into French", KEYS.every((k) => k in APP_MESSAGES.fr));
ok("no French value is left as the English one",
  KEYS.filter((k) => k !== "app.signupRecovery.identify")
    .every((k) => APP_MESSAGES.fr[k] !== APP_MESSAGES.en[k]));

// A language with no catalogue must fall back per key to English, not render
// the key itself into a stranger's inbox.
const uk = buildSignupRecoveryEmail({ ...BASE, language: "uk" });
ok("an untranslated language falls back to English rather than printing keys",
  !uk.html.includes("app.signupRecovery."));

// Contrast, measured. AGENTS.md failure class #6.
for (const pair of SIGNUP_RECOVERY_PAIRS) {
  const ratio = contrastRatio(pair.fg, pair.bg);
  ok(`${pair.name} clears 4.5:1`, ratio >= 4.5, `${ratio.toFixed(2)}:1`);
}

// The escaping actually runs: a company name is the one field on this email a
// stranger controls, and /api/companies only refuses < and >.
const hostile = buildSignupRecoveryEmail({ ...BASE, companyName: 'A & B "Co" <b>' });
ok("a hostile company name is escaped into the HTML",
  hostile.html.includes("&amp;") && !hostile.html.includes("<b>"));

// ══════════════════════════════════════════════════════════════════════════
section("6. The code around it — scanned per function, never per file");

const CRON = "app/api/cron/signup-recovery/route.js";
const cronSrc = decomment(read(CRON));
const cronGet = handlerBodies(cronSrc).find((h) => h.name === "GET");
ok("the cron has a GET handler to scan", Boolean(cronGet));

const g = cronGet?.text || "";
// `at()` returns -1 for something absent, and -1 < anything is true — which is
// the exact false pass the brief warns about. So presence is asserted FIRST and
// the ordering only afterwards.
const at = (needle) => g.indexOf(needle);
const has = (needle) => at(needle) >= 0;

ok("the cron refuses an unauthenticated caller", has("requireCronSecret"));
ok("the cron reads the do-not-contact list in the same request", has("checkSuppression"));
ok("the cron decides with the shared planner, not a local rule", has("planSignupNudges"));
ok("the cron claims with a guarded updateMany", has("signupNudgeSentAt: null"));
ok("the cron reverts a claim when the send did not happen", has("revert()"));
ok("the cron re-reads the subscription before sending", has("db.company.findUnique"));
ok("the cron sends", has("sendEmail("));

ok(
  "the claim is written BEFORE the send, so a concurrent run cannot double up",
  has("signupNudgeSentAt: now") && has("sendEmail(") &&
    at("signupNudgeSentAt: now") < at("sendEmail("),
);
ok(
  "the FRESH subscription re-read happens before the send, not after",
  has("db.company.findUnique") && has("sendEmail(") &&
    at("db.company.findUnique") < at("sendEmail("),
);
ok(
  "the fresh read's refusal reverts rather than carrying on",
  /fresh\.subscription\)\s*\{\s*await revert\(\)/.test(g.replace(/\s+/g, " ")) ||
    /fresh\.subscription\s*\)\s*\{\s*await revert/.test(g),
);
ok(
  "sendEmail's three outcomes are all handled (no bare if (res.ok))",
  has("result?.error || result?.skipped"),
);
ok(
  "the cron never deletes a company",
  !/\.delete\(|\.deleteMany\(/.test(g),
);
ok(
  "the cron writes only the two nudge columns",
  !/data:\s*\{[^}]*\b(name|email|phone|onboardingStatus|trialEndsAt)\s*:/.test(g),
);

ok(
  "the cron is scheduled in vercel.json",
  JSON.parse(read("vercel.json")).crons.some((c) => c.path === "/api/cron/signup-recovery"),
);

// ── The counts ──────────────────────────────────────────────────────────
const overview = decomment(read("app/api/platform/analytics/overview/route.js"));
const overviewGet = handlerBodies(overview).find((h) => h.name === "GET")?.text || "";
ok("the overview imports the shared fragments rather than writing its own",
  overview.includes('from "@/lib/signup/abandoned"'));
ok("the overview's company total is scoped to completed signups",
  overviewGet.includes("completedSignupWhere()"));
ok("the overview counts incomplete signups separately rather than hiding them",
  overviewGet.includes("incompleteSignupWhere()") && overviewGet.includes("incompleteSignups"));
ok("the bare unscoped company count is gone",
  !/db\.company\.count\(\{\s*where:\s*NOT_DEMO\s*\}\)/.test(overviewGet));

const dash = read("app/platform/page.js");
ok("the dashboard renders the incomplete-signup count", dash.includes("data.incompleteSignups"));
ok("and links to the screen that lists them", dash.includes('href="/platform/signups"'));

const listRoute = decomment(read("app/api/platform/companies/route.js"));
ok("the companies list resolves the `incomplete` filter server-side",
  listRoute.includes('status === "incomplete"') && listRoute.includes("incompleteSignupWhere()"));
const listPage = read("app/platform/companies/page.js");
ok("the list page offers that filter",
  listPage.includes('value: "incomplete"'));
// Every filter chip the page renders has to be one the route actually resolves
// — a dead filter is the "control that appears to work" this repo keeps finding.
// `active`/`pending`/`churned` are OnboardingStatus values the route passes
// straight through; anything else has to be named in the route's own source.
const OFFERED = [...listPage.matchAll(/value:\s*"([a-z_]*)"/g)]
  .map((m) => m[1])
  .filter(Boolean);
ok("the page's filter chips were found to check", OFFERED.length >= 4, String(OFFERED));
ok(
  "every filter the page offers is one the API implements",
  OFFERED.every(
    (v) => ["active", "pending", "churned"].includes(v) || listRoute.includes(`"${v}"`),
  ),
  String(OFFERED),
);

const reports = decomment(read("app/api/platform/reports/route.js"));
ok("the companies export says which rows finished checkout",
  reports.includes('"Finished checkout"') && reports.includes('c.subscription ? "yes" : "no"'));

const tenantData = decomment(read("lib/analytics/tenantData.js"));
ok("the adoption denominators exclude abandoned signups",
  tenantData.includes("completedSignupWhere()"));
ok("and the records are scoped to the same population, not a different one",
  (tenantData.match(/REAL_CUSTOMER/g) || []).length >= 6);

// ── The flag ────────────────────────────────────────────────────────────
const signupsRoute = decomment(read("app/api/platform/signups/route.js"));
const signupsGet = handlerBodies(signupsRoute).find((h) => h.name === "GET")?.text || "";
ok("the console endpoint is behind a platform permission",
  signupsGet.includes("requirePlatformPermission") && signupsGet.includes("company:view"));
ok("it excludes demos", signupsGet.includes("isDemo: false"));
ok("it reports the do-not-contact state, so nobody rings someone who opted out",
  signupsGet.includes("checkSuppression") && signupsGet.includes("doNotContact"));
ok("it uses the same decision the cron uses rather than a second opinion",
  signupsGet.includes("decideSignupNudge"));
ok("it carries a way to reach the person",
  signupsGet.includes("phone") && signupsGet.includes("ownerName"));
ok(
  "the console endpoint is read-only — non-negotiable #3",
  !/export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)/.test(signupsRoute),
);
ok(
  "nothing in this feature creates a SalesLead",
  !signupsRoute.includes("salesLead.create") &&
    !decomment(read("app/api/cron/signup-recovery/route.js")).includes("salesLead"),
);

const signupsPage = read("app/platform/signups/page.js");
ok("the screen calls that endpoint", signupsPage.includes("/api/platform/signups"));
ok("the screen's email and phone are real links, not decoration",
  signupsPage.includes("mailto:") && signupsPage.includes("tel:"));
ok("the screen states the delay policy it is operating under",
  signupsPage.includes("policy.delayHours") && signupsPage.includes("policy.windowDays"));

const sidebar = read("app/components/platform/PlatformSidebar.js");
ok("the console has a way in — a nav row, not just a URL",
  sidebar.includes('href: "/platform/signups"'));

// ── The unsubscribe half ────────────────────────────────────────────────
const optOut = decomment(read("app/api/no-contact/[token]/route.js"));
const optOutBodies = handlerBodies(optOut);
const optGet = optOutBodies.find((h) => h.name === "GET")?.text || "";
const optPost = optOutBodies.find((h) => h.name === "POST")?.text || "";
ok("GET on the unsubscribe link does NOT mutate (mail scanners prefetch it)",
  !optGet.includes("suppress(") && optGet.includes("checkSuppression"));
ok("POST is what suppresses", optPost.includes("suppress("));
ok("it closes every channel, matching what the link says it does",
  optPost.includes("ALL_CHANNELS"));
ok("it records a real source from the closed vocabulary",
  optPost.includes('source: "form"'));
ok("it never deletes anything", !/\.delete\(|\.deleteMany\(/.test(optOut));
ok("the page exists and posts to it",
  read("app/no-contact/[token]/NoContactForm.js").includes("/api/no-contact/"));

// ══════════════════════════════════════════════════════════════════════════
section("7. Mutation testing — break each guarantee, confirm it is caught");

const MUTATIONS = [
  {
    file: "lib/signup/abandoned.js",
    label: "the completed-checkout guard is disabled",
    from: "  if (!isIncompleteSignup(company)) {",
    to: "  if (false && !isIncompleteSignup(company)) {",
  },
  {
    file: "lib/signup/abandoned.js",
    label: "the demo guard is removed",
    from: 'if (company.isDemo) return { send: false, reason: "demo" };',
    to: 'if (false) return { send: false, reason: "demo" };',
  },
  {
    file: "lib/signup/abandoned.js",
    label: "the already-emailed guard is removed",
    from: 'if (company.signupNudgeSentAt) return { send: false, reason: "already_nudged" };',
    to: 'if (false) return { send: false, reason: "already_nudged" };',
  },
  {
    file: "lib/signup/abandoned.js",
    label: "the same-address guard is removed (one person, four letters)",
    from: 'if (siblingNudgedAt) return { send: false, reason: "address_already_nudged" };',
    to: 'if (false) return { send: false, reason: "address_already_nudged" };',
  },
  {
    file: "lib/signup/abandoned.js",
    label: "the suppression guard is removed",
    from: 'if (suppressed) return { send: false, reason: "suppressed" };',
    to: 'if (false) return { send: false, reason: "suppressed" };',
  },
  {
    file: "lib/signup/abandoned.js",
    label: "the delay is dropped to nothing",
    from: "export const NUDGE_DELAY_HOURS = 24;",
    to: "export const NUDGE_DELAY_HOURS = 0;",
  },
  {
    file: "lib/signup/abandoned.js",
    label: "the window is widened past CASL's implied-consent limit",
    from: "export const NUDGE_WINDOW_DAYS = 30;",
    to: "export const NUDGE_WINDOW_DAYS = 3650;",
  },
  {
    file: "lib/signup/abandoned.js",
    label: "an unselected subscription relation reads as null instead of throwing",
    from: '        "isIncompleteSignup: company.subscription was not selected — cannot " +',
    to: '        "" + (() => { throw new Error("x"); })() + ',
    // The throw is what the assertion tests; replacing the MESSAGE would not
    // change behaviour, so this mutation replaces the guard instead.
    replaceInstead: {
      from: "  if (company.subscription === undefined) {",
      to: "  if (false) {",
    },
  },
  {
    file: "lib/signup/abandoned.js",
    label: "the recipient normaliser stops lower-casing (case splits one person in two)",
    from: 'const value = String(email ?? "").trim().toLowerCase();',
    to: 'const value = String(email ?? "").trim();',
  },
  {
    file: "lib/signup/abandoned.js",
    label: "a paying company at a shared address gets stamped",
    from: 'const STAMPABLE = new Set(["too_early", "too_late", "same_address_this_run"]);',
    to: 'const STAMPABLE = new Set(["too_early", "too_late", "same_address_this_run", "completed_checkout", "demo"]);',
  },
  {
    file: "lib/email/signupRecoveryEmail.js",
    label: "the email builds without an unsubscribe link",
    from: "  if (!optOutUrl) {",
    to: "  if (false) {",
  },
  {
    file: "lib/email/signupRecoveryEmail.js",
    label: "the CASL footer's mailing address becomes optional",
    from: "  if (!address) {",
    to: "  if (false) {",
  },
  {
    file: "lib/email/signupRecoveryEmail.js",
    label: "the small print drops below 4.5:1",
    from: 'const FAINT = "#595f6b";',
    to: 'const FAINT = "#9ca3af";',
  },
  {
    file: "app/api/cron/signup-recovery/route.js",
    label: "the cron stops re-reading the subscription before sending",
    from: "    const fresh = await db.company.findUnique({",
    to: "    const fresh = await Promise.resolve({ isDemo: false, subscription: null }); const _unused = ({",
  },
  {
    file: "app/api/cron/signup-recovery/route.js",
    label: "a failed send no longer reverts the claim",
    from: "    if (result?.error || result?.skipped) {",
    to: "    if (false) {",
  },
  {
    file: "app/api/platform/analytics/overview/route.js",
    label: "the dashboard counts abandoned signups as companies again",
    from: "    db.company.count({ where: { ...NOT_DEMO, ...completedSignupWhere() } }),",
    to: "    db.company.count({ where: NOT_DEMO }),",
  },
];

const backupDir = mkdtempSync(join(tmpdir(), "fq-abandoned-"));
const backups = new Map();
function backup(file) {
  if (backups.has(file)) return;
  const dest = join(backupDir, file.replace(/[\\/]/g, "__"));
  copyFileSync(join(ROOT, file), dest);
  backups.set(file, dest);
}
function restoreAll() {
  // cp, never git: a checkout would restore the last COMMIT over whatever is
  // in flight, and this repo has more than one agent in it today.
  for (const [file, dest] of backups) copyFileSync(dest, join(ROOT, file));
}

function selfCheckFails() {
  try {
    execFileSync(
      process.execPath,
      ["--import", "./scripts/alias-loader.mjs", "scripts/check-abandoned-signup.mjs", "--no-mutate"],
      { cwd: ROOT, stdio: "pipe" },
    );
    return false;
  } catch {
    return true;
  }
}

if (process.argv.includes("--no-mutate")) {
  console.log("  (skipped — running as a mutation subprocess)");
} else {
  const uncaught = [];
  for (const m of MUTATIONS) {
    backup(m.file);
    const path = join(ROOT, m.file);
    const original = readFileSync(path, "utf8");
    const from = m.replaceInstead?.from ?? m.from;
    const to = m.replaceInstead?.to ?? m.to;

    if (!original.includes(from)) {
      // A mutation that cannot be applied proves nothing and must not pass
      // silently — the anchor drifted and this row has been dead ever since.
      ok(`mutation anchor still exists — ${m.label}`, false, `no match for: ${from.trim().slice(0, 60)}`);
      continue;
    }

    writeFileSync(path, original.replace(from, to));
    const caught = selfCheckFails();
    writeFileSync(path, original);

    ok(`caught: ${m.label}`, caught);
    if (!caught) uncaught.push(m.label);
  }

  restoreAll();
  rmSync(backupDir, { recursive: true, force: true });

  if (uncaught.length) {
    console.log("\n  Mutations nothing caught:");
    for (const u of uncaught) console.log(`    - ${u}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${fails.length} failed\n`);
if (fails.length) {
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
