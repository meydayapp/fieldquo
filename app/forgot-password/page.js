// app/forgot-password/page.js
//
// "I can't get into my own business." That is the state of mind this page
// meets, so it says one thing, asks for one thing, and never argues.
//
// ── The rule that shapes every branch below ────────────────────────────────
//
// THE ANSWER IS THE SAME WHETHER OR NOT THE ADDRESS HAS AN ACCOUNT.
//
// "If that address has an account, we've sent a link." Never "no account
// found", never "that email isn't registered", never a different-looking
// error for a miss. The moment the two cases render differently, this form
// stops being a password reset and becomes a lookup tool: type a competitor's
// address, read the response, learn whether that contractor runs on FieldQuo.
// Do that a few thousand times and you have our customer list.
//
// Better Auth already returns the same 200 for both cases (it even burns the
// same time on a dummy verification lookup to keep the timing flat), so the
// only way to leak it is from HERE — by "improving" the copy into something
// more helpful. Don't. The helpfulness is worth less than the customer list.
//
// The one channel that would survive all of that is a failing mail send:
// sendResetPassword runs only for an address that exists, so an exception
// escaping it would 500 for real accounts and 200 for everyone else. It can't,
// because lib/auth.js wraps the send in a try/catch that records the fault and
// returns normally. That is load-bearing, not tidiness — and the generic
// one-sentence error below is the second half of the same guarantee.
"use client";

import { useState } from "react";
import Link from "next/link";
// requestPasswordReset, not forgetPassword: both are exported from
// lib/auth-client.js and they are the same function, but the real endpoint in
// Better Auth 1.6 is POST /request-password-reset, so this is the name that
// matches what actually travels.
import { requestPasswordReset } from "@/lib/auth-client";
import MarketingHeader from "@/app/components/marketing/MarketingHeader";
// The shared field styles, not a fourth copy of the class string. This page,
// /reset-password and /verify-email each carried their own `inputClass`, and
// they had already drifted from the pair /login and /signup use: no focus
// ring, no --destructive, no dark values, and a 40px button on a page a
// contractor reaches on a phone. fieldStyles.js's header says the copy is the
// one that rots; these were the copies.
import {
  fieldClass,
  FIELD_LABEL,
  PRIMARY_BUTTON,
} from "@/app/components/auth/fieldStyles";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function send(e) {
    e?.preventDefault();
    // Belt and braces with `disabled` on the button: a keyboard Enter, a
    // double-tap on a phone, or a slow connection can all fire this twice, and
    // two reset links in the inbox means the first one is already dead when
    // they click it.
    if (submitting) return;

    setSubmitting(true);
    setError("");

    // No `redirectTo` on purpose. lib/auth.js owns where the emailed link
    // lands (RESET_PAGE) and rewrites the URL Better Auth built. Passing one
    // from here would win over that and quietly pin the landing page to a
    // literal in this file — so the day RESET_PAGE moves, every OTHER entry
    // point would follow it and this one would keep sending people to a route
    // that no longer exists.
    //
    // The link goes to /api/auth/reset-password/:token first either way, which
    // checks the token is still alive and forwards to the page with ?token=
    // (valid) or ?error=… (expired, used, or fabricated). Both are handled
    // there.
    const { error: sendError } = await requestPasswordReset({
      email: email.trim(),
    });

    setSubmitting(false);

    if (sendError) {
      // Deliberately one sentence for every failure mode, with no mention of
      // the address. See the header.
      setError(t("app.auth.sendFailed"));
      return;
    }

    setResent(sent);
    setSent(true);
  }

  return (
    <>
      <MarketingHeader />
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-muted px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {sent ? t("app.auth.forgot.sentTitle") : t("app.auth.forgot.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {sent
                ? t("app.auth.forgot.sentBody")
                : t("app.auth.forgot.subtitle")}
            </p>
          </div>

          {sent ? (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                {resent
                  ? t("app.auth.forgot.resentHint")
                  : t("app.auth.forgot.sentHint")}
              </p>

              <button
                type="button"
                onClick={send}
                disabled={submitting}
                className={PRIMARY_BUTTON}
              >
                {submitting
                  ? t("app.auth.forgot.submitting")
                  : t("app.auth.forgot.resend")}
              </button>

              {/* The commonest reason nothing arrives is a typo in the address,
                  and we can't tell them that — so give them the door back to
                  the field instead of a diagnosis we're not allowed to make. */}
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setResent(false);
                  setError("");
                }}
                className="w-full text-sm text-muted-foreground py-3"
              >
                {t("app.auth.forgot.different")}
              </button>
            </div>
          ) : (
            <form
              onSubmit={send}
              className="bg-card border border-border rounded-xl p-6 space-y-4"
            >
              {error && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <div>
                {/* htmlFor/id, which this field did not have. Tapping the word
                    "Email" on a phone did nothing and a screen reader read an
                    unlabelled box — the same defect /login carried until it
                    was fixed there, on the page one link away from this one. */}
                <label htmlFor="forgot-email" className={FIELD_LABEL}>
                  {t("app.auth.emailLabel")}
                </label>
                <input
                  id="forgot-email"
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldClass(false)}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={PRIMARY_BUTTON}
              >
                {submitting
                  ? t("app.auth.forgot.submitting")
                  : t("app.auth.forgot.submit")}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link href="/login" className="font-medium text-foreground underline">
              {t("app.auth.backToSignIn")}
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
