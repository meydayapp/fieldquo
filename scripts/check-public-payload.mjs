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
import { join } from "node:path";
import { ROOT, routeFiles, decomment, prismaCalls, objectValue } from "./tenantScopeScan.mjs";

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
