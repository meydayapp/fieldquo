// scripts/check-compare-pages.mjs
//
//   npm run check:compare-pages
//
// Five public pages that name four real companies and argue we are the better
// buy. This is the check that stands between them and a false statement about
// somebody else's prices.
//
// ══ Why this is not the same job as check-competitors.mjs ══════════════════
//
// That file guards the DATA: 539 assertions that a figure carries a source, a
// vantage point, a verification and a coordinate on every axis its competitor
// declares, and that nothing in the module converts a currency. All of it is
// true whether or not a renderer pays any attention.
//
// This file guards the PAGE. lib/marketing/competitors.js can be immaculate
// and /compare can still print $49 as Jobber's price, because everything the
// module offers is advisory the moment a component decides to read COMPETITORS
// directly instead of publishableFigures(). An agent working on this repo this
// session shipped 75 passing assertions over a page that ignored the function
// they tested. So nothing below reads the page's source and infers behaviour
// from it: the real server components are executed and the assertions are made
// against the markup they return.
//
// ══ The five guarantees, and why each is here ══════════════════════════════
//
//   1. No page prints a figure publishableFigures() excludes. Both directions:
//      the published set must MATCH, so a page cannot pass by rendering
//      nothing, and cannot pass by rendering one row too many.
//
//   2. Every withheld figure shows its reason. competitors.js is explicit that
//      a labelled absence beats a blank cell and beats a number. Note the
//      second half of this one, which caught a real bug while this was being
//      written: several withholding reasons QUOTE the amount they are
//      refusing ("the relationship between the $49/mo regular rate and…"), so
//      printing a reason verbatim publishes the very figure it withholds.
//
//   3. Both directions appear on every page. FIELDQUO_LACKS is not decoration:
//      Housecall Pro's own plan list leads with a phone app and we have none.
//      A table of only our wins is an advertisement, and the contractor who
//      buys on it and then looks for the app is a refund plus a review.
//
//   4. No page claims a FieldQuo feature the matrix does not carry. A feature
//      named on a public page is the most expensive dead control in the
//      product.
//
//   5. Nothing is converted, and nothing loses its vantage point. Every figure
//      was read from a US connection and Jobber is Canadian; a figure quoted
//      out of the geography it was true in is wrong even when the number is
//      right.
//
// ══ Why the date the page speaks as of gets its own section ════════════════
//
// figureAgeDays, withholdReason and comparableTier all throw without an
// explicit asOf, and app/(marketing)/compare/asOf.js answers with the render
// moment rather than a date typed into the copy — precisely so STALE_AFTER_DAYS
// keeps working. That claim is worth nothing unless somebody watches the
// staleness path fire, so section 7 renders the real component ninety-one days
// forward and checks that Housecall Pro's prices turn into an admission.

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  COMPETITORS,
  FIELDQUO_CAPABILITIES,
  FIELDQUO_LACKS,
  FIELDQUO_REFERENCE,
  PRICE_AMOUNT,
  UNVERIFIED,
  allAddOns,
  claims,
  comparableTier,
  competitor as findCompetitor,
  publishableFigures,
  withholdReason,
} from "@/lib/marketing/competitors";
import { MATRIX_KEYS, matrixEntry } from "@/lib/marketing/featureMatrix";
import { SEAT_LADDER, SUPPORTED_CURRENCIES } from "@/lib/pricing/ladder";

import { renderAsOf } from "@/app/(marketing)/compare/asOf";
import {
  ADD_ON_COUNTERPARTS,
  addOnStack,
  coordinateLabel,
  counterpartsFor,
  totalOf,
} from "@/app/(marketing)/compare/addOns";
import { COMPARE_PAGES, comparePage } from "@/app/(marketing)/compare/compareCopy";
import CompareIndexPage, { comparisonSummary } from "@/app/(marketing)/compare/page";
import CompareSlugPage from "@/app/(marketing)/compare/[slug]/page";
import ComparisonPage, { redactAmounts } from "@/app/(marketing)/compare/[slug]/ComparisonPage";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : (console.log(`  ✗ ${label}`),
      fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`));

// ── Rendering the real thing ───────────────────────────────────────────────
//
// The exported page functions are called, not imitated. An earlier draft
// rendered ComparisonPage directly with a slug and every assertion passed —
// and deleting the whole of [slug]/page.js would have gone unnoticed, which is
// the failure AGENTS.md names: the component was right and nothing routed to
// it. So the slug pages go through their own default export, params arrives as
// the Promise Next 16 actually hands it, and the date the page uses is the one
// the page chose.
const renderSlugPage = async (slug) =>
  renderToStaticMarkup(await CompareSlugPage({ params: Promise.resolve({ slug }) }));

// The direct form, for the one thing the routed form cannot do: speak as of a
// date that is not today.
const renderAtDate = (slug, asOf) =>
  renderToStaticMarkup(createElement(ComparisonPage, { slug, asOf }));

/**
 * Markup with React's entity escaping undone.
 *
 * renderToStaticMarkup writes an apostrophe as `&#x27;`, so comparing a
 * sentence out of the data model against raw markup fails on every claim with
 * a possessive in it — "Jobber's price", "the whole crew's week". Three
 * assertions in this file were red for exactly that reason and not one of them
 * had found a real defect. Decoded once here rather than each assertion
 * learning to spell it; the raw markup is kept alongside, because attribute
 * matching wants what the browser actually receives.
 */
const decode = (html) =>
  html
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

// ── Everything below runs inside main() ────────────────────────────────────
//
// Not a style choice. This file is bundled to CommonJS before it runs (see
// package.json), because react-dom/server reaches for node's `util` through a
// require that an ESM bundle cannot satisfy — and CommonJS has no top-level
// await, while the routed page functions are async exactly as Next 16 makes
// them. Rendering them through their real signatures is the point of the
// file, so the wrapper is what pays for it.
async function main() {
  const TODAY = renderAsOf();

  const indexHtml = renderToStaticMarkup(CompareIndexPage());
  const pages = [];
  for (const entry of COMPARE_PAGES) {
    const html = await renderSlugPage(entry.slug);
    pages.push({
      ...entry,
      competitor: findCompetitor(entry.competitorId),
      html,
      text: decode(html),
    });
  }

  /**
   * Every element carrying `attr`, with its own subtree.
   *
   * A flat string search cannot answer the question this file is mostly about.
   * Jobber's suppressed annual rows hold the SAME amounts as the monthly rows
   * that publish — $399 and $599 both — so "does $599 appear in the HTML" says
   * nothing at all about whether a withheld figure leaked. Scoping to the row is
   * the difference between an assertion and a coincidence.
   *
   * Tag-balanced rather than regex-to-next-close, because these rows contain
   * nested elements of the same name.
   */
  function elementsWith(html, attr) {
    const out = [];
    const open = new RegExp(`<([a-zA-Z]+)([^>]*?\\s${attr}="([^"]*)"[^>]*?)>`, "g");
    let m;
    while ((m = open.exec(html))) {
      const tag = m[1];
      const value = m[3];
      const bodyStart = m.index + m[0].length;
      const walker = new RegExp(`<(/?)${tag}(?=[\\s/>])`, "g");
      walker.lastIndex = bodyStart;
      let depth = 1;
      let end = html.length;
      let t;
      while ((t = walker.exec(html))) {
        depth += t[1] === "/" ? -1 : 1;
        if (depth === 0) {
          end = t.index;
          break;
        }
      }
      const outer = html.slice(m.index, end);
      out.push({ value, inner: html.slice(bodyStart, end), outer, text: decode(outer) });
    }
    return out;
  }

  /** Every money amount printed anywhere in a blob of markup. */
  const amountsIn = (html) =>
    [...html.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g)].map((m) => Number(m[1].replace(/,/g, "")));

  const source = (path) => readFileSync(path, "utf8");
  const SLUG_PAGE = "app/(marketing)/compare/[slug]/page.js";
  const RENDERER = "app/(marketing)/compare/[slug]/ComparisonPage.js";
  const COPY = "app/(marketing)/compare/compareCopy.js";
  const INDEX_PAGE = "app/(marketing)/compare/page.js";
  const AS_OF = "app/(marketing)/compare/asOf.js";
  const ADDONS = "app/(marketing)/compare/addOns.js";
  const ADDON_BLOCK = "app/(marketing)/compare/AddOnStack.js";

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n1. Every page rendered at all, through its own route");
  // The cheapest thing to get wrong and the most expensive to discover late: a
  // page that throws renders nothing, and "no false claims" is trivially true of
  // an empty page.
  ok("the index renders", indexHtml.length > 2000, `${indexHtml.length} chars`);
  for (const p of pages) {
    ok(`/compare/${p.slug} renders`, p.html.length > 4000, `${p.html.length} chars`);
    ok(`...and names ${p.competitor.name}`, p.html.includes(p.competitor.name));
  }
  ok("a slug with no research 404s rather than rendering an empty page", await (async () => {
    // notFound() is stubbed inert for this bundle, so the page returns its
    // value; what matters is that the branch is taken and nothing is rendered.
    const out = await CompareSlugPage({ params: Promise.resolve({ slug: "fieldquo-vs-nobody" }) });
    return out === undefined || out === null;
  })());
  ok("every competitor in the data model has a page",
    COMPETITORS.every((c) => COMPARE_PAGES.some((p) => p.competitorId === c.id)),
    COMPETITORS.filter((c) => !COMPARE_PAGES.some((p) => p.competitorId === c.id)).map((c) => c.id).join(","));
  ok("...and no page names a competitor the data model does not carry",
    COMPARE_PAGES.every((p) => findCompetitor(p.competitorId)));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n2. No page prints a figure publishableFigures() excludes");
  //
  // Set EQUALITY, both directions. "Every rendered id is publishable" passes on a
  // page that renders nothing; "every publishable id is rendered" passes on a
  // page that renders everything. Only the pair is an assertion.
  for (const p of pages) {
    const expected = publishableFigures(TODAY)
      .filter((f) => f.competitorId === p.competitorId)
      .map((f) => f.id)
      .sort();
    const rendered = elementsWith(p.html, "data-published")
      .filter((el) => el.value === "true")
      .map((el) => /data-figure-id="([^"]+)"/.exec(el.outer)?.[1])
      .sort();
    ok(`${p.slug}: publishes exactly the ${expected.length} figures the module allows`,
      JSON.stringify(expected) === JSON.stringify(rendered),
      JSON.stringify(rendered));
  }
  // And the module's answer is not being re-derived here by accident: a figure
  // the module withholds must not appear as published on ANY page.
  {
    const withheldIds = COMPETITORS.flatMap((c) => c.figures)
      .filter((f) => withholdReason(f, TODAY) !== null)
      .map((f) => f.id);
    const publishedAnywhere = pages.flatMap((p) =>
      elementsWith(p.html, "data-published")
        .filter((el) => el.value === "true")
        .map((el) => /data-figure-id="([^"]+)"/.exec(el.outer)?.[1]),
    );
    ok("no withheld figure is rendered as a published one anywhere",
      withheldIds.every((id) => !publishedAnywhere.includes(id)),
      withheldIds.filter((id) => publishedAnywhere.includes(id)).join(","));
  }

  console.log("\n   ...and every amount on every page traces to something publishable");
  // The global net, under the per-row one. Add-ons are included deliberately:
  // competitors.js says they "carry the same guarantees and the same check
  // applies to them", and withholdReason is what decides, exactly as for a plan
  // figure. FieldQuo's own ladder is the third source and is imported, never
  // typed — a rung repriced in lib/pricing/ladder.js moves this set with it.
  //
  // The add-on TOTAL is the fourth source and it is DERIVED here, by calling
  // the same function the page calls, rather than being written into this set
  // as a number. Typing 177 into the allowlist would make this assertion agree
  // with a page that had the total hardcoded — which is precisely the failure
  // section 11 exists to catch.
  const allowedAmounts = new Set([
    ...publishableFigures(TODAY).filter((f) => f.price?.kind === PRICE_AMOUNT).map((f) => f.price.amount),
    ...allAddOns().filter((a) => withholdReason(a, TODAY) === null && a.price?.kind === PRICE_AMOUNT).map((a) => a.price.amount),
    ...SEAT_LADDER.map((t) => t.price),
    ...COMPETITORS.map((c) => addOnStack(c.id, TODAY).total).filter((n) => n !== null),
  ]);
  for (const p of [{ slug: "/compare (index)", html: indexHtml }, ...pages]) {
    const strays = [...new Set(amountsIn(p.html))].filter((n) => !allowedAmounts.has(n));
    ok(`${p.slug}: every printed amount is publishable`, strays.length === 0, strays.join(","));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n3. Every withheld figure shows its reason — and never its amount");
  for (const p of pages) {
    const shouldWithhold = p.competitor.figures
      .map((f) => ({ f, reason: withholdReason(f, TODAY) }))
      .filter((x) => x.reason !== null);
    const rows = elementsWith(p.html, "data-published").filter((el) => el.value === "false");
    const renderedIds = rows.map((el) => /data-figure-id="([^"]+)"/.exec(el.outer)?.[1]).sort();

    ok(`${p.slug}: all ${shouldWithhold.length} withheld figures are on the page`,
      JSON.stringify(shouldWithhold.map((x) => x.f.id).sort()) === JSON.stringify(renderedIds),
      JSON.stringify(renderedIds));

    for (const row of rows) {
      const id = /data-figure-id="([^"]+)"/.exec(row.outer)?.[1];
      const reason = /data-withhold-reason="([^"]*)"/.exec(row.outer)?.[1];
      ok(`${id}: carries a reason`, Boolean(reason && reason.trim().length > 3), reason);
      // The reason has to be READ, not just attached. A row whose attribute
      // holds a reason and whose visible text says "not available" is the blank
      // cell wearing a costume.
      ok(`${id}: the reason is in the visible text, not only in an attribute`,
        row.inner.includes("Not published here:"));
      // The bug this section exists for.
      ok(`${id}: prints no money at all`, amountsIn(row.outer).length === 0,
        amountsIn(row.outer).join(","));
    }
  }
  // The redactor, against the strings that actually caused the problem plus the
  // ones nobody has written yet.
  ok("redactAmounts removes a plain amount", !/\$\d/.test(redactAmounts("regular $49/mo rate")));
  ok("...and a thousands-separated one", redactAmounts("$4,788 Annually") === "[amount withheld] Annually");
  ok("...and a decimal one", redactAmounts("$0.79 each") === "[amount withheld] each");
  ok("...and every amount in a sentence, not just the first",
    (redactAmounts("$49 versus $29").match(/\[amount withheld\]/g) || []).length === 2);
  ok("...and leaves a reason with no money in it untouched",
    redactAmounts("the source states no currency") === "the source states no currency");
  ok("...and survives a null reason", redactAmounts(null) === "");
  // The real reasons, every one of them, through the real function.
  {
    const leaks = COMPETITORS.flatMap((c) => c.figures)
      .map((f) => withholdReason(f, TODAY))
      .filter((r) => r !== null)
      .filter((r) => /\$\d/.test(redactAmounts(r)));
    ok("no withholding reason in the data model survives redaction with money in it",
      leaks.length === 0, leaks.join(" | "));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n4. Both directions appear on every page");
  //
  // The concession panel is driven by FIELDQUO_LACKS, which is derived from the
  // capability ledger. That is what makes it unskippable: there is no per-page
  // list to leave a line out of, and the day a phone app ships the panel loses a
  // card on its own.
  for (const p of pages) {
    const lacks = elementsWith(p.html, "data-lacks").map((el) => el.value).sort();
    ok(`${p.slug}: every FieldQuo gap is on the page`,
      JSON.stringify(lacks) === JSON.stringify([...FIELDQUO_LACKS].sort()),
      JSON.stringify(lacks));

    const wins = elementsWith(p.html, "data-direction").filter((el) =>
      /data-direction="we-have-they-dont"/.test(el.outer),
    );
    ok(`${p.slug}: at least one verified advantage of ours`, wins.length > 0);

    // ── Position, and this assertion was INVERTED on purpose ──────────────
    //
    // It used to demand the concessions come FIRST, on the reasoning that a
    // concession under the closing CTA is a concession nobody reads. The
    // owner opened /compare and got our weaknesses as the first thing on the
    // page: "what the fuck is that.. we should focus on what we do best."
    //
    // He is right, and the original reasoning conflated two things. Including
    // the gaps is what keeps this a comparison rather than an advertisement.
    // Leading with them argues the other company's case in our own hero.
    //
    // So the rule is now a SANDWICH: after the price and after our advantages,
    // and still before the closing call to action — read by somebody who has
    // seen the case, not met by a stranger who has seen nothing.
    ok(`${p.slug}: the concessions come AFTER the advantages`,
      p.html.indexOf('data-lacks="') > p.html.indexOf('data-direction="we-have-they-dont"'));
    ok(`${p.slug}: ...and after the price comparison`,
      p.html.indexOf('data-lacks="') > p.html.indexOf('data-figure-id="'));
    // But still present, and still above the fold of the ending — a gap moved
    // into the footer is a gap deleted.
    ok(`${p.slug}: ...and still on the page`, p.html.includes('data-lacks="'));
  }
  ok("the index carries the concessions too",
    JSON.stringify(elementsWith(indexHtml, "data-lacks").map((e) => e.value).sort()) ===
      JSON.stringify([...FIELDQUO_LACKS].sort()));

  console.log("\n   ...and a claim about THEM is only made when somebody verified it");
  // Jobber's mobile-app entry is UNVERIFIED — widely true, never read off their
  // page. The page must concede our gap (which is our own fact and always safe)
  // without asserting theirs.
  {
    const jobber = pages.find((p) => p.competitorId === "jobber");
    const entry = findCompetitor("jobber").theyHaveWeDont.find((c) => c.capability === "mobile_app");
    ok("the Jobber mobile-app claim is still unverified in the data",
      entry.verification === UNVERIFIED, entry.verification);
    const card = elementsWith(jobber.html, "data-lacks").find((e) => e.value === "mobile_app");
    ok("...so the page does not print it as a fact", !card.text.includes(entry.claim));
    ok("...and says so instead", /data-unverified="true"/.test(card.outer));
    ok("...while still conceding that WE have no app",
      card.text.includes(FIELDQUO_CAPABILITIES.mobile_app.label));
  }
  // The other side of the same rule: a VERIFIED concession is quoted, with its
  // source and its date, because that is what makes it checkable.
  {
    const hcp = pages.find((p) => p.competitorId === "housecall_pro");
    for (const claim of claims("housecall_pro").theyHaveWeDont) {
      const card = elementsWith(hcp.html, "data-lacks").find((e) => e.value === claim.capability);
      ok(`Housecall Pro's verified "${claim.capability}" claim is quoted`,
        Boolean(card) && card.text.includes(claim.claim));
      ok(`...with its source and the date it was read`,
        card.text.includes(claim.source) && card.text.includes(claim.checked));
    }
  }
  // Nothing unpublishable sneaks in through the other direction either.
  for (const p of pages) {
    const unpublishable = claims(p.competitorId).weHaveTheyDont.filter((c) => !c.publishable);
    ok(`${p.slug}: no unverified advantage of ours is printed`,
      unpublishable.every((c) => !p.text.includes(c.claim)));
    // And every claim the module DOES bless is consistent with the ledger. An
    // inconsistent claim is a false statement about ourselves.
    ok(`${p.slug}: every printed advantage agrees with the capability ledger`,
      claims(p.competitorId).weHaveTheyDont.filter((c) => c.publishable).every((c) => c.consistent));
  }
  // The counterweight. Projul's own page argues a point in their favour inside a
  // note, and competitors.js warns that quoting the first half of that sentence
  // without the second is not honest. Cropping it would be a one-line edit.
  {
    const projul = pages.find((p) => p.competitorId === "projul");
    ok("Projul's page carries their own point in their favour",
      /data-counterpoint="monthly_billing"/.test(projul.html));
    ok("...and it says what their page says: no per-user fee, no project cap",
      /no per-user fee/.test(projul.html) && /projects/.test(projul.html));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n5. No page claims a FieldQuo feature the matrix does not carry");
  for (const p of pages) {
    const keys = elementsWith(p.html, "data-matrix-key").map((el) => el.value);
    ok(`${p.slug}: renders some feature rows`, keys.length > 0);
    ok(`${p.slug}: every one names a matrix entry`,
      keys.every((k) => MATRIX_KEYS.includes(k)),
      keys.filter((k) => !MATRIX_KEYS.includes(k)).join(","));
    for (const key of keys) {
      const entry = matrixEntry(key);
      const card = elementsWith(p.html, "data-matrix-key").find((e) => e.value === key);
      // The matrix's own words, not a paraphrase. A renderer that retypes a
      // feature name is a renderer that can rename it into something we do not do.
      ok(`${p.slug}/${key}: prints the matrix's name and summary`,
        card.text.includes(entry.name) && card.text.includes(entry.summary));
      if (entry.readiness === "partial") {
        // A partial feature is never a bare tick. The matrix requires `limits`
        // for this reason and the page has to show them.
        ok(`${p.slug}/${key}: shows where a partial feature stops`,
          card.text.includes(entry.limits));
      }
    }
  }
  // The structural half, and the stronger one: there is nowhere in the copy
  // module to write a feature name down. `features` is a list of keys and the
  // prose is checked for the fields that would let somebody bypass the matrix.
  {
    const copy = source(COPY);
    ok("the copy module holds no feature name or summary field",
      !/^\s*(name|summary):/m.test(copy));
    ok("...and every feature key it names resolves",
      COMPARE_PAGES.every((p) => p.features.every((k) => MATRIX_KEYS.includes(k))),
      COMPARE_PAGES.flatMap((p) => p.features).filter((k) => !MATRIX_KEYS.includes(k)).join(","));
    ok("...and the renderer reads the matrix rather than the copy for them",
      /matrixEntry\(key\)/.test(source(RENDERER)));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n6. Nothing is converted, and every figure keeps its vantage point");
  // ══ Two tiers, because one word list cannot do both jobs ═════════════════
  //
  // The blunt version — "the word 'converted' never appears on the page" — was
  // written first and went red on this page's OWN rules panel, which exists to
  // tell a reader that we never convert and why an exchange rate has no place
  // here. A checker that forbids explaining the rule forces the rule to go
  // unexplained: a worse page, and not one byte safer.
  //
  // So the tiers are: no page may carry the SHAPE of an approximated or
  // double-currency figure anywhere, and no figure ROW may carry the
  // vocabulary of a conversion. The rules panel is prose about our method,
  // sits in neither, and is allowed to say what it says.
  const APPROXIMATION = ["≈", "approx", "equivalent", "roughly $", "about $"];
  const CONVERSION_VOCABULARY = ["convert", "exchange rate", "cad equivalent", "usd equivalent"];
  for (const p of [{ slug: "/compare (index)", html: indexHtml }, ...pages]) {
    for (const word of APPROXIMATION) {
      ok(`${p.slug}: prints no approximated money ("${word}")`,
        !p.html.toLowerCase().includes(word.toLowerCase()));
    }
    // Two currency codes within reach of one amount is what a conversion looks
    // like from the outside, whether or not any arithmetic actually happened.
    const doubled = [...p.html.matchAll(/\$\s?\d[\d,]*(?:\.\d+)?[^<]{0,60}/g)].filter(
      (m) => SUPPORTED_CURRENCIES.filter((c) => m[0].includes(c)).length > 1,
    );
    ok(`${p.slug}: no amount is quoted in two currencies at once`, doubled.length === 0,
      doubled.map((m) => m[0]).join(" | "));
  }
  for (const p of pages) {
    const rows = [
      ...elementsWith(p.html, "data-figure-id"),
      ...elementsWith(p.html, "data-receptionist-figure"),
      ...elementsWith(p.html, "data-receptionist-addon"),
      ...elementsWith(p.html, "data-addon-id"),
      ...elementsWith(p.html, "data-addon-total"),
      ...elementsWith(p.html, "data-fieldquo-tier"),
    ];
    for (const word of CONVERSION_VOCABULARY) {
      ok(`${p.slug}: no figure row talks about "${word}"`,
        rows.every((r) => !r.text.toLowerCase().includes(word)));
    }
  }
  for (const p of pages) {
    for (const row of elementsWith(p.html, "data-published").filter((e) => e.value === "true")) {
      const id = /data-figure-id="([^"]+)"/.exec(row.outer)?.[1];
      const figure = p.competitor.figures.find((f) => f.id === id);
      if (figure.price?.kind !== PRICE_AMOUNT) continue;
      // Exactly one currency beside one amount. Two codes in one row is what a
      // conversion looks like from the outside, whether or not any arithmetic
      // happened.
      const codes = SUPPORTED_CURRENCIES.filter((c) => row.outer.includes(c));
      ok(`${id}: names its own currency and no other`,
        codes.length === 1 && codes[0] === figure.price.currency,
        codes.join(","));
      ok(`${id}: prints the amount the module holds`,
        row.outer.includes(`$${figure.price.amount.toLocaleString("en-US")}`));
    }
    // The vantage point travels with the figure. Both as data and as text — a
    // scope recorded in an attribute nobody renders is a scope nobody is told.
    for (const row of elementsWith(p.html, "data-observed-from")) {
      const id = /data-figure-id="([^"]+)"/.exec(row.outer)?.[1];
      const figure = p.competitor.figures.find((f) => f.id === id);
      ok(`${id}: carries the vantage point it was read from`,
        row.value === figure.observedFrom && row.inner.includes(figure.observedFrom),
        row.value);
      ok(`${id}: ...and the day it was read`, row.inner.includes(figure.checked));
    }
    const publishedRows = elementsWith(p.html, "data-observed-from").length;
    ok(`${p.slug}: every published figure carries a vantage point`,
      publishedRows === publishableFigures(TODAY).filter((f) => f.competitorId === p.competitorId).length,
      publishedRows);
  }
  // Jobber's is a limit, not a footnote: read from a US egress, from a Canadian
  // company, for an audience that is mostly Canadian.
  {
    const jobber = pages.find((p) => p.competitorId === "jobber");
    ok("Jobber's geographic caveat is on the Jobber page",
      jobber.text.includes(findCompetitor("jobber").geoCaveat));
    for (const p of pages.filter((x) => !findCompetitor(x.competitorId).geoCaveat)) {
      ok(`${p.slug}: invents no caveat for a competitor that declares none`,
        !/data-geo-caveat/.test(p.html));
    }
  }
  // FieldQuo's own side needs no conversion for a reason, and the page says it.
  ok("the pages explain why no conversion is needed rather than doing one",
    FIELDQUO_REFERENCE.sameNumberBothCurrencies &&
      pages.every((p) => SUPPORTED_CURRENCIES.every((c) => p.html.includes(c))));
  // Source-level: no arithmetic that could only be a rate. The conversion ban
  // covers every file on these pages including the two add-on ones.
  for (const path of [RENDERER, INDEX_PAGE, COPY, AS_OF, SLUG_PAGE, ADDONS, ADDON_BLOCK]) {
    ok(`${path}: defines no currency-conversion helper`,
      !/\b(fxRate|exchangeRate|convertCurrency|toCad|toUsd|inCad|inUsd)\b/i.test(source(path)));
  }
  // The arithmetic ban is narrower by ONE FILE, on purpose and with the reason
  // written down in both places. addOns.js adds three of a competitor's own
  // monthly add-on prices together, and its header argues why that is not the
  // thing this ban exists for: a conversion imports a number from outside their
  // pricing page and this imports nothing. Exempting it from a source regex
  // would be worthless on its own, so section 11 below EXECUTES the refusals
  // instead — two currencies, two billing periods, two coordinates and a
  // missing amount all have to come back as a refusal rather than a sum.
  for (const path of [RENDERER, INDEX_PAGE, COPY, AS_OF, SLUG_PAGE, ADDON_BLOCK]) {
    ok(`${path}: does no arithmetic on an amount`,
      !/(price\.amount|\.amount)\s*[*/+-]/.test(source(path)) &&
        !/[*/]\s*(rate|fx)\b/i.test(source(path)));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n7. The date the page speaks as of is real, and staleness bites");
  ok("renderAsOf answers with the date it is given, not a constant",
    renderAsOf(new Date("2027-01-02T11:00:00Z")) === "2027-01-02" &&
      renderAsOf(new Date("2026-08-28T23:00:00Z")) === "2026-08-28");
  ok("...in UTC, so two builders of the same commit agree",
    renderAsOf(new Date("2027-01-02T23:59:00Z")) === "2027-01-02");
  for (const p of pages) {
    ok(`${p.slug}: prints the date it is speaking as of`, p.html.includes(`data-as-of="${TODAY}"`));
  }
  ok("the index prints one too", indexHtml.includes(`data-as-of="${TODAY}"`));
  ok("the route hands the render date down rather than the component reading a clock",
    /renderAsOf\(\)/.test(source(SLUG_PAGE)) && !/new Date\(/.test(source(RENDERER)));
  // The path nobody exercises by hand: what this page looks like when nobody has
  // re-read a competitor's pricing page in three months. If asOf were pinned to
  // a constant, this section would be unwritable — which is the argument in
  // asOf.js, executed.
  {
    const hcp = COMPARE_PAGES.find((p) => p.competitorId === "housecall_pro");
    const fresh = renderAtDate(hcp.slug, "2026-08-28");
    const stale = renderAtDate(hcp.slug, "2026-12-01"); // 95 days after the read
    const freshPublished = elementsWith(fresh, "data-published").filter((e) => e.value === "true");
    const stalePublished = elementsWith(stale, "data-published").filter((e) => e.value === "true");
    ok("on the day it was read, Housecall Pro's prices publish", freshPublished.length === 4,
      freshPublished.length);
    ok("...ninety-five days later, none of them does", stalePublished.length === 0,
      stalePublished.length);
    ok("...and the page says how old the reading is instead",
      /days ago/.test(stale) && stale.includes("Not published here:"));
    ok("...printing no price at all", amountsIn(
      elementsWith(stale, "data-published").filter((e) => e.value === "false").map((e) => e.outer).join(""),
    ).length === 0);
    // The section that would otherwise quietly become an advertisement.
    ok("...while still conceding everything we lack",
      FIELDQUO_LACKS.every((k) => stale.includes(`data-lacks="${k}"`)));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n8. The receptionist is matched on contents, not on table position");
  //
  // The $200 mistake, made concrete. Jobber Grow sits third in their table the
  // way Scale sits fourth in ours, and Grow has no receptionist — so name
  // matching compares us against $399 for a plan that cannot do the thing, and
  // credits it with doing the thing.
  {
    const jobber = pages.find((p) => p.competitorId === "jobber");
    const tier = comparableTier("jobber", { feature: "ai_receptionist" }, TODAY);
    ok("comparableTier finds a Jobber tier that actually carries it", Boolean(tier), String(tier));
    ok("...and it is Plus, not Grow", tier.label === "Plus", tier.label);
    ok("the page compares against that tier", jobber.html.includes(`data-receptionist-figure="${tier.id}"`));
    const grow = findCompetitor("jobber").figures.filter((f) => f.label === "Grow");
    ok("...and against none of the Grow rows",
      grow.every((f) => !jobber.html.includes(`data-receptionist-figure="${f.id}"`)));
    ok("...with the selectors the figure was read at, so it is not quoted out of them",
      jobber.html.includes("6-10 people") && jobber.html.includes("Monthly, no commitment"));
    // Their floor, which is the actual argument.
    const addOn = allAddOns().find((a) => a.id === "jobber.addon.ai_receptionist");
    ok("their add-on entry point is on the page",
      jobber.html.includes(`data-receptionist-addon="${addOn.id}"`) &&
        jobber.html.includes(`$${addOn.price.amount}`));

    // Ours, stated narrowly on purpose. "AI included" would be false: the
    // feature is on every plan and the talk time is prepaid credit
    // (lib/voice/credits.js). "No monthly minimum" is true and stronger.
    ok("FieldQuo's receptionist is described as usage-extra, never as included",
      jobber.html.includes('data-fieldquo-availability="included_usage_extra"'));
    ok("...and the words for the two states are not the same words",
      /in the plan price/.test(jobber.html) && /prepaid credit/.test(jobber.html));
    ok("...and the claim we make is the no-monthly-minimum one",
      jobber.text.includes(FIELDQUO_CAPABILITIES.ai_receptionist_no_monthly_floor.label));
    ok("...and the page never says our AI is included in the price",
      !/AI (receptionist )?included/i.test(jobber.html));

    // Nobody inspected the other three for this feature, so the section must not
    // exist on their pages. FEATURE_UNKNOWN is not FEATURE_ABSENT and neither is
    // an invitation to guess.
    for (const p of pages.filter((x) => x.competitorId !== "jobber")) {
      ok(`${p.slug}: makes no receptionist comparison, because none was verified`,
        !/data-receptionist-figure/.test(p.html));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n9. The index tells the truth about what each page can do");
  ok("one card per comparison page",
    COMPARE_PAGES.every((p) => indexHtml.includes(`data-compare-slug="${p.slug}"`)) &&
      elementsWith(indexHtml, "data-compare-slug").length === COMPARE_PAGES.length);
  ok("...each linking at the route that exists",
    COMPARE_PAGES.every((p) => indexHtml.includes(`href="/compare/${p.slug}"`) && comparePage(p.slug)));
  // The summaries are computed, so they are executed here rather than read.
  {
    const st = comparisonSummary(findCompetitor("servicetitan"), TODAY).join(" ");
    ok("ServiceTitan's card says they publish no amount", /publish no amount/.test(st));
    ok("...and does not claim a comparable price", !/set beside ours/.test(st));

    const projul = comparisonSummary(findCompetitor("projul"), TODAY).join(" ");
    ok("Projul's card says nothing of theirs can be compared",
      /Nothing they publish can be compared/.test(projul));
    ok("...and names how many figures are being held back", /3 further figures are held back/.test(projul));

    const hcp = comparisonSummary(findCompetitor("housecall_pro"), TODAY).join(" ");
    ok("Housecall Pro's card counts their comparable prices", /^4 of their published prices/.test(hcp));

    // The count is derived, not typed: a date past the staleness window empties it.
    const staleHcp = comparisonSummary(findCompetitor("housecall_pro"), "2026-12-01").join(" ");
    ok("...and that count follows the data rather than the copy",
      /Nothing they publish can be compared/.test(staleHcp));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n10. The copy module stays copy");
  //
  // Its header promises it holds no number, no price and no claim about a
  // competitor — that all of it comes from the two source modules. A promise in
  // a comment is worth what the check beside it is worth.
  {
    const copy = source(COPY);
    const body = copy.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    ok("no money amount anywhere in the copy", !/\$\s?\d/.test(body));
    ok("no currency code in the copy", !SUPPORTED_CURRENCIES.some((c) => body.includes(c)));
    ok("the copy imports nothing from the competitor data",
      !/from "@\/lib\/marketing\/competitors"/.test(copy));
    ok("every page entry names a competitor id, not a company name in prose",
      COMPARE_PAGES.every((p) => typeof p.competitorId === "string" && findCompetitor(p.competitorId)));
    // The translation debt, on the record rather than in a commit message.
    ok("the copy module records that these pages are English-only",
      /English-only|English, in a plain module/.test(copy));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n11. What they sell ON TOP of the plan");
  //
  // Three add-ons, one total, and a mapping onto features we actually ship.
  // The total is the dangerous part: it is the sentence a visitor remembers,
  // it is arithmetic on somebody else's prices, and the obvious way to write it
  // is to type it. So it is asserted three ways — equal to the module's answer,
  // equal to an independent sum of the amounts actually RENDERED, and absent as
  // a literal from every file that could have typed it.
  {
    const jobber = pages.find((p) => p.competitorId === "jobber");
    const stack = addOnStack("jobber", TODAY);

    ok("Jobber's add-ons publish and may honestly be totalled", stack.refusal === null,
      String(stack.refusal));
    ok("...all three of them", stack.items.length === 3, stack.items.length);
    ok("the block is on the Jobber page", /data-addon-stack="jobber"/.test(jobber.html));

    const renderedIds = elementsWith(jobber.html, "data-addon-id").map((e) => e.value).sort();
    const expectedIds = stack.items.map((a) => a.id).sort();
    ok("...rendering exactly the add-ons the module publishes",
      JSON.stringify(renderedIds) === JSON.stringify(expectedIds), JSON.stringify(renderedIds));
    // Both directions again: an add-on the module withholds must not appear.
    {
      const withheldAddOns = allAddOns()
        .filter((a) => withholdReason(a, TODAY) !== null)
        .map((a) => a.id);
      ok("...and none the module withholds",
        withheldAddOns.every((id) => !jobber.html.includes(`data-addon-id="${id}"`)),
        withheldAddOns.join(","));
    }

    for (const addOn of stack.items) {
      const row = elementsWith(jobber.html, "data-addon-id").find((e) => e.value === addOn.id);
      ok(`${addOn.id}: names the add-on as their page does`, row.text.includes(addOn.label));
      ok(`${addOn.id}: prints the amount the module holds`,
        row.outer.includes(`$${addOn.price.amount.toLocaleString("en-US")}`));
      ok(`${addOn.id}: names its own currency and no other`, (() => {
        const codes = SUPPORTED_CURRENCIES.filter((c) => row.outer.includes(c));
        return codes.length === 1 && codes[0] === addOn.price.currency;
      })());
      ok(`${addOn.id}: carries the day and the country it was read`,
        row.text.includes(addOn.checked) && row.text.includes(addOn.observedFrom));
      ok(`${addOn.id}: links their own page`, row.outer.includes(addOn.source));
      // Their own product name, not one we assembled. One of the three already
      // carries the company name, and prefixing it unconditionally produced
      // "Jobber Jobber AI Receptionist" — a name they have never used.
      ok(`${addOn.id}: is not named twice over`,
        !new RegExp(`${jobber.competitor.name}\\s+${jobber.competitor.name}`, "i").test(row.text));
      // The coordinate, in the same words the figure rows above use. Their
      // prices move with two selectors; a price quoted out of them is a
      // different number to a different reader.
      ok(`${addOn.id}: is placed on their own selectors`,
        jobber.text.includes(coordinateLabel(addOn.axis)));
    }

    // ── The total ──────────────────────────────────────────────────────────
    const totalAttr = elementsWith(jobber.html, "data-addon-total")[0];
    ok("the total is on the page", Boolean(totalAttr), String(totalAttr));
    ok("...and it is the module's number", Number(totalAttr.value) === stack.total,
      `${totalAttr.value} vs ${stack.total}`);
    ok("...and it is printed, not only attached", totalAttr.text.includes(`$${stack.total}`));
    // Independent of the module: add up what the ROWS actually printed.
    {
      const rowAmounts = elementsWith(jobber.html, "data-addon-id").flatMap((r) => amountsIn(r.outer));
      const summed = rowAmounts.reduce((a, b) => a + b, 0);
      ok("...and it equals the sum of the amounts the page printed", summed === stack.total,
        `${summed} vs ${stack.total}`);
    }
    // The mutation this is really guarding: somebody typing the number.
    for (const path of [ADDONS, ADDON_BLOCK, "app/(marketing)/pricing/PricingPlans.js"]) {
      const body = source(path).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
      ok(`${path}: does not carry the total as a literal`,
        !new RegExp(`\\b${stack.total}\\b`).test(body));
    }
    ok("...and the currency beside it is the one every item was published in",
      totalAttr.outer.includes(`data-addon-currency="${stack.currency}"`) &&
        totalAttr.text.includes(stack.currency));

    // ── Refusals, executed against input the live data does not contain ────
    //
    // Every one of these is a total that must not be produced. None of them can
    // happen today, which is exactly why they are checked here rather than left
    // to the data staying convenient.
    {
      const usd = (amount, axis) => ({ price: { kind: PRICE_AMOUNT, amount, per: "month", currency: "USD" }, axis });
      const axis = { teamSize: "solo", billing: "annual_prepaid" };
      ok("two of the same shape do total", totalOf([usd(10, axis), usd(5, axis)]).total === 15);
      ok("...and nothing else is invented with it",
        totalOf([usd(10, axis), usd(5, axis)]).currency === "USD");
      ok("a single add-on is not dressed up as a total",
        totalOf([usd(10, axis)]).total === null && /nothing to total/.test(totalOf([usd(10, axis)]).refusal));
      ok("an empty set totals nothing", totalOf([]).total === null);
      ok("...and a non-list too", totalOf(undefined).total === null);
      ok("two currencies refuse, and say it would be a conversion", (() => {
        const r = totalOf([usd(10, axis), { price: { kind: PRICE_AMOUNT, amount: 5, per: "month", currency: "CAD" }, axis }]);
        return r.total === null && /conversion/.test(r.refusal);
      })());
      ok("two billing periods refuse", (() => {
        const r = totalOf([usd(10, axis), { price: { kind: PRICE_AMOUNT, amount: 5, per: "year", currency: "USD" }, axis }]);
        return r.total === null && /cannot be added/.test(r.refusal);
      })());
      ok("two points on their selectors refuse", (() => {
        const r = totalOf([usd(10, axis), usd(5, { teamSize: "6-10", billing: "monthly_none" })]);
        return r.total === null && /different points/.test(r.refusal);
      })());
      ok("a price with no amount refuses rather than counting as zero", (() => {
        const r = totalOf([usd(10, axis), { price: { kind: "on_request", ask: "Contact Sales" }, axis }]);
        return r.total === null && /absent price is not zero/.test(r.refusal);
      })());
      ok("...and so does a missing price altogether", totalOf([usd(10, axis), { axis }]).total === null);
    }

    // ── Our side of it ─────────────────────────────────────────────────────
    const counterpartKeys = elementsWith(jobber.html, "data-addon-counterpart").map((e) => e.value);
    ok("every FieldQuo counterpart names a matrix entry",
      counterpartKeys.length > 0 && counterpartKeys.every((k) => MATRIX_KEYS.includes(k)),
      counterpartKeys.filter((k) => !MATRIX_KEYS.includes(k)).join(","));
    ok("...and exactly the ones the mapping declares",
      JSON.stringify([...counterpartKeys].sort()) ===
        JSON.stringify(stack.items.flatMap((a) => [...ADD_ON_COUNTERPARTS[a.id]]).sort()),
      counterpartKeys.join(","));
    // The seven the owner named, resolved through the mapping rather than
    // listed here twice.
    for (const key of ["email_campaigns", "door_hanger_routes", "review_requests",
      "voice_receptionist", "call_to_quote", "leads", "funnels"]) {
      ok(`the mapping covers ${key}`, counterpartKeys.includes(key));
    }
    for (const key of counterpartKeys) {
      const entry = matrixEntry(key);
      const card = elementsWith(jobber.html, "data-addon-counterpart").find((e) => e.value === key);
      ok(`${key}: prints the matrix's own name and proved sentence`,
        card.text.includes(entry.name) && card.text.includes(entry.summary));
      // A partly-built feature is never a bare tick. door_hanger_routes is the
      // live case: we plan and track the walk and print nothing.
      if (entry.readiness === "partial") {
        ok(`${key}: is partial, so its limit is on the page`,
          card.text.includes(entry.limits) && /data-addon-limits/.test(card.outer));
      }
    }
    ok("at least one counterpart is only partly built, and says so",
      counterpartsFor("jobber.addon.marketing_suite").some((e) => e.readiness === "partial") &&
        /data-addon-limits="door_hanger_routes"/.test(jobber.html));
    // The block says what it did NOT establish. We read a label and a price.
    ok("the block says what is inside their add-on was not checked",
      /is not something we have checked/i.test(jobber.text));

    // ── The receptionist sentence, word for word ───────────────────────────
    //
    // The one claim in this block that is easy to make false by tidying it.
    // "Included minutes" or "N conversations included" would describe a product
    // we do not sell: lib/voice/credits.js is explicit that the talk time is
    // prepaid credit and is NOT bundled as a number of conversations.
    ok("the block makes the no-monthly-minimum claim",
      jobber.text.includes(FIELDQUO_CAPABILITIES.ai_receptionist_no_monthly_floor.label));
    ok("...in those words, not paraphrased", /no monthly minimum/i.test(jobber.text));
    ok("...and says their floor is charged when the phone never rings",
      /never rings/i.test(jobber.text));
    for (const phrase of [
      /included minutes/i,
      /minutes included/i,
      /conversations included/i,
      /included conversations/i,
      /free minutes/i,
      /unlimited (calls|minutes)/i,
    ]) {
      ok(`the block never says ${phrase}`, !phrase.test(jobber.text));
    }
    ok("...and still says the talk time is prepaid credit", /prepaid credit/i.test(jobber.text));

    // ── Nobody else gets one ───────────────────────────────────────────────
    for (const p of pages.filter((x) => x.competitorId !== "jobber")) {
      ok(`${p.slug}: no add-on block, because no add-on prices were read`,
        !/data-addon-stack/.test(p.html) && !/data-addon-total/.test(p.html));
    }
    // And the whole block leaves with the prices when the reading goes stale —
    // the same degradation the figure rows have, asserted rather than assumed.
    {
      const stale = renderAtDate("fieldquo-vs-jobber", "2026-12-01");
      ok("ninety-five days on, the add-on block is gone", !/data-addon-stack/.test(stale));
      ok("...and its total with it", !stale.includes(`$${stack.total}`));
      ok("...while the concessions stay",
        FIELDQUO_LACKS.every((k) => stale.includes(`data-lacks="${k}"`)));
    }
  }

  console.log(
    fails.length
      ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
      : `\nPASSED — ${pass}/${pass} assertions`,
  );
  process.exit(fails.length ? 1 : 0);

}

main();
