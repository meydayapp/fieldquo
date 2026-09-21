// lib/i18n/acceptLanguage.js
//
// The language a STRANGER's browser asks for, for the one public surface
// that has no document and no client row to read it from: the digital
// business card (app/c/[slug]). Precedence: the first Accept-Language tag
// whose primary subtag is one of the eight document languages, then the
// company's default, then English. A browser set to Portuguese gets the
// company's own language, not ours.
//
// Pure — the same q-sorted walk lib/help/lang.js does, over the document
// language set rather than the help centre's.

import { SUPPORTED_EMAIL_LANGUAGES } from "./emailCopy";

export function pickVisitorLanguage(acceptLanguage, fallback = "en") {
  const tags = String(acceptLanguage || "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((x) => x.tag && Number.isFinite(x.q) && x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    const primary = tag.split("-")[0];
    if (SUPPORTED_EMAIL_LANGUAGES.includes(primary)) return primary;
  }
  const fb = String(fallback || "").toLowerCase();
  return SUPPORTED_EMAIL_LANGUAGES.includes(fb) ? fb : "en";
}
