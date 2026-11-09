// lib/documents/pdfFont.js
//
// The typeface every PDF draws with, and the reason none of them say
// "Helvetica" any more.
//
// ── What was broken ────────────────────────────────────────────────────────
//
// Helvetica is one of the fourteen fonts a PDF reader is required to have, so
// it needs no embedding and costs nothing. It also carries Latin-1 and only
// Latin-1. Every code point above U+00FF was written to the page truncated to
// its low byte, silently, with no error anywhere:
//
//   Підготовлено  →  .V43>B>2;5=>          (uk, "Prepared for")
//   ਲਈ ਤਿਆਰ ਕੀਤਾ   →  2\b $?\x060 \x15@$>   (pa, "Prepared for")
//
// app/i18n/languages.js has offered Ukrainian and Punjabi as DOCUMENT
// languages the whole time, the pickers are live, and lib/i18n/documentLabels.js
// has hand-written translations for both. The quote reached the homeowner as
// mojibake on the contractor's own letterhead.
//
// French, Spanish, Italian, German and Tagalog were unaffected — é, ü, ñ all
// live inside Latin-1 — which is exactly why this survived so long.
//
// ── The stack, and why it is a stack ───────────────────────────────────────
//
// @react-pdf substitutes fonts per CODE POINT, not per run
// (@react-pdf/textkit's pickFontFromFontStack), so one array covers every
// document: Noto Sans answers for Latin and Cyrillic, Noto Sans KR picks up
// Hangul, and Noto Sans Gurmukhi would pick up the Punjabi if it could be
// trusted to (it cannot — see below). Nothing branches on Quote.language,
// which matters because language is a property of the DOCUMENT and not of the
// text on it — an English quote for a homeowner named 김민준 renders that name
// correctly, and a Ukrainian quote with a Latin street name does too.
//
// ── Bold is its own family, not a weight ───────────────────────────────────
//
// Forty-odd call sites said `fontFamily: "Helvetica-Bold"` — the PDF base-14
// model, where bold is a different font rather than an axis. Keeping that
// shape makes the migration a pure token swap; expressing it as
// `fontFamily: PDF_FONT, fontWeight: 700` would have meant editing two props
// at every site, and forgetting the second one silently yields regular text
// that still renders and still looks almost right.
//
// ── Why the bytes are inline, and what can still fail ──────────────────────
//
// See scripts/build-pdf-fonts.mjs for the long version. Short version: a
// filesystem path only works if next's file tracing copies the .ttf into the
// lambda, which cannot be proven from a laptop, and the failure mode is
// renderToBuffer() rejecting on a live quote send.
//
// Registration here is pure string handling, so it cannot fail at request
// time — there is no fetch, no open, no disk. The one remaining failure is a
// corrupt subset, which fontkit would reject on the first render. That would
// throw rather than print junk, which is the right way round: a Send button
// that errors gets fixed, and a PDF that quietly prints garbage gets sent to
// a customer. scripts/check-pdf-fonts.mjs renders every label of every
// language in the catalogue, plus all 11,172 Hangul syllables, so a corrupt
// face is caught in CI and never reaches a request.

import { Font } from "@react-pdf/renderer";
import { NOTO_SANS_REGULAR } from "@/lib/documents/fonts/notoSansRegular";
import { NOTO_SANS_BOLD } from "@/lib/documents/fonts/notoSansBold";
import { NOTO_SANS_GURMUKHI_REGULAR } from "@/lib/documents/fonts/notoSansGurmukhiRegular";
import { NOTO_SANS_GURMUKHI_BOLD } from "@/lib/documents/fonts/notoSansGurmukhiBold";
import { NOTO_SANS_KR_REGULAR } from "@/lib/documents/fonts/notoSansKrRegular";
import { NOTO_SANS_KR_BOLD } from "@/lib/documents/fonts/notoSansKrBold";

const SANS = "FieldQuo Sans";
const SANS_BOLD = "FieldQuo Sans Bold";
const GURMUKHI = "FieldQuo Gurmukhi";
const GURMUKHI_BOLD = "FieldQuo Gurmukhi Bold";
const KOREAN = "FieldQuo Korean";
const KOREAN_BOLD = "FieldQuo Korean Bold";

// ── Gurmukhi is registered but NOT in the fallback chain, on purpose ───────
//
// The subset renders simple Gurmukhi and then throws on real text. Measured
// against lib/i18n/documentLabels.js's own `pa` catalogue: 30 of 69 labels
// render and **39 crash**, "ਉਪ-ਜੋੜ" (Subtotal) among them, with
// `TypeError: Cannot read properties of null (reading 'xCoordinate')` raised
// from inside fontkit while shaping stacked matras. No single character does
// it — a per-character bisect renders every one of them alone — so it is the
// conjunct shaping, not a missing code point, and `--layout-features=*` is
// already passed to pyftsubset.
//
// (Those counts read "25 of 46" until 2026-11-08. The catalogue has grown to
// 69 labels since; the ratio and the single error are unchanged, so the
// decision below is unchanged. Re-measured rather than re-asserted.)
//
// Putting it in the chain would trade a cosmetic bug for a hard one. Today a
// Punjabi quote renders mojibake: wrong, visible, and the PDF still arrives.
// With this face in the chain the render REJECTS, and renderToBuffer rejecting
// on a live quote send is a Send button that errors — strictly worse than one
// that sends something ugly, and precisely the trade AGENTS.md tells us not to
// make.
//
// So Punjabi is left exactly as it was, no better and no worse, while
// Ukrainian and Russian — Cyrillic, which is verified working — are fixed.
// The faces stay registered so the fix is a one-line change here once the
// shaping crash is solved, and scripts/check-pdf-fonts.mjs holds the evidence.

// ── Korean IS in the chain, and the difference from Gurmukhi is measured ───
//
// Hangul earns its place by the same standard Gurmukhi failed: not "it looks
// safer", but every string rendered and counted. Modern Korean is precomposed
// syllables with no conjunct shaping, which is the reason to EXPECT safety —
// and expecting is what the Gurmukhi comment above is a monument to, so it was
// swept instead:
//
//   all 11,172 Hangul syllable code points, singly       11,172 render, 0 crash
//   the same, in 8-syllable clusters, regular and bold    2,794 render, 0 crash
//   hostile strings, regular and bold                        26 render, 0 crash
//
// 11,172 rather than the 2,350 the face actually carries, deliberately: the
// 8,822 syllables OUTSIDE the subset are the interesting case, and they come
// back as a blank box rather than a throw. That is the whole argument — out of
// subset degrades, it does not reject.
//
// There is no `ko` table in lib/i18n/documentLabels.js and app/i18n/languages.js
// does not offer Korean, so no document is written IN Korean today and this is
// not what fixes that. What it fixes is free text, which is the majority of a
// quote and is not in any language the picker knows about: a client named 김민준,
// a job address in Hangul, a scope note typed by a bilingual estimator. Those
// rendered as tofu on an English quote on the contractor's own letterhead.
// Per-code-point substitution is what makes that work without branching on
// Quote.language — the same property the Cyrillic fix relies on.
//
// Mandarin is NOT here. It is not a safety question — the Han sweep came back
// 26,242 renders and 0 crashes — it is 3.2 MB of base64 per lambda against
// Korean's 2.2 MB, and unlike Gurmukhi a held-back CJK face cannot be cheaply
// kept on hand, because importing it ships it. scripts/build-pdf-fonts.mjs
// carries the measured numbers and the enable recipe.

/** Regular body text. Use in place of the old `fontFamily: "Helvetica"`. */
export const PDF_FONT = [SANS, KOREAN];

/** Bold. Use in place of the old `fontFamily: "Helvetica-Bold"`. */
export const PDF_FONT_BOLD = [SANS_BOLD, KOREAN_BOLD];

/** The Gurmukhi faces, held out of the chain above. See the comment there. */
export const PDF_FONT_GURMUKHI = [GURMUKHI];
export const PDF_FONT_GURMUKHI_BOLD = [GURMUKHI_BOLD];

// @react-pdf's font store is a module singleton and register() APPENDS a
// source rather than replacing one, so a second call would stack duplicate
// faces on the same family. Module-level execution already runs once per
// process, but a check script that imports both this and a renderer, or a dev
// server that reloads, would call it twice.
let registered = false;

/**
 * Registers the document faces. Idempotent, synchronous, no I/O.
 *
 * Called at the top of every renderer rather than as an import side effect:
 * a side effect would work, and would also mean that deleting the seemingly
 * unused import silently returns every PDF to mojibake.
 */
export function registerPdfFonts() {
  if (registered) return;
  registered = true;

  Font.register({ family: SANS, src: NOTO_SANS_REGULAR, fontWeight: 400 });
  Font.register({ family: SANS_BOLD, src: NOTO_SANS_BOLD, fontWeight: 400 });
  Font.register({ family: GURMUKHI, src: NOTO_SANS_GURMUKHI_REGULAR, fontWeight: 400 });
  Font.register({ family: GURMUKHI_BOLD, src: NOTO_SANS_GURMUKHI_BOLD, fontWeight: 400 });
  Font.register({ family: KOREAN, src: NOTO_SANS_KR_REGULAR, fontWeight: 400 });
  Font.register({ family: KOREAN_BOLD, src: NOTO_SANS_KR_BOLD, fontWeight: 400 });

  // Hyphenation is deliberately left alone. @react-pdf's built-in hyphenator
  // is en-US pattern-based, and its patterns are keyed on Latin letters, so a
  // Cyrillic or Gurmukhi word matches nothing and comes back whole. Replacing
  // it would change where English quotes break their lines — a visual change
  // to documents that are not broken, smuggled in under a font fix.
}
