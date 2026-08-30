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
import { Sparkles, Image as ImageIcon, Eye, Phone, MessageSquare, AlertTriangle, Info, Check, ExternalLink } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";

const money = (c) => formatAppMoney(Number(c || 0) / 100, CREDIT_CURRENCY, "en");

function Card({ title, icon: Icon, hint, children }) {
  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={17} className="text-muted-foreground" />}
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Statement({ t, entries, empty }) {
  if (!entries?.length) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <details className="mt-1">
      <summary className="text-sm text-muted-foreground cursor-pointer">
        {t("app.setAiCredit.whereItWent", "Where the credit went")}
      </summary>
      <ul className="mt-2 space-y-1">
        {entries.map((e, i) => (
          <li key={i} className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {e.note || e.kind}
              <span className="opacity-60"> {new Date(e.at).toLocaleDateString()}</span>
            </span>
            <span
              className={
                e.cents >= 0
                  ? "text-emerald-600 dark:text-emerald-400 tabular-nums"
                  : "text-foreground tabular-nums"
              }
            >
              {e.cents >= 0 ? "+" : "−"}
              {money(Math.abs(e.cents))}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function AiCreditPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

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

  async function buyAiCredit(cents) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/ai/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cents }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.setAiCredit.paymentError", "Couldn't start the payment."));
        return;
      }
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } finally {
      setBusy(false);
    }
  }

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
      setNotice({ tone: "ok", text: t("app.setAiCredit.bundleCancelled", "Your AI credit plan is cancelled. Credit already granted is still yours to spend — it doesn't expire.") });
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
      <Card
        title={t("app.setAiCredit.aiTitle", "AI image credit")}
        icon={Sparkles}
        hint={t("app.setAiCredit.aiHint", "Spent by AI image generation ({gen}¢ each) and the paid deep photo read on a quote ({vis}¢ per read, up to 8 photos).", { gen: ai.priceCents.image_generation, vis: ai.priceCents.image_vision })}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-medium text-muted-foreground">{t("app.setAiCredit.balance", "Balance:")}</span>
          <span className="text-2xl font-bold text-foreground">{money(ai.cents)}</span>
          <span className="text-sm text-muted-foreground">
            {t("app.setAiCredit.aiBalanceContext", "(about {images} images, or {reads} deep reads)", {
              images: imagesFor(ai.cents),
              reads: visionFor(ai.cents),
            })}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <ImageIcon size={14} /> {t("app.setAiCredit.genLabel", "Image generation")}
          <Eye size={14} className="ml-2" /> {t("app.setAiCredit.visionLabel", "Deep photo read")}
        </div>

        <p className="text-sm font-medium text-foreground mt-4">{t("app.setAiCredit.addCredit", "Add credit")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ai.topups.map((topup) => (
            <button
              key={topup.cents}
              type="button"
              disabled={busy}
              onClick={() => buyAiCredit(topup.cents)}
              className={`px-4 py-2 rounded-full border text-sm disabled:opacity-50 ${
                topup.popular
                  ? "border-inverted bg-inverted text-inverted-foreground font-semibold"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              {topup.label}
              <span className="opacity-70"> · {imagesFor(topup.cents)} {t("app.setAiCredit.images", "images")}</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Statement t={t} entries={ai.entries} empty={t("app.setAiCredit.aiEmpty", "Nothing spent from the AI balance yet.")} />
        </div>
      </Card>

      {/* ── The monthly bundle ────────────────────────────────────────────── */}
      <Card
        title={t("app.setAiCredit.bundleTitle", "AI credit plan — pay monthly, save per credit")}
        icon={Sparkles}
        hint={t("app.setAiCredit.bundleHint", "A recurring allowance on the same AI balance above, at a lower price per credit than buying as you go.")}
      >
        {/* The rollover policy, in plain words, BEFORE anyone pays — the
            exact sentence lib/ai/creditBundle.js's BUNDLE_ROLLOVER_NOTICE
            states, so the UI and the code can never say two different
            things. */}
        <p className="text-sm text-muted-foreground">{ai.bundleRolloverNotice}</p>

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
            <button
              type="button"
              disabled={busy}
              onClick={cancelBundle}
              className="mt-3 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
            >
              {t("app.setAiCredit.cancelPlan", "Cancel plan")}
            </button>
            <p className="text-xs text-muted-foreground mt-2">
              {t("app.setAiCredit.cancelNote", "Cancelling stops next month's charge and next month's credit. Credit already on your balance stays — it never gets taken back.")}
            </p>
          </div>
        ) : (
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
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => subscribeBundle(b.key)}
                  className="mt-3 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {t("app.setAiCredit.subscribe", "Subscribe")}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
