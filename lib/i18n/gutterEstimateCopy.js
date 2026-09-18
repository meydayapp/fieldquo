// lib/i18n/gutterEstimateCopy.js
//
// The homeowner-facing sentences on a gutter instant estimate — the lines
// under the range on the public /instant-quote form, in the confirmation
// email and in the request response — in English, French and Spanish.
//
// Hand-written, like lib/i18n/clientDocCopy.js: a closed set of short
// transactional strings, never drafted by a model, with functions where a
// date is interpolated because word order around a value does not survive
// concatenation across languages. Server-side only: the estimator builds its
// `assumptions` from these in the company's language, so the browser, the
// email and the stored draft all carry the same words.
//
// Three languages rather than the eight in clientDocCopy: this is the first
// instant trade with its own copy, and the three the product owner sells in.
// A fourth is a row here, not a redesign. Unknown languages fall back to en.

const COPY = {
  en: {
    measuredFrom: (date) =>
      date
        ? `Measured from aerial imagery of your roofline · imagery date ${date}`
        : "Measured from aerial imagery of your roofline",
    gutterLine: (ft, n) =>
      `${ft} ft of seamless aluminium eavestrough and ${n} downspout${n === 1 ? "" : "s"}, priced installed`,
    flatRoof:
      "Most of this roof is flat, so the whole outline was counted — flat roofs that drain internally need less.",
    storeysUnknown: "The number of storeys is confirmed on site; a two-storey run costs more to hang.",
    notAContract:
      "An estimate from aerial measurements, not a contract — final price confirmed on site.",
    needsSiteVisit:
      "We couldn't measure this property reliably from the air, so there's no instant figure — request a quote and we'll measure it on site.",
  },
  fr: {
    measuredFrom: (date) =>
      date
        ? `Mesuré à partir d'images aériennes de votre toiture · date des images ${date}`
        : "Mesuré à partir d'images aériennes de votre toiture",
    gutterLine: (ft, n) =>
      `${ft} pi de gouttières en aluminium sans joint et ${n} descente${n === 1 ? "" : "s"} pluviale${n === 1 ? "" : "s"}, prix installé`,
    flatRoof:
      "La majeure partie de ce toit est plate, alors tout le pourtour a été compté — un toit plat à drainage intérieur en demande moins.",
    storeysUnknown: "Le nombre d'étages est confirmé sur place ; une pose à deux étages coûte plus cher.",
    notAContract:
      "Une estimation à partir de mesures aériennes, pas un contrat — le prix final est confirmé sur place.",
    needsSiteVisit:
      "Nous n'avons pas pu mesurer cette propriété de façon fiable depuis les airs, alors il n'y a pas de montant instantané — demandez une soumission et nous mesurerons sur place.",
  },
  es: {
    measuredFrom: (date) =>
      date
        ? `Medido a partir de imágenes aéreas de su tejado · fecha de las imágenes ${date}`
        : "Medido a partir de imágenes aéreas de su tejado",
    gutterLine: (ft, n) =>
      `${ft} pies de canalón de aluminio sin juntas y ${n} bajante${n === 1 ? "" : "s"}, precio instalado`,
    flatRoof:
      "La mayor parte de este techo es plano, así que se contó todo el perímetro — un techo plano con desagüe interior necesita menos.",
    storeysUnknown: "El número de plantas se confirma en el sitio; una instalación a dos plantas cuesta más.",
    notAContract:
      "Una estimación a partir de mediciones aéreas, no un contrato — el precio final se confirma en el sitio.",
    needsSiteVisit:
      "No pudimos medir esta propiedad de forma fiable desde el aire, así que no hay una cifra instantánea — solicite un presupuesto y lo mediremos en el sitio.",
  },
};

/** The copy table for a language, falling back to English. */
export function gutterEstimateCopy(language = "en") {
  const code = String(language || "en").toLowerCase().slice(0, 2);
  return Object.prototype.hasOwnProperty.call(COPY, code) ? COPY[code] : COPY.en;
}

/** Exported for the language-completeness style checks. */
export const GUTTER_ESTIMATE_COPY = COPY;
