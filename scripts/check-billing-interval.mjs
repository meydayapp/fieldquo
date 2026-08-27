// scripts/check-billing-interval.mjs
//
// The one-year commitment, which the product could not remember it had sold.
//
// A company chose "1 year commitment" at signup. That choice was written into
// the Stripe checkout session's metadata and NOWHERE ELSE — FieldQuo's own
// database had no column for it. So every screen assumed monthly, and the
// Account & Billing "Choose plan" button posted `{ planId }` with no cadence,
// which lib/platform/stripeBilling.js turned into `interval: DEFAULT_INTERVAL`.
//
// The consequence, in order: an annual company changes tier, is silently moved
// to monthly, and loses the two months free they had committed a year for. The
// screen never said it was happening because the screen did not know.
//
// ══ Written from Stripe, not from the screen ═══════════════════════════════
//
// The authority on how somebody is billed is the price on the live
// subscription item. A cadence can change in the Stripe customer portal, which
// never passes through this app — so recording what our own checkout asked for
// would drift the first time anyone used the portal.
//
// And a shape we cannot read must leave the stored value ALONE. Defaulting to
// "month" on an unreadable object is how the two free months would go missing
// a second time, quietly, from the code written to stop it.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-billing-interval.mjs

import { readFileSync } from "node:fs";
import {
  isBillingInterval,
  supportsInterval,
  chargeFor,
  annualSaving,
  annualPriceOf,
  intervalFromStripeSubscription,
  resolveCheckoutInterval,
  DEFAULT_INTERVAL,
} from "@/lib/billing/interval";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);

const solo = { priceMonthly: 99, priceAnnual: 990 };
const custom = { priceMonthly: 90, priceAnnual: null };
const stripeSub = (interval) => ({ items: { data: [{ price: { recurring: { interval } } }] } });

console.log("\nReading the cadence off a live Stripe subscription");
ok("a yearly subscription reads as year", intervalFromStripeSubscription(stripeSub("year")) === "year");
ok("a monthly one reads as month", intervalFromStripeSubscription(stripeSub("month")) === "month");
// The whole point of returning null rather than a default: the caller spreads
// it conditionally, so "we can't tell" leaves a real commitment standing.
ok("an unrecognised interval is null, NOT month",
  intervalFromStripeSubscription(stripeSub("week")) === null,
  intervalFromStripeSubscription(stripeSub("week")));
ok("a one-off item with no recurring block is null",
  intervalFromStripeSubscription({ items: { data: [{ price: {} }] } }) === null);
ok("an empty subscription is null", intervalFromStripeSubscription({}) === null);
ok("null input does not throw", intervalFromStripeSubscription(null) === null);
// Stripe puts the metered/licensed items in one array; the first recognisable
// recurring price is the subscription's cadence.
ok("a mixed item list finds the recurring one",
  intervalFromStripeSubscription({
    items: { data: [{ price: {} }, { price: { recurring: { interval: "year" } } }] },
  }) === "year");

console.log("\nA plan cannot be sold on a cadence it does not have");
ok("Solo supports the year", supportsInterval(solo, "year") === true);
ok("a bespoke Custom row does not", supportsInterval(custom, "year") === false);
// Falling back to monthly is the failure this module exists to prevent: the
// screen would still say "1 year commitment" while the card was charged monthly.
ok("...and chargeFor REFUSES rather than falling back", chargeFor(custom, "year") === null);
ok("Solo on the year charges the annual price once", chargeFor(solo, "year")?.amount === 990);
ok("...in cents, for Stripe", chargeFor(solo, "year")?.unitAmountCents === 99000);
ok("garbage is refused, not coerced", chargeFor(solo, "fortnight") === null);
ok("the default cadence is the one with no commitment attached", DEFAULT_INTERVAL === "month");
ok("...and it is a real interval", isBillingInterval(DEFAULT_INTERVAL));

console.log("\nWhat the year is worth, said in money");
// Two months free on the ladder. It was zero when the year billed at the same
// rate; the owner corrected that — a commitment saving nothing is never taken.
ok("Solo saves two months", annualSaving(solo) === 198, annualSaving(solo));
// "We cannot compare" is not "no saving". A screen printing "Save $0" because
// a column was blank would be inventing a statement.
ok("a plan with no annual price compares to null", annualSaving(custom) === null);
ok("...and quotes no yearly figure", annualPriceOf(custom) === null);

console.log("\nThe column exists, and something writes it");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const sub = schema.slice(schema.indexOf("model Subscription {"));
ok("Subscription carries the cadence", /billingInterval String @default\("month"\)/.test(sub.slice(0, sub.indexOf("\n}"))));

const stripeBilling = readFileSync("lib/platform/stripeBilling.js", "utf8");
const reconcile = readFileSync("app/api/settings/subscription/reconcile/route.js", "utf8");
ok("the webhook writes it from the live price", /intervalFromStripeSubscription\(obj\)/.test(stripeBilling));
ok("the reconcile route writes it too", /intervalFromStripeSubscription\(live\)/.test(reconcile));
// Both spread CONDITIONALLY. An unconditional write is the regression that
// would put "month" over a real commitment.
ok("the webhook leaves it alone when Stripe doesn't say",
  /\.\.\.\(intervalFromStripeSubscription\(obj\)\s*\n?\s*\?\s*\{ billingInterval/.test(stripeBilling));
ok("...and so does reconcile",
  /\.\.\.\(intervalFromStripeSubscription\(live\)\s*\n?\s*\?\s*\{ billingInterval/.test(reconcile));
// checkout.session.completed lands before the subscription event; the metadata
// we set is the earliest honest answer.
ok("the checkout upsert reads the metadata we set",
  /isBillingInterval\(session\.metadata\?\.billingInterval\)/.test(stripeBilling));

console.log("\nAnd something READS it");
const checkout = readFileSync("app/api/platform/billing/checkout/route.js", "utf8");
const subRoute = readFileSync("app/api/settings/subscription/route.js", "utf8");
const page = readFileSync("app/app/settings/account-billing/page.js", "utf8");
ok("checkout accepts a cadence", /interval: requestedInterval/.test(checkout));
ok("...and delegates the decision to the pure rule", /resolveCheckoutInterval\(plan, requestedInterval\)/.test(checkout));
ok("...refusing before it reaches Stripe", /if \(cadence\.error\)[\s\S]{0,90}status: 400/.test(checkout));
ok("...then passes it to Stripe", /\n    interval,\n/.test(checkout));

console.log("\nThe checkout rule itself, EXECUTED");
// This is here because the regex version of these four assertions did not fail
// when the guard was disabled with `false &&`. The rule is pure now, so it can
// be run rather than looked at.
ok("a stated year on a plan that has one is honoured",
  resolveCheckoutInterval(solo, "year").interval === "year");
ok("a stated month is honoured", resolveCheckoutInterval(solo, "month").interval === "month");
ok("saying nothing gets the option with no commitment attached",
  resolveCheckoutInterval(solo, undefined).interval === "month");
ok("nonsense gets the same default, not a crash",
  resolveCheckoutInterval(solo, "decade").interval === "month");
// The one that matters: a bespoke Custom row has no annual price, and quietly
// billing it monthly under an annual label is the failure with money attached.
const refused = resolveCheckoutInterval(custom, "year");
ok("a year asked of a plan that has none is REFUSED", refused.interval === undefined);
ok("...with a reason a person can act on", /yearly commitment/.test(refused.error || ""));
ok("...and that same plan still sells monthly",
  resolveCheckoutInterval(custom, "month").interval === "month");
ok("the subscription route sends it to the screen", /billingInterval: true/.test(subRoute));
ok("the page seeds the switch from what they're on",
  /isBillingInterval\(sub\?\.billingInterval\)/.test(page));
ok("...and posts it back", /JSON\.stringify\(\{ planId, interval: billingInterval/.test(page));
// A toggle whose other half cannot be bought is a control that appears to work.
ok("the switch hides when nothing on offer has an annual price",
  /plans\.some\(\(p\) => annualPriceOf\(p\) !== null\)/.test(page));
ok("a tier with no annual price disables its own button", /const unsellable =/.test(page));
// Their own tier with the switch on the year is a real purchase — it is how a
// monthly company takes the commitment.
ok("'current plan' means the tier AND the cadence",
  /sameTier && \(subscription\?\.billingInterval \|\| "month"\) === billingInterval/.test(page));

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
