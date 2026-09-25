// lib/quotes/serviceTemplateLines.js
//
// A service's estimate template, expanded onto a quote (or an invoice) as
// ordinary line items — the builder step the template work of 2026-09-24
// left owed. The owner, from the start: "services could be their version of
// templates… that sits on top of our calculators that determine sqft for
// painting or flooring or roofing". The calculator produces the quantity;
// the template line supplies the words, the price and the cost.
//
// ── What this adds, and what it leaves alone ──────────────────────────────
//
// The plain "Add from Products & Services" path is untouched: a row clicked
// in the library still becomes ONE line through lib/quotes/lineDetail.js
// lineFromProduct, byte for byte (the save payload's md5 was taken before
// and after this landed — docs/ROADMAP.md; the check script's section A
// re-asserts the line itself). A service whose template is offered on this quote type gets a SECOND action
// beside it — "Add with its template lines" — and that action is this file.
//
// ── The measurements a quote already holds ─────────────────────────────────
//
// `measurementsFromGroups` reads the figures the scope groups on THIS quote
// already carry, by the registry's names (lib/services/measurementKeys.js),
// and says where each came from so the screen can print "From room takeoff —
// Wall sq ft: 412". Only figures a builder form actually STORES are read:
//
//   painting takeoff  (interior/exterior)  wallSqft, ceilingSqft, floorSqft,
//                     linearFt — areaGeometry() summed over the areas that
//                     are not optional (an optional room is an offer, not the
//                     job), the same geometry the room cards price from
//   flooring takeoff  floorSqft — the sections' sqft
//   siding takeoff    wallSqft — the wall area being sided
//   roof takeoff      areaSqft, squares (= areaSqft ÷ 100), valleyFt,
//                     perimeterFt (the drip-edge run, which the satellite
//                     patch writes as the perimeter); ridgeFt and hipFt ONLY
//                     from a satellite measurement, where roofGeometry's
//                     takeoffPatch wrote ridgeVentFt = ridge and ridgeHipFt =
//                     ridge + hip — a ridge vent typed by hand may cover part
//                     of a ridge and is not a ridge length
//   gutter takeoff    gutterFt, downspouts (installed or flushed — both count
//                     the downspouts on the house)
//   stair takeoff     treads, risers, balusters, posts, handrailFt, summed
//                     over the staircases
//   any intake        every registered key an intake box stores under the
//                     registry's own name — the cabinet door and drawer
//                     counts, the lot measure's lotSize / edgingFt, the
//                     cleaning intake's bedrooms / bathrooms / squareFootage
//
// NOT read, on purpose: eaveFt / rakeFt / footprintSqft (the satellite report
// produces them, the roof takeoff does not keep them — deriving eaves back
// out of the ice-and-water figure would be reading an estimator's edit as a
// measurement); the paving / driveway / insulation square feet (areaSqft in
// the registry is the roof's or a traced outline's area — filling a concrete
// line from an attic would be the wrong figure with a confident label). A
// line naming one of those keys asks for its quantity.
//
// Zero is ABSENT on a builder form: every takeoff opens its figures at 0,
// which means "nobody entered it" (tradeScope.js defaultTakeoff). The one
// exception is a satellite roof, whose linears are measured — "no valleys"
// on a gable is a figure there.
//
// When two groups carry the same figure (an interior AND an exterior painting
// group both have wall area), the group the template is being added to wins;
// otherwise the first group in quote order, and the note names the group so
// the estimator sees which walls were used. Figures are never summed across
// groups: interior walls plus exterior walls is not a quantity of anything.
//
// ── Missing measurements ──────────────────────────────────────────────────
//
// A measured line with no figure opens at quantity 0 and amount 0 — not the
// template's fallback qty of 1, which on a per-sq-ft line is one square foot
// of paint wearing the look of a price (AGENTS.md failure class 5). It is
// flagged `awaiting`, and `calculatorFor` names the calculator that would
// fill it; the builder links to that calculator when the quote has it and
// says plainly when it does not. lib/quotes/completeness.js lists every such
// line still at $0 before the quote goes out. Two existing rules apply to
// such a line unchanged: the save stores quantity 0 as 1 with its $0 amount
// (builderPayload scopeGroupPayload), and the Cost & margin panel costs it
// as one unit (lib/costing/lineItemCost.js) — both correct themselves the
// moment a quantity is typed or filled.
//
// ── Money ──────────────────────────────────────────────────────────────────
//
// Rates are the template's own unit prices on the company's Product row,
// already in the company's currency (lib/services/seeds.js seedTemplateFor
// converted a seed's USD when the row was written; a company's own lines were
// typed in its currency). expandTemplate converts only when told the row is
// in another currency, and returns a null rate rather than a foreign number
// when it cannot — such a line lands at 0 and flagged `unpriced`. The quote
// save path (POST/PATCH /api/quotes) stores the staff member's lines as the
// estimator left them — it reprices nothing, for this path or the plain one;
// non-negotiable #5 is about client-facing surfaces and nothing here is one.
//
// ── Language ───────────────────────────────────────────────────────────────
//
// Every line is written in the DOCUMENT's language (Quote.language, fixed at
// creation), falling back to English and then to the company's own words —
// never machine-translated (non-negotiable #6). The words are copied onto the
// line at add time, so a later edit of the template never rewrites a sent
// quote.
//
// ── Tax and discount — deliberately not carried ────────────────────────────
//
// A template line's `taxable` flag and the template's default discount have
// no place on a quote line: a quote taxes as a whole (lib/quotes/totals.js)
// and carries one discount. Writing either onto the line would be a field
// nothing reads (failure class 1). They stay on the Product row for the day
// line-level tax exists.
//
// Pure — no React, no database — so scripts/check-service-template-lines.mjs
// (npm run check:service-template-lines) executes every rule here against
// hostile input.

import { expandTemplate, templatesFor } from "@/lib/services/templates";
import { isMeasurementKey } from "@/lib/services/measurementKeys";
import { areaGeometry } from "@/lib/pricing/paintTakeoff";
import { lineFromTextBlock } from "@/lib/quotes/textBlocks";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(num(n) * 100) / 100;
const pos = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
const list = (v) => (Array.isArray(v) ? v : []);

/**
 * The calculators, by the id the screen names them with
 * (app.templateLines.calc_<id>), and the quote types that carry each.
 */
export const CALCULATORS = Object.freeze({
  paint: { trades: ["interior_painting", "exterior_painting"] },
  flooring: { trades: ["flooring"] },
  siding: { trades: ["siding"] },
  roof: { trades: ["roofing_service"] },
  roofSatellite: { trades: ["roofing_service"] },
  gutter: { trades: ["gutter_services"] },
  stairs: { trades: ["stairs"] },
  cabinet: { trades: ["cabinet_refinishing", "cabinet_refacing"] },
  lot: { trades: ["lawn_care", "lawn_mowing", "landscaping_design", "irrigation"] },
  cleaning: { trades: ["residential_cleaning", "deep_cleaning"] },
});

/**
 * Which calculator on the builder fills a key — or null for a key no builder
 * form stores (a count typed on the estimate, eaves off a satellite report
 * the roof takeoff does not keep). Several are listed where several fill it;
 * the first is the one named when none is on the quote.
 */
const KEY_CALCULATORS = Object.freeze({
  wallSqft: ["paint", "siding"],
  ceilingSqft: ["paint"],
  floorSqft: ["paint", "flooring"],
  linearFt: ["paint"],
  squares: ["roof"],
  areaSqft: ["roof"],
  valleyFt: ["roof"],
  perimeterFt: ["roof"],
  ridgeFt: ["roofSatellite"],
  hipFt: ["roofSatellite"],
  gutterFt: ["gutter"],
  downspouts: ["gutter"],
  treads: ["stairs"],
  risers: ["stairs"],
  balusters: ["stairs"],
  posts: ["stairs"],
  handrailFt: ["stairs"],
  doorCount: ["cabinet"],
  drawerCount: ["cabinet"],
  boxLinearFt: ["cabinet"],
  lotSize: ["lot"],
  edgingFt: ["lot"],
  bedrooms: ["cleaning"],
  bathrooms: ["cleaning"],
  squareFootage: ["cleaning"],
});

/** The calculators that fill `key`, most specific first; [] for a typed key. */
export function calculatorsFor(key) {
  return isMeasurementKey(key) && Object.hasOwn(KEY_CALCULATORS, key) ? KEY_CALCULATORS[key] : [];
}

/**
 * Where a missing figure would come from on THIS quote: the first group whose
 * quote type carries a calculator for the key, or — when none does — the
 * calculator's id alone, so the screen can say which one without a link that
 * goes nowhere.
 */
export function calculatorFor(key, groups = []) {
  const calcs = calculatorsFor(key);
  if (!calcs.length) return null;
  for (const calc of calcs) {
    const g = list(groups).find((x) => x && CALCULATORS[calc].trades.includes(x.categoryKey) && !x.persisted && !x.imported);
    if (g) return { calc, groupTempId: g.tempId, groupLabel: String(g.label || "") };
  }
  return { calc: calcs[0], groupTempId: null, groupLabel: null };
}

/**
 * The measurements a group's OWN calculator already bills — the units a
 * template line keyed to them would bill a second time.
 *
 * A stair takeoff turns treads, risers, balusters, posts and handrail into
 * priced lines; a cabinet group bills every door and drawer front as a unit;
 * the flooring, siding, roof and gutter takeoffs bill the square feet, squares
 * and linear feet they measure. A template added INTO such a group that also
 * prices "Treads × 14" puts the same fourteen treads on the quote twice — the
 * double-billing the service cards made one click away (2026-09-25). So those
 * template lines are not added there (expandServiceTemplate's `pricedKeys`),
 * and the screen names them.
 *
 * Static per trade, not "what the takeoff bills right now": a service added
 * from its card opens with an EMPTY takeoff, and a rule that looked only at
 * today's figures would let the template's tread line in and then bill the
 * treads again the moment the step count was typed.
 *
 * Painting is the one trade read from the group itself: its area takeoff
 * prices a surface only when the area carries a substrate driven by it (walls,
 * ceiling, floor, trim), and measuring rooms for a template to price is the
 * design the templates were built on — so only the drivers a substrate in a
 * non-optional area already prices are held back.
 *
 * Every other trade — and any group on an invoice, which has no calculator —
 * holds nothing back.
 */
const CALCULATOR_PRICED_KEYS = Object.freeze({
  stairs: ["treads", "risers", "balusters", "posts", "handrailFt"],
  cabinet_refinishing: ["doorCount", "drawerCount"],
  cabinet_refacing: ["doorCount", "drawerCount"],
  flooring: ["floorSqft"],
  siding: ["wallSqft"],
  roofing_service: ["areaSqft", "squares", "valleyFt", "perimeterFt", "ridgeFt", "hipFt"],
  gutter_services: ["gutterFt", "downspouts"],
});

export function keysPricedByGroup(group) {
  if (!group || typeof group !== "object") return [];
  const key = group.categoryKey;
  if (key === "interior_painting" || key === "exterior_painting") {
    const t = group.takeoff && typeof group.takeoff === "object" ? group.takeoff : null;
    if (!t || t.model !== "area_substrate") return [];
    const out = new Set();
    for (const area of list(t.areas)) {
      if (!area || typeof area !== "object" || area.optional === true) continue;
      for (const s of list(area.substrates)) {
        if (s && s.optional !== true && typeof s.driver === "string" && isMeasurementKey(s.driver)) out.add(s.driver);
      }
    }
    return [...out];
  }
  return typeof key === "string" && Object.hasOwn(CALCULATOR_PRICED_KEYS, key) ? [...CALCULATOR_PRICED_KEYS[key]] : [];
}

/** The calculator a trade's own group carries (its id), or null. */
export function calculatorOfTrade(categoryKey) {
  for (const [id, c] of Object.entries(CALCULATORS)) {
    if (id !== "roofSatellite" && c.trades.includes(categoryKey)) return id;
  }
  return null;
}

/** The figures ONE group carries, as { key: { value, calc } }. */
export function groupMeasurements(group) {
  const out = {};
  if (!group || typeof group !== "object") return out;
  const put = (key, value, calc, { zeroIsFigure = false } = {}) => {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) return;
    if (v === 0 && !zeroIsFigure) return;
    if (!Object.hasOwn(out, key)) out[key] = { value: Math.round(v * 100) / 100, calc };
  };
  const t = group.takeoff && typeof group.takeoff === "object" ? group.takeoff : null;
  const key = group.categoryKey;

  if (t && (key === "interior_painting" || key === "exterior_painting") && Array.isArray(t.areas)) {
    const sum = { wallSqft: 0, ceilingSqft: 0, floorSqft: 0, linearFt: 0 };
    for (const area of t.areas) {
      if (!area || typeof area !== "object" || area.optional === true) continue;
      const g = areaGeometry(area);
      for (const k of Object.keys(sum)) sum[k] += pos(g[k]);
    }
    for (const [k, v] of Object.entries(sum)) put(k, v, "paint");
  }
  if (t && key === "flooring") {
    put("floorSqft", list(t.sections).reduce((s, x) => s + pos(x?.sqft), 0), "flooring");
  }
  if (t && key === "siding") put("wallSqft", pos(t.sqft), "siding");
  if (t && key === "roofing_service") {
    const sat = t.measuredFrom === "satellite";
    const calc = sat ? "roofSatellite" : "roof";
    const area = pos(t.areaSqft);
    if (area > 0) {
      put("areaSqft", area, calc);
      put("squares", area / 100, calc);
    }
    put("valleyFt", t.valleyFt, calc, { zeroIsFigure: sat && area > 0 });
    put("perimeterFt", t.dripEdgeFt, calc);
    if (sat && area > 0) {
      put("ridgeFt", t.ridgeVentFt, calc, { zeroIsFigure: true });
      const hip = num(t.ridgeHipFt) - num(t.ridgeVentFt);
      if (hip >= 0) put("hipFt", hip, calc, { zeroIsFigure: true });
    }
  }
  if (t && key === "gutter_services") {
    put("gutterFt", t.gutterFt, "gutter");
    put("downspouts", Math.max(pos(t.downspoutsInstalled), pos(t.downspoutsFlushed)), "gutter");
  }
  if (t && key === "stairs") {
    for (const k of ["treads", "risers", "balusters", "posts", "handrailFt"]) {
      put(k, list(t.sections).reduce((s, x) => s + pos(x?.[k]), 0), "stairs");
    }
  }
  // Intake boxes stored under the registry's own names. A takeoff figure
  // above wins over an intake box of the same name.
  const iv = group.intakeValues && typeof group.intakeValues === "object" ? group.intakeValues : {};
  for (const [k, v] of Object.entries(iv)) {
    if (!isMeasurementKey(k) || typeof v === "boolean" || v === "" || v == null) continue;
    const calc = calculatorsFor(k)[0] || "intake";
    put(k, v, calc);
  }
  return out;
}

/**
 * Every figure the quote holds, keyed by measurement key:
 *   { values: { key: number }, sources: { key: { value, calc, groupTempId, groupLabel } } }
 * `targetTempId` — the group the template is going into — is read first.
 */
export function measurementsFromGroups(groups, { targetTempId = null } = {}) {
  const all = list(groups).filter((g) => g && typeof g === "object");
  const ordered = [
    ...all.filter((g) => g.tempId === targetTempId),
    ...all.filter((g) => g.tempId !== targetTempId),
  ];
  const values = {};
  const sources = {};
  for (const g of ordered) {
    const m = groupMeasurements(g);
    for (const [k, v] of Object.entries(m)) {
      if (Object.hasOwn(values, k)) continue;
      values[k] = v.value;
      sources[k] = { value: v.value, calc: v.calc, groupTempId: g.tempId ?? null, groupLabel: String(g.label || "") };
    }
  }
  return { values, sources };
}

/**
 * Is `product`'s template offered on this group? The owner's quote-type rule
 * (lib/services/templates.js templatesFor) for a quote group; on an invoice —
 * which has no quote type — any enabled template is offered.
 */
export function templateOffered(product, { categoryId = null, categoryKey = null, estimateType = null, invoice = false } = {}) {
  if (!product || typeof product !== "object") return false;
  if (invoice) {
    return product.templateEnabled !== false && Array.isArray(product.templateLines) && product.templateLines.length > 0;
  }
  return templatesFor({ products: [product], categoryId, categoryKey, estimateType }).length === 1;
}

/**
 * The product's own name and description in the document's language: the
 * language itself, then English, then the company's own words.
 */
export function serviceTextIn(product, language, companyLanguage = "en") {
  const own = { name: String(product?.name || ""), description: String(product?.description || "") };
  const tr = product?.translations && typeof product.translations === "object" ? product.translations : {};
  if (!language || language === companyLanguage) return own;
  const pick = tr[language]?.name ? tr[language] : companyLanguage !== "en" && language !== "en" && tr.en?.name ? tr.en : null;
  if (!pick) return own;
  return { name: String(pick.name), description: String(pick.description || own.description || "") };
}

/**
 * The template's lines as quote lines, in template order, plus — on a quote —
 * an unpriced heading line carrying the service's name and description so
 * the client reads the lines under the service they belong to.
 *
 * @param product          the company's Product row (templateLines, translations…)
 * @param measurements     measurementsFromGroups(...) — { values, sources }
 * @param language         the document's language
 * @param companyLanguage  the language the Product row's own words are in
 * @param currency         the document's currency; fromCurrency / fx as in
 *                         expandTemplate (omitted = the row is already in it)
 * @param runId            one id per add — two adds of the same service are two
 *                         runs, refilled and grouped separately
 * @param heading          false on an invoice: the invoice renderers print every
 *                         line with an amount, so an unpriced heading would read
 *                         "$0.00" there
 * @returns { lines, summary: { lines, measured, filled, awaiting, unpriced } }
 */
export function expandServiceTemplate(product, {
  measurements = null,
  language = "en",
  companyLanguage = "en",
  currency = null,
  fromCurrency = null,
  fx = null,
  runId = "run",
  heading = true,
  // keysPricedByGroup(target group): template lines keyed to one of these are
  // left out — the group's own calculator already bills those units. Named
  // back in summary.skipped (only when there are any, so every existing
  // summary reads exactly as it did).
  pricedKeys = null,
} = {}) {
  const values = measurements?.values && typeof measurements.values === "object" ? measurements.values : {};
  const sources = measurements?.sources && typeof measurements.sources === "object" ? measurements.sources : {};
  const all = expandTemplate(product, {
    measurements: values,
    currency,
    fromCurrency,
    fx,
    language,
    defaultLanguage: companyLanguage,
  });
  const priced = new Set(list(pricedKeys).filter((k) => typeof k === "string"));
  const isPriced = (l) => Boolean(l.measurementKey) && priced.has(l.measurementKey);
  const expanded = all.filter((l) => !isPriced(l));
  const skipped = all.filter(isPriced).map((l) => ({ description: l.description, measurementKey: l.measurementKey }));
  const summary = {
    lines: expanded.length,
    measured: 0,
    filled: 0,
    awaiting: 0,
    unpriced: 0,
    ...(skipped.length ? { skipped } : {}),
  };
  // Nothing left once the calculator's own units are taken out: no lines and
  // no heading — a service name over nothing is not an estimate.
  if (!expanded.length) return { lines: [], summary };

  const productId = product?.id ? String(product.id) : null;
  const service = serviceTextIn(product, language, companyLanguage);

  const lines = expanded.map((l) => {
    const awaiting = Boolean(l.needsMeasurement);
    const unpriced = l.rate == null;
    if (l.measurementKey) summary.measured += 1;
    if (l.measured) summary.filled += 1;
    if (awaiting) summary.awaiting += 1;
    if (unpriced) summary.unpriced += 1;
    // Awaiting → 0, not the template's fallback of 1 (see the header).
    const quantity = awaiting ? 0 : num(l.quantity);
    const rate = unpriced ? 0 : round2(l.rate);
    const src = l.measured && l.measurementKey ? sources[l.measurementKey] : null;
    const unitCost = l.unitCost == null ? null : round2(l.unitCost);
    return {
      description: l.description,
      quantity,
      unit: l.unit || "each",
      rate,
      amount: round2(quantity * rate),
      ...(l.detail ? { detail: l.detail } : {}),
      // The line's opening unit cost — what the Cost & margin panel and the
      // cost / markup popover already read (lib/costing/lineItemCost.js).
      ...(unitCost != null && unitCost > 0 ? { unitCost } : {}),
      // Office-only: which service and which measurement, for the builder's
      // notes and the completeness check. `meta` reaches no client renderer
      // (ScopeGroupsSection reads description, detail and amount).
      meta: {
        template: {
          runId,
          productId,
          service: service.name,
          lineKind: l.kind,
          ...(l.measurementKey ? { measurementKey: l.measurementKey } : {}),
          ...(src ? { filled: { value: src.value, calc: src.calc, groupTempId: src.groupTempId, groupLabel: src.groupLabel } } : {}),
          ...(l.wastePct ? { wastePct: l.wastePct } : {}),
          ...(l.coverage ? { coverage: l.coverage } : {}),
          ...(awaiting ? { awaiting: true } : {}),
          ...(unpriced ? { unpriced: true } : {}),
          ...(l.missing ? { untranslated: true } : {}),
        },
      },
    };
  });

  if (!heading) return { lines, summary };
  const head = lineFromTextBlock({ name: service.name, body: service.description, priceMode: "none" }, { name: service.name, body: service.description });
  return {
    lines: [{ ...head, meta: { template: { runId, productId, service: service.name, heading: true } } }, ...lines],
    summary,
  };
}

/** The template run a line belongs to, or null. */
export function templateRunOf(item) {
  const m = item?.meta?.template;
  return m && typeof m === "object" && typeof m.runId === "string" ? m : null;
}

/**
 * Refill one run's awaiting lines from the quote's figures as they are NOW —
 * the estimator measured after adding. Touches only lines of `runId` still
 * awaiting AND still at quantity 0: a quantity somebody typed is theirs. The
 * rate on the line is kept (it may have been edited); only quantity, amount
 * and the note move. Returns a new array; lines of other runs are the same
 * objects.
 */
export function refillTemplateRun(items, runId, measurements) {
  const values = measurements?.values || {};
  const sources = measurements?.sources || {};
  return list(items).map((item) => {
    const m = templateRunOf(item);
    if (!m || m.runId !== runId || !m.awaiting || !m.measurementKey || num(item.quantity) > 0) return item;
    const src = sources[m.measurementKey];
    const v = Number(values[m.measurementKey]);
    if (!src || !Number.isFinite(v) || v < 0) return item;
    const waste = m.lineKind === "material" ? num(m.wastePct) : 0;
    const withWaste = v * (1 + waste / 100);
    const per = num(m.coverage?.per);
    const quantity = per > 0 ? Math.ceil(withWaste / per - 1e-9) : Math.round(withWaste * 100) / 100;
    const { awaiting, ...rest } = m;
    return {
      ...item,
      quantity,
      amount: round2(quantity * num(item.rate)),
      meta: { ...item.meta, template: { ...rest, filled: { value: src.value, calc: src.calc, groupTempId: src.groupTempId, groupLabel: src.groupLabel } } },
    };
  });
}

/** How many of a run's lines a refill would fill now. */
export function refillableCount(items, runId, measurements) {
  const values = measurements?.values || {};
  return list(items).filter((item) => {
    const m = templateRunOf(item);
    return m && m.runId === runId && m.awaiting && m.measurementKey && !(num(item.quantity) > 0) && Object.hasOwn(values, m.measurementKey);
  }).length;
}

/**
 * Template lines that would go out unfinished: a measured line nobody gave a
 * quantity, or a line the template had no price for, still at $0. Read by
 * lib/quotes/completeness.js, on the builder's draft and on a stored quote.
 */
export function unfinishedTemplateLines(items) {
  return list(items).filter((item) => {
    const m = templateRunOf(item);
    if (!m || m.heading) return false;
    if (m.awaiting && !(num(item.amount) > 0)) return true;
    if (m.unpriced && !(num(item.rate) > 0)) return true;
    return false;
  });
}
