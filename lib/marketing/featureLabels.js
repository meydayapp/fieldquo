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

import { matrixEntry, MATRIX_GROUPS, MATRIX_KEYS } from "@/lib/marketing/featureMatrix";

/**
 * The two fields EVERY feature has.
 *
 * `limits` is not here because only eight entries carry one, and putting it in
 * this list would mint 68 keys for a sentence that does not exist — a catalogue
 * full of empty strings is a coverage check that proves nothing. It gets its
 * own list below instead, built from the matrix rather than typed out.
 */
export const LABEL_FIELDS = Object.freeze(["name", "summary"]);

/**
 * The features that carry a `limits` sentence, and the keys for those.
 *
 * ── The gap this closes ───────────────────────────────────────────────────
 *
 * The note that used to sit further down this file said, honestly, that limits
 * were NOT translated: "eight entries carry one, and one of them
 * (door_hanger_routes) renders on /pricing, so a Ukrainian visitor sees one
 * English caveat under an otherwise Ukrainian block." That was true and it was
 * the worst-placed English on the site — every one of these is the sentence
 * that stops a customer buying something we do not sell. "FieldQuo does not
 * lend and does not approve anyone" is not marketing copy; it is the reason a
 * financing page is not a lie.
 *
 * They are translated now, in the same catalogue, and they were translated the
 * way the note asked for: as hedges, kept narrow, with no verb softened. The
 * ones a native speaker should still read are named in the final report and in
 * the header of app/i18n/featurePages/index.js — a translated caveat that has
 * drifted wider or narrower than the English is worse than an English one,
 * because it reads as a promise in the reader's own language.
 *
 * Derived from the matrix, so the day a ninth entry gains a limit the coverage
 * check fails until somebody writes the six sentences. A hand-typed list here
 * would let that ninth caveat ship in English and nothing would notice.
 */
export const LIMIT_KEYS = Object.freeze(
  MATRIX_KEYS.filter((key) => {
    const limits = matrixEntry(key)?.limits;
    return typeof limits === "string" && limits.trim().length > 0;
  }),
);

export const FEATURE_LIMIT_KEYS = Object.freeze(
  LIMIT_KEYS.map((key) => featureLabelKey(key, "limits")),
);

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
 * `limits` IS translated here now — see LIMIT_KEYS above for the gap that was
 * and how it was closed. It is resolved only for the eight entries that carry
 * one: an entry with no limit gets no key and no lookup, so the catalogue never
 * holds an empty caveat that a renderer could print as a blank hedge.
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

  const said = {
    ...entry,
    name: t(featureLabelKey(key, "name"), entry.name),
    summary: t(featureLabelKey(key, "summary"), entry.summary),
  };
  // Only when there IS one. `entry.limits` is undefined on 68 of the 76, and
  // t("feature.quotes.limits", undefined) would hand back the key itself —
  // "Where this stops: feature.quotes.limits" under a feature that stops
  // nowhere.
  if (typeof entry.limits === "string" && entry.limits.trim()) {
    said.limits = t(featureLabelKey(key, "limits"), entry.limits);
  }
  return said;
}

/**
 * A matrix GROUP heading, in the reader's language.
 *
 * /features and /features/[slug] print `group.label` and `group.blurb` straight
 * off the matrix — the same shape of bug as the feature names, one heading
 * higher. /pricing does not share these keys: it has its own four
 * (`pricing.group.winning` and friends) which are already translated, and they
 * are SHORTER than the matrix's because a plan card has less room than a page
 * banner. Two surfaces, two lengths, one truth underneath; folding them into
 * one key would make one of the two pages read badly to save eight strings.
 *
 * Same optional-t contract as featureEntry: no translator means the matrix's
 * own English, unchanged.
 */
export function featureGroupKey(key, field) {
  return `featureGroup.${key}.${field}`;
}

export const GROUP_LABEL_FIELDS = Object.freeze(["label", "blurb"]);

export const FEATURE_GROUP_KEYS = Object.freeze(
  MATRIX_GROUPS.flatMap((g) => GROUP_LABEL_FIELDS.map((f) => featureGroupKey(g.key, f))),
);

export function featureGroup(key, t) {
  const group = MATRIX_GROUPS.find((g) => g.key === key);
  if (!group) return undefined;
  if (typeof t !== "function") return group;
  return {
    ...group,
    label: t(featureGroupKey(key, "label"), group.label),
    blurb: t(featureGroupKey(key, "blurb"), group.blurb),
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
