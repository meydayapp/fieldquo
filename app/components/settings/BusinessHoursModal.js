// app/components/settings/BusinessHoursModal.js
//
// ── This is ONE PERSON'S booking availability, not the company's hours ──────
//
// The file name is now the only thing left saying "business hours", and it is
// wrong. PATCH /api/availability with no `userId` resolves the target to
// `member.userId` (app/api/availability/route.js), so everything here writes
// the SIGNED-IN USER'S AvailabilitySchedule rows and nobody else's.
//
// Until this pass the modal was titled "Business Hours" and said it set
// availability "for online booking, team members, and request forms". It sets
// nothing for team members. That is the exact bug AGENTS.md lists by name —
// "a card titled Business Hours that actually edited one user's booking
// calendar" — surviving inside the component the card rename went around.
//
// Company opening hours are a different column with a different audience:
// Company.businessHours, edited by OpeningHoursEditor, published to the public
// site and to Google. The two are ALLOWED to disagree, and conflating them
// publishes an estimator's day off as a company closure. See
// lib/company/businessHours.js.
//
// Renaming rather than deleting: the standalone /app/settings/availability
// page edits both this and WorkingHours and can set them for a colleague, so
// this modal is the quick path from Company settings, not a second source of
// truth.
"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { orderedWeekdays } from "@/lib/format/companyDate";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function BusinessHoursModal({ isOpen, onClose, onSaved }) {
  const { t } = useTranslation();
  const { weekStartsOn } = useCompanyPreferences();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // The save deletes every row for this user before writing the new set, so a
  // read that failed and rendered as "closed all week" would delete the week
  // on the next Save — with a 200 back. `res.json()` succeeds on a 403 or 500
  // (Next sends `{ error: … }`), which the old unchecked chain turned into
  // `[]` via the Array.isArray guard. Refuse instead.
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setLoadFailed(false);
    fetch("/api/availability")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("availability"))))
      .then((data) => setSchedules(Array.isArray(data) ? data : []))
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  function getDay(dayOfWeek) {
    return schedules.find((s) => s.dayOfWeek === dayOfWeek);
  }

  function toggleDay(dayOfWeek) {
    setSchedules((prev) => {
      const existing = prev.find((s) => s.dayOfWeek === dayOfWeek);
      if (existing) return prev.filter((s) => s.dayOfWeek !== dayOfWeek);
      return [
        ...prev,
        {
          dayOfWeek,
          startTime: "08:00",
          endTime: "17:00",
          timezone: "America/Toronto",
        },
      ];
    });
  }

  function updateTime(dayOfWeek, field, value) {
    setSchedules((prev) =>
      prev.map((s) =>
        s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s,
      ),
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules }),
      });
      // Previously `if (res.ok)` with no else: a failed save closed nothing,
      // said nothing, and left the user believing their hours were saved.
      // Silently discarding someone's input is worse than any error message.
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error ||
            t("app.setAvailability.saveError"),
        );
      }
      setError("");
      onSaved?.(schedules);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-foreground">
            {t("app.setCompany.bookingTitle")}
          </h2>
          <button onClick={onClose} aria-label={t("app.action.close")}>
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t("app.setCompany.bookingDesc")}
        </p>

        {loading ? (
          <div className="h-64 bg-muted rounded-xl animate-pulse" />
        ) : loadFailed ? (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {t("app.error.network")}
          </div>
        ) : (
          <div className="border border-border rounded-xl divide-y divide-border">
            {orderedWeekdays(weekStartsOn).map(({ label, index: dayOfWeek }) => {
              const day = getDay(dayOfWeek);
              return (
                <div
                  key={dayOfWeek}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <label className="flex items-center gap-2.5 w-28 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!day}
                      onClick={() => toggleDay(dayOfWeek)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
                        day ? "bg-inverted" : "bg-accent"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-card transition-transform ${
                          day ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-foreground">
                      {label}
                    </span>
                  </label>

                  {day ? (
                    <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-2 py-1.5">
                      <input
                        type="time"
                        value={day.startTime}
                        onChange={(e) =>
                          updateTime(dayOfWeek, "startTime", e.target.value)
                        }
                        className="bg-transparent text-sm text-foreground outline-none"
                      />
                      <span className="text-muted-foreground text-sm">{t("app.setAvailability.to")}</span>
                      <input
                        type="time"
                        value={day.endTime}
                        onChange={(e) =>
                          updateTime(dayOfWeek, "endTime", e.target.value)
                        }
                        className="bg-transparent text-sm text-foreground outline-none"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("app.setAvailability.notScheduled")}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-border text-foreground py-2.5 rounded-lg text-sm font-semibold"
          >
            {t("app.action.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || loadFailed}
            className="flex-1 bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {saving ? t("app.action.saving") : t("app.action.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
