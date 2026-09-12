// lib/toast.js
//
// The one door to the one toast layer.
//
// Three staff surfaces (/app, /sales, /platform) had three answers to "tell
// the person something in passing": /app had ErrorToast, listening for
// showError(); the sales queue drew its own top-up toast inline, at the same
// bottom offset and z-index as the tour's launcher pill, which covered it;
// and /platform and the rest of /sales called showError() into a room with
// nobody in it — no layer was mounted there, so every reportResponseError on
// those surfaces reported to nobody. (Found while reproducing the owner's
// "the notification pop-ups are half hidden".)
//
// Now: one event, one listener — app/components/ToastLayer.js, mounted once
// per surface, rendered through a portal at document.body so no sidebar,
// drawer, sticky header or overflow rule in the shell can clip it. This
// module is the client-side bus; it has no React in it so a plain handler
// anywhere can call it, and so a check script can import it.

export const TOAST_EVENT = "fieldquo:toast";

/** Tones the layer knows how to draw. Anything else renders as `info`. */
export const TOAST_TONES = ["info", "success", "error"];

/** How long a toast stays, by tone. Errors stay longer: one that is blinked
 *  past is barely better than none (the reasoning ErrorToast carried). */
export const TOAST_DURATION_MS = { info: 6000, success: 6000, error: 8000 };

/**
 * Show a toast. Safe to call from anywhere client-side; a no-op on the server
 * and when there is nothing to say.
 *
 *   showToast({ message: "Added 25 leads", tone: "success" });
 *   showToast({ message: "New text from +1 555…", href: "/sales/messages", tag: "sms:abc" });
 *
 * `tag` dedupes: a second toast with the same tag REPLACES the first rather
 * than stacking beside it — the service worker's "a push arrived while you
 * were looking" and the page's own poll can both announce the same message.
 * `href` makes the toast a link: clicking it navigates AND dismisses.
 */
export function showToast({ message, tone = "info", href = null, tag = null, duration = null } = {}) {
  if (typeof window === "undefined" || !message) return;
  const safeTone = TOAST_TONES.includes(tone) ? tone : "info";
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, {
      detail: {
        message: String(message),
        tone: safeTone,
        href: href ? String(href) : null,
        tag: tag ? String(tag) : null,
        duration: Number.isFinite(duration) && duration > 0 ? duration : TOAST_DURATION_MS[safeTone],
      },
    }),
  );
}
