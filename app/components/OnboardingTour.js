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

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ArrowRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

const CARD_WIDTH = 288; // w-72
const MARGIN = 12;

/**
 * The first match that is actually on screen.
 *
 * `display:none` gives a zero-size rect, which is how a responsive layout that
 * renders both a desktop and a mobile copy of the same thing is told apart —
 * without this component needing to know a breakpoint.
 */
function visibleTarget(selector) {
  if (!selector) return null;
  for (const el of document.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** Poll for a target that's about to appear (a drawer animating open). */
function waitForTarget(selector, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = () => {
      const el = visibleTarget(selector);
      if (el) return resolve(el);
      if (performance.now() - started > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export default function OnboardingTour({ steps, storageKey, serverSeen = false, onFinish }) {
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

  // ── Should it open at all? ───────────────────────────────────────────────
  //
  // Requires a target that is genuinely visible, or one the step knows how to
  // reveal. A tour with nothing to point at doesn't open — better a missing
  // tour than a ring around the corner of the screen.
  useEffect(() => {
    if (serverSeen) return;
    if (localStorage.getItem(`tour_seen_${storageKey}`)) return;

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
      const el =
        (await waitForTarget(first.target, 600)) ||
        (first.openWith ? await waitForTarget(first.openWith, 300) : null);
      if (!cancelled && el) setActive(true);
    })();
    return () => { cancelled = true; };
  }, [storageKey, serverSeen, steps]);

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

      // Not on screen? Ask the step how to reveal it.
      if (!el && step.openWith) {
        visibleTarget(step.openWith)?.click();
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
    localStorage.setItem(`tour_seen_${storageKey}`, "true");
    setActive(false);
    // Put the page back the way it was. A tour that opens the nav drawer and
    // leaves it open has changed the app on its way out.
    if (steps?.some((s) => s.closeWith)) {
      for (const s of steps) {
        if (s.closeWith) visibleTarget(s.closeWith)?.click();
      }
    }
    onFinish?.();
  }, [storageKey, onFinish, steps]);

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
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const width = Math.min(CARD_WIDTH, vw - MARGIN * 2);

  let cardStyle;
  if (!rect) {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%,-50%)", width };
  } else {
    const below = vh - rect.bottom;
    const CARD_EST = 190;
    const top =
      below > CARD_EST + MARGIN
        ? rect.bottom + MARGIN
        : Math.max(MARGIN, rect.top - CARD_EST - MARGIN);
    cardStyle = {
      top: Math.min(Math.max(MARGIN, top), Math.max(MARGIN, vh - CARD_EST - MARGIN)),
      left: Math.min(Math.max(MARGIN, rect.left), Math.max(MARGIN, vw - width - MARGIN)),
      width,
    };
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={title}>
      {/* Only one dimmer. The ring's huge box-shadow IS the dim when there's a
          target — stacking a second one over it made the page twice as dark on
          the steps that worked. */}
      {!rect && <div className="absolute inset-0 bg-black/50" onClick={finish} />}

      {rect && (
        <div
          className="absolute border-2 border-white rounded-lg pointer-events-none transition-all duration-200"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      )}

      <div className="absolute bg-card rounded-xl p-4 shadow-xl" style={cardStyle}>
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
