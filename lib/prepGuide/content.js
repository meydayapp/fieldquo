// lib/prepGuide/content.js
//
// The built-in client preparation guide for every trade, in every language
// the guide is written in — and the map from ServiceCategory.key to the guide
// it uses.
//
// ── Why a family map ────────────────────────────────────────────────────────
//
// lib/documents/serviceContent.js shares step sets across trades that follow
// the same shape, and says why: sixty near-identical arrays drift. The same
// holds here, harder — a lawn-mowing visit and a lawn-care visit ask the
// homeowner for exactly the same four things, and two copies would be two
// places for the wording to rot. So the eighty-five catalogue keys map onto
// sixty-seven guides, and a trade gets its own only where the list genuinely
// differs (a roofer's is about the driveway and the attic; a painter's about
// furniture and wall art; cabinets carry TrueFinish's own list).
//
// ── Languages ───────────────────────────────────────────────────────────────
//
// The guide body is written in English, French and Spanish. A client whose
// language is one of the other document languages (uk, pa, tl, de, it) gets
// the frame — title, headings, the covering email — in their language from
// copy.js, and the body in English, which is the same rule
// lib/documents/serviceContent.js applies to quote prose today. Nothing is
// machine-translated at send time (AGENTS.md non-negotiable #6).
//
// ── Generic ─────────────────────────────────────────────────────────────────
//
// A custom category a company created ("custom_<uuid>"), or a job whose
// quote carries no scope group, still gets a guide: the generic one below,
// which asks only for what every trade needs — access, a clear work area,
// pets, parking — and nothing a specific trade would have to disown.

import { GUIDES_EN } from "@/lib/prepGuide/content.en";
import { GUIDES_FR } from "@/lib/prepGuide/content.fr";
import { GUIDES_ES } from "@/lib/prepGuide/content.es";

/** The languages the guide BODY exists in. Frame copy covers more; see copy.js. */
export const GUIDE_LANGUAGES = Object.freeze(["en", "fr", "es"]);

const BY_LANGUAGE = { en: GUIDES_EN, fr: GUIDES_FR, es: GUIDES_ES };

/** ServiceCategory.key → key in GUIDES_*. Every catalogue key is here. */
export const GUIDE_FAMILY = Object.freeze({
  cabinet_refinishing: "cabinet_refinishing",
  cabinet_refacing: "cabinet_refacing",
  kitchen_design: "kitchen_design",
  countertop: "countertop",
  interior_painting: "interior_painting",
  exterior_painting: "exterior_painting",
  flooring: "flooring",
  flooring_install: "flooring_install",
  tiling: "tiling",
  stairs: "stairs",
  drywall: "drywall",
  drywall_install: "drywall",
  plumbing: "plumbing",
  electrical: "electrical",
  hvac_install: "hvac",
  hvac_repair: "hvac",
  appliance_repair: "appliance_repair",
  locksmith: "locksmith",
  garage_door: "garage_door",
  elevator_services: "elevator_services",
  well_water: "well_water",
  mechanical_contracting: "mechanical_contracting",
  installation_services: "installation_services",
  roofing_service: "roofing_service",
  gutter_services: "gutter_services",
  siding: "siding",
  insulation: "insulation",
  masonry: "masonry",
  parging: "masonry",
  concrete: "masonry",
  paving: "paving",
  driveway_sealing: "driveway_sealing",
  epoxy: "epoxy",
  fence_services: "fence",
  fence_repair: "fence",
  fence_restoration: "fence",
  chimney_sweep: "chimney_sweep",
  restoration: "restoration",
  excavation: "earthworks",
  demolition: "earthworks",
  demolition_contractor: "earthworks",
  home_inspection: "home_inspection",
  general_contracting: "renovation",
  general_contracting_reno: "renovation",
  construction: "renovation",
  remodeling: "renovation",
  carpentry: "carpentry",
  handyman: "carpentry",
  property_maintenance: "carpentry",
  residential_cleaning: "residential_cleaning",
  deep_cleaning: "residential_cleaning",
  commercial_cleaning: "commercial_cleaning",
  janitorial: "commercial_cleaning",
  carpet_cleaning: "carpet_cleaning",
  window_cleaning: "window_cleaning",
  pressure_washing_house: "pressure_washing",
  pressure_washing_driveway: "pressure_washing",
  auto_detailing: "auto_detailing",
  junk_removal: "junk_removal",
  landscaping_design: "landscaping_design",
  lawn_care: "lawn_care",
  lawn_mowing: "lawn_care",
  irrigation: "irrigation",
  tree_care_service: "tree_care_service",
  snow_removal: "snow_removal",
  pest_control: "pest_control",
  pool_spa: "pool_spa",
  dog_walking: "dog_walking",
  pooper_scooper: "pooper_scooper",
  // The 2026-09-21 trades (lib/trades/catalog.js). Lighting installation asks
  // the homeowner for exactly what an electrical visit does — panel access,
  // power off, clear the fixtures — so it shares that guide. The rest have
  // their own: a septic pump-out, a move and a baby-proofing visit share no
  // list with anything above, and falling back to the generic guide would
  // send a homeowner "move cars off the driveway" and nothing about the
  // septic lids or the alarm codes.
  air_duct_cleaning: "air_duct_cleaning",
  deck_patio: "deck_patio",
  doors_windows: "doors_windows",
  lighting: "electrical",
  security_systems: "security_systems",
  sewer_septic: "sewer_septic",
  smart_home: "smart_home",
  solar_energy: "solar_energy",
  moving: "moving",
  wildlife_control: "wildlife_control",
  caulking_sealants: "caulking_sealants",
  furniture_upholstery: "furniture_upholstery",
  glass: "glass",
  marine_services: "marine_services",
  home_organization: "home_organization",
  baby_proofing: "baby_proofing",
});

// For a custom category, or a job with no trade on it. True of any trade,
// and short — a generic list that tried to be complete would be wrong for
// half the trades it was sent for.
const GENERIC = {
  en: {
    checklist: [
      "Clear the area where the work is being done — furniture, stored items and anything on the floor or the walls, and a path from the door to it.",
      "Arrange access — a key, a code, an unlocked gate, or somebody home — and tell us about the alarm.",
      "Move cars off the driveway so there is room for the vehicle and the materials.",
      "Pets — keep them in a room away from the work, or arrange for them to be elsewhere for the day.",
      "Tell us about anything we should know before we start: a hazard, something fragile, a neighbour to warn.",
    ],
    warning:
      "If the work area is not accessible when we arrive, the visit may have to be rescheduled — please make sure someone can let us in and that the space is ready.",
    dayOf: [
      "We confirm the scope with you on arrival, protect the surrounding area, do the work on your quote, clean up, and walk it with you before we leave.",
    ],
    afterCare:
      "Tell us within the first days if anything is not as you expected — it is much easier to put right straight away.",
  },
  fr: {
    checklist: [
      "Dégagez la zone de travail — meubles, objets entreposés et tout ce qui est au sol ou aux murs, ainsi qu'un passage depuis la porte.",
      "Organisez l'accès — une clé, un code, une barrière déverrouillée ou quelqu'un à la maison — et parlez-nous de l'alarme.",
      "Sortez les voitures de l'entrée pour laisser la place au véhicule et aux matériaux.",
      "Animaux — gardez-les dans une pièce à l'écart des travaux, ou faites-les garder ailleurs pour la journée.",
      "Dites-nous tout ce que nous devrions savoir avant de commencer : un danger, un objet fragile, un voisin à prévenir.",
    ],
    warning:
      "Si la zone de travail n'est pas accessible à notre arrivée, la visite pourrait devoir être reportée — assurez-vous que quelqu'un puisse nous ouvrir et que l'espace soit prêt.",
    dayOf: [
      "Nous confirmons l'étendue des travaux avec vous à l'arrivée, protégeons les alentours, faisons le travail de votre soumission, nettoyons, et faisons le tour avec vous avant de partir.",
    ],
    afterCare:
      "Dites-nous dans les premiers jours si quelque chose n'est pas comme prévu — c'est bien plus simple à corriger tout de suite.",
  },
  es: {
    checklist: [
      "Despeje la zona donde se hace el trabajo — muebles, cosas guardadas y todo lo que haya en el piso o las paredes, y un paso desde la puerta.",
      "Organice el acceso — una llave, un código, un portón abierto o alguien en casa — y cuéntenos de la alarma.",
      "Saque los autos de la entrada para que haya lugar para el vehículo y los materiales.",
      "Mascotas — manténgalas en una habitación lejos del trabajo, o busque dónde dejarlas ese día.",
      "Díganos todo lo que debamos saber antes de empezar: un peligro, algo frágil, un vecino al que avisar.",
    ],
    warning:
      "Si la zona de trabajo no está accesible cuando lleguemos, quizá haya que reprogramar la visita — asegúrese de que alguien pueda abrirnos y de que el espacio esté listo.",
    dayOf: [
      "Confirmamos el alcance con usted al llegar, protegemos el entorno, hacemos el trabajo de su cotización, limpiamos y lo recorremos con usted antes de irnos.",
    ],
    afterCare:
      "Avísenos en los primeros días si algo no es como esperaba — es mucho más fácil corregirlo de inmediato.",
  },
};

/** "fr-CA" → "fr"; anything the body is not written in → "en". */
export function guideLanguage(language) {
  const base = String(language || "")
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];
  return GUIDE_LANGUAGES.includes(base) ? base : "en";
}

/** The guide key a category resolves to, or null for a custom/unknown one. */
export function guideKeyFor(categoryKey) {
  return (
    (typeof categoryKey === "string" &&
      Object.prototype.hasOwnProperty.call(GUIDE_FAMILY, categoryKey) &&
      GUIDE_FAMILY[categoryKey]) ||
    null
  );
}

/**
 * The built-in guide for one category in one language. Always returns a
 * guide: the generic one when the category has none. Returned objects are
 * fresh copies so a caller can edit them without touching the catalogue.
 */
export function builtInGuide(categoryKey, language) {
  const lang = guideLanguage(language);
  const key = guideKeyFor(categoryKey);
  const table = BY_LANGUAGE[lang] || GUIDES_EN;
  const src = (key && table[key]) || (key && GUIDES_EN[key]) || GENERIC[lang] || GENERIC.en;
  return {
    guideKey: key || "generic",
    language: lang,
    checklist: [...src.checklist],
    warning: src.warning,
    dayOf: [...src.dayOf],
    afterCare: src.afterCare,
  };
}

/** For scripts: every guide table, keyed by language. */
export const GUIDE_TABLES = Object.freeze({ ...BY_LANGUAGE });
export { GENERIC as GENERIC_GUIDE };
