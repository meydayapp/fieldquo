// lib/pricing/stainFinish.js
//
// Which STAIN a cabinet or stair job is quoted with — gel or liquid — and the
// words a line says about it.
//
// ── Why (owner, 2026-10-03) ─────────────────────────────────────────────────
//
// "If it is relevant for stain it should have gel or liquid." The two are
// different jobs, not two colours of one job:
//
//   liquid  a penetrating stain. It soaks INTO bare wood, so whatever finish
//           is on the wood now — paint, varnish, lacquer — has to come off
//           first. On maple, birch, cherry and pine it soaks in unevenly
//           (blotching) unless the wood is conditioned.
//   gel     a thickened stain that SITS ON the surface. It goes over the old
//           finish after a clean and a light scuff-sand — no stripping — and
//           does not blotch. It is slower per piece: wiped or brushed by hand,
//           often two or three coats for depth, with long recoat times over an
//           existing finish (General Finishes asks 72 h).
//
// Sources, read 2026-10-03: Bob Vila, "Gel Stain" (2019-11-18); General
// Finishes FAQ on gel stain over existing finishes; Angi gel-stain cabinet
// pricing (search summary — the page refused our fetch); Fixr cabinet painting
// (2026-01-27). Prices are in app/data/tradePriceBooks.js beside each figure.
//
// ── Absent means liquid, on purpose ─────────────────────────────────────────
//
// Every stain line written before this existed was the liquid one — the
// cabinet stain add-on said "strip the existing finish to bare wood", and a
// stair refinish sands the treads to bare wood — so a group with no
// `stainType` reads as liquid and prices and prints exactly as it did.
//
// Pure: no React, no database. scripts/check-stain-finish.mjs executes it.

export const STAIN_TYPES = Object.freeze(["liquid", "gel"]);

/** "liquid" | "gel" for a stored or posted value; absent or junk is liquid. */
export function normaliseStainType(value) {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return v === "gel" ? "gel" : "liquid";
}

/** Was a stain type actually CHOSEN (as opposed to the liquid an absence reads as)? */
export function stainTypeChosen(value) {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return STAIN_TYPES.includes(v);
}

// What a stair line says about the stain, by document language (non-
// negotiable 6). English and French, the same two the cabinet add-on table
// carries (lib/pricing/tradeScope.js CABINET_ADDON_TEXT); any other language
// gets English, the same fallback that table uses.
const STAIR_STAIN_TEXT = {
  en: {
    liquid: "Penetrating (liquid) stain on bare wood, sealed with clear coats.",
    gel: "Gel stain over the existing finish after a clean and light scuff-sand, sealed with clear coats.",
  },
  fr: {
    liquid: "Teinture pénétrante (liquide) sur bois nu, scellée au vernis.",
    gel: "Teinture en gel sur le fini existant après nettoyage et léger égrenage, scellée au vernis.",
  },
};

/** The sentence a staircase's treads line carries for a chosen stain type. */
export function stairStainText(stainType, language) {
  const l = String(language || "").trim().toLowerCase();
  const table = l === "fr" || l.startsWith("fr-") ? STAIR_STAIN_TEXT.fr : STAIR_STAIN_TEXT.en;
  return table[normaliseStainType(stainType)];
}

// ── Stripping to bare wood (owner, 2026-10-03) ──────────────────────────────
//
// "Research average stripping sanding very chemical.. that could be used."
// When a stain needs BARE wood, the existing finish comes off first.
//
// ── Where the stripping is charged (owner, 2026-10-04) ──────────────────────
//
// INSIDE the all-in stained price, never as a line of its own. The owner's
// words on the first version (a $45 → $10 per-piece add-on plus an hourly
// stripping line): "painting right now is 150 default that includes all the
// labor etc.. staining requires more labor because you're sanding to bare
// wood.. so it should be more.. make sure you look at real pricing that
// encompasses the whole process." So a stained door is quoted as ONE all-in
// rate per door or drawer front (stainedUnitRate below) — strip or sand,
// stain, seal — the way the market publishes it, and the method chosen here
// moves only the crew's HOURS in Cost & margin (lib/pricing/cabinetLabour.js;
// stairs: tradeLabourHours). The client is never charged for the stripping a
// second time. Stairs carry their stripping in the stair book's High tier,
// whose own description is "painted-over surfaces to strip".
//
// When it is needed:
//   cabinets  the stain finish is ticked and the stain is liquid (a cabinet
//             being refinished always has a finish on it), OR the colour is
//             going lighter (dark → light), which no stain does over the old
//             colour — gel included. Gel over the existing finish, same or
//             darker colour: no stripping.
//   stairs    the staircase is PAINTED and the stain is not gel, or the
//             colour is going lighter on a painted staircase. A clear-finished
//             (varnished) staircase needs no line: the stair refinish rates
//             already sand the treads to bare wood (lib/documents/
//             serviceContent.js, the stairs paragraph), and charging a second
//             sanding would bill the same treads twice.
//
// How long — production rates in the trade's price book, `stripping.chemical`
// and `stripping.sanding`, editable on the rate card. RESEARCHED DEFAULTS,
// INFERRED (no source publishes hours per cabinet door; these are worked out
// from published per-area figures, read 2026-10-03):
//
//   chemical  homewyse "Cost to Remove Paint" (September 2026, US national):
//             $5.72–11.11 per sq ft to apply remover, scrape, clean and sand.
//             Midpoint $8.42; taking ~80% as labour at a $60/h trade rate gives
//             ~0.11 h per sq ft. A cabinet door is ~7 sq ft stripped (two
//             faces of a 15" × 30" door plus edges), a drawer front ~2.5:
//             0.77 → 0.75 h a door, 0.28 → 0.25 h a drawer front. Cross-check:
//             designedcurated.com (2026) puts a stained 28-door kitchen at
//             40–50 labour hours with stripping ~80% of them — ~1.3 h a door,
//             so 0.75 is the cautious end.
//   sanding   homewyse "Cost to Refinish Cabinets" (September 2026): prep "up
//             to 6 hr per 100 SF" to scrape and sand a door for stain →
//             0.06 h per sq ft: 0.42 → 0.4 h a door, 0.15 h a drawer front.
//             Sanding suits a clear finish or one thin coat; built-up paint
//             clogs paper, which is what the chemical rate is for.
//   stairs    BBS Flooring (Markham ON, 2026-05-11): sanding a 13-tread
//             staircase takes 3–5 h → 0.31 → 0.3 h a tread. A riser is ~70%
//             of a tread's face (7½" × 36" against 11" × 36" plus nosing) →
//             0.2 h. Chemical scales by the same 0.11 / 0.06 ratio as cabinets:
//             0.55 → 0.5 h a tread, 0.35 h a riser. A handrail is ~8" of girth
//             per linear foot (~0.67 sq ft) and profiled, taken at twice the
//             flat rate: chemical 0.15 h, sanding 0.1 h a linear foot.
//
// They are defaults: the rate card says so, and a company's own figures
// replace them key by key (getPriceBook's merge).

export const STRIP_METHODS = Object.freeze(["chemical", "sanding"]);

/** "chemical" | "sanding"; absent and junk are chemical (the method that works on paint). */
export function normaliseStripMethod(value) {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return v === "sanding" ? "sanding" : "chemical";
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const pos = (v) => Math.max(0, num(v));
const round2 = (n) => Math.round(num(n) * 100) / 100;

/** A book's hours for one method and one part, never negative, never NaN. */
function hoursRate(book, method, key) {
  return pos(book?.stripping?.[normaliseStripMethod(method)]?.[key]);
}

/** Does this cabinet job need its finish stripped? See the header. */
export function cabinetNeedsStripping(config) {
  if (!config?.stainFinish) return false;
  return normaliseStainType(config.stainType) === "liquid" || config.stainDarkToLight === true;
}

/**
 * Hours to strip the stained pieces of a cabinet job, or 0.
 *
 * The pieces are the stain line's: every door and drawer front, or the
 * estimator's count for the stain (`addOnUnits.stainFinish` — a stained island
 * beside painted perimeter cabinets), in which case the hours scale by the
 * share of pieces stained.
 */
export function cabinetStrippingHours(config, book) {
  if (!cabinetNeedsStripping(config)) return 0;
  const doors = pos(config?.doors);
  const drawers = pos(config?.drawers);
  const all = doors + drawers;
  if (!(all > 0)) return 0;
  const method = config?.stripMethod;
  let hours = doors * hoursRate(book, method, "hoursPerDoor") + drawers * hoursRate(book, method, "hoursPerDrawer");
  const stated = Number(config?.addOnUnits?.stainFinish);
  if (Number.isFinite(stated) && stated >= 0) hours = (hours * Math.min(stated, all)) / all;
  return Number.isFinite(hours) ? round2(hours) : 0;
}

/** Does this staircase need stripping? See the header. */
export function stairNeedsStripping(section) {
  if (section?.existingFinish !== "painted") return false;
  return normaliseStainType(section.stainType) === "liquid" || section.stainDarkToLight === true;
}

/**
 * Hours to strip a painted staircase: its treads, its risers when they are
 * being refinished (`paintRisers` — the same switch that bills them), and its
 * handrail.
 */
export function stairStrippingHours(section, book) {
  if (!stairNeedsStripping(section)) return 0;
  const method = section?.stripMethod;
  const hours =
    pos(section?.treads) * hoursRate(book, method, "hoursPerTread") +
    (section?.paintRisers ? pos(section?.risers) * hoursRate(book, method, "hoursPerRiser") : 0) +
    pos(section?.handrailFt) * hoursRate(book, method, "hoursPerRailFt");
  return Number.isFinite(hours) ? round2(hours) : 0;
}

// ── The all-in stained price (owner, 2026-10-04) ────────────────────────────
//
// A stained door or drawer front is priced as the company's own PAINTING rate
// per piece (the unit price the cabinet calculator already carries — $150 by
// default, app/data/tradePriceBooks.js cabinet_refinishing.perDoor, the
// all-in TrueFinish figure) PLUS the stain difference from the price book:
//
//   to bare wood (liquid, or any stain going dark → light)
//             addOns.stainFinishPerUnit — default $45 → $195 a piece all-in,
//             +30% over painting. It includes the stripping or sanding.
//   gel over the existing finish (no stripping)
//             addOns.gelStainPerUnit — default $0 → $150 a piece, the same
//             as painting.
//
// Built on the painting rate, not a separate absolute rate, so a company that
// prices painting higher or lower carries the same relationship into stain,
// and a company that set its own stain difference keeps it. The research and
// the arithmetic are beside the two figures in tradePriceBooks.js and in
// docs/research/PRICING-EXTERIOR-STAIN-DRYWALL-2026.md §F.

/**
 * The per-piece difference the stain adds to the painting rate for this job:
 * the bare-wood difference when the finish has to come off (liquid, or going
 * lighter), else the gel difference. May be negative (a company that sells gel
 * under its painting price); the unit rate it produces never goes below 0.
 */
export function stainPremiumPerUnit(config, book) {
  const a = book?.addOns || {};
  return round2(num(cabinetNeedsStripping({ ...config, stainFinish: true }) ? a.stainFinishPerUnit : a.gelStainPerUnit));
}

/** How many of the pieces are stained: none without the tick, else all or the estimator's count (clamped). */
export function stainedPieceCount(config, pieces) {
  const all = pos(pieces);
  if (!config?.stainFinish || !(all > 0)) return 0;
  const stated = Number(config?.addOnUnits?.stainFinish);
  if (Number.isFinite(stated) && stated >= 0) return Math.min(Math.floor(stated), all);
  return all;
}

/** The all-in stained rate per piece: the painting rate plus the stain difference, never below 0. */
export function stainedUnitRate(paintRate, premium) {
  return round2(Math.max(0, num(paintRate) + num(premium)));
}

// What a stained line says, by document language (en/fr, the cabinet lines'
// two; anything else English — the same rule as CABINET_ADDON_TEXT).
const STAINED_TEXT = {
  en: {
    bare: {
      name: "stained finish (to bare wood)",
      detail: "All-in per door or drawer front: the existing finish taken off to bare wood, penetrating stain in the chosen colour, sealed with clear coats.",
    },
    gel: {
      name: "gel-stained finish (over the existing finish)",
      detail: "All-in per door or drawer front: cleaned and lightly scuff-sanded, gel stain in the chosen colour applied by hand, sealed with clear coats. No stripping.",
    },
  },
  fr: {
    bare: {
      name: "fini teint (jusqu'au bois nu)",
      detail: "Tout compris par porte ou façade de tiroir : fini existant retiré jusqu'au bois nu, teinture pénétrante de la couleur choisie, scellée au vernis.",
    },
    gel: {
      name: "fini teint au gel (sur le fini existant)",
      detail: "Tout compris par porte ou façade de tiroir : nettoyage et léger égrenage, teinture en gel de la couleur choisie appliquée à la main, scellée au vernis. Sans décapage.",
    },
  },
};

/** The words of a stained line — `name` follows the service's own label after " — ". */
export function stainedLineText(config, language) {
  const l = String(language || "").trim().toLowerCase();
  const table = l === "fr" || l.startsWith("fr-") ? STAINED_TEXT.fr : STAINED_TEXT.en;
  return cabinetNeedsStripping({ ...config, stainFinish: true }) ? table.bare : table.gel;
}

