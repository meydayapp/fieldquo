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
//   3. Confirm — what actually happens, then the button
//
// A save flow you can't get out of is why people call their bank instead of
// clicking your button, and a chargeback costs several times the month you were
// trying to keep. So the escape is on every screen, in plain words, never
// greyed out and never behind a "type CANCEL to confirm".
//
// ══ Screen three tells the truth, and it is NOT a fourth screen ════════════
//
// The consequences live ON the confirm screen rather than in a step of their
// own, deliberately. A company that wants to leave still gets there in the same
// number of clicks it took yesterday — informed consent, not friction. Adding a
// gate would be the dark pattern this file's header spends twenty lines arguing
// against, and it would push people to their bank instead.
//
// ══ Every sentence is a fact about code, and it used to be wrong ═══════════
//
// This screen previously said: "You've paid to <date>, so you keep working
// normally until then." That was false in both halves.
// app/api/platform/billing/cancel/route.js calls cancelSubscription(), which is
// `stripe.subscriptions.cancel()` with no cancel_at_period_end — Stripe ends
// the subscription THERE AND THEN, fires customer.subscription.deleted, and
// lib/platform/stripeBilling.js writes status:"canceled" with canceledAt=now.
// accessFor() in lib/billing/access.js then returns `readonly` immediately. So
// the contractor lost write access the moment they pressed a button that had
// just promised them the rest of the month, and the remainder is not refunded.
//
// Everything else on this screen is read from /api/settings/subscription/
// consequences, which counts the company's OWN rows. A warning that lists a
// phone number you don't have, or clients' cards you never saved, teaches
// people to skip warnings. So each block renders only when its count is real.
//
// scripts/check-cancel-consequences.mjs asserts the modules named above still
// do these things — it tests the code, not the wording, because asserting on
// wording only ever proves the wording did not change.

import { useEffect, useState } from "react";
import { Loader2, X, ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { consequenceItems } from "@/lib/billing/cancelConsequences";
import { useTranslation } from "@/app/hooks/useTranslation";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";

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

/**
 * Cents off the VOICE CREDIT ledger — number rentals and the unspent balance.
 *
 * Denominated in USD and now saying so: the top-up collects US dollars
 * (lib/voice/creditCurrency.js), so "$4.00" on a CAD account is about $5.55 of
 * the contractor's own money. This screen is the last thing they read before
 * cancelling, which is the worst possible place to understate what they lose.
 *
 * Deliberately NOT the same formatter as the won-work figures below: those are
 * the company's own billing currency. Two ledgers, two currencies, one screen —
 * conflating them is the whole reason this helper is separate.
 */
const cents = (c) =>
  formatAppMoney(Number(c || 0) / 100, CREDIT_CURRENCY, "en");

/**
 * One consequence, in words.
 *
 * WHICH items appear is decided by consequenceItems() in
 * lib/billing/cancelConsequences.js, which is pure and executed by
 * scripts/check-cancel-consequences.mjs. This function only turns a decided
 * item into a sentence — split that way so the decision can be checked without
 * rendering React, which is the reason nobody ever checked the chain of `&&`
 * this replaced.
 *
 * The keys are written as literals rather than built from item.key, because
 * check-translations.mjs scans source for `"app.*"` literals and a computed key
 * is invisible to it — an undefined key would then render as its own name on a
 * screen somebody reads once, in the worst minute of their relationship with us.
 */
// `money` is a parameter for the same reason `cents` is not: cents is the USD
// credit ledger and is fixed, while these invoice figures are the COMPANY's
// own currency, which this module cannot know.
function itemText(item, t, money) {
  switch (item.key) {
    case "numberKept":
      return t("app.cancelFlow.numberKept", "{number} is not handed back. We keep renting it and {amount} a month keeps coming out of your phone credit — {balance} left. Once the credit can't cover it you get {days} days' notice and then the number is released for good, and it can't be got back. Release it yourself first if you'd rather pick the moment.", {
        number: item.number,
        amount: cents(item.monthlyCents),
        balance: cents(item.balanceCents),
        days: item.days,
      });
    case "creditNoRefund":
      return t("app.cancelFlow.creditNoRefund", "The {balance} of phone credit you've already bought isn't refunded.", {
        balance: cents(item.balanceCents),
      });
    case "autoTopupArmed":
      return t("app.cancelFlow.autoTopupArmed", "Automatic phone-credit top-ups stay switched on, so your saved card is still charged {amount} whenever the balance runs low. Switch it off first if you don't want that.", {
        amount: cents(item.amountCents),
      });
    case "autoTopupOn":
      return t("app.cancelFlow.autoTopupOn", "Automatic phone-credit top-ups stay switched on. Switch them off first if you don't want them running after you've gone.");
    case "servicePlansRun":
      return t("app.cancelFlow.servicePlansRun", "{count} service plans keep running. Invoices keep going out and your clients' saved cards keep being charged on schedule. Cancel the plans first if that isn't what you want.", {
        count: item.count,
      });
    case "unpaidInvoices":
      return t("app.cancelFlow.unpaidInvoices", "{count} invoices are still unpaid — {amount} in total. Your clients can still pay them, but once you're read-only you can't edit, re-send or chase them.", {
        count: item.count,
        amount: money(item.amountDue),
      });
    case "heldBookings":
      return t("app.cancelFlow.heldBookings", "{count} bookings are still waiting on a visit fee. Those settle or expire on their own.", {
        count: item.count,
      });
    case "siteStaysLive":
      return t("app.cancelFlow.siteStaysLive", "Your website and booking page stay live, so new booking requests keep arriving — and after {days} days you won't be able to open the account to see them. A small “Site by FieldQuo” line also comes back to the footer then. Unpublish the site first if you'd rather it went quiet.", {
        days: item.days,
      });
    // No default sentence. An item this function does not know is a key added
    // to cancelConsequences.js without wording, and rendering nothing is the
    // honest outcome — the check script fails the build for it separately.
    default:
      return null;
  }
}

export default function CancelFlow({ open, onClose, onCancelled, periodEnd, formatDate }) {
  const money = useCompanyMoney();
  const { t } = useTranslation();
  const [step, setStep] = useState("why");
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  const [offers, setOffers] = useState([]);
  const [cooldown, setCooldown] = useState(null);
  const [value, setValue] = useState(null);
  const [what, setWhat] = useState(null);
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

    // The per-company consequences. Also silent on failure, and the confirm
    // screen below falls back to only the sentences that are true for EVERY
    // company — which is the safe direction: a company that cannot be told
    // about its phone number still must not be told it hasn't got one.
    fetch("/api/settings/subscription/consequences")
      .then((r) => (r.ok ? r.json() : null))
      .then(setWhat)
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  // Decided in lib/billing/cancelConsequences.js, not here. `what` being null
  // — the fetch failed, or has not landed — yields an empty list, so the screen
  // shows the three universal sentences and claims nothing it cannot support.
  const items = consequenceItems(what);

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
            {/* ── When ─────────────────────────────────────────────────────
                Immediate, because cancelSubscription() is
                stripe.subscriptions.cancel() with no cancel_at_period_end.
                The date is still shown when we have it, but as the thing that
                is NOT refunded rather than as a promise of time left. */}
            <p className="text-sm text-foreground">
              <strong>
                {t("app.cancelFlow.endsNow", "Your plan ends the moment you press the button below — not at the end of the month.")}
              </strong>
              {periodEnd && (
                <>
                  {" "}
                  {/* The COMPANY's date format, not toLocaleDateString().
                      "8/29/2026" is ambiguous to anyone outside the US, and
                      formatDate is what every other date in the product uses —
                      a cancellation screen is the worst place to show someone a
                      date they have to decode. */}
                  {t("app.cancelFlow.paidToNoRefund", "You've paid to {date}, and the rest of that isn't refunded.", {
                    date: formatDate ? formatDate(periodEnd) : new Date(periodEnd).toLocaleDateString(),
                  })}
                </>
              )}
            </p>

            {/* ── What happens ─────────────────────────────────────────────
                Three sentences that are true for every company, so they render
                even when the consequences fetch failed. Two of the three are
                reassuring on purpose: an honest warning includes what you do
                NOT lose, and "nothing is deleted" is the single most useful
                fact on this screen. */}
            <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
              <li>
                {t("app.cancelFlow.youReadOnly", "You can still open FieldQuo and read everything for {days} days, but not change anything. After that it stays shut until you start the plan again.", {
                  days: what?.readOnlyDays ?? 30,
                })}
              </li>
              <li>
                {t("app.cancelFlow.clientLinksLive", "Your clients keep every link you've already sent them — quotes, the client portal, invoice payment pages. Those still open, and anything they pay still reaches your Stripe account.")}
              </li>
              <li>
                {t("app.cancelFlow.nothingDeleted", "Nothing is deleted. Your quotes, clients, jobs, invoices and photos stay exactly as they are, and starting the plan again gives you all of it back.")}
              </li>
            </ul>

            {/* ── Only what is actually true of THIS company ───────────────
                Every item below is a non-zero count from their own rows. A
                warning that lists a phone number you haven't got is how people
                learn to skip warnings.

                The heading is not decoration: cancelling makes the account
                read-only immediately (denyReason in lib/billing/access.js), so
                releasing a number, cancelling a service plan or unpublishing a
                site all become impossible AFTER this button. Doing them first
                is the only order that works. */}
            {items.length > 0 && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                <div className="flex gap-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    {t("app.cancelFlow.doFirst", "Sort these out first — the account goes read-only the moment you cancel, so you won't be able to afterwards.")}
                  </p>
                </div>
                <ul className="mt-2 space-y-2 text-sm text-amber-900 dark:text-amber-200 list-disc pl-5">
                  {items.map((item, i) => (
                    <li key={`${item.key}-${item.number || i}`}>{itemText(item, t, money)}</li>
                  ))}
                </ul>
              </div>
            )}

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
