// scripts/check-pricing-page.mjs
//
//   npm run check:pricing-page
//
// The public pricing page — the one surface a stranger comparing three
// contractors' software actually reads, and the one that had four separate
// things wrong with it at once.
//
// Bundled with esbuild before it runs (see package.json), for the same reason
// scripts/check-tax-send-gate.jsx is: the page is JSX that plain node cannot
// parse, and the point of this file is to RENDER the real grid rather than to
// read its source and hope. A regex over source is not evidence — a guard in
// this repo passed a source assertion happily while disabled with `false &&`.
//
// ══ The four defects ═══════════════════════════════════════════════════════
//
// 1. EIGHT CARDS. Every rung of the seat ladder exists twice in the Plan table
//    — once CAD, once USD, carrying the SAME NUMBER rather than a conversion
//    (SEAT_LADDER in lib/pricing/ladder.js). The page read the table with no
//    currency filter, so /pricing listed Solo twice, Crew twice, Shop twice and
//    Scale twice: four pairs of identical prices with different buy links.
//
// 2. THE BUY LINK CARRIED A CURRENCY. Each CTA was /signup?plan=<id>, and half
//    those ids were the CAD row. A visitor in Buffalo clicking one arrived at
//    signup on the Canadian plan, on a funnel whose whole design is that the
//    business address decides the currency — which is why the plan step is now
//    the LAST step, after the address.
//
// 3. "6 EMPLOYEE ACCOUNTS". That is maxUsers, which is seats PLUS free crew.
//    Solo bills ONE seat. The owner read the same sum on the in-app billing
//    screen and created an Administrator he was not entitled to; it was fixed
//    there (seatLine, app/app/settings/account-billing/page.js) and left
//    standing here.
//
// 4. "ALL PRICES ARE IN CAD", with the code filled in from an IP geo guess.
//    The owner, verbatim: "not in CAD because you can't tell if someone is from
//    the usa europe or canada until they sign up."
//
// ══ What this asserts, and how ═════════════════════════════════════════════
//
// A fixture holding all EIGHT ladder rows plus a bespoke private plan plus a
// legacy per-headcount row goes through the real partitionPlans, the real
// oneRowPerTier, and then through react-dom/server against the real component.
// The selection logic on the far end of the link is the real
// resolvePlanSelection out of app/signup/page.js, run over the currency
// crossings that are the actual bug.

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { db } from "@/lib/db";
import { partitionPlans } from "@/lib/platform/sellablePlans";
import { matrixEntry } from "@/lib/marketing/featureMatrix";
import { SEAT_LADDER, SUPPORTED_CURRENCIES } from "@/lib/pricing/ladder";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import PricingPage, { oneRowPerTier } from "@/app/(marketing)/pricing/page";
import {
  pricingColumns,
  peopleLines,
  signupHref,
} from "@/app/(marketing)/pricing/PricingPlans";
import { resolvePlanSelection } from "@/app/signup/page";

// ── Rows in, HTML out, through the shipped page ────────────────────────────
//
// The server component is executed, not imitated. An earlier draft of this file
// called partitionPlans and oneRowPerTier itself and rendered the grid directly
// — every assertion passed, and deleting the oneRowPerTier CALL from the page
// went unnoticed, which is the exact failure AGENTS.md names: the pure function
// was right and nothing invoked it.
//
// `db.plan` is overwritten rather than the module being aliased to a fixture,
// because the page reaches exactly one method and a whole stub file to hold one
// findMany would be a second thing to keep in step. Importing lib/db builds a pg
// Pool that never connects; no query leaves this process.
let planRows = [];
db.plan = { findMany: async () => planRows };
const renderPage = async (rows) => {
  planRows = rows;
  return renderToStaticMarkup(
    createElement(LanguageProvider, { initialLanguage: "en" }, await PricingPage()),
  );
};

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);

const read = (p) => readFileSync(p, "utf8");
// Comments are where this repo explains itself, and they mention every string
// an assertion below looks for. Stripping them is the difference between "the
// page no longer names a currency" and "the page still discusses naming one".
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const PAGE = "app/(marketing)/pricing/page.js";
const GRID = "app/(marketing)/pricing/PricingPlans.js";

// ── The fixture: the table as production actually holds it ─────────────────
//
// Built FROM SEAT_LADDER rather than typed out, so a rung added or repriced
// there is covered here without anybody remembering to come back. Both
// currencies, same number in each — that parity is the premise of every fix
// below, so it is asserted rather than assumed.
const ladderRows = SUPPORTED_CURRENCIES.flatMap((currency) =>
  SEAT_LADDER.map((tier) => ({
    id: `${tier.tierKey}-${currency.toLowerCase()}`,
    name: tier.label,
    priceMonthly: tier.price,
    currency,
    tierKey: tier.tierKey,
    seats: tier.seats,
    crewSeats: tier.crewSeats,
    maxUsers: tier.seats + tier.crewSeats,
    sortOrder: tier.sortOrder,
    maxQuotesPerMonth: null,
    aiCopilotEnabled: true,
    isPublic: true,
    features: null,
  })),
);

// A rate negotiated with one company. lib/billing/customPlan.js writes these
// with isPublic: false, and advertising one to everybody is handing a private
// discount to every competitor in the city.
const bespoke = {
  id: "bespoke-1",
  name: "Custom (2 employees)",
  priceMonthly: 90,
  currency: "CAD",
  tierKey: null,
  seats: 2,
  crewSeats: 0,
  maxUsers: 2,
  sortOrder: 9,
  maxQuotesPerMonth: null,
  aiCopilotEnabled: false,
  isPublic: false,
  features: null,
};

// A per-headcount row from before the ladder. crewSeats null is the marker:
// this plan has no crew concept at all, and inventing a zero for it would be
// padding absent data with a default, on a price.
const legacy = {
  id: "legacy-1",
  name: "Starter",
  priceMonthly: 45,
  currency: "CAD",
  tierKey: null,
  seats: null,
  crewSeats: null,
  maxUsers: 6,
  sortOrder: 0,
  maxQuotesPerMonth: 20,
  aiCopilotEnabled: false,
  isPublic: true,
  features: null,
};

const TABLE = [...ladderRows, bespoke, legacy];

console.log("\nThe premise: one tier, two rows, the same number");
ok("eight ladder rows exist, not four", ladderRows.length === 8, ladderRows.length);
ok(
  "each tier appears once per supported currency",
  SEAT_LADDER.every((tier) =>
    SUPPORTED_CURRENCIES.every((c) =>
      ladderRows.some((r) => r.tierKey === tier.tierKey && r.currency === c),
    ),
  ),
);
ok(
  "and the pair carries the SAME number, not a conversion",
  SEAT_LADDER.every((tier) => {
    const prices = ladderRows
      .filter((r) => r.tierKey === tier.tierKey)
      .map((r) => r.priceMonthly);
    return new Set(prices).size === 1;
  }),
);
// If a third currency is ever added, the disclaimer below stops being true and
// this fails on purpose rather than shipping copy that names two.
ok("only CAD and USD are priced", SUPPORTED_CURRENCIES.join(",") === "CAD,USD");

console.log("\nFour cards, not eight");
const { sellable } = partitionPlans(TABLE);
const cards = oneRowPerTier(sellable);
const ladderCards = cards.filter((c) => c.tierKey);
ok("the four rungs collapse to four cards", ladderCards.length === 4, ladderCards.length);
ok(
  "no tier is rendered twice",
  new Set(ladderCards.map((c) => c.tierKey)).size === ladderCards.length,
);
ok(
  "the four are solo, crew, shop, scale",
  ladderCards.map((c) => c.tierKey).join(",") === "solo,crew,shop,scale",
  ladderCards.map((c) => c.tierKey).join(","),
);
ok(
  "cheapest first",
  ladderCards.map((c) => Number(c.priceMonthly)).join(",") === "99,169,269,369",
  ladderCards.map((c) => Number(c.priceMonthly)).join(","),
);
// A legacy row has no twin, so collapsing must not eat it. Every one of them
// stands alone under its own id.
ok("the legacy row survives as its own card", cards.some((c) => c.id === legacy.id));
ok("...and only once", cards.filter((c) => c.id === legacy.id).length === 1);

console.log("\nThe representative row is chosen, not stumbled into");
// Determinism first: the same table must produce the same page on every
// request, or the buy links change under a visitor mid-read.
const twice = oneRowPerTier(partitionPlans([...TABLE].reverse()).sellable);
ok(
  "row order in the table does not change the cards",
  twice.map((c) => c.id).join(",") === cards.map((c) => c.id).join(","),
  twice.map((c) => c.id).join(","),
);
// And if an operator ever edits one currency's row and forgets its twin, the
// page must not advertise the lower of two real prices and bill the higher.
const skewed = ladderRows.map((r) =>
  r.id === "solo-cad" ? { ...r, priceMonthly: 89 } : r,
);
const skewedSolo = oneRowPerTier(skewed).find((c) => c.tierKey === "solo");
ok(
  "a disagreeing pair quotes the HIGHER number",
  Number(skewedSolo.priceMonthly) === 99,
  skewedSolo.priceMonthly,
);

console.log("\nA bespoke rate is not advertised to everyone");
ok("partitionPlans withholds the private plan", !sellable.some((p) => p.id === bespoke.id));
ok("...so no card carries it", !cards.some((c) => c.id === bespoke.id));
ok("...and its name reaches no card", !cards.some((c) => c.name === bespoke.name));
// The leak that would reintroduce it. isSellable reads a MISSING isPublic as
// "not stated" rather than as "private" — deliberately, so a narrow select
// can't silently empty the page — which means a narrow select HERE would let
// the private row through. /api/marketing/plans carries the same warning.
const pageCode = code(PAGE);
ok(
  "the page's plan read is not narrowed by a select",
  /db\.plan\.findMany\(/.test(pageCode) && !/select:/.test(pageCode),
);
ok(
  "...and partitionPlans is what filters, not a hand-rolled test beside it",
  /partitionPlans\(/.test(pageCode),
);

console.log("\nThe buy link carries a tier, never a currency");
const cadSolo = ladderRows.find((r) => r.id === "solo-cad");
const usdSolo = ladderRows.find((r) => r.id === "solo-usd");
ok("both rows of a tier produce the same link", signupHref(cadSolo) === signupHref(usdSolo), signupHref(usdSolo));
ok("the link names the tier", signupHref(cadSolo) === "/signup?tier=solo", signupHref(cadSolo));
ok(
  "no ladder link carries a plan id",
  ladderCards.every((c) => !signupHref(c).includes("plan=")),
);
ok(
  "no ladder link carries a currency-bound row id",
  ladderRows.every((r) => !signupHref(r).includes(r.id)),
);
// A legacy row has no tier to name. The id form is what still works for it,
// and it is a single row rather than a currency pair, so it is safe there.
ok("a legacy row still links by id", signupHref(legacy) === `/signup?plan=${legacy.id}`, signupHref(legacy));

console.log("\nAnd signup resolves that tier against the real currency");
const visibleCad = ladderRows.filter((r) => r.currency === "CAD");
const visibleUsd = ladderRows.filter((r) => r.currency === "USD");
const resolve = (over) =>
  resolvePlanSelection({ all: ladderRows, visible: visibleCad, ...over });

ok(
  "?tier=solo in Canada selects the CAD row",
  resolve({ wantedTier: "solo" }) === "solo-cad",
  resolve({ wantedTier: "solo" }),
);
ok(
  "?tier=solo in the USA selects the USD row",
  resolve({ visible: visibleUsd, wantedTier: "solo" }) === "solo-usd",
  resolve({ visible: visibleUsd, wantedTier: "solo" }),
);
// The bug itself: a link already in the wild, built from the CAD row, clicked
// by an American. It must not select the Canadian plan and must not dead-end.
ok(
  "a stale ?plan=<CAD id> lands an American on the USD row of the SAME tier",
  resolve({ visible: visibleUsd, wantedPlanId: "solo-cad" }) === "solo-usd",
  resolve({ visible: visibleUsd, wantedPlanId: "solo-cad" }),
);
ok(
  "...and a Canadian on the CAD row",
  resolve({ wantedPlanId: "solo-usd" }) === "solo-cad",
  resolve({ wantedPlanId: "solo-usd" }),
);
// The draft carries a selection across a change of address. The rung survives.
ok(
  "changing the address moves the selection across, keeping the rung",
  resolve({ visible: visibleUsd, current: "shop-cad" }) === "shop-usd",
  resolve({ visible: visibleUsd, current: "shop-cad" }),
);
ok(
  "a plan already selected and still buyable is left alone",
  resolve({ current: "crew-cad", wantedTier: "scale" }) === "crew-cad",
  resolve({ current: "crew-cad", wantedTier: "scale" }),
);
ok(
  "a withdrawn plan id resolves to nothing rather than surviving",
  resolve({ current: "deleted-row" }) === null,
  resolve({ current: "deleted-row" }),
);
ok(
  "an unknown tier resolves to nothing rather than to the nearest rung",
  resolve({ wantedTier: "enterprise" }) === null,
  resolve({ wantedTier: "enterprise" }),
);
ok(
  "a legacy link still works, because a legacy row has no tier to translate",
  resolvePlanSelection({
    all: [legacy, ...ladderRows],
    visible: [legacy],
    wantedPlanId: legacy.id,
  }) === legacy.id,
);
// Before the country is known both currencies are on screen. Whatever gets
// picked there must be re-resolved once the address arrives, not frozen.
const provisional = resolvePlanSelection({
  all: ladderRows,
  visible: ladderRows,
  wantedTier: "scale",
});
ok("a provisional pick is made while the country is unknown", provisional !== null);
ok(
  "...and re-resolves to the right currency once the address lands",
  resolvePlanSelection({ all: ladderRows, visible: visibleUsd, current: provisional }) ===
    "scale-usd",
);

console.log("\nSeats and crew, stated separately — never their sum");
const soloLines = peopleLines(cadSolo);
ok("Solo says two things about people", soloLines.length === 2, soloLines.length);
ok("...a seat line", soloLines[0]?.key === "pricing.seatsOneIncluded", soloLines[0]?.key);
ok("...and a crew line", soloLines[1]?.key === "pricing.crewIncluded", soloLines[1]?.key);
ok("...with five crew", soloLines[1]?.values?.count === 5, soloLines[1]?.values?.count);
// The number the owner read. maxUsers is 6 for Solo and must appear nowhere.
ok(
  "the SUM appears in neither line",
  !soloLines.some((l) => Object.values(l.values || {}).includes(cadSolo.maxUsers)),
);
const shopLines = peopleLines(ladderRows.find((r) => r.tierKey === "shop"));
ok("Shop states 6 seats", shopLines[0]?.values?.count === 6, shopLines[0]?.values?.count);
ok("...and 11 crew", shopLines[1]?.values?.count === 11, shopLines[1]?.values?.count);
ok("...not its 17-person total", !shopLines.some((l) => l.values?.count === 17));
// Every rung, so a repriced or resized ladder cannot quietly reintroduce it.
ok(
  "no rung ever states seats + crew as one number",
  ladderRows.every((r) =>
    peopleLines(r).every((l) => (l.values?.count ?? 0) !== r.seats + r.crewSeats),
  ),
);

console.log("\nA legacy row keeps the wording it was sold under");
const legacyLines = peopleLines(legacy);
ok("one line, not two", legacyLines.length === 1, legacyLines.length);
ok("...the old key", legacyLines[0]?.key === "pricing.seatsMany", legacyLines[0]?.key);
ok("...carrying maxUsers", legacyLines[0]?.values?.count === 6, legacyLines[0]?.values?.count);
// The failure this exists to stop: crewSeats null is "no crew concept", not
// "zero crew". Inventing the zero would publish a promise nobody made.
ok(
  "no invented crew line",
  !legacyLines.some((l) => l.key === "pricing.crewIncluded"),
);
ok("a single-user legacy row is singular", peopleLines({ ...legacy, maxUsers: 1 })[0]?.key === "pricing.seatsOne");
ok("a legacy row with no headcount says nothing", peopleLines({ ...legacy, maxUsers: null }).length === 0);
// crewSeats 0 is a STATEMENT — this tier includes no crew — and is not the
// same as null. It suppresses the line rather than printing "0 crew".
ok(
  "a tier with zero crew prints no crew line",
  peopleLines({ ...cadSolo, crewSeats: 0 }).length === 1,
);

console.log("\nThe grid layout, exercised rather than described");
// The doc comment claimed this was covered by a check-pricing-grid.mjs that
// has never existed in this repo. It does now.
ok("four plans sit on one row", pricingColumns(4) === 4);
ok("one plan does not get a four-wide grid", pricingColumns(1) === 1);
ok(
  "no layout from 1..12 leaves a single orphan on the last row",
  Array.from({ length: 12 }, (_, i) => i + 1).every((n) => {
    const c = pricingColumns(n);
    return n <= 1 || n % c === 0 || n % c > 1;
  }),
);
ok("every column count has a Tailwind class", Array.from({ length: 12 }, (_, i) => pricingColumns(i + 1)).every((c) => [1, 2, 3, 4].includes(c)));

async function main() {
  console.log("\nThe whole page, executed: eight rows in, HTML out");
  // The ladder alone first. Production serves exactly this — retire-legacy-plans
  // marks the old per-headcount rows isPublic false — and the legacy card is
  // rendered on its own below, because its wording is deliberately different and
  // one combined blob would let each half excuse the other.
  const html = await renderPage(ladderRows);
  const count = (needle) => html.split(needle).length - 1;
  ok("eight rows produce four cards", count("rounded-2xl") === 4, count("rounded-2xl"));
  ok("four buy buttons, one per rung", count('href="/signup?tier=') === 4, count('href="/signup?tier='));
  ok("Solo is rendered once", count(">Solo<") === 1, count(">Solo<"));
  ok("Scale is rendered once", count(">Scale<") === 1, count(">Scale<"));
  ok("no rendered link is bound to a currency row", !/href="\/signup\?plan=(solo|crew|shop|scale)-/.test(html));
  ok("the page says 1 seat", html.includes("1 seat"));
  ok("...and 5 crew members included", html.includes("5 crew members included"));
  ok("...and never 6 employee accounts", !html.includes("6 employee accounts"));
  ok("...nor 25, Scale's own sum", !html.includes("25 "), html.includes("25 "));

  // The private rate, through the whole page rather than through partitionPlans
  // on its own — the filter being correct is worth nothing if the page skips it.
  const withPrivate = await renderPage(TABLE);
  ok("a bespoke rate never reaches the rendered page", !withPrivate.includes("Custom (2 employees)"));
  ok("...and its price is not on it either", !withPrivate.includes("$90"));

  const legacyHtml = await renderPage([legacy]);
  ok("a legacy card keeps the wording it was sold under", legacyHtml.includes("6 employee accounts"));
  ok("...and invents no crew for it", !legacyHtml.includes("crew members included"));

  console.log("\nThe disclaimer no longer claims a currency it cannot know");
  ok('nothing says "All prices are in"', !html.includes("All prices are in"));
  ok("no bare currency CODE is printed beside a price", !/>\s*(CAD|USD)\s*</.test(html));
  ok("it names the address as what decides", /business address/i.test(html));
  ok("...says both currencies", /Canadian dollars/i.test(html) && /US dollars/i.test(html));
  ok("...says the number is the same either way", /same number/i.test(html));
  ok("...and that it is not a conversion", /not a converted/i.test(html) || /not a conversion/i.test(html));
  ok("...and still mentions tax", /applicable taxes/i.test(html));
  // Only two currencies are supported, so nothing may imply a third.
  ok("nothing offers euros or pounds", !/euro/i.test(html) && !/pound/i.test(html));
  // And the geo guess is gone at the source, not just unused in the copy.
  ok("the page no longer reads the visitor's IP country", !/x-vercel-ip-country/.test(pageCode));
  ok("...nor imports the geo currency helper", !/currencyForCountry/.test(pageCode));
  ok("...nor calls headers()", !/headers\(\)/.test(pageCode));
  ok("the old key is not rendered any more", !/pricingPage\.currencyNote/.test(code(GRID)));

  // ── The page has to say what the money buys ────────────────────────────────
  //
  // The cards printed a seat count and "AI copilot included" and nothing else.
  // The owner read it back the way a stranger would: "i'm paying $100 for what?"
  //
  // Every label in the new block is read from featureMatrix at render time, so a
  // pricing card cannot name a feature this product does not ship and cannot
  // drift from the wording on /features. These assertions pin the keys the owner
  // named specifically, because they are the ones that answer the question.
  console.log("\n── What the money buys ─────────────────────────────────────────\n");

  const plansSrc = readFileSync("app/(marketing)/pricing/PricingPlans.js", "utf8");
  const HEADLINE = [...plansSrc.matchAll(/^\s{6}"([a-z_]+)",$/gm)].map((m) => m[1]);

  ok("the pricing page lists real features at all", HEADLINE.length >= 24, HEADLINE.length);
  // matrixEntry throws on an unknown key, so this is what stops a typo shipping
  // as a blank bullet on the page that asks for money.
  ok("...and every one resolves to a matrix entry", HEADLINE.every((k) => {
    try { return !!matrixEntry(k).name; } catch { return false; }
  }));
  ok("...read at render time, not retyped", /matrixEntry\(key\)/.test(plansSrc));
  // Asserted on the RENDER, not on a quoted string: the first version looked
  // for `"Job costing"` and a mutation that hardcoded it as JSX text — no
  // quotes — walked straight past. The label must come out of the entry.
  ok("...and the label is printed FROM the entry, not typed beside it",
    /\{entry\.name\}/.test(plansSrc));
  ok("...with no matrix name appearing as literal text in the file",
    !HEADLINE.some((k) => {
      const entry = (() => { try { return matrixEntry(k); } catch { return null; } })();
      if (!entry) return false;
      // Strip the data module's own keys list before searching, or every key
      // would match its own name in a comment.
      return new RegExp(`>\\s*${entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*<`).test(plansSrc);
    }));

  // The seven the owner named. If any drops off the page, this fails.
  for (const [key, why] of [
    ["ai_quote_review", "AI quote review"],
    ["voice_receptionist", "the AI receptionist"],
    ["call_to_quote", "a quote drafted from the call"],
    ["instant_quotes", "instant online estimates"],
    ["card_payments", "getting paid by card"],
    ["payroll", "payroll"],
    ["job_costing", "job costing — three tiers up at the competitor"],
  ]) {
    ok(`the page names ${why}`, HEADLINE.includes(key));
  }

  // The tiers are identical in features, so the honest claim is the strong one.
  // If tier differentiation is ever introduced, this sentence becomes false and
  // somebody has to come back here — which is the point.
  ok("it says everything is in every plan",
    /pricing\.includedTitle/.test(plansSrc) && /pricing\.includedBody/.test(plansSrc));
  ok("...and routes to the full list rather than printing 76 bullets",
    /href="\/features"/.test(plansSrc));


  console.log(
    fails.length
      ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
      : `\nPASSED — ${pass}/${pass} assertions`,
  );
  process.exit(fails.length ? 1 : 0);
}

// Any throw in here is a failure of the page, not of the harness — an unhandled
// rejection would otherwise exit 0 on some node versions and report nothing.
main().catch((err) => {
  console.log(`\nFAILED — the page threw before it could be asserted on\n  ✗ ${err?.stack || err}`);
  process.exit(1);
});
