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
    <div className="min-h-screen bg-[#1A1917] flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-2xl p-8"
      >
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={18} className="text-gray-400" />
          <h1 className="text-lg font-bold text-gray-900">FieldQuo Platform</h1>
        </div>
        <p className="text-sm text-gray-500 mb-6">Staff access only.</p>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
        />

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-gray-900 text-white text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Sign in
        </button>
      </form>
    </div>
  );
}
