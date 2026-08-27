// scripts/check-platform-pricing-console.mjs
//
// The superadmin pricing console: the two validators behind it, and the
// promise that nothing an operator sets is quietly reverted.
//
//   npm run check:pricing-console
//
// ── The dead control this exists to keep dead ──────────────────────────────
//
// /platform/billing/plans has always had a working price editor. The seat
// upgrade route then did
//
//     db.plan.upsert({ update: { priceMonthly: calculatePricing(n).monthlyTotal } })
//
// so any price an operator typed was written back to the constant by the next
// stranger who signed up at that headcount. The editor saved, re-rendered with
// the new number, and was undone hours later by somebody else's action — which
// is worse than a button that does nothing, because it works long enough to be
// believed.
//
// Two things now have to hold, and neither is provable by reading:
//
//   1. Nothing on the write path re-asserts calculatePricing() over an
//      existing row. Checked as source text, because the bug WAS a source
//      shape, and executing it needs a database.
//   2. The seeder does not re-assert SEAT_LADDER over an existing row either
//      — same bug, second costume.
//
// ── And the promotion rules ────────────────────────────────────────────────
//
// endsAt required, a past endsAt refused on create, zero-month duration
// refused. All three are enforced on the SERVER, so they are executed here
// against the same module the route calls rather than against the form.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parsePlanFields } from "@/lib/billing/planFields";
import { parsePromotionFields } from "@/lib/billing/promotionFields";
import { promotionStatus } from "@/lib/pricing/promotionStatus";
import { promotionIsLive, priceFor, SEAT_LADDER } from "@/lib/pricing/ladder";

let pass = 0;
const fails = [];
const ok = (label, fn) => {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${label}`);
  } catch (err) {
    fails.push(`${label} — ${err.message}`);
  }
};

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

/**
 * Source with comments removed.
 *
 * Needed because the files being checked EXPLAIN the bug they no longer have,
 * at length — "the update clause is where the price got clobbered" is a
 * sentence containing the word this check greps for. Two assertions failed on
 * their own documentation before this existed, which is the classic way a
 * source-text check becomes a check on prose.
 */
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

const NOW = new Date("2026-08-27T12:00:00Z");
const future = (days) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
const past = (days) => future(-days);

/* ── 1. Nothing overwrites an operator's price ───────────────────────────── */

console.log("\nAn operator's price is not written back over");

ok("no route upserts a Plan with a calculated price in its update clause", () => {
  const files = [
    "app/api/platform/billing/checkout/route.js",
    "app/api/companies/route.js",
  ];
  for (const f of files) {
    const src = code(f);
    assert.ok(
      !/plan\.upsert/.test(src),
      `${f} still calls plan.upsert — the update clause is where the price got clobbered`,
    );
  }
});

ok("both call sites share one find-or-create helper", () => {
  for (const f of [
    "app/api/platform/billing/checkout/route.js",
    "app/api/companies/route.js",
  ]) {
    assert.match(
      code(f),
      /findOrCreateCustomPlan/,
      `${f} does not use the shared helper`,
    );
  }
});

ok("the helper creates but never updates an existing row", () => {
  const src = code("lib/billing/customPlan.js");
  assert.match(src, /findFirst/, "it should look before it creates");
  assert.ok(
    !/plan\.update\(|plan\.upsert\(/.test(src),
    "the helper must not write to a row that already exists",
  );
});

ok("a bespoke Custom plan is not offered in the company-facing picker", () => {
  // isPublic defaulted true, which put a rate negotiated with one company into
  // every company's plan list with a live Choose plan button.
  assert.match(code("lib/billing/customPlan.js"), /isPublic:\s*false/);
});

ok("the seeder does not re-assert SEAT_LADDER over an existing row", () => {
  const src = code("scripts/seed-seat-ladder.mjs");
  assert.ok(
    !/plan\.upsert\(|plan\.update\(|updateMany/.test(src),
    "a seeder that updates is a seeder that reverts the editor",
  );
  assert.match(src, /findUnique/, "it should look before it creates");
});

ok("the seeder deletes nothing", () => {
  const src = code("scripts/seed-seat-ladder.mjs");
  assert.ok(!/\.delete\(|deleteMany/.test(src), "found a delete call");
});

/* ── 2. Plan field validation, on both verbs ─────────────────────────────── */

console.log("\nThe price field, against what QA actually typed");

ok("-5 is refused", () => {
  const { error } = parsePlanFields({ name: "X", priceMonthly: -5 });
  assert.match(error, /negative/);
});

ok("-5 is refused on EDIT too, which is one extra click", () => {
  const { error } = parsePlanFields({ priceMonthly: -5 }, { partial: true });
  assert.match(error, /negative/);
});

ok("a misplaced decimal is refused", () => {
  const { error } = parsePlanFields({ name: "X", priceMonthly: 129000 });
  assert.match(error, /typo/);
});

ok("not-a-number is refused", () => {
  const { error } = parsePlanFields({ name: "X", priceMonthly: "abc" });
  assert.match(error, /number/);
});

ok("a nameless plan is refused", () => {
  assert.ok(parsePlanFields({ name: "   ", priceMonthly: 1 }).error);
});

ok("a valid plan parses", () => {
  const { data, error } = parsePlanFields({
    name: " Solo (CAD) ",
    priceMonthly: "129",
    seats: 1,
    crewSeats: 5,
  });
  assert.equal(error, undefined);
  assert.deepEqual(data, {
    name: "Solo (CAD)",
    priceMonthly: 129,
    seats: 1,
    crewSeats: 5,
  });
});

console.log("\nPATCH leaves alone what it was not sent");

ok("a one-field edit produces a one-field update", () => {
  const { data } = parsePlanFields({ priceMonthly: 149 }, { partial: true });
  assert.deepEqual(Object.keys(data), ["priceMonthly"]);
});

ok("an absent name does not blank the name", () => {
  const { data, error } = parsePlanFields({ seats: 3 }, { partial: true });
  assert.equal(error, undefined);
  assert.ok(!("name" in data));
});

ok("tierKey and currency are never writable — they are the row's identity", () => {
  const { data } = parsePlanFields(
    { tierKey: "Solo", currency: "GBP", priceMonthly: 1 },
    { partial: true },
  );
  assert.ok(!("tierKey" in data));
  assert.ok(!("currency" in data));
});

console.log("\nSeats, crew and the annual price");

ok("zero seats is refused — nobody could write a quote", () => {
  assert.ok(parsePlanFields({ seats: 0 }, { partial: true }).error);
});

ok("1.5 seats is refused", () => {
  assert.ok(parsePlanFields({ seats: 1.5 }, { partial: true }).error);
});

ok("zero crew is fine — a tier may include none", () => {
  const { data, error } = parsePlanFields({ crewSeats: 0 }, { partial: true });
  assert.equal(error, undefined);
  assert.equal(data.crewSeats, 0);
});

ok("a blank annual price is null, not zero", () => {
  // "no annual option" and "an annual plan costing nothing" are different
  // products, and only one of them is a mistake.
  const { data } = parsePlanFields({ priceAnnual: "" }, { partial: true });
  assert.equal(data.priceAnnual, null);
});

ok("a negative annual price is refused", () => {
  assert.ok(parsePlanFields({ priceAnnual: -1 }, { partial: true }).error);
});

/* ── 3. Promotions ───────────────────────────────────────────────────────── */

console.log("\nA promotion must end, and the server is what says so");

const good = {
  label: "30% off for 3 months",
  discountKind: "percent",
  discountValue: 30,
  durationMonths: 3,
  endsAt: future(30),
};

ok("a blank end date is refused on create", () => {
  const { error } = parsePromotionFields({ ...good, endsAt: "" }, { now: NOW });
  assert.match(error, /end date is required/i);
});

ok("a missing end date is refused on create", () => {
  const { endsAt, ...noEnd } = good;
  assert.ok(parsePromotionFields(noEnd, { now: NOW }).error);
});

ok("null is refused, not stored", () => {
  assert.ok(
    parsePromotionFields({ ...good, endsAt: null }, { now: NOW }).error,
  );
});

ok("a junk end date is refused", () => {
  const { error } = parsePromotionFields(
    { ...good, endsAt: "soon" },
    { now: NOW },
  );
  assert.match(error, /isn't a date/);
});

ok("an end date in the past is refused on CREATE", () => {
  const { error } = parsePromotionFields(
    { ...good, endsAt: past(1) },
    { now: NOW },
  );
  assert.match(error, /already passed/);
});

ok("...and so is one landing exactly now", () => {
  assert.ok(
    parsePromotionFields({ ...good, endsAt: NOW.toISOString() }, { now: NOW })
      .error,
  );
});

ok("EDIT may keep a past end date — that is what 'over' looks like", () => {
  const existing = { endsAt: new Date(past(10)), discountKind: "percent" };
  const { error } = parsePromotionFields(
    { label: "typo fixed" },
    { partial: true, existing, now: NOW },
  );
  assert.equal(error, undefined);
});

ok("EDIT may move the end date into the past — ending it early is legitimate", () => {
  const existing = { endsAt: new Date(future(30)), discountKind: "percent" };
  const { data, error } = parsePromotionFields(
    { endsAt: past(1) },
    { partial: true, existing, now: NOW },
  );
  assert.equal(error, undefined);
  assert.ok(data.endsAt instanceof Date);
});

ok("a window that never opens is refused", () => {
  const { error } = parsePromotionFields(
    { ...good, startsAt: future(40), endsAt: future(30) },
    { now: NOW },
  );
  assert.match(error, /before the end date/);
});

console.log("\nA promotion that is really a price change is refused");

ok("zero months is refused — that is forever", () => {
  const { error } = parsePromotionFields(
    { ...good, durationMonths: 0 },
    { now: NOW },
  );
  assert.match(error, /forever/);
});

ok("100% off is refused before it can fail at checkout", () => {
  // priceFor() already refuses to render it as free because Stripe rejects a
  // zero unit_amount; saying so here means the operator finds out while typing.
  const { error } = parsePromotionFields(
    { ...good, discountValue: 100 },
    { now: NOW },
  );
  assert.match(error, /zero/);
});

ok("a zero discount is refused", () => {
  assert.ok(
    parsePromotionFields({ ...good, discountValue: 0 }, { now: NOW }).error,
  );
});

ok("an unlabelled promotion is refused", () => {
  assert.ok(parsePromotionFields({ ...good, label: "  " }, { now: NOW }).error);
});

ok("a tier that does not exist is refused", () => {
  const { error } = parsePromotionFields(
    { ...good, tierKeys: ["enterprise"] },
    { now: NOW },
  );
  assert.match(error, /isn't one of the tiers/);
});

ok("a currency FieldQuo does not price is refused", () => {
  assert.ok(
    parsePromotionFields({ ...good, currencies: ["GBP"] }, { now: NOW }).error,
  );
});

ok("an empty scope list is stored as null — 'all' has one spelling", () => {
  const { data } = parsePromotionFields(
    { ...good, tierKeys: [], currencies: [] },
    { now: NOW },
  );
  assert.equal(data.tierKeys, null);
  assert.equal(data.currencies, null);
});

ok("a real promotion parses", () => {
  const { data, error } = parsePromotionFields(
    { ...good, tierKeys: ["solo", "crew"], currencies: ["cad"], active: true },
    { now: NOW },
  );
  assert.equal(error, undefined);
  assert.deepEqual(data.tierKeys, ["solo", "crew"]);
  assert.deepEqual(data.currencies, ["CAD"]);
  assert.equal(data.active, true);
});

/* ── 4. The four states an operator has to tell apart ────────────────────── */

console.log("\nActive-but-not-started, running, expired-but-on, and off");

const base = {
  label: "x",
  discountKind: "percent",
  discountValue: 30,
  durationMonths: 3,
};

ok("running now", () => {
  const s = promotionStatus(
    { ...base, active: true, endsAt: future(10) },
    NOW,
  );
  assert.equal(s.key, "running");
});

ok("scheduled — active but not started", () => {
  const s = promotionStatus(
    { ...base, active: true, startsAt: future(5), endsAt: future(10) },
    NOW,
  );
  assert.equal(s.key, "scheduled");
});

ok("expired but still switched on is called out, not shown as off", () => {
  const s = promotionStatus({ ...base, active: true, endsAt: past(1) }, NOW);
  assert.equal(s.key, "expired");
  assert.equal(s.tone, "warning");
});

ok("switched off is off", () => {
  const s = promotionStatus({ ...base, active: false, endsAt: future(10) }, NOW);
  assert.equal(s.key, "off");
});

ok("a row with no end date is named as a fault, not folded into 'off'", () => {
  const s = promotionStatus({ ...base, active: true, endsAt: null }, NOW);
  assert.equal(s.key, "invalid");
});

ok("the badge never claims running when promotionIsLive says otherwise", () => {
  // The one invariant that matters: the label and the checkout cannot disagree.
  const rows = [
    { ...base, active: true, endsAt: future(10) },
    { ...base, active: true, endsAt: past(1) },
    { ...base, active: false, endsAt: future(10) },
    { ...base, active: true, startsAt: future(2), endsAt: future(10) },
    { ...base, active: true, endsAt: null },
    { ...base, active: true, endsAt: "rubbish" },
  ];
  for (const row of rows) {
    assert.equal(
      promotionStatus(row, NOW).key === "running",
      promotionIsLive(row, NOW),
      `disagreement on ${JSON.stringify(row)}`,
    );
  }
});

/* ── 5. The console renders priceFor's answer, not its own ───────────────── */

console.log("\nThe preview does no arithmetic of its own");

ok("the promotions page never multiplies a price", () => {
  const src = code("app/platform/billing/promotions/page.js");
  assert.match(src, /priceFor\(/, "it must call priceFor");
  // The shapes a hand-rolled discount takes. Any of them here means somebody
  // wrote the bug this page exists to prevent.
  assert.ok(
    !/discountValue\s*\/\s*100|\*\s*\(1\s*-|regular\s*-\s*value/.test(src),
    "found discount arithmetic in the renderer",
  );
});

ok("it prices the ROW, not SEAT_LADDER's default", () => {
  // The operator can change a price without a deploy; a preview built from the
  // constant would show them the number they no longer charge.
  const src = code("app/platform/billing/promotions/page.js");
  assert.match(src, /price:\s*plan\.priceMonthly/);
});

ok("priceFor on an operator-edited row uses the edited number", () => {
  const edited = { tierKey: "solo", price: "149.00" }; // Decimal arrives as a string
  const promo = {
    active: true,
    discountKind: "percent",
    discountValue: 30,
    durationMonths: 3,
    endsAt: future(10),
  };
  const p = priceFor({ tier: edited, currency: "CAD", promotion: promo, now: NOW });
  assert.equal(p.regular, 149);
  assert.equal(p.now, 104.3);
  assert.equal(p.revertsTo, 149);
  assert.notEqual(p.regular, SEAT_LADDER[0].price);
});

/* ── 6. Both mutations are audited ───────────────────────────────────────── */

console.log("\nEvery change to what we charge leaves a record");

ok("promotion create writes an audit entry", () => {
  assert.match(
    code("app/api/platform/billing/promotions/route.js"),
    /platformAuditLog\.create[\s\S]*promotion_created/,
  );
});

ok("promotion update and toggle write one too", () => {
  const src = code("app/api/platform/billing/promotions/[id]/route.js");
  assert.match(src, /platformAuditLog\.create[\s\S]*promotion_updated/);
  // A toggle is a PATCH with one key, so the same entry covers it — but the
  // log has to record whether the discount actually started or stopped, which
  // the field values alone do not say.
  assert.match(src, /promotionIsLive/);
});

ok("both promotion routes are platform-gated", () => {
  for (const f of [
    "app/api/platform/billing/promotions/route.js",
    "app/api/platform/billing/promotions/[id]/route.js",
  ]) {
    const src = code(f);
    assert.match(src, /getCurrentPlatformAdmin/, `${f} has no session check`);
    assert.match(
      src,
      /requirePlatformPermission\(admin\.role, "plan:manage"\)/,
      `${f} has no permission check`,
    );
  }
});

ok("there is no DELETE — a promotion is why an old invoice was cheap", () => {
  assert.ok(
    !/export async function DELETE/.test(
      code("app/api/platform/billing/promotions/[id]/route.js"),
    ),
  );
});

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
