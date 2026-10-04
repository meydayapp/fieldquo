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
// When a stain needs BARE wood, the existing finish comes off first, and that
// is labour: hours, at the company's own labour rate (Company.labourSellRate,
// Settings → Field work), on a line of its own so the contractor — and the
// client — see what the stripping costs instead of finding it folded into a
// stain premium.
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

/**
 * A builder group with the company's labour rate snapshotted where its
 * stripping line reads it — `stripLabourRate` on a cabinet group, on the
 * takeoff of a stair group — when the group needs stripping and carries no
 * rate yet. The same group (===) otherwise, so a caller can tell nothing
 * changed. Never a saved group: its lines are frozen. This is what makes a
 * group that arrived without the snapshot (a phone-call draft, an older
 * open builder) price the line the screen describes.
 */
export function withStripLabourRate(group, labourRate) {
  const rate = Number(labourRate);
  if (!group || group.persisted || !(rate > 0)) return group;
  if (group.categoryKey === "cabinet_refinishing") {
    if (Number(group.stripLabourRate) > 0 || !cabinetNeedsStripping(group)) return group;
    return { ...group, stripLabourRate: rate };
  }
  if (group.categoryKey === "stairs") {
    const t = group.takeoff;
    const sections = Array.isArray(t?.sections) ? t.sections : [];
    if (Number(t?.stripLabourRate) > 0 || !sections.some(stairNeedsStripping)) return group;
    return { ...group, takeoff: { ...t, stripLabourRate: rate } };
  }
  return group;
}

const STRIP_TEXT = {
  en: {
    chemical: "Stripping to bare wood — chemical stripper",
    sanding: "Stripping to bare wood — sanding",
    cabinets: "Remove the existing finish from the stained doors and drawer fronts so the stain reaches bare wood. Labour, by the hour.",
    stairs: "Remove the paint from the treads, risers and handrail priced above so the stain reaches bare wood. Labour, by the hour.",
  },
  fr: {
    chemical: "Décapage jusqu'au bois nu — décapant chimique",
    sanding: "Décapage jusqu'au bois nu — ponçage",
    cabinets: "Retrait du fini existant des portes et façades de tiroirs teintes pour que la teinture atteigne le bois nu. Main-d'œuvre, à l'heure.",
    stairs: "Retrait de la peinture des marches, contremarches et main courante chiffrées ci-dessus pour que la teinture atteigne le bois nu. Main-d'œuvre, à l'heure.",
  },
};

/**
 * The stripping line: hours × the company's labour rate, or null when there
 * are no hours or no rate. Null for a missing rate on purpose — a $0 line
 * would print "stripping, free" on the client's copy; the builder says the
 * rate is missing instead.
 */
export function strippingLine({ hours, labourRate, method, scope = "cabinets", language } = {}) {
  const h = round2(pos(hours));
  const r = round2(pos(labourRate));
  if (!(h > 0) || !(r > 0)) return null;
  const l = String(language || "").trim().toLowerCase();
  const say = l === "fr" || l.startsWith("fr-") ? STRIP_TEXT.fr : STRIP_TEXT.en;
  return {
    description: say[normaliseStripMethod(method)],
    quantity: h,
    unit: "hour",
    rate: r,
    amount: round2(h * r),
    detail: scope === "stairs" ? say.stairs : say.cabinets,
    // Staff-side marker: which job wrote it (the stain's stripping), for the
    // cost panel and the check. `meta` reaches no client-facing renderer.
    meta: { stripping: { method: normaliseStripMethod(method), hours: h } },
  };
}
