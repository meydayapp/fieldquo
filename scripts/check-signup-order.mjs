// scripts/check-signup-order.mjs
//
// The signup funnel's order, its resume rules, and the two things that must
// never be guessed inside it: which currency a visitor is priced in, and how
// often they are charged.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-signup-order.mjs
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The plan step used to be FIRST. The address — and therefore the country — is
// collected after it, and the form seeded `country: "CA"`, so a contractor in
// Texas was shown Canadian prices before anyone asked where he was, and
// /api/companies defaulted him to Canada a second time on the way out. Moving
// the step to the end fixes that and inverts the guard that decided where a
// returning visitor lands: `if (!hasSelection) return "plan"` was correct while
// every later step priced off the selection, and is nonsense once nothing does.
//
// The funnel logic is pure (lib/signup/funnel.js) and so is the cadence
// arithmetic (lib/billing/interval.js), so this file EXECUTES both across the
// whole state matrix rather than reading them. The matrix is the point: the
// interesting cases are a visitor mid-signup when this deploys, whose draft
// says "plan" meaning the beginning, and a plan step reached with no country
// at all.
//
// The last section is a text scan over the three files that consume this
// logic. A text scan proves only that the call is present, never that the
// screen behaves — but every failure it looks for is one where the pure
// functions were right and nothing called them.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  STEPS,
  firstStep,
  furthestStep,
  resumeStep,
  previousStep,
  nextStep,
  billingBasis,
} from "../lib/signup/funnel.js";
import {
  BILLING_INTERVALS,
  DEFAULT_INTERVAL,
  isBillingInterval,
  annualPriceOf,
  annualSaving,
  chargeFor,
  supportsInterval,
} from "../lib/billing/interval.js";
import { SEAT_LADDER } from "../lib/pricing/ladder.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * The file with its comments removed.
 *
 * Needed because this codebase explains itself: the comment above the fix
 * QUOTES the literal the fix removed — `String(country || "CA")`,
 * `recurring: { interval: "month" }` — and a scan for those strings finds the
 * explanation and reports the bug as still present. Block comments and
 * whole-line `//` comments go; a `//` inside a string literal stays, which is
 * why only whole-line ones are stripped.
 */
const codeOf = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");

let failures = 0;
let checks = 0;

function ok(label, passed, detail = "") {
  checks++;
  if (passed) {
    console.log(`  ok    ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? `\n          ${detail}` : ""}`);
  }
}

const eq = (label, actual, expected) =>
  ok(label, actual === expected, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);

/* ── 1. The order ───────────────────────────────────────────────────────── */

console.log("\nThe order: plan is LAST, because it prices off the address");

eq(
  "STEPS is account → business → industry → services → plan",
  STEPS.join(" > "),
  "account > business > industry > services > plan",
);
eq("the plan step is last", STEPS[STEPS.length - 1], "plan");
ok(
  "the plan step comes after the steps that collect the address",
  STEPS.indexOf("plan") > STEPS.indexOf("account") &&
    STEPS.indexOf("plan") > STEPS.indexOf("business"),
);
eq("a signed-out visitor starts on account", firstStep({ accountExists: false }), "account");
eq("a signed-in one starts on business", firstStep({ accountExists: true }), "business");

// Walking forward from the start reaches the plan step and stops there.
{
  const walked = [];
  let at = firstStep({ accountExists: false });
  while (at && walked.length < 10) {
    walked.push(at);
    at = nextStep(at, { accountExists: false });
  }
  eq(
    "walking nextStep from the start ends at the plan step",
    walked.join(" > "),
    "account > industry > services > plan",
  );
}
// And Back walks the same path in reverse, never off the end of the funnel.
{
  const walked = [];
  let at = "plan";
  while (at && walked.length < 10) {
    walked.push(at);
    at = previousStep(at, { accountExists: true });
  }
  eq(
    "previousStep from the plan step walks back to the entry and stops",
    walked.join(" > "),
    "plan > services > industry > business",
  );
  eq(
    "the entry step has nothing behind it — Back must not leave the funnel",
    previousStep("business", { accountExists: true }),
    null,
  );
}

/* ── 2. resumeStep across the whole state matrix ─────────────────────────── */

console.log("\nresumeStep: never past what the state supports, never past the draft");

const ALL_STATES = [];
for (const accountExists of [false, true])
  for (const companyReady of [false, true])
    for (const hasIndustries of [false, true])
      for (const hasServices of [false, true])
        ALL_STATES.push({ accountExists, companyReady, hasIndustries, hasServices });

const RANK = { account: 0, business: 0, industry: 1, services: 2, plan: 3 };
const SAVED_VALUES = [...STEPS, undefined, null, "", "wat", "PLAN", 7];

// ── The named cases, spelled out ──────────────────────────────────────────

const NOBODY = { accountExists: false, companyReady: false, hasIndustries: false, hasServices: false };
const SIGNED_IN = { ...NOBODY, accountExists: true };
const WITH_COMPANY = { ...SIGNED_IN, companyReady: true };
const WITH_TRADES = { ...WITH_COMPANY, hasIndustries: true };
const READY_TO_PAY = { ...WITH_TRADES, hasServices: true };

eq("no draft at all → the first step", resumeStep(undefined, NOBODY), "account");
eq("a step name we don't recognise → the first step", resumeStep("wat", NOBODY), "account");
eq(
  "an unrecognised step for a signed-in visitor → their first step, not 'account'",
  resumeStep("wat", SIGNED_IN),
  "business",
);
eq(
  "a draft saved on 'account' by someone who now HAS an account → business",
  resumeStep("account", WITH_COMPANY),
  "business",
);
eq(
  "a draft saved on 'business' by someone with no session → account",
  resumeStep("business", NOBODY),
  "account",
);
eq(
  "signed in, company not filled in yet → business (not industry)",
  resumeStep("industry", SIGNED_IN),
  "business",
);
eq("mid-draft on industry, with the state for it → industry", resumeStep("industry", WITH_COMPANY), "industry");
eq(
  "mid-draft on services with no trades picked → back to industry, one click away",
  resumeStep("services", WITH_COMPANY),
  "industry",
);
eq(
  "mid-draft on the plan step with no services picked → services",
  resumeStep("plan", WITH_TRADES),
  "services",
);
eq("everything filled in, draft says plan → plan", resumeStep("plan", READY_TO_PAY), "plan");
eq(
  "everything filled in but the draft says industry → industry, not skipped ahead",
  resumeStep("industry", READY_TO_PAY),
  "industry",
);

// ── The incident the old doc comment recorded ─────────────────────────────
//
// An unauthenticated visitor restored straight into a late step reached
// "Continue to Payment" with no session and got a bare 401 from /api/companies
// with nothing on screen explaining why.
for (const saved of STEPS) {
  ok(
    `a signed-out visitor whose draft says "${saved}" never lands past the account step`,
    resumeStep(saved, { ...NOBODY, companyReady: true, hasIndustries: true, hasServices: true }) ===
      "account",
    `got ${resumeStep(saved, { ...NOBODY, companyReady: true, hasIndustries: true, hasServices: true })}`,
  );
}

// ── Drafts written under the OLD order ────────────────────────────────────
//
// "plan" meant the BEGINNING there. A visitor mid-signup the day this deploys
// has one of these in sessionStorage, and it must not drop them on the last
// screen of a funnel they have not walked.
console.log("\nDrafts written under the OLD order (plan first)");

eq(
  "old draft parked on 'plan' with nothing else filled in → the account step",
  resumeStep("plan", NOBODY),
  "account",
);
eq(
  "old draft on 'plan' with an account but no company → business",
  resumeStep("plan", SIGNED_IN),
  "business",
);
eq(
  "old draft on 'account' with nothing else → account, and no crash",
  resumeStep("account", NOBODY),
  "account",
);
eq(
  "old draft on 'services' (the old LAST step) with the full state → services",
  resumeStep("services", READY_TO_PAY),
  "services",
);
ok(
  "no old-order draft can land on the plan step without an account",
  ALL_STATES.filter((s) => !s.accountExists).every(
    (s) => resumeStep("plan", s) !== "plan",
  ),
);

// ── And the whole matrix at once ──────────────────────────────────────────

let matrixChecked = 0;
let matrixBad = [];
for (const state of ALL_STATES) {
  for (const saved of SAVED_VALUES) {
    matrixChecked++;
    const landed = resumeStep(saved, state);
    const limit = furthestStep(state);

    if (!STEPS.includes(landed)) {
      matrixBad.push(`${JSON.stringify(saved)} + ${JSON.stringify(state)} → ${landed} (not a step)`);
      continue;
    }
    // Never past what the state can complete.
    if (RANK[landed] > RANK[limit]) {
      matrixBad.push(`${JSON.stringify(saved)} + ${JSON.stringify(state)} → ${landed} > limit ${limit}`);
      continue;
    }
    // Never past where they actually left off.
    if (STEPS.includes(saved) && RANK[landed] > RANK[saved]) {
      matrixBad.push(`${JSON.stringify(saved)} + ${JSON.stringify(state)} → ${landed}, past the draft`);
      continue;
    }
    // Never the wrong face of the account/business rung.
    if (landed === "account" && state.accountExists) {
      matrixBad.push(`${JSON.stringify(saved)} + ${JSON.stringify(state)} → account, but they have one`);
      continue;
    }
    if (landed === "business" && !state.accountExists) {
      matrixBad.push(`${JSON.stringify(saved)} + ${JSON.stringify(state)} → business with no session`);
    }
  }
}
ok(
  `every one of the ${matrixChecked} (state × saved step) combinations lands somewhere completable`,
  matrixBad.length === 0,
  matrixBad.slice(0, 5).join("\n          "),
);

// The inverted guard, stated as an assertion so it cannot creep back: a plan
// selection is not an input to resumeStep at all any more.
ok(
  "a plan selection is no longer an input — resumeStep ignores hasSelection",
  resumeStep("services", { ...READY_TO_PAY, hasSelection: false }) ===
    resumeStep("services", { ...READY_TO_PAY, hasSelection: true }),
);

/* ── 3. A country nobody stated is not Canada ────────────────────────────── */

console.log("\nCurrency comes from the address, and absence is not CAD");

{
  const blank = billingBasis({ country: "", address: "", province: "" });
  eq("no country, no address → no country", blank.country, null);
  eq("...and therefore NO currency, not CAD", blank.planCurrency, null);

  const empty = billingBasis({});
  eq("an empty record yields no currency either", empty.planCurrency, null);

  const typed = billingBasis({ country: "US", address: "", province: "" });
  eq("a stated US → USD", typed.planCurrency, "USD");
  eq("...and says the country came from the column", typed.source, "column");

  const ca = billingBasis({ country: "CA" });
  eq("a stated CA → CAD", ca.planCurrency, "CAD");

  const fromAddress = billingBasis({
    country: "",
    address: "1039 Bank St, Ottawa, ON K1X 1H4, Canada",
    province: "",
  });
  eq("a formatted address ending in Canada → CA", fromAddress.country, "CA");
  eq("...priced in CAD", fromAddress.planCurrency, "CAD");
  eq("...and says where it read it", fromAddress.source, "address");

  const fromProvince = billingBasis({ country: "", address: "12 Main St", province: "ON" });
  eq("a Canadian province with no country → CA", fromProvince.country, "CA");

  // The trap resolveCountry anchors its patterns for.
  const buffalo = billingBasis({
    country: "",
    address: "Canada Street, Buffalo, NY, USA",
    province: "",
  });
  eq("'Canada Street, Buffalo, NY, USA' is in the United States", buffalo.country, "US");

  // Somewhere we do not price. A DIFFERENT answer from "we don't know where
  // you are" — the screen says so, and neither becomes CAD.
  const ireland = billingBasis({ country: "IE", address: "" });
  eq("a country the visitor PICKED is kept", ireland.country, "IE");
  eq("...but the ladder prices nothing there, so no currency", ireland.planCurrency, null);

  const junk = billingBasis({ country: "ZZ", address: "" });
  eq("a country code the form never offers is not believed", junk.country, null);
  eq("...and certainly not priced", junk.planCurrency, null);

  // Nothing correlates its way into an answer.
  const correlated = billingBasis({
    country: "",
    address: "12 Main St",
    province: "",
    phone: "613-555-0100",
    language: "fr",
  });
  eq("a phone number and a language do not state a country", correlated.planCurrency, null);
}

/* ── 4. The billing interval ─────────────────────────────────────────────── */

console.log("\nThe interval: annual is the cadence, not a discount");

// A seeded ladder row, exactly as scripts/seed-seat-ladder.mjs mints it.
const solo = SEAT_LADDER[0];
const LADDER_ROW = {
  id: "plan_solo_cad",
  name: `${solo.label} (CAD)`,
  tierKey: solo.tierKey,
  currency: "CAD",
  priceMonthly: solo.price,
  priceAnnual: solo.price * 12,
};
// A bespoke row, exactly as lib/billing/customPlan.js mints it: no annual.
const CUSTOM_ROW = {
  id: "plan_custom_2",
  name: "Custom (2 employees)",
  tierKey: null,
  currency: "CAD",
  priceMonthly: 90,
  priceAnnual: null,
};
// What Prisma actually hands back for a Decimal column.
const AS_STRINGS = { ...LADDER_ROW, priceMonthly: "129", priceAnnual: "1548" };

eq("the cadences on offer", BILLING_INTERVALS.join(","), "month,year");
eq("the default is the one with no commitment attached", DEFAULT_INTERVAL, "month");
ok("month and year are intervals", isBillingInterval("month") && isBillingInterval("year"));
ok(
  "nothing else is — 'week', '', null and 'MONTH' are all refused",
  !isBillingInterval("week") &&
    !isBillingInterval("") &&
    !isBillingInterval(null) &&
    !isBillingInterval("MONTH") &&
    !isBillingInterval(undefined),
);

eq("a ladder row bills CA$129 a month", chargeFor(LADDER_ROW, "month").unitAmountCents, 12900);
eq("...and CA$1,548 a year", chargeFor(LADDER_ROW, "year").unitAmountCents, 154800);
eq("the yearly line really is yearly", chargeFor(LADDER_ROW, "year").interval, "year");
eq("Prisma's Decimal-as-string prices survive the trip", chargeFor(AS_STRINGS, "year").unitAmountCents, 154800);

eq(
  "twelve months and one year cost exactly the same — no invented discount",
  annualSaving(LADDER_ROW),
  0,
);
ok(
  "every rung of the ladder is the same rate on both cadences",
  SEAT_LADDER.every(
    (tier) => annualSaving({ priceMonthly: tier.price, priceAnnual: tier.price * 12 }) === 0,
  ),
);
eq(
  "a plan with no annual price can't be compared, so no saving is claimed",
  annualSaving(CUSTOM_ROW),
  null,
);

eq("a bespoke row has no annual option", annualPriceOf(CUSTOM_ROW), null);
eq(
  "...and asking to buy it yearly is REFUSED, not downgraded to monthly",
  chargeFor(CUSTOM_ROW, "year"),
  null,
);
ok("...while monthly still works", chargeFor(CUSTOM_ROW, "month").unitAmountCents === 9000);
ok(
  "supportsInterval agrees with chargeFor on every row/cadence pair",
  [LADDER_ROW, CUSTOM_ROW, AS_STRINGS, {}, null].every((row) =>
    ["month", "year", "week"].every(
      (i) => supportsInterval(row, i) === (chargeFor(row, i) !== null),
    ),
  ),
);
eq("a zero annual price is 'no annual option', not free", annualPriceOf({ priceAnnual: 0 }), null);
eq("a blank one likewise", annualPriceOf({ priceAnnual: "" }), null);
eq("an unknown cadence buys nothing", chargeFor(LADDER_ROW, "week"), null);
eq("neither does a missing plan", chargeFor(null, "month"), null);

/* ── 5. The three files that have to actually call all this ──────────────── */
//
// A text scan. It cannot prove the screen behaves; it can prove that the
// literal each of these functions replaced has not grown back.

console.log("\nThe callers");

const page = codeOf(read("app/signup/page.js"));
const api = codeOf(read("app/api/companies/route.js"));
const billing = codeOf(read("lib/platform/stripeBilling.js"));
const marketing = read("app/api/marketing/plans/route.js");

ok(
  "the signup page takes its order and resume rules from lib/signup/funnel",
  /from "@\/lib\/signup\/funnel"/.test(page) &&
    /\bresumeStep\b/.test(page) &&
    /\bfirstStep\b/.test(page),
);
ok(
  "...and does not keep a second copy of STEPS",
  !/^const STEPS\s*=/m.test(page),
  "a local STEPS array would be the copy that rots",
);
ok(
  "every forward move on the page asks the funnel where it goes",
  /goToStep\(nextStep\(/.test(page),
  "a typed step name in a button is how a reordered funnel leaves a button behind",
);
ok(
  "...and every Back button likewise",
  /goBackToStep\(previousStep\(/.test(page),
);
ok(
  "the signup form no longer seeds country: \"CA\"",
  !/country:\s*"CA"/.test(page),
  'the seed stated a country nobody had entered, and the plan step priced off it',
);
ok(
  "the country select offers an explicit empty option",
  /<option value="">/.test(page),
  "without it the select DISPLAYS Canada while the value is empty",
);
ok(
  "the page reads the currency through billingBasis rather than assuming one",
  /billingBasis\(/.test(page),
);
ok(
  "the page posts the CADENCE and no money",
  /billingInterval:\s*effectiveInterval/.test(page) &&
    !/monthlyTotal:\s*/.test(page.split("fetch(\"/api/companies\"")[1] || ""),
  "the browser never sends an amount — the server reprices from its own rows",
);
ok(
  "nothing on the plan step claims a saving that does not exist",
  !/\bsave\s+(up to\s+)?[$\d]/i.test(page) &&
    !/\d+\s*%\s*(off|cheaper|less|saving)/i.test(page) &&
    !/best value|biggest saving/i.test(page),
  "annual is the interval, not a discount — annualSaving() is 0 on every rung, " +
    "so a badge here would be advertising something that does not exist",
);

ok(
  "/api/companies no longer defaults an absent country to CA",
  !/String\(country \|\| "CA"\)/.test(api),
);
ok(
  "...and reads it with the shared resolver instead",
  /billingBasis\(/.test(api),
);
ok(
  "...refusing rather than inventing one when nothing states it",
  /if \(!homeCountry\)/.test(api) && /status: 400/.test(api),
);
ok(
  "/api/companies validates the interval instead of coercing it",
  /isBillingInterval\(/.test(api),
);
ok(
  "...and refuses a cadence the plan has no price for",
  /chargeFor\(/.test(api) && /billed monthly only/.test(api),
);

ok(
  "stripeBilling has no hardcoded month interval left",
  !/recurring:\s*\{\s*interval:\s*"month"\s*\}/.test(billing),
  'a literal here is what would have taken a "1 year commitment" and billed monthly',
);
ok(
  "both checkout builders go through the one line builder",
  (billing.match(/recurringLine\(\{/g) || []).length >= 2,
  "an interval honoured on one path and not the other looks fixed and isn't",
);
ok(
  "the cadence rides on the Stripe session metadata",
  /billingInterval: interval/.test(billing),
  "there is no column for it on Subscription, so this is the record",
);
ok(
  "the up-front first-month line can never attach to an annual plan",
  /pricing\.trialTotal > 0 && interval === "month"/.test(billing),
);

ok(
  "the public plan list carries the currency the page filters on",
  /currency: true/.test(marketing) && /tierKey: true/.test(marketing) && /priceAnnual: true/.test(marketing),
  "without these the signup page could only show both currencies at once",
);

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
