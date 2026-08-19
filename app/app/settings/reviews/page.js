"use client";

// app/app/settings/reviews/page.js
//
// Automatic review requests, and the reviews themselves.
//
// Two halves of one job: asking for reviews, and putting the ones you have on
// your website. They share a screen because a contractor who has just set up
// the ask is the same contractor holding fifty reviews already sitting on
// Google with nowhere in FieldQuo to put them. The second half is
// ./Testimonials.js.
//
// ── The screen tells you what will actually happen ─────────────────────────
//
// Not just "On". It says how many customers are in the queue right now and how
// many were asked in the last month, both read from the same columns the cron
// reads. A toggle that says On while nothing is being sent is the exact class
// of dead control this codebase keeps finding, and a live count is the cheapest
// defence against it.
//
// ── The switch can't be turned on without a link ───────────────────────────
//
// Enforced on the server too. This is only the friendly half.

import { useEffect, useState, useCallback } from "react";
import { Star, ExternalLink, Loader2, Check, Info } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import Testimonials from "./Testimonials";

const DELAYS = [
  { hours: 2, label: "app.setReviews.delay2h" },
  { hours: 4, label: "app.setReviews.delay4h" },
  { hours: 24, label: "app.setReviews.delayNextDay" },
  { hours: 48, label: "app.setReviews.delay2d" },
  { hours: 72, label: "app.setReviews.delay3d" },
  { hours: 168, label: "app.setReviews.delayWeek" },
];

export default function ReviewSettingsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [url, setUrl] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/reviews");
    if (!res.ok) {
      await reportResponseError(res, t("app.setReviews.loadError"));
      return;
    }
    const json = await res.json();
    setData(json);
    setUrl(json.reviewUrl || "");
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function save(patch) {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.setReviews.saveError"));
        // Reload so the screen shows what's actually stored rather than the
        // change that was refused — otherwise the toggle sits in the position
        // the server rejected.
        await load();
        return;
      }
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-32 bg-accent rounded-xl" />
      </div>
    );
  }

  const on = Boolean(data?.reviewRequestsEnabled);
  const hasUrl = Boolean(data?.reviewUrl);

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Star size={22} /> {t("app.settings.reviews")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setReviews.subtitle")}
        </p>
      </div>

      {/* ── Where to send them ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-5">
        <label htmlFor="reviewUrl" className="block text-sm font-semibold text-foreground">
          {t("app.setReviews.linkLabel")}
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          {t("app.setReviews.linkHelp")}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <input
            id="reviewUrl"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://g.page/r/…/review"
            className="flex-1 min-w-[14rem] px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
          />
          <button
            type="button"
            disabled={saving || url.trim() === (data?.reviewUrl || "")}
            onClick={() => save({ reviewUrl: url })}
            className="px-4 py-2 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-40"
          >
            {t("app.action.save")}
          </button>
        </div>
        {hasUrl && (
          <a
            href={data.reviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-2"
          >
            <ExternalLink size={12} /> {t("app.setReviews.openCheck")}
          </a>
        )}
      </section>

      {/* ── The switch ─────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {t("app.setReviews.askAuto")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasUrl
                ? t("app.setReviews.askAutoOn")
                : t("app.setReviews.askAutoOff")}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={saving || !hasUrl}
            onClick={() => save({ reviewRequestsEnabled: !on })}
            className={`shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${
              on ? "bg-emerald-600" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                on ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {on && (
          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-sm font-semibold text-foreground">{t("app.setReviews.whenToAsk")}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {DELAYS.map((d) => (
                <button
                  key={d.hours}
                  type="button"
                  disabled={saving}
                  onClick={() => save({ reviewDelayHours: d.hours })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
                    data.reviewDelayHours === d.hours
                      ? "bg-inverted text-inverted-foreground border-transparent"
                      : "border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {t(d.label)}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Proof it's doing something ─────────────────────────────────── */}
      {on && (
        <section className="rounded-xl border border-border bg-muted/40 p-5">
          <div className="flex items-start gap-2">
            <Info size={15} className="text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-foreground">
              <p>
                <strong className="tabular-nums">{data.waiting}</strong>{" "}
                {data.waiting === 1 ? t("app.setReviews.customerIs") : t("app.setReviews.customersAre")}{" "}
                {t("app.setReviews.inQueueAnd")}{" "}
                <strong className="tabular-nums">{data.askedRecently}</strong>{" "}
                {data.askedRecently === 1 ? t("app.setReviews.has") : t("app.setReviews.have")}{" "}
                {t("app.setReviews.beenAsked")}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {t("app.setReviews.footnote")}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── What to do with the reviews once they exist ────────────────── */}
      <Testimonials />

      {saved && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <Check size={15} /> {t("app.action.saved")}
        </p>
      )}
      {saving && (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Loader2 size={15} className="animate-spin" /> {t("app.action.saving")}
        </p>
      )}
    </div>
  );
}
