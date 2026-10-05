// scripts/check-lead-potential.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-lead-potential.mjs
//
// ── What this is guarding ───────────────────────────────────────────────────
//
// The leads board prints "≈ $X · from quote / estimate / estimate from 22
// doors + 15 drawers" on each card and a per-stage sum at the top. Every
// figure must carry the basis it came from, and a lead with NO basis must
// come back as null — never as $0, never as a guess, and (since 2026-10-05)
// never as the company's average won quote. This feeds
// lib/leads/potentialValue.js hostile rows (no services, a $0 quote, a
// Decimal-shaped total, a NaN range, counts with no price) and asserts the
// basis order the header of that file promises. The second half reads source: the API attaches the
// value only behind the pricing toggle and strips the quote's money again,
// and the page renders the strip only when a figure was attached.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  potentialValueForLead,
  leadScopeCounts,
  summarisePotential,
  BASES,
} from "@/lib/leads/potentialValue";
import { getPriceBook } from "@/app/data/tradePriceBooks";

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
  // The company's own priced services (lib/leads/scopeEstimate.js
  // loadScopePricing's shape). `averages` is kept as a name for the
  // context object the old basis took, to prove it is now ignored.
  const averages = { cat_paint: { amount: 3200, count: 5, label: "Painting" } };
  const pricing = {
    cat_cab: { categoryId: "cat_cab", key: "cabinet_refinishing", label: "Cabinet Refinishing", book: getPriceBook("cabinet_refinishing", null), defaultRate: null, unit: null },
  };

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
  ok("$0 quote and no scope → unknown, NEVER the company average", zeroQuote.basis === "unknown" && zeroQuote.amount === null);
  ok("the basis list has no 'average' any more", !BASES.includes("average") && BASES.includes("scope"));

  const zeroWithScope = potentialValueForLead(
    { categoryId: "cat_cab", quote: { total: 0 }, intake: { scope: { counts: { doors: 22, drawers: 15 } } } },
    { pricing },
  );
  ok("$0 quote + counts → the scope estimate from the company's book", zeroWithScope.basis === "scope" && zeroWithScope.amount === 5550, JSON.stringify(zeroWithScope));

  const negative = potentialValueForLead({ quote: { total: -50 } }, { averages: {} });
  ok("negative total is not a figure", negative.basis === "unknown");

  const noPricing = potentialValueForLead({ categoryId: "cat_paint" });
  ok("no pricing handed in → unknown (never a made-up number)", noPricing.basis === "unknown");

  const averagesIgnored = potentialValueForLead({ categoryId: "cat_paint" }, { averages });
  ok("a no-scope lead is unknown even when averages are handed in", averagesIgnored.basis === "unknown" && averagesIgnored.amount === null);

  const budgetOnly = potentialValueForLead({ categoryId: null, budgetBand: "15k_plus" }, { averages });
  ok("a stated budget band alone is NOT a figure", budgetOnly.basis === "unknown");
}

console.log("\nScope: the homeowner's counts, the company's own prices");
{
  const pricing = {
    cat_cab: { categoryId: "cat_cab", key: "cabinet_refinishing", label: "Cabinet Refinishing", book: getPriceBook("cabinet_refinishing", { perDoor: 120, perDrawer: 90 }), defaultRate: null, unit: null },
    cat_floor: { categoryId: "cat_floor", key: "flooring", label: "Flooring", book: getPriceBook("flooring", null), defaultRate: null, unit: null },
  };
  const tony = potentialValueForLead({ categoryId: "cat_cab", intake: { scope: { counts: { doors: 22, drawers: 15 } } } }, { pricing });
  ok("22 doors × 120 + 15 drawers × 90 from the company's OWN rates (an override, not the default)", tony.basis === "scope" && tony.amount === 22 * 120 + 15 * 90, JSON.stringify(tony));
  ok("…labelled with the counts it came from", tony.counts?.doors === 22 && tony.counts?.drawers === 15 && tony.service === "Cabinet Refinishing");
  const small = potentialValueForLead({ categoryId: "cat_cab", intake: { scope: { counts: { doors: 4 } } } }, { pricing });
  ok("the book's job minimum applies, and says so", small.amount === 3800 && small.minimumApplied === true, JSON.stringify(small));
  const inferred = potentialValueForLead({ categoryId: null, intake: { scope: { counts: { doors: 10, drawers: 2 } } } }, { pricing });
  ok("no service on the lead: the one per-piece cabinet service is used", inferred.basis === "scope" && inferred.amount === Math.max(3800, 10 * 120 + 2 * 90));
  const notSold = potentialValueForLead({ categoryId: "cat_roof", intake: { scope: { counts: { doors: 10 } } } }, { pricing });
  ok("a service the company does not price → no figure, and why", notSold.amount === null && notSold.why === "no_pricing");
  const sqft = potentialValueForLead({ categoryId: "cat_floor", intake: { scope: { counts: { sqft: 1000 } } } }, { pricing });
  ok("1000 sq ft × the flooring book's standard rate", sqft.basis === "scope" && sqft.amount === 7500, JSON.stringify(sqft));
  const formAnswers = leadScopeCounts({ intake: { doorCount: "18", drawerCount: 6, scope: { counts: { drawers: 8 } } } });
  ok("a form's doorCount is read; the conversation's count wins where both say", formAnswers.doors === 18 && formAnswers.drawers === 8);
  ok("garbage counts are no counts", Object.keys(leadScopeCounts({ intake: { doorCount: "x", scope: { counts: { doors: -3 } } } })).length === 0);
  const otherCompany = potentialValueForLead({ categoryId: "cat_cab", intake: { scope: { counts: { doors: 22 } } } }, { pricing: {} });
  ok("another company's prices are never reached: no pricing handed in → no figure", otherCompany.amount === null);
}

console.log("\nSummary strip");
{
  const leads = [
    { status: "new", potential: { amount: 1000, basis: "quote" } },
    { status: "new", potential: { amount: null, basis: "unknown" } },
    { status: "contacted", potential: { amount: 2500, basis: "scope" } },
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
  ok("API prices scope from the company's own services (company-scoped)", /loadScopePricing\(db, member\.companyId\)/.test(route) && !/wonAverages|loadWonAverages/.test(route));
  // 930e92bf added hasWork (the Won rule's evidence, which the board asks
  // before a drop) and routed the row through quoteEvidence(). Still a
  // whitelist: exactly these four keys, and null — never the raw row — when
  // quoteEvidence declines it.
  // 2026-10-05: the total joins the four keys — ONLY behind showMoney.
  ok(
    "API strips the quote's money back off the response (total only behind the pricing toggle)",
    /publicQuote = evidence\s*\?\s*\{\s*id: evidence\.id,\s*quoteNumber: evidence\.quoteNumber,\s*status: evidence\.status,\s*hasWork: evidence\.hasWork,\s*\.\.\.\(showMoney && \{ total: quoteMoney\(quote\) \}\),\s*\}\s*:\s*null;/.test(route) &&
      /quote: publicQuote,/.test(route),
  );
  ok("the averages module is gone", !fs.existsSync(path.join(ROOT, "lib/leads/wonAverages.js")));
  const page = read("app/app/leads/page.js");
  ok("page renders the strip only when a figure was attached", /showsMoney && \(leads \?\? \[\]\)\.length > 0 && \(\s*<PotentialStrip/.test(page));
  ok("card chip renders nothing for an unknown basis (only the drawer says why)", /potential\.basis === "unknown"\) \{\s*if \(!detail \|\| !potential\.counts\) return null;/.test(page));
  ok("no 'average' copy is rendered any more", !/app\.leads\.potential\.fromAverage/.test(page));
  ok("strip says 'not weighted'", /app\.leads\.potential\.notWeighted/.test(page));
  ok("currency comes from the company (useCompanyMoney)", /useCompanyMoney\(\)/.test(page));
  const msgs = read("app/i18n/appMessages.js");
  ok("nine languages carry the strip copy", (msgs.match(/"app\.leads\.potential\.noFigure"/g) || []).length === 9);
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
