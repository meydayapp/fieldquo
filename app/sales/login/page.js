// app/sales/login/page.js
//
// Where a rep signs in. Its own screen rather than a branch of /login or of
// /platform/login, because it authenticates a third, separate identity — see
// lib/sales/auth.js for why the credential is deliberately not shared.
//
// It says so on the page, too: someone who works at a contracting company and
// has a FieldQuo account will otherwise try their own login here, get "invalid
// credentials", and reasonably conclude the portal is broken.
"use client";

import { useState } from "react";
import { BadgeDollarSign, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function SalesLoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/sales/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      // A full navigation rather than a router push: the session lives in an
      // httpOnly cookie the client can't see, and the portal's own layout
      // fetches identity on mount. A soft navigation would render the shell
      // before the cookie is in play on the next request.
      window.location.href = "/sales";
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          {/* text-brand-accent-text, not the raw #ff5a00 this had. SalesShell
              was fixed for exactly this in the console-contrast sweep and this
              page was missed — it is the copy nobody looks at. Measured: raw
              #ff5a00 on the --muted ground this page sits on is 2.80:1 in
              light mode, under the 4.5:1 floor; --brand-accent-text is 4.57:1
              light and 5.61:1 dark. The invite screen had the same line. */}
          <BadgeDollarSign size={16} className="text-brand-accent-text" />
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-accent-text">
            {t("app.salesPortal.title")}
          </span>
        </div>

        <form
          onSubmit={submit}
          className="bg-card border border-border rounded-xl p-6 space-y-4"
        >
          <p className="text-sm text-muted-foreground">
            {t("app.salesPortal.loginIntro")}
          </p>

          <div>
            <label
              htmlFor="sales-email"
              className="block text-sm font-medium text-foreground mb-1"
            >
              {t("app.salesPortal.email")}
            </label>
            <input
              id="sales-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              // 16px so iOS doesn't auto-zoom the whole page on focus — the
              // root layout's viewport comment names this as the real cause of
              // the zoom complaint, fixed at the input rather than by locking
              // pinch-zoom away from people who need it.
              className="w-full border border-border rounded-lg px-3 py-2 text-base bg-card text-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="sales-password"
              className="block text-sm font-medium text-foreground mb-1"
            >
              {t("app.salesPortal.password")}
            </label>
            <input
              id="sales-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-base bg-card text-foreground"
            />
          </div>

          {/* dark:text-red-300, not a bare red-700. This is the only string
              on the screen somebody NEEDS to read, and in dark mode red-700
              (#b91c1c) measures 2.61:1 on --card (#111d31) — under half the
              4.5:1 floor. red-300 is 8.89:1 there; light mode keeps red-700 at
              6.47:1 on white. Every other error line in this portal already
              pairs them; these two auth screens are the copies nobody looked
              at, the same way the brand colour on the line above was. */}
          {error && (
            <p className="text-sm text-red-700 dark:text-red-300" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy ? t("app.salesPortal.signingIn") : t("app.salesPortal.signIn")}
          </button>
        </form>
      </div>
    </div>
  );
}
