// app/app/settings/verify-phone/page.js
//
// A card-free trial verifies one mobile before the features that spend
// FieldQuo's money (lib/trial/phoneGate.js). This page says why, lists
// exactly what it unlocks, texts a code and checks it — and, when the
// company does not need to (on a plan, already verified, or in a country
// FieldQuo can't text yet), says that instead of offering a form.
//
// Every refusal comes back with a `reasonKey`; the sentence shown is this
// catalogue's, in the reader's language, with the server's English as the
// fallback.
//
// ── Paid from phone & text credit (owner, 2026-10-04) ──────────────────────
//
// The code, the number check and (for a US mobile) Twilio Verify are charged
// to the company's phone & text credit (lib/trial/phoneVerifyBilling.js). The
// page says what a first code costs before Send, and a 402 "no_phone_credit"
// becomes the phone & text top-up — a Stripe Checkout that comes back HERE
// (returnTo "verify-phone") and is settled on arrival, the same two doors the
// voice page uses (GET .../topup?session_id, and the webhook).
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Smartphone } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";

// The smallest preset top-up (lib/voice/credits.js TOPUP_OPTIONS). Enough for
// a couple of hundred codes; the voice page sells the larger amounts.
const VERIFY_TOPUP_CENTS = 1000;
const credit = (cents, language) => formatAppMoney(Number(cents || 0) / 100, CREDIT_CURRENCY, language || "en");

const FEATURES = ["sms", "phone_number", "crew_line", "business_number", "ai_call", "video_post", "email_campaign"];

export default function VerifyPhonePage() {
  const { t, language } = useTranslation();
  const [state, setState] = useState(null); // GET answer
  const [loadFailed, setLoadFailed] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(null); // { masked, resendAt }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // masked number once verified
  const [now, setNow] = useState(() => Date.now());
  // { needCents, balanceCents } after a 402 — the top-up panel replaces the error.
  const [noCredit, setNoCredit] = useState(null);
  const [topupBusy, setTopupBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (async () => {
      // Back from the phone & text top-up's Checkout: settle it before reading
      // the balance, and say what happened rather than going quiet.
      const params = new URLSearchParams(window.location.search);
      const session = params.get("topup");
      if (session) {
        const settled = await fetchJson(`/api/settings/voice/topup?session_id=${encodeURIComponent(session)}`).catch(() => null);
        setNotice(
          settled?.credited || settled?.alreadyCredited
            ? t("app.phoneVerify.topupDone", "Phone & text credit added. You can send the code now.")
            : t("app.phoneVerify.topupPending", "We couldn't confirm that payment yet. If it went through, the credit arrives within a minute or two — refresh to check."),
        );
      } else if (params.get("demo_topup")) {
        setNotice(t("app.phoneVerify.topupDone", "Phone & text credit added. You can send the code now."));
      }
      if (session || params.get("demo_topup")) window.history.replaceState(null, "", window.location.pathname);
      await fetchJson("/api/settings/phone-verification")
        .then(setState)
        .catch(() => setLoadFailed(true));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCreditTopup() {
    setTopupBusy(true);
    try {
      const got = await fetchJson("/api/settings/voice/topup", { method: "POST", body: { cents: VERIFY_TOPUP_CENTS, returnTo: "verify-phone" } });
      if (got?.checkoutUrl) window.location.assign(got.checkoutUrl);
    } catch (err) {
      setError(err?.message || t("app.phoneVerify.err.unavailable", "We can't text a code right now. Try again in a few minutes."));
    } finally {
      setTopupBusy(false);
    }
  }

  // The resend countdown, ticking only while there is one.
  useEffect(() => {
    if (!sent?.resendAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sent?.resendAt]);

  const refusal = (err) => {
    const key = err?.data?.reasonKey;
    return key ? t(`app.phoneVerify.err.${key}`, err.message) : err?.message || t("app.phoneVerify.err.unavailable", "We can't text a code right now. Try again in a few minutes.");
  };

  async function send() {
    setBusy(true);
    setError("");
    setNoCredit(null);
    try {
      const got = await fetchJson("/api/settings/phone-verification", { method: "POST", body: { action: "send", phone } });
      setSent({ masked: got.masked, resendAt: Date.now() + (Number(got.resendInSeconds) || 60) * 1000 });
      setCode("");
    } catch (err) {
      if (err?.data?.reasonKey === "no_phone_credit") {
        setNoCredit({ needCents: err.data.needCents, balanceCents: err.data.balanceCents });
      } else {
        setError(refusal(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    setBusy(true);
    setError("");
    try {
      const got = await fetchJson("/api/settings/phone-verification", { method: "POST", body: { action: "check", code } });
      setDone(got.masked || sent?.masked || "");
    } catch (err) {
      setError(refusal(err));
    } finally {
      setBusy(false);
    }
  }

  const resendIn = sent?.resendAt ? Math.max(0, Math.ceil((sent.resendAt - now) / 1000)) : 0;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Smartphone size={20} className="text-muted-foreground" aria-hidden="true" />
          {t("app.phoneVerify.title", "Verify your mobile number")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.phoneVerify.why",
            "During your free trial, a few features cost FieldQuo real money every time they run. To keep them for real businesses, we ask for one mobile number first. We text you a code — it takes a minute. Choosing a plan unlocks them too.",
          )}
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground">{t("app.phoneVerify.featuresTitle", "Unlocked by verifying:")}</h2>
        <ul className="mt-2 space-y-1 text-sm text-foreground list-disc pl-5">
          {FEATURES.map((f) => (
            <li key={f}>{t(`app.phoneVerify.feature.${f}`)}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-3">
          {t("app.phoneVerify.everythingElse", "Everything else in your trial works without it.")}
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-3" data-verify-phone>
        {loadFailed ? (
          <p className="text-sm text-muted-foreground">{t("app.phoneVerify.loadFailed", "Couldn't load this page. Refresh to try again.")}</p>
        ) : !state ? (
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        ) : done !== null || state.verified ? (
          <p className="text-sm text-foreground flex items-start gap-2">
            <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            {t("app.phoneVerify.done", "Your mobile {number} is verified. Everything above is unlocked for your trial.", { number: done || state.masked || "" })}
          </p>
        ) : !state.required ? (
          <p className="text-sm text-muted-foreground">
            {state.reason === "no_delivery_path"
              ? t("app.phoneVerify.notAvailable", "Verification by text isn't available in your country yet, so these features are open during your trial.")
              : t("app.phoneVerify.notNeeded", "Your account doesn't need to verify a phone — these features are already open to you.")}
          </p>
        ) : !state.canVerify ? (
          <p className="text-sm text-muted-foreground">{t("app.phoneVerify.ownerOnly", "Only the owner or an admin can verify the company's phone. Ask them to open this page.")}</p>
        ) : !sent ? (
          <>
          {notice && <p className="text-sm text-foreground" role="status">{notice}</p>}
          {state.cost && (
            <p className="text-xs text-muted-foreground" data-verify-cost>
              {t(
                "app.phoneVerify.cost",
                "A code costs about {cost} of your phone & text credit (the number check and the text). You have {balance}.",
                { cost: credit(state.cost.firstCents, language), balance: credit(state.cost.balanceCents, language) },
              )}
            </p>
          )}
          {noCredit && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2 text-sm" data-verify-no-credit>
              <p className="text-foreground">
                {t(
                  "app.phoneVerify.noCredit",
                  "Verifying costs {need} of your phone & text credit, and you have {balance}. Add credit, then send the code — what's left stays for texts and calls.",
                  { need: credit(noCredit.needCents, language), balance: credit(noCredit.balanceCents, language) },
                )}
              </p>
              <button
                type="button"
                onClick={startCreditTopup}
                disabled={topupBusy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50"
              >
                {topupBusy && <Loader2 size={14} className="animate-spin" />}
                {t("app.phoneVerify.topupButton", "Add {amount} of phone & text credit", { amount: credit(VERIFY_TOPUP_CENTS, language) })}
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (phone.trim() && !busy) send();
            }}
            className="space-y-3"
          >
            <label className="block">
              <span className="text-sm font-medium text-foreground">{t("app.phoneVerify.phoneLabel", "Mobile number")}</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder="(514) 555-0123"
              />
              <span className="block text-xs text-muted-foreground mt-1">
                {t("app.phoneVerify.phoneHint", "A US or Canadian mobile with a SIM card. Internet (VoIP) numbers can't be used. One number verifies one trial.")}
              </span>
            </label>
            {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={busy || !phone.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {t("app.phoneVerify.send", "Text me a code")}
            </button>
          </form>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim() && !busy) check();
            }}
            className="space-y-3"
          >
            <p className="text-sm text-foreground">
              {t("app.phoneVerify.sentTo", "We texted a 6-digit code to {number}. It expires in 10 minutes.", { number: sent.masked })}
            </p>
            <label className="block">
              <span className="text-sm font-medium text-foreground">{t("app.phoneVerify.codeLabel", "Code")}</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="mt-1 w-40 rounded-lg border border-border bg-background px-3 py-2 text-lg tracking-widest text-foreground"
              />
            </label>
            {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {t("app.phoneVerify.check", "Verify")}
              </button>
              <button
                type="button"
                onClick={send}
                disabled={busy || resendIn > 0}
                className="text-sm text-foreground underline disabled:no-underline disabled:text-muted-foreground"
              >
                {resendIn > 0
                  ? t("app.phoneVerify.resendIn", "You can ask for a new code in {seconds} s.", { seconds: resendIn })
                  : t("app.phoneVerify.resend", "Send a new code")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSent(null);
                  setCode("");
                  setError("");
                }}
                className="text-sm text-muted-foreground underline"
              >
                {t("app.phoneVerify.changeNumber", "Use a different number")}
              </button>
            </div>
          </form>
        )}
      </div>

      {state?.required && done === null && (
        <p className="text-sm">
          <Link href="/app/settings/account-billing" className="underline text-foreground">
            {t("app.phoneVerify.choosePlan", "Choose a plan instead")}
          </Link>
        </p>
      )}
    </div>
  );
}
