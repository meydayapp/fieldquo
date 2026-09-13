// app/data/sectionPresets.js
// Common section labels for trades that are genuinely priced by phase, not one
// lump sum. Purely a UI convenience — clicking one just creates a normal
// QuoteScopeGroup with that label already set, same as any other scope group.
// No new schema, no new model.
//
// ── The label is in the DOCUMENT's language, not the screen's ──────────────
//
// A preset becomes QuoteScopeGroup.label, which is printed on the quote the
// homeowner reads. So it is not an app-catalogue string: a French estimator
// writing an English quote for an English client needs the English word on
// the document, and the same estimator writing a French quote needs the
// French one. getSectionPresets takes the QUOTE's language (the builder's
// QuoteLanguageBar value), the way documentLabels() does, and falls back to
// English key by key — a language with no reviewed wording gets the English
// term rather than a blank chip.
//
// The English list is the key: the trade's own jargon ("Quick Track",
// "Inslab") is how a plumber or HVAC installer names these phases, and the
// translations are the same phases as a French or Spanish crew would say
// them, not word-for-word renderings.

import { DEFAULT_LANGUAGE, isSupported } from "@/app/i18n/languages";

export const SECTION_PRESETS = {
  plumbing: [
    "Groundworks",
    "Drainage",
    "Garage Drain",
    "Waterlines",
    "Tubs/Showers",
    "Steamer",
    "Recirc Lines",
    "Gas",
    "Finishing",
    "Insulating",
  ],
  hvac_install: [
    "Inslab",
    "Boiler Systems",
    "Quick Track",
    "Supply/Return Mains",
    "Main Slab Heat",
    "Upper Floor Slab Heat",
    "Wiring",
    "Venting",
  ],
};

// English label → wording per language. Missing entries fall back to English.
const TRANSLATIONS = {
  fr: {
    Groundworks: "Travaux au sol",
    Drainage: "Drainage",
    "Garage Drain": "Drain de garage",
    Waterlines: "Conduites d'eau",
    "Tubs/Showers": "Bains/Douches",
    Steamer: "Générateur de vapeur",
    "Recirc Lines": "Boucles de recirculation",
    Gas: "Gaz",
    Finishing: "Finition",
    Insulating: "Isolation",
    Inslab: "Dans la dalle",
    "Boiler Systems": "Systèmes de chaudière",
    "Quick Track": "Rails Quick Track",
    "Supply/Return Mains": "Conduites principales aller/retour",
    "Main Slab Heat": "Chauffage de la dalle principale",
    "Upper Floor Slab Heat": "Chauffage de la dalle de l'étage",
    Wiring: "Câblage",
    Venting: "Évacuation",
  },
  es: {
    Groundworks: "Obra bajo losa",
    Drainage: "Drenaje",
    "Garage Drain": "Drenaje del garaje",
    Waterlines: "Líneas de agua",
    "Tubs/Showers": "Tinas/Duchas",
    Steamer: "Generador de vapor",
    "Recirc Lines": "Líneas de recirculación",
    Gas: "Gas",
    Finishing: "Acabados",
    Insulating: "Aislamiento",
    Inslab: "En losa",
    "Boiler Systems": "Sistemas de caldera",
    "Quick Track": "Rieles Quick Track",
    "Supply/Return Mains": "Troncales de ida/retorno",
    "Main Slab Heat": "Calefacción de losa principal",
    "Upper Floor Slab Heat": "Calefacción de losa del piso superior",
    Wiring: "Cableado",
    Venting: "Ventilación",
  },
  uk: {
    Groundworks: "Роботи під плитою",
    Drainage: "Каналізація",
    "Garage Drain": "Злив у гаражі",
    Waterlines: "Водопровід",
    "Tubs/Showers": "Ванни/Душові",
    Steamer: "Парогенератор",
    "Recirc Lines": "Лінії рециркуляції",
    Gas: "Газ",
    Finishing: "Оздоблення",
    Insulating: "Ізоляція",
    Inslab: "У плиті",
    "Boiler Systems": "Котельні системи",
    "Quick Track": "Панелі Quick Track",
    "Supply/Return Mains": "Магістралі подачі/звороту",
    "Main Slab Heat": "Обігрів основної плити",
    "Upper Floor Slab Heat": "Обігрів плити верхнього поверху",
    Wiring: "Електропроводка",
    Venting: "Вентиляція",
  },
  pa: {
    Groundworks: "ਜ਼ਮੀਨੀ ਕੰਮ",
    Drainage: "ਨਿਕਾਸੀ",
    "Garage Drain": "ਗੈਰਾਜ ਡਰੇਨ",
    Waterlines: "ਪਾਣੀ ਦੀਆਂ ਲਾਈਨਾਂ",
    "Tubs/Showers": "ਟੱਬ/ਸ਼ਾਵਰ",
    Steamer: "ਸਟੀਮਰ",
    "Recirc Lines": "ਰੀਸਰਕ ਲਾਈਨਾਂ",
    Gas: "ਗੈਸ",
    Finishing: "ਫਿਨਿਸ਼ਿੰਗ",
    Insulating: "ਇਨਸੂਲੇਸ਼ਨ",
    Inslab: "ਸਲੈਬ ਦੇ ਅੰਦਰ",
    "Boiler Systems": "ਬਾਇਲਰ ਸਿਸਟਮ",
    "Quick Track": "Quick Track",
    "Supply/Return Mains": "ਸਪਲਾਈ/ਰਿਟਰਨ ਮੇਨ",
    "Main Slab Heat": "ਮੁੱਖ ਸਲੈਬ ਹੀਟ",
    "Upper Floor Slab Heat": "ਉੱਪਰਲੀ ਮੰਜ਼ਿਲ ਸਲੈਬ ਹੀਟ",
    Wiring: "ਵਾਇਰਿੰਗ",
    Venting: "ਵੈਂਟਿੰਗ",
  },
  tl: {
    Groundworks: "Gawain sa ilalim ng slab",
    Drainage: "Drainage",
    "Garage Drain": "Drain ng garahe",
    Waterlines: "Mga linya ng tubig",
    "Tubs/Showers": "Mga tub/shower",
    Steamer: "Steamer",
    "Recirc Lines": "Mga recirc line",
    Gas: "Gas",
    Finishing: "Finishing",
    Insulating: "Insulation",
    Inslab: "Sa loob ng slab",
    "Boiler Systems": "Mga boiler system",
    "Quick Track": "Quick Track",
    "Supply/Return Mains": "Supply/return mains",
    "Main Slab Heat": "Heating ng pangunahing slab",
    "Upper Floor Slab Heat": "Heating ng slab sa itaas",
    Wiring: "Wiring",
    Venting: "Venting",
  },
  de: {
    Groundworks: "Grundleitungen",
    Drainage: "Entwässerung",
    "Garage Drain": "Garagenablauf",
    Waterlines: "Wasserleitungen",
    "Tubs/Showers": "Wannen/Duschen",
    Steamer: "Dampferzeuger",
    "Recirc Lines": "Zirkulationsleitungen",
    Gas: "Gas",
    Finishing: "Fertigmontage",
    Insulating: "Dämmung",
    Inslab: "In der Bodenplatte",
    "Boiler Systems": "Kesselanlagen",
    "Quick Track": "Quick-Track-Systemplatten",
    "Supply/Return Mains": "Vor-/Rücklaufhauptleitungen",
    "Main Slab Heat": "Heizung Hauptbodenplatte",
    "Upper Floor Slab Heat": "Heizung Obergeschossdecke",
    Wiring: "Verkabelung",
    Venting: "Abgasführung",
  },
  it: {
    Groundworks: "Opere sotto soletta",
    Drainage: "Scarichi",
    "Garage Drain": "Scarico garage",
    Waterlines: "Linee idriche",
    "Tubs/Showers": "Vasche/Docce",
    Steamer: "Generatore di vapore",
    "Recirc Lines": "Linee di ricircolo",
    Gas: "Gas",
    Finishing: "Finiture",
    Insulating: "Isolamento",
    Inslab: "In soletta",
    "Boiler Systems": "Impianti a caldaia",
    "Quick Track": "Pannelli Quick Track",
    "Supply/Return Mains": "Dorsali mandata/ritorno",
    "Main Slab Heat": "Riscaldamento soletta principale",
    "Upper Floor Slab Heat": "Riscaldamento soletta piano superiore",
    Wiring: "Cablaggio",
    Venting: "Scarico fumi",
  },
};

/**
 * The preset labels for a trade, in the quote's language.
 *
 * @param categoryKey  ServiceCategory.key
 * @param language     the DOCUMENT's language — Quote.language, never the UI's
 * @returns string[] | null — null when the trade has no presets
 */
export function getSectionPresets(categoryKey, language = DEFAULT_LANGUAGE) {
  const base = SECTION_PRESETS[categoryKey];
  if (!base) return null;
  const code = isSupported(language) ? String(language).toLowerCase() : DEFAULT_LANGUAGE;
  const table = TRANSLATIONS[code];
  if (!table) return base;
  return base.map((label) => table[label] || label);
}
