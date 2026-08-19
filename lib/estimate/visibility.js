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

/** The three modes, and the label the settings screen shows. */
export const ESTIMATE_VISIBILITY = {
  gated: {
    key: "gated",
    label: "Don't show a price",
    hint: "The homeowner submits and we tell them a quote is on the way. No number is shown.",
  },
  after_submit: {
    key: "after_submit",
    label: "Show the range after they submit",
    hint: "The homeowner fills in the form to unlock their range. You get their details whether or not the number suits them — the usual pick.",
  },
  range: {
    key: "range",
    label: "Show an estimated range straight away",
    hint: "The range appears as soon as we can measure, before they leave any details. Only for trades you can price sight-unseen — and expect people to read the number and leave.",
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
 * Collapse a mode plus WHERE WE ARE IN THE FLOW down to what publicEstimate
 * understands.
 *
 * ══ Why the stage is resolved here and not inside publicEstimate ═══════════
 *
 * "after_submit" is the only mode whose answer depends on the moment it's
 * asked: hide before the homeowner leaves their details, show after. That could
 * have been a `stage` argument on publicEstimate with a default — and a default
 * is exactly the wrong shape for it. Default to "confirmed" and the public
 * /measure endpoint leaks the figure the mode exists to withhold, silently, for
 * every caller that forgets the argument. Default to "prompt" and the
 * confirmation email quietly stops showing a range the owner did choose to
 * show.
 *
 * So there is no default: a caller states which side of the submit it is on,
 * and gets back a mode with no ambiguity left in it. Nothing here can be
 * answered wrong by omission — only by writing the wrong word, which is
 * visible in the diff.
 *
 * @param mode   "gated" | "after_submit" | "range"
 * @param stage  "prompt"    — before contact details exist (the public form)
 *               "confirmed" — after they've submitted (result screen, email)
 * @returns "gated" | "range"
 */
export function effectiveVisibility(mode, stage) {
  const v = ESTIMATE_VISIBILITY[mode] ? mode : DEFAULT_VISIBILITY;
  if (v !== "after_submit") return v;
  return stage === "confirmed" ? "range" : "gated";
}

/**
 * What the browser is allowed to receive.
 *
 * Takes a RESOLVED mode — pass "after_submit" here and it is treated as gated,
 * because a figure withheld by mistake is recoverable and one revealed by
 * mistake is not. Callers run effectiveVisibility() first.
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

  // `minimumApplied` rides along because it explains the number rather than
  // adding to it: it is why one door and twenty doors can quote the same. A
  // boolean only — the floor itself is a rate and stays on the server.
  return {
    show: true,
    low: Math.round(low),
    high: Math.round(high),
    minimumApplied: Boolean(estimate?.minimumApplied),
  };
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
/**
 * The two lines shown over the locked estimate in "after_submit" mode.
 *
 * Deliberately NOT gatedMessage(): that one says "we don't show prices online
 * for this service", which in this mode is a lie — the price is shown, thirty
 * seconds later. A homeowner told there's no number stops filling in the form,
 * which is the opposite of what the mode is for. This says what unlocks it.
 */
export function lockedEstimateMessage(language = "en") {
  const fr = language === "fr";
  return {
    title: fr ? "Soumettez pour voir votre estimation" : "Submit to reveal your estimate",
    body: fr
      ? "Remplissez le formulaire — votre fourchette de prix s’affiche ici immédiatement et vous est envoyée par courriel."
      : "Fill in the form — your price range appears here instantly and lands in your inbox.",
    // The blurred stand-in. A LITERAL placeholder, never the real figure with a
    // CSS blur over it: a blur is a filter, not a secret, and anyone who opens
    // devtools reads the number the owner chose to withhold. The real low/high
    // are not sent to the browser at this stage at all — see the measure route.
    placeholder: "$X,XXX – $X,XXX",
  };
}

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
