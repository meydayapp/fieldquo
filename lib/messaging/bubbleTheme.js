// lib/messaging/bubbleTheme.js
//
// The two colours a message bubble needs, measured rather than guessed.
//
// ══ Why the brand colour appears in the back office at all ═════════════════
//
// app/app/layout.js deliberately does NOT wrap the back office in BrandTheme,
// and its comment gives the reason: "a contractor who picks lime green should
// not get a lime-green back office". That rule is right and this is the one
// deliberate exception to it, because of what the surface IS — a chat where
// the two speakers have to be told apart at a glance. Every messaging app in
// the world does that with one tinted side, the homeowner is on the other end
// of a Page wearing the company's colours, and a grey-on-grey inbox is harder
// to read for no gain. One accent, on one element, on one screen.
//
// ══ Why fillPair and not "is it dark? use white" ═══════════════════════════
//
// Because that rule fails on exactly the colours contractors pick. A mid-grey
// or olive brand reaches about 4.3:1 against BOTH black and white, so NO
// foreground fixes it and the naive rule ships unreadable text. fillPair
// (lib/documents/theme.js) handles that by moving the FILL in small steps
// until the pair measures 4.5:1, and substitutes ink when it cannot — the same
// function the totals bar on every quote uses, so a bubble and an invoice
// cannot disagree about what a company's colour looks like with text on it.
//
// Computed on the SERVER and sent to the browser as two hex strings: the
// alternative is shipping the colour maths into the bundle and hoping the
// client runs it, and this way scripts/check-messaging.mjs measures the exact
// values the page will paint.

import { documentTheme, fillPair } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";

/**
 * @param {object} company  needs only { brandColor }
 * @returns {{ outbound: {bg,fg}, ratio: number }}
 *
 * `ratio` is carried through so a check — and a support conversation — can see
 * the measurement rather than take it on trust.
 *
 * ── Only the OUTBOUND side is computed here ──────────────────────────────
 *
 * The homeowner's bubble uses the app's own `bg-muted` / `text-foreground`
 * tokens instead, and that is not laziness: those tokens flip with light and
 * dark mode, and a literal hex pair from neutralPair() — which is measured
 * against a fixed #f3f4f6 — would be pale grey text on a pale grey card the
 * moment somebody switches the app to dark. The outbound pair is safe as a
 * literal because it is a solid brand fill carrying its own measured
 * foreground; it means the same thing in both themes.
 */
export function bubbleColours(company = {}) {
  const theme = documentTheme(company);
  const outbound = fillPair(theme);
  return {
    outbound: { bg: outbound.bg, fg: outbound.fg },
    ratio: contrastRatio(outbound.fg, outbound.bg),
  };
}
