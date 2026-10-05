// lib/i18n/gutterEstimateCopy.js
//
// The homeowner-facing sentences on a gutter instant estimate — the lines
// under the range on the public /instant-quote form, in the confirmation
// email and in the request response — in the eight languages the instant
// form can be read in (lib/i18n/instantQuoteCopy.js INSTANT_QUOTE_LANGUAGES).
//
// Hand-written, like lib/i18n/clientDocCopy.js: a closed set of short
// transactional strings, never drafted by a model, with functions where a
// date is interpolated because word order around a value does not survive
// concatenation across languages. Server-side only: the estimator builds its
// `assumptions` from these in the company's language, so the browser, the
// email and the stored draft all carry the same words.
//
// It began with the three the product owner first sold in; the other five
// were added when the instant form went to all eight (2026-10-03) — each a
// row here, not a redesign. Unknown languages fall back to en.

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
  uk: {
    measuredFrom: (date) =>
      date
        ? `Виміряно за аерознімками краю вашого даху · дата знімків ${date}`
        : "Виміряно за аерознімками краю вашого даху",
    // Ukrainian counts take three forms (1 труба, 2–4 труби, 5+ труб); the
    // rule below is the standard one, so "21 труба" and "22 труби" read right.
    gutterLine: (ft, n) => {
      const m10 = n % 10;
      const m100 = n % 100;
      const word =
        m10 === 1 && m100 !== 11 ? "водостічна труба" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "водостічні труби" : "водостічних труб";
      return `${ft} фт безшовної алюмінієвої ринви та ${n} ${word}, ціна з монтажем`;
    },
    flatRoof:
      "Більша частина цього даху пласка, тож враховано весь периметр — пласкому даху з внутрішнім водовідведенням потрібно менше.",
    storeysUnknown: "Кількість поверхів уточнюється на місці; монтаж на рівні другого поверху коштує дорожче.",
    notAContract:
      "Оцінка за аерознімками, а не договір — остаточну ціну підтвердимо на місці.",
    needsSiteVisit:
      "Ми не змогли надійно виміряти цю ділянку з повітря, тож миттєвої суми немає — запросіть кошторис, і ми виміряємо все на місці.",
  },
  pa: {
    measuredFrom: (date) =>
      date
        ? `ਤੁਹਾਡੀ ਛੱਤ ਦੇ ਕਿਨਾਰੇ ਦੀਆਂ ਹਵਾਈ ਤਸਵੀਰਾਂ ਤੋਂ ਮਾਪਿਆ ਗਿਆ · ਤਸਵੀਰਾਂ ਦੀ ਤਾਰੀਖ਼ ${date}`
        : "ਤੁਹਾਡੀ ਛੱਤ ਦੇ ਕਿਨਾਰੇ ਦੀਆਂ ਹਵਾਈ ਤਸਵੀਰਾਂ ਤੋਂ ਮਾਪਿਆ ਗਿਆ",
    gutterLine: (ft, n) => `${ft} ਫੁੱਟ ਬਿਨਾਂ ਜੋੜ ਵਾਲਾ ਐਲੂਮੀਨੀਅਮ ਗਟਰ ਅਤੇ ${n} ${n === 1 ? "ਪਰਨਾਲਾ" : "ਪਰਨਾਲੇ"}, ਲਗਾਉਣ ਸਮੇਤ ਕੀਮਤ`,
    flatRoof:
      "ਇਸ ਛੱਤ ਦਾ ਜ਼ਿਆਦਾਤਰ ਹਿੱਸਾ ਪੱਧਰਾ ਹੈ, ਇਸ ਲਈ ਪੂਰਾ ਘੇਰਾ ਗਿਣਿਆ ਗਿਆ — ਅੰਦਰੋਂ ਪਾਣੀ ਕੱਢਣ ਵਾਲੀ ਪੱਧਰੀ ਛੱਤ ਨੂੰ ਘੱਟ ਲੋੜ ਹੁੰਦੀ ਹੈ।",
    storeysUnknown: "ਮੰਜ਼ਿਲਾਂ ਦੀ ਗਿਣਤੀ ਦੀ ਪੁਸ਼ਟੀ ਮੌਕੇ ਉੱਤੇ ਹੁੰਦੀ ਹੈ; ਦੋ ਮੰਜ਼ਿਲਾਂ ਦੀ ਉਚਾਈ ਉੱਤੇ ਲਗਾਉਣਾ ਮਹਿੰਗਾ ਪੈਂਦਾ ਹੈ।",
    notAContract:
      "ਹਵਾਈ ਮਾਪਾਂ ਤੋਂ ਬਣਿਆ ਅਨੁਮਾਨ, ਇਕਰਾਰਨਾਮਾ ਨਹੀਂ — ਅੰਤਿਮ ਕੀਮਤ ਦੀ ਪੁਸ਼ਟੀ ਮੌਕੇ ਉੱਤੇ ਹੁੰਦੀ ਹੈ।",
    needsSiteVisit:
      "ਅਸੀਂ ਇਸ ਜਾਇਦਾਦ ਨੂੰ ਹਵਾਈ ਤਸਵੀਰਾਂ ਤੋਂ ਭਰੋਸੇਯੋਗ ਢੰਗ ਨਾਲ ਨਹੀਂ ਮਾਪ ਸਕੇ, ਇਸ ਲਈ ਕੋਈ ਤੁਰੰਤ ਰਕਮ ਨਹੀਂ ਹੈ — ਕੋਟ ਮੰਗੋ ਅਤੇ ਅਸੀਂ ਮੌਕੇ ਉੱਤੇ ਮਾਪ ਲਵਾਂਗੇ।",
  },
  tl: {
    measuredFrom: (date) =>
      date
        ? `Sinukat mula sa aerial na larawan ng gilid ng inyong bubong · petsa ng larawan ${date}`
        : "Sinukat mula sa aerial na larawan ng gilid ng inyong bubong",
    gutterLine: (ft, n) =>
      `${ft} ft ng seamless na aluminyong alulod at ${n} tubo pababa, kasama na ang pagkakabit sa presyo`,
    flatRoof:
      "Patag ang malaking bahagi ng bubong na ito, kaya binilang ang buong paligid — mas kaunti ang kailangan ng patag na bubong na sa loob dumadaloy ang tubig.",
    storeysUnknown: "Kukumpirmahin sa lugar ang bilang ng palapag; mas mahal ang pagkakabit sa ikalawang palapag.",
    notAContract:
      "Estimate mula sa aerial na sukat, hindi kontrata — kukumpirmahin ang huling presyo mismo sa lugar.",
    needsSiteVisit:
      "Hindi namin maaasahang masukat ang lugar na ito mula sa itaas, kaya walang instant na halaga — humiling po ng quote at susukatin namin ito mismo sa lugar.",
  },
  de: {
    measuredFrom: (date) =>
      date
        ? `Vermessen anhand von Luftbildern Ihrer Dachkante · Aufnahmedatum ${date}`
        : "Vermessen anhand von Luftbildern Ihrer Dachkante",
    gutterLine: (ft, n) =>
      `${ft} ft nahtlose Aluminium-Dachrinne und ${n} ${n === 1 ? "Fallrohr" : "Fallrohre"}, Preis inklusive Montage`,
    flatRoof:
      "Der größte Teil dieses Dachs ist flach, daher wurde der gesamte Umriss gezählt – ein Flachdach mit innenliegender Entwässerung braucht weniger.",
    storeysUnknown: "Die Zahl der Geschosse wird vor Ort bestätigt; eine Montage auf Höhe des Obergeschosses kostet mehr.",
    notAContract:
      "Eine Schätzung auf Basis von Luftbildmessungen, kein Vertrag – der Endpreis wird vor Ort bestätigt.",
    needsSiteVisit:
      "Wir konnten dieses Grundstück aus der Luft nicht zuverlässig vermessen, daher gibt es keinen Sofortbetrag – fordern Sie ein Angebot an, und wir messen vor Ort.",
  },
  it: {
    measuredFrom: (date) =>
      date
        ? `Misurato da immagini aeree del bordo del suo tetto · data delle immagini ${date}`
        : "Misurato da immagini aeree del bordo del suo tetto",
    gutterLine: (ft, n) =>
      `${ft} piedi di grondaia in alluminio senza giunture e ${n} ${n === 1 ? "pluviale" : "pluviali"}, prezzo con posa`,
    flatRoof:
      "La maggior parte di questo tetto è piana, quindi è stato contato l'intero perimetro: un tetto piano con scarico interno ne richiede meno.",
    storeysUnknown: "Il numero di piani viene confermato sul posto; la posa all'altezza del piano superiore costa di più.",
    notAContract:
      "Una stima basata su misure aeree, non un contratto: il prezzo finale viene confermato sul posto.",
    needsSiteVisit:
      "Non siamo riusciti a misurare questa proprietà in modo affidabile dall'alto, quindi non c'è una cifra immediata: richieda un preventivo e misureremo sul posto.",
  },
};

/** The copy table for a language, falling back to English. */
export function gutterEstimateCopy(language = "en") {
  const code = String(language || "en").toLowerCase().slice(0, 2);
  return Object.prototype.hasOwnProperty.call(COPY, code) ? COPY[code] : COPY.en;
}

/** Exported for the language-completeness style checks. */
export const GUTTER_ESTIMATE_COPY = COPY;
