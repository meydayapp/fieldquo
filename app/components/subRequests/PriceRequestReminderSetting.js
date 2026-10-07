// app/components/subRequests/PriceRequestReminderSetting.js
//
// "Remind a sub who hasn't answered a price request after N days" — the one
// setting of the price-request flow (Company.subRequestReminderDays; the
// owner, 2026-10-06: default on, 3 days; one reminder, never two). Read by
// the daily follow-ups cron. On the Subcontractors page, beside the subs it
// emails. Saved as soon as it is changed; the saved value is what is shown.
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";

const CHOICES = [0, 1, 2, 3, 5, 7, 10, 14];

export default function PriceRequestReminderSetting() {
  const { t } = useTranslation();
  const [days, setDays] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/price-requests/settings")
      .then((d) => !cancelled && setDays(d.reminderDays))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (days === null) return null;

  async function change(value) {
    const next = Number(value);
    setSaving(true);
    setError("");
    try {
      const d = await fetchJson("/api/price-requests/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderDays: next }),
      });
      setDays(d.reminderDays);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const choices = CHOICES.includes(days) ? CHOICES : [...CHOICES, days].sort((a, b) => a - b);
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3">
      <label className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-foreground">{t("app.priceRequests.reminderLabel")}</span>
        <span className="inline-flex items-center gap-2">
          {saving && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          <select
            value={days}
            onChange={(e) => change(e.target.value)}
            disabled={saving}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-11"
          >
            {choices.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? t("app.priceRequests.reminderOff") : t("app.priceRequests.reminderDays", { n })}
              </option>
            ))}
          </select>
        </span>
      </label>
      <p className="text-xs text-muted-foreground mt-1">{t("app.priceRequests.reminderHint")}</p>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
