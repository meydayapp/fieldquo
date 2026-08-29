// lib/marketing/featureLabels.js
//
// The thin layer between "what exists" and "how it is said".
//
// ══ The bug this exists to fix ═════════════════════════════════════════════
//
// The Ukrainian /pricing page printed its four group headings in Ukrainian —
// "Виконати роботу", "Отримати оплату" — and every feature underneath them in
// English: "Scheduling and dispatch", "Job costing", "Get paid by card". Half
// translated reads as broken software, which is a worse impression than a page
// that was never translated at all: the visitor concludes the product is
// falling over, not that the marketing site is English.
//
// The cause was structural rather than an omission. Group headings come from
// app/i18n/messages.js through t(). Feature names come from
// lib/marketing/featureMatrix.js, which is an English data module — deliberately
// so, because check:translations gates the catalogue and would have forced the
// matrix's proof-carrying claims through a translation coverage bar they have
// no business being held to.
//
// ══ Why the fix is a layer and not a move ══════════════════════════════════
//
// The obvious repair — put the six languages inside featureMatrix.js, or
// translate its `name` fields in place — destroys the one property that makes
// that file worth having. The matrix's job is to say what EXISTS, with the file
// paths that prove each sentence true, and 616 assertions in
// scripts/check-feature-matrix.mjs read those English strings. A claim and its
// six phrasings are different kinds of thing with different failure modes: a
// wrong claim is a refund, a wrong phrasing is a bad sentence.
//
// So the split stands. The matrix says what is true; the catalogue says it in
// the visitor's language; this file is the seam, and it is the ONLY place a
// renderer is allowed to turn a feature key into words.
//
// ══ English is not stored twice, it is the fallback ════════════════════════
//
// There IS an English block in the catalogue (`feature.<key>.name` under `en`),
// and it exists only because scripts/check-translations.mjs works by comparing
// every language against the keys of English — a key present in Ukrainian and
// absent from English is reported as "not in English" and fails the run.
//
// That copy is pinned: scripts/check-feature-labels.mjs asserts every English
// catalogue string is character-identical to the matrix's own, so the duplicate
// cannot rot into a second, unproved wording. And the resolution below falls
// through to the matrix regardless, so even if somebody deletes the English
// block the pages keep printing the proved sentence rather than a raw key.

import { matrixEntry, MATRIX_KEYS } from "@/lib/marketing/featureMatrix";

/** The two fields a visitor reads. `limits` is deliberately not here — see below. */
export const LABEL_FIELDS = Object.freeze(["name", "summary"]);

/**
 * The catalogue key for one field of one feature.
 *
 * Flat and dot-namespaced, matching every other key in messages.js. Written as
 * a function rather than typed at call sites so the prefix can never drift
 * between the renderer, the catalogue and the check that compares them —
 * `feature.job_costing.name` is greppable and appears in exactly one shape.
 */
export function featureLabelKey(key, field) {
  return `feature.${key}.${field}`;
}

/** Every catalogue key this layer can ask for, in matrix order. */
export const FEATURE_LABEL_KEYS = Object.freeze(
  MATRIX_KEYS.flatMap((key) => LABEL_FIELDS.map((field) => featureLabelKey(key, field))),
);

/**
 * The matrix entry, with `name` and `summary` said in the reader's language.
 *
 * ── Why it takes t() rather than a language code ───────────────────────────
 *
 * t() already implements the resolution this needs, and implements it in one
 * place: requested language → English → the fallback passed at the call site →
 * the key itself. Re-deriving that here from MESSAGES would be a second copy of
 * the rule, and the copy is the one that rots because it is the one nobody
 * looks at. Passing the fallback as the matrix's own string extends the chain
 * by one honest step: a language with no entry prints the proved English
 * sentence, never `feature.job_costing.name`.
 *
 * ── Why t is optional ──────────────────────────────────────────────────────
 *
 * /compare/* and /features/* are server components with no translation context
 * at all — a deliberate decision recorded in their own headers. They call this
 * with no second argument and get the matrix's English, which is exactly what
 * they render today. The point of routing them through here anyway is that the
 * day those pages gain a language, the change is one argument at one call site
 * rather than a hunt for every place a feature name is printed.
 *
 * ── Why the whole entry, not just the two strings ──────────────────────────
 *
 * Callers need `readiness` and `limits` beside the name — a partial feature is
 * never rendered as a bare tick. Returning a merged entry means one lookup and
 * one object at the call site, and it keeps the renderers reading `entry.name`
 * as they already did, so nothing about the markup changes.
 *
 * `limits` is NOT translated here. That is a real gap and it is named rather
 * than hidden: eight entries carry one, and one of them (door_hanger_routes)
 * renders on /pricing, so a Ukrainian visitor sees one English caveat under an
 * otherwise Ukrainian block. Translating a limit is translating a legal-ish
 * hedge — "we do not lend and do not approve anyone" — and those are the eight
 * sentences on the marketing site where a loose paraphrase does the most
 * damage. They belong in the same catalogue, in a pass that a native speaker
 * signs off, not smuggled in beside the names.
 *
 * Returns undefined for a key the matrix does not carry, exactly as
 * matrixEntry() does. A renderer that improvises a name to fill a card is the
 * failure featureMatrix.js exists to prevent, and it must not be introduced
 * here at the last step.
 */
export function featureEntry(key, t) {
  const entry = matrixEntry(key);
  if (!entry) return undefined;
  if (typeof t !== "function") return entry;

  return {
    ...entry,
    name: t(featureLabelKey(key, "name"), entry.name),
    summary: t(featureLabelKey(key, "summary"), entry.summary),
  };
}

/**
 * Just the two strings, for a caller that has no use for the rest of the entry.
 *
 * Built on featureEntry rather than beside it, so there is one resolution path
 * and not two that can come to disagree.
 */
export function featureLabel(key, t) {
  const entry = featureEntry(key, t);
  return entry ? { name: entry.name, summary: entry.summary } : undefined;
}
