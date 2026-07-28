// app/app/settings/booking-page/page.js
"use client";

import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

export default function BookingPageSettings() {
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    durationMinutes: 60,
    bufferBefore: 0,
    bufferAfter: 0,
    location: "",
  });

  useEffect(() => {
    fetch("/api/event-types")
      .then((r) => r.json())
      .then((data) => setEventTypes(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

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
      <div className="p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
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

      <div className="space-y-2">
        {eventTypes.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            No event types yet — clients can't book anything until you add one.
          </div>
        )}
        {eventTypes.map((et) => (
          <div
            key={et.id}
            className="bg-card border border-border rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <div className="font-medium text-foreground">{et.name}</div>
              <div className="text-xs text-muted-foreground">
                {et.durationMinutes} min{et.location ? ` · ${et.location}` : ""}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={et.active}
                onChange={() => toggleActive(et)}
              />
              Active
            </label>
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
              <div className="grid grid-cols-3 gap-2">
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
