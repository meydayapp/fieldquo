// app/components/settings/BusinessHoursModal.js
//
// Wraps your existing /api/availability endpoint (already GET/PATCH
// [{ dayOfWeek, startTime, endTime, timezone }]) in a modal, since Company
// Settings wants "Edit" -> popup rather than the full standalone
// /app/settings/availability page. That page can stay as-is or redirect
// here later — this doesn't change the API contract at all.
"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function BusinessHoursModal({ isOpen, onClose, onSaved }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/availability")
      .then((r) => r.json())
      .then((data) => setSchedules(Array.isArray(data) ? data : []))
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
        throw new Error(data?.error || "Couldn't save your business hours.");
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
        className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-900">
            Business Hours
          </h2>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-gray-400" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Sets your default availability for online booking, team members, and
          request forms.
        </p>

        {loading ? (
          <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
        ) : (
          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
            {DAYS.map((label, dayOfWeek) => {
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
                        day ? "bg-gray-900" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          day ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-gray-900">
                      {label}
                    </span>
                  </label>

                  {day ? (
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                      <input
                        type="time"
                        value={day.startTime}
                        onChange={(e) =>
                          updateTime(dayOfWeek, "startTime", e.target.value)
                        }
                        className="bg-transparent text-sm text-gray-900 outline-none"
                      />
                      <span className="text-gray-400 text-sm">to</span>
                      <input
                        type="time"
                        value={day.endTime}
                        onChange={(e) =>
                          updateTime(dayOfWeek, "endTime", e.target.value)
                        }
                        className="bg-transparent text-sm text-gray-900 outline-none"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
