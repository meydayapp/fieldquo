// app/platform/login/page.js
//
// Sign-in for FieldQuo's own staff. Deliberately spare: no signup link, no
// "forgot password", no branding flourish. Platform accounts can read every
// tenant's data and impersonate any company, so every extra entry point is
// another way in. New admins are created by an existing admin, or via
// scripts/seed-platform-admin.mjs for the first one.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";

export default function PlatformLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/platform/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't sign in.");
      // Full reload, not router.push — middleware reads the platform-token
      // cookie the response just set, and a client transition can race it.
      window.location.href = "/platform";
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    // bg-sidebar, not the old bg-[#1A1917]: that hex is the EMAIL header
    // neutral, and PlatformSidebar has moved onto the --sidebar ladder, so a
    // near-black sign-in page would be the console's only surface still using
    // it. Nothing but the card sits on this backdrop, so it carries no text
    // pairing of its own.
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-card rounded-2xl p-8"
      >
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={18} className="text-muted-foreground" />
          <h1 className="text-lg font-bold text-foreground">FieldQuo Platform</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">Staff access only.</p>

        <label className="block text-sm font-medium text-foreground mb-1">
          Email
        </label>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border"
        />

        <label className="block text-sm font-medium text-foreground mb-1">
          Password
        </label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border"
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-inverted text-inverted-foreground text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Sign in
        </button>
      </form>
    </div>
  );
}
