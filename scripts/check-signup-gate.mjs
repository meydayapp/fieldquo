// scripts/check-signup-gate.mjs
//
// Who gets into /app before anyone has paid.
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/db-stub-loader.mjs scripts/check-signup-gate.mjs
//
// ══ The hole ═══════════════════════════════════════════════════════════════
//
// app/api/companies/route.js commits the Company and the owner's Member row,
// and only then opens a Stripe Checkout session. app/app/layout.js's
// getSetupRedirect() returned null — "let them in" — the moment
// `member.companyId` existed. So closing the tab on Stripe's page bought the
// whole product. Ten live companies were in that state on 2026-09-02; one of
// them had built a quote.
//
// ══ Why the fix is more delicate than the hole ═════════════════════════════
//
// lib/billing/access.js grants FULL access to a company with no Subscription
// row on purpose, and its reasoning has to survive: a company whose checkout
// webhook hasn't landed must not be locked out of something they may well have
// paid for. Two situations wear the same absence, and the gate is only correct
// if it separates them — see lib/signup/setupGate.js for the evidence it uses
// and where the numbers came from.
//
// So this file EXECUTES setupGateDecision() across the matrix rather than
// reading it, including the states nobody reaches by hand: a platform admin
// impersonating a demo company that has no subscription, an invited employee
// of a company that never paid, and a cancelled subscription — which is a
// Subscription row and therefore emphatically NOT this gate's business.
//
// The lock states are executed too, through accessFor() itself rather than by
// asserting the strings this gate expects. That is the whole point: if
// accessFor ever stopped saying "no_subscription", this gate would silently
// stop firing, and a check that hardcoded the string would still pass.
//
// The last section is a text scan over the four files that consume the
// decision. A scan proves the call is present, never that a screen behaves —
// but every failure it looks for is one where the pure function was right and
// nothing called it. Each rule is scoped to ONE brace-matched function, so a
// guard deleted from getSetupRedirect can't be "found" in a comment at the top
// of the file or in an unrelated helper below it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  setupGateDecision,
  CHECKOUT_GRACE_MS,
  FINISH_SIGNUP_PATH,
} from "../lib/signup/setupGate.js";
import { accessFor } from "../lib/billing/access.js";
import { isBillingAdmin } from "../lib/billing/billingAdmin.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readRaw = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
// Every scan below reads code, never prose — see stripComments.
const read = (p) => stripComments(readRaw(p));

let checks = 0;
let failures = 0;

function ok(label, condition, why = "") {
  checks++;
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${why ? `\n         ${why}` : ""}`);
  }
}

/**
 * The body of `name`, brace-matched from its opening `{` to its real close.
 *
 * A regex like /function foo\([^)]*\)\s*\{([\s\S]*?)\}/ stops at the first `}`,
 * which for anything with an if-statement in it is the wrong one. Scoping
 * matters more here than usual: getSetupRedirect and getLockState sit in the
 * same file and both mention billing, so a rule that scanned the whole file
 * would pass on the wrong function's code.
 *
 * Throws when the function isn't there at all. That is deliberate — a scan
 * whose subject has been renamed must fail loudly, not quietly find nothing
 * and report success.
 */
function functionBody(src, name) {
  const start = src.search(
    new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`),
  );
  if (start === -1) throw new Error(`no function named ${name}`);

  // Walk the PARAMETER list out first. `src.indexOf("{", start)` looks right
  // and is wrong for every destructured signature in this codebase — the first
  // brace after `function AppLayout(` belongs to `{ children }`, so the matcher
  // would balance on it and hand back the parameter list as the body. That is
  // not hypothetical: it is what the first run of this file did, and three
  // rules "passed" against two words of source.
  const paren = src.indexOf("(", start);
  if (paren === -1) throw new Error(`no parameter list for ${name}`);
  let parenDepth = 0;
  let afterParams = -1;
  for (let i = paren; i < src.length; i++) {
    if (src[i] === "(") parenDepth++;
    else if (src[i] === ")") {
      parenDepth--;
      if (parenDepth === 0) {
        afterParams = i + 1;
        break;
      }
    }
  }
  if (afterParams === -1) throw new Error(`unbalanced parens in ${name}`);

  const open = src.indexOf("{", afterParams);
  if (open === -1) throw new Error(`no body for ${name}`);

  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/**
 * The source with its comments removed.
 *
 * Every rule below reads CODE. A comment that quotes the thing a rule looks
 * for — and these files are full of comments quoting exactly that, because
 * that is the house style — makes the rule pass on prose. The "it does not
 * offer /signup" rule failed on its own explanatory comment the first time it
 * ran, which is the friendly version of the same failure.
 *
 * Line comments are only stripped when not preceded by a colon, so a "https://"
 * inside a string survives.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** `needle` appears somewhere AFTER `anchor`, and `anchor` is there at all. */
function appearsAfter(src, anchor, needle) {
  const at = src.indexOf(anchor);
  if (at === -1) return false;
  return src.indexOf(needle, at + anchor.length) !== -1;
}

/**
 * `a` appears before `b`, and BOTH appear.
 *
 * `src.indexOf(a) < src.indexOf(b)` is true when `a` is absent (-1 beats
 * everything), so the ordering rules below would all pass on a file that had
 * lost the very guard they exist to protect.
 */
function orderedBoth(src, a, b) {
  const ia = src.indexOf(a);
  const ib = src.indexOf(b);
  return ia !== -1 && ib !== -1 && ia < ib;
}

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-09-02T12:00:00.000Z");
const LONG_AGO = new Date(NOW.getTime() - 30 * 24 * HOUR);
const MINUTES_AGO = new Date(NOW.getTime() - 10 * 60 * 1000);

/** An unpaid company that is definitely past the grace window. */
function unpaid(extra = {}) {
  return {
    hasSession: true,
    companyId: "cmp_1",
    membershipExists: true,
    billingReason: "no_subscription",
    companyCreatedAt: LONG_AGO,
    stripeSubscription: false,
    now: NOW,
    ...extra,
  };
}

console.log("\nsetupGateDecision — the eight states the gate has to tell apart\n");

// ── 1. No session ────────────────────────────────────────────────────────
{
  const d = setupGateDecision({ hasSession: false, companyId: null, now: NOW });
  ok(
    "no session at all is left to middleware, not sent to /signup",
    d.action === "allow" && d.reason === "no_session",
    "middleware.js already sends a sessionless /app request to /login; /signup is the wrong door",
  );
}

// ── 2. Session, no membership ────────────────────────────────────────────
{
  const d = setupGateDecision({
    hasSession: true,
    companyId: null,
    membershipExists: false,
    now: NOW,
  });
  ok(
    "signed in with no company goes back to finish signup",
    d.action === "redirect" && d.path === FINISH_SIGNUP_PATH,
    "the account exists and the company was never posted — /signup resumes from the draft",
  );

  const stranded = setupGateDecision({
    hasSession: true,
    companyId: null,
    membershipExists: true,
    now: NOW,
  });
  ok(
    "a membership that exists but won't resolve is NOT sent to /signup",
    stranded.action === "allow" && stranded.reason === "membership_unresolved",
    "a company missing its authOrgId is a different fault, and /signup would offer them a SECOND company",
  );
}

// ── 3. Membership with a subscription ────────────────────────────────────
for (const reason of ["active", "trialing"]) {
  const d = setupGateDecision(unpaid({ billingReason: reason, role: "owner" }));
  ok(
    `a company whose subscription is ${reason} is let straight through`,
    d.action === "allow" && d.reason === "subscription_exists",
  );
}

// ── 4. No subscription, member IS the owner ──────────────────────────────
{
  const d = setupGateDecision(unpaid({ role: "owner" }));
  ok(
    "an owner who never completed checkout is sent back to finish signup",
    d.action === "redirect" &&
      d.path === FINISH_SIGNUP_PATH &&
      d.reason === "checkout_never_completed",
    "the owner's ruling: the dashboard stays shut until the card is in",
  );

  const admin = setupGateDecision(unpaid({ role: "admin" }));
  ok(
    "an admin gets the same door, because the checkout route accepts one",
    admin.action === "redirect" && admin.path === FINISH_SIGNUP_PATH,
    "isBillingAdmin is the gate POST /api/platform/billing/checkout applies; a narrower rule here would hide a button the route would have honoured",
  );
  ok(
    "and that is the SAME rule, not a second copy of it",
    isBillingAdmin("admin") && isBillingAdmin("owner") && !isBillingAdmin("estimator"),
  );
}

// ── 5. No subscription, member is an invited employee ────────────────────
//
// The case most likely to be got wrong, and the reason this gate is not just a
// redirect. /signup sets up a NEW business.
for (const role of ["estimator", "supervisor", "crew", "viewer"]) {
  const d = setupGateDecision(unpaid({ role }));
  ok(
    `an invited ${role} is NOT sent to /signup`,
    d.action === "setup_incomplete" && d.path === undefined,
    "sending them there would offer a SECOND company beside the one they were invited to — the exact failure getSetupRedirect's own comment warns about",
  );
}

// ── 6. An impersonating superadmin ───────────────────────────────────────
{
  for (const extra of [
    { role: "viewer" },
    { role: "owner" },
    { isDemo: true, role: "owner" },
    { billingReason: "grace_expired", role: "viewer" },
  ]) {
    const d = setupGateDecision(unpaid({ impersonating: true, ...extra }));
    ok(
      `a read-only support session is never redirected (${JSON.stringify(extra)})`,
      d.action === "allow" && d.reason === "impersonation",
      "an admin looking at a customer's account must never be dropped into that customer's signup",
    );
  }
}

// ── 7. A locked company ──────────────────────────────────────────────────
//
// Executed through accessFor itself, so the two gates cannot drift apart by
// this file quietly hardcoding a reason string accessFor stopped producing.
{
  const lockedGrace = accessFor(
    { status: "past_due", pastDueSince: new Date(NOW.getTime() - 30 * 24 * HOUR) },
    NOW,
  );
  ok(
    "accessFor still calls an expired grace period locked",
    lockedGrace.level === "locked" && lockedGrace.reason === "grace_expired",
  );

  const d = setupGateDecision(
    unpaid({ billingReason: lockedGrace.reason, role: "owner" }),
  );
  ok(
    "a locked company falls to the lock screen, NOT to signup",
    d.action === "allow" && d.reason === "subscription_exists",
    "AccountLocked is a different state with a different screen and its own escape route; swallowing it here would replace 'update your card' with 'sign up again'",
  );

  ok(
    "and the two can never both fire — lock needs a row, this needs its absence",
    accessFor(null, NOW).reason === "no_subscription" &&
      accessFor(null, NOW).level === "full",
    "accessFor(null) is FULL access on purpose (lib/billing/access.js); that is why this gate exists separately rather than tightening it",
  );
}

// ── 8. A subscription that was CANCELLED ─────────────────────────────────
//
// Not the same as never having had one, and the difference is money: they paid,
// they left, and they are owed 30 days of read-only to pull their invoices.
{
  const fresh = accessFor(
    { status: "canceled", canceledAt: new Date(NOW.getTime() - 2 * 24 * HOUR) },
    NOW,
  );
  const expired = accessFor(
    { status: "canceled", canceledAt: new Date(NOW.getTime() - 90 * 24 * HOUR) },
    NOW,
  );
  ok(
    "accessFor tells a cancellation apart from an absence",
    fresh.reason === "canceled" &&
      expired.reason === "canceled_expired" &&
      fresh.reason !== "no_subscription",
  );

  for (const access of [fresh, expired]) {
    const d = setupGateDecision(
      unpaid({ billingReason: access.reason, role: "owner" }),
    );
    ok(
      `a ${access.reason} company is left to the billing gate, not to signup`,
      d.action === "allow" && d.reason === "subscription_exists",
      "'start your plan again' and 'finish signing up' are different sentences to a different person",
    );
  }
}

console.log("\nThe two things that must not lock a paying customer out\n");

// ── The webhook that hasn't landed ───────────────────────────────────────
{
  const d = setupGateDecision(unpaid({ role: "owner", companyCreatedAt: MINUTES_AGO }));
  ok(
    "a company created minutes ago is let in without asking Stripe anything",
    d.action === "allow" && d.reason === "within_checkout_grace",
    "checkout.session.completed lands in seconds and /app itself carries the reconcile net — a gate that bounces people OFF /app has to be looser than that",
  );

  ok(
    "the grace window is at least an hour",
    CHECKOUT_GRACE_MS >= HOUR,
    "measured company→subscription lag on the live data: ten of twelve inside 130 seconds, INCLUDING the human typing their card",
  );

  const edge = setupGateDecision(
    unpaid({
      role: "owner",
      companyCreatedAt: new Date(NOW.getTime() - CHECKOUT_GRACE_MS + 1000),
    }),
  );
  ok(
    "the window is a real boundary, not a rounding",
    edge.action === "allow" && edge.reason === "within_checkout_grace",
  );

  const missingDate = setupGateDecision(
    unpaid({ role: "owner", companyCreatedAt: null }),
  );
  ok(
    "a company whose createdAt could not be read is let in",
    missingDate.action === "allow",
    "not knowing how old an account is is our problem, not theirs",
  );
}

// ── Stripe is the evidence, and not knowing is not a no ──────────────────
{
  const unknown = setupGateDecision(
    unpaid({ role: "owner", stripeSubscription: null }),
  );
  ok(
    "Stripe being unreachable lets them in",
    unknown.action === "allow" && unknown.reason === "stripe_unknown",
    "a wrong lock takes a contractor's working day away; a wrong allow costs a few days of free usage",
  );

  const paid = setupGateDecision(
    unpaid({ role: "owner", stripeSubscription: true }),
  );
  ok(
    "Stripe holding a subscription lets them in even with no local row",
    paid.action === "allow" && paid.reason === "stripe_has_subscription",
    "this is what stops someone who has JUST paid being bounced out of the page they paid to reach, before the webhook lands",
  );

  const demo = setupGateDecision(unpaid({ role: "owner", isDemo: true }));
  ok(
    "a seeded demo company is never gated",
    demo.action === "allow" && demo.reason === "demo_company",
    "ten of the twenty subscription-less companies in the live data are the demo fixtures",
  );
}

console.log("\nThe gate is actually wired in\n");

// ── app/app/layout.js ────────────────────────────────────────────────────
{
  const layout = read("app/app/layout.js");
  const body = functionBody(layout, "getSetupRedirect");

  ok(
    "getSetupRedirect calls the shared decision rather than re-deciding",
    /setupGateDecision\(/.test(body),
    "a second copy of these rules is the copy that rots",
  );
  ok(
    "it resolves the member with skipBillingGate",
    /skipBillingGate:\s*true/.test(body),
    "without it the billing gate throws in the layout, which would break the one page that fixes the problem",
  );
  ok(
    "it reads the billing reason getCurrentMember already computed",
    /billingAccess\?\.reason/.test(body),
    "one answer, shared with the lock screen — two lookups would be two opinions",
  );
  ok(
    'it short-circuits on anything other than "no_subscription"',
    orderedBoth(body, 'billingAccess?.reason !== "no_subscription"', "setupGateDecision("),
    "every paying company must leave this function before it costs a query",
  );
  ok(
    "it passes the impersonation flag through",
    /impersonating:\s*Boolean\(member\.impersonation\)/.test(body),
    "an impersonated member carries a real companyId and the demo fixtures have no subscription — without this an admin is dropped into a customer's signup",
  );
  ok(
    "it only asks Stripe after a decision that would otherwise turn someone away",
    orderedBoth(body, "provisional.action === \"allow\"", "stripeSubscriptionExists("),
    "impersonation, a demo fixture and a fresh company must never pay for a network call",
  );
  ok(
    "the employee case comes back as a screen, not a path",
    /setupIncomplete:\s*true/.test(body),
    "a string here would be redirected, and /signup offers an invited estimator a business of their own",
  );

  const shell = functionBody(layout, "AppLayout");
  ok(
    "only a string redirects",
    /typeof setupPath === "string"/.test(shell),
    'a bare `if (setupPath)` would treat the { setupIncomplete } object as a path and redirect() to "[object Object]"',
  );
  ok(
    "the employee screen is rendered, not just returned from the resolver",
    /setupPath\?\.setupIncomplete/.test(shell) && /<SetupIncomplete/.test(shell),
    "a decision nothing renders is a field written and never read",
  );
  ok(
    "the setup decision is taken before the lock screen",
    orderedBoth(shell, "typeof setupPath === \"string\"", "if (locked)"),
    "they are mutually exclusive by construction, but the order says which one owns the question",
  );
}

// ── The screen the employee gets ─────────────────────────────────────────
{
  const screen = read("app/components/layout/SetupIncomplete.js");
  ok(
    "the employee screen offers sign-out and it goes through better-auth",
    /signOut\(/.test(screen) && /from "@\/lib\/auth-client"/.test(screen),
    "a raw fetch to /api/auth/sign-out leaves better-auth's client store thinking they are still signed in",
  );
  ok(
    "it does not link back into /app",
    !/href="\/app/.test(screen),
    "every /app route renders this same screen — a link that returns you to where you already are is a dead control",
  );
  ok(
    "it does not offer /signup",
    !/["'`]\/signup/.test(screen),
    "that is the whole point: it would offer them a SECOND company",
  );
}

// ── /signup can actually finish the payment ──────────────────────────────
{
  const page = read("app/signup/page.js");
  const finish = functionBody(page, "handleFinish");

  ok(
    "a resumed payment does NOT post /api/companies",
    orderedBoth(finish, "if (finishCheckout) {", '"/api/companies"'),
    "that route 409s on any session that already has a membership — the redirect would land on a dead button",
  );
  ok(
    "it opens checkout for the company that already exists",
    /"\/api\/platform\/billing\/checkout"/.test(finish),
    "the same route Account & Billing's Choose plan uses, with the same billing-admin gate",
  );
  ok(
    "it sends the plan and the cadence, never a price",
    /planId:\s*selectedPlanId/.test(finish) &&
      /interval:\s*effectiveInterval/.test(finish) &&
      !/amount|price|total/i.test(finish.split("if (finishCheckout) {")[1].split("\n    }\n")[0]),
    "non-negotiable #5: the browser never sends money amounts",
  );
  ok(
    "the failure branch says something",
    appearsAfter(finish, "if (!res.ok || !data?.checkoutUrl)", "setError("),
    "`if (res.ok) {}` with no else is the second recurring failure class in AGENTS.md",
  );

  ok(
    "the resume state is established on the server, in one question",
    /"\/api\/signup\/resume"/.test(page),
    "inferring it from /api/settings/subscription is ambiguous: that route returns a null status both for no subscription AND for anyone who isn't a billing admin",
  );
  ok(
    "the plan step is where a resumed visit lands",
    /if \(finishCheckout\) \{\s*\n\s*entryStepRef\.current = "plan";/.test(page),
    "resumeStep clamps to what a DRAFT supports, and the draft dies with the tab",
  );
  ok(
    "the company's own address fills a missing draft",
    /country: f\.country \|\| finishCheckout\.country/.test(page),
    "no country means the plan step asks 'where is your business?' and its button leads to a form whose Continue 409s",
  );
  ok(
    "Back is not rendered on a resumed payment",
    /\{!finishCheckout && \(\s*\n\s*<button/.test(page),
    "the earlier steps edit a company that already exists and nothing on this page writes to it",
  );
  ok(
    "a redirected owner can still sign out",
    // Both halves, and both anchored. /handleSignOut/ alone still matched
    // after the mutation test renamed it to handleSignOutRemoved — a substring
    // is not a binding, and the rule that "passed" was checking nothing.
    /async function handleSignOut\(\)/.test(page) &&
      /onClick=\{handleSignOut\}/.test(page) &&
      /\bsignOut\(\{/.test(page),
    "every /app route sends them back here and the header's avatar links to /app, so without this there is no way to leave an account they cannot use — the same reason /api/auth is on the locked-account allow-list",
  );
  ok(
    "the free month is quoted from the company, not promised blindly",
    /resumeTrialLive/.test(page) && /trialEndsAt/.test(page),
    "/api/platform/billing/checkout only sends trial days while trialEndsAt is in the future — saying 'first month free' over a charge that lands today is a promise with money on it",
  );
}

// ── The resume endpoint ──────────────────────────────────────────────────
{
  const route = read("app/api/signup/resume/route.js");
  const get = functionBody(route, "GET");
  ok(
    "the resume endpoint refuses a support session",
    orderedBoth(get, "member.impersonation", "isBillingAdmin("),
    "the answer exists to put a Pay button on a screen, and impersonation is read-only",
  );
  ok(
    "it applies the same billing-admin gate as the checkout route",
    /isBillingAdmin\(member\.role\)/.test(get),
    "otherwise an estimator gets a Continue to Payment button whose POST 403s",
  );
  ok(
    "it refuses when a subscription already exists",
    /subscription\b/.test(get) && /resume:\s*true/.test(get),
    "resuming a paid company would take a second payment",
  );
  ok(
    "and it refuses a demo fixture",
    /company\.isDemo/.test(get),
  );
}

// ── The Stripe evidence ──────────────────────────────────────────────────
{
  const evidence = read("lib/billing/checkoutEvidence.js");
  const fn = functionBody(evidence, "stripeSubscriptionExists");
  ok(
    "the evidence is a SUBSCRIPTION, not merely a customer",
    /stripe\.subscriptions\.list\(/.test(fn),
    "createTrialCheckoutSession makes a customer before anyone types a digit — every abandoned signup has one",
  );
  ok(
    "an unreachable Stripe returns null, not false",
    appearsAfter(fn, "catch (err)", "return null"),
    "null is read as 'let them in'; returning false would lock a paying company out over a bad minute at Stripe",
  );
  ok(
    "it asks for every status",
    /status:\s*"all"/.test(fn),
    "the question is whether money ever changed hands, not whether they are current",
  );
}

// ── The reasoning in lib/billing/access.js has to stay put ───────────────
{
  const access = read("lib/billing/access.js");
  const fn = functionBody(access, "accessFor");
  ok(
    "accessFor still grants full access with no subscription row",
    /if \(!sub\) \{[\s\S]*?level: "full"[\s\S]*?reason: "no_subscription"/.test(fn),
    "this gate exists BECAUSE that stays true — a company whose webhook is late must keep working, and tightening accessFor would have locked them out of every API instead of asking them to finish signing up",
  );
}

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
