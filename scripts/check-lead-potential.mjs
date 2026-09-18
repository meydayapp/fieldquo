// scripts/check-lead-potential.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-lead-potential.mjs
//
// ── What this is guarding ───────────────────────────────────────────────────
//
// The leads board prints "≈ $X · from quote / estimate / your average for
// painting" on each card and a per-stage sum at the top. Every figure must
// carry the basis it came from, and a lead with NO basis must come back as
// null — never as $0, never as a guess. This feeds lib/leads/potentialValue.js
// hostile rows (no services, a $0 quote, an average over zero history, a
// Decimal-shaped total, a NaN range) and asserts the basis order the header
// of that file promises. The second half reads source: the API attaches the
// value only behind the pricing toggle and strips the quote's money again,
// and the page renders the strip only when a figure was attached.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  potentialValueForLead,
  averageWonByCategory,
  summarisePotential,
} from "@/lib/leads/potentialValue";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}

// Prisma hands Decimal columns over as objects; JSON hands strings. Both
// shapes must read as money.
const decimal = (v) => ({ toString: () => String(v), toNumber: () => Number(v) });

console.log("\nBasis order");
{
  const averages = { cat_paint: { amount: 3200, count: 5, label: "Painting" } };

  ok(
    "no lead at all → unknown, null amount",
    potentialValueForLead(null).basis === "unknown" && potentialValueForLead(null).amount === null,
  );
  ok(
    "lead with no services, no quote → unknown",
    potentialValueForLead({ id: "l1", categoryId: null }, { averages }).basis === "unknown",
  );
  const quoted = potentialValueForLead(
    { categoryId: "cat_paint", quote: { total: decimal("4500.00"), quoteNumber: "Q-0031" } },
    { averages },
  );
  ok("human-priced quote → basis quote, its total", quoted.basis === "quote" && quoted.amount === 4500);
  ok("quote basis carries the quote number", quoted.quoteNumber === "Q-0031");

  const accepted = potentialValueForLead(
    { quote: { total: "4500", acceptedTotal: "4800" } },
    { averages },
  );
  ok("acceptedTotal beats total once the client said yes", accepted.amount === 4800);

  const est = potentialValueForLead(
    {
      categoryId: "cat_paint",
      quote: {
        total: "3000",
        autoEstimated: true,
        needsReview: true,
        estimateData: { range: { low: 2000, high: 4000 } },
      },
    },
    { averages },
  );
  ok("unreviewed auto-estimate → basis estimate, range midpoint", est.basis === "estimate" && est.amount === 3000);

  const reviewed = potentialValueForLead(
    {
      quote: { total: "3300", autoEstimated: true, needsReview: false, estimateData: { range: { low: 2000, high: 4000 } } },
    },
    { averages },
  );
  ok("REVIEWED auto-estimate → basis quote, the confirmed total", reviewed.basis === "quote" && reviewed.amount === 3300);

  const nanRange = potentialValueForLead(
    { quote: { total: "2500", autoEstimated: true, needsReview: true, estimateData: { range: { low: "x", high: NaN } } } },
    { averages },
  );
  ok("NaN range falls back to the draft's total, still labelled estimate", nanRange.basis === "estimate" && nanRange.amount === 2500);

  const zeroQuote = potentialValueForLead(
    { categoryId: "cat_paint", quote: { total: 0 } },
    { averages },
  );
  ok("$0 quote falls through to the company average", zeroQuote.basis === "average" && zeroQuote.amount === 3200);
  ok("average basis names the service and the sample", zeroQuote.service === "Painting" && zeroQuote.sample === 5);

  const zeroNoHistory = potentialValueForLead({ categoryId: "cat_roof", quote: { total: 0 } }, { averages });
  ok("$0 quote + no history → unknown, not $0", zeroNoHistory.basis === "unknown" && zeroNoHistory.amount === null);

  const negative = potentialValueForLead({ quote: { total: -50 } }, { averages: {} });
  ok("negative total is not a figure", negative.basis === "unknown");

  const noAverages = potentialValueForLead({ categoryId: "cat_paint" });
  ok("no averages handed in → unknown (never a made-up number)", noAverages.basis === "unknown");

  const zeroCount = potentialValueForLead(
    { categoryId: "cat_paint" },
    { averages: { cat_paint: { amount: 3200, count: 0 } } },
  );
  ok("average with count 0 is refused", zeroCount.basis === "unknown");

  const budgetOnly = potentialValueForLead({ categoryId: null, budgetBand: "15k_plus" }, { averages });
  ok("a stated budget band alone is NOT a figure", budgetOnly.basis === "unknown");
}

console.log("\nAverages over the company's own history");
{
  const categories = [
    { id: "cat_paint", key: "painting", label: "Painting" },
    { id: "cat_roof", key: "roofing", label: "Roofing" },
  ];
  ok("zero history → empty map", Object.keys(averageWonByCategory([], categories)).length === 0);
  ok("garbage in → empty map", Object.keys(averageWonByCategory([null, 1, "x", {}], categories)).length === 0);

  const avg = averageWonByCategory(
    [
      { total: decimal("1000"), scopeGroups: [{ categoryId: "cat_paint" }] },
      { total: "3000", acceptedTotal: "3400", scopeGroups: [{ categoryId: "cat_paint" }, { categoryId: "cat_roof" }] },
      { total: 0, scopeGroups: [{ categoryId: "cat_paint" }] }, // a $0 win: skipped
      { total: "9000", quoteType: "roofing", scopeGroups: [] }, // pre-scope-group quote
      { total: "500", quoteType: "unknown_trade", scopeGroups: [{ categoryId: "" }] },
    ],
    categories,
  );
  ok("painting mean skips the $0 win: (1000+3400)/2", avg.cat_paint?.amount === 2200 && avg.cat_paint?.count === 2);
  ok("roofing counts the scope group AND the quoteType-only quote", avg.cat_roof?.amount === 6200 && avg.cat_roof?.count === 2);
  ok("a quote spanning two trades is counted once in each", avg.cat_paint.count === 2 && avg.cat_roof.count === 2);
  ok("labels come from the category rows", avg.cat_paint.label === "Painting");
  ok("no category invented for an unknown trade", Object.keys(avg).length === 2);
  ok("same quote with the group AND matching quoteType counts once", (() => {
    const one = averageWonByCategory([{ total: "100", quoteType: "painting", scopeGroups: [{ categoryId: "cat_paint" }] }], categories);
    return one.cat_paint.count === 1 && one.cat_paint.amount === 100;
  })());
}

console.log("\nSummary strip");
{
  const leads = [
    { status: "new", potential: { amount: 1000, basis: "quote" } },
    { status: "new", potential: { amount: null, basis: "unknown" } },
    { status: "contacted", potential: { amount: 2500, basis: "average" } },
    { status: "converted", potential: { amount: 4000, basis: "quote" } },
    { status: "lost", potential: { amount: 700, basis: "estimate" } },
    { status: "lost" }, // no potential at all
    { status: "made_up_status", potential: { amount: 50, basis: "quote" } },
    null,
  ];
  const sum = summarisePotential(leads);
  ok("open total = new + contacted with a figure", sum.open.total === 3550 && sum.open.count === 4);
  ok("stray status files under new, like the board does", sum.byStage.new.total === 1050 && sum.byStage.new.count === 3);
  ok("leads without a figure are counted, not summed", sum.withoutFigure === 2 && sum.byStage.new.withoutFigure === 1 && sum.byStage.lost.withoutFigure === 1);
  ok("won and lost are outside 'open'", sum.byStage.converted.total === 4000 && sum.byStage.lost.total === 700 && sum.open.total === 3550);
  ok("never weighted", sum.weighted === false);
  ok("empty board", summarisePotential([]).open.total === 0 && summarisePotential(undefined).withoutFigure === 0);
}

console.log("\nWiring");
{
  const route = read("app/api/leads/route.js");
  ok("API computes the value behind the pricing toggle", /canSeeMoney\(full\)/.test(route) && /showMoney && \{ potential:/.test(route));
  ok("API averages come from lib/leads/wonAverages (company-scoped)", /loadWonAverages\(\s*db,\s*member\.companyId/.test(route));
  ok("API strips the quote's money back off the response", /publicQuote = quote\s*\?\s*\{ id: quote\.id, quoteNumber: quote\.quoteNumber, status: quote\.status \}/.test(route));
  const won = read("lib/leads/wonAverages.js");
  ok("won-quote query is scoped to companyId and status accepted", /companyId,\s*status: "accepted"/.test(won));
  const page = read("app/app/leads/page.js");
  ok("page renders the strip only when a figure was attached", /showsMoney && \(leads \?\? \[\]\)\.length > 0 && \(\s*<PotentialStrip/.test(page));
  ok("card chip renders nothing for an unknown basis", /basis === "unknown"\) return null/.test(page));
  ok("strip says 'not weighted'", /app\.leads\.potential\.notWeighted/.test(page));
  ok("currency comes from the company (useCompanyMoney)", /useCompanyMoney\(\)/.test(page));
  const msgs = read("app/i18n/appMessages.js");
  ok("nine languages carry the strip copy", (msgs.match(/"app\.leads\.potential\.noFigure"/g) || []).length === 9);
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
