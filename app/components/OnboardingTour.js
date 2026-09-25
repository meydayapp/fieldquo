// app/components/OnboardingTour.js
"use client";

// The first-visit walkthrough: a dimmed page, a ring around one thing, and a
// card explaining it.
//
// ══ Why this was broken on a phone ═════════════════════════════════════════
//
// The welcome tour points at sidebar items. On desktop the sidebar is always
// there; on mobile it's a drawer that starts closed. Two separate faults came
// out of that, and both produced the same symptom — a spotlight in the corner
// pointing at nothing.
//
//   1. The desktop sidebar is `hidden lg:flex`, which is `display:none`, NOT
//      unmounted. So `querySelector("[data-tour='nav-quotes']")` found it on a
//      phone, the "does the target exist?" guard passed, and the tour opened
//      against an element whose rect is {0,0,0,0}.
//
//   2. Even with the drawer open there are then TWO matches — the hidden
//      desktop copy and the visible drawer copy, both rendered from the same
//      SidebarContent — and `querySelector` returns the first, which is the
//      hidden one.
//
// So every lookup here goes through `visibleTarget`, which measures and skips
// anything with no box. That one change is what makes the tour honest about
// what it can actually point at; the drawer-opening below is what makes it
// useful.
//
// ══ Steps can ask for what they need ═══════════════════════════════════════
//
// A step may declare `openWith: "[data-tour-open='nav']"`. If the target isn't
// visible, the tour clicks that control and waits for the target to appear.
// Declared rather than guessed: clicking whatever happens to be nearby, on a
// page the user hasn't seen yet, is not a thing a tour should do.
//
// ══ It measures continuously, not once ═════════════════════════════════════
//
// The old version captured the rect immediately after calling scrollIntoView
// with `behavior: "smooth"` — so it measured the position BEFORE the scroll
// had happened, and never updated. Anchored to a sticky sidebar that looked
// fine, which is why it survived. Anything in page content drifted.

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { X, ArrowRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
// Placement, the ring and the target lookup moved to lib/tours/anchor.js so
// the sales portal's tour draws the same thing. They had nothing in common
// but the idea, and the owner noticed: the sales tour "doesn't look like the
// fieldquo.com/app tours that we are offering to companies". Restyling one to
// match the other by eye would have left two implementations to drift apart
// again — this is the part that keeps them the same.
import {
  cardPosition,
  spotlightStyle,
  visibleTarget,
  waitForTarget,
  CARD_WIDTH,
  CARD_HEIGHT_ESTIMATE,
  MARGIN,
} from "@/lib/tours/anchor";




// ══ Openers are a LIST, tried in order, and undone only if used ═══════════
//
// The 2026-09-24 shell has rows the walkthrough visits inside groups the
// reader can fold (People, Grow), and on a phone those groups are inside the
// drawer. So one target can need two things done first: open the drawer, then
// unfold the group. `openWith` may be a string or an array; each opener is
// clicked only while the target is still not on screen, and only if the
// opener itself is on screen (the hamburger is display:none on a desktop, so
// it is skipped there without a special case).
//
// `closeWith[i]` pairs with `openWith[i]`, and is clicked on the way out ONLY
// for openers this tour actually clicked. That matters for a group header,
// which is a toggle: the old rule — click every step's closeWith at the end —
// would FOLD a group the reader had open all along. The drawer's X was safe
// under the old rule by accident (it is off screen when the drawer is shut);
// a toggle is not.
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

export default function OnboardingTour({ steps, storageKey, serverSeen = false, onFinish, force = false }) {
  // Resolved HERE, not baked into tours.js. That module is plain data with no
  // React tree — see its own header — so this is the first point in the
  // render path where a language is actually known. Every step's title/body
  // is a key (step.titleKey / step.bodyKey) into app.tour.* in
  // app/i18n/appMessages.js; t() falls back to English on a missing
  // translation rather than printing the raw key, same as everywhere else.
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const finished = useRef(false);
  // Closers owed, in the order their openers were clicked — see asList above.
  const owed = useRef([]);
  // The card's REAL height once drawn. cardPosition decides above-or-below
  // from a height, and the 190px estimate is a two-line body; the 2026-09-24
  // welcome tour's Settings step (a four-line body in English, longer in
  // German) measured 232px, so a card placed ABOVE the Settings row at the
  // foot of the rail covered the top of the very row it was ringing —
  // measured in the harness, not guessed. The estimate places the first
  // frame; the measurement corrects it before paint.
  const cardRef = useRef(null);
  const [cardHeight, setCardHeight] = useState(CARD_HEIGHT_ESTIMATE);

  // ── Should it open at all? ───────────────────────────────────────────────
  //
  // Requires a target that is genuinely visible, or one the step knows how to
  // reveal. A tour with nothing to point at doesn't open — better a missing
  // tour than a ring around the corner of the screen.
  //
  // `force` is "Take the tour" on the dashboard (AppTours' startTour): the
  // reader asked for it, so a tour already seen — server-side or in this
  // browser — runs again. The target check still applies.
  useEffect(() => {
    if (serverSeen && !force) return;
    if (!force) {
      try {
        if (localStorage.getItem(`tour_seen_${storageKey}`)) return;
      } catch {
        // Storage refused (private mode): the server's seen-list still gates.
      }
    }

    const first = steps?.[0];
    if (!first?.target) return;

    // Polled for a few hundred ms rather than checked on a single frame.
    //
    // One frame is not enough to conclude there's nothing to point at: the
    // stylesheet may not have applied yet (in which case `hidden lg:flex` has
    // no display:none and EVERYTHING measures visible), a drawer button may
    // mount on hydration, and a backgrounded tab doesn't paint at all. Giving
    // up after one frame turns any of those into a tour that silently never
    // runs.
    let cancelled = false;
    (async () => {
      let el = await waitForTarget(first.target, 600);
      for (const opener of asList(first.openWith)) {
        if (el) break;
        el = await waitForTarget(opener, 300);
      }
      if (!cancelled && el) setActive(true);
    })();
    return () => { cancelled = true; };
  }, [storageKey, serverSeen, steps, force]);

  // ── Reveal, scroll to, and measure the current step's target ─────────────
  const step = steps?.[stepIndex];

  const measure = useCallback(() => {
    const el = visibleTarget(step?.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step?.target]);

  useEffect(() => {
    if (!active || !step) return;
    let cancelled = false;
    setReady(false);

    (async () => {
      let el = visibleTarget(step.target);

      // Not on screen? Ask the step how to reveal it — each opener in turn,
      // stopping as soon as the target shows. The short wait on the opener is
      // for one that is itself arriving: a group header inside a drawer that
      // is still sliding in.
      const openers = asList(step.openWith);
      const closers = asList(step.closeWith);
      for (let i = 0; i < openers.length && !el; i++) {
        const opener = visibleTarget(openers[i]) || (i > 0 ? await waitForTarget(openers[i], 400) : null);
        if (cancelled) return;
        if (!opener) continue;
        opener.click();
        if (closers[i] && !owed.current.includes(closers[i])) owed.current.push(closers[i]);
        el = await waitForTarget(step.target);
      }
      if (cancelled) return;

      if (el) {
        // Measure NOW, then again once any scrolling settles.
        //
        // Both, not one or the other. The old code measured only immediately
        // and captured the pre-scroll position; measuring only after the
        // settle left the ring sitting on the PREVIOUS step's target for the
        // whole delay — visible, and measured at ~420ms on a phone. The
        // immediate pass is right whenever nothing needs to scroll, which is
        // most steps, and the settle pass corrects the rest.
        measure();
        setReady(true);

        el.scrollIntoView({ behavior: "smooth", block: "center" });

        // `scrollend` isn't in every browser we support, so a settle timer
        // backs it up. Re-measuring when nothing moved is a no-op.
        const settle = () => { if (!cancelled) measure(); };
        window.addEventListener("scrollend", settle, { once: true });
        setTimeout(settle, 420);
      } else {
        // The anchor genuinely isn't there — a page that changed, a feature
        // this company doesn't have. Skip to the next step rather than
        // spotlighting nothing.
        if (stepIndex + 1 < steps.length) setStepIndex((i) => i + 1);
        else finish();
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex, step?.target, measure]);

  // Keep the ring on the thing it's ringing. Scroll is captured because the
  // target may live inside its own scrolling container (the drawer does).
  useEffect(() => {
    if (!active || !ready) return;
    const onChange = () => measure();
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, [active, ready, measure]);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    try {
      localStorage.setItem(`tour_seen_${storageKey}`, "true");
    } catch {
      // Storage refused: onFinish still records it server-side.
    }
    setActive(false);
    // Put the page back the way it was. A tour that opens the nav drawer and
    // leaves it open has changed the app on its way out. Innermost first — a
    // group header inside the drawer has to be folded back while the drawer
    // is still open to click it.
    for (const closer of [...owed.current].reverse()) visibleTarget(closer)?.click();
    owed.current = [];
    onFinish?.();
  }, [onFinish, storageKey]);

  // Escape closes it. Standard for anything covering the page, and on a phone
  // it's the hardware back gesture's nearest equivalent for keyboard users.
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex, finish]);

  function next() {
    if (stepIndex + 1 < steps.length) setStepIndex((i) => i + 1);
    else finish();
  }

  // Before paint, after every render that could change the card's height
  // (a new step's copy, a language, a resize that rewraps it). Only a real
  // change sets state, so this settles in one extra render.
  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight;
    if (h && Math.abs(h - cardHeight) > 1) setCardHeight(h);
  });

  if (!active || !step) return null;

  // Resolved once per render rather than inline at each use, so the JSX below
  // reads step.title/step.body the same way it did before this was
  // translated — the diff that matters is here, not scattered through markup.
  const title = t(step.titleKey);
  const body = t(step.bodyKey);

  // ── Where the card goes ──────────────────────────────────────────────────
  //
  // Below the target when there's room, above when there isn't, and clamped
  // inside the viewport either way. The old version always went below and
  // clamped to `innerHeight - 180`, which on a phone put the card ON TOP of
  // the thing it was describing whenever the target sat low on the screen.
  const { style: cardStyle } = cardPosition(
    rect,
    {
      width: typeof window !== "undefined" ? window.innerWidth : 0,
      height: typeof window !== "undefined" ? window.innerHeight : 0,
    },
    { cardWidth: CARD_WIDTH, cardHeight, margin: MARGIN },
  );

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={title}>
      {/* Only one dimmer. The ring's huge box-shadow IS the dim when there's a
          target — stacking a second one over it made the page twice as dark on
          the steps that worked. */}
      {!rect && <div className="absolute inset-0 bg-black/50" onClick={finish} />}

      {rect && (
        <div
          className="absolute border-2 border-white rounded-lg pointer-events-none transition-all duration-200"
          style={spotlightStyle(rect)}
        />
      )}

      <div ref={cardRef} className="absolute bg-card rounded-xl p-4 shadow-xl" style={cardStyle}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">
            {t("app.tour.stepCount", "{n} of {total}", { n: stepIndex + 1, total: steps.length })}
          </span>
          <button
            type="button"
            onClick={finish}
            aria-label={t("app.action.close", "Close")}
            // 44px hit area. It was a bare 14px icon, which on a phone is a
            // target you stab at three times.
            className="p-2 -m-2 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
        <h4 className="font-semibold text-foreground text-sm">{title}</h4>
        <p className="text-sm text-muted-foreground mt-1">{body}</p>
        <div className="flex items-center gap-2 mt-3">
          {stepIndex + 1 < steps.length && (
            <button
              type="button"
              onClick={finish}
              className="px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground"
            >
              {t("app.tour.skip", "Skip")}
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="flex-1 bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
          >
            {stepIndex + 1 < steps.length ? t("app.action.next", "Next") : t("app.action.done", "Done")}
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
