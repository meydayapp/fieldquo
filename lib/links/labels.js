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
// en / fr / es / uk are filled in, matching what siteCopy already carries.
// pa and tl fall back to English for the same reason siteCopy documents: they
// are declared in app/i18n/languages.js with no reviewed translations behind
// them anywhere in the product, and machine-translating blind and shipping it
// as though it were checked is worse than an English word on a French page.

import { DEFAULT_LANGUAGE, isSupported } from "@/app/i18n/languages";

const EXTRA = {
  en: {
    instantEstimate: "Get an instant price",
    website: "Visit our website",
    whatsapp: "Message on WhatsApp",
    email: "Email us",
    review: "Leave a review",
  },
  fr: {
    instantEstimate: "Obtenir un prix instantané",
    website: "Voir notre site web",
    whatsapp: "Écrire sur WhatsApp",
    email: "Nous écrire",
    review: "Laisser un avis",
  },
  es: {
    instantEstimate: "Obtener un precio al instante",
    website: "Visita nuestro sitio web",
    whatsapp: "Escríbenos por WhatsApp",
    email: "Envíanos un correo",
    review: "Deja una reseña",
  },
  uk: {
    instantEstimate: "Дізнатися ціну одразу",
    website: "Наш вебсайт",
    whatsapp: "Написати у WhatsApp",
    email: "Написати нам",
    review: "Залишити відгук",
  },
};

/** The extra labels for a language, falling back to English key by key. */
export function linkLabels(language) {
  const code = isSupported(language) ? String(language).toLowerCase() : DEFAULT_LANGUAGE;
  return { ...EXTRA[DEFAULT_LANGUAGE], ...(EXTRA[code] || {}) };
}
