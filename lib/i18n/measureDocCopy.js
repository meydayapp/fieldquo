// lib/i18n/measureDocCopy.js
//
// The caption under a measurement still on the document the client
// receives — "Lawn measured: 1,850 sq ft", "Roof measured from satellite:
// 2,163 sq ft, 6/12 pitch" — in the document's language.
//
// Hand-written, closed set, like lib/i18n/gutterEstimateCopy.js. The eight
// product languages (the instant form creates drafts in any of them since
// 2026-10-03) plus an English fallback: a document keeps the language it was
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
  uk: {
    lawnMeasured: (sqft) => `Газон виміряно: ${fmt(sqft, "uk-UA")} кв. фт`,
    lawnEstimated: (sqft) => `Площа газону (орієнтовно): ${fmt(sqft, "uk-UA")} кв. фт`,
    lawnMinimum: (sqft) => `Газон за мінімальним ціновим діапазоном: ${fmt(sqft, "uk-UA")} кв. фт`,
    roof: (sqft, pitch) =>
      `Дах виміряно із супутника: ${fmt(sqft, "uk-UA")} кв. фт` + (pitch != null ? `, ухил ${pitch}/12` : ""),
    gutters: (ft, ds) =>
      `Ринви виміряно із супутника: ${fmt(ft, "uk-UA")} фт` + (ds != null ? `, водостічних труб: ${ds}` : ""),
    paving: (sqft) => `Площу мощення виміряно: ${fmt(sqft, "uk-UA")} кв. фт`,
    imagery: (date) => `Аерознімок${date ? ` · ${date}` : ""}`,
  },
  pa: {
    lawnMeasured: (sqft) => `ਮਾਪਿਆ ਲਾਅਨ: ${fmt(sqft, "pa-IN")} ਵਰਗ ਫੁੱਟ`,
    lawnEstimated: (sqft) => `ਲਾਅਨ ਦਾ ਆਕਾਰ (ਅਨੁਮਾਨਤ): ${fmt(sqft, "pa-IN")} ਵਰਗ ਫੁੱਟ`,
    lawnMinimum: (sqft) => `ਘੱਟੋ-ਘੱਟ ਸ਼੍ਰੇਣੀ ਉੱਤੇ ਕੀਮਤ ਲਾਇਆ ਲਾਅਨ: ${fmt(sqft, "pa-IN")} ਵਰਗ ਫੁੱਟ`,
    roof: (sqft, pitch) =>
      `ਸੈਟੇਲਾਈਟ ਤੋਂ ਮਾਪੀ ਛੱਤ: ${fmt(sqft, "pa-IN")} ਵਰਗ ਫੁੱਟ` + (pitch != null ? `, ${pitch}/12 ਢਲਾਣ` : ""),
    gutters: (ft, ds) =>
      `ਸੈਟੇਲਾਈਟ ਤੋਂ ਮਾਪੇ ਗਟਰ: ${fmt(ft, "pa-IN")} ਫੁੱਟ` +
      (ds != null ? `, ${ds} ${Number(ds) === 1 ? "ਪਰਨਾਲਾ" : "ਪਰਨਾਲੇ"}` : ""),
    paving: (sqft) => `ਮਾਪਿਆ ਪੇਵਿੰਗ ਖੇਤਰ: ${fmt(sqft, "pa-IN")} ਵਰਗ ਫੁੱਟ`,
    imagery: (date) => `ਹਵਾਈ ਤਸਵੀਰ${date ? ` · ${date}` : ""}`,
  },
  tl: {
    lawnMeasured: (sqft) => `Nasukat na damuhan: ${fmt(sqft, "fil-PH")} sq ft`,
    lawnEstimated: (sqft) => `Laki ng damuhan (tantiya): ${fmt(sqft, "fil-PH")} sq ft`,
    lawnMinimum: (sqft) => `Damuhang sinisingil sa pinakamababang antas: ${fmt(sqft, "fil-PH")} sq ft`,
    roof: (sqft, pitch) =>
      `Bubong na sinukat mula sa satellite: ${fmt(sqft, "fil-PH")} sq ft` + (pitch != null ? `, tarik na ${pitch}/12` : ""),
    gutters: (ft, ds) =>
      `Alulod na sinukat mula sa satellite: ${fmt(ft, "fil-PH")} ft` + (ds != null ? `, ${ds} tubo pababa` : ""),
    paving: (sqft) => `Nasukat na lugar na lalatagan: ${fmt(sqft, "fil-PH")} sq ft`,
    imagery: (date) => `Aerial na larawan${date ? ` · ${date}` : ""}`,
  },
  de: {
    lawnMeasured: (sqft) => `Rasen vermessen: ${fmt(sqft, "de-DE")} ft²`,
    lawnEstimated: (sqft) => `Rasenfläche (geschätzt): ${fmt(sqft, "de-DE")} ft²`,
    lawnMinimum: (sqft) => `Rasen zur niedrigsten Preisstufe berechnet: ${fmt(sqft, "de-DE")} ft²`,
    roof: (sqft, pitch) =>
      `Dach per Satellit vermessen: ${fmt(sqft, "de-DE")} ft²` + (pitch != null ? `, Neigung ${pitch}/12` : ""),
    gutters: (ft, ds) =>
      `Dachrinne per Satellit vermessen: ${fmt(ft, "de-DE")} ft` +
      (ds != null ? `, ${ds} ${Number(ds) === 1 ? "Fallrohr" : "Fallrohre"}` : ""),
    paving: (sqft) => `Pflasterfläche vermessen: ${fmt(sqft, "de-DE")} ft²`,
    imagery: (date) => `Luftbild${date ? ` · ${date}` : ""}`,
  },
  it: {
    lawnMeasured: (sqft) => `Prato misurato: ${fmt(sqft, "it-IT")} ft²`,
    lawnEstimated: (sqft) => `Superficie del prato (stimata): ${fmt(sqft, "it-IT")} ft²`,
    lawnMinimum: (sqft) => `Prato calcolato con la fascia minima: ${fmt(sqft, "it-IT")} ft²`,
    roof: (sqft, pitch) =>
      `Tetto misurato da satellite: ${fmt(sqft, "it-IT")} ft²` + (pitch != null ? `, pendenza ${pitch}/12` : ""),
    gutters: (ft, ds) =>
      `Grondaie misurate da satellite: ${fmt(ft, "it-IT")} piedi` +
      (ds != null ? `, ${ds} ${Number(ds) === 1 ? "pluviale" : "pluviali"}` : ""),
    paving: (sqft) => `Superficie da pavimentare misurata: ${fmt(sqft, "it-IT")} ft²`,
    imagery: (date) => `Immagine aerea${date ? ` · ${date}` : ""}`,
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
