// lib/pricing/promotionStatus.js
//
// "Is this promotion on?" has three wrong answers and one right one.
//
// The switch (`active`) and the dates are independent, so a row can be:
//
//   · switched on and running                → money is going out the door now
//   · switched on and not started yet        → scheduled, nothing is happening
//   · switched on and past its end date      → OVER, despite the green toggle
//   · switched off                           → off, whatever the dates say
//
// An operator looking at a list of toggles cannot tell the middle two apart
// from the first, and both of them look exactly like a live discount. The
// third is the dangerous one in the other direction: somebody sees "active",
// assumes the offer is still running, and quotes it to a customer it will no
// longer be applied to.
//
// ── Why promotionIsLive is asked rather than re-implemented ────────────────
//
// lib/pricing/ladder.js owns the rule and is covered by 59 assertions,
// including "dead ON the end date" and "the switch beats the date". This
// module asks it the yes/no question and only classifies the NO — so a change
// to the rule cannot leave a label saying something the pricing engine
// disagrees with.

import { promotionIsLive } from "@/lib/pricing/ladder";

/**
 * @returns {{ key, label, detail, tone }}
 *   key   — "running" | "scheduled" | "expired" | "off" | "invalid"
 *   tone  — "positive" | "info" | "warning" | "muted", for the caller's palette
 */
export function promotionStatus(promo, now = new Date()) {
  if (!promo) {
    return { key: "invalid", label: "Unknown", detail: "", tone: "muted" };
  }

  const t = new Date(now).getTime();
  const ends = promo.endsAt ? new Date(promo.endsAt).getTime() : NaN;
  const starts = promo.startsAt ? new Date(promo.startsAt).getTime() : null;

  // endsAt is required by the schema and by the create route, so a row without
  // a usable one is a data fault rather than a state. Named as such instead of
  // being folded into "off", where it would look like somebody's decision.
  if (!Number.isFinite(ends)) {
    return {
      key: "invalid",
      label: "No end date",
      detail:
        "This row has no usable end date, so it can never run. A discount " +
        "without an end is a price.",
      tone: "warning",
    };
  }

  if (promotionIsLive(promo, now)) {
    return {
      key: "running",
      label: "Running now",
      detail: `Applied to checkout until ${fmt(ends)}.`,
      tone: "positive",
    };
  }

  // From here it is NOT running. Which of the three reasons matters.
  if (promo.active !== true) {
    return {
      key: "off",
      label: "Switched off",
      detail:
        t >= ends
          ? `Off, and its end date passed on ${fmt(ends)}.`
          : `Off. Turning it on would run it until ${fmt(ends)}.`,
      tone: "muted",
    };
  }

  if (t >= ends) {
    return {
      key: "expired",
      label: "Expired — still switched on",
      detail:
        `Ended ${fmt(ends)} and is applying to nobody, but the switch is ` +
        "still on. Nothing is broken; the date wins.",
      tone: "warning",
    };
  }

  if (starts !== null && Number.isFinite(starts) && t < starts) {
    return {
      key: "scheduled",
      label: "Scheduled — not started",
      detail: `Starts ${fmt(starts)}, ends ${fmt(ends)}. No discount yet.`,
      tone: "info",
    };
  }

  // Switched on, inside its window, and promotionIsLive still said no. There
  // is no such case today; saying so plainly beats a label that guesses.
  return {
    key: "invalid",
    label: "Not applying",
    detail: "Switched on and inside its dates, but the pricing engine is not applying it.",
    tone: "warning",
  };
}

function fmt(ms) {
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
