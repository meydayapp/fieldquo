// lib/links/labels.js
//
// Default button wording for the bio-link page, in the company's own language.
//
// ── Why this table is so short ──────────────────────────────────────────────
//
// Four of the labels this page needs — "Get a quote", "Book a visit", "Call",
// "Get in touch" — already exist, reviewed, in six languages in
// lib/site/siteCopy.js, because the tenant website needs the same words. They
// are read from there rather than restated here: a second copy of a translated
// string is the copy that rots, and it rots silently because nobody reads the
// language they don't speak.
//
// What follows is only the wording siteCopy has no key for.
//
// ── Honesty about the coverage ──────────────────────────────────────────────
//
// Every language siteCopy carries is filled in here, which is the only state
// that makes sense: this table exists BECAUSE siteCopy has no key for these
// strings, so a language covered there and blank here produces exactly the
// half-translated page both files were written to prevent — four buttons in
// Punjabi and "Leave a review" in English, on the same bio-link page.
//
// The three `group*` entries are section headings (see linkGroupLabels in
// ./candidates.js). Only three of the five headings live here: "Book" and
// "Contact" are siteCopy's navBook/navContact, for the reason at the top of
// this file.
//
// pa and tl used to fall back to English here, correctly, because they had no
// reviewed copy anywhere in the product. They do now; so do de and it, which
// are complete in the document tables and waiting on app/i18n/languages.js.
// `linkLabels` filters through isSupported(), so a language that is ready but
// not yet offered stays inert rather than appearing early.

import { DEFAULT_LANGUAGE, isSupported } from "@/app/i18n/languages";

const EXTRA = {
  en: {
    instantEstimate: "Get an instant price",
    kitchenDesign: "Design your kitchen",
    website: "Visit our website",
    whatsapp: "Message on WhatsApp",
    email: "Email us",
    review: "Leave a review",
    groupPrice: "Get a price",
    groupFollow: "Follow us",
    groupMore: "More",
  },
  fr: {
    instantEstimate: "Obtenir un prix instantané",
    kitchenDesign: "Concevez votre cuisine",
    website: "Voir notre site web",
    whatsapp: "Écrire sur WhatsApp",
    email: "Nous écrire",
    review: "Laisser un avis",
    groupPrice: "Obtenir un prix",
    groupFollow: "Suivez-nous",
    groupMore: "Plus",
  },
  es: {
    instantEstimate: "Obtener un precio al instante",
    kitchenDesign: "Diseña tu cocina",
    website: "Visita nuestro sitio web",
    whatsapp: "Escríbenos por WhatsApp",
    email: "Envíanos un correo",
    review: "Deja una reseña",
    groupPrice: "Obtener un precio",
    groupFollow: "Síguenos",
    groupMore: "Más",
  },
  uk: {
    instantEstimate: "Дізнатися ціну одразу",
    kitchenDesign: "Спроєктуйте свою кухню",
    website: "Наш вебсайт",
    whatsapp: "Написати у WhatsApp",
    email: "Написати нам",
    review: "Залишити відгук",
    groupPrice: "Дізнатися ціну",
    groupFollow: "Підписуйтесь",
    groupMore: "Більше",
  },
  pa: {
    instantEstimate: "ਤੁਰੰਤ ਕੀਮਤ ਲਓ",
    kitchenDesign: "ਆਪਣੀ ਰਸੋਈ ਡਿਜ਼ਾਈਨ ਕਰੋ",
    website: "ਸਾਡੀ ਵੈੱਬਸਾਈਟ ਵੇਖੋ",
    whatsapp: "WhatsApp 'ਤੇ ਸੁਨੇਹਾ ਭੇਜੋ",
    email: "ਸਾਨੂੰ ਈਮੇਲ ਕਰੋ",
    review: "ਰਿਵਿਊ ਲਿਖੋ",
    groupPrice: "ਕੀਮਤ ਲਓ",
    groupFollow: "ਸਾਨੂੰ ਫਾਲੋ ਕਰੋ",
    groupMore: "ਹੋਰ",
  },
  tl: {
    instantEstimate: "Kumuha ng agarang presyo",
    kitchenDesign: "I-design ang iyong kusina",
    website: "Bisitahin ang aming website",
    whatsapp: "Mag-message sa WhatsApp",
    email: "Mag-email sa amin",
    review: "Mag-iwan ng review",
    groupPrice: "Kumuha ng presyo",
    groupFollow: "Sundan kami",
    groupMore: "Iba pa",
  },
  de: {
    instantEstimate: "Sofort einen Preis erhalten",
    kitchenDesign: "Gestalten Sie Ihre Küche",
    website: "Unsere Website ansehen",
    whatsapp: "Per WhatsApp schreiben",
    email: "Schreiben Sie uns",
    review: "Bewertung abgeben",
    groupPrice: "Preis erhalten",
    groupFollow: "Folgen Sie uns",
    groupMore: "Mehr",
  },
  it: {
    instantEstimate: "Ottenere un prezzo immediato",
    kitchenDesign: "Progetta la tua cucina",
    website: "Visitare il nostro sito",
    whatsapp: "Scrivere su WhatsApp",
    email: "Scriverci",
    review: "Lasciare una recensione",
    groupPrice: "Ottenere un prezzo",
    groupFollow: "Seguici",
    groupMore: "Altro",
  },
};

/** The extra labels for a language, falling back to English key by key. */
export function linkLabels(language) {
  const code = isSupported(language) ? String(language).toLowerCase() : DEFAULT_LANGUAGE;
  return { ...EXTRA[DEFAULT_LANGUAGE], ...(EXTRA[code] || {}) };
}
