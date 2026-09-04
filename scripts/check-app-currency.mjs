// scripts/check-app-currency.mjs
//
// No back-office screen renders a currency symbol it typed itself.
//
// ── The bug ────────────────────────────────────────────────────────────────
//
// FieldQuo bills in seven currencies (lib/currency.js — USD, CAD, EUR, GBP,
// AUD, NZD, CHF, all Stripe-Connect capable). A British painter's quote
// builder, invoice editor, payroll run and job costing all printed "$1,234.00".
// Not a theme problem: the number was right and the unit was wrong, on the
// screens where a contractor decides what to charge.
//
// ── Why a source scan and not a render test ────────────────────────────────
//
// Because the defect is a LITERAL. Two shapes, both of which put a "$" on
// screen that no formatter chose:
//
//   template literal   `$${money(x)}`     →  "$" then the interpolation
//   JSX text           <span>${money(x)}</span>
//
// The first is the one that fools a reader — `${…}` is interpolation, so
// `$${…}` looks like one construct and is in fact a dollar sign followed by
// one. Executed proof, so this is not a matter of opinion:
//
//   > const money = (n) => `$${n.toLocaleString()}`;  money(1234.5)
//   '$1,234.5'
//   > const plain = (n) => `${n.toLocaleString()}`;   plain(1234.5)
//   '1,234.5'
//
// A render test cannot cover this: there are ~60 takeoff forms, panels and
// list rows involved, most behind a trade selection, a permission toggle or a
// price book. The literal is the thing, so the literal is what is checked.
//
// ── What is allowed instead ────────────────────────────────────────────────
//
//   useCompanyMoney()   — the company's billing currency, from the /app layout
//   formatAppMoney(n, currency, lang)     — same thing, uncurried
//   formatAppMoney(n, CREDIT_CURRENCY, …) — the USD voice/AI credit ledger,
//                                           which is a DIFFERENT currency on
//                                           purpose (lib/voice/creditCurrency.js)
//
// Run: node scripts/check-app-currency.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The contractor back office and the component folders it owns. Deliberately
// not lib/ or the client-facing surfaces: those format through
// documentFormatters, which has its own checks (check-money-and-address).
const ROOTS = [
  "app/app",
  "app/components/quotes",
  "app/components/jobs",
  "app/components/invoices",
  "app/components/clients",
  "app/components/designer",
  // Added 2026-09-03. Both folders were outside every root, which is exactly
  // why they still held three hardcoded dollar signs after the sweep that
  // fixed 114 of them: VehicleCard's `$${Number(v || 0).toLocaleString()}`
  // (which also turned an unrecorded asset cost into "$0"), MaintenanceLog's
  // repair total, and PurchaseOrdersPanel's `$${Number(v).toFixed(2)}` — the
  // ungrouped seventh copy of the bug lib/format/money.js documents. A van
  // and a purchase order are money screens; they belong in the scan.
  "app/components/fleet",
  "app/components/purchasing",
  // app/components/dashboard is NOT scanned, and that is a live exception
  // rather than a decision. RevenueGoalCard.js still builds three bare dollar
  // strings by hand (lines 24, 27, 28 at the time of writing) — including a
  // "$12k" short form no formatter produces. The card was being rebuilt in a
  // parallel session and could not be edited from here without a collision, so
  // the root is listed as owed work, not as safe. Add it back the moment that
  // card is fixed; it is three lines.
];

let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) console.log(`pass  ${name}`);
  else {
    fail++;
    console.log(`FAIL  ${name}${extra ? "\n      " + extra : ""}`);
  }
};

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(p)) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(join(ROOT, r)));

// ── The scan ───────────────────────────────────────────────────────────────
//
// Comment lines are skipped, and that is not laziness: check-money-and-address
// learned the hard way that a comment explaining the very bug gets flagged by
// the scan for it, and that stripping comments with a regex is worse — a `/*`
// inside a string literal makes the block regex swallow real code, which it
// silently did there. Line-level `//` and ` *` skipping is the version that
// cannot eat anything executable.
const hits = [];
for (const abs of files) {
  const rel = relative(ROOT, abs);
  const lines = readFileSync(abs, "utf8").split("\n");
  lines.forEach((line, i) => {
    const t = line.trimStart();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;

    // `$${…}` — a literal dollar in front of a template interpolation.
    if (line.includes("$${")) hits.push({ rel, n: i + 1, line: line.trim(), kind: "template" });
    // `${…}` on a line with no backtick — a literal dollar in JSX text in
    // front of an expression container. The no-backtick test is what keeps
    // ordinary interpolation out of this branch.
    else if (!line.includes("`") && /\$\{/.test(line))
      hits.push({ rel, n: i + 1, line: line.trim(), kind: "jsx" });
  });
}

console.log(`\nScanned ${files.length} files under ${ROOTS.length} roots`);
ok(
  "no back-office screen prints a currency symbol it typed itself",
  hits.length === 0,
  hits.map((h) => `${h.rel}:${h.n}  (${h.kind})  ${h.line.slice(0, 100)}`).join("\n      "),
);

// ── The screens that had it, still reaching for a real formatter ───────────
//
// The scan above answers "is the literal gone". These answer "did it go away
// by being FIXED", not by the amount being deleted, commented out, or moved
// behind a flag — which is the way a source check normally goes quietly wrong.
const USES_FORMATTER = [
  // The quote builder. TradeTakeoff alone carried 61 of them.
  ["app/components/quotes/builder/TradeTakeoff.js", /useCompanyMoney\(\)/],
  ["app/components/quotes/builder/PaintAreas.js", /useCompanyMoney\(\)/],
  ["app/components/quotes/builder/fields.js", /useCompanyMoney\(\)/],
  ["app/components/quotes/builder/UnitPricingFields.js", /formatAppMoney\(/],
  ["app/components/quotes/builder/CostMarginPanel.js", /formatAppMoney\(/],
  ["app/components/quotes/builder/QuoteBuilder.js", /formatAppMoney\(/],
  // Invoices, quotes, clients, jobs.
  ["app/app/invoices/[id]/edit/page.js", /useCompanyMoney\(\)/],
  ["app/app/invoices/page.js", /useCompanyMoney\(\)/],
  ["app/app/quotes/page.js", /useCompanyMoney\(\)/],
  ["app/app/clients/[id]/page.js", /useCompanyMoney\(\)/],
  ["app/app/jobs/[id]/PaymentScheduleCard.js", /useCompanyMoney\(\)/],
  ["app/components/jobs/ChangeOrders.js", /useCompanyMoney\(\)/],
  ["app/components/jobs/JobMaterials.js", /useCompanyMoney\(\)/],
  // Money the contractor manages rather than charges.
  ["app/app/payroll/page.js", /useCompanyMoney\(\)/],
  ["app/app/payroll/[id]/page.js", /useCompanyMoney\(\)/],
  ["app/app/time-off/page.js", /useCompanyMoney\(\)/],
  ["app/app/settings/overhead/page.js", /useCompanyMoney\(\)/],
  ["app/app/settings/expense-tracking/page.js", /useCompanyMoney\(\)/],
  ["app/app/settings/material-costs/page.js", /useCompanyMoney\(\)/],
  // Added 2026-09-03. Its Rate component defaulted `prefix = "$"` — a plain
  // string default, which the scan above cannot see because there is no `${`
  // in front of it. Eighteen money boxes on the screen where a cabinet maker
  // sets every rate they charge, all labelled in dollars. The hints beside two
  // of them quoted rates back with a "$" typed into five language blocks of
  // app/i18n/appMessages.js, which is the same bug one layer further in.
  ["app/app/settings/cabinet-rates/page.js", /useCompanyMoney\(\)/],
  ["app/app/settings/account-billing/page.js", /useCompanyMoney\(\)/],
];

// ── The catalogue is a screen too ──────────────────────────────────────────
//
// A currency symbol typed into a translated STRING reaches exactly the same
// contractor as one typed into JSX, and no scan of app/ can see it. These two
// hints read "(${tall}/lf)" in en, fr, es, de and zh — a literal dollar in
// front of a placeholder, so French rendered "850 $ $/pi lin.", doubled, and a
// German company read dollars. The fix is the one
// app.kpis.moneyFlow.trend.fromZero got: no symbol in the sentence at all, and
// an already-formatted string interpolated in.
const CURRENCY_FREE_KEYS = [
  "app.setCabinetRates.closetHint",
  "app.setCabinetRates.vanityHint",
  "app.kpis.moneyFlow.trend.fromZero",
];
console.log("\nThe screens that had it now call a real formatter");
for (const [rel, re_] of USES_FORMATTER) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  ok(`${rel.split("/").slice(-2).join("/")} — ${re_.source}`, re_.test(src), rel);
}

console.log("\nNo catalogue entry decides the currency of a number for the caller");
{
  // ══ Why this sweeps instead of naming keys ═══════════════════════════════
  //
  // This section used to hold a list of three keys somebody had remembered to
  // add. It passed while `app.marketing.budgetAmount` read "Budget ${amount}"
  // and `app.setWorkers.ratePerHr` read " · ${rate}/hr" — in NINE blocks each —
  // because neither was on the list. A check that only inspects the defects
  // already known is a record of the last fix, not a guard against the next.
  //
  // So it reads every string in every block and looks for a currency symbol
  // ADJACENT TO A VALUE: in front of a placeholder, behind one, or in front of
  // a bare figure. That last form is what caught fr and it, which write
  // "{amount} $" — the symbol trails the number in those languages, so no
  // single literal could ever have been right for all nine, and a scan that
  // only looked for `${` saw two of the nine and called the key clean.
  //
  // ══ The exemptions, each with the reason it is not a bug ═════════════════
  //
  // An exemption is a claim about the world, so each one says what it is.
  const EXEMPT = new Map([
    [
      "app.setPayments.financingActivateNote",
      "Affirm's own limit really is denominated in USD/CAD — the sentence says " +
        "so in the same breath. Rendering it in a Swiss company's francs would " +
        "state a threshold that does not exist.",
    ],
    [
      "app.leads.budgetUnder1k",
      "A lead budget BAND, not a formatted amount — the four bands are fixed " +
        "enum values on Lead.budgetBand. Rendering them per currency means " +
        "deciding whether \"under 1k\" is 1000 CAD, 1000 EUR or a converted " +
        "figure, and a converted band would silently reshuffle which leads " +
        "land in which bucket. That is a product decision, not a formatting " +
        "one. Recorded here so it stays visible instead of passing silently.",
    ],
    ["app.leads.budget1k5k", "See app.leads.budgetUnder1k — same four-band set."],
    ["app.leads.budget5k15k", "See app.leads.budgetUnder1k — same four-band set."],
    ["app.leads.budget15kPlus", "See app.leads.budgetUnder1k — same four-band set."],
  ]);

  // A symbol touching a value. Prose that merely contains "$" — a comment, a
  // currency NAME — is not what this is for.
  const ADJACENT =
    /[$£€]\s*\{|\{[^}]+\}\s*(?:[$£€]|CHF\b)|(?:^|[\s(–—-])(?:[$£€]|CHF)\s*\d/;

  const offenders = new Map();
  let scanned = 0;
  for (const [code, table] of Object.entries(APP_MESSAGES)) {
    for (const [key, value] of Object.entries(table)) {
      if (typeof value !== "string") continue;
      scanned++;
      if (!ADJACENT.test(value)) continue;
      if (EXEMPT.has(key)) continue;
      if (!offenders.has(key)) offenders.set(key, []);
      offenders.get(key).push(code);
    }
  }

  // Proved before it is trusted. A regex that stopped matching would report a
  // clean catalogue forever, which is the shape of a check that looked at
  // nothing — and this file has already shipped one of those.
  ok(
    "the sweep actually read the catalogue",
    scanned > 20000,
    `only ${scanned} strings scanned`,
  );
  ok(
    "...and the pattern still recognises the shape it exists for",
    ADJACENT.test("Budget ${amount}") &&
      ADJACENT.test("Budget {amount} $") &&
      ADJACENT.test("Up from $0 last period") &&
      !ADJACENT.test("Paid in full") &&
      !ADJACENT.test("Amount due"),
  );
  for (const [key, reason] of EXEMPT) {
    ok(
      `the exemption for ${key} still describes a real key`,
      Object.prototype.hasOwnProperty.call(APP_MESSAGES.en, key),
      `exempted for: ${reason} — but the key is gone, so delete the exemption`,
    );
  }

  ok(
    "no key writes a currency symbol beside a value",
    offenders.size === 0,
    [...offenders]
      .map(([k, langs]) => `${k} [${langs.join(",")}]`)
      .slice(0, 8)
      .join("\n      "),
  );
}

// ── The two ledgers stay two ledgers ───────────────────────────────────────
//
// Voice and AI credit are USD because the vendors bill FieldQuo in USD and the
// top-up collects USD — see lib/voice/creditCurrency.js, which spells out that
// "fixing" this in the direction of company.currency LOSES MONEY. A tidy-minded
// pass that swept every money render onto useCompanyMoney() would do exactly
// that, silently, so it is asserted here in the same file that forbids the
// hardcoded dollar.
console.log("\nCredit surfaces stay in the credit currency, not the company's");
const CREDIT_SURFACES = [
  "app/app/receptionist/page.js",
  "app/app/settings/account-billing/CancelFlow.js",
  "app/components/designer/hooks/useAiImageStatus.js",
  "app/components/quotes/SuggestAddOns.js",
];
// CancelFlow is the one screen that legitimately shows BOTH: number rentals
// and credit balance in USD, unpaid client invoices in the company's own
// currency. It is exempt from the second assertion and only from that one.
const TWO_LEDGER = new Set(["app/app/settings/account-billing/CancelFlow.js"]);
for (const rel of CREDIT_SURFACES) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  const name = rel.split("/").slice(-2).join("/");
  ok(`${name} names CREDIT_CURRENCY`, /CREDIT_CURRENCY/.test(src), rel);
  if (TWO_LEDGER.has(rel)) {
    ok(
      `${name} keeps the two ledgers apart`,
      /useCompanyMoney\(\)/.test(src) && /CREDIT_CURRENCY/.test(src),
      "this screen must show USD credit AND company-currency invoices",
    );
  } else {
    ok(
      `${name} does not bill credit in the company's currency`,
      !/useCompanyMoney\(\)/.test(src),
      "credit is USD; company currency here understates what the card is charged",
    );
  }
}

// ── The provider actually carries a currency ───────────────────────────────
//
// The whole fix rests on one thing: that /app's layout resolves the company's
// currency and hands it down. If either end is removed, every screen above
// silently falls back to the schema default and the bug is back with no
// literal for the scan above to catch.
console.log("\nThe currency reaches the screens");
const provider = readFileSync(
  join(ROOT, "app/providers/CompanyPreferencesProvider.js"),
  "utf8",
);
ok("the provider exports useCompanyMoney", /export function useCompanyMoney/.test(provider));
ok("...bound to a currency", /moneyFormatter\(/.test(provider));
ok("...accepting a server-resolved initial value", /initialCurrency/.test(provider));

const layout = readFileSync(join(ROOT, "app/app/layout.js"), "utf8");
ok("the /app layout selects the currency", /currency:\s*true/.test(layout));
ok(
  "...and passes it to the provider",
  /<CompanyPreferencesProvider initialCurrency=/.test(layout),
  "without this the first paint of every money figure is the schema default",
);

console.log(
  fail
    ? `\n${fail} FAILED — a back-office screen is printing a currency it chose itself\n`
    : "\nALL PASS — every back-office amount is formatted in the company's own currency\n",
);
process.exit(fail ? 1 : 0);
