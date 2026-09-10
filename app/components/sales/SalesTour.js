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
// z-40, one below IncomingCallDock's z-50, and that ordering is deliberate: a
// contractor ringing back is the most important thing that can happen to a rep,
// and it must cover the walkthrough rather than fight it for the bottom of a
// phone screen.
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
import { SALES_TOUR_STEPS, clampTourStep } from "@/app/sales/tourSteps";

/**
 * The first match that is actually on screen.
 *
 * Lifted in shape from OnboardingTour.js's `visibleTarget`, and for the same
 * reason it exists there: a responsive layout can render two copies of the same
 * control, and `display:none` gives a zero-size rect. Copied rather than
 * imported because that module is not exported from OnboardingTour.js and
 * widening its API for one caller is a bigger change than eight lines.
 */
function visibleTarget(selector) {
  if (!selector || typeof document === "undefined") return null;
  for (const el of document.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
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

  // ── The ring around the tab this step is about ──────────────────────────
  //
  // Measured rather than styled onto the element: SalesShell owns those links'
  // className and re-renders them on every navigation, so a class added from
  // here would be wiped the moment the rep followed the link the panel just
  // gave them.
  //
  // A target that is not found draws no ring and changes nothing else. That is
  // not the "silently skip" behaviour this file's header rejects — the step,
  // its words and its link are all still there; only the decoration is
  // missing, and check:sales-tour is what guarantees the link itself is real.
  const measure = useCallback(() => {
    if (!open || !current?.href) return setRect(null);
    const el = visibleTarget(`[data-sales-tour="${current.href}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [open, current?.href]);

  useEffect(() => {
    if (!open) return undefined;
    measure();
    const el = visibleTarget(`[data-sales-tour="${current?.href}"]`);
    // `auto`, not `smooth`, for anybody who asked for less movement. The
    // scroll still happens — they still need to see the tab — it just does not
    // animate.
    el?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
    const onChange = () => measure();
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, [open, current?.href, measure]);

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
      <div className="fixed bottom-4 left-4 z-40 max-w-[calc(100vw-2rem)]">
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

  return (
    <>
      {/* The ring. pointer-events-none so it never intercepts a click meant
          for the tab it is drawn around. */}
      {rect ? (
        <div
          aria-hidden="true"
          className="fixed pointer-events-none rounded-lg border-2 border-brand-accent z-40 transition-all duration-200 motion-reduce:transition-none"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      ) : null}

      <div
        ref={panelRef}
        onKeyDown={onPanelKeyDown}
        role="region"
        aria-label={t("app.salesTour.title")}
        className="fixed bottom-4 left-4 right-4 sm:right-auto sm:w-[24rem] z-40 rounded-xl border border-border bg-card shadow-xl p-4 space-y-3"
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
