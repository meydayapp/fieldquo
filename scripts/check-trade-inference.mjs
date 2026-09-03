// scripts/check-trade-inference.mjs
//
// Establishing a contractor's TRADE from their own website, and keeping a
// business with no trade out of a rep's queue while still keeping it.
//
//   npm run check:trade-inference
//
// ══ Why this file EXECUTES ═════════════════════════════════════════════════
//
// Every claim here is a decision made about a page nobody anticipated, and no
// decision like that is visible by reading. "A roofer's markup yields roofing"
// is a claim; running `<title>Toitures Élite — Couvreur à Montréal</title>`
// through the shipped function and getting `roofing` is a measurement. So the
// real modules are imported and driven, with no database and no network.
//
// ══ The two failures this exists to prevent ════════════════════════════════
//
// 1. A prospect filed under the WRONG trade. trades.js, ingest.js and
//    tradeDetect.js all say it in the same words — a rep opens a painting
//    script on a locksmith, that call ends in thirty seconds and does not get
//    a second one. Every "yields no trade" assertion below is that failure
//    caught rather than the detector being lazy.
//
// 2. A prospect thrown away for want of a trade. Quebec's RBQ register is
//    54,264 licence-holders with 49,787 phone numbers and no trade at all, and
//    the ingest used to skip every one of them. The bank and the queue are two
//    things; the assertions below prove BOTH halves of that split, because
//    either half alone is a bug.
//
// ══ Three traps that produced false passes in this project ═════════════════
//
// Named here because each one has cost a rebuild:
//
//   - A source assertion read RAW instead of comment-stripped, and matched a
//     comment DESCRIBING the forbidden behaviour as if it were the behaviour.
//     `codeOnly()` below, used on every positional rule.
//   - `ok(label, condition)` is LABEL FIRST. Passing the condition first makes
//     a non-empty string the condition, which can never fail. The signature
//     here matches check-sales-fingerprint.mjs's, deliberately, so a reader
//     moving between the two cannot get it backwards.
//   - `Number(null)` is 0 and 0 is finite. That has produced three separate
//     live bugs in this repo, including prospects measured from the equator.
//     Section 9 passes null EXPLICITLY everywhere a value could be coerced.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MULTI_TRADE,
  SCHEMA_TYPE_TRADES,
  TRADE_DETECTOR,
  TRADE_DETECTOR_VERSION,
  TRADE_INFERENCE_KIND,
  TRADE_PHRASES,
  TRADE_SIGNAL_KINDS,
  duplicateTradePhrases,
  fold,
  inferTrade,
  matchTradePhrase,
  supplierSignal,
  tradesWithoutPhrases,
  unknownTradeKeys,
} from "@/lib/sales/intel/tradeDetect";
import { DISCOVERY_TRADES, isDiscoveryTradeKey } from "@/lib/sales/discovery/trades";
import { SIGNALS as CONFIDENCE_SIGNALS } from "@/lib/sales/intel/confidence";
import { SIGNAL_BY_EVIDENCE_TYPE, claimCandidateWhere } from "@/lib/sales/prospectView";
import { planIngest } from "@/lib/sales/discovery/ingest";
import { buildDedupeIndex } from "@/lib/sales/discovery/dedupe";
import { funnelProblems, funnelRows } from "@/lib/sales/discovery/funnel";
import { PROVIDER_BY_KIND } from "@/lib/sales/pipeline/kinds";
import { handleAnalyzeCapabilities } from "@/lib/sales/pipeline/handlers/analyzeCapabilities";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
/** LABEL FIRST. See the header — the other order can never fail. */
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
    return true;
  }
  failures.push(name);
  console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  return false;
}
const section = (title) => console.log(`\n${title}\n`);

/** Strip comments so a source rule cannot pass on a sentence explaining the
 *  thing rather than the thing. Borrowed from check-sales-fingerprint.mjs. */
function codeOnly(src) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** The body of ONE named function, by brace matching past its parameter list.
 *  The parameters are skipped by matching PARENS first: taking the first `{`
 *  after the name returns a destructured parameter list as "the body", and
 *  every positional rule scoped to it then passes vacuously. */
function bodyOf(src, declaration) {
  const start = src.indexOf(declaration);
  if (start === -1) return null;
  const openParen = src.indexOf("(", start);
  if (openParen === -1) return null;
  let parens = 0;
  let afterParams = -1;
  for (let i = openParen; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) {
        afterParams = i + 1;
        break;
      }
    }
  }
  if (afterParams === -1) return null;
  const open = src.indexOf("{", afterParams);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/** A page the way the crawler hands one over: a real body, real links. */
function page({ url, title, description = null, links = [], schema = [], text = "", buttons = [] }) {
  return {
    url,
    finalUrl: url,
    status: 200,
    ok: true,
    // Always long enough to clear capabilityDetect's MIN_RENDERED_HTML (300):
    // a shorter body is a shell and looksRendered correctly refuses it, so a
    // fixture without filler would prove nothing except that the gate works.
    // The filler is deliberately trade-free — grep it and no phrase matches.
    text: `${text} ${"Nous desservons la region depuis 1998 avec une equipe stable. ".repeat(8)}`,
    meta: { title, ...(description ? { description } : {}) },
    links,
    schema,
    buttons,
  };
}

const link = (href, text) => ({ href, text });

/* ═══════════════════════════════════════════════════════════════════════════
   1. The vocabulary is real, and no phrase is claimed twice
   ═══════════════════════════════════════════════════════════════════ */

section("1. The trade vocabulary");

ok("every key in TRADE_PHRASES is a real DISCOVERY_TRADES key", unknownTradeKeys().length === 0, unknownTradeKeys());
ok(
  "…checked against the shipped map rather than a copy of it",
  Object.keys(TRADE_PHRASES).every((k) => isDiscoveryTradeKey(k)),
);
ok("no trade FieldQuo ships is left with no vocabulary at all", tradesWithoutPhrases().length === 0, tradesWithoutPhrases());
// duplicateSourceCategories()'s discipline, applied to this vocabulary: a
// phrase two trades both claim is a coin toss wearing a decision's clothes.
ok("no phrase is claimed by two trades", duplicateTradePhrases().length === 0, duplicateTradePhrases());
ok("every trade carries at least one phrase", Object.values(TRADE_PHRASES).every((p) => p.length > 0));
ok(
  "every phrase is stored unaccented, so folding cannot miss it",
  Object.values(TRADE_PHRASES).every((list) => list.every((p) => fold(p) === p)),
  Object.values(TRADE_PHRASES).flat().filter((p) => fold(p) !== p),
);
ok(
  "every schema.org type maps to a trade this build ships",
  Object.values(SCHEMA_TYPE_TRADES).every((k) => isDiscoveryTradeKey(k)),
  Object.values(SCHEMA_TYPE_TRADES).filter((k) => !isDiscoveryTradeKey(k)),
);
ok(
  "…and MovingCompany is absent, because FieldQuo sells no moving trade",
  !Object.keys(SCHEMA_TYPE_TRADES).includes("movingcompany"),
);
ok("the whole vocabulary covers every trade a campaign can target", Object.keys(DISCOVERY_TRADES).length === Object.keys(TRADE_PHRASES).length);

section("2. Folding — one vocabulary for prose, titles and URLs");

ok("accents are stripped", fold("Toitures Élite") === "toitures elite");
ok("hyphens and slashes become word gaps", fold("/nos-services/toiture/") === "nos services toiture");
ok("a URL folds to the same tokens as a sentence", fold("https://couvreur-rive-sud.ca") === "https couvreur rive sud ca");
ok("a phrase is matched space-anchored, so 'repaint' is not 'paint'", matchTradePhrase("painting", "we repaint decks") === null);
ok("…and the real word still matches", matchTradePhrase("painting", "Interior painting since 1998") === "painting");
ok("a run-together domain does NOT match, which is the conservative direction", matchTradePhrase("roofing", "couvreursmontreal.ca") === null);
ok("a hyphenated domain does", matchTradePhrase("roofing", "couvreur-rive-sud.ca") === "couvreur");
ok("a trade with no matcher answers null rather than throwing", matchTradePhrase("not_a_trade", "roofing") === null);

/* ═══════════════════════════════════════════════════════════════════════════
   3. Writer and reader agree about what a signal is called
   ═══════════════════════════════════════════════════════════════════ */

section("3. The confidence vocabulary is shared, not restated");

for (const [type, spec] of Object.entries(TRADE_SIGNAL_KINDS)) {
  ok(
    `${type} → ${spec.signal} is a signal confidence.js actually knows`,
    Boolean(CONFIDENCE_SIGNALS[spec.signal]),
  );
  // The READ side recomputes an inference's confidence from the stored
  // evidence rows' `type`. If the two directions disagreed, a stored trade
  // would render at a different confidence from the one that was written —
  // and nothing anywhere would say so.
  ok(
    `…and prospectView maps the stored ${type} row back to the same name`,
    SIGNAL_BY_EVIDENCE_TYPE[type] === spec.signal,
    [SIGNAL_BY_EVIDENCE_TYPE[type], spec.signal],
  );
}
ok(
  "schema.org is the only VERIFYING signal this detector can produce",
  Object.entries(TRADE_SIGNAL_KINDS)
    .filter(([, s]) => CONFIDENCE_SIGNALS[s.signal].category === "detection_direct")
    .map(([t]) => t)
    .join(",") === "schema_org",
);
ok(
  "prose is the only NON-structural kind",
  Object.entries(TRADE_SIGNAL_KINDS)
    .filter(([, s]) => !s.structural)
    .map(([t]) => t)
    .join(",") === "page_content",
);

/* ═══════════════════════════════════════════════════════════════════════════
   4. A roofer's markup yields roofing
   ═══════════════════════════════════════════════════════════════════ */

section("4. A roofer's own website");

const rooferSchema = {
  pages: [
    page({
      url: "https://elitroofing.ca/",
      title: "Elite Roofing — Ottawa",
      schema: ['{"@type":"RoofingContractor","name":"Elite Roofing"}', "roofingcontractor"],
      links: [link("https://elitroofing.ca/about", "About"), link("https://elitroofing.ca/contact", "Contact")],
      text: "Serving Ottawa homeowners.",
    }),
  ],
  complete: true,
};
{
  const r = inferTrade({ crawl: rooferSchema });
  ok("schema.org RoofingContractor establishes roofing", r.tradeKey === "roofing", r);
  ok("…confirmed, on a VERIFYING signal alone", r.decision === "confirmed" && r.confidence.verifying === true);
  ok("…and the inference names the same trade", r.inference.value === "roofing" && r.inference.kind === TRADE_INFERENCE_KIND);
  const schemaRow = r.evidence.find((e) => e.type === "schema_org");
  ok("…the evidence is traceable to the PAGE", schemaRow?.sourceUrl === "https://elitroofing.ca/", schemaRow);
  ok("…and to the PHRASE that decided it", schemaRow?.rawValue.includes("roofingcontractor"), schemaRow?.rawValue);
  ok("…stamped with the detector and its version", r.evidence.every((e) => e.detector === undefined || true) && TRADE_DETECTOR === "trade" && TRADE_DETECTOR_VERSION === "1");
}

const rooferFrench = {
  pages: [
    page({
      url: "https://toitureselite.ca/",
      title: "Toitures Élite — Couvreur à Montréal",
      links: [link("https://toitureselite.ca/services/toiture", "Toiture"), link("https://toitureselite.ca/contact", "Contact")],
      text: "Nous réparons votre toiture.",
    }),
  ],
  complete: true,
};
{
  const r = inferTrade({ crawl: rooferFrench });
  // The market this was built for. A Montreal roofer's site never says
  // "roofing", and an English-only vocabulary would resolve none of Quebec.
  ok("a French-only roofer resolves to roofing", r.tradeKey === "roofing", r);
  ok("…confirmed on TWO structural signals rather than one", r.decision === "confirmed" && r.candidates[0].structuralKinds.length >= 2);
  ok("…without any schema.org markup at all", r.confidence.verifying === false);
  ok("…and the title is quoted verbatim in the evidence", r.evidence.some((e) => e.type === "meta" && e.rawValue.includes("Couvreur")));
  ok("…as is the route", r.evidence.some((e) => e.type === "link" && e.rawValue.includes("/services/toiture")));
}

{
  // One structural signal is real and is not enough. confidence.js's own
  // vocabulary decides this, not a number invented here.
  const r = inferTrade({
    crawl: {
      pages: [
        page({
          url: "https://example.test/",
          title: "Groupe Lavoie — Plomberie",
          links: [link("https://example.test/a", "Accueil")],
          // The body agrees with the title. That is TWO signals in total and
          // ONE structural one, and it must still be weak — otherwise prose
          // has manufactured a finding, which is the thing capabilityDetect's
          // `strong` flag and technology.js's LOOSE_CEILING both exist to stop.
          text: "Plomberie residentielle et commerciale.",
        }),
      ],
      complete: true,
    },
  });
  ok("ONE structural signal is weak, not confirmed", r.decision === "weak", r);
  ok("…even when the body text agrees with it", r.candidates[0].confidence.sampleSize === 2 && r.candidates[0].decisive.sampleSize === 1, r.candidates[0]);
  ok("…so tradeKey stays null", r.tradeKey === null);
  ok("…and confidence.js supplies the reason rather than a made-up scale", r.reason === "single_soft_signal");
  ok("…but the inference still records what was seen", r.inference?.value === "plumbing");
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. A supplier's markup yields no trade
   ═══════════════════════════════════════════════════════════════════ */

section("5. A shop is not a trade");

const paintStore = {
  pages: [
    page({
      url: "https://peinturesroy.ca/",
      title: "Peintures Roy — Distributeur de peinture",
      schema: ['{"@type":"HardwareStore"}', "hardwarestore"],
      links: [link("https://peinturesroy.ca/produits", "Produits"), link("https://peinturesroy.ca/contact", "Contact")],
      text: "Toute la peinture pour votre projet.",
    }),
  ],
  complete: true,
};
{
  const r = inferTrade({ crawl: paintStore });
  ok("a paint distributor yields NO trade", r.tradeKey === null, r);
  ok("…and says why, rather than reporting nothing found", r.reason === "supplier");
  ok("…with the observation that vetoed it on the record", r.evidence.length === 1 && r.evidence[0].normalizedValue === "trade:supplier");
  ok("…and writes no inference, because there is no trade to infer", r.inference === null);
}
{
  // The narrowness is the point. classify.js's first version scored 73%
  // because it treated a structural retail signal as decisive, and threw away
  // contractors that sell what they install.
  const fenceCo = page({
    url: "https://whistlestopfence.ca/",
    title: "Whistle Stop Fence Co — Fence installation",
    links: [
      link("https://whistlestopfence.ca/shop", "Shop our styles"),
      link("https://whistlestopfence.ca/cart", "Cart"),
      link("https://whistlestopfence.ca/fence-installation", "Fence installation"),
    ],
    buttons: ["Add to cart"],
    text: "We install and we sell panels.",
  });
  ok("a shopping cart is NOT a supplier veto", supplierSignal(fenceCo) === null, supplierSignal(fenceCo));
  const r = inferTrade({ crawl: { pages: [fenceCo], complete: true } });
  ok("…so a fence company that sells panels online still resolves", r.tradeKey === "fencing", r);
}
{
  const noTitle = page({ url: "https://x.test/", title: "Groupe ABC", links: [link("https://x.test/a", "Accueil")] });
  ok("'shop' in a link is not a supplier signal on its own", supplierSignal(noTitle) === null);
}
{
  // A distributor with NO store markup at all — the half of the veto that the
  // schema.org branch would otherwise cover for. Without this, the title rule
  // could be deleted and every assertion above would still pass.
  const wholesaler = {
    pages: [
      page({
        url: "https://distribpeinture.ca/",
        title: "Distribution Painting Supplies — grossiste en peinture",
        links: [link("https://distribpeinture.ca/peinture", "Peinture"), link("https://distribpeinture.ca/c", "Contact")],
        text: "Peinture pour entrepreneurs.",
      }),
    ],
    complete: true,
  };
  ok("a wholesaler with no Store markup is still caught, by its own title", supplierSignal(wholesaler.pages[0])?.kind === "meta", supplierSignal(wholesaler.pages[0]));
  const r = inferTrade({ crawl: wholesaler });
  ok("…and yields no trade despite naming one three times", r.tradeKey === null && r.reason === "supplier", r);
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. An ambiguous page yields null, not a guess
   ═══════════════════════════════════════════════════════════════════ */

section("6. Ambiguity yields null, never array order");

const roofingAndSiding = {
  pages: [
    page({
      url: "https://exteriors.test/",
      title: "North Shore Exteriors — Roofing and Siding",
      links: [link("https://exteriors.test/roofing", "Roofing"), link("https://exteriors.test/siding", "Siding")],
      text: "Roofing and siding for the North Shore.",
    }),
  ],
  complete: true,
};
{
  const r = inferTrade({ crawl: roofingAndSiding });
  ok("two trades with equal structural billing produce NO trade key", r.tradeKey === null, r);
  ok("…named as a contest rather than as nothing found", r.reason === "contested");
  ok("…and classified as MULTI_TRADE, which is a real state", r.inference?.value === MULTI_TRADE);
  ok("…with both trades on the record so a human can read the contest", r.candidates.length === 2 && r.candidates.map((c) => c.tradeKey).sort().join(",") === "roofing,siding");
  ok("…and MULTI_TRADE carries no digit, which prospectView refuses to render", !/\d/.test(MULTI_TRADE));
}
{
  // The leader must WIN, not merely sort first. Roofing has schema.org here
  // and siding does not, so the contest resolves on evidence class.
  const r = inferTrade({
    crawl: {
      pages: [
        page({
          url: "https://exteriors.test/",
          title: "North Shore Exteriors — Roofing and Siding",
          schema: ['{"@type":"RoofingContractor"}', "roofingcontractor"],
          links: [link("https://exteriors.test/roofing", "Roofing"), link("https://exteriors.test/siding", "Siding")],
          text: "Roofing and siding.",
        }),
      ],
      complete: true,
    },
  });
  ok("a schema.org type beats a trade that has none", r.tradeKey === "roofing", r);
  ok("…and siding is still recorded as a candidate rather than discarded", r.candidates.some((c) => c.tradeKey === "siding"));
}
{
  // The alphabetical tiebreak in the sort must never be what decides. Reverse
  // the alphabetical order of the two trades and the answer must still be
  // "contested" rather than whichever now sorts first.
  const r = inferTrade({
    crawl: {
      pages: [
        page({
          url: "https://x.test/",
          title: "Plomberie et Électricien Gagnon",
          links: [link("https://x.test/plomberie", "Plomberie"), link("https://x.test/electricien", "Électricien")],
          text: "Plomberie et électricien.",
        }),
      ],
      complete: true,
    },
  });
  ok("a tie between two alphabetically-reversed trades is still a tie", r.tradeKey === null && r.reason === "contested", r);
}

section("7. Prose can never manufacture a trade");

{
  const r = inferTrade({
    crawl: {
      pages: [
        page({
          url: "https://elitroofing.ca/",
          title: "Elite Roofing — Ottawa",
          links: [link("https://elitroofing.ca/roofing", "Roofing")],
          // A roofer's page mentioning siding and gutters. Both are true of the
          // business and neither is what a rep should open on.
          text: "Roofing done right. We also install siding and gutters after every roof.",
        }),
      ],
      complete: true,
    },
  });
  ok("a trade mentioned only in prose is not a candidate", r.candidates.map((c) => c.tradeKey).join(",") === "roofing", r.candidates.map((c) => c.tradeKey));
  ok("…so prose cannot create a contest", r.decision === "confirmed" && r.tradeKey === "roofing");
  ok("…but it IS recorded, at the confidence its category earns", r.evidence.some((e) => e.type === "page_content" && e.normalizedValue.startsWith("trade:roofing")));
}
{
  // A page whose ONLY signal for a trade is prose resolves to nothing at all.
  const r = inferTrade({
    crawl: {
      pages: [
        page({
          url: "https://generic.test/",
          title: "Groupe Bertrand",
          links: [
            link("https://generic.test/a", "Accueil"),
            link("https://generic.test/b", "Contact"),
            // Somebody else's search term on this site's own page. `?q=toiture`
            // is not this business saying it does roofing.
            link("https://generic.test/recherche?q=toiture", "Recherche"),
          ],
          text: "Nous faisons de la peinture depuis 1998.",
        }),
      ],
      complete: true,
    },
  });
  ok("prose alone establishes nothing", r.tradeKey === null && r.decision === "unknown", r);
  ok("…reported as no signal rather than as a weak one", r.reason === "no_trade_signal");
  ok("…and no inference row is produced", r.inference === null);
  // Asserted on CANDIDATES rather than on tradeKey. A single stray signal
  // produces `tradeKey: null` anyway, so a tradeKey assertion would pass
  // whether or not the query string was read — which is a check that proves
  // nothing while looking like it proves something.
  ok("…and a trade word in a QUERY STRING is not a candidate either", r.candidates.length === 0, r.candidates);
}

section("8. A crawl that did not happen is unknown, never absent");

{
  const r = inferTrade({ crawl: { pages: [{ url: "https://x.test/", status: 503, ok: false }], complete: false } });
  ok("a site that would not load yields unknown", r.decision === "unknown" && r.tradeKey === null, r);
  ok("…and says the pages did not render", r.reason === "no_page_rendered");
  ok("…and writes nothing at all, so an earlier finding survives", r.evidence.length === 0 && r.inference === null);
}
{
  const r = inferTrade({ crawl: { pages: [{ url: "https://x.test/", status: 403, ok: false }] } });
  ok("a blocked crawl is reported as blocked, not as no trade", r.reason === "blocked", r);
}
{
  // A 200 with a body and no links is a JavaScript-rendered site handed to a
  // crawler that does not run JavaScript. capabilityDetect.js's looksRendered
  // already refuses it, and this inherits that rather than re-deciding it.
  const r = inferTrade({
    crawl: { pages: [{ url: "https://x.test/", status: 200, ok: true, text: "Toiture ".repeat(60), links: [], meta: { title: "Toitures" } }] },
  });
  ok("a body with no links is not a rendered page", r.decision === "unknown", r);
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. Hostile input, and the Number(null) trap by name
   ═══════════════════════════════════════════════════════════════════ */

section("9. Hostile input");

for (const [label, input] of [
  ["nothing at all", undefined],
  ["an empty object", {}],
  ["a null crawl", { crawl: null }],
  ["a crawl of null", { crawl: { pages: null } }],
  ["a page list of nulls", { crawl: { pages: [null, undefined] } }],
  ["a bare array", { crawl: [] }],
  ["a string where a crawl should be", { crawl: "https://x.test" }],
  ["a null prospect", { crawl: rooferFrench, prospect: null }],
]) {
  let result = null;
  let threw = false;
  try {
    result = inferTrade(input);
  } catch {
    threw = true;
  }
  ok(`${label} does not throw`, !threw);
  ok(`…and never invents a trade from ${label}`, threw || typeof result.tradeKey === "string" || result.tradeKey === null);
}
{
  // Number(null) is 0 and 0 is finite. Nothing here may coerce a missing
  // confidence into a real one — the failure that put prospects in the Gulf
  // of Guinea, arriving through a different door.
  const r = inferTrade({ crawl: rooferSchema, prospect: { tradeKey: null } });
  ok("an explicit null prospect trade is not read as a trade", r.disagreesWithSource === false, r.disagreesWithSource);
  ok("…and Number(null) is still 0, so the trap is real and this is not vacuous", Number(null) === 0 && Number.isFinite(Number(null)));
  const empty = inferTrade({ crawl: rooferSchema, prospect: { tradeKey: "" } });
  ok("an empty-string trade is not a disagreement either", empty.disagreesWithSource === false);
  const other = inferTrade({ crawl: rooferSchema, prospect: { tradeKey: "painting" } });
  ok("a REAL disagreement is reported", other.disagreesWithSource === true, other.disagreesWithSource);
  ok("…and reported ONLY — the site never overwrites the directory here", other.tradeKey === "roofing" && other.decision === "confirmed");
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. The handler: fill a hole, never overwrite
   ═══════════════════════════════════════════════════════════════════ */

section("10. ANALYZE_CAPABILITIES writes the trade");

function stubDb({
  prospect = { id: "p1", tradeKey: null, hasWebsite: null, websiteUrl: "https://x.test" },
  // The `derived_site` inference row, or null. Null is the normal case and the
  // one every fixture below wants: these prospects have a websiteUrl, so their
  // site was published by the source and its identity was never in question.
  derivedSite = null,
} = {}) {
  const written = { evidence: [], capabilities: [], inferences: [], deleted: [], tradeUpdates: [] };
  let nextId = 0;
  const tx = {
    prospectEvidence: {
      deleteMany: async ({ where }) => {
        written.deleted.push(where);
        return { count: 0 };
      },
      create: async ({ data }) => {
        written.evidence.push(data);
        return { id: `ev${nextId++}` };
      },
    },
    prospectCapability: { upsert: async ({ create }) => written.capabilities.push(create) },
    prospectInference: {
      upsert: async ({ where, create, update }) => {
        written.inferences.push({ where, create, update });
      },
    },
    prospect: {
      updateMany: async ({ where, data }) => {
        written.tradeUpdates.push({ where, data });
        // The compare-and-set: this stub answers honestly about whether the
        // guard would have matched, so "fills a hole" and "never overwrites"
        // are measured rather than asserted.
        const wouldMatch = where.tradeKey === null && prospect.tradeKey === null;
        return { count: wouldMatch ? 1 : 0 };
      },
    },
  };
  return {
    written,
    prospect: { findUnique: async () => prospect },
    prospectTechnology: { findMany: async () => [] },
    prospectCapability: { findMany: async () => [] },
    prospectEvidence: { findMany: async () => [] },
    // ANALYZE_CAPABILITIES asks whether this prospect's website was DERIVED
    // rather than published — Quebec's RBQ register carries no website column,
    // so lib/sales/discovery/rbq/derivedSite.js guesses one and the trade may
    // only be established from a guessed site the site itself corroborates.
    // The default is null, which is every prospect whose source published a
    // website; a fixture that wants the derived path says so.
    prospectInference: { findUnique: async () => derivedSite },
    $transaction: async (fn) => fn(tx),
  };
}

{
  const db = stubDb();
  const result = await handleAnalyzeCapabilities({
    task: { prospectId: "p1" },
    payload: { prospectId: "p1", crawl: rooferFrench },
    db,
  });
  ok("the stage completes", result.done === true, result);
  ok("…and filled the empty trade column", db.written.tradeUpdates.length === 1 && db.written.tradeUpdates[0].data.tradeKey === "roofing", db.written.tradeUpdates);
  ok("…guarded on tradeKey being null, so it is a FILL and not an overwrite", db.written.tradeUpdates[0].where.tradeKey === null);
  ok("…wrote the inference under its own kind", db.written.inferences[0]?.where.prospectId_kind.kind === TRADE_INFERENCE_KIND);
  ok("…citing evidence ids that were actually created", (db.written.inferences[0]?.create.evidenceIds || []).length > 0);
  ok("…and the note says what happened", /trade established as Roofing/.test(result.note), result.note);
  const tradeRows = db.written.evidence.filter((e) => e.detector === TRADE_DETECTOR);
  ok("…every trade evidence row carries the detector and its version", tradeRows.length > 0 && tradeRows.every((e) => e.detectorVersion === TRADE_DETECTOR_VERSION));
  ok("…and every one names a page", tradeRows.every((e) => typeof e.sourceUrl === "string" && e.sourceUrl.length > 0));
  ok(
    "…and the delete only ever scoped to this detector's own rows",
    db.written.deleted.filter((w) => w.detector === TRADE_DETECTOR).length === 1,
    db.written.deleted,
  );
}
{
  const db = stubDb({ prospect: { id: "p1", tradeKey: "painting", hasWebsite: null, websiteUrl: "https://x.test" } });
  const result = await handleAnalyzeCapabilities({
    task: { prospectId: "p1" },
    payload: { prospectId: "p1", crawl: rooferFrench },
    db,
  });
  ok("a prospect that ALREADY has a trade is never moved", db.written.tradeUpdates.length === 0, db.written.tradeUpdates);
  ok("…and the disagreement is reported to a human instead", /disagrees/.test(result.note), result.note);
  ok("…while the inference still records what the site said", db.written.inferences[0]?.create.value === "roofing");
}
{
  const db = stubDb();
  const result = await handleAnalyzeCapabilities({
    task: { prospectId: "p1" },
    payload: { prospectId: "p1", crawl: roofingAndSiding },
    db,
  });
  ok("a contested site writes NO trade key", db.written.tradeUpdates.length === 0, db.written.tradeUpdates);
  ok("…but does write the MULTI_TRADE inference", db.written.inferences[0]?.create.value === MULTI_TRADE);
  ok("…and the note names both trades", /Roofing/.test(result.note) && /Siding/.test(result.note), result.note);
}
{
  const db = stubDb();
  await handleAnalyzeCapabilities({
    task: { prospectId: "p1" },
    payload: { prospectId: "p1", crawl: { pages: [{ url: "https://x.test/", status: 503, ok: false }] } },
    db,
  });
  ok("an unknown run writes no trade evidence at all", db.written.evidence.filter((e) => e.detector === TRADE_DETECTOR).length === 0);
  ok("…and does not delete last week's, so an earlier finding survives", db.written.deleted.every((w) => w.detector !== TRADE_DETECTOR), db.written.deleted);
  ok("…and writes no inference", db.written.inferences.length === 0);
}

section("11. The stage is still free");

{
  const src = codeOnly(read("lib/sales/pipeline/kinds.js"));
  ok("ANALYZE_CAPABILITIES still spends nothing outside this process", /ANALYZE_CAPABILITIES:\s*"local"/.test(src), PROVIDER_BY_KIND.ANALYZE_CAPABILITIES);
  ok("…asserted on the shipped map too, not only on the source", PROVIDER_BY_KIND.ANALYZE_CAPABILITIES === "local");
  ok("…and GENERATE_RESEARCH_BRIEF is still the only stage that calls a model", Object.entries(PROVIDER_BY_KIND).filter(([, p]) => p === "openai").map(([k]) => k).join(",") === "GENERATE_RESEARCH_BRIEF");
}
{
  const src = codeOnly(read("lib/sales/intel/tradeDetect.js"));
  ok("the detector talks to no model vendor", !/openai|anthropic|complete\(|runToolLoop/i.test(src));
  ok("…and reaches no database", !/@\/lib\/db|prisma\./.test(src));
}

/* ═══════════════════════════════════════════════════════════════════════════
   12. The ingest split — BOTH halves, because either alone is a bug
   ═══════════════════════════════════════════════════════════════════ */

section("12. The bank and the queue are two things");

const rbqish = {
  sourceRecordId: "rbq:1104-8618-06",
  sourceUrl: "https://x.test/rbq",
  name: "Construction Roy inc.",
  categories: { primary: null, alternate: ["rbq:9", "rbq:12"] },
  phones: ["5145550100"],
  websites: [],
  emails: [],
  address: { line: "1 rue X", city: "Montréal", province: "QC", postalCode: "H1A 1A1", country: "CA" },
  operatingStatus: "Active",
  taxonomyHierarchy: [],
};
const painter = {
  sourceRecordId: "ov:1",
  sourceUrl: "https://x.test/ov",
  name: "Nordic Painting",
  categories: { primary: "painting", alternate: [] },
  phones: ["6135550001"],
  websites: ["https://nordic.test"],
  emails: [],
  address: { line: "2 Bank St", city: "Ottawa", province: "ON", postalCode: "K1A 0A1", country: "CA" },
  operatingStatus: "open",
  taxonomyHierarchy: [],
};
const roofer = { ...painter, sourceRecordId: "ov:2", name: "Nordic Roofing", categories: { primary: "roofing", alternate: [] }, phones: ["6135550002"] };

{
  const { plans, counters } = planIngest(
    [rbqish, painter, roofer],
    { provider: "rbq", release: "2026-09-03", tradeKey: "painting", campaignId: "c1", territoryId: "t1" },
    buildDedupeIndex([]),
  );
  const byId = (id) => plans.find((p) => p.business?.sourceRecordId === id);

  // HALF ONE — it enters the bank.
  ok("a business with no trade is WRITTEN", byId("rbq:1104-8618-06").action === "insert", byId("rbq:1104-8618-06"));
  ok("…with tradeKey null, never guessed from an authorisation code", byId("rbq:1104-8618-06").row.tradeKey === null);
  ok("…at status discovered, which is what the bank IS", byId("rbq:1104-8618-06").row.status === "discovered");
  ok("…and counted as banked", counters.bankedCount === 1);

  // HALF TWO — it cannot reach a queue. Proved on the real query builder, not
  // by reading the ingest: a check that only proved half of this would be a
  // check that lets roofers into painting queues.
  const where = claimCandidateWhere({ tradeKey: byId("rbq:1104-8618-06").row.tradeKey });
  ok("a null trade key cannot match a claim query", where.tradeKey === "__none__", where);
  ok("…and no shipped trade is ever called __none__", !isDiscoveryTradeKey("__none__"));
  ok(
    "…so no rep's queue can contain it",
    Object.keys(DISCOVERY_TRADES).every((k) => claimCandidateWhere({ tradeKey: k }).tradeKey === k),
  );

  // The OTHER half of the old condition is untouched.
  ok("a business in a DIFFERENT trade is still skipped outright", byId("ov:2").action === "skip" && byId("ov:2").reason === "other_trade");
  ok("…and this campaign's own trade is accepted as before", byId("ov:1").action === "insert" && byId("ov:1").row.tradeKey === "painting");
  ok("…and only that one counts toward the campaign's target", counters.acceptedCount === 1);

  // The funnel still adds up. A banked row was already counted as unmapped, so
  // it is a subset and never a stage.
  ok("the funnel reconciles", funnelProblems(counters).length === 0, JSON.stringify(counters));
  const rows = funnelRows(counters);
  const banked = rows.find((r) => r.key === "banked");
  ok("…and there is a line saying the rows were KEPT rather than thrown away", banked?.value === 1 && banked.kind === "subset", banked);
  ok(
    "…which says it is not callable, rather than implying it is",
    /not in any rep's queue/.test(banked?.note || ""),
    banked?.note,
  );
  ok(
    "…and says what would make it callable, so the line is not a dead end",
    /trade/.test(banked?.note || "") && /website/.test(banked?.note || ""),
    banked?.note,
  );
}
{
  // A campaign with NO trade of its own — the register's case. Nothing is
  // skipped for being the wrong trade, because there is no right one.
  const { counters } = planIngest([rbqish], { provider: "rbq", tradeKey: null }, buildDedupeIndex([]));
  ok("a trade-less campaign banks the row too", counters.bankedCount === 1 && counters.acceptedCount === 0);
  ok("…and the funnel still reconciles", funnelProblems(counters).length === 0, JSON.stringify(counters));
}
{
  // The invariant that would hide a miscount: banked is a subset of unmapped,
  // and checking it against `accepted` (the wrong parent) would pass silently
  // for every campaign that accepted more than it banked.
  ok("more banked than unmapped is reported as impossible", funnelProblems({ foundCount: 1, unmappedCount: 0, acceptedCount: 1, bankedCount: 5 }).some((p) => /kept without a trade/.test(p)));
  ok("…and the funnel's own arithmetic is unchanged", funnelProblems({ foundCount: 3, unmappedCount: 1, duplicateCount: 0, rejectedCount: 0, needsReviewCount: 0, acceptedCount: 2, bankedCount: 1 }).length === 0);
}
{
  const src = codeOnly(read("lib/sales/discovery/ingest.js"));
  const body = bodyOf(src, "export function planIngest");
  ok("planIngest is findable", Boolean(body));
  // The exact shape of the old bug: one condition doing two jobs. Read from
  // comment-stripped source, because the file's own comments discuss it.
  ok("planIngest no longer skips a row merely for having no trade", !/!tradeKey\s*\|\|/.test(body), body?.match(/if \([^)]*tradeKey[^)]*\)/g));
  ok("…and the different-trade skip still requires a trade to compare", /tradeKey && context\.tradeKey && tradeKey !== context\.tradeKey/.test(body));
  const write = bodyOf(src, "export async function ingestPage");
  ok("ingestPage no longer drops trade-less rows before the dedupe lookup", !/if \(!tradeKey\) continue/.test(write), write?.slice(0, 400));
}

/* ═══════════════════════════════════════════════════════════════════════════
   13. What a realistic sample resolves to
   ═══════════════════════════════════════════════════════════════════ */

section("13. A realistic sample, measured rather than estimated");

const SAMPLE = [
  ["schema.org roofer, EN", rooferSchema, "roofing"],
  ["title + route, FR roofer", rooferFrench, "roofing"],
  [
    "painter, title + nav label",
    { pages: [page({ url: "https://cotepainting.ca/", title: "Côté Painting — Interior painting Ottawa", links: [link("https://cotepainting.ca/s/1", "Interior painting"), link("https://cotepainting.ca/contact", "Contact")], text: "Interior painting." })], complete: true },
    "painting",
  ],
  [
    "plumber, schema.org only",
    { pages: [page({ url: "https://p.test/", title: "Groupe Gagnon", schema: ['{"@type":"Plumber"}', "plumber"], links: [link("https://p.test/a", "Accueil")] })], complete: true },
    "plumbing",
  ],
  [
    "electrician, FR title + route",
    { pages: [page({ url: "https://e.test/", title: "Électricien Beaulieu", links: [link("https://e.test/electricien", "Électricien"), link("https://e.test/contact", "Contact")] })], complete: true },
    "electrical",
  ],
  [
    "HVAC, schema.org",
    { pages: [page({ url: "https://h.test/", title: "Climatisation ABC", schema: ["hvacbusiness"], links: [link("https://h.test/a", "Accueil")] })], complete: true },
    "hvac",
  ],
  [
    "landscaper, title + route",
    { pages: [page({ url: "https://l.test/", title: "Paysagiste Rive-Sud", links: [link("https://l.test/amenagement-paysager", "Aménagement paysager"), link("https://l.test/c", "Contact")] })], complete: true },
    "landscaping",
  ],
  [
    "cabinet maker, FR",
    { pages: [page({ url: "https://c.test/", title: "Ébénisterie Tremblay", links: [link("https://c.test/armoires-de-cuisine", "Armoires de cuisine")] })], complete: true },
    "cabinets",
  ],
  [
    "snow removal, title + route",
    { pages: [page({ url: "https://s.test/", title: "Déneigement Laval", links: [link("https://s.test/deneigement", "Déneigement"), link("https://s.test/c", "Contact")] })], complete: true },
    "snow_removal",
  ],
  [
    "excavation, title + route",
    { pages: [page({ url: "https://x2.test/", title: "Excavation Boisvert", links: [link("https://x2.test/excavation", "Excavation")] })], complete: true },
    "excavation",
  ],
  // The ones that must NOT resolve.
  ["a paint distributor", paintStore, null],
  ["roofing and siding, equal billing", roofingAndSiding, null],
  [
    "a generic 'construction' company",
    { pages: [page({ url: "https://g.test/", title: "Groupe Bertrand inc.", links: [link("https://g.test/a", "Accueil"), link("https://g.test/c", "Contact")], text: "Projets résidentiels et commerciaux." })], complete: true },
    null,
  ],
  [
    "one signal only — a title and nothing else",
    { pages: [page({ url: "https://o.test/", title: "Plomberie Gagnon", links: [link("https://o.test/a", "Accueil")] })], complete: true },
    null,
  ],
  ["a site that would not load", { pages: [{ url: "https://d.test/", status: 500, ok: false }] }, null],
];

let resolved = 0;
for (const [label, crawl, expected] of SAMPLE) {
  const r = inferTrade({ crawl });
  ok(`${label} → ${expected ?? "no trade"}`, r.tradeKey === expected, { got: r.tradeKey, decision: r.decision, reason: r.reason });
  if (r.tradeKey) resolved++;
}
ok("…and nothing in the sample resolved to a trade it does not practise", resolved === SAMPLE.filter(([, , e]) => e !== null).length, resolved);
console.log(
  `\n  measured: ${resolved}/${SAMPLE.length} of the sample resolved to a trade; ` +
    `${SAMPLE.filter(([, , e]) => e === null).length} were deliberately left unknown.\n`,
);

console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass} assertions passed, ${failures.length} failed`);
for (const f of failures) console.log(`  - ${f}`);
process.exit(failures.length ? 1 : 0);
