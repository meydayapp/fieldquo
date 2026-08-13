// lib/estimate/visibility.js
//
// How much of an instant estimate a homeowner is allowed to see.
//
// ══ Why this is a per-trade choice, not a global one ═══════════════════════
//
// The owner picks. A cabinet shop with tidy per-unit maths is happy to flash a
// range on the screen ("$4,200–$5,500") because it converts. A GC whose jobs
// vary ten-fold refuses to, because a number a stranger screenshots is a number
// they'll be held to. FieldQuo can't decide that for them, so it's a setting on
// each enabled trade — and the default is the cautious one.
//
// ══ The server always computes; the PUBLIC only sometimes sees ═════════════
//
// This is the reconciliation with the non-negotiable that public endpoints
// never leak prices. The estimate IS computed server-side either way — it has
// to be, to build the draft quote a human reviews. What this file decides is
// what crosses back to the browser. "gated" means the homeowner gets a
// confirmation and a callback promise, never a figure. The rate card is never
// exposed in EITHER mode; only the finished range, and only when the owner
// chose to show it.
//
// Pure. Feed it a mode and an estimate; it returns what's safe to send.

/** The two modes, and the label the settings screen shows. */
export const ESTIMATE_VISIBILITY = {
  gated: {
    key: "gated",
    label: "Don't show a price",
    hint: "The homeowner submits and we tell them a quote is on the way. No number is shown.",
  },
  range: {
    key: "range",
    label: "Show an estimated range",
    hint: "The homeowner sees a range instantly (exact price confirmed after you review). Converts better; only for trades you can price sight-unseen.",
  },
};

// Cautious by default: a company opts INTO showing a number, it's never the
// thing that happens because nobody touched the setting.
export const DEFAULT_VISIBILITY = "gated";

/**
 * The mode for a trade, from its saved instant-quote config.
 *
 * Anything unrecognised (an old config, a typo, a missing key) resolves to the
 * cautious default rather than accidentally revealing a price the owner never
 * agreed to show.
 */
export function visibilityFor(config) {
  const v = config && typeof config === "object" ? config.estimateVisibility : null;
  return ESTIMATE_VISIBILITY[v] ? v : DEFAULT_VISIBILITY;
}

/**
 * What the browser is allowed to receive.
 *
 * @param estimate  { low, high } computed server-side (or null if it couldn't
 *                  be computed — a trade with no rates, missing measurements)
 * @param mode      "gated" | "range"
 * @returns {{ show: boolean, low?: number, high?: number, reason?: string }}
 *          On "range" with a real estimate: the numbers. Otherwise: show=false,
 *          and NEVER a partial or leaked figure.
 */
export function publicEstimate(estimate, mode) {
  const v = ESTIMATE_VISIBILITY[mode] ? mode : DEFAULT_VISIBILITY;

  if (v !== "range") {
    return { show: false, reason: "gated" };
  }

  // "range" was chosen, but there's nothing valid to show — a trade with no
  // rates, or a measurement that didn't resolve. Fall back to gated rather than
  // flashing "$0" or "$NaN – $undefined" at a homeowner.
  const low = Number(estimate?.low);
  const high = Number(estimate?.high);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high < low) {
    return { show: false, reason: "no_estimate" };
  }

  return { show: true, low: Math.round(low), high: Math.round(high) };
}

/**
 * A homeowner-facing sentence for the gated case, so the UI never just goes
 * blank. Language-aware because the whole client surface is.
 *
 * ── Why there are two stages ────────────────────────────────────────────────
 *
 * The same sentence was used in both halves of the instant-quote flow, and it
 * only fits one of them. Mid-flow — the homeowner has measured but not yet left
 * their name — "we'll be in touch shortly" is a promise to nobody, and it reads
 * as if the estimate silently failed. That is exactly what the owner reported:
 * a bare confirmation where a price should have been.
 *
 *   "prompt"    before contact details: say the price isn't shown here, and ask.
 *   "confirmed" after they've submitted: name the ABSENCE of the figure.
 *
 * The confirmed line deliberately doesn't repeat "we'll be in touch" — the
 * confirmation screen says that already, and a second copy of it left the empty
 * space where a price should be still unexplained. It sits where the range
 * would have been, so it has to answer the question that space raises.
 *
 * Neither ever contains a figure — that's publicEstimate's job, and it says no.
 */
export function gatedMessage(language = "en", stage = "confirmed") {
  const fr = language === "fr";
  if (stage === "prompt") {
    return fr
      ? "Nous ne publions pas nos prix en ligne pour ce service. Laissez-nous vos coordonnées et nous confirmerons votre prix sous peu."
      : "We don't show prices online for this service. Leave your details and we'll confirm your price shortly.";
  }
  return fr
    ? "Aucun prix n'est affiché ici : nous examinons chaque projet et vous envoyons votre soumission nous-mêmes."
    : "No price is shown here — we review every job and send your quote ourselves.";
}
