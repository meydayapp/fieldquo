"use client";

// app/app/settings/ai-credit/page.js
//
// The unified AI-credit view the owner asked for: AI receptionist, crew
// texting, image generation and the paid vision pass, in one place. Two
// wallets, shown side by side and never merged — see
// app/api/settings/ai/credit/route.js's header for why, and
// lib/voice/credits.js's own header for the underlying reason (Retell bills a
// monthly floor; OpenAI bills only on use).
//
// The voice wallet's purchase mechanics — top-up, auto-topup, the full
// statement — already exist at /app/settings/voice#credit and are not
// rebuilt here; this page shows the balance and links out. The AI wallet had
// NO purchase mechanism before this page: pay-as-you-go top-up
// (lib/ai/topup.js) and the monthly bundle (lib/ai/creditBundle.js) are both
// new, and both are built here.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Phone, MessageSquare, AlertTriangle, Info, Check, ExternalLink } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
import BackToHome from "@/app/components/BackToHome";
import AiCreditCard, { Card, Statement, money } from "./AiCreditCard";
import AiPlanAdvisor from "@/app/components/billing/AiPlanAdvisor";
import UsdBillingNote from "@/app/components/billing/UsdBillingNote";
import { bundleCovers } from "@/lib/ai/planAdvice";

// Card, Statement and the credit-currency formatter live in ./AiCreditCard.js
// with the AI wallet card, which the home page's set-up dialog renders too.

/**
 * The AI balance in its two parts (owner, 2026-10-04): plan credit, which
 * resets on its date, and top-up credit, which never expires. The split is
 * the server's (lib/ai/planCreditReset.js aiPlanCreditStatus) — plan credit
 * is spent first, the same rule the reset applies — so the page never works
 * out a different number from the one that will actually go.
 */
function PlanCreditSplit({ t, split }) {
  if (!split?.resetsOn) return null;
  const date = new Date(split.resetsOn).toLocaleDateString();
  return (
    <ul className="mt-2 space-y-1 text-xs text-foreground" data-ai-plan-credit-split>
      <li>
        {t("app.setAiCredit.planLeft", "Plan credit left: {amount} — resets on {date}", { amount: money(split.planCents), date })}
      </li>
      <li className="text-muted-foreground">
        {t("app.setAiCredit.topupLeft", "Top-up credit: {amount} — doesn't expire", { amount: money(split.topupCents) })}
      </li>
    </ul>
  );
}

export default function AiCreditPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  // The advisor's latest answer, which marks the bundle that fits.
  const [advice, setAdvice] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/ai/credit");
    if (!res.ok) {
      await reportResponseError(res, t("app.setAiCredit.loadError", "Couldn't load AI credit."));
      return null;
    }
    const d = await res.json();
    setData(d);
    return d;
  }, [t]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const aiTopup = params.get("aitopup");
    const aiBundle = params.get("aibundle");

    (async () => {
      // ── Same rule as the voice page's identical block ──────────────────
      // The success URL is just a URL — anyone can visit it. Confirm against
      // Stripe before showing a balance, and say what happened rather than
      // going silent after taking money.
      if (aiTopup) {
        let confirmed = null;
        try {
          const res = await fetch(`/api/settings/ai/topup?session_id=${encodeURIComponent(aiTopup)}`);
          confirmed = res.ok ? await res.json().catch(() => null) : null;
        } catch {
          confirmed = null;
        }
        window.history.replaceState({}, "", window.location.pathname);
        setNotice(
          confirmed?.credited
            ? { tone: "ok", text: t("app.setAiCredit.topupCredited", "Payment received — {amount} of AI credit added.", { amount: money(confirmed.cents) }) }
            : { tone: "info", text: t("app.setAiCredit.topupPending", "We couldn't confirm that payment just yet. If it went through, the credit lands on its own within a minute or two. Refresh to check.") },
        );
      }

      if (aiBundle) {
        let confirmed = null;
        try {
          const res = await fetch(`/api/settings/ai/bundle?session_id=${encodeURIComponent(aiBundle)}`);
          confirmed = res.ok ? await res.json().catch(() => null) : null;
        } catch {
          confirmed = null;
        }
        window.history.replaceState({}, "", window.location.pathname);
        setNotice(
          confirmed?.ok
            ? { tone: "ok", text: t("app.setAiCredit.bundleStarted", "Your AI credit plan is on. The first month's credit is on the balance below.") }
            : { tone: "info", text: t("app.setAiCredit.bundlePending", "We couldn't confirm that plan just yet. Nothing has been charged twice — refresh in a minute to check.") },
        );
      }

      await load();
      setLoading(false);
    })();
  }, [load, t]);



  async function subscribeBundle(key) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/ai/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.setAiCredit.bundleStartError", "Couldn't start that plan."));
        return;
      }
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } finally {
      setBusy(false);
    }
  }

  async function cancelBundle() {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/ai/bundle", { method: "DELETE" });
      if (!res.ok) {
        await reportResponseError(res, t("app.setAiCredit.bundleCancelError", "Couldn't cancel that plan."));
        return;
      }
      setNotice({ tone: "ok", text: t("app.setAiCredit.bundleCancelled", "Your AI credit plan is cancelled. This month's plan credit stays until the month ends; top-ups you've bought don't expire.") });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl p-4 sm:p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-32 bg-accent rounded-xl" />
        <div className="h-32 bg-accent rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 sm:p-6 text-sm text-muted-foreground">
        {t("app.setAiCredit.loadFailed", "This page couldn't be loaded.")}
      </div>
    );
  }

  const { voice, ai, vendorConfigured } = data;
  const bundle = ai.bundle;
  const imagesFor = (cents) => Math.floor(Number(cents || 0) / ai.priceCents.image_generation);
  const visionFor = (cents) => Math.floor(Number(cents || 0) / ai.priceCents.image_vision);

  return (
    <div className="max-w-3xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles size={20} className="text-muted-foreground" />
          {t("app.setAiCredit.title", "AI credit")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.setAiCredit.subtitle",
            "Everything that spends AI credit, in one place — the phone receptionist and crew texting draw one balance, image generation and the deep photo read draw another. They're kept separate on purpose.",
          )}
        </p>
        <BackToHome />
      </div>

      {!vendorConfigured && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex gap-3">
          <Info size={17} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {t(
              "app.setAiCredit.vendorNotConfigured",
              "AI image tools aren't connected on this deployment yet, so generation and the deep photo read will refuse. Credit you buy now is still yours — it just can't be spent until that's fixed.",
            )}
          </p>
        </div>
      )}

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 flex gap-3 ${
            notice.tone === "ok"
              ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40"
              : "border-border bg-muted"
          }`}
        >
          {notice.tone === "ok" ? (
            <Check size={17} className="text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Info size={17} className="text-muted-foreground shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${notice.tone === "ok" ? "text-emerald-900 dark:text-emerald-200" : "text-foreground"}`}>
            {notice.text}
          </p>
        </div>
      )}

      {/* ── The phone wallet — a link out, not a rebuild ─────────────────── */}
      <Card
        tour="ai-credit-voice"
        title={t("app.setAiCredit.voiceTitle", "Phone credit")}
        icon={Phone}
        hint={t("app.setAiCredit.voiceHint", "Spent by the phone receptionist ({rate}¢/min) and crew texting. Buying more, automatic top-up and the full statement live on the phone settings page.", { rate: voice.centsPerMinute })}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-medium text-muted-foreground">{t("app.setAiCredit.balance", "Balance:")}</span>
          <span className="text-2xl font-bold text-foreground">{money(voice.cents)}</span>
          {voice.low && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle size={13} /> {t("app.setVoice.runningLow", "running low")}
            </span>
          )}
        </div>
        {/* Phone & text credit (Retell voice, Twilio texts) is bought in US dollars. */}
        <UsdBillingNote className="mt-1" />
        <div className="flex items-center gap-3 mt-2">
          <MessageSquare size={14} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {t("app.setAiCredit.crewNote", "Crew texting draws this same balance.")}
          </span>
        </div>
        <Link
          href={voice.topupHref}
          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted"
        >
          {t("app.setAiCredit.managePhoneCredit", "Add phone credit")}
          <ExternalLink size={13} />
        </Link>
        <div className="mt-4">
          <Statement t={t} entries={voice.entries} empty={t("app.setAiCredit.voiceEmpty", "Nothing spent from the phone balance yet.")} />
        </div>
      </Card>

      {/* ── The AI wallet — the new purchase surface ─────────────────────── */}
      <AiCreditCard ai={ai} />

      {/* ── The monthly bundle ────────────────────────────────────────────── */}
      <Card
        title={t("app.setAiCredit.bundleTitle", "AI credit plan — pay monthly, save per credit")}
        icon={Sparkles}
        hint={t("app.setAiCredit.bundleHint", "A recurring allowance on the same AI balance above, at a lower price per credit than buying as you go.")}
      >
        {/* The reset policy, in plain words, BEFORE anyone pays (owner,
            2026-10-04: plan credit resets monthly, top-ups don't expire) —
            the translated form of lib/ai/creditBundle.js's
            BUNDLE_RESET_NOTICE, which check:ai-credit keeps in step with
            what lib/ai/planCreditReset.js actually does. */}
        <p className="text-sm text-muted-foreground" data-ai-plan-reset-notice>
          {t(
            "app.setAiCredit.resetNotice",
            "Plan credit resets every month: whatever you don't use by your renewal date is gone, and the next month's credit lands. Run out before then and you can top up — top-ups don't expire. Cancelling stops next month's charge; this month's plan credit stays until the month ends.",
          )}
        </p>
        {/* The AI credit plans are US-dollar subscriptions (owner, 2026-09-06). */}
        <UsdBillingNote className="mt-2" />

        {/* Which AI credit plan fits (owner, 2026-10-04): the AI employee's
            conversations and drawing reads are paid from this credit; quote
            reviews from the plan's allowance — the advisor says both. */}
        {ai.adviceUnits && (
          <AiPlanAdvisor
            className="mt-4"
            units={ai.adviceUnits}
            bundles={ai.bundles}
            bundlesAvailable={ai.bundleAvailable?.ok !== false}
            creditHref={null}
            onAdvice={setAdvice}
          />
        )}

        {bundle?.active ? (
          <div className="mt-4 rounded-lg border border-border bg-muted/50 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              {t("app.setAiCredit.currentPlan", "On the {key} plan — {credits} credits for {price}/month", {
                key: bundle.label,
                credits: bundle.credits?.toLocaleString(),
                price: money(bundle.priceCents),
              })}
            </p>
            {bundle.currentPeriodEnd && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("app.setAiCredit.renews", "Renews {date}", { date: new Date(bundle.currentPeriodEnd).toLocaleDateString() })}
              </p>
            )}
            <PlanCreditSplit t={t} split={ai.planCredit} />
            <button
              type="button"
              disabled={busy}
              onClick={cancelBundle}
              className="mt-3 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
            >
              {t("app.setAiCredit.cancelPlan", "Cancel plan")}
            </button>
            <p className="text-xs text-muted-foreground mt-2">
              {ai.planCredit?.resetsOn
                ? t("app.setAiCredit.cancelNote", "Cancelling stops next month's charge and next month's credit. This month's plan credit stays until {date}, then resets; top-ups you've bought stay until you use them.", {
                    date: new Date(ai.planCredit.resetsOn).toLocaleDateString(),
                  })
                : t("app.setAiCredit.cancelNoteNoDate", "Cancelling stops next month's charge and next month's credit. This month's plan credit stays until the month ends, then resets; top-ups you've bought stay until you use them.")}
            </p>
          </div>
        ) : (
          <>
          {/* A cancelled (or lapsed) plan whose paid month is still running
              keeps its credit until the reset date — said, not left to be
              discovered when it goes. */}
          {ai.planCredit?.resetsOn && <PlanCreditSplit t={t} split={ai.planCredit} />}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {ai.bundles.map((b) => (
              <div key={b.key} className="rounded-lg border border-border p-4 flex flex-col">
                <p className="text-sm font-semibold text-foreground capitalize">{b.key}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{money(b.priceCents)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("app.setAiCredit.bundleCredits", "{credits} credits — about {images} images", {
                    credits: b.credits.toLocaleString(),
                    images: imagesFor(b.credits),
                  })}
                </p>
                {/* The same credit, in the two uses a contractor weighs — the
                    AI employee's conversations and drawing reads — from the
                    metered unit costs (lib/ai/planAdviceUnits.js). */}
                {ai.adviceUnits && (() => {
                  const covers = bundleCovers(b, ai.adviceUnits);
                  return covers.conversations != null && covers.drawingReads != null ? (
                    <p className="text-xs text-muted-foreground mt-1" data-bundle-covers>
                      {t("app.aiAdvisor.bundleCovers", "Or about {conversations} AI employee conversations, or {reads} drawing reads, a month", {
                        conversations: covers.conversations.toLocaleString(),
                        reads: covers.drawingReads.toLocaleString(),
                      })}
                    </p>
                  ) : null;
                })()}
                {advice?.credit?.fits && advice.credit.bundle?.key === b.key && (
                  <span className="mt-2 self-start text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900" data-bundle-fits>
                    {t("app.aiAdvisor.recommendedBadge", "Fits what you entered")}
                  </span>
                )}
                {/* Every company may subscribe since 2026-10-04 (a non-USD
                    company on its separate USD add-on customer). The off
                    state stays for any future refusal: a live button that
                    502s is the failure this repo is swept for, and the
                    sentence comes from the server so it is the same one the
                    API would answer. */}
                <button
                  type="button"
                  disabled={busy || ai.bundleAvailable?.ok === false}
                  onClick={() => subscribeBundle(b.key)}
                  className="mt-3 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {t("app.setAiCredit.subscribe", "Subscribe")}
                </button>
                {ai.bundleAvailable?.ok === false && (
                  <p className="text-xs text-muted-foreground mt-2">{ai.bundleAvailable.reason}</p>
                )}
              </div>
            ))}
          </div>
          </>
        )}
      </Card>
    </div>
  );
}
