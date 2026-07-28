// app/app/settings/notifications/page.js
//
// Alert rules. Currently one rule type — large quote created — because that's
// the only one the cron layer actually acts on. Listing settings the system
// ignores is worse than not offering them: someone configures an alert, trusts
// it, and never hears anything.
//
// The page says plainly when a rule can't fire, and why.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, Bell, Check } from "lucide-react";

export default function NotificationsPage() {
  const [rules, setRules] = useState([]);
  const [threshold, setThreshold] = useState("");
  const [active, setActive] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/settings/notification-rules");
      if (!res.ok) throw new Error("Couldn't load your alert settings.");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setRules(list);

      const large = list.find((r) => r.type === "large_quote");
      if (large) {
        setThreshold(large.threshold != null ? String(Number(large.threshold)) : "");
        setActive(large.active !== false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings/notification-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "large_quote",
          threshold: Number(threshold),
          active,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || "Couldn't save.");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="animate-pulse h-72 bg-gray-200 rounded-xl max-w-2xl" />
    );

  const existing = rules.find((r) => r.type === "large_quote");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-500 mt-1">
          When FieldQuo should email you about something happening in your
          account.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Bell size={18} className="text-gray-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900">Large quote created</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Emails everyone with an owner or admin role when someone on your
              team writes a quote above this amount.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Send this alert
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alert me above
          </label>
          <div className="relative w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              $
            </span>
            <input
              type="number"
              min="0"
              step="100"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="10000"
              disabled={!active}
              className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        </div>

        {/* The check runs on a schedule, not on quote creation. Saying so
            prevents "I made a big quote and nothing happened" twenty minutes
            later. */}
        <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
          This runs on a daily schedule rather than the instant a quote is
          saved, so expect the email within a day.
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={save}
            disabled={saving || (active && !(Number(threshold) > 0))}
            className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
              <Check size={14} /> Saved
            </span>
          )}
          {!existing && !saved && (
            <span className="text-xs text-gray-400">
              Not set up yet — no alerts are being sent.
            </span>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900">Client-facing emails</h2>
        <p className="text-sm text-gray-500 mt-1">
          Quote, receipt and follow-up emails are configured separately — what
          they say lives in{" "}
          <Link href="/app/settings/email-templates" className="underline">
            Email Templates
          </Link>
          , and when they go out lives in{" "}
          <Link href="/app/settings/follow-ups" className="underline">
            Follow-ups
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
