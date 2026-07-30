// app/app/settings/booking-page/page.js
"use client";

import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

export default function BookingPageSettings() {
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  // The company's answer to "how long is a visit". Used as the default for any
  // consultation FieldQuo creates automatically when someone sets availability —
  // which was hardcoded to an hour, whatever the trade.
  const [visitMinutes, setVisitMinutes] = useState(60);
  const [savingVisit, setSavingVisit] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    durationMinutes: 60,
    bufferBefore: 0,
    bufferAfter: 0,
    location: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/event-types").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/settings/business-info").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([types, info]) => {
        setEventTypes(Array.isArray(types) ? types : []);
        if (info?.defaultVisitMinutes) setVisitMinutes(info.defaultVisitMinutes);
        setForm((f) => ({ ...f, durationMinutes: info?.defaultVisitMinutes || 60 }));
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveVisitMinutes(minutes) {
    setVisitMinutes(minutes);
    setSavingVisit(true);
    const res = await fetch("/api/settings/business-info", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultVisitMinutes: minutes }),
    });
    setSavingVisit(false);
    if (!res.ok) {
      await reportResponseError(res, "Couldn't save the visit length.");
    }
  }

  /**
   * Change one event type's length.
   *
   * The API has always accepted durationMinutes on PATCH; nothing in the UI ever
   * sent it, so a booking length was fixed the moment it was created — a
   * classic field that could be written and never was.
   */
  async function setDuration(eventType, minutes) {
    const res = await fetch(`/api/event-types/${eventType.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMinutes: minutes }),
    });
    if (res.ok) {
      const updated = await res.json();
      setEventTypes((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } else {
      await reportResponseError(res, "Couldn't change the length of that visit.");
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const res = await fetch("/api/event-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const created = await res.json();
      setEventTypes((prev) => [...prev, created]);
      setShowForm(false);
      setForm({
        name: "",
        durationMinutes: 60,
        bufferBefore: 0,
        bufferAfter: 0,
        location: "",
      });
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  async function toggleActive(eventType) {
    const res = await fetch(`/api/event-types/${eventType.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !eventType.active }),
    });
    if (res.ok) {
      const updated = await res.json();
      setEventTypes((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e)),
      );
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Booking Page</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Event types clients can book directly from your public page.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold"
        >
          <Plus size={14} /> New Event Type
        </button>
      </div>

      {/* One answer to "how long is a visit", used for anything FieldQuo creates
          automatically. Separate from the per-event lengths below because those
          are exceptions and this is the rule. */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 mb-4">
        <h2 className="font-semibold text-foreground">How long is a visit?</h2>
        <p className="text-sm text-muted-foreground mt-0.5 mb-3">
          Used for any consultation FieldQuo sets up for a team member when they
          add their availability. Existing bookings keep the length they were made
          with.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => saveVisitMinutes(m)}
              disabled={savingVisit}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors disabled:opacity-60 ${
                visitMinutes === m
                  ? "border-foreground bg-inverted text-inverted-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {eventTypes.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            No event types yet — clients can't book anything until you add one.
          </div>
        )}
        {eventTypes.map((et) => (
          <div
            key={et.id}
            className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="font-medium text-foreground">{et.name}</div>
              <div className="text-xs text-muted-foreground">
                {et.location || "No location set"}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <label className="flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground text-xs">Length</span>
                <select
                  value={et.durationMinutes}
                  onChange={(e) => setDuration(et, Number(e.target.value))}
                  className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
                >
                  {/* The saved value is included even if it isn't one of the
                      presets, so an existing 75-minute visit isn't silently
                      rounded to 60 the moment someone opens this page. */}
                  {[...new Set([...DURATIONS, et.durationMinutes])]
                    .sort((a, b) => a - b)
                    .map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                </select>
              </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={et.active}
                onChange={() => toggleActive(et)}
              />
              Active
            </label>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">New Event Type</h2>
              <button onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                required
                placeholder="Name (e.g. In-home consult)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="Minutes"
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      durationMinutes: Number(e.target.value),
                    })
                  }
                  className="border rounded px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Buffer before"
                  value={form.bufferBefore}
                  onChange={(e) =>
                    setForm({ ...form, bufferBefore: Number(e.target.value) })
                  }
                  className="border rounded px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Buffer after"
                  value={form.bufferAfter}
                  onChange={(e) =>
                    setForm({ ...form, bufferAfter: Number(e.target.value) })
                  }
                  className="border rounded px-3 py-2 text-sm"
                />
              </div>
              <input
                placeholder="Location (optional)"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full bg-inverted text-inverted-foreground py-2 rounded-full text-sm font-semibold"
              >
                Create
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
