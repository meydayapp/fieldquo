// lib/quotes/reviewSentence.js
//
// How a review finding carries a sentence in nine languages without storing
// nine sentences.
//
// ── The shape ──────────────────────────────────────────────────────────────
//
// A finding stores `i18n: { key, params }` beside its English `detail`. The
// key names a template in app/i18n/appMessages.js; the params are TYPED so
// the reader's language can format them:
//
//   "12"                         → interpolated as is
//   { money: 2.95, digits: 2 }   → "$2.95" / "2,95 $" in the reader's locale
//                                  and the company's currency
//   { t: "app.quoteReview.unit_sqft" } → translated ("sq ft" / "pi²")
//
// The English `detail` is rendered from the SAME template at review time, so
// what is stored for older readers and what a French reader sees are two
// renderings of one sentence and cannot drift. Any reader that has not
// learned `i18n` yet (the sales portal's quote preview, an older stored
// review) still has a sentence to print.
//
// Client-safe: no catalogue import here. The panel supplies its `t` and its
// money formatter; the server supplies the English dictionary and the
// company currency.

/**
 * Turn typed params into plain strings.
 *
 * @param params    the finding's `i18n.params`
 * @param translate (key) => string
 * @param money     (amount, digits) => string
 */
export function resolveParams(params, { translate, money }) {
  const out = {};
  for (const [name, v] of Object.entries(params || {})) {
    if (v && typeof v === "object" && "money" in v) {
      out[name] = money(Number(v.money), Number.isFinite(Number(v.digits)) ? Number(v.digits) : 0);
    } else if (v && typeof v === "object" && "t" in v) {
      out[name] = translate(String(v.t));
    } else if (v === null || v === undefined) {
      out[name] = "";
    } else {
      out[name] = String(v);
    }
  }
  return out;
}

/**
 * Interpolate `{name}` placeholders, or call a function template — the same
 * two shapes app/hooks/useTranslation.js's t() accepts, so a template that
 * works in the panel works here.
 */
export function fillTemplate(raw, values) {
  if (typeof raw === "function") return String(raw(values || {}));
  if (typeof raw !== "string") return "";
  return raw.replace(/\{(\w+)\}/g, (m, name) =>
    values && values[name] !== undefined ? String(values[name]) : m,
  );
}
