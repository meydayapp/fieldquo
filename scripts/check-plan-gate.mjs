// scripts/check-plan-gate.mjs
//
//   npm run check:plan-gate
//
// May a company that never finished checkout SEND?
//
// ══ The hole ═══════════════════════════════════════════════════════════════
//
// lib/signup/setupGate.js is the careful decision about who may use the product
// before anyone has paid — grace window, Stripe evidence, demo fixtures,
// impersonation. It was called from exactly ONE place: app/app/layout.js's
// getSetupRedirect(). That is a SCREEN redirect. No API route asked it, so a
// direct request — a stale tab, a saved fetch, a script — created and SENT
// quotes for a company with no plan. The owner, looking at ~20 companies
// reading "pending · Never finished checkout · No plan", several holding
// quotes: "there should be something stopping a company with no plan from
// sending quotes… maybe prompting them to complete it".
//
// ══ Which way this check can be fooled, and how it isn't ═══════════════════
//
// Everything that can be executed is executed. The gate is asked with a
// scripted database (scripts/fixtures/dbStub.mjs), a scripted Stripe answer,
// and a stubbed next/server, so the assertions are about what a browser
// RECEIVES — the status, the body, the path in it — rather than about the
// sentences in the source. The refusal is then run through the CLIENT half
// too, because "a door, not a wall" is a claim about what the screen does with
// the body, and a 402 nobody turns into a prompt is a wall.
//
// The route half cannot be executed (a Next handler needs a request, a session
// and a live tenant), so it is SCANNED — comment-stripped first, because this
// codebase's house style is to explain the bug in a comment directly above the
// guard, and a rule that matched prose would pass on the file that lost the
// guard. Each rule is scoped to the brace-matched handler it is about, so a
// gate deleted from POST cannot be "found" in GET.
//
// Run:
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs \
//        scripts/check-plan-gate.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { register } from "node:module";

import { ROOT, decomment, handlerBodies, balanced } from "./tenantScopeScan.mjs";
import { rows, reads, resetDbStub } from "./fixtures/dbStub.mjs";

// ── Two stubs, and why each one ────────────────────────────────────────────
//
// next/server: NextResponse.json is what the refusal is built with, and the
//   whole point is to inspect the status and body it produces.
// checkoutEvidence: the real one asks Stripe. Scripting it is the only way to
//   exercise BOTH "Stripe says no" (the deny path) and "we couldn't find out"
//   (which must still allow) — and the second is the one that protects a
//   paying customer from a bad minute at Stripe.
//
// Registered here rather than as another --import file: they exist for this
// check alone, and a loader in scripts/ would look like something other checks
// may lean on. Same technique as scripts/check-refusal-shape.mjs.
const HOOKS = `
const STUBS = {
  "next/server": "fq-stub:next",
  "@/lib/billing/checkoutEvidence": "fq-stub:evidence",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:next")
    return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  if (url === "fq-stub:evidence")
    return { format: "module", shortCircuit: true,
      source: "export const stripeSubscriptionExists = async (c) => globalThis.__FQ_STRIPE(c);" };
  return nextLoad(url, context);
}
`;
globalThis.__FQ_STRIPE = async () => null;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const {
  planDecision,
  planOrRefusal,
  planRefusalBody,
  PLAN_REQUIRED_STATUS,
} = await import("@/lib/signup/planGate");
const { planRequiredFrom, planRequiredPayload, PLAN_REQUIRED_EVENT } =
  await import("@/lib/signup/planRequired");
const { CHECKOUT_GRACE_MS, FINISH_SIGNUP_PATH } = await import(
  "@/lib/signup/setupGate"
);

let checks = 0;
let failures = 0;
const ok = (label, condition, why = "") => {
  checks++;
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${why ? `\n         ${why}` : ""}`);
  }
};

const read = (p) => decomment(readFileSync(join(ROOT, p), "utf8"));

const NOW = new Date("2026-09-10T12:00:00.000Z");
const MINUTE = 60 * 1000;
const LONG_AGO = new Date(NOW.getTime() - 30 * 24 * 60 * MINUTE);

/**
 * Set the world up, then ask.
 *
 * Everything the gate reads comes from the scripted database or the scripted
 * Stripe, so each row of the matrix below is a WORLD, not a set of arguments —
 * which is the difference between testing the gate and testing setupGateDecision
 * a second time (scripts/check-signup-gate.mjs already does that, and this file
 * deliberately does not repeat it).
 */
async function decide({
  member = {},
  company = null,
  subscription = null,
  stripe = null,
} = {}) {
  resetDbStub();
  if (company) rows.company.push(company);
  if (subscription) rows.subscription.push(subscription);
  globalThis.__FQ_STRIPE = async () => stripe;
  return planDecision(member, NOW);
}

const OWNER = { companyId: "co", role: "owner" };
const ESTIMATOR = { companyId: "co", role: "estimator" };
const OLD_COMPANY = { id: "co", isDemo: false, createdAt: LONG_AGO };

console.log("\nplanDecision — the states a send has to tell apart\n");

// ── 1. An active subscription ────────────────────────────────────────────
{
  const d = await decide({
    member: OWNER,
    company: OLD_COMPANY,
    subscription: { companyId: "co", status: "active" },
  });
  ok(
    "a paying company sends",
    d.action === "allow" && d.reason === "subscription_exists",
    JSON.stringify(d),
  );
  ok(
    "...without a single extra query or a call to Stripe",
    !reads.some((r) => r.model === "company"),
    "every send by every paying customer runs this; it must leave at the first answer",
  );
}

// ── 2. TRIALING — the one that breaks every legitimate new customer ──────
//
// Non-negotiable #1: signup is open and the first month is free (TRIAL_PRICE).
// This gate is about "never finished checkout", NOT "has not been charged yet".
{
  const d = await decide({
    member: OWNER,
    company: OLD_COMPANY,
    subscription: { companyId: "co", status: "trialing" },
  });
  ok(
    "a company on its FREE FIRST MONTH sends",
    d.action === "allow" && d.reason === "subscription_exists",
    "the trial is a Subscription row like any other — refusing it would lock out every new customer on day one",
  );

  // The same company on the day the card is charged, and the day a payment
  // fails: neither is this gate's business, and both must leave it untouched.
  for (const status of ["past_due", "canceled"]) {
    const later = await decide({
      member: OWNER,
      company: OLD_COMPANY,
      subscription: { companyId: "co", status, pastDueSince: NOW, canceledAt: NOW },
    });
    ok(
      `a ${status} company is left to the billing gate, not to this one`,
      later.action === "allow",
      "AccountLocked is a different state with its own screen; 'finish signing up' is the wrong sentence for someone who paid for a year",
    );
  }
}

// ── 3. Never finished checkout ───────────────────────────────────────────
{
  const d = await decide({
    member: OWNER,
    company: OLD_COMPANY,
    stripe: false,
  });
  ok(
    "an owner who never entered a card cannot send",
    d.action === "redirect" &&
      d.path === FINISH_SIGNUP_PATH &&
      d.reason === "checkout_never_completed",
    JSON.stringify(d),
  );

  const employee = await decide({
    member: ESTIMATOR,
    company: OLD_COMPANY,
    stripe: false,
  });
  ok(
    "an invited employee cannot send either, and is NOT offered /signup",
    employee.action === "setup_incomplete" && !employee.path,
    "/signup sets up a NEW business — sending an estimator there offers them a second company beside the one they were invited to",
  );

  // Stripe's ignorance is not evidence against them.
  const unknown = await decide({
    member: OWNER,
    company: OLD_COMPANY,
    stripe: null,
  });
  ok(
    "Stripe being unreachable lets the send through",
    unknown.action === "allow" && unknown.reason === "stripe_unknown",
    "a wrong lock takes a contractor's working day away; a wrong allow costs a few days of free usage",
  );

  const paid = await decide({ member: OWNER, company: OLD_COMPANY, stripe: true });
  ok(
    "Stripe holding a subscription lets the send through before our webhook lands",
    paid.action === "allow" && paid.reason === "stripe_has_subscription",
  );
}

// ── 4. Checkout finished 30 seconds ago ──────────────────────────────────
//
// The webhook has not landed, so there is no Subscription row and
// accessForCompany reports "setup_pending". Refusing here would refuse the
// FIRST thing a brand-new paying customer does.
{
  const fresh = { id: "co", isDemo: false, createdAt: new Date(NOW.getTime() - 30_000) };
  const d = await decide({ member: OWNER, company: fresh, stripe: false });
  ok(
    "a company that paid 30 seconds ago sends",
    d.action === "allow" && d.reason === "within_checkout_grace",
    JSON.stringify(d),
  );
  ok(
    "...and Stripe was never asked, because time answered it",
    d.reason === "within_checkout_grace",
    "the demo fixtures and every fresh signup must not pay for a network call on the send path",
  );

  const edge = await decide({
    member: OWNER,
    company: { id: "co", isDemo: false, createdAt: new Date(NOW.getTime() - CHECKOUT_GRACE_MS + 1000) },
    stripe: false,
  });
  ok("the grace window is a real boundary, not a rounding", edge.action === "allow");

  const past = await decide({
    member: OWNER,
    company: { id: "co", isDemo: false, createdAt: new Date(NOW.getTime() - CHECKOUT_GRACE_MS - 1000) },
    stripe: false,
  });
  ok(
    "and it ENDS — a company past it with no evidence is refused",
    past.action === "redirect",
    "a grace window that never closes is not a grace window",
  );
}

// ── 5. A demo company ────────────────────────────────────────────────────
//
// Ten of them (demo1…demo10), four quotes each, no members, no subscription.
// They are FieldQuo's own props and a demo means SENDING one of those quotes.
{
  const d = await decide({
    member: OWNER,
    company: { id: "co", isDemo: true, createdAt: LONG_AGO },
    stripe: false,
  });
  ok(
    "a seeded demo company sends",
    d.action === "allow" && d.reason === "demo_company",
    "there is nobody to send to checkout — scripts/seed-demos.mjs creates no logins",
  );
}

// ── 6. An impersonating admin ────────────────────────────────────────────
{
  const d = await decide({
    member: { ...OWNER, impersonation: true },
    company: OLD_COMPANY,
    stripe: false,
  });
  ok(
    "a support session is never told to finish someone else's signup",
    d.action === "allow" && d.reason === "impersonation",
  );
  ok(
    "...answered before any query at all",
    reads.length === 0,
    "an impersonated member carries a real companyId; a lookup here would be a support session paying for the customer's billing state",
  );
  ok(
    "and that allow is not a way to send: impersonation is read-only upstream",
    /assertReadOnly\(/.test(read("lib/currentMember.js")) &&
      /if \(method === "GET" \|\| method === "HEAD" \|\| method === "OPTIONS"\)/.test(
        read("lib/currentMember.js"),
      ),
    "non-negotiable #2 — every POST under impersonation is already refused 403 before a route's own gates run",
  );
}

// ── 7. No session ────────────────────────────────────────────────────────
{
  const d = await decide({ member: null });
  ok(
    "no member at all is not answered with a plan prompt",
    d.action === "allow",
    "memberOrRefusal has already answered 401; a 402 here would tell a signed-out stranger to go and pay",
  );
}

console.log("\nThe refusal a browser actually receives\n");

{
  resetDbStub();
  rows.company.push(OLD_COMPANY);
  globalThis.__FQ_STRIPE = async () => false;

  const { response, decision } = await planOrRefusal(OWNER, "send this quote");
  ok("a refused send answers 402", response?.status === PLAN_REQUIRED_STATUS, response?.status);
  ok(
    "402, not 403 — the same reasoning the billing gate gives",
    PLAN_REQUIRED_STATUS === 402,
    "'Forbidden' reads as a permissions problem and sends people to their admin",
  );
  ok(
    "it says what is wrong, in a sentence with the action in it",
    typeof response?.body?.error === "string" &&
      response.body.error.includes("send this quote"),
    response?.body?.error,
  );
  // Optional chaining all the way down, deliberately: when a mutation makes
  // the gate stop refusing, `response` is undefined, and a check that throws
  // here prints no summary at all — which reads like a broken script rather
  // than a caught regression. Every assertion below has to survive the very
  // failure it exists to report.
  ok(
    "it carries the path that fixes it",
    response?.body?.planRequired?.path === FINISH_SIGNUP_PATH &&
      response?.body?.planRequired?.canFinish === true,
    JSON.stringify(response?.body?.planRequired),
  );
  ok("and names the reason for a support conversation", Boolean(decision?.reason));
  ok(
    "it does NOT wear the billing gate's `billing` key",
    Boolean(response?.body) && !("billing" in response.body),
    "a lapsed card and a checkout that never happened are different screens; one body cannot mean both",
  );

  const allowed = await planOrRefusal(
    { ...OWNER, billingAccess: { reason: "active" } },
    "send this quote",
  );
  ok("an allowed send returns no response to send back", !allowed.response);
}

{
  // The employee's version: no path, and copy that names who can fix it.
  const body = planRefusalBody(
    { action: "setup_incomplete", reason: "checkout_never_completed_no_billing_rights" },
    "send this quote",
  );
  ok(
    "an invited employee is given no checkout link",
    body.planRequired.path === null && body.planRequired.canFinish === false,
  );
  ok(
    "...and is told who can finish it",
    /owner or an admin/i.test(body.error),
    body.error,
  );
}

console.log("\nA door, not a wall — the client half\n");

{
  // A window that records what was dispatched. CustomEvent is not guaranteed
  // in every node this runs under, so it is provided rather than assumed.
  const dispatched = [];
  globalThis.CustomEvent =
    globalThis.CustomEvent ||
    class {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
  globalThis.window = { dispatchEvent: (e) => dispatched.push(e) };

  const refused = planRefusalBody(
    { action: "redirect", reason: "checkout_never_completed", path: FINISH_SIGNUP_PATH },
    "send this quote",
  );

  ok("the refusal is recognised", planRequiredFrom(402, refused) === true);
  ok(
    "and it opens the prompt, carrying the path",
    dispatched.length === 1 &&
      dispatched[0].type === PLAN_REQUIRED_EVENT &&
      dispatched[0].detail?.path === FINISH_SIGNUP_PATH &&
      dispatched[0].detail?.message === refused.error,
    JSON.stringify(dispatched[0]?.detail),
  );

  dispatched.length = 0;
  ok(
    "a BILLING 402 is not mistaken for it",
    planRequiredFrom(402, { error: "Your payment failed.", billing: { state: "locked" } }) ===
      false && dispatched.length === 0,
    "a card that failed and a checkout that never happened lead to different screens",
  );
  ok("a 403 is not mistaken for it", planRequiredFrom(403, refused) === false);
  ok("and neither is a success", planRequiredPayload(200, refused) === null);

  delete globalThis.window;
}

console.log("\nThe gate is in the REQUEST, not in the screen\n");

// ── Every route that puts something in front of a client ─────────────────
//
// The list is the point. Each entry is a route whose POST leaves the building:
// an email, a public link, a call, a payment, a published page. If one of these
// loses its gate, this fails by name.
const GATED = {
  "app/api/quotes/[id]/send/route.js": "POST",
  "app/api/quotes/[id]/share/route.js": "POST",
  "app/api/quotes/[id]/call/route.js": "POST",
  "app/api/invoices/[id]/send/route.js": "POST",
  "app/api/invoices/[id]/request-payment/route.js": "POST",
  "app/api/invoices/[id]/checkout-link/route.js": "POST",
  "app/api/service-plans/[id]/authorise/route.js": "POST",
  "app/api/marketing/campaigns/[id]/send/route.js": "POST",
  "app/api/marketing/designer/designs/[id]/publish/route.js": "POST",
  "app/api/settings/website/route.js": "PUT",
};

for (const [file, handlerName] of Object.entries(GATED)) {
  const src = read(file);
  const handler = handlerBodies(src).find((h) => h.name === handlerName);
  if (!handler) {
    ok(`${file} still has a ${handlerName}`, false, "renamed or removed");
    continue;
  }

  ok(
    `${file} ${handlerName} asks the plan gate`,
    /planOrRefusal\(/.test(handler.text),
    "a gate in the screen is not a gate in the request",
  );
  ok(
    `${file} imports it from the one place it lives`,
    /import \{ planOrRefusal \} from "@\/lib\/signup\/planGate"/.test(src),
    "a second copy of this decision is the copy that rots",
  );

  // The refusal has to be RETURNED. Binding it and dropping it is the same
  // bug with the import fixed — scripts/check-refusal-shape.mjs makes the
  // identical demand of memberOrRefusal, for the same reason.
  const bound = handler.text.match(/\{\s*response:\s*([A-Za-z0-9_]+)\s*\}\s*=\s*await planOrRefusal\(/);
  ok(
    `${file} ${handlerName} returns the refusal`,
    Boolean(bound) && new RegExp(`if \\(${bound[1]}\\) return ${bound[1]};`).test(handler.text),
    "a refusal bound and never tested is a send that goes out anyway",
  );

  // Order: the member is resolved (and 401/403/402'd) BEFORE the plan is
  // questioned. Otherwise a signed-out stranger gets "finish your signup".
  const memberAt = Math.min(
    ...[/memberOrRefusal\(/, /memberOrRefusalPlain\(/, /requireAdmin\(/]
      .map((re) => handler.text.search(re))
      .filter((i) => i !== -1),
  );
  const planAt = handler.text.search(/planOrRefusal\(/);
  ok(
    `${file} ${handlerName} resolves the member first`,
    Number.isFinite(memberAt) && memberAt < planAt,
    "a 402 before a 401 tells a stranger to go and pay",
  );
}

// ── And the things deliberately NOT gated ────────────────────────────────
//
// Named, because "we forgot" and "we decided" look identical in a diff.
{
  const website = read("app/api/settings/website/route.js");
  const put = handlerBodies(website).find((h) => h.name === "PUT");
  ok(
    "the website gate fires on PUBLISHING, not on saving a draft",
    /body\.published === true/.test(put.text) &&
      put.text.indexOf("body.published === true") < put.text.indexOf("planOrRefusal("),
    "building the site is the trial; putting it in front of the public is the outward act",
  );
  const del = handlerBodies(website).find((h) => h.name === "DELETE");
  ok(
    "UNPUBLISHING is never gated",
    !/planOrRefusal\(/.test(del.text),
    "taking a page down must work in every state — a de-escalation that needs a plan is a trap",
  );

  const authorise = read("app/api/service-plans/[id]/authorise/route.js");
  const revoke = handlerBodies(authorise).find((h) => h.name === "DELETE");
  ok(
    "withdrawing a payment authorisation is never gated",
    !revoke || !/planOrRefusal\(/.test(revoke.text),
    "same reason: removing a client's exposure cannot be the thing that requires a plan",
  );

  for (const drafting of [
    "app/api/quotes/route.js",
    "app/api/quotes/[id]/route.js",
    "app/api/invoices/route.js",
  ]) {
    ok(
      `${drafting} is deliberately NOT gated`,
      !/planOrRefusal\(/.test(read(drafting)),
      "SENDING needs a plan; DRAFTING is the trial — a contractor who cannot try the product never becomes a customer",
    );
  }
}

// ── The gate defers rather than deciding again ───────────────────────────
{
  const gate = read("lib/signup/planGate.js");
  ok(
    "planGate calls setupGateDecision rather than re-deciding who has paid",
    /setupGateDecision\(/.test(gate),
    "two readings of one billing rule is how one of them ships wrong",
  );
  ok(
    "it reuses accessForCompany for the billing reason",
    /accessForCompany\(/.test(gate) && /billingAccess/.test(gate),
    "the same answer the lock screen and the layout read — never a second query with its own opinion",
  );
  ok(
    'it treats "setup_pending" as the absence it is',
    /setup_pending/.test(gate),
    'accessForCompany renames "no subscription, still inside the grace" — read literally, setupGateDecision would call that a subscription that exists',
  );
  ok(
    "it only asks Stripe once a decision would otherwise turn someone away",
    gate.indexOf('provisional.action === "allow"') < gate.indexOf("stripeSubscriptionExists("),
    "impersonation, a demo fixture and a fresh signup must never pay for a network call",
  );
  ok(
    "and there is no second copy of the grace window in it",
    !/60 \* 60 \* 1000/.test(gate),
    "CHECKOUT_GRACE_MS is measured, and a copy of it drifts",
  );
}

// ── The two-pass shape, and the bug that made it a no-op ─────────────────
//
// EXECUTED, because this is the failure that let the owner's ~20 companies
// keep working: app/app/layout.js's provisional pass passed `null` for the
// Stripe evidence, setupGateDecision reads `null` as "we could not find out"
// and allows on it, so `if (provisional.action === "allow") return null`
// swallowed every case and stripeSubscriptionExists below was unreachable.
// The gate redirected nobody, ever, and the text scan in
// scripts/check-signup-gate.mjs could not see it — both lines were present and
// in the right order.
{
  const { setupGateDecision } = await import("@/lib/signup/setupGate");
  const past = {
    hasSession: true,
    companyId: "co",
    membershipExists: true,
    billingReason: "no_subscription",
    role: "owner",
    companyCreatedAt: new Date(NOW.getTime() - CHECKOUT_GRACE_MS - MINUTE),
    now: NOW,
  };
  ok(
    "a provisional pass carrying `null` CANNOT refuse — that is why it must not carry null",
    setupGateDecision({ ...past, stripeSubscription: null }).action === "allow",
    "null is our ignorance and always allows; a first pass made of it is a gate that never fires",
  );
  ok(
    "...and one carrying `false` can",
    setupGateDecision({ ...past, stripeSubscription: false }).action === "redirect",
  );

  for (const [file, fn] of [
    ["lib/signup/planGate.js", "planDecision"],
    ["app/app/layout.js", "getSetupRedirect"],
  ]) {
    const src = read(file);
    const start = src.indexOf(fn);
    const body = src.slice(start, src.indexOf("\n}\n", start));
    ok(
      `${file} asks the first pass with evidence it can refuse on`,
      /stripeSubscription:\s*false/.test(body) &&
        !/stripeSubscription:\s*null/.test(body),
      "the value in the provisional base decides whether the gate exists at all",
    );
  }
}

// ── The prompt is mounted and the refusal reaches it ─────────────────────
{
  const layout = read("app/app/layout.js");
  ok(
    "the prompt is mounted in the app shell",
    /<PlanRequiredPrompt \/>/.test(layout) &&
      /import PlanRequiredPrompt from "@\/app\/components\/PlanRequiredPrompt"/.test(layout),
    "a decision nothing renders is a field written and never read",
  );

  const prompt = read("app/components/PlanRequiredPrompt.js");
  ok(
    "it listens for the event the client helper dispatches",
    /PLAN_REQUIRED_EVENT/.test(prompt) && /addEventListener\(/.test(prompt),
  );
  ok(
    "it offers the link, and only when the server said this person may pay",
    /prompt\.canFinish && prompt\.path/.test(prompt) && /<Link/.test(prompt),
    "a Choose-a-plan button for an invited estimator leads to a 403 and a second company",
  );
  ok(
    "it prints the server's own sentence rather than writing a second one",
    /prompt\.message/.test(prompt),
    "the refusal a script reads and the refusal a person reads have to be the same sentence",
  );

  const errors = read("lib/clientErrors.js");
  ok(
    "the shared error reporter routes this refusal to the prompt instead of a toast",
    /planRequiredFrom\(res\.status, data\)/.test(errors),
    "there are more call sites reporting failures through that function than screens anyone would remember to wire",
  );

  // The send screens that parse the body themselves and never reach
  // reportResponseError. Each one is named: a send whose refusal lands in a red
  // banner with no button is the wall the owner asked us not to build.
  for (const screen of [
    "app/app/quotes/[id]/page.js",
    "app/components/quotes/builder/QuoteBuilder.js",
    "app/app/invoices/[id]/page.js",
    "app/app/invoices/new/page.js",
    "app/components/marketing/EmailCampaignDetail.js",
  ]) {
    const src = read(screen);
    ok(
      `${screen} opens the prompt instead of reporting a dead error`,
      /planRequiredFrom\(/.test(src) &&
        /import \{ planRequiredFrom \} from "@\/lib\/signup\/planRequired"/.test(src),
    );
  }
}

console.log(`\n${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
