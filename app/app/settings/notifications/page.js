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
import { useTranslation } from "@/app/hooks/useTranslation";

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [rules, setRules] = useState([]);
  const [threshold, setThreshold] = useState("");
  const [active, setActive] = useState(true);
  // Appointment reminder lead time in hours, or null for off.
  const [reminderHours, setReminderHours] = useState(null);
  const [remSaving, setRemSaving] = useState(false);
  const [remSaved, setRemSaved] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/settings/notification-rules");
      if (!res.ok) throw new Error(t("app.setNotifications.loadError"));
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setRules(list);

      const large = list.find((r) => r.type === "large_quote");
      if (large) {
        setThreshold(large.threshold != null ? String(Number(large.threshold)) : "");
        setActive(large.active !== false);
      }

      const rem = await fetch("/api/settings/appointment-reminders");
      if (rem.ok) {
        const d = await rem.json().catch(() => null);
        setReminderHours(d?.hours ?? null);
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
      if (!res.ok) throw new Error(d?.error || t("app.setNotifications.saveError"));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveReminders(hours) {
    setRemSaving(true);
    setError("");
    setRemSaved(false);
    // Optimistic: reflect the choice immediately, roll back if the save fails.
    const previous = reminderHours;
    setReminderHours(hours);
    try {
      const res = await fetch("/api/settings/appointment-reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || t("app.setNotifications.saveError"));
      setReminderHours(d?.hours ?? null);
      setRemSaved(true);
      setTimeout(() => setRemSaved(false), 3000);
    } catch (err) {
      setReminderHours(previous);
      setError(err.message);
    } finally {
      setRemSaving(false);
    }
  }

  if (loading)
    return (
      <div className="animate-pulse h-72 bg-accent rounded-xl max-w-2xl" />
    );

  // Off + the lead times the API accepts. Kept in step with ALLOWED there.
  const REMINDER_OPTIONS = [
    { value: null, label: t("app.setReminders.off", "Off") },
    { value: 2, label: t("app.setReminders.h2", "2 hours before") },
    { value: 24, label: t("app.setReminders.h24", "24 hours before") },
    { value: 48, label: t("app.setReminders.h48", "48 hours before") },
  ];

  const existing = rules.find((r) => r.type === "large_quote");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.settings.notifications")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setNotifications.subtitle")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Bell size={18} className="text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">{t("app.setNotifications.largeQuoteTitle")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("app.setNotifications.largeQuoteDesc")}
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          {t("app.setNotifications.sendAlert")}
        </label>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t("app.setNotifications.alertAbove")}
          </label>
          <div className="relative w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
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
              className="w-full border border-border rounded-lg pl-7 pr-3 py-2 text-sm disabled:bg-muted disabled:text-muted-foreground"
            />
          </div>
        </div>

        {/* The check runs on a schedule, not on quote creation. Saying so
            prevents "I made a big quote and nothing happened" twenty minutes
            later. */}
        <p className="text-xs text-muted-foreground border-t border-border pt-3">
          {t("app.setNotifications.scheduleNote")}
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={save}
            disabled={saving || (active && !(Number(threshold) > 0))}
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {t("app.action.save")}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-300">
              <Check size={14} /> {t("app.action.saved")}
            </span>
          )}
          {!existing && !saved && (
            <span className="text-xs text-muted-foreground">
              {t("app.setNotifications.notSetUp")}
            </span>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Bell size={18} className="text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">
              {t("app.setReminders.title", "Appointment reminders")}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("app.setReminders.desc", "Text the client a reminder before their appointment. Sent from your business name; clients can reply STOP to opt out.")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {REMINDER_OPTIONS.map((opt) => {
            const on = reminderHours === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                disabled={remSaving}
                onClick={() => saveReminders(opt.value)}
                className={`px-4 py-2 rounded-full border text-sm font-medium disabled:opacity-60 ${
                  on
                    ? "border-inverted bg-inverted text-inverted-foreground"
                    : "border-border text-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground border-t border-border pt-3">
          {t("app.setReminders.note", "Each reminder is a text message billed to your account. We never text a client who has opted out, and never more than once per appointment.")}
          {remSaving && (
            <span className="inline-flex items-center gap-1.5 ml-2">
              <Loader2 size={12} className="animate-spin" /> {t("app.action.saving")}
            </span>
          )}
          {remSaved && (
            <span className="inline-flex items-center gap-1.5 ml-2 text-green-700 dark:text-green-300">
              <Check size={12} /> {t("app.action.saved")}
            </span>
          )}
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground">{t("app.setNotifications.clientEmailsTitle")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setNotifications.clientEmailsPre")}{" "}
          <Link href="/app/settings/email-templates" className="underline">
            {t("app.settings.emailTemplates")}
          </Link>
          {t("app.setNotifications.clientEmailsMid")}{" "}
          <Link href="/app/settings/follow-ups" className="underline">
            {t("app.settings.followUps")}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
