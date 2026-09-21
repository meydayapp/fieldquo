// app/components/dashboard/useStepDialog.js
//
// The one piece of behaviour both checklist cards share: a row opens its
// step in a dialog on the home page, the dialog's save re-reads the list,
// and when the dialog closes after a change the next unfinished step is
// offered in place — "Next: add your services →" — without a navigation.
//
// Both cards (OnboardingProgress, SetupSteps) already differ in how a row
// is drawn and in what "done" means (ticked and kept, versus removed), so
// the hook owns none of that. It is given the rows, a way to re-read them,
// and how to name and link one; it returns an `open` to hang on the row,
// the dialog element, and the strip that offers what comes next.
//
// ══ Why the re-read returns the fresh rows ═════════════════════════════════
//
// The next step is chosen from the list AS RE-READ, not from the list the
// card had when the row was tapped: the whole point of the save is that the
// list changed. React state set by the card's own refresh is not yet visible
// in the same tick, so `refresh()` resolves to the fresh rows and the choice
// is made from those. A step the reader just saved is never offered back,
// even if the server still counts it undone (Stripe review is the honest
// case) — "you have just done this, do it again" is not a next step.
"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import StepDialog from "@/app/components/dashboard/StepDialog";
import { STEP_PANELS, hasStepPanel } from "@/app/components/dashboard/stepPanels";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * @param {object} args
 * @param {string} args.id — a prefix for the dialog's ids (one per card)
 * @param {() => Promise<object[]>} args.refresh — re-read; resolves to the
 *   rows that are still to do, in the card's order
 * @param {(step: object) => string} args.labelOf
 * @param {(step: object) => string} args.hrefOf — the settings page the row
 *   used to navigate to; kept as the dialog's "Open in settings" link
 */
export default function useStepDialog({ id, refresh, labelOf, hrefOf }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(null);
  // The step just finished, and what comes after it — or null for nothing
  // offered. `done` is the finished row's label; `next` is a row or null.
  const [offer, setOffer] = useState(null);
  // Whether anything was saved while the dialog was open. Set by the panel's
  // callbacks, read on close; a ref because close runs from an event and
  // must see the value the callback wrote a moment ago.
  const changed = useRef(false);
  const latest = useRef([]);

  const open = useCallback((step) => {
    changed.current = false;
    setOffer(null);
    setActive(step);
  }, []);

  const reread = useCallback(async () => {
    changed.current = true;
    try {
      const rows = await refresh();
      latest.current = Array.isArray(rows) ? rows : [];
    } catch {
      // The card reports its own load errors; the dialog has nothing to add.
    }
  }, [refresh]);

  // Close, and offer what comes next if something was saved. `after` is
  // for the save-and-close path, where the re-read has not happened yet.
  const finish = useCallback(
    async (after) => {
      if (after) await reread();
      const done = active;
      setActive(null);
      if (!changed.current || !done) return;
      const next = latest.current.find((s) => s.key !== done.key) || null;
      setOffer({ done: labelOf(done), next });
    },
    [active, reread, labelOf],
  );

  const panel = active ? STEP_PANELS[active.key] : null;

  const dialog = (
    <StepDialog
      open={Boolean(active && panel)}
      id={`${id}-${active?.key || "none"}`}
      title={active ? labelOf(active) : ""}
      intro={panel?.introKey ? t(panel.introKey, panel.introFallback) : undefined}
      href={active ? hrefOf(active) : undefined}
      onClose={() => finish(false)}
      footer={
        panel?.finish === "list" ? (
          <button
            type="button"
            onClick={() => finish(false)}
            className="bg-inverted text-inverted-foreground px-5 py-2 rounded-full text-sm font-semibold min-h-11"
          >
            {t("app.action.done")}
          </button>
        ) : null
      }
    >
      {panel
        ? panel.render({
            onSaved: () => finish(true),
            onChanged: reread,
          })
        : null}
    </StepDialog>
  );

  // The strip the card shows after a dialog closed on a change. A next step
  // is a button that opens its dialog; none left is said plainly.
  const nextStrip = offer ? (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 px-3 py-2.5 text-sm"
    >
      <CheckCircle2 size={18} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <span className="text-foreground">
          {t("app.stepDialog.savedStep", "{step} — saved.", { step: offer.done })}
        </span>{" "}
        {offer.next ? (
          hasStepPanel(offer.next.key) ? (
            <button
              type="button"
              onClick={() => open(offer.next)}
              className="inline-flex items-center gap-1 font-semibold text-foreground underline underline-offset-2 min-h-9"
            >
              {t("app.stepDialog.next", "Next: {step}", { step: labelOf(offer.next) })}
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          ) : (
            <span className="text-foreground">
              {t("app.stepDialog.next", "Next: {step}", { step: labelOf(offer.next) })}
            </span>
          )
        ) : (
          <span className="text-muted-foreground">
            {t("app.stepDialog.nothingLeft", "That's everything on this list.")}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setOffer(null)}
        aria-label={t("app.action.close")}
        className="shrink-0 -mr-1 p-1.5 text-muted-foreground hover:text-foreground min-h-9 min-w-9 flex items-center justify-center"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  ) : null;

  return { open, dialog, nextStrip, activeKey: active?.key || null };
}
