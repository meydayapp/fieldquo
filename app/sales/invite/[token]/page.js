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
//
// ══ The language is asked for HERE, not only later ════════════════════════
//
// The owner: the portal should "remember the language that has been set when
// the sales rep activates and sets the password". Accepting an invitation used
// to collect a password and nothing else; the language was first asked on
// /sales/welcome, which nothing forces a rep through, and a rep who skipped it
// worked in whatever their browser guessed until they found /sales/pay.
//
// So the picker is on this form. It defaults to the language this very screen
// is rendering in — the invitation email is English-only
// (lib/sales/inviteEmail.js), so there is no "language it was sent in" to
// inherit, and the provider's own resolution (a stored marketing-site choice,
// then the browser) is the best statement available before anybody has made
// one. Changing it re-renders this form at once, so a rep can see the language
// they are choosing; submitting writes SalesRep.language in the same update
// as the password, and app/sales/layout.js reads that column on the very next
// request — /sales/welcome, which this page loads in full so the server can
// see the new cookie. Nothing waits on localStorage.
"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeDollarSign, Loader2 } from "lucide-react";
import { errorText, fetchJson } from "@/lib/fetchJson";
import { AUTH_REFUSAL_KEYS } from "@/lib/sales/authRefusals";
import { REP_LANGUAGE_OPTIONS } from "@/lib/sales/repLanguage";
import { useLanguageContext } from "@/app/providers/LanguageProvider";
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
  // `language` is what this screen is rendering in right now — the picker's
  // default and, until the rep touches it, what gets written. changeLanguage
  // re-renders the form in the chosen language immediately.
  const { language, changeLanguage } = useLanguageContext();

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
      // Same three-step resolution as the submit handler below: the four
      // invite states are four different instructions and each keeps its own.
      setLinkError(errorText(t, err, AUTH_REFUSAL_KEYS));
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
        // The language travels with the password: one write, one moment, and
        // the layout reads it back on the page this redirects to.
        body: JSON.stringify({ token, password, language }),
      });
      // /sales/welcome, not /sales. Accepting an invitation collects a
      // password and nothing else, and two facts about the rep stayed unknown
      // until somebody asked in a chat window: where their commission goes,
      // and what language they work in. This is the one moment a new hire is
      // sitting in front of the portal expecting to be asked things.
      //
      // A full page load rather than router.push, matching what this already
      // did: the sign-in cookie was set by the POST above, and the shell has
      // to be rendered by a server that can see it.
      //
      // Nothing on that screen is required — see its header for why a blocking
      // first run would be worse than the gap it closes.
      window.location.href = "/sales/welcome";
    } catch (err) {
      // The route's own code first, then fetchJson's, then the sentence
      // itself. This is the first FieldQuo screen a new hire ever sees and it
      // was the one place in the portal that answered in English no matter
      // what language they were hired in — see lib/sales/authRefusals.js.
      setError(errorText(t, err, AUTH_REFUSAL_KEYS));
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

            <div>
              <label
                htmlFor="sales-language"
                className="block text-sm font-medium text-foreground mb-1"
              >
                {t("app.salesLang.legend")}
              </label>
              {/* A native select: nine options on a phone are a wheel, not a
                  radio list, and this form is read on a phone more often than
                  not. The native name leads for the same reason it does in
                  RepLanguageChoice — a rep scanning for their own language
                  looks for "Français", not "French". text-base, not text-sm:
                  a 14px control makes iOS zoom the page. */}
              <select
                id="sales-language"
                value={language}
                onChange={(e) => changeLanguage(e.target.value)}
                className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2 text-base bg-card text-foreground"
              >
                {REP_LANGUAGE_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.nativeName} — {o.name}
                  </option>
                ))}
              </select>
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
              className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-60"
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
