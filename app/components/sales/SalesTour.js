"use client";

// app/components/sales/SalesTour.js
//
// The guided tour of the sales portal: one panel, eighteen things a new rep
// has to understand, and a ring around the tab each one is about.
//
// ══ Why this is not app/components/OnboardingTour.js ══════════════════════
//
// That component exists and is good, and reusing it was the first thing tried.
// It cannot do this job, for a reason that is structural rather than cosmetic:
// it is a SINGLE-PAGE spotlight. Every step targets a `data-tour` anchor on
// the page the tour opened on, it keeps its position in React state, and it
// records only "seen" in localStorage — so navigating anywhere unmounts it and
// loses the position. The sales tour walks a rep across twelve routes, and the
// walking is the point: a step about the queue that cannot take you to the
// queue is a paragraph, not a tour.
//
// Its "skip a step whose anchor is missing" behaviour is also wrong here, and
// wrong in an interesting way. On a first-run tour of the contractor app a
// missing anchor usually means a feature that company does not have, and
// skipping is kind. Here a missing anchor would mean the tour is describing a
// portal that no longer exists — and silently skipping is precisely how nobody
// finds out. So the targets are checked at BUILD time by
// scripts/check-sales-tour.mjs instead, against app/sales/SalesShell.js's own
// tab list, and this component never quietly drops a step.
//
// ══ Why it is a dock and not a modal ══════════════════════════════════════
//
// No `aria-modal`, no focus trap, no dimmer. A rep is meant to click the tab
// the panel is talking about and look at the real screen underneath while the
// panel keeps its place — that IS the tour. A modal would make the portal
// unusable for the duration and turn eighteen steps into eighteen dismissals.
// It is a labelled region with a live announcement instead, which is the right
// pattern for a persistent helper.
//
// z-[60] for the card and the ring, one below IncomingCallDock's z-[70], and
// that ordering is deliberate: a contractor ringing back is the most important
// thing that can happen to a rep, and it must cover the walkthrough rather than
// fight it for the bottom of a phone screen. Above SalesMobileTabBar's drawer
// (z-50) on purpose — a step whose tab lives in that drawer opens it and rings
// the row, and a card underneath the drawer would be a card nobody could read.
// The launcher pill stays at z-40, level with the bars.
//
// ══ Pinned to the thing, then to the way there ════════════════════════════
//
// Each step names a `target` — a data-tour attribute on the control or section
// it is about, on its own page (app/sales/tourSteps.js). When the rep is on
// that page the ring goes round the target. When they are not, it goes round
// the tab that would take them there: the header tab from lg up; below lg the
// bottom-bar tab, or the drawer row, which the step's `openWith` opens first
// and `closeWith` puts back when the step moves on. Same mechanism the
// contractor app's OnboardingTour uses for AdminSidebar's drawer; the
// selectors differ, the idea does not.
//
// ══ Resumable, and dismissible, and those are different ═══════════════════
//
// Closing the panel saves the step and offers to resume. Dismissing sets
// `dismissedAt` and the launcher stays quiet for good. Both live on the server
// against the rep (lib/sales/tourProgress.js) rather than in localStorage,
// because a rep who starts the tour on the laptop and finishes it on the phone
// in the van is the normal case, not the exception — and because localStorage
// on this origin is shared with the marketing site, which is how the portal
// once came up in German (app/sales/layout.js's header records that incident).
//
// ══ Every string is a key ═════════════════════════════════════════════════
//
// The owner's ask was a tour "in the language they select when they create the
// account". app/sales/layout.js hands LanguageProvider the rep's stated
// language, so t() here resolves in it. Not one English literal below reaches
// the screen — scripts/check-sales-tour.mjs reads this file with its comments
// stripped and fails on any user-facing literal, because the way this promise
// breaks is one hurried string, not a decision to abandon it.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
// The placement, the ring and the dim all come from lib/tours/anchor.js, which
// the contractor app's OnboardingTour uses too. The owner's complaint was that
// this tour "doesn't look like the fieldquo.com/app tours that we are offering
// to companies" — and the reason it did not is that it had its own presentation.
// Restyling it to match by eye would have left two implementations to drift
// apart again; sharing the module is what actually keeps them the same.
import { cardPosition, spotlightStyle, visibleTarget, waitForTarget } from "@/lib/tours/anchor";

/** Per browser session, so closing it once does not reopen it on every route. */
const FIRST_RUN_KEY = "fieldquo.salesTour.offered";
import { SALES_TOUR_STEPS, clampTourStep } from "@/app/sales/tourSteps";

/**
 * How much of the bottom of the viewport SalesMobileTabBar occupies right now.
 *
 * Measured from the bar itself rather than read from the CSS variable, because
 * the variable is calc() over env() and getComputedStyle hands it back
 * unresolved. 0 from lg up, where the bar renders with display:none and
 * measures 0 tall.
 */
function tabBarHeight() {
  if (typeof document === "undefined") return 0;
  const bar = document.querySelector("[data-sales-tabbar]");
  return bar ? bar.getBoundingClientRect().height : 0;
}

/** Does this person want movement? Asked, not assumed. */
function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function SalesTour() {
  const { t } = useTranslation();

  // null while the first read is in flight, and while it is null NOTHING
  // renders. A launcher that flashes on and then disappears once the server
  // says "dismissed" is worse than one that arrives a beat late.
  const [progress, setProgress] = useState(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  // A save that failed is SAID, not swallowed. `if (res.ok)` with no else is
  // AGENTS.md failure class #2, and the consequence here is specific: the rep
  // comes back tomorrow to a tour that forgot where they were.
  const [saveFailed, setSaveFailed] = useState(false);
  const [rect, setRect] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchJson("/api/sales/tour");
        if (!cancelled) {
          setProgress(data);
          setStep(clampTourStep(data?.step));
          // ── Open it, the first time ────────────────────────────────────
          //
          // It used to wait to be found, as a pill in the bottom-left corner
          // of a 1349px screen. The owner could not find it and neither could
          // I — a first-run tour that has to be discovered is not a first-run
          // tour, it is a button.
          //
          // Once per browser session, and only for somebody who has never
          // moved off step 0 and has not dismissed it. The session flag is
          // what stops it reopening on every route change for a rep who closed
          // it without dismissing: "I closed it" and "make it stop forever"
          // are different requests, and the second one is the Dismiss button.
          const untouched = !data?.dismissed && !data?.completed && !data?.step;
          let alreadyOffered = true;
          try {
            alreadyOffered = sessionStorage.getItem(FIRST_RUN_KEY) === "1";
          } catch {
            // Private mode, or storage blocked. Falling back to "already
            // offered" means it does not auto-open — the wrong way round for
            // discoverability, the right way round for not reopening on every
            // navigation in the one environment that cannot remember it was
            // closed. The launcher is still there.
          }
          if (untouched && !alreadyOffered) {
            try {
              sessionStorage.setItem(FIRST_RUN_KEY, "1");
            } catch {
              /* see above */
            }
            setOpen(true);
          }
        }
      } catch {
        // The portal is not broken because a walkthrough could not load, and a
        // red banner over a rep's morning would say it was. Staying null means
        // no launcher and no panel — the one honest silent failure in here,
        // because there is nothing the rep could do about it and nothing they
        // lose by not being offered a tour this minute.
        if (!cancelled) setProgress(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = SALES_TOUR_STEPS[clampTourStep(step)];
  const total = SALES_TOUR_STEPS.length;
  const isLast = step >= total - 1;

  // ── The ring around the thing this step is about ───────────────────────
  //
  // Measured rather than styled onto the element: the pages own those
  // elements' className and re-render them freely, so a class added from here
  // would be wiped the moment the rep followed the link the panel just gave
  // them.
  //
  // Nothing found draws no ring and changes nothing else. That is not the
  // "silently skip" behaviour this file's header rejects — the step, its words
  // and its link are all still there; only the decoration is missing, and
  // scripts/check-sales-mobile.mjs is what guarantees each target and each
  // tab anchor is really in the page source.
  const anchorFor = useCallback((step) => {
    if (!step) return null;
    // The thing itself, when the rep is on its page.
    if (step.target) {
      const el = visibleTarget(step.target);
      if (el) return el;
    }
    // Otherwise the way there — whichever copy of the tab is on screen.
    return visibleTarget(`[data-sales-tour="${step.href}"]`);
  }, []);

  const measure = useCallback(() => {
    if (!open || !current) return setRect(null);
    const el = anchorFor(current);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [open, current, anchorFor]);

  // Whether THIS component opened the drawer for the current step, so it is
  // the one that closes it. A drawer the rep opened themselves is left alone.
  const openedDrawer = useRef(false);

  useEffect(() => {
    if (!open || !current) return undefined;
    let cancelled = false;

    (async () => {
      let el = anchorFor(current);

      // Neither the target nor the tab is on screen. If the step knows how to
      // reveal its tab — a drawer row below lg — open it and wait for the row.
      if (!el && current.openWith) {
        const opener = visibleTarget(current.openWith);
        if (opener) {
          opener.click();
          openedDrawer.current = true;
          el = await waitForTarget(`[data-sales-tour="${current.href}"]`);
        }
      }
      if (cancelled) return;

      measure();
      // `auto`, not `smooth`, for anybody who asked for less movement. The
      // scroll still happens — they still need to see it — it just does not
      // animate.
      el?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "nearest",
        inline: "nearest",
      });
      // Measure again once any scrolling settles; measuring only once
      // captured the pre-scroll position.
      setTimeout(() => {
        if (!cancelled) measure();
      }, 420);
    })();

    const onChange = () => measure();
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      // Put the drawer back on the way out of a step that opened it. A tour
      // that opens the nav and leaves it open has changed the portal on its
      // way through.
      if (openedDrawer.current) {
        openedDrawer.current = false;
        visibleTarget(current.closeWith)?.click();
      }
    };
  }, [open, current, anchorFor, measure]);

  /**
   * Write the position back.
   *
   * Optimistic on screen and honest about the write: the panel moves at once
   * because a Next button that waits on a round trip feels broken, and a failed
   * save raises the notice above rather than being dropped.
   */
  const save = useCallback(async (nextStep, dismissed) => {
    try {
      const body = { step: nextStep };
      if (dismissed !== undefined) body.dismissed = dismissed;
      const data = await fetchJson("/api/sales/tour", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setProgress(data);
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, []);

  const go = useCallback(
    (to) => {
      const next = clampTourStep(to);
      setStep(next);
      save(next);
    },
    [save],
  );

  /** Close, keep the place. The launcher will offer to resume. */
  const close = useCallback(() => {
    setOpen(false);
    save(step);
  }, [save, step]);

  /** Stop offering it. Sets dismissedAt; deletes nothing. */
  const dismiss = useCallback(() => {
    setOpen(false);
    setProgress((p) => (p ? { ...p, dismissed: true } : p));
    save(step, true);
  }, [save, step]);

  // ── Keyboard ────────────────────────────────────────────────────────────
  //
  // Bound to the panel, not to the window. A global arrow-key listener would
  // steal the arrow keys from every text box on the screen underneath — and
  // this panel is meant to sit open WHILE a rep types a note.
  function onPanelKeyDown(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    // Not when the focus is in something that uses arrows itself.
    const tag = e.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (!isLast) go(step + 1);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (step > 0) go(step - 1);
    }
  }

  if (!progress) return null;

  // ── The launcher ────────────────────────────────────────────────────────
  //
  // Two words apart: "take" it if they have never moved, "resume" it if they
  // have. The second is the whole reason the step is stored — a rep who left
  // off at the calling window should be told that, not offered the beginning
  // again. Gone entirely once dismissed.
  if (!open) {
    if (progress.dismissed) return null;
    const started = progress.step > 0 || progress.completed;
    return (
      // bottom: the tab bar's height plus a gap, through the variable
      // app/globals.css declares — 0 from lg up, the bar's row plus the
      // safe-area inset below it. A pill at bottom-4 sat under the bar.
      <div className="fixed bottom-[calc(var(--fq-tab-bar-height)+1rem)] left-4 z-40 max-w-[calc(100vw-2rem)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-full bg-card border border-border shadow-lg text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors motion-reduce:transition-none"
        >
          <Compass size={16} className="text-brand-accent-text shrink-0" />
          {started
            ? t("app.salesTour.resume", { n: progress.step + 1, total })
            : t("app.salesTour.launch")}
        </button>
      </div>
    );
  }

  // Beside the thing it describes, not in the corner. Falls back to the middle
  // of the screen only when neither the target nor any copy of the tab is on
  // screen — the honest rendering of "nothing here to point at".
  //
  // The viewport handed to cardPosition stops at the top of the bottom tab
  // bar when one is on screen, so the card's clamp keeps it above the bar
  // rather than behind it — the same phone bug lib/tours/anchor.js was written
  // to end, one row higher.
  const { style: anchored } = cardPosition(
    rect,
    {
      width: typeof window === "undefined" ? 0 : window.innerWidth,
      height: typeof window === "undefined" ? 0 : window.innerHeight - tabBarHeight(),
    },
    { cardWidth: 384, cardHeight: 260 },
  );

  return (
    <>
      {/* One element is both the ring and the dim: a huge spread box-shadow
          darkens everything outside it. Stacking a separate dimmer over this
          makes the page twice as dark on exactly the steps that work.

          Still pointer-events-none, and still no aria-modal, deliberately.
          Unlike the contractor app's tour — whose look this now shares — this
          one walks a rep across twelve routes, and they are meant to click the
          tab it is describing and read the real screen underneath. The
          presentation is shared; the modal trap is not. */}
      {rect ? (
        <div
          aria-hidden="true"
          className="fixed pointer-events-none rounded-lg border-2 border-white z-[60] transition-all duration-200 motion-reduce:transition-none"
          style={spotlightStyle(rect)}
        />
      ) : null}

      <div
        ref={panelRef}
        onKeyDown={onPanelKeyDown}
        role="region"
        aria-label={t("app.salesTour.title")}
        className="fixed z-[60] rounded-xl border border-border bg-card shadow-xl p-4 space-y-3"
        style={anchored}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Compass size={16} className="text-brand-accent-text shrink-0" />
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-brand-accent-text truncate">
              {t("app.salesTour.title")}
            </span>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("app.action.close")}
            className="p-2 -m-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded"
          >
            <X size={16} />
          </button>
        </div>

        {/* aria-live so a screen reader hears the new step without the focus
            being yanked out of whatever the rep was doing on the page. */}
        <div aria-live="polite" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t("app.tour.stepCount", { n: step + 1, total })}
          </p>
          <h2 className="text-base font-semibold text-foreground break-words">
            {t(current.titleKey)}
          </h2>
          <p className="text-sm text-muted-foreground break-words">{t(current.bodyKey)}</p>
        </div>

        {/* Where it is. The label comes from the same source SalesShell draws
            the tab from — a t() key for the translated tabs, the literal for
            the English ones — so the panel cannot call a tab something the tab
            does not say. check:sales-tour asserts that pairing against the
            shell. */}
        <Link
          href={current.href}
          className="inline-flex items-center gap-2 min-h-[44px] w-full justify-center px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card transition-colors motion-reduce:transition-none"
        >
          {t("app.salesTour.goTo", {
            tab: current.tabLabelKey ? t(current.tabLabelKey) : current.tabLabel,
          })}
        </Link>

        {saveFailed ? (
          <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
            {t("app.salesTour.saveFailed")}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={step === 0}
            className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            <ArrowLeft size={14} />
            {t("app.action.back")}
          </button>
          <button
            type="button"
            onClick={() => (isLast ? dismiss() : go(step + 1))}
            className="flex-1 inline-flex items-center justify-center gap-1 min-h-[44px] px-4 py-2.5 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            {isLast ? t("app.action.done") : t("app.action.next")}
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Separate from Done, and worded as what it does. "Done" on the last
            step also dismisses — somebody who read the whole thing is not asked
            twice — but a rep on step 2 who never wants to see this again needs
            a way out that is not eighteen presses of Next. */}
        <button
          type="button"
          onClick={dismiss}
          className="block w-full text-center text-xs text-muted-foreground hover:text-foreground underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded py-1"
        >
          {t("app.salesTour.dismiss")}
        </button>
      </div>
    </>
  );
}
