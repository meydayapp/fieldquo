"use client";
// app/components/layout/EmailVerifyBanner.js
//
// "Confirm your email address — we sent a link to you@…"
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// Signup does not require the address to be confirmed (lib/auth.js says why:
// blocking sign-in would lock out someone who paid sixty seconds ago). The
// price of that choice is an unproven address — the one a password reset is
// sent to. Until 2026-09-14 nothing inside /app ever mentioned it again: the
// one email went out at signup, expired in a day, and a typo'd or ignored
// address surfaced only on the day they needed a reset and none arrived.
//
// So: a strip above every screen, for an unconfirmed login only, with the
// resend right there. It is a nudge, not a gate — nothing behind it is
// withheld — which is why "Later" exists and hides it for this browser
// session. It comes back next session, because the risk it names does not go
// away on its own.
//
// ── Not during a read-only support session ─────────────────────────────────
//
// An impersonating admin is looking at the customer's screens on their own
// Better Auth session, so the banner would be about the ADMIN's address —
// true, but meaningless on that screen and one more strip of chrome over the
// thing they came to look at. The status endpoint is read only in the rare
// case the login is unconfirmed; the common case costs no request.

import { useEffect, useState } from "react";
import { MailCheck, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSession, sendVerificationEmail } from "@/lib/auth-client";

const LATER_KEY = "fq.emailVerifyBanner.later";

export default function EmailVerifyBanner() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user || null;
  const unconfirmed = Boolean(user?.email) && user.emailVerified === false;

  const [later, setLater] = useState(true); // hidden until the session flag is read
  const [impersonating, setImpersonating] = useState(null); // null = not asked
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      setLater(sessionStorage.getItem(LATER_KEY) === "1");
    } catch {
      setLater(false);
    }
  }, []);

  useEffect(() => {
    if (!unconfirmed || impersonating !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/impersonation/status");
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setImpersonating(Boolean(data?.active));
      } catch {
        // Unknown → treat as not impersonating; the strip is a nudge, and
        // hiding it on a failed read would hide it from the person it is for.
        if (!cancelled) setImpersonating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unconfirmed, impersonating]);

  if (!unconfirmed || later || impersonating !== false) return null;

  async function resend() {
    if (sending) return;
    setSending(true);
    setError("");
    // No callbackURL: lib/auth.js puts the landing page on the link itself
    // (the same reasoning app/verify-email/page.js gives).
    const { error: sendError } = await sendVerificationEmail({ email: user.email });
    setSending(false);
    if (sendError) {
      if (sendError.code === "EMAIL_ALREADY_VERIFIED") {
        // The session is stale — confirmed on another device. Hide it.
        setLater(true);
        return;
      }
      setError(t("app.auth.sendFailed"));
      return;
    }
    setSent(true);
  }

  function dismiss() {
    try {
      sessionStorage.setItem(LATER_KEY, "1");
    } catch {
      // Nothing to store into; it simply comes back on the next screen.
    }
    setLater(true);
  }

  return (
    <div
      className="border-b border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100"
      role="status"
      data-email-verify-banner
    >
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <MailCheck size={16} className="shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 break-words">
          {sent
            ? t("app.auth.verifyBanner.sent", { email: user.email })
            : t("app.auth.verifyBanner.body", { email: user.email })}
          {error ? <span className="ml-2 text-red-700 dark:text-red-300">{error}</span> : null}
        </p>
        {!sent ? (
          <button
            type="button"
            onClick={resend}
            disabled={sending}
            className="font-medium underline underline-offset-2 disabled:opacity-60"
            data-email-verify-resend
          >
            {sending ? t("app.auth.verify.resending") : t("app.auth.verifyBanner.resend")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex items-center gap-1 text-amber-900/80 dark:text-amber-200/80 hover:text-amber-950 dark:hover:text-amber-100"
          aria-label={t("app.auth.verifyBanner.later")}
          data-email-verify-later
        >
          <span className="hidden sm:inline">{t("app.auth.verifyBanner.later")}</span>
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
