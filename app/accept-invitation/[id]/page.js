// app/accept-invitation/[id]/page.js
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

const inputClass =
  "w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

export default function AcceptInvitationPage() {
  const { id } = useParams();
  const router = useRouter();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
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

  // Load invite details + check whether the visitor is already signed in as
  // the invited person (in which case we can accept immediately).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [inviteRes, sessionRes] = await Promise.all([
        fetch(`/api/invitations/${id}`).then((r) => r.json()),
        fetch("/api/auth/get-session").then((r) => (r.ok ? r.json() : null)),
      ]);
      if (cancelled) return;
      setInvite(inviteRes);
      // Only set if the visitor hasn't already picked — a stale fetch must not
      // yank the form out from under someone mid-type.
      setMode((current) => current ?? (inviteRes?.hasAccount ? "signin" : "signup"));
      setLoading(false);

      const sessionEmail = sessionRes?.user?.email?.toLowerCase();
      if (
        sessionEmail &&
        inviteRes?.email &&
        sessionEmail === inviteRes.email.toLowerCase()
      ) {
        accept();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function accept() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/invitations/${id}/accept`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not accept the invitation");
      setBusy(false);
      return;
    }
    router.push("/app");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      // Explicit rather than "anything that isn't signup": a null mode from a
      // failed invite fetch would otherwise silently attempt a sign-in.
      if (mode !== "signup" && mode !== "signin") {
        throw new Error("Still loading — try again in a moment.");
      }

      if (mode === "signup") {
        const r = await signUp.email({
          email: invite.email,
          password,
          name: name.trim() || invite.email,
        });
        if (r?.error) {
          // Belt and braces: the account could have been created between the
          // page loading and this submit. Rather than repeat a message that
          // tells them to use a different email — which would be wrong advice
          // on an invitation naming this one — switch the form and say what to
          // do next.
          if (/already exists/i.test(r.error.message || "")) {
            setMode("signin");
            setPassword("");
            throw new Error(
              `${invite.email} already has a FieldQuo account. Sign in with your existing password and you'll be added to ${invite.orgName}.`,
            );
          }
          throw new Error(r.error.message || "Could not create account");
        }
      } else {
        const r = await signIn.email({ email: invite.email, password });
        if (r?.error) throw new Error(r.error.message || "Could not sign in");
      }
      await accept();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="animate-pulse text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!invite || invite.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted px-4">
        <div className="bg-card border border-border rounded-xl p-8 max-w-sm text-center">
          <h1 className="text-lg font-semibold text-foreground">
            Invitation not found
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            This invitation link is invalid or has been removed.
          </p>
        </div>
      </div>
    );
  }

  if (invite.expired || invite.status === "canceled") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted px-4">
        <div className="bg-card border border-border rounded-xl p-8 max-w-sm text-center">
          <h1 className="text-lg font-semibold text-foreground">
            Invitation expired
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ask {invite.orgName} to send you a new invite.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold tracking-tight text-foreground">
            FieldQuo
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Join <strong>{invite.orgName}</strong>
            {invite.role ? ` as ${invite.role}` : ""}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Says WHY they're being asked to sign in rather than register.
            Without it, an invited person who already has an account sees a
            password field with no explanation and reasonably assumes the
            invitation is broken. */}
        {invite.hasAccount && mode === "signin" && (
          <div className="bg-muted border border-border text-sm text-muted-foreground rounded-lg px-4 py-3 mb-4">
            You already have a FieldQuo account on this address. Sign in and
            you&apos;ll be added to <strong>{invite.orgName}</strong> — your
            existing companies stay exactly as they are.
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-xl p-6 space-y-3"
        >
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Email
            </label>
            <input
              className={`${inputClass} bg-muted text-muted-foreground`}
              value={invite.email}
              readOnly
            />
          </div>

          {mode === "signup" && (
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                Your name
              </label>
              <input
                required
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {mode === "signup" ? "Create a password" : "Password"}
            </label>
            <input
              required
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 8 characters" : ""}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {busy
              ? "Joining…"
              : mode === "signup"
                ? "Create login & join"
                : "Sign in & join"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError("");
            }}
            className="w-full text-sm text-muted-foreground"
          >
            {mode === "signup"
              ? "I already have a FieldQuo account"
              : "I need to create a login"}
          </button>
        </form>
      </div>
    </div>
  );
}
