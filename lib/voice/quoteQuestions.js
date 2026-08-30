// lib/voice/quoteQuestions.js
//
// What the receptionist should ASK so a quote can be worked out afterwards.
//
// ══ Asking is not quoting ══════════════════════════════════════════════════
//
// lib/voice/prompt.js absolute rule 1 — the agent never says a price, a range,
// or a "usually around" — is untouched by this file and must stay that way.
// Gathering the inputs for a quote and quoting are two different acts. This
// file produces the QUESTIONS; nothing here produces, formats, or carries a
// figure, and check-voice-quote-intake.mjs executes that claim rather than
// trusting it.
//
// ══ The list is the company's own, and it is already maintained ════════════
//
// There is no hand-written question list here, and there must never be one. The
// instant estimator already knows, per company, which trades are offered
// instantly (InstantQuoteConfig rows) and exactly which measurements each one
// needs (measureShapeFor() in lib/estimate/callEstimate.js — the same shapes
// that decide whether a drafted call can be priced at all). Deriving from those
// means:
//
//   * a company that switches Cabinet Refacing on gets doors and drawers in
//     its agent's prompt on the next provision, with nobody editing anything;
//   * a company that has never configured an instant trade gets NO question
//     block, rather than an empty heading a model would try to fill;
//   * the questions the agent asks and the fields the draft needs cannot drift,
//     because they are the same list read twice.
//
// ══ Two measurement shapes are deliberately absent ═════════════════════════
//
// lawn_polygon is a shape traced on a map and item_picker is a list built from
// a catalogue. Neither can come out of a conversation, and the measurement
// shapes already say so. Asking for them on the phone would produce an answer nobody
// can use and a caller who thinks they have been quoted.
//
// ══ Material labels are company text, so they are treated as hostile ═══════
//
// A material label is typed by the contractor into their instant-quote config,
// and it lands verbatim in a prompt read by a model that then talks to a
// stranger. Two things can go wrong: a label like "Premium — $4,500/kitchen"
// puts a figure into the mouth of an agent forbidden from saying one, and a
// label containing instructions is a prompt injection with a settings screen
// for a front door. safeMaterialLabel() drops both rather than sanitising them
// into something plausible.

import { db } from "@/lib/db";
import { INSTANT_ESTIMATE_TRADES } from "@/lib/estimate/instantEstimate";
import { measureShapeFor, categoryKeyForTrade } from "@/lib/estimate/callEstimate";
import { fieldsForCategory } from "@/app/data/quoteIntakeFields";
import { sanitiseInstantConfig } from "@/lib/estimate/instantQuoteReadiness";
import { TRADE_LABELS } from "@/lib/estimate/instantQuoteServer";
import { categoryLabel } from "@/lib/i18n/translateContent";
// The one definition of what a company sells, in every shape an offering takes.
// Read, never re-derived — see the note above upsellTopics().
import { companyOfferings } from "@/lib/pricing/offerings";

/**
 * How to ask for each measurement, out loud.
 *
 * Keyed by the measurement keys in MEASURE_SHAPES `reads`. This is genuinely
 * new information — "doorCount" is a form label and "how many cabinet doors
 * there are" is a question a person asks — so it is not a copy of
 * app/data/quoteIntakeFields.js and does not rot alongside it. What WOULD rot
 * is a phrasing map that falls behind the shapes, so unphrasedMeasureKeys()
 * exists and the check fails on any key without one.
 *
 * Note what is not in any of these: a number, a unit price, a duration. The
 * agent asks how many doors; it never says what a door is worth.
 */
export const ASK_PHRASING = {
  doorCount: "how many cabinet doors there are",
  drawerCount: "how many drawer fronts there are",
  boxLinearFt: "how much cabinet box needs covering, in feet along the wall",
  squareFootage: "roughly how big the area is, in square feet",
  treads: "how many steps there are",
  railingFt: "whether there's railing too, and how much of it",
  tearOffLayers: "how many layers of old roofing are up there",
};

/**
 * The judgement questions — condition, access, material — asked as a person
 * would ask them.
 *
 * ══ Why these were missing, and what it cost ══════════════════════════════
 *
 * ASK_PHRASING above covers MEASUREMENTS, and `MEASURE_SHAPES.reads` lists only
 * dimensional keys. So the phone asked how many doors and never asked what
 * state they were in — while the DRAFT model was already being shown
 * `condition`, `hingeType` and `woodSpecies` from app/data/quoteIntakeFields.js
 * and dutifully reporting "They didn't tell us: Wood / Door Material, Cabinet
 * condition, Hinge type" on every single call. Every one of those moves the
 * hours: degreasing heavy build-up doubles the minutes per piece, and a legacy
 * hinge is aligned by hand where a clip locks in.
 *
 * ══ Keyed by TRADE and field, because one key means two things ════════════
 *
 * `condition` is `normal | heavy` for cabinets and
 * `new_or_sound | minor_repair | major_repair` for parging. A table keyed on
 * the field name alone would read the wrong question to one of them, which is
 * worse than asking nothing: the caller answers confidently and the answer
 * lands on a field it does not fit.
 *
 * ══ And they are asked as SYMPTOMS, not as categories ═════════════════════
 *
 * The owner's instruction, and it is the right one: nobody knows whether their
 * kitchen is "moderate complexity". They know whether there are scratches,
 * water marks and peeling. So the question names the things a person can see,
 * and the model maps the answer onto the option — which it can do, because
 * buildCatalogue already hands it the option list for the field.
 */
const JUDGEMENT_PHRASING = {
  "cabinet_refinishing.condition":
    "what condition they're in — any scratches, water damage, chipping or peeling, and whether there's heavy grease build-up",
  "cabinet_refinishing.hingeType":
    "whether the hinges clip on and off, or are the older kind screwed to the frame",
  "cabinet_refinishing.woodSpecies":
    "what the doors are made of — oak, maple, pine, MDF or something else — if they know",
  "parging.condition":
    "what state the wall is in — sound, or is there cracking and crumbling that needs repair first",
  "parging.access":
    "how high up the work is — ground level, a second storey, or somewhere that needs scaffolding",
  "flooring.removeExisting": "whether the old floor needs taking up first",

  // ── Keyed by TRADE, not by category ─────────────────────────────────────
  //
  // The lookup is `${trade}.${key}`, and painting's trade key is "painting"
  // while its FIELDS come from the interior_painting category. Written the
  // other way round these entries silently never fire and the caller gets the
  // generated phrasing instead — which for a boolean reads "whether include
  // ceiling applies", i.e. a form label with a verb bolted on.
  "painting.includeCeiling": "whether the ceilings are being painted too",
  "painting.coats": "whether one coat will cover it or it needs two",

  // Numbers, and deliberately written rather than skipped. The
  // judgements-only rule exists so painting does not ask for a room's length,
  // width and height when squareFootage already covers it — but a sink cutout
  // and a run of upgraded edge are separate priced items, not a second way of
  // measuring the same slab.
  "countertop.sinkCutouts":
    "how many cutouts there are — a sink, a cooktop, anything cut through the top",

  // "pitch (rise/12)" is what the form calls it and not a thing anyone says.
  "roofing.pitch":
    "how steep the roof is — walkable, or steep enough that it needs harnesses",
  "epoxy.surfaceCondition":
    "what the floor is like now — sound, or is there cracking, pitting or old coating to come off",
};

/**
 * A question for a field nobody wrote one for.
 *
 * Built from the field's own label and options rather than skipped, so a field
 * added to quoteIntakeFields.js is asked about on the phone the same day it
 * appears in the builder. A generated question is worse than a written one and
 * enormously better than silence — the previous behaviour was to ignore the
 * field entirely, which is how three cabinet questions went unasked for months.
 *
 * Returns null for anything that would read as money — same stance as
 * safeMaterialLabel, and for the same reason.
 */
function generatedPhrasing(field) {
  const label = String(field?.label || field?.key || "").trim();
  if (!label || MONEY_SHAPED.test(label) || NOT_A_LABEL.test(label)) return null;
  const lower = label.toLowerCase();

  if (field?.type === "boolean") return `whether ${lower} applies`;

  const options = Array.isArray(field?.options) ? field.options : [];
  if (options.length && options.length <= 6) {
    const words = options
      .map((o) => String(o).replace(/_/g, " ").trim())
      .filter((o) => o && !MONEY_SHAPED.test(o));
    if (words.length) return `${lower} — ${words.join(", ")}`;
  }
  return lower;
}

/**
 * How many questions one trade may contribute.
 *
 * Interior painting has ten intake fields. Reading ten questions at somebody
 * who rang to ask for a price is the form-not-a-conversation failure the prompt
 * spends a paragraph warning against, and the caller hangs up somewhere around
 * the sixth. Measurements come first because they are what the estimate cannot
 * run without; judgement questions fill whatever is left.
 */
const MAX_ASKS_PER_TRADE = 6;

/**
 * Instant-quote TRADE keys that are not their own category key.
 *
 * `fieldsForCategory` is keyed by service category and the instant estimate is
 * keyed by trade, and for three of them those are different words. Left
 * unmapped they resolve to nothing and the trade silently loses every judgement
 * question — which is the failure being fixed here, reintroduced one layer
 * down. `unmappedFieldTrades()` below turns a future mismatch into a check
 * failure rather than a quieter phone call.
 *
 * Painting maps to the interior category deliberately: the two carry the same
 * field list, and the interior/exterior split is a question the estimator asks
 * from the address and the caller's own words rather than something worth
 * spending one of six phone questions on.
 */
const TRADE_FIELD_CATEGORY = {
  roofing: "roofing_service",
  stair: "stairs",
  painting: "interior_painting",
};

/** The category whose intake fields describe this trade. */
function fieldCategoryFor(trade) {
  return TRADE_FIELD_CATEGORY[trade] || trade;
}

/**
 * Phrasings written for a field that does not exist.
 *
 * Every entry above is keyed `trade.fieldKey`, and both halves are easy to get
 * wrong: the trade key and the category key differ for three trades, and the
 * WEB FORM's own input list (INTAKE_INPUTS in the instant-quote flow) uses
 * different names again — `cutouts` there is `sinkCutouts` here. A phrasing
 * keyed on the wrong one is not an error anybody sees; it simply never fires,
 * and the caller gets the generated question or none at all.
 *
 * Empty, enforced by the check.
 */
export function deadJudgementPhrasings() {
  const out = [];
  for (const composite of Object.keys(JUDGEMENT_PHRASING)) {
    const [trade, key] = composite.split(".");
    const fields = fieldsForCategory({ key: fieldCategoryFor(trade) }) || [];
    if (!fields.some((f) => f?.key === key)) out.push(composite);
  }
  return out;
}

/**
 * Instant trades whose judgement questions would vanish silently.
 *
 * Blocked trades are excluded — a polygon on a map is not askable and that is
 * already a decision. Everything else must resolve to a category that has
 * fields, or the phone is quietly asking less than the draft model expects.
 * Run by the check.
 */

export function unmappedFieldTrades() {
  const out = [];
  for (const trade of Object.keys(INSTANT_ESTIMATE_TRADES)) {
    const shape = measureShapeFor(trade);
    if (!shape || shape.blocked) continue;
    const fields = fieldsForCategory({ key: fieldCategoryFor(trade) }) || [];
    if (!fields.length) out.push(trade);
  }
  return out;
}

/** The address of the WORK, for the trades measured from one. */
const ADDRESS_PHRASING = "the address of the property, so it can be measured";

/**
 * Measurement keys a shape reads that nobody has written a spoken question for.
 *
 * Empty, or the agent would be told to collect something it cannot name. Run by
 * the check, so adding a field to MEASURE_SHAPES fails loudly here rather than
 * silently producing a shorter question list.
 */
export function unphrasedMeasureKeys() {
  const out = [];
  // Per TRADE, not per shape. Two trades share `manual_units` and read
  // different fields (see TRADE_SHAPES in callEstimate.js), so walking the
  // shapes would miss anything a trade-specific shape introduced — exactly the
  // silent shortening this function exists to prevent.
  for (const trade of Object.keys(INSTANT_ESTIMATE_TRADES)) {
    const shape = measureShapeFor(trade);
    if (!shape || shape.blocked) continue;
    for (const key of shape.reads || []) {
      if (!ASK_PHRASING[key] && !out.includes(key)) out.push(key);
    }
  }
  return out;
}

// Anything that could read as money, a percentage, or a rate. Deliberately
// broad: a dropped material label costs the agent one prompt ("which finish
// did you have in mind?"), where a kept one puts a number in its mouth.
//
// It is NOT "contains a digit". Real material names carry small numbers —
// "3-tab asphalt shingles", "24ga standing seam", "2-coat polyaspartic" — and
// dropping those would quietly shorten the list a contractor configured. What
// is rejected is a run of three or more digits (every price is one), a
// currency mark, a percentage, and the per-unit phrasings a rate arrives in.
const MONEY_SHAPED =
  /[$€£¥]|\b(?:usd|cad|eur|gbp)\b|\d[\d,.]{2,}|\d\s*%|\bper\b|\/\s*(?:sq|ft|sf|each|door|drawer|hour|hr|day|kitchen)\b/i;

// A label is a noun phrase. Newlines, colons and markdown fences are how text
// stops being a label and starts being a section header in someone else's
// prompt — see the injection note at the top.
const NOT_A_LABEL = /[\n\r`{}<>|]|--|^\s*#/;

/**
 * One material label, or null if it isn't safe to put in a prompt.
 *
 * Rejects rather than repairs. A label with the price stripped out reads as the
 * contractor's own wording and isn't, and the contractor never sees the edit.
 */
export function safeMaterialLabel(label) {
  const s = String(label ?? "").trim();
  if (!s || s.length > 60) return null;
  if (MONEY_SHAPED.test(s)) return null;
  if (NOT_A_LABEL.test(s)) return null;
  return s;
}

/** At most this many materials read out per trade. A list is not a conversation. */
const MAX_MATERIALS = 5;

/**
 * The questions for one company's instantly-quotable trades.
 *
 * Pure — no database — so the check can execute it against a cabinet-only
 * company, a roofing company, a company with nothing enabled, and a company
 * whose material labels are hostile.
 *
 * @param rows [{ trade, label, materials: [{ key, label }] }] — already
 *             per-company; `label` in the company's own language.
 * @returns [{ trade, label, asks: string[], materials: string[] }]
 */
export function quoteTopics(rows = []) {
  const topics = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const spec = INSTANT_ESTIMATE_TRADES[row?.trade];
    if (!spec) continue;

    const shape = measureShapeFor(row.trade);
    // Unknown or un-askable (a polygon on a map, a list of items to haul). Not
    // a gap: a question the caller cannot answer is worse than no question.
    if (!shape || shape.blocked) continue;

    const asks = [];
    if (shape.needsAddress) asks.push(ADDRESS_PHRASING);
    for (const key of shape.reads || []) {
      const phrase = ASK_PHRASING[key];
      if (phrase && !asks.includes(phrase)) asks.push(phrase);
    }

    // ── The same fields the DRAFT model is shown ────────────────────────
    //
    // fieldsForCategory is what buildCatalogue reads, so this is one list read
    // twice rather than a second hand-written one. The measurements above come
    // from MEASURE_SHAPES because those decide whether an estimate can run at
    // all; everything else on the field list is a judgement the price depends
    // on and nobody was asking for.
    //
    // Skipped when the material list already covers it: `material` is a select
    // that picksMaterial handles by name, and asking twice invites two answers
    // to the same question on one quote.
    for (const field of fieldsForCategory({ key: fieldCategoryFor(row.trade) }) || []) {
      if (asks.length >= MAX_ASKS_PER_TRADE) break;
      const key = field?.key;
      if (!key || key === "material" || ASK_PHRASING[key]) continue;

      // ── Judgements only. Measurements belong to MEASURE_SHAPES ─────────
      //
      // A `number` field here is a dimension, and the shape above has already
      // asked for the one the estimate actually runs on. Painting reads
      // squareFootage; adding "room length", "room width" and "ceiling height"
      // on top asks the caller to measure their house three more ways for a
      // figure nobody uses. So numbers are skipped unless somebody wrote a
      // question for that specific one on purpose.
      const written = JUDGEMENT_PHRASING[`${row.trade}.${key}`];
      if (!written && field?.type === "number") continue;

      const phrase = written || generatedPhrasing(field);
      if (phrase && !asks.includes(phrase)) asks.push(phrase);
    }

    const materials = spec.hasMaterials
      ? (Array.isArray(row.materials) ? row.materials : [])
          .map((m) => safeMaterialLabel(m?.label))
          .filter(Boolean)
          .slice(0, MAX_MATERIALS)
      : [];

    // Nothing to ask and nothing to choose is not a topic. It happens when a
    // shape reads only fields nobody has phrased yet, which the drift check
    // above turns into a failure rather than a silent omission.
    if (!asks.length && !materials.length) continue;

    topics.push({
      trade: row.trade,
      label: String(row.label || TRADE_LABELS[row.trade] || row.trade).slice(0, 80),
      asks,
      materials,
      // Said out loud only when the company has configured options. A trade
      // that prices on material with none set up gets the open question rather
      // than an empty list.
      picksMaterial: Boolean(spec.hasMaterials),
    });
  }

  return topics;
}

/**
 * The same thing, read from this company's own rows.
 *
 * InstantQuoteConfig is the authority — it is what the public instant quote
 * itself reads, so the agent asks for exactly what that form would need. Labels
 * come from the matching ServiceCategory in the company's language, because the
 * agent says the trade name out loud; the measurement phrasings stay English
 * because the whole instruction set is English (the model speaks French to a
 * French caller either way — see provisionAgent's `language`).
 */
export async function quoteTopicsForCompany(companyId, language = "en") {
  const rows = await db.instantQuoteConfig.findMany({
    where: { companyId, enabled: true },
    select: { trade: true, config: true },
  });
  if (!rows.length) return [];

  const byKey = new Map();
  const keys = rows.map((r) => categoryKeyForTrade(r.trade)).filter(Boolean);
  if (keys.length) {
    const categories = await db.serviceCategory.findMany({
      where: { key: { in: keys } },
      select: { key: true, label: true, labelTranslations: true },
    });
    for (const c of categories) byKey.set(c.key, c);
  }

  return quoteTopics(
    rows.map((row) => {
      const category = byKey.get(categoryKeyForTrade(row.trade));
      return {
        trade: row.trade,
        label: category ? categoryLabel(category, language) : TRADE_LABELS[row.trade],
        // Through the sanitiser, like every other read of a saved config: the
        // row is browser-authored JSON and a malformed materials array must
        // cost one question, not the whole provision.
        materials: sanitiseInstantConfig(row.config)?.materials || [],
      };
    }),
  );
}

/**
 * Where a caller should send photos, or null.
 *
 * The company's own published contact address and nothing else. A call cannot
 * carry a photo, and the ask is worth making — but only to somewhere the
 * company actually reads. The obvious alternatives were rejected:
 *
 *   the sending domain (emailFromLocal@emailDomain) — outbound only, and on an
 *     unverified domain it does not exist at all;
 *   a text to the voice number — Retell's line cannot receive MMS, and the crew
 *     inbox is a different number belonging to a different provider;
 *   a link texted to the caller — needs an SMS send we are not making here.
 *
 * Null when they have not set one, and null means the whole photo instruction
 * is omitted from the prompt. Absence of an address is not an invitation to
 * invent one (AGENTS.md failure class 5).
 */
export function photoDestination(company) {
  const email = String(company?.email ?? "").trim();
  if (!email || email.length > 120) return null;
  // A conservative charset, not "something@something.something". This string is
  // read out by an agent that may never say a figure, and the loose version
  // accepted "$5,000@example.com" as a perfectly good address — a price in the
  // one part of the section that isn't authored here.
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) return null;
  return email;
}

/* ────────────────────── What else the business sells ─────────────────────── */
//
// The owner asked whether the receptionist could "be a salesman too and offer
// other services and add-ons that the company may have". It can, and this is
// the safe way to let it, because the hard part was already solved for a
// different reason.
//
// ══ It may only name what THIS company actually prices ═════════════════════
//
// lib/pricing/offerings.js is the one definition of a company's sellable
// surface — the price-book add-ons, the takeoff extras, the door materials, the
// tiered packages, and their own Product rows. It exists because the call-draft
// reader looked at ONE table and told a cabinet painter he does not sell the
// soft-close hinges he charges $35 a door for. Reading a slice of my own here
// would reintroduce exactly that bug, one surface further forward: a
// receptionist offering something the company stopped selling is worse than one
// that offers nothing.
//
// An add-on the company has ZEROED is already excluded there — addOnsForCategory
// reports an upgrade only when the company's own merged book prices it — so an
// upgrade the agent mentions is one the quote builder can actually put a number
// on.
//
// ══ Mentioning is not quoting ══════════════════════════════════════════════
//
// Absolute rule 1 is untouched. LABELS travel and rates do not: nothing in this
// function has ever seen a figure, offerings.js uses the rate only as a
// predicate, and every label goes through safeMaterialLabel() — the same guard
// the material list uses, and for the same two reasons. A contractor who typed
// "Soft-Close Hinges — $35/door" into their own products list would otherwise
// put a price into the mouth of an agent forbidden from saying one, and a label
// containing instructions is a prompt injection with a settings screen for a
// front door. Rejected, never repaired.

/** At most this many upgrades named per service. A list is not a conversation. */
const MAX_UPSELLS = 4;

/**
 * What else each service can carry, as labels the agent may mention.
 *
 * Pure — takes companyOfferings() output rather than loading it — so a check can
 * run it against a company with hostile labels, no add-ons, and no products.
 *
 * Add-ons come FIRST because they are the only shape a caller's interest can
 * land on as a ticked upgrade; extras and the company's own products still
 * reach the draft, as a line for whoever reviews it.
 *
 * @param offerings companyOfferings() output
 * @returns [{ service, offers: string[] }] — services with nothing extra to
 *          sell are omitted entirely rather than listed empty.
 */
export function upsellTopics(offerings = []) {
  const out = [];
  for (const c of Array.isArray(offerings) ? offerings : []) {
    if (!c?.label) continue;
    const offers = [
      ...(c.addOns || []).map((a) => a.label),
      ...(c.extras || []).map((e) => e.label),
      ...(c.products || []).map((p) => p.name),
    ]
      .map(safeMaterialLabel)
      .filter(Boolean);

    const unique = [...new Set(offers)].slice(0, MAX_UPSELLS);
    if (!unique.length) continue;
    out.push({ service: String(c.label).slice(0, 80), offers: unique });
  }
  return out;
}

/**
 * The same thing, read from this company's own rows.
 *
 * Deliberately the same query shape lib/ai/callQuoteDraft.js uses to build the
 * catalogue it shows the model, because the two must not disagree: the agent
 * must never mention an upgrade the draft reader would then call unavailable.
 */
export async function upsellTopicsForCompany(companyId, language = "en") {
  const [rows, products] = await Promise.all([
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      // The company's own patch over the trade's price book — an upgrade counts
      // as offered only when THIS company prices it.
      select: {
        rates: true,
        category: { select: { id: true, key: true, label: true, labelTranslations: true, customFields: true } },
      },
    }),
    // Names only. unitPrice is deliberately not selected: a rate that is never
    // loaded is a rate that cannot reach a prompt.
    db.product.findMany({
      where: { companyId, active: true },
      select: { id: true, name: true, categories: { select: { key: true } } },
    }),
  ]);
  if (!rows.length) return [];

  return upsellTopics(
    companyOfferings({
      categories: rows.map((r) => ({
        ...r.category,
        // Spoken aloud, so it is the company's own label in the caller's
        // language — same reason the quote topics carry one.
        label: categoryLabel(r.category, language),
        rates: r.rates,
      })),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        categoryKeys: p.categories.map((c) => c.key),
      })),
    }),
  );
}
