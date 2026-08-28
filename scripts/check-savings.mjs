// scripts/check-savings.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-savings.mjs
//
// /savings prints money at a stranger, and that is a different kind of claim
// from anything else on the marketing site.
//
// ══ Why this page needs a check and /about does not ════════════════════════
//
// A wrong sentence on a marketing page is embarrassing. A wrong NUMBER on a
// savings calculator is an argument: it is the thing a contractor weighs
// against a price before handing over a card, and it is checked months later
// against his own books by somebody who has already paid us. There is no way
// to look at "13,060 a year" and see that it is wrong. So the honesty of this
// page cannot live in review; it has to be executable.
//
// What this file therefore refuses to let happen:
//
//   1. A COEFFICIENT WITH NO REASON. Every number that multiplies anything is
//      a row in ASSUMPTIONS carrying what it represents and why it is that
//      value. The builders are read as source and any numeric literal in them
//      fails — a magic number in a total is an assertion nobody can argue
//      with, and the point of the table is to be argued with.
//   2. A COEFFICIENT THAT DRIFTS UPWARD. "Conservative" is a promise that
//      decays the first time somebody wants the total to look better, so the
//      ceilings are asserted here rather than remembered. Raising the admin
//      share to 60% fails this file; it does not fail review.
//   3. A LINE ITEM FOR SOMETHING WE DO NOT SHIP. The page this one's SHAPE was
//      taken from prices two mechanisms FieldQuo does not have — change orders
//      and a QuickBooks sync. Porting the formula would have advertised both,
//      at a precise annual figure, to a buyer. Every string this page can
//      render is scanned for them, and every line item has to name files that
//      exist.
//   4. A TOTAL LARGER THAN THE BUSINESS. Held to the revenue the visitor
//      typed, and proved so against inputs chosen to break it.
//   5. AN INVENTED ANSWER. AGENTS.md failure class 5. A blank, a word, a
//      negative or an absurd number must produce NO figure and a printed
//      reason — never a default quietly substituted and multiplied.
//   6. A RETYPED PRICE. The cost side reads SEAT_LADDER through tierFor. A
//      repricing that updated the price list and left 99 hardcoded in a
//      marketing page would go unnoticed, because the saving is the number
//      people argue about and the price is the number they trust.
//
// ══ What is executed, and what is only read ════════════════════════════════
//
// The maths is EXECUTED — every invariant below runs the real estimateSavings
// over real input, including several thousand random and hostile cases. That
// is the part that matters and it is the part that is proved.
//
// The page is a React component with JSX and nothing in an alias-loader run
// can parse JSX, so the two assertions about it are made against its SOURCE
// and are honestly weaker: they prove the component imports the real function
// and renders the fields the estimate returns, not that a browser shows them.
// They are written positionally so that deleting a call fails rather than
// passing on a leftover comment.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { SEAT_LADDER, tierFor, defaultAnnualPrice } from "@/lib/pricing/ladder";
import {
  ASSUMPTIONS,
  ASSUMPTION_BASIS,
  INPUT_FIELDS,
  LINE_BUILDERS,
  NOT_COUNTED,
  SAVINGS_DISCLOSURE,
  LADDER_CEILING,
  assumptionRow,
  validateAssumptions,
  estimateSavings,
  subscriptionCost,
  formatAmount,
} from "@/lib/marketing/savings";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const MODULE = "lib/marketing/savings.js";
const PAGE = "app/(marketing)/savings/page.js";
const VIEW = "app/(marketing)/savings/SavingsCalculator.js";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);

const section = (title) => console.log(`\n── ${title} ${"─".repeat(Math.max(0, 62 - title.length))}\n`);

/* ═══════════════════════════════════════════════════════════════════════════
   1. Every coefficient is a named assumption with a reason
   ═══════════════════════════════════════════════════════════════════════════

   The table validates itself at import (a share whose label has drifted from
   its value throws), so the first assertion here is really "that validation
   still runs". The rest are the things a self-check inside the module cannot
   fairly assert about itself: that the reasons are reasons rather than
   restatements, and that nobody has quietly moved a number up. */
section("The assumption table");

ok("the table validates clean", validateAssumptions().length === 0, validateAssumptions().join("; "));

for (const row of ASSUMPTIONS) {
  ok(
    `${row.key}: carries a basis, what it represents, and why`,
    ASSUMPTION_BASIS.includes(row.basis) &&
      row.represents.length > 40 &&
      row.reasoning.length > 60,
    `basis=${row.basis} represents=${row.represents.length} reasoning=${row.reasoning.length}`,
  );
  // A reason that only restates the label is not a reason. Cheap proxy: the
  // reasoning has to say something the label does not.
  ok(
    `${row.key}: the reasoning is not the label again`,
    row.reasoning.trim().toLowerCase() !== row.label.trim().toLowerCase(),
  );
}

// ── Nothing is positive-by-accident, and nothing has crept up ──────────────
//
// Ceilings, not values, so tuning stays possible and inflating does not. Each
// one is set where the claim would stop being conservative: an admin saving of
// more than a third of a reported week, a chase that recovers one quote in ten,
// or a trades margin over a half are all numbers somebody would have to defend
// to a contractor, and none of them should arrive without this file failing.
const CEILINGS = {
  tools_paper_admin_share: 0.35,
  tools_apps_admin_share: 0.25,
  tools_paper_invoice_days: 10,
  tools_apps_invoice_days: 7,
  cost_of_money: 0.12,
  quote_recovery_share: 0.1,
  gross_margin: 0.5,
};
for (const [key, ceiling] of Object.entries(CEILINGS)) {
  const row = assumptionRow(key);
  ok(
    `${key}: positive and at or under its conservative ceiling (${ceiling})`,
    row.value > 0 && row.value <= ceiling,
    row.value,
  );
}
ok(
  "every ceiling names a real assumption",
  Object.keys(CEILINGS).every((k) => ASSUMPTIONS.some((r) => r.key === k)),
);
// The arithmetic rows are definitions and must stay definitions.
ok("52 weeks", assumptionRow("weeks_per_year").value === 52);
ok("12 months", assumptionRow("months_per_year").value === 12);
ok("365 days", assumptionRow("days_per_year").value === 365);
ok(
  "the three definitions are marked as definitions, not as estimates",
  ["weeks_per_year", "months_per_year", "days_per_year"].every(
    (k) => assumptionRow(k).basis === "arithmetic",
  ),
);
ok(
  "an unknown assumption throws rather than reading as nothing",
  (() => {
    try {
      assumptionRow("no_such_coefficient");
      return false;
    } catch {
      return true;
    }
  })(),
);

/* ═══════════════════════════════════════════════════════════════════════════
   2. No magic numbers in the formulas
   ═══════════════════════════════════════════════════════════════════════════

   Read off the builders' own source. Two directions, and the second is the one
   that catches a real edit: a coefficient used without being declared is
   invisible on the page, and a coefficient declared without being used is a
   row in a table that explains a number the total does not contain. */
section("The formulas contain no numbers");

for (const builder of LINE_BUILDERS) {
  const src = String(builder.build);
  // Digits anywhere in a builder — including inside a string it prints — mean a
  // number reached the page without passing through the table.
  const literals = src.match(/\d+(\.\d+)?/g) || [];
  ok(`${builder.key}: not one numeric literal in the formula`, literals.length === 0, literals.join(","));

  const used = [...src.matchAll(/A\("([a-zA-Z0-9_]+)"\)/g)].map((m) => m[1]);
  const shown = [...src.matchAll(/assumptionRow\("([a-zA-Z0-9_]+)"\)/g)].map((m) => m[1]);
  const referenced = new Set([...used, ...shown]);
  const declared = new Set(builder.assumptions);

  ok(
    `${builder.key}: every coefficient it reads is declared`,
    [...referenced].every((k) => declared.has(k)),
    [...referenced].filter((k) => !declared.has(k)).join(","),
  );
  ok(
    `${builder.key}: every coefficient it declares is read`,
    [...declared].every((k) => referenced.has(k)),
    [...declared].filter((k) => !referenced.has(k)).join(","),
  );
  ok(
    `${builder.key}: every declared coefficient exists in the table`,
    [...declared].every((k) => ASSUMPTIONS.some((r) => r.key === k)),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. Every line item traces to a mechanism that exists
   ═══════════════════════════════════════════════════════════════════════════

   featureMatrix.js's argument, applied one page over: a claim carries the file
   that makes it true, and the file is checked rather than remembered. A saving
   attributed to something we do not ship is a lie with arithmetic on top. */
section("Each line item names files that exist");

for (const builder of LINE_BUILDERS) {
  ok(`${builder.key}: names at least one file`, builder.proof.length > 0);
  for (const path of builder.proof) {
    ok(`${builder.key}: ${path} exists`, existsSync(join(ROOT, path)));
  }
  ok(
    `${builder.key}: says out loud what does the work`,
    typeof builder.mechanism === "string" && builder.mechanism.length > 60,
  );
}

// The follow-up line rests on the cron finder actually being able to find a
// quote nobody answered and an invoice past its date. Naming the file is not
// enough; the file has to still contain the triggers.
{
  const cron = read("app/api/cron/follow-ups/route.js");
  ok("the quote chase still exists in the finder table", cron.includes("quote_no_response"));
  ok("the overdue-invoice chase still exists", cron.includes("invoice_overdue"));
  const invoiceFromQuote = read("lib/invoices/createInvoiceFromQuote.js");
  ok(
    "an approved quote still becomes the invoice",
    invoiceFromQuote.includes("export async function ensureInvoiceForQuote"),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. Nothing here prices a mechanism we do not have
   ═══════════════════════════════════════════════════════════════════════════

   The two line items that were NOT ported. Scanned across every string the
   page can render and across the whole source of all three files — comments
   included, because the cheapest way for one of these to come back is somebody
   reading a comment that mentions it as an idea and implementing it. */
section("Two mechanisms we do not have, and do not sell");

const ABSENT = [
  { name: "change orders", re: /change[\s_-]?orders?/i },
  { name: "a QuickBooks sync", re: /quick\s?books|\bqbo\b/i },
];

for (const { name, re } of ABSENT) {
  for (const file of [MODULE, PAGE, VIEW]) {
    ok(`${file} never mentions ${name}`, !re.test(read(file)));
  }
}

// Belt and braces: the same scan over the rendered VALUES, so a string built
// somewhere else and imported would still be caught.
{
  const renderable = JSON.stringify([
    LINE_BUILDERS.map((b) => [b.label, b.mechanism]),
    ASSUMPTIONS.map((r) => [r.label, r.represents, r.reasoning]),
    NOT_COUNTED,
    INPUT_FIELDS,
    SAVINGS_DISCLOSURE,
  ]);
  for (const { name, re } of ABSENT) {
    ok(`no rendered string mentions ${name}`, !re.test(renderable));
  }
  // The register featureMatrix.js asks for: a painter's words, not ours.
  const JARGON = ["webhook", "endpoint", "prisma", "cron", "tenant", "schema", "boolean"];
  for (const word of JARGON) {
    ok(`nothing a visitor reads says "${word}"`, !renderable.toLowerCase().includes(word));
  }
  ok(
    "the proof paths are not rendered to visitors",
    !read(VIEW).includes(".proof"),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. The price comes from the ladder, never from a keyboard
   ═══════════════════════════════════════════════════════════════════════════ */
section("The cost side reads SEAT_LADDER");

ok(
  "the module imports the ladder",
  /import\s*\{[^}]*\}\s*from\s*"@\/lib\/pricing\/ladder"/.test(read(MODULE)),
);

// No rung's price may appear as a literal anywhere in the three files. This is
// the assertion that catches the tidy-up where somebody "simplifies" a lookup
// into the number it currently returns.
{
  const sources = [MODULE, PAGE, VIEW].map((p) => [p, read(p)]);
  for (const tier of SEAT_LADDER) {
    for (const [path, src] of sources) {
      const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      ok(
        `${path} does not restate ${tier.label}'s price`,
        !new RegExp(`(?<![\\w.])${tier.price}(?![\\w.])`).test(stripped),
      );
    }
  }
}

// And it returns what the ladder says, rung by rung, rather than something that
// merely looks plausible.
for (const tier of SEAT_LADDER) {
  const cost = subscriptionCost({ seats: tier.seats, crew: tier.crewSeats });
  ok(
    `${tier.label}: quoted at the ladder's own price`,
    cost.fits &&
      cost.tierKey === tier.tierKey &&
      cost.monthly === tier.price &&
      cost.yearAtMonthly === tier.price * 12 &&
      cost.yearCommitted === defaultAnnualPrice(tier.price),
    JSON.stringify(cost),
  );
}

// A roster past the top rung gets "talk to us", not the top rung. The ladder
// makes this argument itself; the page has to obey it, because seating twelve
// people on a plan for ten bills for ten and locks two out.
{
  const over = { seats: LADDER_CEILING.seats + 1, crew: 0 };
  ok(
    "a business past the ladder is not silently sold the top plan",
    subscriptionCost(over).fits === false && tierFor(over) === null,
  );
  const result = estimateSavings({
    ...over,
    projectsPerMonth: 10,
    averageProjectValue: 5000,
    adminHoursPerWeek: 10,
    hourlyCost: 50,
    tools: "paper",
  });
  ok(
    "and no comparison is printed for them",
    result.ready === true && result.cost.fits === false && result.netAfterCost === null,
  );
}

// Nothing on this page may name a currency or guess at one. /pricing removed
// its geo read deliberately; this is the side door it could come back through.
{
  // Comments stripped for this one, and only this one: the file's own header
  // explains at length why there is no geo read here, and a scan that counted
  // that explanation as an offence would force the explanation to be deleted.
  const view = read(VIEW)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const needle of ["x-vercel-ip-country", "currencyMeta", "geo"]) {
    ok(`the calculator does not reach for ${needle}`, !view.includes(needle));
  }
  // And does not NAME one either. A code or a symbol appended to a figure is
  // how this comes back: not as a geo read, but as somebody deciding the total
  // "looks unfinished" without one. It looks unfinished because we do not know.
  for (const [what, re] of [
    ["a currency code", /\b(CAD|USD|EUR|GBP)\b/],
    ["a currency symbol on a figure", /(US\$|CA\$|[$£€]\s*\{?\s*format)/],
  ]) {
    ok(`the calculator never prints ${what}`, !re.test(view), view.match(re)?.[0]);
  }
  ok(
    "it says instead where the currency is actually decided",
    view.includes("business address you give at signup"),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. Hostile input
   ═══════════════════════════════════════════════════════════════════════════

   The guarantees, stated as one predicate and then run over everything nasty
   that can be typed into seven boxes. Most of the real bugs in this repo were
   found by executing a pure function against input nobody would demo. */
section("Hostile input");

function invariants(label, raw) {
  let result;
  try {
    result = estimateSavings(raw);
  } catch (e) {
    fails.push(`${label}: threw — ${e.message}`);
    return null;
  }

  const numbers = [
    result.total,
    result.annualRevenue,
    ...result.lines.map((l) => l.amount),
    ...result.lines.map((l) => l.raw),
  ];
  if (result.netAfterCost !== null) numbers.push(result.netAfterCost);

  const bad = [];
  if (numbers.some((n) => !Number.isFinite(n))) bad.push("not finite");
  if (result.total < 0) bad.push("negative total");
  if (result.lines.some((l) => l.amount < 0)) bad.push("negative line");
  if (result.total > result.annualRevenue) bad.push("saving exceeds revenue");
  const summed = result.lines.reduce((s, l) => s + l.amount, 0);
  if (summed !== result.total) bad.push(`lines sum to ${summed}, total says ${result.total}`);
  if (!result.ready && result.total !== 0) bad.push("a figure without an answer");
  if (formatAmount(result.total).includes("NaN")) bad.push("NaN on screen");

  if (bad.length) fails.push(`${label}: ${bad.join("; ")}`);
  return bad.length ? null : result;
}

const SANE = {
  seats: 3,
  crew: 5,
  projectsPerMonth: 8,
  averageProjectValue: 5000,
  adminHoursPerWeek: 6,
  hourlyCost: 45,
  tools: "paper",
  quotesPerMonth: 14,
};

const HOSTILE = [
  ["nothing at all", {}],
  ["null", null],
  ["a string", "8 projects"],
  ["an array", []],
  ["every field blank", Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, ""]))],
  ["zero everything", { ...SANE, seats: 0, crew: 0, projectsPerMonth: 0, averageProjectValue: 0, adminHoursPerWeek: 0, hourlyCost: 0, quotesPerMonth: 0 }],
  ["no employees at all", { ...SANE, seats: 0, crew: 0 }],
  ["no projects", { ...SANE, projectsPerMonth: 0 }],
  ["negative projects", { ...SANE, projectsPerMonth: -8 }],
  ["negative money", { ...SANE, averageProjectValue: -5000, hourlyCost: -45 }],
  ["negative hours", { ...SANE, adminHoursPerWeek: -4 }],
  ["absurd hours", { ...SANE, adminHoursPerWeek: 1e6 }],
  ["a week with more hours than a week has", { ...SANE, adminHoursPerWeek: 200 }],
  ["absurd money", { ...SANE, averageProjectValue: 1e15, hourlyCost: 1e12 }],
  ["Infinity", { ...SANE, projectsPerMonth: Infinity, averageProjectValue: Infinity }],
  ["-Infinity", { ...SANE, hourlyCost: -Infinity }],
  ["NaN", { ...SANE, adminHoursPerWeek: NaN }],
  ["words in every box", Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, "lots"]))],
  ["booleans", Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, true]))],
  ["objects", Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, { n: 5 }]))],
  ["numeric strings, as a form actually sends them", Object.fromEntries(Object.entries(SANE).map(([k, v]) => [k, String(v)]))],
  ["hex", { ...SANE, projectsPerMonth: "0x10" }],
  ["exponent notation", { ...SANE, averageProjectValue: "5e3" }],
  ["whitespace", { ...SANE, hourlyCost: "  45  " }],
  ["a tools answer we do not offer", { ...SANE, tools: "carrier pigeon" }],
  ["tools left blank", { ...SANE, tools: "" }],
  ["one job a year, a full-time office", { seats: 1, crew: 0, projectsPerMonth: 1, averageProjectValue: 100, adminHoursPerWeek: 40, hourlyCost: 60, tools: "paper" }],
  ["more quotes than there are hours", { ...SANE, quotesPerMonth: 5000 }],
  ["fewer quotes than jobs", { ...SANE, quotesPerMonth: 2 }],
  ["a prototype-polluting key", { ...SANE, __proto__: { total: 9999999 } }],
];

for (const [label, raw] of HOSTILE) {
  const result = invariants(label, raw);
  if (result) ok(`survives: ${label}`, true);
}

// The specific answers, spelled out rather than left to the predicate.
{
  const blank = estimateSavings({});
  ok("nothing answered produces no figure", blank.ready === false && blank.total === 0);
  ok(
    "and names every question it is waiting on",
    blank.missing.length === INPUT_FIELDS.filter((f) => f.required).length,
    blank.missing.join(","),
  );

  const negative = estimateSavings({ ...SANE, adminHoursPerWeek: -4 });
  ok(
    "a negative answer is refused, not clamped to zero and multiplied",
    negative.ready === false && negative.outOfRange.includes("adminHoursPerWeek"),
    JSON.stringify(negative.outOfRange),
  );

  const absurd = estimateSavings({ ...SANE, adminHoursPerWeek: 200 });
  ok(
    "an impossible week is refused rather than trimmed to 168",
    absurd.ready === false && absurd.outOfRange.includes("adminHoursPerWeek"),
  );

  const noTools = estimateSavings({ ...SANE, tools: "" });
  ok(
    "how they work today is never assumed — it moves two coefficients",
    noTools.ready === false && noTools.missing.includes("tools"),
  );

  const noQuotes = estimateSavings({ ...SANE, quotesPerMonth: "" });
  ok("the optional question does not block the estimate", noQuotes.ready === true);
  // ── The two silences are DIFFERENT silences ──────────────────────────────
  //
  // "You did not tell us" and "you win everything you quote" are opposite
  // statements about the business, and a blank box read as a zero turns the
  // first into the second — the page then tells a contractor something about
  // his own win rate that he never said. So the reason is asserted, not just
  // the omission.
  const blankReason = noQuotes.omitted.find((o) => o.key === "quotes_chased")?.reason || "";
  ok(
    "a blank answer is reported as a blank answer",
    /have not told us/.test(blankReason),
    blankReason,
  );

  const winsAll = estimateSavings({ ...SANE, quotesPerMonth: SANE.projectsPerMonth });
  const winsAllReason = winsAll.omitted.find((o) => o.key === "quotes_chased")?.reason || "";
  ok(
    "and winning everything you quote is reported as that, not as a blank",
    /win everything/.test(winsAllReason),
    winsAllReason,
  );

  // The same confusion on a REQUIRED box would be worse: it would put a zero
  // into a multiplication and print a total from it.
  for (const field of INPUT_FIELDS.filter((f) => f.required && f.kind === "number")) {
    const blanked = estimateSavings({ ...SANE, [field.key]: "" });
    ok(
      `a blank ${field.key} stops the estimate rather than reading as zero`,
      blanked.ready === false && blanked.missing.includes(field.key),
    );
  }

  const zeroWork = estimateSavings({ ...SANE, projectsPerMonth: 0 });
  ok(
    "no work invoiced means no saving claimed, and the cap says why",
    zeroWork.ready === true && zeroWork.total === 0 && zeroWork.annualRevenue === 0,
  );

  const tiny = estimateSavings({
    seats: 1,
    crew: 0,
    projectsPerMonth: 1,
    averageProjectValue: 100,
    adminHoursPerWeek: 40,
    hourlyCost: 60,
    tools: "paper",
  });
  ok(
    "an admin bill bigger than the whole business is held to the business",
    // Never above the revenue, and never more than a dollar per line below it:
    // each line is floored after the cap is applied, so the rounding loss is
    // bounded and always downward.
    tiny.capped === true &&
      tiny.total <= tiny.annualRevenue &&
      tiny.total >= tiny.annualRevenue - tiny.lines.length,
    `${tiny.total} vs ${tiny.annualRevenue}`,
  );

  // ── The page has to be able to say no ────────────────────────────────────
  //
  // A calculator that cannot print a negative comparison is an advertisement
  // with a form on it. This shape — a one-man band with an hour of paperwork a
  // week and small jobs — genuinely does not get its money back, and the page
  // says so.
  const notWorthIt = estimateSavings({
    seats: 1,
    crew: 0,
    projectsPerMonth: 2,
    averageProjectValue: 200,
    adminHoursPerWeek: 1,
    hourlyCost: 25,
    tools: "separate_apps",
  });
  ok(
    "a business it does not pay for is told so",
    notWorthIt.ready === true &&
      notWorthIt.paysForItself === false &&
      notWorthIt.netAfterCost < 0,
    JSON.stringify({ total: notWorthIt.total, net: notWorthIt.netAfterCost }),
  );
}

// ── Several thousand of them ───────────────────────────────────────────────
//
// Deterministic, so a failure is reproducible: the same seed produces the same
// cases on every run and in CI. The generator deliberately spends most of its
// draws on rubbish, because the sane middle is what everybody tests by hand.
{
  let seed = 20260828;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const JUNK = ["", " ", "abc", "1e999", "-0", "null", "undefined", "0x1f", "1,000", "٤", true, false, null, undefined, {}, [], NaN, Infinity, -Infinity, 1e308];
  const draw = () => {
    const r = rnd();
    if (r < 0.45) return JUNK[Math.floor(rnd() * JUNK.length)];
    if (r < 0.75) return Math.floor(rnd() * 1e7) - 5e6;
    return Math.floor(rnd() * 500);
  };

  let clean = 0;
  const CASES = 5000;
  for (let i = 0; i < CASES; i++) {
    const raw = {};
    for (const f of INPUT_FIELDS) raw[f.key] = draw();
    if (rnd() < 0.4) raw.tools = rnd() < 0.5 ? "paper" : "separate_apps";
    const before = fails.length;
    invariants(`fuzz #${i}`, raw);
    if (fails.length === before) clean++;
  }
  ok(`${CASES} random and malformed submissions hold every guarantee`, clean === CASES, clean);
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. The arithmetic is the arithmetic the page prints
   ═══════════════════════════════════════════════════════════════════════════

   Worked by hand from the table, so that a coefficient changing changes this
   number too and somebody has to look at it. */
section("Worked example");

{
  const r = estimateSavings(SANE);
  const admin = Math.floor(6 * 0.25 * 52 * 45); // 3,510
  const revenue = 8 * 12 * 5000; // 480,000
  const sooner = Math.floor(revenue * (5 / 365) * 0.08); // 526
  const chased = Math.floor((14 - 8) * 12 * 5000 * 0.03 * 0.3); // 3,240

  const line = (key) => r.lines.find((l) => l.key === key)?.amount;
  ok("office hours back: 6 h × 25% × 52 × 45", line("admin_time") === admin, line("admin_time"));
  ok("invoice sooner: 480,000 × 5/365 × 8%", line("invoice_sooner") === sooner, line("invoice_sooner"));
  ok("quotes chased: 360,000 unwon × 3% × 30% margin", line("quotes_chased") === chased, line("quotes_chased"));
  ok("the total is the three of them", r.total === admin + sooner + chased, r.total);
  ok("and it is a long way under the revenue it came from", r.total < revenue * 0.05, r.total);

  // The point of the margin coefficient, stated as a number: counting a
  // recovered job at its invoice rather than at what it leaves you would more
  // than triple that line.
  ok(
    "a recovered job is counted at margin, not at its invoice",
    line("quotes_chased") < Math.floor((14 - 8) * 12 * 5000 * 0.03),
  );

  // Same for the cash-flow line: the money is not the saving, the wait is.
  ok(
    "money arriving sooner is worth the wait, not the money",
    line("invoice_sooner") < revenue * 0.01,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. The page renders what the estimate returns
   ═══════════════════════════════════════════════════════════════════════════

   Source-level, and weaker than the rest of this file — see the header. What
   it can prove is that the component reaches the real function and prints the
   parts of its answer that keep the number honest. */
section("The page prints the honest parts");

{
  const view = read(VIEW);
  const page = read(PAGE);

  ok("the page is the calculator's server half only", page.includes("SavingsCalculator"));
  ok("the calculator imports the real estimate", view.includes('from "@/lib/marketing/savings"'));
  ok("and calls it", /estimateSavings\(answers\)/.test(view));

  ok("it prints each line's workings", view.includes("line.workings"));
  ok("it prints the mechanism behind each line", view.includes("line.mechanism"));
  ok("it prints the reason a line is missing", view.includes("o.reason"));
  ok("it prints the cap when the cap bites", view.includes("result.capped"));
  ok("it prints the whole assumption table", view.includes("ASSUMPTIONS.map"));
  ok("with every reason in it", view.includes("row.reasoning"));
  ok("it prints what we chose not to count", view.includes("NOT_COUNTED.map"));
  ok("it prints the note saying these are estimates", view.includes("SAVINGS_DISCLOSURE"));
  ok("it compares against what a plan costs", view.includes("result.cost"));
  ok("nothing is pre-filled", view.includes("INPUT_FIELDS.map((f) => [f.key, \"\"])"));

  ok(
    "the disclosure says which way the estimates are biased",
    /downward|downwards/.test(SAVINGS_DISCLOSURE.body),
  );
  ok(
    "every excluded subject carries the reason it is excluded",
    NOT_COUNTED.length >= 3 && NOT_COUNTED.every((n) => n.reason.length > 80),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

console.log(`\n${pass} checks passed.`);
if (fails.length) {
  console.log(`\n${fails.length} FAILED:\n`);
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("Every figure on /savings traces to a published assumption.\n");
