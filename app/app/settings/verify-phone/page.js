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
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Smartphone } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

const FEATURES = ["sms", "phone_number", "crew_line", "business_number", "ai_call", "video_post", "email_campaign"];

export default function VerifyPhonePage() {
  const { t } = useTranslation();
  const [state, setState] = useState(null); // GET answer
  const [loadFailed, setLoadFailed] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(null); // { masked, resendAt }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // masked number once verified
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    fetchJson("/api/settings/phone-verification")
      .then(setState)
      .catch(() => setLoadFailed(true));
  }, []);

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
    try {
      const got = await fetchJson("/api/settings/phone-verification", { method: "POST", body: { action: "send", phone } });
      setSent({ masked: got.masked, resendAt: Date.now() + (Number(got.resendInSeconds) || 60) * 1000 });
      setCode("");
    } catch (err) {
      setError(refusal(err));
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
