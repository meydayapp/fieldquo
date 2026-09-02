// scripts/check-route-callers.mjs
//
// Does this route have a caller?
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// Two bugs on 2026-08-31 were the same bug. A route was written, reviewed,
// covered by other checks, and built — and nothing in the product ever called
// it.
//
//   - The visit PATCH route accepted a status, texted the homeowner on
//     "on_the_way" and spawned the next recurring visit on "completed". The
//     only client that ever called it sent `checklistItems`. So the on-my-way
//     text had a settings screen, a renderer, an opt-out check, a Twilio call,
//     and no button. See scripts/check-visit-status.mjs.
//   - app/api/invoices/versions/route.js read `_params.id` from a path with no
//     [id] segment. Prisma drops an undefined from a where clause, so it
//     returned an arbitrary invoice's version chain. Nobody noticed, because
//     nobody called it.
//
// Every other check in this repo asks whether a route is CORRECT. This asks
// whether it is REACHED. AGENTS.md's first rule is "never ship a control that
// appears to work and doesn't"; a route with no control at all is the same
// failure with the button missing instead of dead.
//
// ══ What counts as a caller ════════════════════════════════════════════════
//
// The route's static path prefix — everything up to its first [param] —
// appearing in any .js outside app/api. That is deliberately loose: a template
// literal, a constant, a fetch, a redirect. Loose enough that a real caller is
// never missed, which matters, because a false failure here trains people to
// add exemptions.
//
// One refinement, learned the hard way: the reference has to be a URL, not a
// file path. lib/marketing/featureMatrix.js and lib/marketing/savings.js hold
// catalogues of source paths like "app/api/quotes/tier-group/route.js", and a
// plain substring search counted those as callers — which is how the
// Good/Better/Best routes looked reached while having no screen at all. So a
// match is rejected when the character before the leading slash is a word
// character, which is exactly what separates "/api/x" from "app/api/x".
//
// Three kinds of route legitimately have no in-app caller, and each has to
// EARN the exemption rather than be pattern-matched into it:
//
//   1. Crons. Read from vercel.json, so adding a cron path here without
//      scheduling it does not silently pass.
//   2. Called by another route (Stripe return URLs, internal redirects).
//   3. Called from outside entirely — webhooks. Listed below by hand, with the
//      caller named, because "it has webhook in the path" is a naming
//      convention and not evidence.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — ${d}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

const API_DIR = join("app", "api");
const all = walk("app").concat(walk("lib"));
const routes = all.filter((f) => f.startsWith(API_DIR + "/") && f.endsWith("/route.js"));
const outsideApi = all.filter((f) => !f.startsWith(API_DIR + "/"));
const insideApi = routes;

// Comments are stripped before any of this runs, and the reason is that the
// first version of this check passed while its subject was broken: the voice
// economics page's own header comment says "GET /api/platform/voice-economics",
// so deliberately breaking the fetch below it changed nothing. A file
// explaining which route it calls is not a file calling it.
//
// Line-based on purpose. The obvious version — a lazy /\*[\s\S]*?\*\/ for block
// comments — deleted 106 lines of the quote-email settings page, because
// `accept="image/*"` on line 124 opened a comment that closed on the JSX
// `*/}` at line 230, taking the fetch on line 144 with it. The route then
// looked unreached. Dropping whole comment LINES cannot do that: the worst it
// can miss is a trailing block comment on a line of code, and missing one
// makes a route look reached, which is the harmless direction.
const strip = (src) =>
  src
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    })
    .join("\n");
const readStripped = (f) => strip(readFileSync(f, "utf8"));

const outsideSrc = outsideApi.map(readStripped).join("\n");

// Crons, read from the schedule rather than from the path shape.
const vercel = existsSync("vercel.json") ? readFileSync("vercel.json", "utf8") : "";
const scheduled = new Set([...vercel.matchAll(/"path"\s*:\s*"([^"]+)"/g)].map((m) => m[1]));

/**
 * Routes with no in-app caller, on purpose. Each names WHO calls it — an
 * exemption without a caller named is just a suppression.
 */
const EXTERNAL_CALLERS = {
  "/api/sms/inbound":
    "Twilio posts here on every inbound SMS to a company number. The URL is " +
    "set in the Twilio console, not in this repo, so no in-app caller can " +
    "exist. Signature-verified in lib/sms/verifyTwilioWebhook.js.",
  "/api/stripe/webhook":
    "Stripe posts here for Connect and payment events. The endpoint is " +
    "registered in the Stripe dashboard, so no in-app caller can exist.",
  "/api/platform/billing/webhook":
    "Stripe Billing's own endpoint for FieldQuo's subscriptions — a separate " +
    "integration from Connect above, registered separately in Stripe.",
  "/api/webhooks/inbound-sales-email":
    "A sales rep's own mailbox forwards replies here — the rule is configured " +
    "at the mail provider, so no in-app caller can exist. Authenticated by a " +
    "shared secret (SALES_INBOUND_SECRET), which DENIES when unset. The " +
    "contract, and the forwarding rule the owner has to set up, are written " +
    "out in docs/SALES-OUTREACH.md.",
  "/api/meta-ads/callback":
    "Meta's OAuth redirect target — set as this app's redirect_uri in Meta's " +
    "App Dashboard (see docs/META-ADS-BUILD.md), never fetched by our own " +
    "code. app/api/meta-ads/connect/route.js builds the URL Meta redirects " +
    "back to; the browser is what calls it, via a 302 from facebook.com.",
};

/**
 * Routes that are genuinely unreachable and are KNOWN to be, pending a
 * decision. Listed so the check stays green while the finding stays visible —
 * a suppressed failure nobody can see is how this class of bug survived in the
 * first place. Removing an entry must mean building the caller or deleting the
 * route, never editing this list to match reality.
 */
const NO_FRONT_DOOR = {
  "/api/quotes/versions":
    "Good/Better/Best trio, read side. No screen creates or shows a trio — " +
    "see docs/TODO.md. Blocked on a product decision about how three quotes " +
    "reach one homeowner, not on code.",
  "/api/quotes/tier-group":
    "Good/Better/Best trio, write side. Same finding, same blocker.",
  "/api/templates":
    "Known orphan, already gated rather than deleted — it reads and wrote " +
    "documentTemplate rows with no permission check at all while the PDF " +
    "Templates page uses the guarded /api/settings/document-templates. See " +
    "the route's own header. A 403 is safe whether or not something reaches " +
    "it; remove once that is confirmed.",
  "/api/analytics/burn-rate":
    "Already known and documented at lib/permissions/costBasis.js — monthly " +
    "burn and runway, gated not deleted for the same reason as the templates " +
    "route. It returns the Overhead screen's fixed costs summed a different " +
    "way, so the numbers are reachable; this presentation of them is not.",
  "/api/analytics/pricing-benchmark":
    "A second door onto the payload /api/analytics/benchmark serves from the " +
    "same library. The shorter-named one is the one the UI calls, and " +
    "check-rbac-redaction.mjs already asserts they are gated identically.",
  "/api/feedback":
    "Documented at lib/supportContact.js: the platform console reads what it " +
    "writes and nothing in /app renders a form for it, which is exactly why " +
    "SUPPORT_EMAIL points contractors at an inbox a human reads instead of " +
    "at a route with no UI.",
  "/api/leads/public":
    "app/quote/[companySlug]/page.js was built to give this endpoint and " +
    "/api/self-quote a home, and only the self-quote half was wired — the " +
    "flow posts to /api/self-quote throughout. Not urgent (the public quote " +
    "form works), but the page's own header comment overstates it.",
  "/api/ai/quote-suggestions":
    "An HTTP wrapper around lib/ai/quoteSuggestions.js, which IS used — " +
    "lib/ai/quoteReview.js imports getSuggestedAddOns and calls it in " +
    "process. The feature ships; this door onto it is redundant.",
  "/api/platform/sales/attribution":
    "Sales attribution: read one company's attribution, attribute one by " +
    "hand, and correct one. The rules and the writes are real and covered by " +
    "scripts/check-sales-attribution.mjs; what does not exist yet is the " +
    "platform console screen that calls them, which belongs to the sales " +
    "portal UI rather than to the capture work. The capture path that IS " +
    "reached today is the one that matters most — /signup?sales=CODE, via " +
    "app/api/companies/route.js, which needs no screen of its own. Remove " +
    "this entry when the console screen lands.",
  "/api/cron/social-scheduled-publish":
    "Fires every due scheduled Instagram/demo-mock social post — see " +
    "docs/SOCIAL-SCHEDULING.md. Genuinely unreachable today: this worktree " +
    "was explicitly told not to edit vercel.json's cron schedule, so the " +
    "entry that would make it reachable (an interval of a few minutes is " +
    "recommended in that doc) is a follow-up for whoever can add it. Not a " +
    "hidden gap — the publish route already writes `scheduled` rows and " +
    "docs/SOCIAL-SCHEDULING.md's own verification section says this in " +
    "plain language too. Remove this entry once vercel.json is updated.",
};

/**
 * Is this URL referenced as a URL?
 *
 * The leading slash must not follow a word character. "app/api/quotes/x" in a
 * catalogue of source paths contains "/api/quotes/x" as a substring and is not
 * a caller; "/api/quotes/x" in a fetch is.
 */
function referenced(haystack, prefix) {
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9_])${esc}`).test(haystack);
}

section("1. Every route is reached, or says who reaches it");

const unreached = [];
for (const file of routes) {
  const url = "/" + file.slice("app/".length, -"/route.js".length);
  const segs = url.split("/").filter(Boolean);
  const dyn = segs.findIndex((s) => s.startsWith("["));
  const prefix = "/" + segs.slice(0, dyn === -1 ? segs.length : dyn).join("/");

  if (referenced(outsideSrc, prefix)) continue;
  if (scheduled.has(prefix) || scheduled.has(url)) continue;
  // Called by a sibling route — a Stripe return URL, an internal redirect. The
  // route's own file is excluded so a path in its own header comment doesn't
  // count as a caller.
  const others = insideApi.filter((f) => f !== file).map(readStripped).join("\n");
  if (referenced(others, prefix)) continue;
  if (EXTERNAL_CALLERS[prefix]) continue;
  if (NO_FRONT_DOOR[prefix]) continue;
  if (!unreached.includes(prefix)) unreached.push(prefix);
}

ok(
  unreached.length === 0,
  "no route is unreachable without saying so",
  unreached.length ? `${unreached.length} with no caller and no entry: ${unreached.join(", ")}` : undefined,
);

section("2. The exemptions still describe something real");

for (const [prefix, why] of Object.entries({ ...EXTERNAL_CALLERS, ...NO_FRONT_DOOR })) {
  const dir = join("app", prefix.slice(1));
  ok(existsSync(join(dir, "route.js")) || existsSync(dir), `${prefix} still exists`, why);
}

// A route listed as having no front door but which HAS gained one is not an
// error to fix quietly — it is the good news, and the list has to be told.
for (const prefix of Object.keys(NO_FRONT_DOOR)) {
  ok(
    !referenced(outsideSrc, prefix),
    `${prefix} still has no caller — if it gained one, delete its entry above`,
  );
}

section("3. Every cron path in vercel.json is a route that exists");

for (const path of scheduled) {
  if (!path.startsWith("/api/")) continue;
  const file = join("app", path.slice(1), "route.js");
  ok(existsSync(file), `${path} is scheduled and the route is there`);
}

console.log(
  fail
    ? `\n✗ route callers: ${fail} check${fail === 1 ? "" : "s"} failed\n`
    : "\n✓ route callers: every route is reached, scheduled, or declared\n",
);
process.exit(fail ? 1 : 0);
