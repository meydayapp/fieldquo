"use client";

// app/app/settings/account-billing/CancelFlow.js
//
// What happens when someone presses Cancel.
//
// ══ The sequencing is the whole design ═════════════════════════════════════
//
// ASK FIRST, OFFER SECOND. Nothing is offered on the first press.
//
// An offer before you've asked reads as "we'd rather haggle than listen", and
// it spends margin on people who would have stayed for free if asked the right
// question. The landscaper cancelling in February doesn't want 25% off — they
// want to come back in April, and a discount aimed at the wrong problem is both
// insulting and expensive.
//
// It also means you learn WHY even from the ones who leave anyway, which is the
// only part of this screen that pays for itself indefinitely.
//
// ══ Three screens, and every one of them has a working exit ════════════════
//
//   1. Why are you leaving?          → "Cancel anyway" works, first click
//   2. Here's what might help        → "No thanks, cancel" works, first click
//   3. Confirm — and when it ends    → this is the only irreversible one
//
// A save flow you can't get out of is why people call their bank instead of
// clicking your button, and a chargeback costs several times the month you were
// trying to keep. So the escape is on every screen, in plain words, never
// greyed out and never behind a "type CANCEL to confirm".

import { useEffect, useState } from "react";
import { Loader2, X, ArrowLeft, Check } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

const REASONS = [
  { key: "too_expensive", label: "It costs too much right now" },
  { key: "too_many_licenses", label: "I'm paying for people who don't use it" },
  { key: "seasonal", label: "My work is seasonal — I'll be back" },
  { key: "not_using", label: "I'm not using it enough" },
  { key: "missing_feature", label: "It's missing something I need" },
  { key: "switching", label: "I'm moving to something else" },
  { key: "closing", label: "I'm closing the business" },
  { key: "other", label: "Something else" },
];

const money = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function CancelFlow({ open, onClose, onCancelled, periodEnd, formatDate }) {
  const { t } = useTranslation();
  const [step, setStep] = useState("why");
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  const [offers, setOffers] = useState([]);
  const [cooldown, setCooldown] = useState(null);
  const [value, setValue] = useState(null);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(null);

  useEffect(() => {
    if (!open) return;
    // Loaded up front so screen one can show it without a spinner. Silent on
    // failure — a cancel flow that errors before it starts is a cancel flow
    // people route around by calling their bank.
    fetch("/api/settings/subscription/value")
      .then((r) => (r.ok ? r.json() : null))
      .then(setValue)
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  async function chooseReason(key) {
    setReason(key);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/settings/subscription/retention?reason=${encodeURIComponent(key)}`,
      );
      const d = res.ok ? await res.json() : { offers: [] };
      setOffers(d.offers || []);
      setCooldown(d.cooldown || null);
      // Nothing to offer — for "I'm closing the business" there is nothing to
      // say, and pretending otherwise wastes the last thirty seconds of a
      // relationship. Straight to confirm.
      setStep(d.offers?.length ? "offer" : "confirm");
    } finally {
      setBusy(false);
    }
  }

  async function acceptOffer(key) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/subscription/retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer: key, reason }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.cancelFlow.applyFailed", "We couldn't apply that."));
        return;
      }
      const d = await res.json();
      setAccepted(d.summary || "Done");
      setStep("kept");
    } finally {
      setBusy(false);
    }
  }

  async function reallyCancel() {
    setBusy(true);
    try {
      const res = await fetch("/api/platform/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, note }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.cancelFlow.cancelFailed", "We couldn't cancel just now."));
        return;
      }
      onCancelled?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          {step !== "why" && step !== "kept" && (
            <button
              type="button"
              onClick={() => setStep(step === "confirm" && offers.length ? "offer" : "why")}
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("app.action.back", "Back")}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 className="font-bold text-foreground">
            {step === "why" && t("app.cancelFlow.beforeYouGo", "Before you go")}
            {step === "offer" && t("app.cancelFlow.oneThingFirst", "One thing first")}
            {step === "confirm" && t("app.cancelFlow.cancelYourPlan", "Cancel your plan")}
            {step === "kept" && t("app.cancelFlow.sorted", "Sorted")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-muted-foreground hover:text-foreground"
            aria-label={t("app.action.close", "Close")}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── 1. Why ─────────────────────────────────────────────────────── */}
        {step === "why" && (
          <div className="p-5 space-y-4">
            {/* Only when the numbers have earned it. A company two weeks in has
                three quotes and one client, and showing them that is making
                THEIR case, not ours. */}
            {value?.worthShowing && (
              <div className="rounded-xl bg-muted px-4 py-3">
                <p className="text-sm text-foreground">
                  {t("app.cancelFlow.builtUp", "You've built up")}{" "}
                  <strong>{value.quotes} {t("app.cancelFlow.quotesWord", "quotes")}</strong>
                  {value.quotesWon > 0 && (
                    <>
                      {" "}
                      — <strong>{value.quotesWon} {t("app.cancelFlow.wonWord", "won")}</strong>, {t("app.cancelFlow.worthWord", "worth")}{" "}
                      <strong>{money(value.wonTotal)}</strong>
                    </>
                  )}
                  , <strong>{value.clients} {t("app.cancelFlow.clientsWord", "clients")}</strong> {t("app.cancelFlow.andWord", "and")}{" "}
                  <strong>{value.invoices} {t("app.cancelFlow.invoicesWord", "invoices")}</strong> {t("app.cancelFlow.inHere", "in here.")}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {t("app.cancelFlow.allStays", "All of it stays exactly where it is if you come back.")}
                </p>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              {t("app.cancelFlow.whyPrompt", "What's making you cancel? It changes what we can do about it.")}
            </p>

            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  disabled={busy}
                  onClick={() => chooseReason(r.key)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-inverted hover:bg-muted text-sm text-foreground disabled:opacity-50"
                >
                  {t(`app.cancelFlow.reason.${r.key}`, r.label)}
                </button>
              ))}
            </div>

            {/* Always available, never greyed, never behind a typed
                confirmation. See the header of this file. */}
            <button
              type="button"
              onClick={() => setStep("confirm")}
              className="text-sm text-muted-foreground underline"
            >
              {t("app.cancelFlow.skipCancel", "Skip this and cancel")}
            </button>
          </div>
        )}

        {/* ── 2. The offer ───────────────────────────────────────────────── */}
        {step === "offer" && (
          <div className="p-5 space-y-3">
            {offers.map((o, i) => (
              <div
                key={o.key}
                className={`rounded-xl border p-4 ${
                  i === 0 ? "border-inverted bg-muted" : "border-border"
                }`}
              >
                <p className="font-semibold text-foreground">{o.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{o.body}</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => acceptOffer(o.key)}
                  className={`mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50 ${
                    i === 0
                      ? "bg-inverted text-inverted-foreground"
                      : "border border-border text-foreground"
                  }`}
                >
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  {o.cta}
                </button>
              </div>
            ))}

            {cooldown && <p className="text-xs text-muted-foreground">{cooldown}</p>}

            <button
              type="button"
              onClick={() => setStep("confirm")}
              className="text-sm text-muted-foreground underline"
            >
              {t("app.cancelFlow.noThanksCancel", "No thanks — cancel my account")}
            </button>
          </div>
        )}

        {/* ── 3. Confirm ─────────────────────────────────────────────────── */}
        {step === "confirm" && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-foreground">
              {periodEnd ? (
                <>
                  {/* The COMPANY's date format, not toLocaleDateString().
                      "8/29/2026" is ambiguous to anyone outside the US, and
                      formatDate is what every other date in the product uses —
                      a cancellation screen is the worst place to show someone a
                      date they have to decode. */}
                  {t("app.cancelFlow.paidTo", "You've paid to")}{" "}
                  <strong>{formatDate ? formatDate(periodEnd) : new Date(periodEnd).toLocaleDateString()}</strong>{t("app.cancelFlow.paidToRest", ", so you keep working normally until then. Nothing is charged after that.")}
                </>
              ) : (
                <>{t("app.cancelFlow.planWillStop", "Your plan will stop at the end of the period you've paid for.")}</>
              )}
            </p>

            <p className="text-sm text-muted-foreground">
              {t("app.cancelFlow.dataStays", "Your quotes, clients, jobs and invoices stay in your account. Nothing is deleted, and turning the plan back on brings it all back.")}
            </p>

            {/* Free text, after the multiple choice rather than instead of it.
                The tick-box answer is comparable across companies; this is where
                the actual reason usually is. */}
            <label className="block">
              <span className="text-sm font-medium text-foreground">
                {t("app.cancelFlow.tellUs", "Anything you want to tell us?")}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={t("app.cancelFlow.notePlaceholder", "Optional — but it's the only way we find out what to fix.")}
                className="mt-1.5 w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={reallyCancel}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {t("app.cancelFlow.cancelMyPlan", "Cancel my plan")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-full border border-border text-sm text-foreground"
              >
                {t("app.cancelFlow.keepMyPlan", "Keep my plan")}
              </button>
            </div>
          </div>
        )}

        {/* ── They stayed ────────────────────────────────────────────────── */}
        {step === "kept" && (
          <div className="p-6 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950 grid place-items-center">
              <Check size={22} className="text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
            </div>
            <p className="font-semibold text-foreground">{accepted}</p>
            <p className="text-sm text-muted-foreground">
              {t("app.cancelFlow.keptDone", "It's applied to your next invoice — nothing else to do.")}
            </p>
            <button
              type="button"
              onClick={() => {
                onClose?.();
                // The billing panel behind this is now stale.
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-full bg-inverted text-inverted-foreground text-sm font-semibold"
            >
              {t("app.action.done", "Done")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
