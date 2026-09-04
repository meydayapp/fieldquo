// app/verify-email/page.js
//
// Where the confirm-your-email link lands.
//
// ── Three arrival shapes, because only one of them is configured today ─────
//
// As lib/auth.js has it, the emailed link points at Better Auth's OWN endpoint
// (/api/auth/verify-email?token=…&callbackURL=/verify-email). That endpoint
// does the verifying and then forwards here — bare on success, or carrying
// ?error=TOKEN_EXPIRED / INVALID_TOKEN / USER_NOT_FOUND / INVALID_USER when the
// token is dead. So the ordinary happy path arrives with NO token and NO error.
//
// A link that hands this page the raw ?token= instead is equally valid, and is
// one line away in authEmails.js. Handling it too costs a branch; not handling
// it would make this page's correctness depend on a file it doesn't own, and
// the symptom would be a permanent "we couldn't confirm this" on a link that
// was perfectly good.
//
// The bare arrival is the one that needs care, because "no news" has to be
// read as good news for the flow to work at all — somebody opening the link on
// their phone has no session here, and there is nothing else to go on. Where
// there IS a session we use it, since it is the only definitive answer
// available; without one we take the redirect at its word. Wrongly saying
// "confirmed" to somebody who typed the URL grants nothing and unlocks nothing
// (requireEmailVerification is false), whereas wrongly saying "we couldn't
// confirm this" sends a real contractor round the loop again for no reason.
"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient, sendVerificationEmail } from "@/lib/auth-client";
import MarketingHeader from "@/app/components/marketing/MarketingHeader";
// Shared with /login and /signup rather than a fourth copy — see the note on
// the same import in app/forgot-password/page.js.
import {
  fieldClass,
  FIELD_LABEL,
  PRIMARY_BUTTON,
} from "@/app/components/auth/fieldStyles";
import { useTranslation } from "@/app/hooks/useTranslation";

function Shell({ children }) {
  return (
    <>
      <MarketingHeader />
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-muted px-4 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </>
  );
}

function VerifyEmail() {
  const { t } = useTranslation();

  // Next 16: the `searchParams` page prop is a Promise, and reading it
  // synchronously gives undefined. This page is interactive, so it reads the
  // client-side equivalent instead — which needs the Suspense boundary below.
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");

  // "checking" | "done" | "expired" | "invalid" | "already"
  const [state, setState] = useState("checking");
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");

  // React runs effects twice in development. The exchange below is a network
  // call that changes server state, so it gets a one-shot guard rather than
  // being left to fire twice and have the second attempt report a failure over
  // the top of the first one's success.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;

    (async () => {
      // Asked for in every branch: it decides whether the way forward is "sign
      // in" or "carry on into the app", and it answers the no-token arrival.
      // Same shape as the invitation page's session probe.
      const session = await fetch("/api/auth/get-session")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      if (cancelled) return;

      const user = session?.user || null;
      setSignedIn(Boolean(user));
      if (user?.email) setEmail(user.email);

      if (linkError) {
        setState(mapLinkError(linkError));
        return;
      }

      if (token) {
        // The one call that goes through authClient rather than a named
        // export: lib/auth-client.js re-exports the three endpoints the reset
        // flow needs, and verifyEmail isn't one of them. Reached this way it
        // is the same proxied endpoint — GET /api/auth/verify-email.
        const { error: verifyError } = await authClient.verifyEmail({
          query: { token },
        });
        if (cancelled) return;
        setState(verifyError ? mapLinkError(verifyError.code) : "done");
        return;
      }

      // Bare arrival — see the header. A session is definitive, so it wins in
      // both directions: it catches the signed-in person who typed this URL
      // without ever clicking a link, and it doesn't get in the way of the
      // phone that has no session at all.
      setState(!user || user.emailVerified ? "done" : "invalid");
    })();

    return () => {
      cancelled = true;
    };
  }, [token, linkError]);

  const resend = useCallback(
    async (e) => {
      e?.preventDefault();
      // Same reasoning as the reset form: a second link invalidates the first,
      // so a double tap is a link that stops working the moment it arrives.
      if (sending) return;

      setSending(true);
      setError("");

      // No callbackURL, for the reason app/forgot-password/page.js spells out
      // on redirectTo: lib/auth.js owns the landing page, and a literal here
      // would outrank it and then rot on its own.
      const { error: sendError } = await sendVerificationEmail({
        email: email.trim(),
      });

      setSending(false);

      if (sendError) {
        if (sendError.code === "EMAIL_ALREADY_VERIFIED") {
          setState("already");
          return;
        }
        // Only reachable while signed in, and only for an address that isn't
        // the one on the session — so naming it leaks nothing, and the generic
        // "couldn't send" would leave them retrying an address this endpoint
        // will refuse every time.
        if (sendError.code === "EMAIL_MISMATCH") {
          setError(t("app.auth.verify.mismatch"));
          return;
        }
        setError(t("app.auth.sendFailed"));
        return;
      }

      setResent(true);
    },
    [email, sending, t],
  );

  if (state === "checking") {
    return (
      <Shell>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <div className="animate-pulse text-sm text-muted-foreground">
            {t("app.auth.verify.checking")}
          </div>
        </div>
      </Shell>
    );
  }

  if (state === "done" || state === "already") {
    return (
      <Shell>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <h1 className="text-lg font-semibold text-foreground">
            {state === "done"
              ? t("app.auth.verify.doneTitle")
              : t("app.auth.verify.alreadyTitle")}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {state === "done"
              ? t("app.auth.verify.doneBody")
              : t("app.auth.verify.alreadyBody")}
          </p>
          {/* Confirming does NOT sign anyone in — lib/auth.js leaves
              autoSignInAfterVerification off deliberately — but the person who
              signed up on this device is usually still signed in, and the
              person who opened the link on their phone isn't. Sending the first
              one to a login form is the small indignity that makes software
              feel stupid, so the button asks before it decides. */}
          <Link
            href={signedIn ? "/app" : "/login"}
            className="mt-6 block w-full bg-inverted text-inverted-foreground py-3 rounded-lg text-sm font-semibold"
          >
            {signedIn ? t("app.auth.verify.continue") : t("app.auth.signIn")}
          </Link>
        </div>
      </Shell>
    );
  }

  // Everything below is the "we couldn't confirm it" case: a plain sentence
  // about what happened, and a form that fixes it without leaving the page.
  return (
    <Shell>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {state === "expired"
            ? t("app.auth.verify.expiredTitle")
            : t("app.auth.verify.invalidTitle")}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {state === "expired"
            ? t("app.auth.verify.expiredBody")
            : t("app.auth.verify.invalidBody")}
        </p>
      </div>

      {resent ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <h2 className="text-sm font-semibold text-foreground">
            {t("app.auth.verify.resentTitle")}
          </h2>
          {/* Worded the same way as the password page's confirmation, and for
              the same reason: this endpoint answers identically for an address
              that has no account, and the copy must not undo that. */}
          <p className="text-sm text-muted-foreground mt-2">
            {t("app.auth.verify.resentBody")}
          </p>
        </div>
      ) : (
        <form
          onSubmit={resend}
          className="bg-card border border-border rounded-xl p-6 space-y-4"
        >
          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            {/* htmlFor/id, which this field did not have — same defect, same
                fix, as the sibling recovery pages. */}
            <label htmlFor="verify-email-address" className={FIELD_LABEL}>
              {t("app.auth.emailLabel")}
            </label>
            <input
              id="verify-email-address"
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
            disabled={sending}
            className={PRIMARY_BUTTON}
          >
            {sending
              ? t("app.auth.verify.resending")
              : t("app.auth.verify.resend")}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link href="/login" className="font-medium text-foreground underline">
          {t("app.auth.backToSignIn")}
        </Link>
      </p>
    </Shell>
  );
}

// Better Auth reports a dead token four ways and only one of them is about
// time. "Expired" is the reassuring reading and the common one, so it gets its
// own copy; everything else — a truncated link, a token for a user that no
// longer exists, a link opened while signed in as somebody else — lands on the
// wording that doesn't guess.
function mapLinkError(code) {
  if (code === "TOKEN_EXPIRED") return "expired";
  if (code === "EMAIL_ALREADY_VERIFIED") return "already";
  return "invalid";
}

function Loading() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="animate-pulse text-sm text-muted-foreground">
        {t("app.auth.loading")}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <VerifyEmail />
    </Suspense>
  );
}
