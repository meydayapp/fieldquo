// scripts/check-money-status-chips.mjs
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-money-status-chips.mjs
//
// Two more enums that reached a human as raw snake_case on a money screen, and
// the one that mattered most had no colour.
//
// ── What this is guarding against, concretely ──────────────────────────────
//
// scripts/check-invoice-status.mjs tells this story for InvoiceStatus. It was
// never only about invoices:
//
//   * Account & Billing rendered `{subscription.status}` under a `capitalize`
//     class, with amber for trialing, green for active and `bg-muted` for
//     everything else. "Everything else" is `past_due` and `canceled`. So a
//     company whose renewal had failed — seven days from the grace period
//     locking them out of their own quote history — read the word "Past_due"
//     in the quietest style on the page.
//
//   * The pay-run screen rendered `{p.status}` as one muted grey line for all
//     four PayoutStatus values. A FAILED transfer and a PAID one differed by
//     one word in the same grey. The money had not moved and somebody had not
//     been paid.
//
// Both are now driven by exhaustive maps beside the enums they describe.
//
// ── Why it parses the schema instead of listing the values ─────────────────
//
// Same reason check-invoice-status.mjs gives: a hardcoded list here would pass
// forever the day a fifth value is added — the check agreeing with itself while
// the pages fall behind, which is the exact shape of the bug. The enums are
// parsed out of prisma/schema.prisma and treated as the only authority.
//
// ── And why it EXECUTES the modules rather than grepping the pages ─────────
//
// A regex asserting `subscriptionStatusClasses(` appears in the page cannot
// tell a live call from one behind `false &&`. The presentation modules are
// pure, so the mapping is executed here directly; the pages are then checked
// only for the thing a regex CAN see honestly — that the raw value is not
// being printed beside a `capitalize`.

import { readFileSync } from "node:fs";
import { APP_MESSAGE_KEYS } from "@/app/i18n/appMessages";
import { STATUS_TONE_CLASSES } from "@/lib/status/tone";
import {
  SUBSCRIPTION_STATUS_PRESENTATION,
  subscriptionStatusClasses,
  subscriptionStatusLabel,
} from "@/lib/billing/subscriptionStatusPresentation";
import {
  PAYOUT_STATUS_PRESENTATION,
  payoutStatusClasses,
  payoutStatusLabel,
} from "@/lib/payroll/payoutStatusPresentation";

let pass = 0;
const failures = [];
// Label FIRST, condition second. Getting these the other way round makes a
// non-empty string the condition, and the check can then never fail.
const ok = (label, cond) =>
  cond ? (pass++, undefined) : failures.push(label);

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const schema = read("prisma/schema.prisma");

function enumValues(name) {
  const m = schema.match(new RegExp(`enum ${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return (m ? m[1] : "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim())
    .filter((l) => /^[a-z_]+$/.test(l));
}

// ── 1. The enums, from the schema itself ───────────────────────────────────
const SUBSCRIPTION = enumValues("SubscriptionStatus");
const PAYOUT = enumValues("PayoutStatus");

// If either parse ever reads as fewer than the values that predate this check,
// the regex has silently stopped matching and every assertion below would
// vacuously pass on an empty list.
ok(
  `SubscriptionStatus parsed plausibly (got ${SUBSCRIPTION.length})`,
  SUBSCRIPTION.length >= 4 && SUBSCRIPTION.includes("past_due"),
);
ok(
  `PayoutStatus parsed plausibly (got ${PAYOUT.length})`,
  PAYOUT.length >= 4 && PAYOUT.includes("failed"),
);

// ── 2. Exhaustive, both directions ─────────────────────────────────────────
const cases = [
  ["SubscriptionStatus", SUBSCRIPTION, SUBSCRIPTION_STATUS_PRESENTATION],
  ["PayoutStatus", PAYOUT, PAYOUT_STATUS_PRESENTATION],
];

for (const [name, values, map] of cases) {
  for (const v of values) {
    ok(
      `${name}: presentation covers "${v}"`,
      Object.prototype.hasOwnProperty.call(map, v),
    );
  }
  for (const k of Object.keys(map)) {
    ok(`${name}: "${k}" is a real value, not a stale key`, values.includes(k));
  }
}

// ── 3. Every value resolves to a real chip ─────────────────────────────────
//
// The original invoice bug did not throw. `STATUS_STYLES[status]` returned
// undefined and the template literal rendered the literal word "undefined" into
// the class list, so the badge simply had no colour. That is what this asserts:
// a real class string, from the shared map, for every value including one the
// modules have never heard of.
for (const v of [...SUBSCRIPTION, "some_status_added_in_2027"]) {
  const cls = subscriptionStatusClasses(v);
  ok(
    `SubscriptionStatus: "${v}" resolves to a real chip class`,
    typeof cls === "string" &&
      cls.length > 0 &&
      !cls.includes("undefined") &&
      Object.values(STATUS_TONE_CLASSES).includes(cls),
  );
}
for (const v of [...PAYOUT, "some_status_added_in_2027"]) {
  const cls = payoutStatusClasses(v);
  ok(
    `PayoutStatus: "${v}" resolves to a real chip class`,
    typeof cls === "string" &&
      cls.length > 0 &&
      !cls.includes("undefined") &&
      Object.values(STATUS_TONE_CLASSES).includes(cls),
  );
}

// ── 4. The two that need a person get the urgent tone ──────────────────────
//
// The whole point. `past_due` is money the reader must act on before the grace
// clock runs out; `failed` is a wage that did not arrive. Neither may be the
// same grey as a routine row, and neither may quietly be recoloured to
// something calmer later.
ok(
  "a past_due subscription is urgent, not muted",
  SUBSCRIPTION_STATUS_PRESENTATION.past_due?.tone === "urgent",
);
ok(
  "a failed payout is urgent, not muted",
  PAYOUT_STATUS_PRESENTATION.failed?.tone === "urgent",
);
// And the routine ones are NOT urgent, or urgent stops meaning anything.
ok(
  "an active subscription is not urgent",
  SUBSCRIPTION_STATUS_PRESENTATION.active?.tone !== "urgent",
);
ok(
  "a paid payout is not urgent",
  PAYOUT_STATUS_PRESENTATION.paid?.tone !== "urgent",
);
// Money in flight is not money arrived. A green tick on a transfer Stripe has
// not settled is the claim that got the original grey shipped.
ok(
  "a processing payout is not shown as positive",
  PAYOUT_STATUS_PRESENTATION.processing?.tone !== "positive",
);

// ── 5. Never a raw enum value, and never an undefined key ──────────────────
//
// t() is stubbed to return the key, so a label that comes back as the raw
// status means the map fell through to String(status).
const t = (k) => `«${k}»`;
for (const v of SUBSCRIPTION) {
  const label = subscriptionStatusLabel(v, t);
  ok(`SubscriptionStatus: "${v}" does not print the raw value`, label !== v);
  ok(`SubscriptionStatus: "${v}" has a non-empty label`, Boolean(label));
}
for (const v of PAYOUT) {
  const label = payoutStatusLabel(v, t);
  ok(`PayoutStatus: "${v}" does not print the raw value`, label !== v);
  ok(`PayoutStatus: "${v}" has a non-empty label`, Boolean(label));
}

// Every labelKey the modules name must exist in the catalogue. t() falls back
// to the key itself, so a typo here renders "app.status.paidd" on the money
// screen — and check:translations only sees literals in app/ and lib/, which is
// exactly where these are, but it cannot tell a live key from a stale one.
for (const [name, , map] of cases) {
  for (const [value, entry] of Object.entries(map)) {
    if (!entry.labelKey) continue;
    ok(
      `${name}: "${value}" points at a defined key (${entry.labelKey})`,
      APP_MESSAGE_KEYS.includes(entry.labelKey),
    );
  }
}
// A row with no key MUST carry an English fallback, or the label falls through
// to the raw value and we are back where we started.
for (const [name, , map] of cases) {
  for (const [value, entry] of Object.entries(map)) {
    if (entry.labelKey) continue;
    ok(
      `${name}: "${value}" has no key yet, so it must carry a fallback`,
      typeof entry.fallback === "string" && entry.fallback.length > 0,
    );
  }
}

// ── 6. The pages actually stopped printing the raw value ───────────────────
//
// Comments stripped first: this file's own prose quotes the shapes it forbids,
// and so do the pages' explanatory comments. Reading them raw would make a
// comment describing the old bug match as the old bug.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const billingPage = stripComments(read("app/app/settings/account-billing/page.js"));
const payrollPage = stripComments(read("app/app/settings/team/payroll/page.js"));

ok(
  "account-billing renders the status through the shared label",
  /subscriptionStatusLabel\(\s*subscription\.status/.test(billingPage),
);
ok(
  "account-billing colours the chip through the shared map",
  /subscriptionStatusClasses\(/.test(billingPage),
);
// The exact shape that shipped the bug: the raw value inside JSX next to a
// `capitalize`. `{subscription.status}` on its own is what rendered "Past_due".
ok(
  "account-billing no longer prints {subscription.status} raw",
  !/\{\s*subscription\.status\s*\}/.test(billingPage),
);
ok(
  "the pay-run screen renders the status through the shared label",
  /payoutStatusLabel\(\s*p\.status/.test(payrollPage),
);
ok(
  "the pay-run screen colours the chip through the shared map",
  /payoutStatusClasses\(/.test(payrollPage),
);
ok(
  "the pay-run screen no longer prints {p.status} raw",
  !/\{\s*p\.status\s*\}/.test(payrollPage),
);

// ── 7. One tone map, not three ─────────────────────────────────────────────
//
// lib/invoices/statusPresentation.js spent thirty lines explaining why two
// copies of these class strings rotted. A third copy in either new module would
// be that argument losing.
for (const [file, src] of [
  ["subscriptionStatusPresentation.js", read("lib/billing/subscriptionStatusPresentation.js")],
  ["payoutStatusPresentation.js", read("lib/payroll/payoutStatusPresentation.js")],
  ["invoices/statusPresentation.js", read("lib/invoices/statusPresentation.js")],
]) {
  ok(
    `${file} takes its classes from lib/status/tone.js`,
    /@\/lib\/status\/tone/.test(src),
  );
  ok(
    `${file} does not carry its own copy of the chip classes`,
    !/bg-green-50 dark:bg-green-950\/40 text-green-700/.test(src),
  );
}

// ── Report ─────────────────────────────────────────────────────────────────
console.log(`\ncheck-money-status-chips: ${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  ✗ ${f}`);
if (failures.length) process.exitCode = 1;
