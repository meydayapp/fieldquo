// lib/tours/anchor.js
//
// Where a tour card goes, and what it points at.
//
// ══ Why this is its own module ════════════════════════════════════════════
//
// There are two tours in this product — the contractor's first-visit
// walkthrough (app/components/OnboardingTour.js) and the sales portal's
// eighteen-step induction (app/components/sales/SalesTour.js) — and they had
// nothing in common but the idea. One drew a dimmed page with a ring and a
// card beside the thing it was describing; the other drew a panel in the
// bottom-left corner. The owner looked at the sales one and said, correctly,
// that it did not look like the tours we already offer to companies.
//
// The fix is not to restyle the second one to match the first by eye. It is to
// put the part that decides WHERE THINGS GO in one place, so the two cannot
// drift again — AGENTS.md failure class #4, and the copy nobody looks at is
// the one that rots.
//
// ══ The placement rule, and the phone bug behind it ═══════════════════════
//
// Below the target when there is room, above when there is not, clamped inside
// the viewport either way. The version this was lifted from always went below
// and clamped to `innerHeight - 180`, which on a phone put the card ON TOP of
// the thing it was describing whenever the target sat low on the screen.
//
// cardPosition() is PURE — rect and viewport in, style out — so
// scripts/check-tour-anchor.mjs can drive a card against the bottom of a
// 667px phone without a browser. The DOM helpers below it cannot be pure and
// are kept separate for that reason.

/** Matches OnboardingTour's w-72 card. */
export const CARD_WIDTH = 288;
/** A card's typical height, used to decide above-or-below before it renders. */
export const CARD_HEIGHT_ESTIMATE = 190;
export const MARGIN = 12;

/**
 * Where to put the card.
 *
 * @param rect      the target's bounding rect, or null when there is nothing
 *                  to point at — then the card is centred, which is the honest
 *                  rendering of "this step is about the page, not a control".
 * @param viewport  { width, height }
 * @returns `{ style, centred, placement }`. `style` holds ONLY top/left/width,
 *          all numbers, all inside the viewport — the metadata is kept out of
 *          it because a style object carrying `centred` makes React warn about
 *          an unsupported property on every render, and a warning nobody reads
 *          is how a real one gets missed. Never NaN: a NaN in `top` renders the
 *          card at 0 and looks like the tour broke.
 */
export function cardPosition(rect, viewport, {
  cardWidth = CARD_WIDTH,
  cardHeight = CARD_HEIGHT_ESTIMATE,
  margin = MARGIN,
} = {}) {
  const vw = Number(viewport?.width) || 0;
  const vh = Number(viewport?.height) || 0;
  const width = Math.max(0, Math.min(cardWidth, vw - margin * 2));

  if (!rect || !Number.isFinite(rect.top) || !Number.isFinite(rect.left)) {
    return {
      style: {
        top: Math.max(margin, (vh - cardHeight) / 2),
        left: Math.max(margin, (vw - width) / 2),
        width,
      },
      centred: true,
      placement: "centre",
    };
  }

  const below = vh - rect.bottom;
  const wantsBelow = below > cardHeight + margin;
  const rawTop = wantsBelow ? rect.bottom + margin : rect.top - cardHeight - margin;

  // Clamped twice on purpose. The inner Math.max keeps a card off the top edge;
  // the outer Math.min keeps it off the bottom. On a viewport shorter than the
  // card itself the two fight, and margin wins — a card half off the bottom is
  // worse than one half off the top, because the buttons are at the bottom.
  const top = Math.min(Math.max(margin, rawTop), Math.max(margin, vh - cardHeight - margin));
  const left = Math.min(Math.max(margin, rect.left), Math.max(margin, vw - width - margin));

  return { style: { top, left, width }, centred: false, placement: wantsBelow ? "below" : "above" };
}

/**
 * The ring, and the dim.
 *
 * One element does both: a huge spread box-shadow darkens everything outside
 * the ring. Stacking a separate dimmer over it makes the page twice as dark on
 * exactly the steps that work, which is how the first version of this looked
 * broken only when it was working.
 */
export function spotlightStyle(rect, { pad = 6, dim = 0.55 } = {}) {
  if (!rect) return null;
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    boxShadow: `0 0 0 9999px rgba(0,0,0,${dim})`,
  };
}

/**
 * The first match that is actually on screen.
 *
 * `display:none` gives a zero-size rect, which is how a responsive layout that
 * renders both a desktop and a mobile copy of the same thing is told apart
 * without this module needing to know a breakpoint. A plain querySelector
 * returns the hidden desktop copy on a phone and the tour rings the corner of
 * the screen.
 */
export function visibleTarget(selector) {
  if (!selector || typeof document === "undefined") return null;
  for (const el of document.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * Poll for a target that is about to appear — a drawer animating open, or a
 * route that has not finished rendering.
 *
 * One frame is not enough to conclude there is nothing to point at: the
 * stylesheet may not have applied (so `hidden lg:flex` has no display:none and
 * everything measures visible), and a backgrounded tab does not paint at all.
 */
export function waitForTarget(selector, timeoutMs = 1200) {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(null);
    const started = Date.now();
    const tick = () => {
      const el = visibleTarget(selector);
      if (el) return resolve(el);
      if (Date.now() - started > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}
