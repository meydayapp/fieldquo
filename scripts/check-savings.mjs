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
// to look at "25,894 a year" and see that it is wrong. So the honesty of this
// page cannot live in review; it has to be executable.
//
// ══ The page is allowed to argue. It is not allowed to drift ═══════════════
//
// This calculator makes our case, deliberately — the competitor's makes theirs.
// That is a product decision and this file does not second-guess it. What this
// file exists to stop is the thing that happens AFTER such a decision: every
// coefficient creeping upward, one plausible edit at a time, until a page that
// was arguing is a page that is wrong. So each judgement is pinned between a
// ceiling and, where a smaller number would make the total bigger, a FLOOR.
// Tuning stays possible in both directions. Inflating fails here.
//
// What this file therefore refuses to let happen:
//
//   1. A COEFFICIENT WITH NO REASON. Every number that multiplies anything is
//      a row in ASSUMPTIONS carrying what it represents and why it is that
//      value. The builders are read as source and any numeric literal in them
//      fails — a magic number in a total is an assertion nobody can argue
//      with, and the point of the table is to be argued with.
//   2. A COEFFICIENT THAT DRIFTS THE WAY THAT FLATTERS US. Ceilings on the
//      ones that multiply upward, floors on the ones that multiply downward.
//      Raising the office-time share to 60% fails this file; quietly deciding
//      a quote takes five minutes with a price book fails it too, and that is
//      the direction review never catches.
//   3. A LINE ITEM FOR SOMETHING WE DO NOT SHIP. An accounting-package sync is
//      one of the competitor's four lines and is not ours. Every string this
//      page can render is scanned for it, and every line item has to name
//      files that exist and still contain the mechanism.
//   4. A TOTAL LARGER THAN THE BUSINESS. Held to the revenue the visitor
//      typed, and proved so against inputs chosen to break it.
//   5. AN INVENTED ANSWER. AGENTS.md failure class 5. A blank, a word, a
//      negative or an absurd number must produce NO figure and a printed
//      reason — never a default quietly substituted and multiplied.
//   6. THE SAME HOUR COUNTED TWICE. Writing quotes is its own line now, so the
//      office-hours question had to stop including it. The two builders are
//      required to read disjoint answers, and the question has to say so.
//   7. A RETYPED PRICE. The cost side reads SEAT_LADDER through tierFor. A
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
// can parse JSX, so the assertions about it are made against its SOURCE and
// are honestly weaker: they prove the component imports the real function and
// renders the fields the estimate returns, not that a browser shows them.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { SEAT_LADDER, tierFor, defaultAnnualPrice } from "@/lib/pricing/ladder";
import {
  ASSUMPTIONS,
  ASSUMPTION_BASIS,
  CURRENCY_NOTE,
  INPUT_FIELDS,
  LINE_BUILDERS,
  NOT_COUNTED,
  AI_WITHOUT_AN_UPGRADE,
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

const builderFor = (key) => LINE_BUILDERS.find((b) => b.key === key);

/* ═══════════════════════════════════════════════════════════════════════════
   1. Every coefficient is a named assumption with a reason
   ═══════════════════════════════════════════════════════════════════════════

   The table validates itself at import (a share whose label has drifted from
   its value throws, and so now does "45 minutes" against a value of 30), so
   the first assertion here is really "that validation still runs". The rest
   are the things a self-check inside the module cannot fairly assert about
   itself: that the reasons are reasons rather than restatements, that a figure
   attributed to contractors actually cites the range it came from, and that
   nobody has quietly moved a number the way that flatters us. */
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

// ── A figure we say came from contractors has to show its range ────────────
//
// "Contractors report 45 minutes" is a citation-shaped sentence with no
// citation in it, and it is the most tempting thing on this page to write: it
// borrows the authority of a survey nobody ran. A row marked `reported` has to
// print the actual span it came from and say which end was taken, so a reader
// can see the number was chosen out of a range rather than handed down.
for (const row of ASSUMPTIONS.filter((r) => r.basis === "reported")) {
  ok(
    `${row.key}: cites the range it came from`,
    /\d+\s*[–—-]\s*\d+/.test(row.reasoning),
    row.reasoning.slice(0, 80),
  );
  ok(
    `${row.key}: says whose figures they are, not ours`,
    /contractor|painter|reported/i.test(row.reasoning),
  );
  ok(
    `${row.key}: says which end of the range was taken`,
    /\b(top|bottom|end|below|middle)\b/i.test(row.reasoning),
  );
}

// ── Nothing has crept the way that flatters us ─────────────────────────────
//
// CEILINGS are for coefficients that multiply the total UP. Each is set where
// the claim would stop being defensible against the mechanism underneath it.
//
// The two revenue shares are pinned to the competitor's own published
// coefficients — 1.8% and 0.9% for under-billing, 2% and 1.25% for extras. We
// may sit under the figure the comparison rests on. We may not sit above a
// figure we did not measure and cannot check.
const CEILINGS = {
  // Raised from 0.35/0.25 with the question underneath them: writing quotes
  // moved out of the office-hours answer into its own line, so this share now
  // applies to a smaller base made mostly of the re-keying we remove outright.
  tools_paper_admin_share: 0.4,
  tools_apps_admin_share: 0.3,
  // The competitor's own numbers, used as the ceiling rather than as the value.
  under_billing_paper_share: 0.018,
  under_billing_apps_share: 0.009,
  change_order_paper_share: 0.02,
  change_order_apps_share: 0.0125,
  tools_paper_invoice_days: 10,
  tools_apps_invoice_days: 7,
  cost_of_money: 0.12,
  quote_recovery_share: 0.1,
  gross_margin: 0.5,
  // Was 60, on the grounds that an hour was the top of what the scraped
  // reported ranges supported. The row no longer rests on those: FieldQuo's
  // owner prices jobs for a living and puts the same desk work — no travel in
  // it — at about two hours, and the row now says so and says whose figure it
  // is. The ceiling moves with the source rather than pinning the row to a
  // provenance it no longer has, and it stays a ceiling: three hours of pure
  // desk work on an average residential estimate is past anything anybody has
  // told us, and reaching it would be the drift this file exists to catch.
  quote_desk_minutes_today: 150,
};
for (const [key, ceiling] of Object.entries(CEILINGS)) {
  const row = assumptionRow(key);
  ok(
    `${key}: positive and at or under its ceiling (${ceiling})`,
    row.value > 0 && row.value <= ceiling,
    row.value,
  );
}
ok(
  "every ceiling names a real assumption",
  Object.keys(CEILINGS).every((k) => ASSUMPTIONS.some((r) => r.key === k)),
);

// FLOORS are the other direction, and they are the ones review never catches.
// A coefficient that is SUBTRACTED inflates the total by getting smaller:
// deciding a quote takes five minutes with a price book instead of fifteen
// triples that line, and reads on the page as a more confident product claim
// rather than as a bigger number.
const FLOORS = {
  // Was 10 — "the bottom of the reported with-templates range". That floor was
  // derived from a range describing OTHER software's templates, which is the
  // provenance the row itself has now dropped.
  //
  // At one minute the floor sits ON the value, and that is deliberate rather
  // than lazy: it is a PIN, not a bound. There is no headroom left below this
  // row, so the next edit that shaves it has to come here and rewrite this
  // comment, which is the whole mechanism — the failure this block exists to
  // catch is a coefficient creeping downward one plausible edit at a time
  // without anybody having to argue for it. A row this far down cannot creep;
  // it can only be moved on purpose.
  quote_desk_minutes_fieldquo: 1,
};
for (const [key, floor] of Object.entries(FLOORS)) {
  const row = assumptionRow(key);
  ok(
    `${key}: at or above its floor (${floor}) — shrinking it would inflate the total`,
    row.value >= floor,
    row.value,
  );
}
ok(
  "every floor names a real assumption",
  Object.keys(FLOORS).every((k) => ASSUMPTIONS.some((r) => r.key === k)),
);

// And the pair has to stay a saving rather than becoming one: the SPREAD is
// what multiplies, so it is pinned directly as well as at each end.
{
  const today = assumptionRow("quote_desk_minutes_today").value;
  const after = assumptionRow("quote_desk_minutes_fieldquo").value;
  ok("a quote takes less desk time with us than without", after < today, `${after} vs ${today}`);
  // Was "inside half an hour", which was the spread when both ends came from
  // scraped reported ranges. Both ends have since been re-sourced — the today
  // figure to the owner's own operating experience, the with-us figure to a
  // count of our real builder path — and the spread they produce is about two
  // hours. Pinned at two and a half so the pair still cannot drift open, which
  // is the only thing this assertion was ever for: the SPREAD is what
  // multiplies, and pinning each end separately does not pin their difference.
  ok(
    "and the minutes claimed back stay inside two and a half hours",
    today - after <= 150,
    today - after,
  );
}

// A business already on apps must never be quoted a bigger saving than one on
// paper. It is arithmetically possible — two independent rows — and it would
// be nonsense: they have already bought back part of what we are selling.
for (const [paper, apps] of [
  ["tools_paper_admin_share", "tools_apps_admin_share"],
  ["under_billing_paper_share", "under_billing_apps_share"],
  ["change_order_paper_share", "change_order_apps_share"],
  ["tools_paper_invoice_days", "tools_apps_invoice_days"],
]) {
  ok(
    `${apps} claims less than ${paper}, because they have already bought back some of it`,
    assumptionRow(apps).value < assumptionRow(paper).value,
    `${assumptionRow(apps).value} vs ${assumptionRow(paper).value}`,
  );
}

// The arithmetic rows are definitions and must stay definitions.
ok("52 weeks", assumptionRow("weeks_per_year").value === 52);
ok("12 months", assumptionRow("months_per_year").value === 12);
ok("365 days", assumptionRow("days_per_year").value === 365);
ok("60 minutes", assumptionRow("minutes_per_hour").value === 60);
ok(
  "the definitions are marked as definitions, not as estimates",
  ["weeks_per_year", "months_per_year", "days_per_year", "minutes_per_hour"].every(
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
   2. No magic numbers in the formulas, and no orphan rows in the table
   ═══════════════════════════════════════════════════════════════════════════

   Read off the builders' own source. Three directions now, and the third is
   new: a coefficient used without being declared is invisible on the page, a
   coefficient declared without being used is a row explaining a number the
   total does not contain, and a row in the table that NO builder reads is the
   same offence one level up — a published assumption the arithmetic ignores. */
section("The formulas contain no numbers");

const referencedAnywhere = new Set();

for (const builder of LINE_BUILDERS) {
  const src = String(builder.build);
  // Digits anywhere in a builder — including inside a string it prints — mean a
  // number reached the page without passing through the table.
  const literals = src.match(/\d+(\.\d+)?/g) || [];
  ok(`${builder.key}: not one numeric literal in the formula`, literals.length === 0, literals.join(","));

  const used = [...src.matchAll(/A\("([a-zA-Z0-9_]+)"\)/g)].map((m) => m[1]);
  const shown = [...src.matchAll(/assumptionRow\("([a-zA-Z0-9_]+)"\)/g)].map((m) => m[1]);
  const referenced = new Set([...used, ...shown]);
  for (const k of referenced) referencedAnywhere.add(k);
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

ok(
  "no row in the table explains a number the total does not contain",
  ASSUMPTIONS.every((r) => referencedAnywhere.has(r.key)),
  ASSUMPTIONS.filter((r) => !referencedAnywhere.has(r.key)).map((r) => r.key).join(","),
);

/* ═══════════════════════════════════════════════════════════════════════════
   3. Which lines are discounted to margin, and which are not
   ═══════════════════════════════════════════════════════════════════════════

   The distinction the module argues for, asserted rather than remembered.
   Work not yet won has to be counted at margin, because doing it costs money.
   Work already DONE and never billed is recovered whole, because the labour
   and the materials are already spent — discounting that to margin would not
   be conservative, it would be wrong. Somebody tidying for consistency would
   break one or the other, and both directions are caught here. */
section("Margin is applied where it belongs and nowhere else");

ok(
  "work not yet won is counted at margin",
  builderFor("quotes_chased").assumptions.includes("gross_margin"),
);
for (const key of ["under_billing", "change_orders"]) {
  ok(
    `${key}: work already done is recovered whole, not discounted to margin`,
    !builderFor(key).assumptions.includes("gross_margin"),
  );
  ok(
    `${key}: and the workings say why`,
    /already spent|never charged|never added to the bill/.test(
      String(builderFor(key).build),
    ),
  );
}

// The two revenue-share lines are different claims and must stay different
// claims: one is work that was inside the job and fell off the invoice, the
// other is work the job did not originally contain. Merged, they would be the
// same percentage counted twice.
ok(
  "under-billing and extras are described as different things",
  /not the row above|scope grew|ASKED FOR/.test(assumptionRow("change_order_paper_share").reasoning) &&
    /inside the job|dropped|never made it onto/i.test(
      assumptionRow("under_billing_paper_share").represents,
    ),
);

// Both revenue shares have to keep BOTH ends of the tools question. A single
// flat coefficient would quote a business already on apps the paper figure.
for (const [key, paper, apps] of [
  ["under_billing", "under_billing_paper_share", "under_billing_apps_share"],
  ["change_orders", "change_order_paper_share", "change_order_apps_share"],
  ["admin_time", "tools_paper_admin_share", "tools_apps_admin_share"],
  ["invoice_sooner", "tools_paper_invoice_days", "tools_apps_invoice_days"],
]) {
  const declared = builderFor(key).assumptions;
  ok(
    `${key}: prices paper and apps separately`,
    declared.includes(paper) && declared.includes(apps),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. The same hour is not counted twice
   ═══════════════════════════════════════════════════════════════════════════

   Writing quotes used to be inside the office-hours answer and is now its own
   line. If the question had been left saying "quoting, scheduling and
   invoicing" the page would charge the same hour to two line items and the
   total would be wrong in the direction that is hardest to notice, because
   both lines look right on their own. */
section("Quote time and office time are different hours");

{
  const quoteSrc = String(builderFor("quote_writing").build);
  const adminSrc = String(builderFor("admin_time").build);
  ok(
    "the quote line does not read the office-hours answer",
    !quoteSrc.includes("adminHoursPerWeek"),
  );
  ok("the office line does not read the quotes answer", !adminSrc.includes("quotesPerMonth"));

  const adminField = INPUT_FIELDS.find((f) => f.key === "adminHoursPerWeek");
  ok(
    "the office-hours question no longer asks for quoting time",
    !/quoting/i.test(adminField.label),
    adminField.label,
  );
  ok(
    "and says out loud that quote writing is asked separately",
    /not the time spent writing quotes|counted twice|same hour twice/i.test(adminField.help),
    adminField.help,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. Every line item traces to a mechanism that exists
   ═══════════════════════════════════════════════════════════════════════════

   featureMatrix.js's argument, applied one page over: a claim carries the file
   that makes it true, and the file is checked rather than remembered. A saving
   attributed to something we do not ship is a lie with arithmetic on top. */
section("Each line item names files that exist");

ok(
  "the strongest line leads",
  LINE_BUILDERS[0].key === "quote_writing",
  LINE_BUILDERS[0].key,
);

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

// Naming a file is not enough; the file has to still contain the mechanism the
// line is charging for.
{
  const cron = read("app/api/cron/follow-ups/route.js");
  ok("the quote chase still exists in the finder table", /\bquote_no_response:\s*\{/.test(cron));
  ok("the overdue-invoice chase still exists", /\binvoice_overdue:\s*\{/.test(cron));

  const invoiceFromQuote = read("lib/invoices/createInvoiceFromQuote.js");
  ok(
    "an approved quote still becomes the invoice",
    /export async function ensureInvoiceForQuote\s*\(/.test(invoiceFromQuote),
  );

  // ── The extras line ──────────────────────────────────────────────────────
  //
  // The claim is not merely that an invoice can be edited. It is that amending
  // a SENT one keeps the original, records the reason and the person, and
  // therefore settles what was agreed. If that ever became an in-place
  // overwrite, the mechanism would still exist and the claim would not.
  // ── Matched on the WRITE, not on the word ────────────────────────────────
  //
  // These were substring checks and two mutations walked straight through
  // them: `parentInvoiceId` appears three times in this route, twice in the
  // lookup that FINDS the previous version, so deleting it from the row being
  // created left the check passing. `changeLog` survived being renamed to
  // `changeLogGONE` for the plainest reason of all — it is still a substring
  // of it. A marker that appears anywhere in a file proves nothing about the
  // line that does the work.
  const invoiceRoute = read("app/api/invoices/[id]/route.js");
  // Anchored to the CREATE payload by the field that follows it. `parentInvoiceId:
  // rootId` also appears in the `where` clause that finds the previous version,
  // so on its own it stays true after the write is deleted — which is exactly
  // what a mutation proved. The version line is the neighbour that is only ever
  // in the row being written.
  ok(
    "amending a sent invoice still writes the new row against the original",
    /parentInvoiceId:\s*rootId,\s*\n\s*version:/.test(invoiceRoute),
  );
  ok("with an incremented version number", /version:\s*\(latestVersion/.test(invoiceRoute));
  ok("carrying a change record", /changeLog:\s*\{/.test(invoiceRoute));
  ok("that says why it changed", /reason:\s*changeReason/.test(invoiceRoute));
  ok("and who changed it", /changedBy:\s*member\.userId/.test(invoiceRoute));
  ok(
    "the earlier version is created alongside, not overwritten",
    /db\.invoice\.create\(/.test(invoiceRoute),
  );
  ok(
    "and every version is still readable back",
    /export async function GET\s*\(/.test(read("app/api/invoices/[id]/lifecycle/route.js")),
  );

  // ── The under-billing line ───────────────────────────────────────────────
  //
  // Four separate places work falls off an invoice, and the line charges for
  // all four, so all four are checked.
  ok(
    "what a job cost is still set against what was quoted",
    /export async function GET\s*\(/.test(read("app/api/jobs/[id]/costing/route.js")),
  );
  ok(
    "materials are still recorded against the job",
    /export async function POST\s*\(/.test(read("app/api/jobs/[id]/materials/route.js")),
  );
  ok(
    "hours are still tied to a job before they can be billed",
    /export async function PATCH\s*\(/.test(read("app/api/time-entries/[id]/route.js")),
  );
  ok(
    "tax is still computed rather than typed",
    /export function resolveDocumentTax\s*\(/.test(read("lib/tax/documentTax.js")),
  );

  // ── The quote line ───────────────────────────────────────────────────────
  ok(
    "the price book is still importable rather than retyped per quote",
    /export async function POST\s*\(/.test(read("app/api/products/import/route.js")),
  );
  ok(
    "material recipes still exist",
    /export async function PUT\s*\(/.test(read("app/api/settings/material-recipes/route.js")),
  );
  ok(
    "three price options still come off one build",
    /export async function POST\s*\(/.test(read("app/api/quotes/tier-group/route.js")),
  );
  ok(
    "a roof can still be measured without going out there",
    /await measureRoof\s*\(/.test(read("app/api/measure/roof/route.js")),
  );
  ok(
    "and one button still sends the quote",
    /await sendEmail\s*\(/.test(read("app/api/quotes/[id]/send/route.js")),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. Nothing here prices a mechanism we do not have
   ═══════════════════════════════════════════════════════════════════════════

   One of the competitor's four line items was NOT ported and stays out. It is
   scanned across every string the page can render and across the whole source
   of all three files — comments included, because the cheapest way for it to
   come back is somebody reading a comment that mentions it as an idea and
   implementing it.

   Change orders used to be on this list and are not any more: the mechanism
   turned out to exist under a different name, and section 5 above proves it
   still does. That is the only acceptable way for something to leave this
   list. */
section("The mechanism we do not have, and do not sell");

const ABSENT = [{ name: "an accounting sync", re: /quick\s?books|\bqbo\b/i }];

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
    AI_WITHOUT_AN_UPGRADE,
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
   7. What is said beside the total but not counted in it
   ═══════════════════════════════════════════════════════════════════════════

   The AI note is the one claim on this page that is not a line item, and it is
   the one most likely to be quietly made flattering: "AI included" is true and
   incomplete, because talk time is bought by the minute. The honest half is
   asserted so it cannot be dropped for length. */
section("The AI note stays honest");

{
  ok(
    "it says the included AI needs no bigger plan",
    /every plan/i.test(AI_WITHOUT_AN_UPGRADE.body) &&
      /no tier to move up to|without.*upgrad|not a bigger plan/i.test(
        `${AI_WITHOUT_AN_UPGRADE.headline} ${AI_WITHOUT_AN_UPGRADE.body}`,
      ),
    AI_WITHOUT_AN_UPGRADE.body,
  );
  ok(
    "and says in the same breath that talk time is paid for by the minute",
    /by the minute/i.test(AI_WITHOUT_AN_UPGRADE.body),
  );
  ok(
    "and that none of it is inside the total",
    /not in the figures above|none of that is in/i.test(AI_WITHOUT_AN_UPGRADE.body),
  );
  for (const path of AI_WITHOUT_AN_UPGRADE.proof) {
    ok(`the AI note's ${path} exists`, existsSync(join(ROOT, path)));
  }
  ok(
    "quote review is still on every plan in our own price list, not a tier above",
    read("lib/marketing/featureMatrix.js").includes('key: "ai_quote_review"'),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. The price comes from the ladder, never from a keyboard
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
    quotesPerMonth: 20,
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
  // ── And it has to SAY what money the figures are in ──────────────────────
  //
  // This assertion used to look for one hand-written phrase in the component.
  // It passed while the page was still wrong, and the owner found the bug it
  // could not see: that paragraph rendered only inside the `result.ready`
  // branch, so a visitor met two boxes asking for money — an hourly cost and
  // an average job value — with no unit on either and no mention of currency
  // anywhere on the page until they had already answered.
  //
  // So the string moved into the module as CURRENCY_NOTE and this now checks
  // three separate things instead of one substring: that the note names the
  // policy, that the always-rendered half is rendered OUTSIDE the ready
  // branch, and that both money questions carry the unit on the question
  // itself. A phrase match could never have caught any of those.
  ok(
    "the currency note says which two currencies and what decides between them",
    /Canadian/.test(CURRENCY_NOTE.long) &&
      /US /.test(CURRENCY_NOTE.long) &&
      /business address/.test(CURRENCY_NOTE.long),
    CURRENCY_NOTE.long,
  );
  ok(
    "and says the page does not convert",
    /convert|conversion/i.test(CURRENCY_NOTE.long) && /convert/i.test(CURRENCY_NOTE.short),
  );
  ok("the calculator renders the long form beside the total", view.includes("CURRENCY_NOTE.long"));
  {
    // The half that has to be on screen BEFORE an estimate exists. Located by
    // position rather than by presence: `result.ready` is where the page
    // splits, and a note rendered after it is a note the visitor answering the
    // questions never sees. That is the bug, stated as a position.
    const readyAt = view.indexOf("!result.ready");
    const shortAt = view.indexOf("CURRENCY_NOTE.short");
    ok(
      "and renders the short form above the ready/not-ready split, where the money questions are",
      shortAt !== -1 && readyAt !== -1 && shortAt < readyAt,
      `short at ${shortAt}, split at ${readyAt}`,
    );
  }
  {
    const money = INPUT_FIELDS.filter((f) => f.money === true);
    ok("both money questions are flagged as money", money.length === 2, money.map((f) => f.key).join(","));
    for (const f of money) {
      ok(
        `${f.key}: the question itself says which money, not just a note further down`,
        /money you invoice in/.test(f.help),
        f.help,
      );
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. Hostile input
   ═══════════════════════════════════════════════════════════════════════════

   The guarantees, stated as one predicate and then run over everything nasty
   that can be typed into eight boxes. Most of the real bugs in this repo were
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
  // Every line the page can render has to carry the sentence that lets a
  // contractor reproduce it. A blank workings string is a figure on faith.
  if (result.lines.some((l) => !l.workings || l.workings.length < 10)) {
    bad.push("a line with no workings");
  }
  // And every line NOT rendered has to say why it is not there.
  if (result.omitted.some((o) => !o.reason || o.reason.length < 20)) {
    bad.push("a silent omission");
  }

  if (bad.length) fails.push(`${label}: ${bad.join("; ")}`);
  return bad.length ? null : result;
}

const SANE = {
  seats: 3,
  crew: 5,
  quotesPerMonth: 16,
  projectsPerMonth: 8,
  averageProjectValue: 5000,
  adminHoursPerWeek: 4,
  hourlyCost: 45,
  tools: "paper",
};

const HOSTILE = [
  ["nothing at all", {}],
  ["null", null],
  ["a string", "8 projects"],
  ["an array", []],
  ["every field blank", Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, ""]))],
  ["zero everything", { ...SANE, seats: 0, crew: 0, quotesPerMonth: 0, projectsPerMonth: 0, averageProjectValue: 0, adminHoursPerWeek: 0, hourlyCost: 0 }],
  ["no employees at all", { ...SANE, seats: 0, crew: 0 }],
  ["no projects", { ...SANE, projectsPerMonth: 0 }],
  ["no quotes at all", { ...SANE, quotesPerMonth: 0 }],
  ["no quotes and no jobs", { ...SANE, quotesPerMonth: 0, projectsPerMonth: 0 }],
  ["a quote factory that finishes nothing", { ...SANE, quotesPerMonth: 5000, projectsPerMonth: 0 }],
  ["absurd quotes against one small job", { ...SANE, quotesPerMonth: 5000, projectsPerMonth: 1, averageProjectValue: 100 }],
  ["more quotes than there are hours", { ...SANE, quotesPerMonth: 5000 }],
  ["fewer quotes than jobs", { ...SANE, quotesPerMonth: 2 }],
  ["exactly as many quotes as jobs", { ...SANE, quotesPerMonth: SANE.projectsPerMonth }],
  ["negative quotes", { ...SANE, quotesPerMonth: -14 }],
  ["quotes as a word", { ...SANE, quotesPerMonth: "lots" }],
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
  ["one job a year, a full-time office", { seats: 1, crew: 0, quotesPerMonth: 1, projectsPerMonth: 1, averageProjectValue: 100, adminHoursPerWeek: 40, hourlyCost: 60, tools: "paper" }],
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
    "how they work today is never assumed — it moves four coefficients",
    noTools.ready === false && noTools.missing.includes("tools"),
  );

  // ── The question that used to be optional ────────────────────────────────
  //
  // Quotes a month drives the largest line on the page. Leaving it optional
  // meant most totals were missing the biggest true thing we can claim; making
  // it required means a blank has to STOP the estimate rather than read as a
  // zero, because a zero here would silently delete that line and print a
  // confident smaller number with no sentence saying why.
  const noQuotes = estimateSavings({ ...SANE, quotesPerMonth: "" });
  ok(
    "a blank quotes answer stops the estimate rather than deleting the biggest line",
    noQuotes.ready === false && noQuotes.missing.includes("quotesPerMonth"),
  );
  ok(
    "quotes a month is asked, not assumed",
    INPUT_FIELDS.find((f) => f.key === "quotesPerMonth").required === true,
  );

  // Zero quotes IS an answer, and gets a sentence rather than a zero row.
  const zeroQuotes = estimateSavings({ ...SANE, quotesPerMonth: 0 });
  const zeroReason = zeroQuotes.omitted.find((o) => o.key === "quote_writing")?.reason || "";
  ok(
    "telling us you send no quotes is reported as that, not priced at nothing",
    zeroQuotes.ready === true && /send no quotes/.test(zeroReason),
    zeroReason,
  );

  const winsAll = estimateSavings({ ...SANE, quotesPerMonth: SANE.projectsPerMonth });
  const winsAllReason = winsAll.omitted.find((o) => o.key === "quotes_chased")?.reason || "";
  ok(
    "winning everything you quote is reported as that, not chased",
    /win everything/.test(winsAllReason),
    winsAllReason,
  );

  // A blank on any required box must stop the estimate rather than putting a
  // zero into a multiplication and printing a total from it.
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
    quotesPerMonth: 1,
    projectsPerMonth: 1,
    averageProjectValue: 100,
    adminHoursPerWeek: 40,
    hourlyCost: 60,
    tools: "paper",
  });
  ok(
    "an office bill bigger than the whole business is held to the business",
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
  // week, two small jobs and one quote a month — genuinely does not get its
  // money back, and the page says so.
  //
  // The shape had to shrink when quote_desk_minutes_today was re-sourced from
  // 45 to 120: the old one (two quotes at $25/h) crossed into paying for
  // itself, which is the coefficient change showing up in the one assertion
  // that exists to prove the page can still say no. Kept comfortably negative
  // rather than tuned to the edge, so the next honest coefficient move does
  // not silently delete this guarantee.
  const notWorthIt = estimateSavings({
    seats: 1,
    crew: 0,
    quotesPerMonth: 1,
    projectsPerMonth: 2,
    averageProjectValue: 150,
    adminHoursPerWeek: 1,
    hourlyCost: 20,
    tools: "separate_apps",
  });
  ok(
    "a business it does not pay for is told so",
    notWorthIt.ready === true &&
      notWorthIt.paysForItself === false &&
      notWorthIt.netAfterCost < 0,
    JSON.stringify({ total: notWorthIt.total, net: notWorthIt.netAfterCost }),
  );

  // A business already on apps must be quoted less than the same business on
  // paper. Every paired coefficient says so individually above; this proves it
  // survives the whole pipeline including the cap.
  const onPaper = estimateSavings({ ...SANE, tools: "paper" });
  const onApps = estimateSavings({ ...SANE, tools: "separate_apps" });
  ok(
    "the same business is quoted less if it already runs apps",
    onApps.total < onPaper.total,
    `${onApps.total} vs ${onPaper.total}`,
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
   10. The arithmetic is the arithmetic the page prints
   ═══════════════════════════════════════════════════════════════════════════

   Worked by hand from the table, so that a coefficient changing changes this
   number too and somebody has to look at it. These are the owner's own
   answers: three people, sixteen quotes and eight jobs a month at five
   thousand, four office hours a week at forty-five an hour, on paper. */
section("Worked example");

{
  const r = estimateSavings(SANE);
  const revenue = 8 * 12 * 5000; // 480,000

  // SANE deliberately does NOT answer quoteDeskMinutes, so this is the
  // fallback path: the published row supplies the figure. 120 − 5.
  const quoteWriting = Math.floor((16 * 12 * (120 - 1) * 45) / 60); // 17,136
  const underBilling = Math.floor(revenue * 0.012); // 5,760
  const changeOrders = Math.floor(revenue * 0.014); // 6,720
  const chased = Math.floor((16 - 8) * 12 * 5000 * 0.04 * 0.3); // 5,760
  const admin = Math.floor(4 * 0.3 * 52 * 45); // 2,808
  const sooner = Math.floor(revenue * (5 / 365) * 0.08); // 526

  const line = (key) => r.lines.find((l) => l.key === key)?.amount;
  ok("pricing a job: 16 quotes × 12 × 119 min × 45/h", line("quote_writing") === quoteWriting, line("quote_writing"));
  ok("under-billing: 480,000 × 1.2%", line("under_billing") === underBilling, line("under_billing"));
  ok("extras never billed: 480,000 × 1.4%", line("change_orders") === changeOrders, line("change_orders"));
  ok("quotes chased: 480,000 unwon × 4% × 30% margin", line("quotes_chased") === chased, line("quotes_chased"));
  ok("office hours back: 4 h × 30% × 52 × 45", line("admin_time") === admin, line("admin_time"));
  ok("invoice sooner: 480,000 × 5/365 × 8%", line("invoice_sooner") === sooner, line("invoice_sooner"));

  const expected = quoteWriting + underBilling + changeOrders + chased + admin + sooner;
  ok("the total is the six of them", r.total === expected, r.total);
  ok("every line the builders produced is printed", r.lines.length === LINE_BUILDERS.length, r.lines.length);
  ok("and it is still a small fraction of the revenue it came from", r.total < revenue * 0.1, r.total);

  // The point of the margin coefficient, stated as a number: counting a
  // recovered job at its invoice rather than at what it leaves you would more
  // than triple that line.
  ok(
    "a recovered job is counted at margin, not at its invoice",
    line("quotes_chased") < Math.floor((16 - 8) * 12 * 5000 * 0.04),
  );

  // Same for the cash-flow line: the money is not the saving, the wait is.
  ok(
    "money arriving sooner is worth the wait, not the money",
    line("invoice_sooner") < revenue * 0.01,
  );

  // ── The visitor's own figure, when they give one ─────────────────────────
  //
  // The whole point of the new question: quotesPerMonth's help says "we ask
  // rather than assume", and until now the minutes beside it were assumed.
  // Three things have to hold and none of them is provable by reading the
  // source — the answer has to REPLACE the coefficient, the workings have to
  // SAY which of the two produced the figure (a total built on our number and
  // one built on theirs are different claims), and a contractor who is already
  // faster than we are has to be told this line does not apply to him rather
  // than shown a clamped zero.
  {
    const answered = estimateSavings({ ...SANE, quoteDeskMinutes: 200 });
    const expected = Math.floor((16 * 12 * (200 - 1) * 45) / 60);
    const got = answered.lines.find((l) => l.key === "quote_writing");
    ok("an answered figure replaces the published one", got?.amount === expected, got?.amount);
    ok(
      "and the workings say the number came from the visitor",
      /figure you gave us/.test(got?.workings || ""),
      got?.workings,
    );

    const unanswered = r.lines.find((l) => l.key === "quote_writing");
    ok(
      "while a blank box says out loud that the figure is ours",
      /you left the box blank/.test(unanswered?.workings || ""),
      unanswered?.workings,
    );

    // Faster than us: the arithmetic would go negative, be clamped to zero,
    // and print "−N minutes saved on each" — a line arguing against itself.
    const alreadyFast = estimateSavings({ ...SANE, quoteDeskMinutes: 1 });
    const refused = alreadyFast.omitted.find((o) => o.key === "quote_writing");
    ok(
      "a contractor already faster than us gets the line refused, with the reason",
      Boolean(refused) && /nothing on this line/.test(refused?.reason || ""),
      refused?.reason,
    );
    ok(
      "and no quote-writing line is printed for him at all",
      !alreadyFast.lines.some((l) => l.key === "quote_writing"),
    );

    // The out-of-range machinery has to cover the new box too, or a typo in it
    // produces a confident total instead of a refusal.
    const absurd = estimateSavings({ ...SANE, quoteDeskMinutes: 100000 });
    ok(
      "an absurd answer in the new box refuses the whole estimate",
      absurd.ready === false && absurd.outOfRange.includes("quoteDeskMinutes"),
      JSON.stringify(absurd.outOfRange),
    );

    // And a blank one must NOT: this is the only optional question on the
    // page, and requiring it by accident would break every existing visitor.
    ok(
      "a blank answer in the new box does not block the estimate",
      estimateSavings({ ...SANE, quoteDeskMinutes: "" }).ready === true,
    );
  }

  // And the cost side, on the same answers.
  ok("three seats and five crew fit a real rung", r.cost.fits === true);
  ok("it pays for itself on these answers", r.paysForItself === true, r.netAfterCost);
  ok(
    "the comparison uses the monthly rate, not the committed one",
    r.netAfterCost === r.total - r.cost.yearAtMonthly,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   11. The page renders what the estimate returns
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
  // Both halves, not just the identifier. The first version of this assertion
  // asked only whether the name appeared anywhere in the file, and a mutation
  // that replaced the headline with a hardcoded string sailed past it — the
  // body still mentioned the import, so the check agreed with itself. The
  // honest half of this note lives in the BODY, which is exactly the half a
  // "tighten the copy" edit would drop.
  ok("it prints the AI note's headline", view.includes("AI_WITHOUT_AN_UPGRADE.headline"));
  ok("and the honest half of it", view.includes("AI_WITHOUT_AN_UPGRADE.body"));
  ok("it prints the note saying these are estimates", view.includes("SAVINGS_DISCLOSURE"));
  ok("it compares against what a plan costs", view.includes("result.cost"));
  ok("nothing is pre-filled", view.includes("INPUT_FIELDS.map((f) => [f.key, \"\"])"));

  // ── The counts in the header are counted ─────────────────────────────────
  //
  // "Seven answers, three line items" was true when it was written and stopped
  // being true the moment a question and three lines were added. A sentence
  // that states a number about the page it is on has to derive it, because
  // nobody re-counts prose.
  ok(
    "the header counts the questions rather than asserting a number",
    /INPUT_FIELDS\.filter\(\(f\) => f\.required\)\.length/.test(view) &&
      /\{QUESTION_COUNT\}/.test(view),
  );
  ok(
    "and counts the line items the same way",
    /LINE_BUILDERS\.length/.test(view) && /\{LINE_COUNT\}/.test(view),
  );
  // The third count, and the one that only started existing when the page
  // gained its first optional question. "Eight answers" over NINE boxes is the
  // same defect as "seven answers" over eight, reached from the other side:
  // the required count stayed right and stopped describing the form.
  ok(
    "and counts the optional questions, which are no longer zero",
    INPUT_FIELDS.some((f) => !f.required) &&
      /INPUT_FIELDS\.filter\(\(f\) => !f\.required\)\.length/.test(view) &&
      /\{OPTIONAL_COUNT\}/.test(view),
    `${INPUT_FIELDS.filter((f) => !f.required).length} optional field(s)`,
  );
  {
    // Comments stripped, as with the currency scan: the comment beside the
    // derived counts explains the bug by quoting the sentence that had it, and
    // a scan that counted the explanation as the offence would force the
    // explanation to be deleted.
    const rendered = view
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const written = rendered.match(/\b(three|four|five|six|seven|eight) (answers|line items)\b/i);
    ok("no written-out count survives in the header", !written, written?.[0]);
  }

  // Every basis the table can carry needs a label on the page, or a row
  // renders with a blank cell where its provenance should be.
  for (const basis of ASSUMPTION_BASIS) {
    ok(`the table can label a "${basis}" row`, new RegExp(`${basis}:`).test(view));
  }

  ok(
    "the disclosure says which way the estimates are biased",
    /downward|downwards|conservative|less than they look/.test(SAVINGS_DISCLOSURE.body),
  );
  ok(
    "the disclosure explains why some lines are margin and some are not",
    /margin/.test(SAVINGS_DISCLOSURE.body) && /already/.test(SAVINGS_DISCLOSURE.body),
  );
  ok(
    "every excluded subject carries the reason it is excluded",
    NOT_COUNTED.length >= 3 && NOT_COUNTED.every((n) => n.reason.length > 80),
  );
  // The drive and the walkthrough are the specific thing a contractor will
  // check the quote line against. They are not removed and must be named as
  // not removed, or the quote line reads as a claim about the whole visit.
  ok(
    "the drive and the walkthrough are named as not counted",
    NOT_COUNTED.some((n) => /drive/i.test(n.subject) && /walk/i.test(`${n.subject}${n.reason}`)),
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
