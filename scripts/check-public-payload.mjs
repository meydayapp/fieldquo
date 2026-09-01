// scripts/check-public-payload.mjs
//
//   npm run check:public-payload
//
// Two of the non-negotiables, over EVERY public route rather than the handful
// each existing check happens to name:
//
//   #4  Public endpoints never return prices. Publishing a rate card on an
//       unauthenticated endpoint hands it to every competitor in the city.
//   #5  The browser never sends money amounts. For add-ons the client posts
//       ids only and the server reprices from its own rows.
//
// ══ Why a separate script ══════════════════════════════════════════════════
//
// check:self-quote and check:estimate-visibility already EXECUTE the modules
// that decide what a homeowner sees, which is the right way to test a
// decision. What neither can do is answer "and is there a route somewhere else
// that does it differently" — that is a property of the whole surface, and it
// is the property that rots, because it changes every time a route is added.
//
// So this asserts the surface and defers the semantics. Nothing here replaces
// those two; they are named in check:all beside it.
//
// ══ How "public" is decided ════════════════════════════════════════════════
//
// Derived, not listed: a route that never resolves a member is a route with no
// caller identity — the booking pages, the self-quote form, the share-token
// documents, the webhooks and the crons. A route added tomorrow that forgets
// to authenticate lands in this set automatically and gets checked as public,
// which is the failure mode worth catching.

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { ROOT, routeFiles, decomment, prismaCalls, objectValue } from "./tenantScopeScan.mjs";

// Three of the sections below EXECUTE real product code (lib/security/
// cronAuth.js, app/api/portal/[token]/route.js) rather than reading it —
// AGENTS.md's own "run it against hostile input, don't just read it" rule,
// and the only version of these three assertions worth having (a regex over
// the source would have passed against the broken versions of all three
// bugs this file now guards). Both modules pull in "next/server", which bare
// node can't resolve at all (no package "exports" match — see
// check-refusal-shape.mjs's header for the same problem), and the portal
// route pulls in "@/lib/db", which would construct a real PrismaClient
// against Neon at import time. Both are stubbed, once, for every section
// below that needs them.
const DB_STUB_URL = pathToFileURL(join(ROOT, "scripts/fixtures/dbStub.mjs")).href;
const HOOKS = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: ${JSON.stringify(DB_STUB_URL)}, shortCircuit: true };
  if (specifier === "next/server") return { url: "fq-stub:next", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:next")
    return {
      format: "module",
      shortCircuit: true,
      source:
        "export const NextResponse = { json: (body, init) => ({ status: init?.status ?? 200, body, json: async () => body }) };",
    };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};

const files = routeFiles();
const publicRoutes = files.filter((f) => {
  const src = decomment(readFileSync(join(ROOT, f), "utf8"));
  return !/memberOrRefusal|getCurrentMember/.test(src);
});

console.log(`\n${publicRoutes.length} of ${files.length} routes resolve no member — treated as public`);
ok("the public set is derived, not hand-kept", publicRoutes.length > 40, publicRoutes.length);
for (const must of [
  "app/api/self-quote/[companySlug]/route.js",
  "app/api/public/quotes/[token]/route.js",
  "app/api/booking/[companySlug]/route.js",
])
  ok(`${must} is in the public set`, publicRoutes.includes(must));

// ═══════════════ #5 — the browser never sends money ════════════════════════
//
// Every name a price could arrive under. `markupPercent` is here because a
// percentage of a cost IS a price decision, and `budget` because a band index
// is fine while a dollar figure is not.

console.log("\nNo public route accepts a money amount from the browser (#5)");

const MONEY = [
  "amount", "amountCents", "price", "unitPrice", "costPrice", "total", "subtotal",
  "cents", "feeCents", "rate", "hourlyRate", "deposit", "discount",
  "markupPercent", "budget", "tax", "labourCost", "materialCost",
];

const accepts = [];
for (const f of publicRoutes) {
  const src = decomment(readFileSync(join(ROOT, f), "utf8"));
  for (const key of MONEY) {
    if (new RegExp(`\\bbody\\??\\.${key}\\b`).test(src)) accepts.push(`${f}: body.${key}`);
    if (
      new RegExp(
        `const\\s*\\{[^}]*\\b${key}\\b[^}]*\\}\\s*=\\s*(?:await\\s+)?(?:request\\.json\\(\\)|body)`,
      ).test(src)
    )
      accepts.push(`${f}: destructured ${key}`);
    if (new RegExp(`searchParams\\.get\\(["']${key}["']\\)`).test(src))
      accepts.push(`${f}: ?${key}=`);
  }
}
ok("nothing reads a money field off a public request", accepts.length === 0, accepts);

// ═══════════════ #4 — no rate card leaves unauthenticated ══════════════════

console.log("\nNo public route hands out a rate card (#4)");

// Product IS the price book. A public route reading it at all is the failure —
// there is no selection of columns that makes publishing the catalogue safe,
// because the catalogue is the thing being protected.
const PRICE_BOOK_MODELS = ["product", "cabinetRate", "materialRecipe", "payrollComponent", "salary"];
const readsPriceBook = [];
for (const f of publicRoutes) {
  const src = decomment(readFileSync(join(ROOT, f), "utf8"));
  for (const c of prismaCalls(src))
    if (PRICE_BOOK_MODELS.includes(c.model)) readsPriceBook.push(`${f}:${c.line} db.${c.model}.${c.op}`);
}
ok("no public route reads the price book", readsPriceBook.length === 0, readsPriceBook);

// And the columns, wherever they might be selected from. A per-unit rate is a
// rate whichever model it hangs off.
const PRICE_COLUMNS = [
  "unitPrice", "costPrice", "hourlyRate", "markupPercent", "overheadPct",
  "labourRate", "defaultRate", "baseRate", "ratePerHour", "cabinetRates",
];
const selectsRate = [];
for (const f of publicRoutes) {
  const src = decomment(readFileSync(join(ROOT, f), "utf8"));
  for (const c of prismaCalls(src)) {
    for (const key of ["select", "include"]) {
      const o = objectValue(c.args, key);
      if (!o) continue;
      for (const col of PRICE_COLUMNS)
        if (new RegExp(`\\b${col}\\s*:\\s*true`).test(o))
          selectsRate.push(`${f}:${c.line} ${c.model}.${col}`);
    }
  }
}
ok("no public query selects a per-unit rate", selectsRate.length === 0, selectsRate);

// ── What a public route IS allowed to say about money ──────────────────────
//
// Asserted so the two are not confused. A FINISHED figure addressed to one
// person — the total on the quote they were sent, the balance on their own
// invoice, the visit fee the booking page charges — is the product working.
// A RATE, from which every other job's price can be worked out, is the leak.
// These routes are named here to make that distinction explicit rather than
// leaving it as an absence.
const MAY_STATE_A_FIGURE = {
  "app/api/public/quotes/[token]/route.js":
    "The quote's own total, to the person it was addressed to, behind an " +
    "unguessable share token. That is the document.",
  "app/api/portal/[token]/route.js":
    "The client's own invoices and balance, behind their portal token.",
  "app/api/booking/[companySlug]/route.js":
    "The visit fee the booking page charges — a published price, deliberately.",
  "app/api/plan/[token]/route.js":
    "The service plan's own price, to the client being asked to authorise it.",
};
for (const [f, reason] of Object.entries(MAY_STATE_A_FIGURE)) {
  ok(`${f} exists`, files.includes(f));
  ok(`${f} says why it may state a figure`, reason.length > 50);
}

// ═══════════════ The tokens those routes stand on ══════════════════════════
//
// A share token IS the credential on these routes, so it has to be worth being
// one. Every one is minted from a CSPRNG with 32 bytes behind it — Math.random
// would make every client-facing document guessable, and no amount of scoping
// anywhere else would matter.
//
// Named minters, not a grep for Math.random across the repo: this codebase uses
// Math.random legitimately for slug suffixes and temporary React keys, and a
// check that flagged those would be a check somebody turns off.

console.log("\nEvery credential token is minted from a CSPRNG");

const TOKEN_MINTERS = {
  "lib/clientPortal.js": {
    what: "Client.portalToken — the whole client portal, and ServicePlan.authToken",
    fn: "newPortalToken",
  },
  "lib/booking/manageVisit.js": {
    what: "Booking.manageToken — cancel and reschedule a visit",
    fn: null,
  },
  "app/api/quotes/[id]/send/route.js": {
    what: "Quote.shareToken, minted when the quote is first sent",
    fn: null,
  },
  "app/api/quotes/[id]/share/route.js": {
    what: "Quote.shareToken, re-minted when the link is rotated",
    fn: null,
  },
};

for (const [f, { what }] of Object.entries(TOKEN_MINTERS)) {
  let src;
  try { src = readFileSync(join(ROOT, f), "utf8"); } catch { src = null; }
  ok(`${f} still exists (${what})`, src !== null);
  if (!src) continue;
  ok(`${f} imports crypto`, /from "(?:node:)?crypto"/.test(src));
  const strong = src.match(/randomBytes\(\s*(\d+)\s*\)/);
  ok(`${f} mints from randomBytes`, Boolean(strong), src.match(/random\w*\([^)]*\)/)?.[0]);
  ok(`${f} uses at least 32 bytes`, Number(strong?.[1]) >= 32, strong?.[1]);
  ok(`${f} never falls back to Math.random`, !/Math\.random/.test(src));
}

// The service plan authorisation link reuses the portal minter rather than
// rolling its own — asserted, because "it looked like it had a token" is how a
// weak one gets in.
{
  const src = readFileSync(join(ROOT, "app/api/service-plans/[id]/authorise/route.js"), "utf8");
  ok(
    "the service-plan authorisation link borrows the portal minter",
    /newPortalToken\(\)/.test(src) && !/Math\.random/.test(src),
  );
}

// ═══════════════ Every dangerouslySetInnerHTML site is accounted for (XSS) ═
//
// JSON.stringify does not escape "<", ">" or "&" — proven below by executing
// it, not by reading about it — so `dangerouslySetInnerHTML={{ __html:
// JSON.stringify(x) }}` inside a `<script>` tag lets a string value
// containing "</script>" close the tag early and run whatever follows as
// markup. app/site/[subdomain]/page.js's JSON-LD block puts company.name
// straight into one, and signup is self-serve (non-negotiable #1) with no
// escaping anywhere in the chain — so anyone on the internet could start a
// trial, name their company `Acme</script><script>…`, and run arbitrary JS
// in every visitor's browser.
//
// Fixed at the SINK (lib/security/scriptSafeJson.js), not only the source:
// a sink fix protects every row already in the database and every future
// field that flows through it; a source-only fix protects one column. Every
// `dangerouslySetInnerHTML` in the repo is enumerated here from the
// filesystem — not hand-kept — so a fourth one added tomorrow fails this
// check by name instead of shipping unreviewed.

console.log("\nEvery dangerouslySetInnerHTML site is accounted for (XSS)");

{
  const { scriptSafeJson } = await import("@/lib/security/scriptSafeJson");

  const hostile = { name: "Acme</script><script>alert(1)</script>" };
  const raw = JSON.stringify(hostile);
  ok("proof: JSON.stringify alone leaves </script> intact", raw.includes("</script>"), raw);

  const safe = scriptSafeJson(hostile);
  ok("scriptSafeJson removes the literal closing tag", !safe.includes("</script>"), safe);
  ok("...and neither < nor > survives unescaped at all", !/[<>]/.test(safe), safe);
  ok(
    "...yet a real JSON parser (what a search engine's JSON-LD reader is) decodes it back to the original string",
    JSON.parse(safe).name === hostile.name,
    JSON.parse(safe),
  );
}

// Derived from disk, exactly like `publicRoutes` above — a hand-kept list is
// the one that goes stale. Matches the JSX attribute itself (the `=` is
// deliberate) rather than the bare word, so a file that only MENTIONS
// dangerouslySetInnerHTML in a comment — this very script, or
// lib/security/scriptSafeJson.js's own header — doesn't false-positive as an
// unreviewed site.
const dangerousHtmlFiles = execSync('grep -rl "dangerouslySetInnerHTML=" app lib', {
  cwd: ROOT,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)
  .sort();

// Every known site, and why each one is or isn't a sink that needs
// scriptSafeJson. `null` means "reviewed, carries no interpolated data" —
// not "unreviewed".
const KNOWN_DANGEROUS_HTML_SITES = {
  "app/site/[subdomain]/page.js":
    "Company fields (name, phone, email, address...) into JSON-LD. User-controlled, and the ONLY sink in this list that is.",
  "app/layout.js":
    "NO_FLASH — a hardcoded template-literal CONSTANT with no interpolation. Nothing from a request ever reaches it.",
  "app/components/BrandTheme.js":
    "CSS built from a company's brandColor, but only after isValidHex() — a value that fails the hex regex never reaches tokensToCss, so nothing free-form is ever concatenated into the <style> tag.",
};

ok(
  "no unreviewed dangerouslySetInnerHTML site exists",
  dangerousHtmlFiles.every((f) => f in KNOWN_DANGEROUS_HTML_SITES),
  dangerousHtmlFiles.filter((f) => !(f in KNOWN_DANGEROUS_HTML_SITES)),
);
for (const f of Object.keys(KNOWN_DANGEROUS_HTML_SITES)) {
  ok(`${f} still exists and still uses dangerouslySetInnerHTML`, dangerousHtmlFiles.includes(f));
}

{
  const src = readFileSync(join(ROOT, "app/site/[subdomain]/page.js"), "utf8");
  ok("the JSON-LD sink uses scriptSafeJson", /__html:\s*scriptSafeJson\(/.test(src));
  ok("...and not a bare JSON.stringify feeding __html", !/__html:\s*JSON\.stringify\(/.test(src));
}
{
  const src = readFileSync(join(ROOT, "app/layout.js"), "utf8");
  // Isolate the NO_FLASH template literal itself (not the whole file — other
  // unrelated template literals in app/layout.js, e.g. the className string,
  // legitimately use `${}` and must not fail this) and check THAT substring
  // for an interpolation.
  const match = src.match(/const NO_FLASH = `([\s\S]*?)`;/);
  ok("NO_FLASH is still defined as a template literal", Boolean(match), src.slice(0, 80));
  ok(
    "...and it stays a plain constant — no `${...}` interpolation crept in",
    Boolean(match) && !match[1].includes("${"),
    match?.[1],
  );
}
{
  const src = readFileSync(join(ROOT, "app/components/BrandTheme.js"), "utf8");
  ok("BrandTheme still gates on isValidHex before deriving any CSS", /isValidHex\(brandColor\)/.test(src));
}

// ═══════════════ Every cron route fails CLOSED on a missing secret ════════
//
// app/api/cron/*/route.js used to compare against `` `Bearer
// ${process.env.CRON_SECRET}` ``. Unset, that's the literal string "Bearer
// undefined" — a fixed, guessable password, not "no valid value" — so a
// deploy that forgot to set CRON_SECRET opened all 16 crons (email, outbound
// AI calls, saved-card charges) to anyone who sent that exact header. Fixed
// once, in lib/security/cronAuth.js's requireCronSecret(), used by every
// cron route instead of sixteen copies of the comparison.
//
// Both halves are executed: the static half proves every cron route calls
// the shared helper (so a 17th cron, or one that reverts to its own
// comparison, is caught even before the runtime half would notice); the
// runtime half proves the helper ITSELF denies an unset secret, denies a
// wrong one, and allows the right one — the exact three cases a regex over
// the source cannot tell apart.

console.log("\nEvery cron route uses the shared, fail-closed secret check");

const cronFiles = execSync('find app/api/cron -name route.js', { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .sort();
ok("cron routes were found (the set isn't accidentally empty)", cronFiles.length >= 16, cronFiles.length);
for (const f of cronFiles) {
  const src = decomment(readFileSync(join(ROOT, f), "utf8"));
  ok(`${f} calls requireCronSecret`, /requireCronSecret\(request\)/.test(src));
  ok(`${f} no longer hand-compares CRON_SECRET`, !/process\.env\.CRON_SECRET/.test(src));
}

console.log("\n...and the helper itself fails closed, not merely looks like it does");

{
  const { requireCronSecret } = await import("@/lib/security/cronAuth");
  const fakeRequest = (auth) => ({
    headers: { get: (k) => (String(k).toLowerCase() === "authorization" ? auth : null) },
  });

  const prevSecret = process.env.CRON_SECRET;
  const restoreSecret = () => {
    if (prevSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevSecret;
  };

  try {
    delete process.env.CRON_SECRET;
    // The exact string the old bug accepted as valid.
    const deniedWhenUnset = requireCronSecret(fakeRequest("Bearer undefined"));
    ok(
      "an unset CRON_SECRET denies the literal string the old bug accepted",
      deniedWhenUnset?.status === 401,
      deniedWhenUnset,
    );

    const deniedWithNoHeaderEither = requireCronSecret(fakeRequest(null));
    ok("an unset CRON_SECRET denies even with no header at all", deniedWithNoHeaderEither?.status === 401);

    process.env.CRON_SECRET = "check-public-payload-test-secret";
    const deniedWrong = requireCronSecret(fakeRequest("Bearer not-the-secret"));
    ok("a configured secret denies the wrong value", deniedWrong?.status === 401, deniedWrong);

    const deniedMissingHeader = requireCronSecret(fakeRequest(null));
    ok("a configured secret denies a request with no Authorization header", deniedMissingHeader?.status === 401);

    const allowed = requireCronSecret(fakeRequest("Bearer check-public-payload-test-secret"));
    ok("a configured secret allows the matching value through (returns null)", allowed === null, allowed);
  } finally {
    restoreSecret();
  }
}

// ═══════════════ The client portal's select is an allow-list, not `include` ═
//
// GET /api/portal/[token] used to fetch with no top-level `select` at all —
// every scalar on Client, Quote, Invoice and Job reached a homeowner's
// browser on an unauthenticated, token-only endpoint. Quote.reviewNotes
// (whose own schema comment says it must never reach a client-facing
// surface), aiReview, autoEstimated, needsReview, processNotes,
// declineReason, and internal staff ids among them.
//
// A regex over route.js would only prove the word "select" appears
// somewhere in the file — it was already narrow for `company`. The
// assertion that actually matters is about the QUERY OBJECT Prisma receives
// at runtime, so this executes the real route against a fixture client and
// inspects the captured `db.client.findUnique` call — the same technique
// scripts/check-trade-gate.mjs uses via scripts/fixtures/dbStub.mjs, whose
// `reads` log (added for this check) records every read call's full args.

console.log("\nThe client portal's Prisma query is an allow-list (no leaked internal fields)");

{
  const { rows, reads, resetDbStub } = await import("./fixtures/dbStub.mjs");
  resetDbStub();
  rows.client = [
    {
      portalToken: "check-public-payload-test-token",
      name: "Test Client",
      language: "en",
      country: "CA",
      province: "ON",
      company: { name: "Acme", currency: "CAD" },
      quotes: [],
      invoices: [],
    },
  ];

  const { GET } = await import(
    pathToFileURL(join(ROOT, "app/api/portal/[token]/route.js")).href
  );
  const fakeRequest = { headers: { get: () => null } };
  const res = await GET(fakeRequest, {
    params: Promise.resolve({ token: "check-public-payload-test-token" }),
  });
  ok("the route executes against the fixture without throwing", res?.status === 200, res);

  const call = reads.find((r) => r.model === "client" && r.action === "findUnique");
  ok("db.client.findUnique was actually called", Boolean(call), reads);

  const args = call?.args || {};
  ok("the query uses `select`, not `include`", Boolean(args.select));

  // Every `include` key found anywhere in the tree — at ANY level, `include`
  // would mean an entire relation's scalars ship unfiltered, exactly the bug
  // this guards against — checked globally, unlike the forbidden fields
  // below, because no model here has a legitimate field named `include`.
  const includeSites = [];
  const walkForInclude = (node, path) => {
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (k === "include") includeSites.push(path ? `${path}.include` : "include");
      if (v && typeof v === "object") {
        if (v.select) walkForInclude(v.select, path ? `${path}.${k}.select` : `${k}.select`);
        if (v.include) walkForInclude(v.include, path ? `${path}.${k}.include` : `${k}.include`);
      }
    }
  };
  walkForInclude(args.select, "select");
  ok("no `include` appears anywhere in the query (would bypass every select below it)", includeSites.length === 0, includeSites);

  // Checked per BRANCH, not as one flattened key set: Company legitimately
  // selects `email`/`phone` (the portal's own "contact us" line) and Invoice
  // legitimately selects `notes` (the invoice memo PortalInvoice.js
  // renders) — the same field names that are forbidden on Client and Quote
  // respectively. Flattening would either miss a real leak or flag a real,
  // reviewed field; keeping this scoped to the branch each name is actually
  // forbidden on is what makes the assertion trustworthy either way.
  const clientTopKeys = new Set(Object.keys(args.select || {}));
  const quoteKeys = new Set(Object.keys(args.select?.quotes?.select || {}));
  const invoiceKeys = new Set(Object.keys(args.select?.invoices?.select || {}));

  const CLIENT_FORBIDDEN = ["email", "phone", "address", "notes", "contactName", "city", "portalToken", "type", "createdAt"];
  const QUOTE_FORBIDDEN = [
    "reviewNotes", "aiReview", "aiReviewedAt", "aiVisionPasses", "autoEstimated",
    "needsReview", "processNotes", "declineReason", "followUpCount",
    "followUpSentAt", "estimateSource", "estimateData", "composeSeconds",
    "sourceCallId", "createdById", "assignedToId", "reviewedById",
  ];
  // `payments` is the Invoice relation nothing in either portal component
  // reads — checked here rather than the Client list because it's an
  // Invoice-shaped leak (whole Payment rows, processor ids included), not a
  // same-named scalar collision like the ones above.
  const INVOICE_FORBIDDEN = ["payments"];

  const leakedClient = CLIENT_FORBIDDEN.filter((f) => clientTopKeys.has(f));
  const leakedQuote = QUOTE_FORBIDDEN.filter((f) => quoteKeys.has(f));
  const leakedInvoice = INVOICE_FORBIDDEN.filter((f) => invoiceKeys.has(f));

  ok("no forbidden Client field is selected at the top level", leakedClient.length === 0, leakedClient);
  ok("no forbidden Quote field is selected", leakedQuote.length === 0, leakedQuote);
  ok("no forbidden Invoice field is selected", leakedInvoice.length === 0, leakedInvoice);
  ok("`jobs` is not selected at all (nothing in the portal reads it — see the query's own comment)", !clientTopKeys.has("jobs"));

  // The response itself, for the fields that are built in JS after the query
  // (the invoice re-shape used to `...invoice`-spread the whole row).
  const body = res?.body;
  ok("the JSON response carries no `jobs` key", !("jobs" in (body || {})), body);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
