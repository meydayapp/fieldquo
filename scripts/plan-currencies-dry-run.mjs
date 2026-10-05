// scripts/plan-currencies-dry-run.mjs
//
//   npm run plan-currencies:dry-run                      # offline: every ladder row
//   npm run plan-currencies:dry-run -- --db              # read Plan + ExchangeRate (reads only)
//   npm run plan-currencies:dry-run -- --rate GBPCAD=1.8853 --rate EURCAD=1.6037
//
// What adding GBP and EUR (owner, 2026-10-04) — and AUD (2026-09-24, never
// seeded) — to the plan ladder would create, printed and NOT done. Nothing in
// this file writes to a database or talks to Stripe.
//
// ══ What "create the Stripe prices" means on this codebase ═════════════════
//
// Nothing, ahead of time. Every plan checkout sends its price INLINE as
// price_data (lib/billing/planLine.js, called by lib/platform/stripeBilling.js
// recurringLine for the trial checkout, the billing checkout, an immediate
// change and a scheduled change). The CAD and USD rows were made the same way
// — scripts/seed-seat-ladder.mjs inserts Plan rows, stripePriceId stays null,
// and Stripe sees the amount for the first time on the first checkout. So the
// creation path for GBP/EUR/AUD is exactly that seeder; this prints its rows
// and the exact line each checkout would then send.
//
// The one Stripe object that IS minted — lazily, at the first CUSTOM-size
// checkout in a currency — is the "Extra seat" Price (ensureExtraSeatPrice,
// found by lookup_key). Its parameters are printed below too.
//
// ══ The comparison table ═══════════════════════════════════════════════════
//
// "£99 ≈ US$X". The ExchangeRate table is read with --db; it holds the pairs
// /api/cron/fx-refresh fetches (USD/CAD today). Bank of Canada series are all
// <X>/CAD, so any pair can be crossed through CAD: X→USD = XCAD / USDCAD.
// Missing pairs can be supplied with --rate XCAD=<v>; a pair with no rate
// prints "—", never a guess.
import { SEAT_LADDER, SUPPORTED_CURRENCIES, ladderSeedRows, planTaxBehavior, CUSTOM_SEAT_PRICE, currencyLabel, defaultAnnualPrice } from "@/lib/pricing/ladder";
import { planLine, extraSeatLookupKey } from "@/lib/billing/planLine";

const args = process.argv.slice(2);
const USE_DB = args.includes("--db");
const rateArgs = [];
for (let i = 0; i < args.length; i++) if (args[i] === "--rate" && args[i + 1]) rateArgs.push(args[++i]);

/** XCAD rates: what one unit of X is in Canadian dollars. CAD itself is 1. */
const toCad = new Map([["CAD", { rate: 1, from: "identity" }]]);
let existing = null; // Set of "tierKey/currency" when --db, else null (unknown)

if (USE_DB) {
  const { db } = await import("@/lib/db");
  try {
    const plans = await db.plan.findMany({ where: { tierKey: { not: null } }, select: { tierKey: true, currency: true } });
    existing = new Set(plans.map((p) => `${p.tierKey}/${p.currency}`));
    const fx = await db.exchangeRate.findMany({ orderBy: { rateDate: "desc" } });
    for (const r of fx) {
      if (r.quote !== "CAD") continue;
      if (!toCad.has(r.base)) toCad.set(r.base, { rate: Number(r.rate), from: `ExchangeRate ${r.base}/CAD for ${r.rateDate.toISOString().slice(0, 10)}` });
    }
  } finally {
    await db.$disconnect?.().catch(() => {});
  }
}
for (const a of rateArgs) {
  const m = /^([A-Z]{3})CAD=([\d.]+)$/.exec(a);
  if (m && Number(m[2]) > 0) toCad.set(m[1], { rate: Number(m[2]), from: "--rate" });
}

const usdPer = (cur) => {
  const x = toCad.get(cur);
  const usd = toCad.get("USD");
  if (!x || !usd) return null;
  return x.rate / usd.rate;
};
const money2 = (n) => n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── 1. Plan rows ────────────────────────────────────────────────────────────
console.log("\n1. Plan rows scripts/seed-seat-ladder.mjs would create (additive; existing rows are never changed)\n");
const rows = ladderSeedRows();
const toCreate = rows.filter((r) => !existing || !existing.has(`${r.tierKey}/${r.currency}`));
if (!existing) console.log("   (offline — every ladder row is listed; run with --db to subtract the rows that exist)\n");
console.log("   tierKey  currency  name    seats+crew  priceMonthly  priceAnnual  isPublic");
for (const r of toCreate) {
  console.log(
    `   ${r.tierKey.padEnd(8)} ${r.currency.padEnd(9)} ${r.name.padEnd(7)} ${`${r.seats}+${r.crewSeats}`.padEnd(11)} ${money2(r.priceMonthly).padStart(12)}  ${money2(r.priceAnnual).padStart(11)}  ${r.isPublic}`,
  );
}
console.log(`\n   ${toCreate.length} row(s) to create; 0 updated; 0 deleted.`);

// ── 2. What Stripe would be sent ────────────────────────────────────────────
console.log("\n2. Stripe — no Price objects are created ahead of time. Each checkout sends this inline line:\n");
for (const r of toCreate) {
  for (const interval of ["month", "year"]) {
    const line = planLine({ plan: r, interval, currency: r.currency.toLowerCase() });
    console.log(`   ${r.tierKey}/${r.currency}/${interval}: ${JSON.stringify(line)}`);
  }
}
const newCurrencies = [...new Set(toCreate.map((r) => r.currency))];
console.log("\n   Minted lazily at the FIRST custom-size checkout in a currency (ensureExtraSeatPrice), never by this script:\n");
// A seeded Scale row is pay-10-get-12, so an extra seat's year is the same ratio.
for (const cur of newCurrencies) {
  const tb = planTaxBehavior(cur);
  for (const [interval, amount] of [["month", CUSTOM_SEAT_PRICE], ["year", defaultAnnualPrice(CUSTOM_SEAT_PRICE)]]) {
    console.log(
      `   stripe.prices.create(${JSON.stringify({
        currency: cur.toLowerCase(),
        unit_amount: Math.round(amount * 100),
        recurring: { interval },
        lookup_key: extraSeatLookupKey(cur, interval),
        transfer_lookup_key: true,
        nickname: `Extra seat (${cur}, per ${interval})`,
        metadata: { fieldquo: "extra_seat", interval },
        ...(tb ? { tax_behavior: tb } : {}),
      })})`,
    );
  }
}

// ── 3. The comparison table ─────────────────────────────────────────────────
console.log("\n3. Same numbers, today's money (monthly price → US dollars)\n");
for (const [cur, x] of toCad) if (cur !== "CAD") console.log(`   ${cur}/CAD ${x.rate} — ${x.from}`);
const head = ["tier", ...SUPPORTED_CURRENCIES.map((c) => `${c} (≈US$)`)];
console.log(`\n   ${head.map((h, i) => (i ? h.padStart(20) : h.padEnd(6))).join("")}`);
for (const tier of SEAT_LADDER) {
  const cells = SUPPORTED_CURRENCIES.map((cur) => {
    const per = usdPer(cur);
    const label = `${currencyLabel(cur)}${tier.price}`;
    return `${label} (${per ? `≈${money2(tier.price * per)}` : "—"})`.padStart(20);
  });
  console.log(`   ${tier.label.padEnd(6)}${cells.join("")}`);
}
console.log("\n   Annual = 10 × monthly in every currency (e.g. £990, €990 for Solo).");

// ── 4. VAT ──────────────────────────────────────────────────────────────────
console.log("\n4. VAT on GBP/EUR lines (tax_behavior exclusive — added on top, by Stripe Tax)\n");
console.log("   Charged only once FieldQuo adds the UK / EU-OSS registration in Stripe (lib/platform/taxRegistrations.js).");
console.log("   UK, no VAT number: £99 + 20% = £118.80; with a UK VAT number: £99 (reverse charge).");
console.log("   EU, no VAT ID, e.g. Ireland 23%: €99 + €22.77 = €121.77; Germany 19%: €117.81; with a VAT ID: €99 (reverse charge).");
console.log("   If the lines were sent inclusive instead, FieldQuo would net £82.50 of a UK £99 (99 / 1.2).\n");
