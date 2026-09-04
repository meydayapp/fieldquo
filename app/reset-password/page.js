// app/reset-password/page.js
//
// Where the link in the reset email lands. Four things can be true when
// somebody arrives, and all four have to produce a sentence and a way out —
// never a raw error code, never an empty card, never a form that can't work:
//
//   1. ?token=…            → the token was alive a moment ago. Show the form.
//   2. ?error=INVALID_TOKEN → expired, already used, or made up. Better Auth
//                             can't tell those apart (the row is consumed on
//                             use and simply absent afterwards), so neither can
//                             this page, and the copy covers both honestly.
//   3. neither              → somebody typed the URL, or an email client cut
//                             the link in half. Say so, offer a new one.
//   4. token dies between load and submit → the POST comes back INVALID_TOKEN,
//                             and the page flips to case 2 rather than leaving
//                             a red line above a form that will never succeed.
//
// The token never touches this app's own server: it goes straight back to
// Better Auth's /reset-password endpoint, which consumes it in the same
// transaction that sets the password.
//
// lib/auth.js sets revokeSessionsOnPasswordReset — every existing session dies
// with the old password. So "sign in again" isn't a nicety at the end of this,
// it is the only remaining state, and the success card has to offer it.
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth-client";
import MarketingHeader from "@/app/components/marketing/MarketingHeader";
// Shared with /login and /signup rather than a fourth copy — see the note on
// the same import in app/forgot-password/page.js.
import {
  fieldClass,
  FIELD_LABEL,
  PRIMARY_BUTTON,
} from "@/app/components/auth/fieldStyles";
import { useTranslation } from "@/app/hooks/useTranslation";

// Better Auth enforces 8–128 on the server from its own defaults; lib/auth.js
// sets neither minPasswordLength nor maxPasswordLength. Checking both here is
// what turns PASSWORD_TOO_LONG from an opaque failure into a field message —
// the same fix app/signup/page.js carries, and for the same reason.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

// How long the "Password updated" card stays up before we move them along.
// Long enough to read, short enough that nobody wonders if it worked.
const REDIRECT_MS = 2500;

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

// A dead end that isn't a dead end: every one of these carries the route
// forward, because "this link is broken" with nothing to click is the same as
// a blank screen to the person reading it.
function DeadEnd({ title, body, action }) {
  return (
    <Shell>
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{body}</p>
        <Link
          href="/forgot-password"
          className="mt-6 block w-full bg-inverted text-inverted-foreground py-3 rounded-lg text-sm font-semibold"
        >
          {action}
        </Link>
      </div>
    </Shell>
  );
}

function ResetPasswordForm() {
  const { t } = useTranslation();
  const router = useRouter();

  // In Next 16 the `searchParams` PAGE PROP is a Promise — reading it
  // synchronously yields undefined. This page is interactive top to bottom, so
  // it's a Client Component and uses the hook instead, which is the client-side
  // equivalent of awaiting that prop. The hook opts the tree out of
  // prerendering up to the nearest Suspense boundary, hence the wrapper below.
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");

  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // Set when the server tells us the token is gone. Kept separate from
  // `linkError` so a token that dies mid-session lands on the same screen as
  // one that arrived dead.
  const [tokenDead, setTokenDead] = useState(false);

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => router.push("/login"), REDIRECT_MS);
    return () => clearTimeout(id);
  }, [done, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    // The `disabled` attribute below already covers the mouse. This covers
    // Enter held down and a phone that fires the tap twice: resetPassword
    // CONSUMES the token, so a second request with the same one comes back
    // "Invalid token" — a success and a failure for one action, which reads
    // as the reset having failed when it actually worked.
    if (submitting) return;

    setError("");

    if (password.length < PASSWORD_MIN) {
      setError(t("app.auth.reset.tooShort"));
      return;
    }
    if (password.length > PASSWORD_MAX) {
      setError(t("app.auth.reset.tooLong"));
      return;
    }

    setSubmitting(true);

    const { error: resetError } = await resetPassword({
      newPassword: password,
      token,
    });

    if (resetError) {
      setSubmitting(false);
      const code = resetError.code || "";
      if (code === "INVALID_TOKEN" || code === "TOKEN_EXPIRED") {
        setTokenDead(true);
        return;
      }
      if (code === "PASSWORD_TOO_SHORT") {
        setError(t("app.auth.reset.tooShort"));
        return;
      }
      if (code === "PASSWORD_TOO_LONG") {
        setError(t("app.auth.reset.tooLong"));
        return;
      }
      setError(t("app.auth.reset.failed"));
      return;
    }

    // Deliberately NOT clearing `submitting`: the form is about to be replaced
    // by the success card, and re-enabling a button whose token no longer
    // exists would offer one last click that could only fail.
    setDone(true);
  }

  if (done) {
    return (
      <Shell>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <h1 className="text-lg font-semibold text-foreground">
            {t("app.auth.reset.doneTitle")}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {t("app.auth.reset.doneBody")}
          </p>
          {/* The timer above is the convenience; this is the guarantee. If the
              redirect is blocked or the tab was backgrounded, there is still a
              door. */}
          <Link
            href="/login"
            className="mt-6 block w-full bg-inverted text-inverted-foreground py-3 rounded-lg text-sm font-semibold"
          >
            {t("app.auth.signIn")}
          </Link>
        </div>
      </Shell>
    );
  }

  if (tokenDead || linkError) {
    return (
      <DeadEnd
        title={t("app.auth.reset.expiredTitle")}
        body={t("app.auth.reset.expiredBody")}
        action={t("app.auth.reset.newLink")}
      />
    );
  }

  if (!token) {
    return (
      <DeadEnd
        title={t("app.auth.reset.missingTitle")}
        body={t("app.auth.reset.missingBody")}
        action={t("app.auth.reset.newLink")}
      />
    );
  }

  return (
    <Shell>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("app.auth.reset.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {t("app.auth.reset.subtitle")}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-xl p-6 space-y-4"
      >
        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            {/* htmlFor/id, which this field did not have: tapping the label
                on a phone did nothing and a screen reader read an unlabelled
                box, on the one form a locked-out contractor must get right. */}
            <label htmlFor="reset-password" className={FIELD_LABEL}>
              {t("app.auth.reset.passwordLabel")}
            </label>
            {/* Instead of a confirm field. Somebody locked out of their own
                business, typing on a phone in a driveway, is exactly who mistypes
                a password they can't see — and a second blind field only catches
                the typo, it doesn't show it. */}
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              // aria-controls/-pressed, so the reveal toggle is a state a
              // screen reader can read rather than two unexplained words.
              aria-controls="reset-password"
              aria-pressed={reveal}
              className="text-xs font-medium text-muted-foreground underline"
            >
              {reveal ? t("app.auth.reset.hide") : t("app.auth.reset.show")}
            </button>
          </div>
          {/* No maxLength attribute, deliberately. It would silently truncate
              a 200-character password pasted from a password manager: the
              manager keeps 200, the account gets 128, and the next sign-in
              fails with nothing on screen to explain it. The length checks in
              handleSubmit say what's wrong instead — and they're translated,
              which the browser's native validation bubble is not. */}
          <input
            id="reset-password"
            required
            type={reveal ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass(Boolean(error))}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={PRIMARY_BUTTON}
        >
          {submitting
            ? t("app.auth.reset.submitting")
            : t("app.auth.reset.submit")}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link href="/login" className="font-medium text-foreground underline">
          {t("app.auth.backToSignIn")}
        </Link>
      </p>
    </Shell>
  );
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
