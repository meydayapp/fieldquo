// app/components/calendar/SubscribeFeedSection.js
//
// The "subscribe from your phone" card on Settings → My calendar.
//
// One section, one file: the page that mounts it is a shell, so that a
// second card (Google Calendar OAuth, being built separately) can land on
// the same page without either agent editing the other's code.
//
// ── What the three buttons actually do ─────────────────────────────────────
//
// Each is a real link to a real subscribe surface, not a button that "sets
// up" anything on our side — the server has nothing to set up. Google's
// "add by URL" page opens in a new tab with the address filled in; the
// webcal: link opens Apple Calendar's subscribe sheet on iPhone and Mac;
// Outlook has no deep link, so its button copies the address and says so
// in its own label rather than pretending to be more than a copy.
//
// The address is a credential — anyone holding it reads this member's
// schedule — which is why it is shown in a read-only field beside a
// Regenerate that says, before it acts, that every subscribed device stops
// updating until it is subscribed again.
"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson, errorText } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";

const BUTTON =
  "inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted";

export default function SubscribeFeedSection() {
  const { t } = useTranslation();
  const [urls, setUrls] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [copied, setCopied] = useState(null); // "outlook" | "raw" | null
  const [confirming, setConfirming] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotated, setRotated] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchJson("/api/calendar/feed");
      setUrls(data?.urls || null);
    } catch (err) {
      setLoadError(errorText(t, err) || t("app.myCalendar.loadError", "Couldn't load your calendar link."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copy(which, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      showError(t("app.myCalendar.copyFailed", "Couldn't copy. Select the link and copy it yourself."));
    }
  }

  async function rotate() {
    setRotating(true);
    try {
      const data = await fetchJson("/api/calendar/feed", { method: "POST", body: { action: "rotate" } });
      setUrls(data?.urls || null);
      setConfirming(false);
      setRotated(true);
    } catch (err) {
      showError(errorText(t, err) || t("app.myCalendar.rotateFailed", "Couldn't regenerate the link."));
    } finally {
      setRotating(false);
    }
  }

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <CalendarPlus size={18} className="text-muted-foreground" />
          {t("app.myCalendar.subscribeTitle", "Subscribe from your phone or computer")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.myCalendar.subscribeIntro",
            "Your appointments, job visits and bookings — the same rows your FieldQuo calendar shows — appear in your own calendar app and keep themselves up to date. Nothing to export again.",
          )}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> {t("app.myCalendar.loading", "Preparing your link…")}
        </div>
      ) : loadError || !urls ? (
        <div className="space-y-3">
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
            {loadError || t("app.myCalendar.loadError", "Couldn't load your calendar link.")}
          </div>
          <button type="button" onClick={load} className={BUTTON}>
            {t("app.action.retry", "Try again")}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <a href={urls.google} target="_blank" rel="noopener noreferrer" className={BUTTON}>
              {t("app.myCalendar.google", "Subscribe in Google Calendar")}
            </a>
            <a href={urls.webcal} className={BUTTON}>
              {t("app.myCalendar.apple", "Apple Calendar")}
            </a>
            <button type="button" onClick={() => copy("outlook", urls.outlook)} className={BUTTON}>
              {copied === "outlook" ? <Check size={16} /> : <Copy size={16} />}
              {copied === "outlook" ? t("app.action.copied", "Copied") : t("app.myCalendar.outlook", "Outlook (copy link)")}
            </button>
          </div>

          <p className="text-sm text-muted-foreground">
            {t("app.myCalendar.refreshNote", "Google re-reads every few hours, Apple every 15 minutes to an hour.")}
          </p>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1" htmlFor="calendar-feed-url">
              {t("app.myCalendar.urlLabel", "Your private link")}
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                id="calendar-feed-url"
                type="text"
                readOnly
                value={urls.https}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono"
              />
              <button
                type="button"
                onClick={() => copy("raw", urls.https)}
                className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-xs font-semibold text-foreground shrink-0"
              >
                {copied === "raw" ? <Check size={13} /> : <Copy size={13} />}
                {copied === "raw" ? t("app.action.copied", "Copied") : t("app.action.copyLink", "Copy link")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("app.myCalendar.urlPrivate", "Anyone with this link can read your schedule. If it gets out, regenerate it.")}
            </p>
          </div>

          {rotated && !confirming && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {t("app.myCalendar.rotated", "New link ready. Subscribe again on each device — the old link stopped working.")}
            </p>
          )}

          {confirming ? (
            <div className="border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-4 py-3 space-y-3">
              <p className="text-sm text-foreground">
                {t("app.myCalendar.regenerateConfirm", "Your phone will stop updating until you subscribe again with the new link. Regenerate?")}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={rotate} disabled={rotating} className={`${BUTTON} disabled:opacity-60`}>
                  {rotating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  {rotating ? t("app.myCalendar.regenerating", "Regenerating…") : t("app.myCalendar.regenerate", "Regenerate link")}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={rotating} className={`${BUTTON} disabled:opacity-60`}>
                  {t("app.action.cancel", "Cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setRotated(false); setConfirming(true); }} className={BUTTON}>
              <RefreshCw size={16} /> {t("app.myCalendar.regenerate", "Regenerate link")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
