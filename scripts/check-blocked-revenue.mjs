// scripts/check-blocked-revenue.mjs
//
//   npm run check:blocked-revenue
//
// The platform dashboard's loudest money warning, held to the standard the
// rest of the console is held to: say what is true, and name the field the
// reader has to go and change.
//
// ══ The warning this exists to stop coming back ═══════════════════════════
//
// lib/platform/revenueOutlook.js decided which active subscriptions cannot
// raise a charge, and then explained itself like this:
//
//     reason: !s.stripeSubscriptionId
//       ? "no Stripe subscription"
//       : "the plan has no Stripe price",
//
// `isCollectable` — twenty lines above, in the same file — does not consult
// `stripePriceId` and has not since that field stopped gating checkout
// (lib/platform/stripeBilling.js point 2; lib/platform/sellablePlans.js
// documents the same removal on the pricing page). So the second branch was
// unreachable *as described*: the only way to be blocked while HAVING a Stripe
// subscription is a plan whose `priceMonthly` is 0 or missing, which
// `Plan.priceMonthly` defaults to and `parsePlanFields` permits.
//
// The console therefore printed "the plan has no Stripe price" over rows whose
// price id was set, populated, and visible one screen away — and the dashboard
// banner repeated it in bigger type with "Add the prices and this becomes real
// revenue." A superadmin who follows that goes to the Stripe dashboard to fix
// a Plan row. check-plan-sellability.mjs already forbids exactly this sentence
// on the plan cards; nothing forbade it here, so it survived in the one place
// with the largest audience.
//
// ══ Why the reason is EXECUTED, not grepped ═══════════════════════════════
//
// The rules below run `blockedReason` and `buildRevenueOutlook` against
// fixtures covering every shape a Subscription row can hold, including the one
// that produced the false sentence: a live Stripe subscription, a price id
// present, and a $0 plan. A grep would prove the words changed; running it
// proves the DIAGNOSIS changed, which is the thing that was wrong.
//
// The JSX cannot be executed, so the two rules that reach app/platform/page.js
// are greps — and they are NEGATIVE (does the false claim appear) plus one
// scoped positive (does the list get rendered at all), for the reason the rest
// of this repo's checks state: a positive containment rule passes the moment
// its string appears anywhere in a 600-line file.
//
// ══ What this does NOT prove ══════════════════════════════════════════════
//
// That the banner is readable, that the reasons are the right ADVICE, or that
// a blocked subscription is blocked for a reason FieldQuo can act on at all.
// It proves that no sentence this module can emit blames a Stripe price id,
// that a $0 plan is diagnosed as a $0 plan, and that the per-row breakdown
// reaches a screen instead of being computed and dropped.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  blockedReason,
  BLOCKED_REASON_TEXT,
  buildRevenueOutlook,
  isCollectable,
} from "../lib/platform/revenueOutlook.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let checks = 0;
let failures = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}
const section = (t) => console.log(`\n${t}`);

/** Comments carry the sentences they replaced, on purpose. Greps read code. */
function codeOnly(src) {
  // Line comments FIRST — reversed, a `/*` inside a `//` line opens a block
  // that swallows the code the greps exist to inspect, and a check with
  // nothing left to look at passes.
  return src.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

const sub = (over = {}) => ({
  status: "active",
  stripeSubscriptionId: "sub_live",
  trialEndsAt: null,
  company: { name: "Sunset Painting" },
  plan: { name: "Solo", currency: "CAD", priceMonthly: 149, stripePriceId: "price_abc" },
  ...over,
});

/* ══ 1. The diagnosis matches the test that produced it ═══════════════════ */

section("blockedReason answers for the reason isCollectable actually refused");

ok("a collectable subscription has no reason at all", blockedReason(sub()) === null);
ok("  ^ and isCollectable agrees", isCollectable(sub()) === true);

// THE fixture. Everything Stripe needs, a price id present, and a $0 plan.
// This is the row that produced "the plan has no Stripe price".
const zeroPriced = sub({
  plan: { name: "Solo", currency: "CAD", priceMonthly: 0, stripePriceId: "price_abc" },
});
ok("a $0 plan with a live Stripe subscription is blocked", isCollectable(zeroPriced) === false);
ok(
  "  ^ and is diagnosed as a price problem, not a Stripe one",
  blockedReason(zeroPriced) === "no_plan_price",
  `got ${blockedReason(zeroPriced)}`,
);

// The same shape without a price id, so the diagnosis cannot be keying on it.
const zeroPricedNoId = sub({
  plan: { name: "Solo", currency: "CAD", priceMonthly: 0, stripePriceId: null },
});
ok(
  "the diagnosis does not change when the price id is removed",
  blockedReason(zeroPricedNoId) === blockedReason(zeroPriced),
  `${blockedReason(zeroPricedNoId)} vs ${blockedReason(zeroPriced)}`,
);

// A plan with a price id and a good price, but no Stripe subscription: the
// OTHER branch, which was and remains true.
const noStripeSub = sub({ stripeSubscriptionId: null });
ok(
  "no Stripe subscription is diagnosed as no Stripe subscription",
  blockedReason(noStripeSub) === "no_stripe_subscription",
);

// A missing price is not the same as a zero one to a reader, but it is the
// same fix, and it must not fall through to a third undefined code.
for (const [label, price] of [
  ["null", null],
  ["undefined", undefined],
  ["a non-numeric string", "free"],
]) {
  const s = sub({ plan: { name: "Solo", priceMonthly: price, stripePriceId: "price_abc" } });
  ok(
    `a plan priced ${label} is diagnosed as no_plan_price`,
    blockedReason(s) === "no_plan_price",
    `got ${blockedReason(s)}`,
  );
}

// A subscription with no plan relation at all must not throw — the guard that
// used to stop that lives in isCollectable and this is the caller that would
// notice if it were removed.
ok("a subscription with no plan is diagnosed rather than throwing", (() => {
  try {
    return blockedReason(sub({ plan: undefined })) === "no_plan_price";
  } catch {
    return false;
  }
})());

/* ══ 2. No sentence this module can emit blames a Stripe price id ═════════ */

section("Nothing in the closed set of sentences sends the reader to Stripe's dashboard");

const codes = Object.keys(BLOCKED_REASON_TEXT);
ok("the sentence table is a closed set with an entry per code", codes.length === 2, codes.join(", "));

for (const code of codes) {
  const text = BLOCKED_REASON_TEXT[code];
  ok(`${code} has a sentence`, typeof text === "string" && text.length > 20);
  // The exact misdirection: a price ID is a Stripe dashboard object; a monthly
  // price is a field on our own plan form. Naming the first for a fault in the
  // second is what this whole file is about.
  ok(
    `  ^ ${code} does not blame a Stripe price id`,
    !/stripe\s+price\s*id|price\s*id|no\s+stripe\s+price\b/i.test(text),
    text,
  );
}

// Every code blockedReason can return has a sentence. A code with no entry
// renders `undefined` next to a company name, which is the fabricated-blank
// version of the same bug.
const emittable = new Set(
  [sub(), zeroPriced, noStripeSub, sub({ plan: undefined })]
    .map(blockedReason)
    .filter(Boolean),
);
for (const code of emittable) {
  ok(`the code ${code} has a sentence to render`, Boolean(BLOCKED_REASON_TEXT[code]));
}

/* ══ 3. The outlook carries the breakdown, and the money stays honest ═════ */

section("buildRevenueOutlook ships the per-row breakdown, not only a total");

const now = new Date("2026-09-03T00:00:00Z");
const outlook = buildRevenueOutlook(
  [
    zeroPriced,
    sub({ stripeSubscriptionId: null, company: { name: "Bay Cabinets" }, plan: { name: "Crew", priceMonthly: 149, stripePriceId: null } }),
    sub({ company: { name: "Northshore Floors" } }),
  ],
  now,
);

ok("two of the three active subscriptions are blocked", outlook.blocked.length === 2);
ok("each blocked row carries a code", outlook.blocked.every((b) => Boolean(b.reasonCode)));
ok("each blocked row carries the sentence for its code",
  outlook.blocked.every((b) => b.reason === BLOCKED_REASON_TEXT[b.reasonCode]));
ok("no blocked row's sentence mentions a price id",
  outlook.blocked.every((b) => !/price\s*id/i.test(b.reason)),
  outlook.blocked.map((b) => b.reason).join(" | "));
ok("the $0 row is named by company so somebody can go and fix it",
  outlook.blocked.some((b) => b.company === "Sunset Painting" && b.reasonCode === "no_plan_price"));

// ── The number that hides the fault ──────────────────────────────────────
// A $0 plan contributes $0 to blockedMrr. The banner used to print the total
// unconditionally, so a book whose ONLY blocked row was a $0 plan rendered
// "$0/mo is blocked" — a confident zero standing where the real fault was.
const onlyZero = buildRevenueOutlook([zeroPriced, sub({ company: { name: "Northshore Floors" } })], now);
ok("a $0-plan-only book reports $0 blocked MRR", onlyZero.blockedMrr === 0);
ok("  ^ and still reports the blocked ROW, which is the part that is true",
  onlyZero.blocked.length === 1 && onlyZero.blocked[0].reasonCode === "no_plan_price");

/* ══ 4. The dashboard renders it, and no longer says the false thing ══════ */

section("app/platform/page.js");

const page = codeOnly(read("app/platform/page.js"));

ok("the banner no longer blames plans with no Stripe price",
  !/no Stripe price/i.test(page),
  (page.match(/.{0,60}no Stripe price.{0,60}/i) || [""])[0]);
ok("…and no longer tells the reader to add prices in Stripe",
  !/Add the prices and this becomes/i.test(page));

// The scoped positive: the breakdown is computed by revenueOutlook and was
// never read by anything. A total with no breakdown is the half that costs an
// afternoon, so assert the list reaches the screen.
ok("the blocked list is rendered, not just its total",
  /outlook\.blocked\.map\(/.test(page),
  "outlook.blocked is computed and must be shown");
ok("…and each row shows the reason that came with it",
  /\bb\.reason\b/.test(page));
ok("the banner fires on ANY blocked row, not only when nothing is collectable",
  /outlook\?\.blocked\?\.length\s*>\s*0/.test(page),
  "a single blocked subscription printed no banner at all before");
// The zero it must not print.
ok("the blocked-MRR line is conditional on there being money to name",
  /blockedMrr\s*>\s*0/.test(page));

/* ══ 5. Nothing else in the console re-states the old reasoning ═══════════ */

section("No second opinion anywhere in app/platform");

const offenders = [];
function walk(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return;
  for (const name of fs.readdirSync(full)) {
    if (name.startsWith(".")) continue;
    const child = path.join(full, name);
    if (fs.statSync(child).isDirectory()) walk(path.relative(ROOT, child));
    else if (name.endsWith(".js")) {
      const src = codeOnly(fs.readFileSync(child, "utf8"));
      // "checkout will fail" and "no Stripe price" are the two sentences the
      // pricing-page fix already removed once. They came back here.
      if (/no Stripe price\b|No Stripe price ID/i.test(src)) {
        offenders.push(path.relative(ROOT, child));
      }
    }
  }
}
walk("app/platform");
walk("app/components/platform");
ok("no platform screen claims a plan has no Stripe price", offenders.length === 0, offenders.join(", "));

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
