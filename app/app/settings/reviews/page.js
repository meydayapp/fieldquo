"use client";

// app/app/settings/reviews/page.js
//
// Automatic review requests.
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

const DELAYS = [
  { hours: 2, label: "2 hours later" },
  { hours: 4, label: "4 hours later" },
  { hours: 24, label: "The next day" },
  { hours: 48, label: "Two days later" },
  { hours: 72, label: "Three days later" },
  { hours: 168, label: "A week later" },
];

export default function ReviewSettingsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [url, setUrl] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/reviews");
    if (!res.ok) {
      await reportResponseError(res, "Couldn't load your review settings.");
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
        await reportResponseError(res, "Couldn't save that.");
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
          <Star size={22} /> Reviews
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ask customers for a review automatically once their job is finished.
        </p>
      </div>

      {/* ── Where to send them ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-5">
        <label htmlFor="reviewUrl" className="block text-sm font-semibold text-foreground">
          Your review link
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          Usually your Google review link. On your Google Business Profile, choose
          “Ask for reviews” and copy the short link.
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
            Save
          </button>
        </div>
        {hasUrl && (
          <a
            href={data.reviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-2"
          >
            <ExternalLink size={12} /> Open it and check it goes where you expect
          </a>
        )}
      </section>

      {/* ── The switch ─────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Ask automatically
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasUrl
                ? "Every customer with an email address gets one message after their job is marked complete. Never more than one."
                : "Add your review link above first."}
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
            <p className="text-sm font-semibold text-foreground">When to ask</p>
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
                  {d.label}
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
                {data.waiting === 1 ? "customer is" : "customers are"} in the queue,
                and <strong className="tabular-nums">{data.askedRecently}</strong>{" "}
                {data.askedRecently === 1 ? "has" : "have"} been asked in the last 30 days.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Customers who have unsubscribed are skipped, and anyone who
                replies saying something went wrong reaches you directly rather
                than the review page.
              </p>
            </div>
          </div>
        </section>
      )}

      {saved && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <Check size={15} /> Saved
        </p>
      )}
      {saving && (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Loader2 size={15} className="animate-spin" /> Saving…
        </p>
      )}
    </div>
  );
}
