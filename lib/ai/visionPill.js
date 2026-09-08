// lib/ai/visionPill.js
//
// The "Paid" pill on the deep photo read, decided from the wallet and the
// day's history — and the classes it wears, measured.
//
// ── What it replaced ────────────────────────────────────────────────────────
//
// A 10px grey outline reading "Paid" beside "Deep photo read". Invisible by
// design, and it said nothing an estimator could act on: not what it costs,
// not whether the account can cover it, not whether it was already run this
// morning. The owner's ask — "green, orange or red, more visible, so they
// know" — is three facts, one colour each:
//
//   ready  amber   pressing the button spends real money, and it will work.
//   short  red     the AI balance cannot cover one read; the shortfall is
//                  the number they need, so it is in the pill.
//   done   green   a read already ran on this quote today. Its notes are on
//                  screen; nothing more is spent unless they run it again.
//
// The cost sits INSIDE the pill in every state, so "paid" and "how much" are
// one glance rather than a pill and a sentence three lines apart.
//
// ── Why the classes are solid fills, not the wash chips in lib/status/tone.js ─
//
// The tone chips are deliberately quiet — they mark routine states on money
// lists. This pill sits next to a button that debits a wallet, and quiet was
// the problem. Every pair below is a solid Tailwind fill with a solid text
// colour, so the ratio is the same in light and dark (no alpha over a themed
// card), and scripts/check-addon-descriptions.mjs measures each against the
// real oklch palette: amber-400/amber-950 8.7:1, red-700/white 6.4:1,
// green-800/white 7.1:1. AGENTS.md: contrast is measured, not guessed.

export const VISION_PILL_CLASSES = {
  ready: "bg-amber-400 text-amber-950",
  short: "bg-red-700 text-white",
  done: "bg-green-800 text-white",
};

/** Same calendar day in the viewer's local time. Local on purpose: "today"
 *  to the estimator is the day on their phone, not UTC's. */
function sameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * @param spend     GET /api/quotes/[id]/vision's `spend` verdict, or null when
 *                  it did not arrive (the panel loads without it)
 * @param passes    the quote's aiVisionPasses, newest first, each with `at`
 * @param costCents what one read costs — the constant the panel already shows
 * @param money     cents → the display string, injected so this stays pure
 * @param now       injected for the check
 * @returns { state: "ready" | "short" | "done", className, label }
 */
export function visionPillState({ spend = null, passes = [], costCents, money, now = new Date() }) {
  const fmt = (cents) => money(cents);
  const list = Array.isArray(passes) ? passes : [];

  // Done today wins over everything: the money is already spent and the
  // notes are on the screen. A short balance on top of that is still true,
  // but it is the button's problem (it refuses with the amount), not this
  // pill's — the pill reports what happened.
  const today = list.some((p) => {
    const t = p?.at ? new Date(p.at) : null;
    return t && !Number.isNaN(t.getTime()) && sameLocalDay(t, now);
  });
  if (today) {
    return {
      state: "done",
      className: VISION_PILL_CLASSES.done,
      label: `Paid · ${fmt(costCents)} · read today`,
    };
  }

  // Only a KNOWN refusal on money turns it red. An absent verdict (the fetch
  // failed, or an older server) and a feature withdrawal both fall through to
  // amber: the price is still the price, and red without a shortfall to name
  // would be a colour with no fact behind it.
  if (spend && spend.allowed === false && spend.reason === "insufficient_balance") {
    const need = Number(spend.needCents) || costCents;
    return {
      state: "short",
      className: VISION_PILL_CLASSES.short,
      label: `No credit · needs ${fmt(need)}`,
    };
  }

  return {
    state: "ready",
    className: VISION_PILL_CLASSES.ready,
    label: `Paid · ${fmt(costCents)}`,
  };
}
