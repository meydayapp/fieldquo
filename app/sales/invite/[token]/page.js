// app/sales/invite/[token]/page.js
//
// Accepting a sales-rep invitation: the invitee chooses their own password.
//
// ══ Why the link is checked BEFORE the form renders ═══════════════════════
//
// An expired or already-used invitation must say so on arrival, not after
// somebody has typed a password twice. The GET is not a substitute for the
// server-side check — POST re-reads the row and re-evaluates inviteState on it
// (see the route's own header on why that is canWrite()'s discipline) — it is
// there so the page can be honest about which form to show at all.
//
// A form rendered over a dead link would be the "control that appears to work
// and doesn't" AGENTS.md leads with, and this one would fail at the worst
// possible moment: the first thing a new hire ever does with FieldQuo.
"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeDollarSign, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

// Kept in step with lib/sales/invite.js's MIN_PASSWORD_LENGTH by the check
// script rather than by memory — importing it here would pull node:crypto into
// a client bundle.
const MIN_PASSWORD_LENGTH = 12;

export default function SalesInvitePage({ params }) {
  // Next 16: `params` is a Promise, unwrapped with React's `use` in a client
  // component.
  const { token } = use(params);
  const { t } = useTranslation();

  const [invite, setInvite] = useState(null);
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const data = await fetchJson(
        `/api/sales/auth/invite?token=${encodeURIComponent(token)}`,
      );
      setInvite(data);
      setLinkError("");
    } catch (err) {
      setInvite(null);
      setLinkError(err.message);
    } finally {
      setChecking(false);
    }
  }, [token]);

  useEffect(() => {
    check();
  }, [check]);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirm) {
      setError(t("app.salesPortal.inviteMismatch"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/sales/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
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
          {/* Tokenised for contrast — see the same block in
              app/sales/login/page.js. Raw #ff5a00 on this page's --muted ground
              measures 2.80:1; --brand-accent-text measures 4.57:1 / 5.61:1.
              This is the first FieldQuo screen a new hire ever sees. */}
          <BadgeDollarSign size={16} className="text-brand-accent-text" />
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-accent-text">
            {t("app.salesPortal.title")}
          </span>
        </div>

        {checking && (
          <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            {t("app.salesPortal.inviteChecking")}
          </div>
        )}

        {!checking && linkError && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <p className="text-sm text-foreground">{linkError}</p>
            <Link
              href="/sales/login"
              className="inline-block text-sm font-semibold underline underline-offset-2"
            >
              {t("app.salesPortal.backToSignIn")}
            </Link>
          </div>
        )}

        {!checking && invite && (
          <form
            onSubmit={submit}
            className="bg-card border border-border rounded-xl p-6 space-y-4"
          >
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {t("app.salesPortal.inviteHeading")}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t("app.salesPortal.inviteIntro", { email: invite.email })}
              </p>
            </div>

            <div>
              <label
                htmlFor="sales-new-password"
                className="block text-sm font-medium text-foreground mb-1"
              >
                {t("app.salesPortal.invitePassword")}
              </label>
              <input
                id="sales-new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-base bg-card text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("app.salesPortal.inviteMinLength", {
                  n: MIN_PASSWORD_LENGTH,
                })}
              </p>
            </div>

            <div>
              <label
                htmlFor="sales-confirm-password"
                className="block text-sm font-medium text-foreground mb-1"
              >
                {t("app.salesPortal.inviteConfirm")}
              </label>
              <input
                id="sales-confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-base bg-card text-foreground"
              />
            </div>

            {/* Paired for dark mode — see the same block in
                app/sales/login/page.js. Measured: red-700 on --card is 2.61:1
                dark, red-300 is 8.89:1. This one is read by a new hire whose
                password did not take, on their first minute with FieldQuo. */}
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
              {busy
                ? t("app.salesPortal.inviteSaving")
                : t("app.salesPortal.inviteSubmit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
