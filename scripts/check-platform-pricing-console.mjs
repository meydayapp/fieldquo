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
import {
  isSellable,
  isSellableAnnually,
  isRetired,
  planStatus,
  partitionPlans,
  withheldReasons,
  RETIRED_PLAN_ERROR,
} from "@/lib/platform/sellablePlans";
import { resumeDecision } from "@/lib/billing/resume";

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

ok("neither signup nor a seat upgrade mints a plan from a headcount any more", () => {
  // The owner's ruling, 2026-08-31: "we have 4 models starting at $99" — the
  // seat ladder (lib/pricing/ladder.js: Solo/Crew/Shop/Scale) is THE pricing.
  // What used to happen here was findOrCreateCustomPlan(calculatePricing(n)) —
  // exactly the $45/licence model that got retired. Both routes now require a
  // real planId; there is no code path left that manufactures a Plan row from
  // a number a visitor typed. See docs/PRICING-CLEANUP.md.
  for (const f of [
    "app/api/platform/billing/checkout/route.js",
    "app/api/companies/route.js",
  ]) {
    const src = code(f);
    assert.ok(
      !/calculatePricing/.test(src),
      `${f} still calls calculatePricing`,
    );
    assert.ok(
      !/findOrCreateCustomPlan/.test(src),
      `${f} still mints a Custom plan from a headcount`,
    );
    assert.match(src, /planId/, `${f} should still resolve a plan by id`);
  }
});

ok("the per-licence pricing model is gone, not just unused", () => {
  const src = code("lib/pricing.js");
  assert.ok(!/calculatePricing/.test(src), "calculatePricing() should be removed");
  assert.ok(!/perLicense/.test(src), "perLicense should be removed");
  assert.ok(
    !/\b45\b/.test(src),
    "the $45/licence figure should be gone from lib/pricing.js",
  );
  assert.ok(
    !/NAMED_TIERS/.test(src),
    "NAMED_TIERS (the old 1/10/20-employee cards) should be removed",
  );
});

ok("the find-or-create-a-custom-plan helper never prices from a headcount", () => {
  // The old helper existed for exactly one job — minting a "Custom (N
  // employees)" Plan from calculatePricing() output — and that job no
  // longer exists; it was deleted. The file is back under the same name
  // (2026-09-18) for a different job: the fifth rung, a SEAT COUNT priced
  // from the Scale row through customTier() in lib/pricing/ladder.js. What
  // must stay gone is the headcount price: no calculatePricing, no
  // employeeCount, no per-licence rate — and the browser's number is a seat
  // count the server ranges, never an amount.
  const src = code("lib/billing/customPlan.js");
  assert.ok(!/calculatePricing|employeeCount|perLicense|licence/i.test(src.replace(/\/\/.*$/gm, "")), "customPlan.js prices from a headcount again");
  assert.match(src, /customTier\(n, \{ base: scale \}\)/, "the row is priced through the ladder's customTier from the Scale row");
  assert.match(src, /where: \{ tierKey_currency: \{ tierKey: tier\.tierKey, currency \} \}/, "found-or-created on the (tierKey, currency) unique");
  assert.match(src, /isPublic: false/, "a custom size is off the menu");
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

/* ── A plan born in this console is private until somebody says otherwise ──
 *
 * Plan.isPublic defaults to TRUE in the schema, and parsePlanFields only
 * writes the column when the key is present in the body. The console's New
 * Plan form never sent it — so every plan an operator created was published to
 * /pricing and the company-facing picker, with no control on the form to say
 * otherwise. A rate negotiated with one company was advertised to all of them.
 *
 * lib/billing/customPlan.js used to set isPublic: false whenever it minted a
 * bespoke row automatically. That went with the file when the per-licence
 * model was retired, and it had never covered this path anyway.
 *
 * The default is FALSE rather than true because a ladder tier cannot be
 * created here — tierKey is display-only on this form, and the four public
 * tiers come from scripts/seed-seat-ladder.mjs, which sets tierKey and
 * isPublic: true explicitly. Every row born on this screen is tierKey-less,
 * which is what bespoke means.
 */
console.log("\nA negotiated rate is not advertised to everybody\n");

const CONSOLE_FORM = "app/platform/billing/plans/page.js";

// A sellable ladder row, so the isPublic assertion below isolates that one
// field rather than tripping over a missing price or a null currency.
const LADDER_ROW = {
  id: "plan_solo_cad",
  name: "Solo",
  tierKey: "solo",
  currency: "CAD",
  priceMonthly: 99,
  seats: 1,
  crewSeats: 5,
  isPublic: true,
};

ok("the New Plan draft starts PRIVATE", () => {
  const src = code(CONSOLE_FORM);
  const blank = src.slice(src.indexOf("const BLANK"), src.indexOf("const BLANK") + 600);
  assert.match(
    blank,
    /isPublic:\s*false/,
    "BLANK must set isPublic: false — omitting it takes the schema default, which is true",
  );
});

ok("...and an edit carries the row's own value rather than that default", () => {
  const src = code(CONSOLE_FORM);
  const fn = src.slice(src.indexOf("function edit("));
  assert.match(
    fn.slice(0, fn.indexOf("}")),
    /isPublic:\s*p\.isPublic/,
    "editing a plan must not silently re-publish one somebody made private",
  );
});

ok("the payload sends isPublic every time, not conditionally", () => {
  const src = code(CONSOLE_FORM);
  const payload = src.slice(src.indexOf("const payload = {"));
  assert.match(
    payload.slice(0, payload.indexOf("};")),
    /isPublic:\s*!!draft\.isPublic/,
    "parsePlanFields only writes the column when the KEY is present, so an " +
      "omitted field silently takes the default on create and silently keeps " +
      "the old value on edit",
  );
});

ok("there is a real control bound to it, not just a field in the payload", () => {
  const src = code(CONSOLE_FORM);
  assert.match(src, /checked=\{!!draft\.isPublic\}/, "no checkbox reads draft.isPublic");
  assert.match(
    src,
    /setDraft\(\{ \.\.\.draft, isPublic: e\.target\.checked \}\)/,
    "the checkbox does not write back to the draft",
  );
});

ok("parsePlanFields still only writes the column when the key is sent", () => {
  // The coupling the payload assertion above depends on. If this ever becomes
  // unconditional, sending the field stops being load-bearing — and the next
  // person to drop it from the payload would reintroduce the bug silently.
  assert.match(
    code("lib/billing/planFields.js"),
    /has\("isPublic"\)/,
    "planFields no longer gates isPublic on key presence",
  );
});

ok("a private plan is refused by the company-facing picker", () => {
  // The behaviour the whole thing exists to protect, asserted on the real
  // function rather than on the form's source.
  assert.equal(isSellable({ ...LADDER_ROW, isPublic: false }), false);
  assert.equal(isSellable({ ...LADDER_ROW, isPublic: true }), true);
});

/* ── 7. A retired plan is sold by nobody, listed or by link ────────────────
 *
 * isPublic: false only takes a plan off the MENU. /api/marketing/plans hands
 * an unlisted plan to anyone holding a link with its id (the bespoke-rate
 * hand-off), and /api/companies and the change-plan checkout accept any plan
 * that exists — so the owner's private "Live test — $1" was a working $1
 * signup for anyone with the link. It could not be deleted: Test Inc.'s
 * subscription references it, and this codebase never deletes.
 *
 * Plan.retiredAt is the third state: kept for its subscribers, sold to
 * nobody. The predicate is executed here against real shapes — a Date, an
 * ISO string (a JSON round-trip), null, and an omitted column — and then
 * every path that sells or switches to a plan is read to prove it asks that
 * predicate before it sells. The grep half is the weaker half and says so;
 * the backstop in recurringLine is what makes a forgotten route fail loudly
 * rather than sell.
 */
console.log("\nA retired plan is kept for its subscribers and sold to nobody\n");

const RETIRED_ROW = { ...LADDER_ROW, retiredAt: new Date("2026-09-14T12:00:00Z") };

ok("retiredAt set (a Date) → retired, and not sellable on either cadence", () => {
  assert.equal(isRetired(RETIRED_ROW), true);
  assert.equal(isSellable(RETIRED_ROW), false);
  assert.equal(isSellableAnnually({ ...RETIRED_ROW, priceAnnual: 1188 }), false);
});

ok("retiredAt as an ISO string (JSON round-trip) is still retired", () => {
  assert.equal(isRetired({ ...LADDER_ROW, retiredAt: "2026-09-14T12:00:00.000Z" }), true);
  assert.equal(isSellable({ ...LADDER_ROW, retiredAt: "2026-09-14T12:00:00.000Z" }), false);
});

ok("retired beats public: isPublic true does not put a retired plan back on sale", () => {
  assert.equal(isSellable({ ...RETIRED_ROW, isPublic: true }), false);
});

ok("un-retire restores: retiredAt null is exactly the plan it was", () => {
  const back = { ...RETIRED_ROW, retiredAt: null };
  assert.equal(isRetired(back), false);
  assert.equal(isSellable(back), isSellable(LADDER_ROW));
  assert.equal(planStatus(back).code, planStatus(LADDER_ROW).code);
});

ok("a row read without the column is NOT retired (so every narrow select must include it)", () => {
  const { retiredAt, ...narrow } = RETIRED_ROW;
  assert.equal(isRetired(narrow), false);
});

ok("the status line says retired, once, above the price fault", () => {
  const s = planStatus({ ...RETIRED_ROW, priceMonthly: 0 });
  assert.equal(s.code, "retired");
  assert.equal(s.tone, "note");
  assert.match(s.text, /Retired/);
  assert.ok(!/price id/i.test(s.text));
});

ok("partitionPlans withholds it and the outage alert names the reason", () => {
  const { sellable, withheld } = partitionPlans([LADDER_ROW, RETIRED_ROW]);
  assert.deepEqual(sellable, [LADDER_ROW]);
  assert.deepEqual(withheld, [RETIRED_ROW]);
  assert.deepEqual(withheldReasons(withheld), [{ name: RETIRED_ROW.name, reason: "retired" }]);
});

ok("the refusal sentence exists once and says 'no longer offered'", () => {
  assert.match(RETIRED_PLAN_ERROR, /no longer offered/);
});

// ── The sell paths, each read for the call ────────────────────────────────
//
// Each assertion is scoped to the file and to the shape "isRetired(plan)
// guards a 409" rather than "the file mentions isRetired", because the file
// header comments already mention it. Comments are stripped by code().

const SELL_PATHS = [
  {
    file: "app/api/companies/route.js",
    what: "signup refuses a retired plan with 409 before any company row exists",
    guard: /if \(isRetired\(plan\)\)[\s\S]{0,200}RETIRED_PLAN_ERROR[\s\S]{0,80}status: 409/,
    // Must come BEFORE the transaction that creates the company.
    before: "$transaction",
  },
  {
    file: "app/api/platform/billing/checkout/route.js",
    what: "the change-plan checkout refuses a retired target with 409",
    guard: /if \(isRetired\(plan\)\)[\s\S]{0,200}RETIRED_PLAN_ERROR[\s\S]{0,80}status: 409/,
    // Before Checkout, changeSubscriptionPlan and schedulePlanChange alike.
    before: "classifyPlanChange({",
  },
];

for (const p of SELL_PATHS) {
  ok(p.what, () => {
    const src = code(p.file);
    const m = src.match(p.guard);
    assert.ok(m, `${p.file}: no isRetired(plan) → 409 RETIRED_PLAN_ERROR guard`);
    const at = src.indexOf(m[0]);
    const later = src.indexOf(p.before);
    assert.ok(later > at, `${p.file}: the guard sits after ${p.before}`);
  });
}

ok("the marketing route's link branch refuses a retired plan and says why", () => {
  const src = code("app/api/marketing/plans/route.js");
  assert.match(src, /retiredAt: true/, "the narrow select omits retiredAt — a retired plan would read as not retired");
  assert.match(src, /isRetired\(wanted\)/, "the ?plan= branch does not test isRetired");
  assert.match(src, /wantedPlanId && !refused/, "the unlisted hand-off is not gated on the refusal");
  assert.match(src, /refused,?\s*\}\)/, "the refusal is not returned to the signup page");
  assert.ok(!/isPublic,\s*\.\.\.plan\s*\}\)\s*=>\s*plan\)/.test(src) || /retiredAt/.test(src.slice(src.indexOf("publicShape"))), "retiredAt leaks in the public payload");
});

ok("the signup page reads the refusal and says the plan is no longer offered", () => {
  const src = code("app/signup/page.js");
  assert.match(src, /setRefusedPlan\(data\?\.refused/);
  assert.match(src, /refusedPlan\?\.reason === "retired"/);
  assert.match(src, /"app\.signup\.plan\.retired"/);
});

ok("the company-facing picker excludes retired plans in the WHERE, keeping the company's own", () => {
  const src = code("app/api/settings/plans/route.js");
  assert.match(src, /\{ isPublic: true, retiredAt: null,/);
  assert.match(src, /\{ id: subscription\.planId \}/);
});

ok("the sales knowledge base selects retiredAt so the sales line cannot read a retired plan out", () => {
  assert.match(code("lib/platform/salesKnowledge.js"), /retiredAt: true/);
});

ok("the pricing page reads whole rows (no narrow select to forget the column in)", () => {
  const src = code("app/(marketing)/pricing/page.js");
  assert.match(src, /db\.plan\.findMany\(\{ orderBy: \{ priceMonthly: "asc" \} \}\)/);
  assert.match(src, /partitionPlans\(allPlans\)/);
});

ok("recurringLine — every Stripe line that sells a plan — throws on a retired one", () => {
  const src = code("lib/platform/stripeBilling.js");
  const fn = src.slice(src.indexOf("function recurringLine("));
  const body = fn.slice(0, fn.indexOf("return {"));
  assert.match(body, /if \(isRetired\(plan\)\)\s*\{\s*throw new Error/);
  // …and every builder goes through it.
  for (const builder of ["createTrialCheckoutSession", "createBillingCheckoutSession", "changeSubscriptionPlan", "schedulePlanChange"]) {
    const b = src.slice(src.indexOf(`export async function ${builder}(`));
    const end = b.indexOf("\nexport ");
    // Through subscriptionLines, which builds every base line with recurringLine.
    assert.match(b.slice(0, end > 0 ? end : undefined), /subscriptionLines\(\{/, `${builder} does not build its line through subscriptionLines`);
  }
});

// ── Resume, executed ──────────────────────────────────────────────────────
//
// Uncancel is an existing subscription continuing and stays. Everything else
// Resume can do creates a NEW Stripe subscription on the plan, which is a
// sale of it, and none of those is offered on a retired plan.
ok("resume: an ending subscription on a retired plan can still be un-cancelled", () => {
  assert.deepEqual(resumeDecision({ status: "active", cancelAtPeriodEnd: true, planRetired: true }), { mode: "uncancel" });
});

ok("resume: cancelled on a retired plan → retired, never credited / charge_now / checkout", () => {
  const now = new Date("2026-09-14T08:00:00Z");
  const end = new Date("2026-10-14T12:26:43Z");
  for (const s of [
    { status: "canceled", currentPeriodEnd: end, canceledAt: now, hasPaymentMethod: true },
    { status: "canceled", currentPeriodEnd: end, canceledAt: now, hasPaymentMethod: false },
    { status: "canceled", currentPeriodEnd: new Date("2026-09-01T00:00:00Z"), canceledAt: now, hasPaymentMethod: true },
    { status: null },
  ]) {
    const d = resumeDecision({ ...s, planRetired: true, now });
    assert.equal(d.mode, "retired", JSON.stringify(s));
    assert.equal(d.reason, "plan_retired");
  }
});

ok("resume: the same states with the plan on sale keep their old answers", () => {
  const now = new Date("2026-09-14T08:00:00Z");
  const end = new Date("2026-10-14T12:26:43Z");
  assert.equal(resumeDecision({ status: "canceled", currentPeriodEnd: end, canceledAt: now, hasPaymentMethod: true, now }).mode, "credited");
  assert.equal(resumeDecision({ status: "canceled", currentPeriodEnd: end, canceledAt: now, hasPaymentMethod: false, now }).mode, "checkout");
  assert.equal(resumeDecision({ status: null, now }).mode, "checkout");
});

ok("resume: the route answers 409, the checkout fallback answers null, the button draws nothing", () => {
  const lib = code("lib/billing/resume.js");
  assert.match(lib, /planRetired: isRetired\(row\.plan\)/, "loadResumeState does not pass planRetired");
  assert.match(lib, /isRetired\(row\?\.plan\) \? RETIRED/, "the two early exits still answer checkout");
  const fallback = lib.slice(lib.indexOf("export async function resumeViaCheckout("));
  assert.match(fallback.slice(0, fallback.indexOf("createBillingCheckoutSession(")), /if \(isRetired\(row\.plan\)\) return null;/);
  assert.match(lib, /decision\.mode === "retired"[\s\S]{0,200}retired: true/);
  const route = code("app/api/platform/billing/resume/route.js");
  assert.match(route, /if \(result\.retired\)[\s\S]{0,120}status: 409/);
  const button = code("app/components/billing/ResumePlanButton.js");
  assert.match(button, /case "retired":\s*default:\s*return null;/);
});

// ── The console: badge, action, audit, script ─────────────────────────────
ok("the console derives its Retired badge from isRetired and offers Retire / Un-retire to a superadmin only", () => {
  const src = code(CONSOLE_FORM);
  assert.match(src, /const retired = isRetired\(p\);/);
  assert.match(src, /Retired\s*<\/span>/);
  assert.match(src, /const canRetire = isSuperadmin;/);
  assert.match(src, /\{canRetire && \([\s\S]{0,600}onRetire\(!retired\)/);
  assert.match(src, /\{retired \? "Un-retire" : "Retire"\}/);
  assert.match(src, /\/api\/platform\/billing\/plans\/\$\{plan\.id\}\/retire/);
});

ok("the retire route is superadmin-only, writes retiredAt and its audit row in one transaction", () => {
  const src = code("app/api/platform/billing/plans/[id]/retire/route.js");
  assert.match(src, /admin\.role !== "superadmin"/);
  assert.match(src, /\$transaction\(\[[\s\S]*retiredAt: body\.retired \? now : null[\s\S]*platformAuditLog\.create[\s\S]*"plan_retired" : "plan_unretired"/);
  assert.ok(!/plan\.delete|subscription\.(update|delete)/.test(src), "the retire route touches a subscription or deletes");
});

ok("both audit actions have wording", () => {
  const src = code("lib/platform/auditActions.js");
  assert.match(src, /plan_retired:/);
  assert.match(src, /plan_unretired:/);
});

ok("the editor cannot set retiredAt through PATCH — it is an action, not a field", () => {
  assert.ok(!/retiredAt/.test(code("lib/billing/planFields.js")));
});

ok("scripts/retire-plan.mjs is dry-run by default, writes only on --yes, and deletes nothing", () => {
  const src = code("scripts/retire-plan.mjs");
  assert.match(src, /const write = args\.includes\("--yes"\);/);
  assert.match(src, /if \(!write\) \{[\s\S]{0,400}Dry run/);
  assert.match(src, /retiredAt: unretire \? null : now/);
  assert.match(src, /platformAuditLog\.create/);
  assert.ok(!/\.delete\(|deleteMany|subscription\.update/.test(src));
});

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
