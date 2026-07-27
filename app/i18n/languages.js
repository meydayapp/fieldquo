// app/i18n/languages.js
//
// The languages FieldQuo supports, and why these six.
//
// English and French are Canada's official languages — non-negotiable.
// Spanish is the largest non-English language in the US by an enormous
// margin. The remaining three are chosen for TRADES specifically rather than
// from national speaker totals:
//
//   Punjabi — ~568k Canadian home speakers (2021 census) and heavily
//             represented in Canadian construction. Likelier to matter on a
//             job site than Mandarin, despite Mandarin's larger national count.
//   Tagalog — ~525k in Canada, ~1.7M in the US, similarly concentrated in
//             skilled trades and services.
//   Ukrainian — not a top-10 language nationally. Carried over because it
//             serves a real customer base (TrueFinish's clients). Business
//             reason, not a statistical one.
//
// Deliberately NOT included despite larger national numbers: Mandarin and
// Cantonese. Add them if the customer data justifies it — but every language
// here is an ongoing translation burden on every new string, so the list
// should stay short and evidence-driven.
//
// `dir` is here so adding Arabic later (rtl) doesn't require touching every
// consumer of this module.

export const LANGUAGES = [
  { code: "en", label: "EN", name: "English", nativeName: "English", dir: "ltr" },
  { code: "fr", label: "FR", name: "French", nativeName: "Français", dir: "ltr" },
  { code: "es", label: "ES", name: "Spanish", nativeName: "Español", dir: "ltr" },
  { code: "uk", label: "УК", name: "Ukrainian", nativeName: "Українська", dir: "ltr" },
  { code: "pa", label: "ਪਾ", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", dir: "ltr" },
  { code: "tl", label: "TL", name: "Tagalog", nativeName: "Tagalog", dir: "ltr" },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

export const DEFAULT_LANGUAGE = "en";

export function isSupported(code) {
  return LANGUAGE_CODES.includes(String(code || "").toLowerCase());
}

export function languageMeta(code) {
  return (
    LANGUAGES.find((l) => l.code === String(code || "").toLowerCase()) ||
    LANGUAGES[0]
  );
}

// Maps a browser Accept-Language value ("fr-CA", "pa-IN") onto a supported
// code. Falls back to English rather than guessing at a near-match.
export function normalizeLanguage(value) {
  const raw = String(value || "").toLowerCase();
  if (!raw) return DEFAULT_LANGUAGE;
  const base = raw.split(/[-_]/)[0];
  return isSupported(base) ? base : DEFAULT_LANGUAGE;
}
