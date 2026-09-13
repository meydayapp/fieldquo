// lib/marketing/screenshots.js
//
// Where a marketing screenshot lives, and which language of it a reader gets.
//
// The live captures under docs/screens/live/app/ and the harness captures
// under docs/screens/app-guide/ were taken in English, French and Spanish;
// public/product/<dir>/<name>.<lang>.webp holds the converted copies. A page
// picks the reader's language when a capture exists in it and English
// otherwise — a Ukrainian reader gets the English capture, which is a true
// picture of the product with a caption in their own language. A screenshot
// is a picture, not a sentence, and nobody machine-translates a picture.
//
// One module for both /product/<slug> and /features/<slug>, so the two page
// families cannot come to disagree about which languages exist or how a
// path is spelled. Pure: executed by scripts/check-product-pages.mjs and
// scripts/check-feature-pages.mjs, which also assert the files are on disk.

/** The languages the captures were taken in — derived from the capture folders, not from LANGUAGES. */
export const SCREEN_LANGS = Object.freeze(["en", "fr", "es"]);

/** The language a screenshot is served in for a reader's language. */
export function screenLang(language) {
  return SCREEN_LANGS.includes(language) ? language : "en";
}

/**
 * The public path of an image for a reader's language.
 *
 * An image is either a full `src` (an illustration in public/marketing that
 * two pages may share without a second copy of the file) or a `dir` and
 * `name` under public/product/, with `localized` saying whether a copy per
 * capture language exists.
 */
export function screenSrc(image, language = "en") {
  if (image.src) return image.src;
  const suffix = image.localized ? `.${screenLang(language)}` : "";
  return `/product/${image.dir}/${image.name}${suffix}.webp`;
}
