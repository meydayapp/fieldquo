// lib/messaging/noteTheme.js
//
// What a private note looks like, and why it is the ONE thing on this screen
// the brand colour cannot touch.
//
// ══ The rule ═══════════════════════════════════════════════════════════════
//
// A note must never be mistakable for a message that went to the homeowner.
// That is not a styling preference — it is the whole safety property of the
// feature. Somebody types "quoted high, they're shopping around" into a box
// that sits four pixels from the box that sends words to the customer, and the
// only thing standing between those two outcomes at a glance is that they do
// not look alike.
//
// So the note palette is FIXED and derives from nothing. lib/documents/theme.js
// puts the company's brand colour on every client-facing surface and
// lib/messaging/bubbleTheme.js puts it on the outbound bubble — deliberately,
// so the two speakers are told apart. A note derived from the same hex would
// be a third shade of the same colour on the same screen, and for a contractor
// whose brand is already amber it would be the SAME shade. Chatwoot reaches
// for its own amber tokens here for the same reason; ours are ours, and they
// are measured rather than picked.
//
// ══ Why literal hex and not a light/dark token pair ════════════════════════
//
// The same argument lib/messaging/bubbleTheme.js makes for the outbound
// bubble: this is an OPAQUE card carrying its own measured foreground, so it
// means the same thing in both themes and cannot become pale-on-pale when
// somebody switches the app to dark. A `bg-amber-50 dark:bg-amber-950` pair
// would be two more colours nothing measures.
//
// Every pairing below is measured by scripts/check-messaging.mjs, which also
// asserts that the note fill stays a visible distance from the outbound bubble
// for every hostile brand colour a contractor might pick.

import { contrastRatio, hexToRgb } from "@/lib/brand/colour";

/**
 * The note card. Warm, quiet, and nothing like a sent message.
 *
 *   bg     a pale amber wash
 *   fg     dark amber ink — 8.15:1 on the wash, well over the 4.5:1 floor
 *   border 4.51:1 on the wash and 5.02:1 on a white card, so the card's EDGE
 *          is visible in both themes. The fill alone is 1.11:1 against a white
 *          card, which is why the border is load-bearing rather than decorative
 *          and why it is measured too.
 */
export const NOTE_BG = "#fef3c7";
export const NOTE_FG = "#78350f";
export const NOTE_BORDER = "#b45309";

/**
 * Takes NO arguments, and that is the point.
 *
 * A signature with a `company` on it is a signature somebody will eventually
 * thread a brand colour through. There is nothing to configure here.
 *
 * `ratio` and `borderRatio` are carried out so a check — and a support
 * conversation — can see the measurement rather than take it on trust, exactly
 * as bubbleColours does.
 */
export function noteColours() {
  return {
    bg: NOTE_BG,
    fg: NOTE_FG,
    border: NOTE_BORDER,
    ratio: contrastRatio(NOTE_FG, NOTE_BG),
    borderRatio: contrastRatio(NOTE_BORDER, NOTE_BG),
  };
}

/**
 * How far apart two fills are, in plain RGB distance.
 *
 * Crude on purpose: this is not a perceptual model, it is a floor. The check
 * uses it to assert that no brand colour a contractor picks brings the
 * outbound bubble anywhere near the note's wash — and the answer has to be
 * "not remotely", not "by a just-noticeable difference". The label, the icon
 * and the dashed edge do the rest of the work; colour alone is never the only
 * thing telling a note from a sent reply.
 */
export function fillDistance(a, b) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return null;
  return Math.sqrt((x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2);
}
