// app/verify-email/VerifyEmail.js
//
// Where the confirm-your-email link lands. ./page.js is the server wrapper
// that picks the language; this is the page.
//
// ── Two arrival shapes ─────────────────────────────────────────────────────
//
// 1. ?token=…&lang=… — every link sent since 2026-09-25 (lib/authLinks.js
//    verifyPageLink). The page posts the token to /api/verify-email, which
//    confirms it through Better Auth and answers with the ADDRESS it was for
//    and how the browser's session relates to it. That is what lets the page
//    say "emilio@… is confirmed" and, when somebody else is signed in on this
//    browser, say THAT instead of waving them on into the other account's
//    company — which is what the owner got when he opened his link while
//    signed in as a second test account.
//
// 2. Bare, or ?error=… — Better Auth's own endpoint redirecting here, which is
//    how every link sent BEFORE that date works (they live 24 hours). No
//    address to go on, so the session is used where there is one; without
//    one "no news" is read as good news, because wrongly saying "confirmed"
//    to somebody who typed the URL grants nothing (requireEmailVerification is
//    false), whereas wrongly saying "we couldn't confirm this" sends a real
//    contractor round the loop again for no reason.
"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sendVerificationEmail, signOut } from "@/lib/auth-client";
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
  // The address the link was for, from a token the server verified — never
  // from the session. Empty on a bare arrival, which cannot know it.
  const [confirmedEmail, setConfirmedEmail] = useState("");
  // Somebody OTHER than that address's owner is signed in on this browser:
  // their address, so the page can name both and let them choose.
  const [otherAccount, setOtherAccount] = useState("");
  const [switching, setSwitching] = useState(false);
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
        // app/api/verify-email: Better Auth does the confirming; the route
        // adds whose address it was and who is signed in here. Its answer is
        // the only one used — the session above is not consulted for a
        // tokened arrival, because the session may be somebody else.
        const res = await fetch("/api/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }).catch(() => null);
        const outcome = res?.ok ? await res.json().catch(() => null) : null;
        if (cancelled) return;
        if (!outcome?.state) {
          // Unreachable or refused (a 429, a read-only support session): say
          // we could not confirm it, with the resend form — never "done".
          setState("invalid");
          return;
        }
        const relation = outcome.account?.relation;
        setSignedIn(relation === "same");
        setOtherAccount(relation === "other" ? outcome.account?.email || "" : "");
        if (outcome.email) {
          setConfirmedEmail(outcome.email);
          setEmail(outcome.email);
        }
        setState(outcome.state);
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

  // "Continue as <the confirmed address>": the other account is signed out
  // here, on this browser, and sign-in opens with the confirmed address in
  // the box. Nothing is decided for them — staying is the other button.
  const continueAsConfirmed = useCallback(async () => {
    if (switching) return;
    setSwitching(true);
    const to = confirmedEmail ? `/login?email=${encodeURIComponent(confirmedEmail)}` : "/login";
    const { error: outError } = await signOut().catch((err) => ({ error: err || true }));
    if (outError) {
      setSwitching(false);
      setError(t("app.auth.sendFailed"));
      return;
    }
    window.location.href = to;
  }, [confirmedEmail, switching, t]);

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
    const title = state === "done" ? t("app.auth.verify.doneTitle") : t("app.auth.verify.alreadyTitle");
    // Named when the link said whose it was. The generic sentence is only for
    // the bare arrival, which cannot know.
    const body = confirmedEmail
      ? t(state === "done" ? "app.auth.verify.confirmedAddress" : "app.auth.verify.alreadyAddress", { email: confirmedEmail })
      : t(state === "done" ? "app.auth.verify.doneBody" : "app.auth.verify.alreadyBody");
    return (
      <Shell>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-2 break-words">{body}</p>
          {/* A bare arrival (a link sent before 2026-09-25) cannot know whose
              address it confirmed. It can at least never be silent about
              whose account the Continue button below opens. */}
          {!confirmedEmail && signedIn && email && (
            <p className="text-sm text-muted-foreground mt-2 break-words">
              {t("app.auth.verify.signedInAs", { email })}
            </p>
          )}

          {otherAccount ? (
            // ── Signed in as somebody else ───────────────────────────────
            // The address is confirmed; the SESSION is another account, and
            // "Continue" would have carried them into that account's company
            // without a word. Both accounts are named, and the choice is
            // theirs: this is the only state on the page with two buttons.
            <div data-verify-other-account>
              <p className="text-sm text-foreground mt-4 break-words">
                {t("app.auth.verify.otherSession", { other: otherAccount })}
              </p>
              {error && (
                <p className="text-sm text-red-700 dark:text-red-300 mt-3">{error}</p>
              )}
              <button
                type="button"
                onClick={continueAsConfirmed}
                disabled={switching}
                className={`mt-6 ${PRIMARY_BUTTON}`}
              >
                {t("app.auth.switch.continueAs", { email: confirmedEmail })}
              </button>
              <Link
                href="/app"
                className="mt-3 block w-full text-sm font-medium text-muted-foreground underline hover:text-foreground break-words"
              >
                {t("app.auth.switch.stayAs", { other: otherAccount })}
              </Link>
            </div>
          ) : (
            // Confirming does NOT sign anyone in — lib/auth.js leaves
            // autoSignInAfterVerification off deliberately — but the person
            // who signed up on this device is usually still signed in, and the
            // person who opened the link on their phone isn't. Sending the
            // first one to a login form is the small indignity that makes
            // software feel stupid, so the button asks before it decides; the
            // second gets the confirmed address already in the box.
            <Link
              href={signedIn ? "/app" : confirmedEmail ? `/login?email=${encodeURIComponent(confirmedEmail)}` : "/login"}
              className="mt-6 block w-full bg-inverted text-inverted-foreground py-3 rounded-lg text-sm font-semibold"
            >
              {signedIn ? t("app.auth.verify.continue") : t("app.auth.signIn")}
            </Link>
          )}
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

          {/* A new link for this address cannot be sent while another account
              is signed in here — Better Auth refuses it as EMAIL_MISMATCH. Said
              before they try, with the way through. */}
          {otherAccount && confirmedEmail && (
            <div className="text-sm text-muted-foreground break-words" data-verify-other-account>
              <p>{t("app.auth.verify.otherSessionResend", { other: otherAccount, email: confirmedEmail })}</p>
              <button
                type="button"
                onClick={continueAsConfirmed}
                disabled={switching}
                className="mt-2 font-medium text-foreground underline"
              >
                {t("app.auth.switch.continueAs", { email: confirmedEmail })}
              </button>
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
