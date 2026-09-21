// lib/reviews/reviewQrCopy.js
//
// The sentences printed beside the review QR — on the sticker sheet, under
// the email button, in the invoice footer, on the portal's paid state, on the
// wallet pass. Eight document languages, written out rather than translated
// at render time, for the same reason every other client-facing string in
// lib/i18n is: the contractor should be able to read exactly what the
// customer sees, and a signed PDF must keep saying what it said.
//
// Nothing here names FieldQuo. The QR is the contractor's ask.
//
// No imports, so scripts/check-reviews-google.mjs can read every language
// back and confirm each key exists in all eight.

const COPY = {
  en: {
    scan: "Scan to leave us a review",
    scanGoogle: "Scan to leave us a Google review",
    enjoyed: "Enjoyed the work? Scan to review us",
    orVisit: "or visit",
    leaveReview: "Leave us a review",
    passTitle: "Leave us a review",
    passHint: "Point your camera at the code",
    thanks: "Thank you — it means a lot to a small business.",
  },
  fr: {
    scan: "Scannez pour nous laisser un avis",
    scanGoogle: "Scannez pour nous laisser un avis Google",
    enjoyed: "Satisfait du travail? Scannez pour nous évaluer",
    orVisit: "ou visitez",
    leaveReview: "Laissez-nous un avis",
    passTitle: "Laissez-nous un avis",
    passHint: "Pointez votre caméra vers le code",
    thanks: "Merci — ça compte beaucoup pour une petite entreprise.",
  },
  es: {
    scan: "Escanea para dejarnos una reseña",
    scanGoogle: "Escanea para dejarnos una reseña en Google",
    enjoyed: "¿Contento con el trabajo? Escanea para valorarnos",
    orVisit: "o visita",
    leaveReview: "Déjanos una reseña",
    passTitle: "Déjanos una reseña",
    passHint: "Apunta la cámara al código",
    thanks: "Gracias — significa mucho para un pequeño negocio.",
  },
  uk: {
    scan: "Скануйте, щоб залишити нам відгук",
    scanGoogle: "Скануйте, щоб залишити нам відгук у Google",
    enjoyed: "Сподобалась робота? Скануйте, щоб оцінити нас",
    orVisit: "або відвідайте",
    leaveReview: "Залишити відгук",
    passTitle: "Залишити відгук",
    passHint: "Наведіть камеру на код",
    thanks: "Дякуємо — для малого бізнесу це дуже важливо.",
  },
  pa: {
    scan: "ਸਾਨੂੰ ਰਿਵਿਊ ਦੇਣ ਲਈ ਸਕੈਨ ਕਰੋ",
    scanGoogle: "ਸਾਨੂੰ Google ਰਿਵਿਊ ਦੇਣ ਲਈ ਸਕੈਨ ਕਰੋ",
    enjoyed: "ਕੰਮ ਪਸੰਦ ਆਇਆ? ਸਾਡਾ ਰਿਵਿਊ ਦੇਣ ਲਈ ਸਕੈਨ ਕਰੋ",
    orVisit: "ਜਾਂ ਵੇਖੋ",
    leaveReview: "ਸਾਨੂੰ ਰਿਵਿਊ ਦਿਓ",
    passTitle: "ਸਾਨੂੰ ਰਿਵਿਊ ਦਿਓ",
    passHint: "ਆਪਣਾ ਕੈਮਰਾ ਕੋਡ ਵੱਲ ਕਰੋ",
    thanks: "ਧੰਨਵਾਦ — ਇੱਕ ਛੋਟੇ ਕਾਰੋਬਾਰ ਲਈ ਇਹ ਬਹੁਤ ਮਾਅਨੇ ਰੱਖਦਾ ਹੈ।",
  },
  tl: {
    scan: "I-scan para mag-iwan ng review",
    scanGoogle: "I-scan para mag-iwan ng Google review",
    enjoyed: "Nasiyahan sa trabaho? I-scan para i-review kami",
    orVisit: "o bisitahin ang",
    leaveReview: "Mag-iwan ng review",
    passTitle: "Mag-iwan ng review",
    passHint: "Itutok ang camera sa code",
    thanks: "Salamat — malaking bagay ito sa isang maliit na negosyo.",
  },
  de: {
    scan: "Scannen und eine Bewertung hinterlassen",
    scanGoogle: "Scannen und eine Google-Bewertung hinterlassen",
    enjoyed: "Zufrieden mit der Arbeit? Scannen und bewerten",
    orVisit: "oder besuchen Sie",
    leaveReview: "Bewerten Sie uns",
    passTitle: "Bewerten Sie uns",
    passHint: "Kamera auf den Code richten",
    thanks: "Danke — für einen kleinen Betrieb bedeutet das viel.",
  },
  it: {
    scan: "Scansiona per lasciarci una recensione",
    scanGoogle: "Scansiona per lasciarci una recensione su Google",
    enjoyed: "Soddisfatto del lavoro? Scansiona per recensirci",
    orVisit: "oppure visita",
    leaveReview: "Lasciaci una recensione",
    passTitle: "Lasciaci una recensione",
    passHint: "Inquadra il codice con la fotocamera",
    thanks: "Grazie — per una piccola impresa conta molto.",
  },
};

export const REVIEW_QR_LANGUAGES = Object.keys(COPY);
export const REVIEW_QR_COPY = COPY;

export function reviewQrCopy(language) {
  return COPY[language] || COPY.en;
}

/**
 * "Scan to leave us a Google review" when the link is a Google one, the
 * site-neutral sentence otherwise — a company sending people to HomeStars
 * must not print "Google" on its van.
 */
export function isGoogleReviewUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host === "g.page" || host === "search.google.com" || host === "maps.google.com" || host.endsWith(".google.com") || host === "google.com";
  } catch {
    return false;
  }
}

export function scanSentence(language, url) {
  const t = reviewQrCopy(language);
  return isGoogleReviewUrl(url) ? t.scanGoogle : t.scan;
}
