// app/app/settings/availability/page.js
"use client";

import { useState, useEffect } from "react";
import { orderedWeekdays } from "@/lib/format/companyDate";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";

export default function AvailabilityPage() {
  const { weekStartsOn } = useCompanyPreferences();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/availability")
      .then((r) => r.json())
      .then((data) => setSchedules(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

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
    await fetch("/api/availability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedules }),
    });
    setSaving(false);
  }

  if (loading)
    return (
      <div className="p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Availability</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set your weekly hours — this controls what slots clients can book on
          your public calendar.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {orderedWeekdays(weekStartsOn).map(({ label, index: dayOfWeek }) => {
          const day = getDay(dayOfWeek);
          return (
            <div key={dayOfWeek} className="flex items-center gap-4 px-5 py-3">
              <label className="flex items-center gap-2 w-32 shrink-0">
                <input
                  type="checkbox"
                  checked={!!day}
                  onChange={() => toggleDay(dayOfWeek)}
                />
                <span className="text-sm font-medium text-foreground">
                  {label}
                </span>
              </label>
              {day && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={day.startTime}
                    onChange={(e) =>
                      updateTime(dayOfWeek, "startTime", e.target.value)
                    }
                    className="border border-border rounded px-2 py-1 text-sm"
                  />
                  <span className="text-muted-foreground text-sm">to</span>
                  <input
                    type="time"
                    value={day.endTime}
                    onChange={(e) =>
                      updateTime(dayOfWeek, "endTime", e.target.value)
                    }
                    className="border border-border rounded px-2 py-1 text-sm"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-inverted text-inverted-foreground px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save Availability"}
      </button>
    </div>
  );
}
