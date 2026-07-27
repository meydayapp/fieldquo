// app/accept-invitation/[id]/page.js
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400";

export default function AcceptInvitationPage() {
  const { id } = useParams();
  const router = useRouter();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("signup"); // "signup" | "signin"
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
      if (mode === "signup") {
        const r = await signUp.email({
          email: invite.email,
          password,
          name: name.trim() || invite.email,
        });
        if (r?.error) throw new Error(r.error.message || "Could not create account");
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  if (!invite || invite.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900">
            Invitation not found
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            This invitation link is invalid or has been removed.
          </p>
        </div>
      </div>
    );
  }

  if (invite.expired || invite.status === "canceled") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900">
            Invitation expired
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Ask {invite.orgName} to send you a new invite.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold tracking-tight text-gray-900">
            FieldQuo
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Join <strong>{invite.orgName}</strong>
            {invite.role ? ` as ${invite.role}` : ""}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-xl p-6 space-y-3"
        >
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Email
            </label>
            <input
              className={`${inputClass} bg-gray-50 text-gray-500`}
              value={invite.email}
              readOnly
            />
          </div>

          {mode === "signup" && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
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
            <label className="text-sm font-medium text-gray-700 block mb-1">
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
            className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
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
            className="w-full text-sm text-gray-500"
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
