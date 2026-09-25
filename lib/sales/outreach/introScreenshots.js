// lib/sales/outreach/introScreenshots.js
//
// Which picture the intro email carries for which trade.
//
// ══ The owner's rule ═════════════════════════════════════════════════════
//
// "Make sure that little screenshot image represents the trade of the
// company it is being sent to — a plumber gets the plumbing quote, the
// roofing one has the little satellite image, paving has the polygons and
// measurements, the kitchen cabinet painting one is great. We have services
// by trade, so it should speak to them almost personally."
//
// So the table below is keyed by the CATALOGUE trade (lib/trades/catalog.js,
// the keys the quote builder prices with) and every one of the sixty-odd
// resolves to a frame — its own where the product has a card for that trade,
// the generic quote where it does not. The email is sent for a PROSPECT,
// whose trade is a discovery key (lib/sales/discovery/trades.js: "roofing",
// "paving", "cabinets" …); introScreenshotFor() maps that to the catalogue
// through DISCOVERY_TRADES[key].categoryKeys, first entry, and then to a frame.
//
// ══ What a frame is ══════════════════════════════════════════════════════
//
// A photograph of the real product, never a mock-up:
//
//   takeoff   the trade's own card in the quote builder — the roofing card
//             after "Measure from satellite" (the still, the facets, the
//             linear details), the paving card with the driveway traced and
//             measured, the gutters, siding, insulation, painting, stairs,
//             countertop, garage door, flooring, driveway sealing, home
//             inspection and snow removal cards, and the landscaping trades'
//             lot outline on the still. Shot by docs/screens/app-guide/
//             harness (TakeoffFrame.jsx, fixtures/takeoffs.js) at 1200 wide
//             in EN/FR/ES, cropped by scripts/build-intro-screenshots.mjs.
//   quote     the quote as the homeowner sees it on their phone — the
//             cabinet quote the owner called great. The fallback for every
//             trade with no card of its own: plumbing, electrical, HVAC and
//             the cleaning trades quote from their price books as line items,
//             and the honest picture of that is the document the client gets.
//
// Files live under public/product/email/quote-<frame>.<lang>.png, served
// from the app's own origin. isIntroFrameFile() and the check assert every
// trade's file is on disk in all three languages, so the table cannot name
// a frame that would render as a broken image in a prospect's inbox.
//
// Pure: no imports beyond the two tables. The alt text names the trade in
// the email's language, because a screen reader and a client that blocks
// images both get the words.

import { TRADE_CATALOG } from "@/lib/trades/catalog";
import { DISCOVERY_TRADES } from "@/lib/sales/discovery/trades";
import { INTRO_EMAIL_LANGUAGES, isIntroEmailLanguage } from "./introLanguages";

/** The generic quote-on-a-phone. The file is quote-phone.<lang>.png. */
export const INTRO_FRAME_FALLBACK = "phone";

/** The takeoff frames — one per trade that has a card of its own. */
export const INTRO_TAKEOFF_FRAMES = Object.freeze([
  "roofing_service",
  "paving",
  "gutter_services",
  "siding",
  "insulation",
  "interior_painting",
  "exterior_painting",
  "stairs",
  "countertop",
  "garage_door",
  "flooring",
  "driveway_sealing",
  "home_inspection",
  "snow_removal",
  "landscaping_design",
  "lawn_care",
  "lawn_mowing",
  "irrigation",
]);

/**
 * Catalogue trade → frame. A trade with its own card uses it; a trade that
 * shares a card with a sibling points at the sibling's (pressure washing
 * of a driveway is the driveway-sealing card's surface; fence trades have
 * no card and get the quote). Everything else is the fallback, listed
 * explicitly so the check can prove every catalogue key was decided rather
 * than defaulted by omission.
 */
export const INTRO_SCREENSHOT_BY_TRADE = Object.freeze({
  // Its own card.
  ...Object.fromEntries(INTRO_TAKEOFF_FRAMES.map((k) => [k, k])),
  // A sibling's card, because the picture is the same work.
  flooring_install: "flooring",
  pressure_washing_driveway: "driveway_sealing",
  fence_services: INTRO_FRAME_FALLBACK,
  fence_repair: INTRO_FRAME_FALLBACK,
  fence_restoration: INTRO_FRAME_FALLBACK,
  // The quote the homeowner sees — the cabinet quote, which is the owner's
  // "great" one, and the honest frame for every trade quoted as line items.
  cabinet_refinishing: INTRO_FRAME_FALLBACK,
  cabinet_refacing: INTRO_FRAME_FALLBACK,
  kitchen_design: INTRO_FRAME_FALLBACK,
  drywall: INTRO_FRAME_FALLBACK,
  drywall_install: INTRO_FRAME_FALLBACK,
  demolition: INTRO_FRAME_FALLBACK,
  demolition_contractor: INTRO_FRAME_FALLBACK,
  general_contracting: INTRO_FRAME_FALLBACK,
  general_contracting_reno: INTRO_FRAME_FALLBACK,
  construction: INTRO_FRAME_FALLBACK,
  remodeling: INTRO_FRAME_FALLBACK,
  carpentry: INTRO_FRAME_FALLBACK,
  tiling: INTRO_FRAME_FALLBACK,
  residential_cleaning: INTRO_FRAME_FALLBACK,
  deep_cleaning: INTRO_FRAME_FALLBACK,
  commercial_cleaning: INTRO_FRAME_FALLBACK,
  janitorial: INTRO_FRAME_FALLBACK,
  carpet_cleaning: INTRO_FRAME_FALLBACK,
  window_cleaning: INTRO_FRAME_FALLBACK,
  handyman: INTRO_FRAME_FALLBACK,
  plumbing: INTRO_FRAME_FALLBACK,
  electrical: INTRO_FRAME_FALLBACK,
  hvac_install: INTRO_FRAME_FALLBACK,
  hvac_repair: INTRO_FRAME_FALLBACK,
  appliance_repair: INTRO_FRAME_FALLBACK,
  locksmith: INTRO_FRAME_FALLBACK,
  elevator_services: INTRO_FRAME_FALLBACK,
  well_water: INTRO_FRAME_FALLBACK,
  mechanical_contracting: INTRO_FRAME_FALLBACK,
  concrete: INTRO_FRAME_FALLBACK,
  masonry: INTRO_FRAME_FALLBACK,
  excavation: INTRO_FRAME_FALLBACK,
  restoration: INTRO_FRAME_FALLBACK,
  chimney_sweep: INTRO_FRAME_FALLBACK,
  tree_care_service: INTRO_FRAME_FALLBACK,
  pest_control: INTRO_FRAME_FALLBACK,
  pool_spa: INTRO_FRAME_FALLBACK,
  junk_removal: INTRO_FRAME_FALLBACK,
  property_maintenance: INTRO_FRAME_FALLBACK,
  pressure_washing_house: INTRO_FRAME_FALLBACK,
  auto_detailing: INTRO_FRAME_FALLBACK,
  dog_walking: INTRO_FRAME_FALLBACK,
  pooper_scooper: INTRO_FRAME_FALLBACK,
  installation_services: INTRO_FRAME_FALLBACK,
  epoxy: INTRO_FRAME_FALLBACK,
  parging: INTRO_FRAME_FALLBACK,
  // The trades the service seeds added to the catalogue (d1ad0209). None
  // has a takeoff card in the builder or a still to draw on, so each is
  // quoted as line items and the quote is its honest picture.
  air_duct_cleaning: INTRO_FRAME_FALLBACK,
  deck_patio: INTRO_FRAME_FALLBACK,
  doors_windows: INTRO_FRAME_FALLBACK,
  lighting: INTRO_FRAME_FALLBACK,
  security_systems: INTRO_FRAME_FALLBACK,
  sewer_septic: INTRO_FRAME_FALLBACK,
  smart_home: INTRO_FRAME_FALLBACK,
  solar_energy: INTRO_FRAME_FALLBACK,
  moving: INTRO_FRAME_FALLBACK,
  wildlife_control: INTRO_FRAME_FALLBACK,
  caulking_sealants: INTRO_FRAME_FALLBACK,
  furniture_upholstery: INTRO_FRAME_FALLBACK,
  glass: INTRO_FRAME_FALLBACK,
  marine_services: INTRO_FRAME_FALLBACK,
  home_organization: INTRO_FRAME_FALLBACK,
  baby_proofing: INTRO_FRAME_FALLBACK,
});

/** Every frame name the table can produce, deduplicated — what has to be on disk. */
export const INTRO_FRAMES = Object.freeze([...new Set([INTRO_FRAME_FALLBACK, ...Object.values(INTRO_SCREENSHOT_BY_TRADE)])]);

/** The public path of a frame in a language. */
export function introFramePath(frame, language) {
  const lang = isIntroEmailLanguage(language) ? language : INTRO_EMAIL_LANGUAGES[0];
  return `/product/email/quote-${frame}.${lang}.png`;
}

/**
 * The trade's own name in the email's language, for the alt text and the
 * caption. The catalogue labels are English; French and Spanish come from
 * the intro email's own trade table where the discovery trade has one, and
 * the catalogue label stands otherwise (a proper noun does no harm in a
 * caption, and it is never left as "{trade}").
 */
export const INTRO_TRADE_ALT = Object.freeze({
  en: { takeoff: "A {trade} quote in FieldQuo — measured and priced from the contractor's own price book", quote: "A FieldQuo quote on a phone, in the contractor's own name and colour" },
  fr: { takeoff: "Une soumission {trade} dans FieldQuo — mesurée et tarifée à partir de la liste de prix de l'entrepreneur", quote: "Une soumission FieldQuo sur un cellulaire, au nom et à la couleur de l'entrepreneur" },
  es: { takeoff: "Una cotización de {trade} en FieldQuo — medida y valorada desde la lista de precios del contratista", quote: "Una cotización de FieldQuo en un celular, con el nombre y el color del contratista" },
});

/** The discovery trade a catalogue key belongs to, or null. */
export function discoveryTradeForCatalogue(catalogueKey) {
  for (const [key, row] of Object.entries(DISCOVERY_TRADES)) {
    if ((row.categoryKeys || []).includes(catalogueKey)) return key;
  }
  return null;
}

/** The catalogue key a discovery trade prices as, or null. */
export function catalogueKeyForDiscovery(discoveryKey) {
  const row = typeof discoveryKey === "string" && Object.hasOwn(DISCOVERY_TRADES, discoveryKey) ? DISCOVERY_TRADES[discoveryKey] : null;
  const first = row?.categoryKeys?.[0];
  return typeof first === "string" && Object.hasOwn(TRADE_CATALOG, first) ? first : null;
}

/**
 * The frame for a prospect's trade.
 *
 * @param tradeKey  a DISCOVERY key (Prospect.tradeKey) or a catalogue key —
 *                  both are accepted, catalogue first, so a lead typed with
 *                  a catalogue trade resolves too. Null → the fallback.
 * @param language  "en" | "fr" | "es".
 * @param tradeLabel the trade's phrase in the language, for the alt text.
 * @returns { frame, path, alt, kind: "takeoff" | "quote", catalogueKey }
 */
export function introScreenshotFor(tradeKey, language, tradeLabel = "") {
  const lang = isIntroEmailLanguage(language) ? language : INTRO_EMAIL_LANGUAGES[0];
  const catalogueKey =
    typeof tradeKey === "string" && Object.hasOwn(INTRO_SCREENSHOT_BY_TRADE, tradeKey) ? tradeKey : catalogueKeyForDiscovery(tradeKey);
  const frame = catalogueKey && Object.hasOwn(INTRO_SCREENSHOT_BY_TRADE, catalogueKey) ? INTRO_SCREENSHOT_BY_TRADE[catalogueKey] : INTRO_FRAME_FALLBACK;
  const kind = frame === INTRO_FRAME_FALLBACK ? "quote" : "takeoff";
  const label = String(tradeLabel || TRADE_CATALOG[catalogueKey]?.label || "").trim();
  const alt = kind === "takeoff" && label ? INTRO_TRADE_ALT[lang].takeoff.split("{trade}").join(label) : INTRO_TRADE_ALT[lang].quote;
  return { frame, path: introFramePath(frame, lang), alt, kind, catalogueKey };
}
