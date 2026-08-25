// lib/embed/handoff.js
//
// Sending a visitor who is inside an embed to a page that refuses to be
// embedded.
//
// ── The failure this exists to stop ─────────────────────────────────────────
//
// Stripe Checkout is the case that forced it. Inside a cross-origin iframe the
// hosted checkout page loads, serves its own grey loading skeleton, and never
// finishes — verified against a real session: the same URL renders the card
// form in a tab and hangs at placeholders in a frame. So the ordinary
// `window.location.href = checkoutUrl` from a flow running in a contractor's
// website navigates the IFRAME, and the homeowner sits watching a dead
// rectangle with their slot held and their money not taken.
//
// ── Why this can't be one function that just works ──────────────────────────
//
// The whole tab has to move, and a framed page is only allowed to move the tab
// while it still has the user's click behind it (transient activation, a few
// seconds). Our hand-off happens after an await — a booking POST that geocodes
// an address and opens a Stripe session — so most of the time the activation
// is still live and the tab goes; sometimes it has expired and the browser
// refuses. It refuses SILENTLY: nothing throws, and there is no way to ask
// whether it worked.
//
// That is why navigateTop's return value is deliberately weak, and why every
// caller must also render a link the visitor can click. The click carries its
// own activation, so the link always works — it is the fallback that makes the
// automatic path safe to attempt.

export function isFramed() {
  if (typeof window === "undefined") return false;
  try {
    return window.top !== window.self;
  } catch {
    // Reading window.top can throw across origins, and only a framed page can
    // ever be in that position — so the throw is a yes, not an error.
    return true;
  }
}

/**
 * Try to send the whole tab to `url`.
 *
 * @returns true when the navigation was *started* — never a guarantee that it
 *          completed. A browser may refuse a framed page's top-level
 *          navigation without throwing, so callers must render a visible link
 *          as well and must not treat `true` as "the visitor has left".
 */
export function navigateTop(url) {
  if (typeof window === "undefined" || !url) return false;

  if (!isFramed()) {
    window.location.href = url;
    return true;
  }

  try {
    // Assigning to another window's location is allowed cross-origin; reading
    // it is not. Only the assignment is used here.
    window.top.location.href = url;
    return true;
  } catch {
    return false;
  }
}
