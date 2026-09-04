// app/accept-invitation/[id]/page.js
//
// How every employee after the first one gets into FieldQuo.
//
// ── Five arrivals, and only one of them is the form ────────────────────────
//
//   1. the invitation loads and is usable → sign up or sign in, then join
//   2. the invitation is not there (404)  → a wrong or withdrawn link
//   3. it exists but has expired          → ask for a new one
//   4. it exists but was cancelled        → ask for a new one, different reason
//   5. WE COULDN'T ASK                    → a 500, or Neon cold-starting with
//                                           a P1001. Nothing is wrong with the
//                                           link and the only useful control
//                                           is "try again"
//
// (5) is why this page was rewritten. The load was
// `fetch(...).then((r) => r.json())` with no `r.ok` test and no `.catch`, so a
// non-JSON body — which is exactly what a 500 returns — rejected inside the
// effect, `setLoading(false)` never ran, and the page sat on "Loading…"
// forever. AGENTS.md warns that Neon scales to zero and the first connection
// after idle can fail; the front door for every new employee answered that
// with an eternal spinner, and an invited person does not file a bug, they
// give up. Empty, error and never-loaded are three states and they now read
// as three.
//
// ── Every dead end carries the way out ─────────────────────────────────────
//
// Same rule as reset-password's DeadEnd: "this link is broken" with nothing to
// click is a blank screen to the person reading it. (2), (3) and (4) name the
// company and offer sign-in; (5) offers a retry that actually re-runs the load.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { signInErrorText } from "@/lib/authErrors";
// The arrival matrix, pure and executed by scripts/check-auth-front-door.mjs.
// Kept out of this file so the five screens below are a switch over a decided
// state rather than five conditions nobody can run.
import { inviteArrival, inviteUsability } from "@/lib/invitations/arrival";
import MarketingHeader from "@/app/components/marketing/MarketingHeader";
import {
  fieldClass,
  READONLY_FIELD,
  FIELD_LABEL,
  PRIMARY_BUTTON,
} from "@/app/components/auth/fieldStyles";
import { useTranslation } from "@/app/hooks/useTranslation";

// Better Auth enforces 8–128 on the server from its own defaults; lib/auth.js
// sets neither bound. Checking both here is what turns PASSWORD_TOO_LONG from
// an opaque vendor failure into a sentence — the same pair, for the same
// reason, as app/reset-password and app/signup. The placeholder used to
// PROMISE "At least 8 characters" and nothing on this page enforced it.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

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

/**
 * A card that says what happened and offers the one thing worth doing next.
 *
 * @param action  optional — the retry button for a load that failed. The
 *                sign-in link below it is always there, because somebody who
 *                already has a FieldQuo login has somewhere to go even when
 *                this particular invitation is finished.
 */
function DeadEnd({ title, body, action }) {
  const { t } = useTranslation();
  return (
    <Shell>
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{body}</p>
        {action}
        <p className="mt-6 text-sm">
          <Link href="/login" className="font-medium text-foreground underline">
            {t("app.auth.backToSignIn")}
          </Link>
        </p>
      </div>
    </Shell>
  );
}

export default function AcceptInvitationPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useTranslation();

  const [invite, setInvite] = useState(null);
  // "loading" | "ready" | "notFound" | "unavailable"
  //
  // "unavailable" is arrival (5): we could not ask the server. Kept apart from
  // "notFound" because they are opposite instructions — one says the link is
  // finished, the other says the link is probably fine and to try again.
  const [load, setLoad] = useState("loading");
  // Set when the visitor is already signed in as the invited person and we are
  // joining them without asking anything. Without it the sign-up form flashed
  // on screen for the length of a POST, asking somebody to create an account
  // they already have.
  const [autoJoining, setAutoJoining] = useState(false);
  // Set when the accept route refuses (403/404) — the invitation died between
  // the page loading and the join. The screen and the route then agree rather
  // than the screen offering a form the route will always turn down.
  const [refused, setRefused] = useState(false);
  // "signup" | "signin". Set from the invitation once it loads — an invited
  // person who already has a FieldQuo account must SIGN IN, not create a
  // second one on the same address. Defaulting to signup for everybody is what
  // produced "User already exists. Use another email" on an invitation that
  // names the email they have to use.
  const [mode, setMode] = useState(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Guards the auto-join against React's double-invoked development effects and
  // against a retry re-running it: accepting twice is two POSTs racing on the
  // same membership.
  const joined = useRef(false);
  // Set by the cleanup of whichever load is current. A retry makes a new one.
  const cancelled = useRef(false);

  const accept = useCallback(async () => {
    setBusy(true);
    setError("");

    const res = await fetch(`/api/invitations/${id}/accept`, {
      method: "POST",
    }).catch(() => null);

    if (cancelled.current) return;

    // A refusal is not "try again" — the invitation is cancelled, expired, or
    // addressed to somebody else, and all three are answered by asking the
    // company for a new link. Anything else (a 500, a dropped connection) is
    // worth retrying, so the form stays and the button comes back.
    if (!res) {
      setError(t("app.invite.acceptUnreachable", "We couldn’t reach FieldQuo just now. Try again in a moment."));
      setBusy(false);
      setAutoJoining(false);
      return;
    }
    if (res.status === 403 || res.status === 404) {
      setRefused(true);
      setBusy(false);
      setAutoJoining(false);
      return;
    }
    if (!res.ok) {
      setError(t("app.invite.acceptFailed", "We couldn’t add you to this company just now. Try again in a moment."));
      setBusy(false);
      setAutoJoining(false);
      return;
    }

    router.push("/app");
  }, [id, router, t]);

  // Load the invitation, and check whether the visitor is already signed in as
  // the invited person (in which case there is nothing to ask).
  const loadInvite = useCallback(async () => {
    cancelled.current = false;
    setLoad("loading");
    setError("");
    setRefused(false);

    // Read as a triple rather than a body, so "404" and "we never got an
    // answer" stay distinguishable. `.catch` on the json parse matters as much
    // as the one on the fetch: a 500 from Next is an HTML page, and parsing it
    // is what used to throw out of this effect and strand the spinner.
    const [inviteRes, session] = await Promise.all([
      fetch(`/api/invitations/${id}`)
        .then(async (r) => ({
          status: r.status,
          ok: r.ok,
          body: await r.json().catch(() => null),
        }))
        .catch(() => null),
      fetch("/api/auth/get-session")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    if (cancelled.current) return;

    const arrival = inviteArrival(inviteRes);
    if (arrival !== "ready") {
      setLoad(arrival);
      return;
    }

    const data = inviteRes.body;
    setInvite(data);
    // Only set if the visitor hasn't already picked — a stale fetch must not
    // yank the form out from under someone mid-type.
    setMode((current) => current ?? (data.hasAccount ? "signin" : "signup"));
    setLoad("ready");

    const sessionEmail = session?.user?.email?.toLowerCase();
    if (
      sessionEmail &&
      data.email &&
      sessionEmail === data.email.toLowerCase() &&
      !joined.current
    ) {
      joined.current = true;
      setAutoJoining(true);
      accept();
    }
  }, [id, accept]);

  useEffect(() => {
    loadInvite();
    return () => {
      cancelled.current = true;
    };
  }, [loadInvite]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Explicit rather than "anything that isn't signup": a null mode from a
    // failed invite fetch would otherwise silently attempt a sign-in.
    if (mode !== "signup" && mode !== "signin") {
      setError(t("app.invite.stillLoading", "Still loading — try again in a moment."));
      return;
    }

    // Checked before the network call, so the message lands on this page in
    // this language instead of coming back as a vendor error code.
    if (mode === "signup") {
      if (password.length < PASSWORD_MIN) {
        setError(t("app.auth.reset.tooShort"));
        return;
      }
      if (password.length > PASSWORD_MAX) {
        setError(t("app.auth.reset.tooLong"));
        return;
      }
    }

    setBusy(true);

    if (mode === "signup") {
      const r = await signUp
        .email({
          email: invite.email,
          password,
          name: name.trim() || invite.email,
        })
        .catch(() => ({ error: {} }));

      if (r?.error) {
        // Belt and braces: the account could have been created between the
        // page loading and this submit. Rather than repeat a message that
        // tells them to use a different email — which would be wrong advice
        // on an invitation naming this one — switch the form and say what to
        // do next.
        if (/already exists/i.test(r.error.message || "")) {
          setMode("signin");
          setPassword("");
          setError(
            t(
              "app.invite.alreadyRegistered",
              "{email} already has a FieldQuo account. Sign in with your existing password and you’ll be added to {org}.",
              { email: invite.email, org: invite.orgName },
            ),
          );
          setBusy(false);
          return;
        }
        // Never r.error.message: it is Better Auth's English, and it is the
        // same untranslated leak signInErrorText exists to stop.
        setError(
          t(
            "app.invite.createFailed",
            "We couldn’t create your login just now. Try again in a moment.",
          ),
        );
        setBusy(false);
        return;
      }
    } else {
      const r = await signIn
        .email({ email: invite.email, password })
        .catch(() => ({ error: {} }));
      if (r?.error) {
        setError(signInErrorText(t, r.error));
        setBusy(false);
        return;
      }
    }

    joined.current = true;
    await accept();
  }

  if (load === "loading") {
    return (
      <Shell>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <div className="animate-pulse text-sm text-muted-foreground">
            {t("app.auth.loading")}
          </div>
        </div>
      </Shell>
    );
  }

  // Arrival (5). The one screen whose instruction is "try again", so it is the
  // one screen that gets a button which re-runs the load rather than a link.
  if (load === "unavailable") {
    return (
      <DeadEnd
        title={t("app.invite.unavailableTitle", "We couldn’t load this invitation")}
        body={t(
          "app.invite.unavailableBody",
          "That is a problem at our end, not with your link. Try again in a moment — it should still work.",
        )}
        action={
          <button
            type="button"
            onClick={loadInvite}
            className={`${PRIMARY_BUTTON} mt-6`}
          >
            {t("app.invite.retry", "Try again")}
          </button>
        }
      />
    );
  }

  if (load === "notFound") {
    return (
      <DeadEnd
        title={t("app.invite.notFoundTitle", "Invitation not found")}
        body={t(
          "app.invite.notFoundBody",
          "This link is invalid, or the invitation has been removed. Ask whoever invited you to send a new one.",
        )}
      />
    );
  }

  const org = invite?.orgName || "";
  // The same function the accept route's admitted-status list comes from, so
  // the screen and the gate cannot disagree about the same row. The page used
  // to test only for "canceled" while the route admitted exactly
  // pending/accepted — every other status rendered a full form the route was
  // always going to refuse.
  const usability = inviteUsability(invite);

  if (refused || usability === "cancelled") {
    return (
      <DeadEnd
        title={t("app.invite.cancelledTitle", "This invitation can’t be used")}
        body={t(
          "app.invite.cancelledBody",
          "It was cancelled, or it has already been replaced. Ask {org} to send you a new one.",
          { org },
        )}
      />
    );
  }

  if (usability === "expired") {
    return (
      <DeadEnd
        title={t("app.invite.expiredTitle", "This invitation has expired")}
        body={t(
          "app.invite.expiredBody",
          "Invitations don’t last forever. Ask {org} to send you a new one.",
          { org },
        )}
      />
    );
  }

  // Already signed in as the invited person: nothing to ask, so nothing is
  // asked. Showing the form here would put a "create a password" field in
  // front of somebody whose account we are already using.
  if (autoJoining && !error) {
    return (
      <Shell>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <div className="animate-pulse text-sm text-muted-foreground">
            {t("app.invite.joining", "Adding you to {org}…", { org })}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("app.invite.title", "Join {org}", { org })}
        </h1>
        {/* invite.role is the FieldQuo tier the accept route will actually
            write, resolved and LABELLED by the API — it used to be Better
            Auth's raw "member"/"admin", which is not the role the route
            grants (that comes off the PendingTeamProfile) and is not a word
            anybody says out loud. A screen naming a different role from the
            one the row gets is worse than a screen naming none. */}
        {invite.roleLabel ? (
          <p className="text-sm text-muted-foreground mt-2">
            {t("app.invite.asRole", "You’ve been invited as {role}.", {
              role: invite.roleLabel,
            })}
          </p>
        ) : null}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Says WHY they're being asked to sign in rather than register.
          Without it, an invited person who already has an account sees a
          password field with no explanation and reasonably assumes the
          invitation is broken. */}
      {invite.hasAccount && mode === "signin" && (
        <div className="bg-card border border-border text-sm text-muted-foreground rounded-lg px-4 py-3 mb-4">
          {t(
            "app.invite.hasAccountNote",
            "You already have a FieldQuo account on this address. Sign in and you’ll be added to {org} — your existing companies stay exactly as they are.",
            { org },
          )}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-xl p-6 space-y-4"
      >
        <div>
          {/* htmlFor/id throughout, which none of these four fields had:
              tapping a label on a phone did nothing and a screen reader read
              them as unlabelled boxes. */}
          <label htmlFor="invite-email" className={FIELD_LABEL}>
            {t("app.auth.emailLabel")}
          </label>
          <input
            id="invite-email"
            className={READONLY_FIELD}
            value={invite.email}
            readOnly
          />
        </div>

        {mode === "signup" && (
          <div>
            <label htmlFor="invite-name" className={FIELD_LABEL}>
              {t("app.invite.nameLabel", "Your name")}
            </label>
            <input
              id="invite-name"
              required
              autoComplete="name"
              className={fieldClass(false)}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        <div>
          <label htmlFor="invite-password" className={FIELD_LABEL}>
            {mode === "signup"
              ? t("app.invite.createPassword", "Create a password")
              : t("app.invite.password", "Password")}
          </label>
          <input
            id="invite-password"
            required
            type="password"
            // new-password when creating one so a password manager offers to
            // generate and store it; current-password when signing in so it
            // fills the one it already has. One token for both was why
            // managers kept filling the wrong thing here.
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            className={fieldClass(false)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              mode === "signup"
                ? t("app.invite.passwordHint", "At least 8 characters")
                : ""
            }
          />
        </div>

        <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
          {busy
            ? t("app.invite.submitting", "Joining…")
            : mode === "signup"
              ? t("app.invite.submitCreate", "Create login & join")
              : t("app.invite.submitSignIn", "Sign in & join")}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError("");
          }}
          className="w-full text-sm text-muted-foreground py-3"
        >
          {mode === "signup"
            ? t("app.invite.switchToSignIn", "I already have a FieldQuo account")
            : t("app.invite.switchToSignUp", "I need to create a login")}
        </button>
      </form>
    </Shell>
  );
}
