"use client";

// app/components/billing/ResumePlanButton.js
//
// The one Resume button, shared by the billing banner (every /app screen) and
// Account & Billing — so the two cannot say different things about the same
// press. It asks the server what pressing it WILL do and puts that on the
// label, because the four outcomes are not the same size:
//
//   uncancel     "Resume"                                  nothing charged
//   credited     "Resume — nothing charged until {date}"   nothing charged
//   charge_now   "Restart — your first month is charged today ({amount})"
//   checkout     "Start again"                             opens Stripe Checkout
//
// The owner's own words for the two that cost money: a company that cancelled
// during its trial "should go straight to the first month" (one trial, ever —
// lib/billing/trialOnce.js), and that has to be on the button before the card
// is charged, not in a note after.
//
// ── What it replaced ────────────────────────────────────────────────────────
//
// A link labelled "Start again" that pointed at the billing page — pressed
// from the billing page it reloaded the billing page. The owner pressed it
// twice on 2026-09-14 ("no window, no pop up"). This never links anywhere: it
// POSTs, and on success reloads the app with a note, because read-only is
// decided in the layout and only a fresh render lifts it.
//
// Renders nothing for someone who may not act on billing (the preview
// answers 403) and nothing while the preview has not answered — a button
// with no label yet is a button that promises nothing in particular.

import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { formatMoney } from "@/lib/currency";
import { reportResponseError } from "@/lib/clientErrors";

/** sessionStorage key the banner reads after the reload a resume triggers. */
export const RESUMED_NOTE_KEY = "fq.billing.resumedNote";

/**
 * The sentence a successful resume leaves for the next render — one place, so
 * the banner and the page agree. Pure.
 */
export function resumedNote(data, { t, formatDate, money }) {
  if (data?.resumed === "uncancelled") {
    return t("app.billing.resumedContinues", "Resumed — your plan continues.");
  }
  if (data?.resumed === "credited") {
    return t("app.billing.resumedCredited", "Resumed — nothing is charged until {date}.", {
      date: data.until ? formatDate(data.until) : "",
    });
  }
  if (data?.resumed === "charged") {
    return t("app.billing.resumedCharged", "Restarted — {amount} charged today.", {
      amount: money(data.amountPaidCents, data.currency),
    });
  }
  return null;
}

/** The button's label, from the preview. Pure. */
export function resumeLabel(preview, { t, formatDate, money }) {
  switch (preview?.mode) {
    case "uncancel":
      return t("app.billing.resume", "Resume");
    case "credited":
      return t("app.billing.resumeCredited", "Resume — nothing charged until {date}", {
        date: preview.until ? formatDate(preview.until) : "",
      });
    case "charge_now":
      return preview.interval === "year"
        ? t("app.billing.restartChargedYear", "Restart — your first year is charged today ({amount})", {
            amount: money(preview.amountCents, preview.currency),
          })
        : t("app.billing.restartCharged", "Restart — your first month is charged today ({amount})", {
            amount: money(preview.amountCents, preview.currency),
          });
    case "checkout":
      return t("app.billing.resumeCheckout", "Start again");
    default:
      return null;
  }
}

const moneyOf = (cents, currency) =>
  formatMoney((Number(cents) || 0) / 100, String(currency || "usd").toUpperCase());

/**
 * @param {object}   props
 * @param {string}   [props.className]   the button's classes (the caller
 *                   owns the colour — amber on the banner, inverted on the page)
 * @param {function} [props.onError]     receives a sentence; default: nothing
 * @param {function} [props.onPreview]   receives the preview once it answers,
 *                   so a caller can render the state sentence next to it
 */
export default function ResumePlanButton({ className = "", onError, onPreview }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/platform/billing/resume")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live) return;
        setPreview(d);
        onPreview?.(d);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const helpers = { t, formatDate, money: moneyOf };
  const label = resumeLabel(preview, helpers);
  if (!label) return null;

  async function press() {
    setBusy(true);
    try {
      const res = await fetch("/api/platform/billing/resume", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        reportResponseError(
          res,
          (msg) => onError?.(msg),
          t("app.billing.resumeFailed", "Couldn't resume the plan. Nothing was changed."),
        );
        setBusy(false);
        return;
      }
      if (data.resumed === false) {
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }
        // Already live, or nothing to build a checkout from: say so and
        // refresh, rather than leaving a button that did nothing visible.
        onError?.(data.note || t("app.billing.resumeNothing", "There is no plan to resume — choose a plan below."));
        setBusy(false);
        return;
      }
      const note = resumedNote(data, helpers);
      try {
        if (note) window.sessionStorage.setItem(RESUMED_NOTE_KEY, note);
      } catch {
        // No storage: the reload still shows the resumed state.
      }
      window.location.reload();
    } catch {
      onError?.(t("app.billing.resumeUnreachable", "Couldn't reach the server to resume the plan."));
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={press} disabled={busy} className={className}>
      {busy ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
      {busy ? t("app.billing.resuming", "Resuming…") : label}
    </button>
  );
}
