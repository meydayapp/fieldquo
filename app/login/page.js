// app/app/login/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import MarketingHeader from "@/app/components/marketing/MarketingHeader";
import { isInternalPath } from "@/lib/appUrl";

// Only ever an internal path. Guards against `?next=//evil.com`, `?next=/\evil.com`
// and absolute URLs turning the login form into an open redirect. The rule
// itself lives in lib/appUrl so every `next` sink applies the same one.
function safeNext(raw) {
  return isInternalPath(raw) ? raw : "/app";
}

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Where to land after login. Default /app; set from ?next when a flow (e.g.
  // "add this quote to your project") sent the contractor here to sign in.
  // Read from window rather than useSearchParams to avoid forcing a Suspense
  // boundary on this route — the same pattern the quote pages use.
  const [next, setNext] = useState("/app");
  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get("next")));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const { error: signInError } = await signIn.email({
      email: form.email,
      password: form.password,
    });

    setSubmitting(false);

    if (signInError) {
      setError(signInError.message || "Invalid email or password");
      return;
    }

    router.push(next);
    router.refresh();
  };

  return (
    <>
      <MarketingHeader />
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-muted px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Log in to your account</p>
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
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full mt-1 border border-border rounded-lg px-4 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">
              Password
            </label>
            <input
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full mt-1 border border-border rounded-lg px-4 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link
            href={next !== "/app" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
            className="font-medium text-foreground underline"
          >
            Start your free trial
          </Link>
        </p>
      </div>
      </div>
    </>
  );
}
