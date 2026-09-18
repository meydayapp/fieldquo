// lib/i18n/measureDocCopy.js
//
// The caption under a measurement still on the document the client
// receives — "Lawn measured: 1,850 sq ft", "Roof measured from satellite:
// 2,163 sq ft, 6/12 pitch" — in the document's language.
//
// Hand-written, closed set, like lib/i18n/gutterEstimateCopy.js. Three
// languages plus an English fallback: a document keeps the language it was
// created in (non-negotiable 6), so a caption for a language not here prints
// in English rather than being machine-translated at render time.
//
// The lawn caption distinguishes MEASURED from ESTIMATED on purpose. A lawn
// sized off the minimum pricing band or the parcel arithmetic was never
// measured (lib/measure/lawnEstimate.js), and a document that said
// "measured" about it would be the claim this whole feature exists to avoid.

const COPY = {
  en: {
    lawnMeasured: (sqft) => `Lawn measured: ${fmt(sqft, "en-CA")} sq ft`,
    lawnEstimated: (sqft) => `Lawn size (estimated): ${fmt(sqft, "en-CA")} sq ft`,
    lawnMinimum: (sqft) => `Lawn priced at the minimum band: ${fmt(sqft, "en-CA")} sq ft`,
    roof: (sqft, pitch) =>
      `Roof measured from satellite: ${fmt(sqft, "en-CA")} sq ft` + (pitch != null ? `, ${pitch}/12 pitch` : ""),
    gutters: (ft, ds) =>
      `Eavestrough measured from satellite: ${fmt(ft, "en-CA")} ft` +
      (ds != null ? `, ${ds} downspout${Number(ds) === 1 ? "" : "s"}` : ""),
    paving: (sqft) => `Paving area measured: ${fmt(sqft, "en-CA")} sq ft`,
    imagery: (date) => `Aerial imagery${date ? ` · ${date}` : ""}`,
  },
  fr: {
    lawnMeasured: (sqft) => `Pelouse mesurée : ${fmt(sqft, "fr-CA")} pi²`,
    lawnEstimated: (sqft) => `Superficie de pelouse (estimée) : ${fmt(sqft, "fr-CA")} pi²`,
    lawnMinimum: (sqft) => `Pelouse facturée à la tranche minimale : ${fmt(sqft, "fr-CA")} pi²`,
    roof: (sqft, pitch) =>
      `Toit mesuré par satellite : ${fmt(sqft, "fr-CA")} pi²` + (pitch != null ? `, pente ${pitch}/12` : ""),
    gutters: (ft, ds) =>
      `Gouttières mesurées par satellite : ${fmt(ft, "fr-CA")} pi` +
      (ds != null ? `, ${ds} descente${Number(ds) === 1 ? "" : "s"}` : ""),
    paving: (sqft) => `Surface de pavage mesurée : ${fmt(sqft, "fr-CA")} pi²`,
    imagery: (date) => `Imagerie aérienne${date ? ` · ${date}` : ""}`,
  },
  es: {
    lawnMeasured: (sqft) => `Césped medido: ${fmt(sqft, "es")} pies²`,
    lawnEstimated: (sqft) => `Tamaño del césped (estimado): ${fmt(sqft, "es")} pies²`,
    lawnMinimum: (sqft) => `Césped cobrado al tramo mínimo: ${fmt(sqft, "es")} pies²`,
    roof: (sqft, pitch) =>
      `Tejado medido por satélite: ${fmt(sqft, "es")} pies²` + (pitch != null ? `, pendiente ${pitch}/12` : ""),
    gutters: (ft, ds) =>
      `Canalones medidos por satélite: ${fmt(ft, "es")} pies` +
      (ds != null ? `, ${ds} bajante${Number(ds) === 1 ? "" : "s"}` : ""),
    paving: (sqft) => `Superficie de pavimento medida: ${fmt(sqft, "es")} pies²`,
    imagery: (date) => `Imagen aérea${date ? ` · ${date}` : ""}`,
  },
};

function fmt(n, locale) {
  const v = Math.round(Number(n) || 0);
  try {
    return v.toLocaleString(locale);
  } catch {
    return String(v);
  }
}

/** The caption table for a language, falling back to English. */
export function measureDocCopy(language = "en") {
  const code = String(language || "en").toLowerCase().slice(0, 2);
  return Object.prototype.hasOwnProperty.call(COPY, code) ? COPY[code] : COPY.en;
}

export const MEASURE_DOC_COPY = COPY;
