// lib/photoAnnotator/contrast.js
//
// "A fixed red is invisible on a red brick wall. Consider an outline or
// shadow so any colour reads on any photo" — the task brief, verbatim.
//
// ── Why this can't measure the photo itself ─────────────────────────────
//
// lib/documents/theme.js measures contrast against a known page background —
// a company's brand hex, always the same colour under the text. A job photo
// has no single background colour: one stroke can cross brick, sky and a
// white door trim in the same three inches. There is no pixel-sampling
// version of ensureContrast() that would help here even in principle — by
// the time you'd know which colour was "under" a point on the stroke, you'd
// need to have already rendered it.
//
// So instead of measuring the photo, every annotation object gets a HALO: a
// slightly wider copy of itself, in whichever of near-white/near-black
// contrasts more against the ink colour, drawn immediately behind it. That
// guarantees a hard edge between the ink and *something* regardless of what
// the photo underneath happens to be — the same trick topographic maps and
// road atlases use for a route line ("casing"), and the reason white chalk
// outlines read on both light and dark asphalt.
//
// haloColorFor() reuses lib/brand/colour.js#readableForeground rather than
// re-deriving a light/dark choice — the exact "is it dark? use white" trap
// AGENTS.md warns about is what that function already replaced with measured
// contrast, and re-implementing a second, cruder version of it here for
// annotation ink would be exactly the copy-paste duplication AGENTS.md's
// recurring-failure-class #4 calls out.
import { isValidHex, readableForeground, contrastRatio } from "@/lib/brand/colour";

const FALLBACK_INK = "#ff3b30"; // lib/photoAnnotator/constants.js's DEFAULT_INK_COLOR, duplicated as a
// literal (not imported) so this stays a leaf module constants.js itself can
// import without a cycle.

const HALO_LIGHT = "#ffffff";
const HALO_DARK = "#111111"; // near-black, not pure #000 — matches theme.js's own note that pure
// black is harsher than necessary; here it also keeps the halo from reading
// as a hard black hole on an already-dark photo.

/**
 * Which halo colour makes `inkHex` readable against an unknown background —
 * white for a dark ink (navy, black, deep red), near-black for a light one
 * (yellow, white, pale green).
 *
 * @param inkHex  the annotation's own stroke/fill colour
 * @returns "#ffffff" | "#111111"
 */
export function haloColorFor(inkHex) {
  const hex = isValidHex(inkHex) ? (String(inkHex).startsWith("#") ? inkHex : `#${inkHex}`) : FALLBACK_INK;
  return readableForeground(hex, { light: HALO_LIGHT, dark: HALO_DARK });
}

/** The measured contrast between an ink colour and the halo chosen for it —
 * exposed so a check script can assert the PAIRING actually clears a floor,
 * not just that some colour was returned. */
export function haloContrast(inkHex) {
  const hex = isValidHex(inkHex) ? (String(inkHex).startsWith("#") ? inkHex : `#${inkHex}`) : FALLBACK_INK;
  return contrastRatio(hex, haloColorFor(hex));
}
