// app/login/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, sendVerificationEmail } from "@/lib/auth-client";
import MarketingHeader from "@/app/components/marketing/MarketingHeader";
import AuthShell from "@/app/components/auth/AuthShell";
import AuthAside from "@/app/components/auth/AuthAside";
import {
  fieldClass,
  FIELD_LABEL,
  PRIMARY_BUTTON,
} from "@/app/components/auth/fieldStyles";
import { useTranslation } from "@/app/hooks/useTranslation";
import { isInternalPath } from "@/lib/appUrl";
import { signInErrorText } from "@/lib/authErrors";
import { CAPTURE_ENDPOINT } from "@/lib/signup/leadCapture";
import { RESUME_ACTIONS, safeResumeTarget } from "@/lib/signup/resumeRoute";

// Only ever an internal path. Guards against `?next=//evil.com`, `?next=/\evil.com`
// and absolute URLs turning the login form into an open redirect. The rule
// itself lives in lib/appUrl so every `next` sink applies the same one.
function safeNext(raw) {
  return isInternalPath(raw) ? raw : "/app";
}

export default function LoginPage() {
  const router = useRouter();
  const { t, setPageLanguage } = useTranslation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Where to land after login. Default /app; set from ?next when a flow (e.g.
  // "add this quote to your project") sent the contractor here to sign in.
  // Read from window rather than useSearchParams to avoid forcing a Suspense
  // boundary on this route — the same pattern the quote pages use.
  const [next, setNext] = useState("/app");
  // ── Arrived from a resume link whose address already has a login ────────
  //
  // /signup sends ?resume=<token> here instead of showing the account step
  // (lib/signup/resumeRoute.js). The token names the address and the
  // business they were setting up, so the box is filled and the sentence
  // says why they are signing in rather than signing up — and, when the
  // address was never confirmed, offers the confirmation link again. The
  // token signs nobody in: the password below is still the only key.
  const [resumeNote, setResumeNote] = useState(null);
  const [verifySend, setVerifySend] = useState("idle"); // idle | sending | sent | failed | mismatch
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("resume");
    if (!token) return;
    let cancelled = false;
    fetch(`${CAPTURE_ENDPOINT}?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.prefill?.email || !d.route) return;
        // The resume link's language, for this page only — never stored
        // (app/providers/LanguageProvider.js). A signed-in account's own
        // preference still outranks it.
        if (d.prefill.language) setPageLanguage(d.prefill.language);
        const after = safeResumeTarget(d.route.next);
        if (after) setNext(after);
        if (d.route.action !== RESUME_ACTIONS.SIGN_IN && d.route.action !== RESUME_ACTIONS.SWITCH) return;
        setForm((f) => (f.email ? f : { ...f, email: d.prefill.email }));
        setResumeNote({
          email: d.prefill.email,
          company: d.prefill.companyName || "",
          finished: Boolean(d.route.finished),
          verified: d.route.verified !== false,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Once, on arrival. setPageLanguage is the provider's stable callback.
  }, []);

  const resendVerification = async () => {
    if (!resumeNote?.email || verifySend === "sending") return;
    setVerifySend("sending");
    // No callbackURL: lib/auth.js owns the landing page and its language.
    const { error: sendError } = await sendVerificationEmail({ email: resumeNote.email });
    if (!sendError) return setVerifySend("sent");
    // Confirmed since the page loaded: nothing was sent, so "Sent" would be a
    // lie — the unconfirmed line simply goes away.
    if (sendError.code === "EMAIL_ALREADY_VERIFIED") {
      setResumeNote((n) => (n ? { ...n, verified: true } : n));
      return setVerifySend("idle");
    }
    setVerifySend(sendError.code === "EMAIL_MISMATCH" ? "mismatch" : "failed");
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(safeNext(params.get("next")));
    // ?email= arrives from the signup form's "this email already has a login
    // — sign in instead". An address is not a secret, and typing it a second
    // time is the moment people mistype it.
    const email = String(params.get("email") || "").trim();
    if (email) setForm((f) => (f.email ? f : { ...f, email }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const { error: signInError } = await signIn.email({
      email: form.email,
      password: form.password,
    });

    setSubmitting(false);

    if (signInError) {
      // Never signInError.message. That is Better Auth's own English string,
      // so it dropped an English sentence into a French page — and it made a
      // dropped connection, a rate limit and a wrong password read identically,
      // which sends somebody whose password was fine off into the reset flow.
      // lib/authErrors.js picks which of the three this is.
      setError(signInErrorText(t, signInError));
      return;
    }

    router.push(next);
    router.refresh();
  };

  return (
    <>
      <MarketingHeader />
      <AuthShell
        eyebrow={t("app.auth.login.eyebrow", "Log in")}
        title={t("app.auth.login.title", "Welcome back")}
        subtitle={t(
          "app.auth.login.subtitle",
          "Pick up where you left off — quotes to send, jobs to schedule, invoices to chase.",
        )}
        aside={<AuthAside variant="login" />}
      >
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8 space-y-5"
        >
          {resumeNote && (
            <div
              className="bg-muted border border-border text-foreground text-sm rounded-lg px-4 py-3 space-y-2 break-words"
              data-login-resume-note
            >
              <p>
                {resumeNote.finished
                  ? t("app.auth.login.resumeFinished")
                  : resumeNote.company
                    ? t("app.auth.login.resumeUnfinished", { company: resumeNote.company })
                    : t("app.auth.login.resumeUnfinishedNoName")}
              </p>
              {!resumeNote.verified && (
                <div>
                  <p className="text-muted-foreground">
                    {t("app.auth.login.unverified", { email: resumeNote.email })}
                  </p>
                  {verifySend === "sent" ? (
                    <p className="mt-1 font-medium">{t("app.auth.login.resentVerify", { email: resumeNote.email })}</p>
                  ) : (
                    <button
                      type="button"
                      onClick={resendVerification}
                      disabled={verifySend === "sending"}
                      className="mt-1 font-medium underline"
                    >
                      {verifySend === "sending" ? t("app.auth.verify.resending") : t("app.auth.login.resendVerify")}
                    </button>
                  )}
                  {verifySend === "mismatch" && (
                    <p className="mt-1 text-red-700 dark:text-red-300">{t("app.auth.verify.mismatch")}</p>
                  )}
                  {verifySend === "failed" && (
                    <p className="mt-1 text-red-700 dark:text-red-300">{t("app.auth.sendFailed")}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            {/* htmlFor/id, which no field on this page had: tapping the word
                "Email" on a phone did nothing, and a screen reader read the
                inputs as unlabelled. */}
            <label htmlFor="login-email" className={FIELD_LABEL}>
              {t("app.auth.login.email", "Email")}
            </label>
            <input
              id="login-email"
              required
              type="email"
              // Password managers fill this pair by autocomplete tokens. Without
              // them a returning contractor types their address every morning.
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={fieldClass(false)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className={FIELD_LABEL}>
                {t("app.auth.login.password", "Password")}
              </label>
              {/* The only route into the reset flow. Without a link here the
                  three pages behind it are reachable only by typing the URL,
                  which is the same as not shipping them. */}
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
              >
                {t("app.auth.forgotLink")}
              </Link>
            </div>
            <input
              id="login-password"
              required
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={fieldClass(false)}
            />
          </div>

          <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
            {submitting
              ? t("app.auth.login.submitting", "Logging in...")
              : t("app.auth.login.submit", "Log In")}
          </button>
        </form>

        <p className="text-sm text-muted-foreground mt-6">
          {t("app.auth.login.noAccount", "Don't have an account?")}{" "}
          <Link
            href={next !== "/app" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
            className="font-medium text-foreground underline"
          >
            {t("app.auth.login.startTrial", "Start your free trial")}
          </Link>
        </p>
      </AuthShell>
    </>
  );
}
