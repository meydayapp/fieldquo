// lib/sales/discovery/rbq/subcategories.js
//
// What each RBQ licence subcategory code MEANS, in the Régie's own words.
//
// ══ Why this table exists, and why it is not in licence.js ═════════════════
//
// licence.js carries the codes — `rbq:16`, `rbq:15.5` — into
// `Prospect.sourceCategories` and deliberately maps none of them to a trade;
// its header measures why (the median licence holds sixteen authorisations).
// That decision stands. What it left unanswered is what a HUMAN sees when
// they open the row: seventeen bare numbers. A superadmin choosing a trade in
// the Review folder has to read "16 — Entrepreneur en électricité", not
// "rbq:16", or the licence tells them nothing they can act on.
//
// So this file is a dictionary and nothing more. It decides no trade. The one
// consumer that turns a code into a SUGGESTION is lib/sales/discovery/
// tradeSuggest.js, and it does so only for a human to accept or refuse.
//
// ══ Source ═════════════════════════════════════════════════════════════════
//
// Read off the Régie's own list of subcategories (Annexes I, II and III of the
// Règlement sur la qualification professionnelle des entrepreneurs et des
// constructeurs-propriétaires) on 2026-09-11, French and English pages both:
//   https://www.rbq.gouv.qc.ca/services-en-ligne/licence/determiner-la-licence-requise/liste-des-sous-categories/
// The codes the open-data extract carries drop a trailing ".0" — the file says
// `9`, the regulation says `9.0` — so lookups fold that spelling.

import { RBQ_CATEGORY_PREFIX } from "./licence";

/**
 * Code → { fr, en }. The FAMILY is the integer part of the code (1 = general
 * contractor, 15 = building mechanicals, 16 = electrical …), which is how the
 * regulation groups them and how tradeSuggest.js asks "does this licence
 * cover one kind of work or many".
 */
export const RBQ_SUBCATEGORIES = Object.freeze({
  "1.1.1": { fr: "Entrepreneur en bâtiments résidentiels neufs visés à un plan de garantie, classe I", en: "New residential buildings covered by a guarantee plan, class I" },
  "1.1.2": { fr: "Entrepreneur en bâtiments résidentiels neufs visés à un plan de garantie, classe II", en: "New residential buildings covered by a guarantee plan, class II" },
  "1.2": { fr: "Entrepreneur en petits bâtiments", en: "Small buildings" },
  "1.3": { fr: "Entrepreneur en bâtiments de tout genre", en: "All buildings" },
  "1.4": { fr: "Entrepreneur en routes et canalisation", en: "Roads and mains" },
  "1.5": { fr: "Entrepreneur en structures d'ouvrages de génie civil", en: "Civil engineering structures" },
  "1.6": { fr: "Entrepreneur en ouvrages de génie civil immergés", en: "Underwater civil engineering structures" },
  "1.7": { fr: "Entrepreneur en télécommunication, transport, transformation et distribution d'énergie électrique", en: "Telecommunications and electric power transmission" },
  "1.8": { fr: "Entrepreneur en installation d'équipements pétroliers", en: "Petroleum equipment installations" },
  "1.9": { fr: "Entrepreneur en mécanique du bâtiment", en: "Building mechanicals" },
  "1.10": { fr: "Entrepreneur en remontées mécaniques", en: "Mechanical lifts" },
  "2.1": { fr: "Entrepreneur en puits forés", en: "Drilled wells" },
  "2.2": { fr: "Entrepreneur en ouvrages de captage d'eau non forés", en: "Non-drilled water collection structures" },
  "2.3": { fr: "Entrepreneur en systèmes de pompage des eaux souterraines", en: "Underground water pumping systems" },
  "2.4": { fr: "Entrepreneur en systèmes d'assainissement autonome", en: "Private sewerage systems" },
  "2.5": { fr: "Entrepreneur en excavation et terrassement", en: "Excavation and earthwork" },
  "2.6": { fr: "Entrepreneur en pieux et fondations spéciales", en: "Piles and special foundations" },
  "2.7": { fr: "Entrepreneur en travaux d'emplacement", en: "Sitework" },
  "2.8": { fr: "Entrepreneur en sautage", en: "Blasting" },
  "3.1": { fr: "Entrepreneur en structures de béton", en: "Concrete structures" },
  "3.2": { fr: "Entrepreneur en petits ouvrages de béton", en: "Small concrete works" },
  "4.1": { fr: "Entrepreneur en structures de maçonnerie", en: "Masonry structures" },
  "4.2": { fr: "Entrepreneur en travaux de maçonnerie non structurale, marbre et céramique", en: "Non-structural masonry, marble and ceramics" },
  "5.1": { fr: "Entrepreneur en structures métalliques et éléments préfabriqués de béton", en: "Metallic structures and prefabricated concrete elements" },
  "5.2": { fr: "Entrepreneur en ouvrages métalliques", en: "Metal fabrication" },
  "6.1": { fr: "Entrepreneur en charpentes de bois", en: "Wood structures" },
  "6.2": { fr: "Entrepreneur en travaux de bois et plastique", en: "Wood and plastic work" },
  "7": { fr: "Entrepreneur en isolation, étanchéité, couvertures et revêtements extérieurs", en: "Insulating, waterproofing, roofing and siding" },
  "8": { fr: "Entrepreneur en portes et fenêtres", en: "Doors and windows" },
  "9": { fr: "Entrepreneur en travaux de finition", en: "Interior finishing" },
  "10": { fr: "Entrepreneur en systèmes de chauffage localisé à combustible solide", en: "Solid-fuel local heating systems" },
  "11.1": { fr: "Entrepreneur en tuyauterie industrielle ou institutionnelle sous pression", en: "Pressurised industrial or institutional piping" },
  "11.2": { fr: "Entrepreneur en équipements et produits spéciaux", en: "Special equipment and products" },
  "12": { fr: "Entrepreneur en armoires et comptoirs usinés", en: "Manufactured cabinets and countertops" },
  "13.1": { fr: "Entrepreneur en protection contre la foudre", en: "Lightning protection" },
  "13.2": { fr: "Entrepreneur en systèmes d'alarme incendie", en: "Fire alarm systems" },
  "13.3": { fr: "Entrepreneur en systèmes d'extinction d'incendie", en: "Fire extinguishing systems" },
  "13.4": { fr: "Entrepreneur en systèmes localisés d'extinction incendie", en: "Local fire extinguishing systems" },
  "13.5": { fr: "Entrepreneur en installations spéciales ou préfabriquées", en: "Prefabricated or special installations" },
  "14.1": { fr: "Entrepreneur en ascenseurs et monte-charges", en: "Passenger and freight elevators" },
  "14.2": { fr: "Entrepreneur en appareils élévateurs pour personnes à mobilité réduite", en: "Lifts for persons with reduced mobility" },
  "14.3": { fr: "Entrepreneur en autres types d'appareils élévateurs", en: "Other types of elevators" },
  "15.1": { fr: "Entrepreneur en systèmes de chauffage à air pulsé", en: "Forced-air heating systems" },
  "15.2": { fr: "Entrepreneur en systèmes de brûleurs au gaz naturel", en: "Natural gas burners" },
  "15.3": { fr: "Entrepreneur en systèmes de brûleurs à l'huile", en: "Oil burners" },
  "15.4": { fr: "Entrepreneur en systèmes de chauffage hydronique", en: "Hydronic heating systems" },
  "15.5": { fr: "Entrepreneur en plomberie", en: "Plumbing" },
  "15.6": { fr: "Entrepreneur en propane", en: "Propane" },
  "15.7": { fr: "Entrepreneur en ventilation résidentielle", en: "Residential ventilation" },
  "15.8": { fr: "Entrepreneur en ventilation", en: "Ventilation" },
  "15.9": { fr: "Entrepreneur en petits systèmes de réfrigération", en: "Small refrigeration systems" },
  "15.10": { fr: "Entrepreneur en réfrigération", en: "Refrigeration" },
  "16": { fr: "Entrepreneur en électricité", en: "Electrical" },
  "17.1": { fr: "Entrepreneur en instrumentation, contrôle et régulation", en: "Instrumentation and control systems" },
  "17.2": { fr: "Entrepreneur en intercommunication, téléphonie et surveillance", en: "Intercommunication, telephone and surveillance" },
});

/**
 * The extract's spelling of a code, from either the extract's or the
 * regulation's. `rbq:9`, `9`, `9.0` and ` 9.0 ` all become `9`. Null for
 * anything that is not a code at all.
 */
export function normaliseRbqCode(value) {
  let text = String(value ?? "").trim();
  if (text.startsWith(RBQ_CATEGORY_PREFIX)) text = text.slice(RBQ_CATEGORY_PREFIX.length).trim();
  if (!/^\d+(?:\.\d+)*$/.test(text)) return null;
  // "7.0" → "7", but "1.10" stays "1.10" and "15.10" stays "15.10".
  return text.replace(/\.0$/, "");
}

/** The family a code belongs to: the integer part. Null for a non-code. */
export function rbqFamilyOf(value) {
  const code = normaliseRbqCode(value);
  return code ? code.split(".")[0] : null;
}

/** { code, family, fr, en } for a code this build knows, else null. */
export function rbqSubcategory(value) {
  const code = normaliseRbqCode(value);
  if (!code || !Object.prototype.hasOwnProperty.call(RBQ_SUBCATEGORIES, code)) return null;
  return { code, family: code.split(".")[0], ...RBQ_SUBCATEGORIES[code] };
}

/**
 * One line a reviewer can read for a source category: "16 — Entrepreneur en
 * électricité". A code the table does not know is still shown, as the code,
 * with a note — a licence carrying an unknown code is a fact about the
 * register worth seeing, not something to hide behind a blank.
 */
export function describeRbqCategory(value) {
  const code = normaliseRbqCode(value);
  if (!code) return null;
  const known = rbqSubcategory(code);
  return known ? `${code} — ${known.fr}` : `${code} — (code not in this build's table)`;
}
