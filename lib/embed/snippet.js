// lib/embed/snippet.js
//
// The copy-paste snippet for every FieldQuo embed, in one place.
//
// ── Why a helper for a string ──────────────────────────────────────────────
//
// There were two copies of it — Settings → Lead Capture Form built the booking
// and quote snippets, Settings → Website → Fine-tune built the reviews one —
// and the reviews snippet now has to appear on Settings → Reviews as well, for
// the contractor who has their own website and will never build a FieldQuo
// one. A third copy of a string that is pasted into someone else's site, where
// nobody at FieldQuo will ever look at it, is the copy that rots.
//
// ── Pure on purpose ────────────────────────────────────────────────────────
//
// No imports, no `t()`, no window. The interesting failures here are string
// failures — a quote in a translated title, a slug with a slash in it, an
// origin that never arrived — and every one can be provoked in a throwaway
// script. Callers pass the already-translated title in.

/**
 * Starting heights, per widget.
 *
 * These are what the box measures before the listener has resized it — so they
 * are also what a contractor whose CMS strips the <script> is left with
 * forever. That is why none of them is 0.
 *
 * The forms are tall because they are tall: a booking flow on step three fills
 * more than 640px, but 640 shows enough of it that a visitor can tell what it
 * is and scroll. Reviews get 220 — roughly one card — rather than 0, because
 * the reviews embed renders nothing when there are no reviews and 0 would look
 * tidier in that one case while leaving a script-stripped page with reviews
 * rendering into an invisible box. A snippet that appears to work and doesn't
 * is the worse failure of the two.
 */
export const EMBED_HEIGHTS = { book: 640, quote: 640, reviews: 220 };

/** The widgets /embed/[companySlug]/[widget] will actually serve. */
export const EMBED_WIDGETS = Object.keys(EMBED_HEIGHTS);

// The title lands in an HTML attribute and comes from the translation files,
// where an apostrophe or a quotation mark is an ordinary thing to write.
const attr = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * @param origin  the FieldQuo origin, from window.location.origin. Empty until
 *                the component has mounted, which is why "" is a valid answer
 *                below rather than a thrown error.
 * @param slug    company.bookingSlug || company.slug — the same pair
 *                lib/booking/findBookingCompany.js resolves at the other end.
 * @param widget  one of EMBED_WIDGETS.
 * @param title   the iframe's accessible name, already translated.
 * @returns the snippet, or "" when there isn't enough to build a working one.
 *          Callers render nothing rather than a snippet with a hole in it.
 */
export function embedSnippet({ origin, slug, widget, title } = {}) {
  if (!origin || !slug) return "";
  if (!Object.hasOwn(EMBED_HEIGHTS, widget)) return "";
  // An origin carrying a quote or a tag would break out of both the attribute
  // and the JS string below. window.location.origin cannot produce one; this
  // is here so that stays true if a caller ever passes something else.
  if (/["'<>\s]/.test(origin)) return "";

  const id = `fieldquo-${widget}`;
  const src = `${origin}/embed/${encodeURIComponent(slug)}/${widget}`;

  // ── The listener is the half that makes an embed usable ──────────────────
  //
  // Without it the iframe keeps the height above, and a visitor who completes
  // a booking sees the confirmation render below the fold of a box that
  // doesn't scroll with the page. From where they're sitting nothing happened.
  //
  // Two checks, both load-bearing:
  //
  //   e.origin  — without it any framed page on the host's site could resize
  //               this iframe by posting the same message shape.
  //   e.source  — the height message is broadcast to the whole parent window,
  //               so with only the origin check every FieldQuo embed on the
  //               page adopts every other one's height. That used to be
  //               theoretical; putting the reviews snippet on the reviews
  //               screen makes "reviews plus a quote form on one page" the
  //               ordinary case. Comparing against the frame's own
  //               contentWindow is exact, and works for two of the same widget
  //               as well. Reading .contentWindow across origins is allowed —
  //               it yields an opaque proxy, and identity is all this needs.
  return `<iframe id="${id}" src="${src}" width="100%" height="${EMBED_HEIGHTS[widget]}" style="border:none;" title="${attr(title)}"></iframe>
<script>
window.addEventListener("message", function (e) {
  if (e.origin !== "${origin}") return;
  if (!e.data || e.data.type !== "fieldquo:embed-height") return;
  var f = document.getElementById("${id}");
  if (f && f.contentWindow === e.source) f.style.height = e.data.height + "px";
});
</script>`;
}
