"use client";

// app/app/settings/booking-page/GoogleBookButton.js
//
// "Add a Book button on Google": the company's booking page as the Book
// button on its Google Business Profile — on Search and Maps, beside Call and
// Directions. Owner, 2026-09-28: the way Jobber users get one.
//
// ── Two ways, and only the one that works is drawn ─────────────────────────
//
//   by hand     always, once the booking page is bookable: the link, a Copy
//               button that says whether it copied, and Google's own steps
//               (support.google.com/business/answer/6218037). Google's
//               button names stay in English in quotes in every language —
//               nobody here has checked what Google calls them in Punjabi,
//               and a translated label that does not match the screen is
//               worse than an English one that does.
//   for them    "Add it for me", only when GET /api/reviews/google/book-button
//               says canAutomate: Google has approved FieldQuo's Business
//               Profile API (googleBusinessAvailable()), the company is
//               connected and has picked its listing — and the buttons
//               only for an owner or admin (GET's canManage; a supervisor
//               reads who can instead). Not approved → the
//               section is absent, not greyed. Approved but not connected →
//               one line pointing at Settings › Reviews, where the connect
//               button is real.
//
// A booking page nobody can book on is not offered at all — sending Google
// Search traffic to "hasn't set up online booking yet" is worse than no
// button. The server decides that (bookingPageLive in
// lib/reviews/googleBusiness/bookButton.js).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

const ENDPOINT = "/api/reviews/google/book-button";
// The refusals the route names with a `kind`; anything else prints the
// server's own sentence (which carries Google's words).
const KNOWN_KINDS = new Set(["not_approved", "not_connected", "no_location", "not_live", "not_https"]);

export default function GoogleBookButton() {
  const { t } = useTranslation();
  const [state, setState] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [copy, setCopy] = useState(""); // "" | "copied" | "failed"
  const [preferred, setPreferred] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { tone, text }

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const res = await fetch(ENDPOINT);
      if (!res.ok) {
        await reportResponseError(res, t("app.setBooking.gbp.loadError"));
        setLoadFailed(true);
        return;
      }
      setState(await res.json());
    } catch {
      setLoadFailed(true);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function copyLink() {
    // navigator.clipboard is absent on http and refused in some embedded
    // browsers; either way the person is told, and the link stays on screen
    // to select by hand.
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(state.bookingUrl);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
    setTimeout(() => setCopy(""), 4000);
  }

  function refusalText(json) {
    if (json?.kind === "owner_admin_only") return t("app.setBooking.gbp.ownerAdminOnly");
    if (json?.kind && KNOWN_KINDS.has(json.kind)) return t(`app.setBooking.gbp.err.${json.kind}`);
    return json?.error || t("app.setBooking.gbp.actionError");
  }

  async function addIt() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferred }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setResult({ tone: "error", text: refusalText(json) });
        return;
      }
      setResult({
        tone: "ok",
        text: json.status === "already" ? t("app.setBooking.gbp.already") : t("app.setBooking.gbp.added"),
      });
      setState((s) => ({ ...s, google: { ...s.google, onGoogle: true, link: json.link || null, error: null } }));
    } catch {
      setResult({ tone: "error", text: t("app.error.network") });
    } finally {
      setBusy(false);
    }
  }

  async function removeIt() {
    if (!window.confirm(t("app.setBooking.gbp.removeConfirm"))) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(ENDPOINT, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setResult({ tone: "error", text: refusalText(json) });
        return;
      }
      setResult({
        tone: "ok",
        text: json.status === "not_found" ? t("app.setBooking.gbp.notThere") : t("app.setBooking.gbp.removed"),
      });
      setState((s) => ({ ...s, google: { ...s.google, onGoogle: false, link: null, error: null } }));
    } catch {
      setResult({ tone: "error", text: t("app.error.network") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <BookButtonCard
      t={t}
      state={state}
      loadFailed={loadFailed}
      copy={copy}
      preferred={preferred}
      busy={busy}
      result={result}
      onRetry={load}
      onCopy={copyLink}
      onPreferred={setPreferred}
      onAdd={addIt}
      onRemove={removeIt}
    />
  );
}

/**
 * The card itself, from state alone — no fetch, no hooks — so
 * scripts/check-google-book-button.mjs renders every state (loading, failed,
 * not bookable, flag off, approved-not-connected, ready, on Google) and reads
 * what a person would see, instead of trusting the branches by eye.
 */
export function BookButtonCard({ t, state, loadFailed, copy, preferred, busy, result, onRetry, onCopy, onPreferred, onAdd, onRemove }) {
  const heading = (
    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
      <CalendarCheck size={15} /> {t("app.setBooking.gbp.title")}
    </p>
  );

  if (loadFailed) {
    return (
      <div className="rounded-lg border border-border p-4">
        {heading}
        <p className="text-sm text-red-700 dark:text-red-300 mt-2">{t("app.setBooking.gbp.loadError")}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 border border-border text-foreground px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-muted"
        >
          {t("app.action.retry")}
        </button>
      </div>
    );
  }

  if (!state) return <div className="rounded-lg border border-border p-4 h-24 animate-pulse bg-accent" />;

  if (!state.bookingLive || !state.bookingUrl) {
    return (
      <div className="rounded-lg border border-border p-4">
        {heading}
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t("app.setBooking.gbp.notLive")}</p>
        <Link
          href="/app/settings/availability#bookable"
          className="mt-2 inline-flex text-xs font-semibold text-foreground underline underline-offset-2"
        >
          {t("app.setBooking.gbp.notLiveLink")}
        </Link>
      </div>
    );
  }

  const g = state.google || {};

  return (
    <div className="rounded-lg border border-border p-4">
      {heading}
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t("app.setBooking.gbp.intro")}</p>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <code className="flex-1 min-w-0 truncate bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground">
          {state.bookingUrl}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-xs font-semibold text-foreground shrink-0"
        >
          {copy === "copied" ? <Check size={13} /> : <Copy size={13} />}
          {copy === "copied" ? t("app.action.copied") : t("app.setBooking.gbp.copyLink")}
        </button>
      </div>
      {copy === "failed" && (
        <p role="status" className="text-xs text-red-700 dark:text-red-300 mt-1.5">
          {t("app.setBooking.gbp.copyFailed")}
        </p>
      )}

      <p className="text-sm font-semibold text-foreground mt-4">{t("app.setBooking.gbp.manualTitle")}</p>
      <ol className="list-decimal pl-5 mt-1.5 space-y-1 text-xs text-muted-foreground leading-relaxed">
        <li>
          {t("app.setBooking.gbp.step1")}{" "}
          <a
            href="https://business.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-foreground underline underline-offset-2"
          >
            business.google.com <ExternalLink size={11} />
          </a>
        </li>
        <li>{t("app.setBooking.gbp.step2")}</li>
        <li>{t("app.setBooking.gbp.step3")}</li>
        <li>{t("app.setBooking.gbp.step4")}</li>
        <li>{t("app.setBooking.gbp.step5")}</li>
      </ol>
      <p className="text-[11px] text-muted-foreground mt-1.5">{t("app.setBooking.gbp.labelsNote")}</p>

      {g.available && !g.canAutomate && (
        <p className="text-xs text-muted-foreground mt-4">
          {t("app.setBooking.gbp.connectFirst")}{" "}
          <Link href="/app/settings/reviews" className="font-semibold text-foreground underline underline-offset-2">
            {t("app.setBooking.gbp.connectLink")}
          </Link>
        </p>
      )}

      {g.canAutomate && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm font-semibold text-foreground">{t("app.setBooking.gbp.autoTitle")}</p>
          {g.locationTitle && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("app.setBooking.gbp.listing", { title: g.locationTitle })}
            </p>
          )}

          {g.error && (
            <p className="text-xs text-red-700 dark:text-red-300 mt-2 leading-relaxed">{g.error}</p>
          )}

          {/* Owners and admins only (owner, 2026-10-03). A supervisor sees
              whether the link is on Google, never a button the route would
              refuse — the note says who can, and that the manual steps
              above still work. */}
          {!state.canManage ? (
            <div className="mt-2">
              {g.onGoogle && (
                <p className="text-xs text-foreground">
                  {g.link?.isPreferred ? t("app.setBooking.gbp.onGooglePreferred") : t("app.setBooking.gbp.onGoogle")}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed" data-owner-admin-only>
                {t("app.setBooking.gbp.ownerAdminOnly")}
              </p>
            </div>
          ) : g.onGoogle ? (
            <div className="mt-2">
              <p className="text-xs text-foreground">
                {g.link?.isPreferred ? t("app.setBooking.gbp.onGooglePreferred") : t("app.setBooking.gbp.onGoogle")}
              </p>
              <button
                type="button"
                onClick={onRemove}
                disabled={busy}
                className="mt-2 inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60"
              >
                {busy && <Loader2 size={13} className="animate-spin" />}
                {t("app.setBooking.gbp.remove")}
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={preferred}
                  onChange={(e) => onPreferred(e.target.checked)}
                  className="h-4 w-4"
                />
                {t("app.setBooking.gbp.preferred")}
              </label>
              <button
                type="button"
                onClick={onAdd}
                disabled={busy}
                className="mt-2 inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-60"
              >
                {busy && <Loader2 size={13} className="animate-spin" />}
                {t("app.setBooking.gbp.addForMe")}
              </button>
            </div>
          )}
        </div>
      )}

      {result && (
        <p
          role="status"
          className={`text-xs mt-2 leading-relaxed ${
            result.tone === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
          }`}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}
