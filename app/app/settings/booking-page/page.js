// app/app/settings/booking-page/page.js
"use client";

import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

const MODES = [
  { key: "visit", label: "Visit their place", hint: "You go to them" },
  { key: "call", label: "Phone call", hint: "You ring them" },
  { key: "video", label: "Video call", hint: "You send a link" },
];

export default function BookingPageSettings() {
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  // The company's answer to "how long is a visit". Used as the default for any
  // consultation FieldQuo creates automatically when someone sets availability —
  // which was hardcoded to an hour, whatever the trade.
  const [visitMinutes, setVisitMinutes] = useState(60);
  const [savingVisit, setSavingVisit] = useState(false);
  // Which ways a client may meet them. Drives the choice on the public booking
  // page — with one mode selected the visitor isn't asked, because a control with
  // one option is a label.
  const [modes, setModes] = useState(["visit"]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    durationMinutes: 60,
    bufferBefore: 0,
    bufferAfter: 0,
    location: "",
  });
  const [travel, setTravel] = useState({ enabled: true, buffer: 0 });
  const [arrival, setArrival] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/event-types").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/settings/business-info").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([types, info]) => {
        setEventTypes(Array.isArray(types) ? types : []);
        if (info?.defaultVisitMinutes) setVisitMinutes(info.defaultVisitMinutes);
        if (Array.isArray(info?.bookingModes) && info.bookingModes.length) setModes(info.bookingModes);
        setTravel({
          enabled: info?.travelCheckEnabled !== false,
          buffer: info?.travelBufferMinutes ?? 0,
        });
        setArrival(info?.arrivalWindowMinutes ?? 0);
        setForm((f) => ({ ...f, durationMinutes: info?.defaultVisitMinutes || 60 }));
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveTravel(patch) {
    // Optimistic, then reconciled from the server's answer — the buffer is
    // clamped server-side, so echoing back what was typed would show 600 when
    // 120 was stored.
    setTravel((t) => ({ ...t, ...patch }));
    const res = await fetch("/api/settings/business-info", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      await reportResponseError(res, "Couldn't save the travel settings.");
      return;
    }
    const info = await res.json().catch(() => null);
    if (info) {
      setTravel({
        enabled: info.travelCheckEnabled !== false,
        buffer: info.travelBufferMinutes ?? 0,
      });
    }
  }

  async function saveArrival(minutes) {
    setArrival(minutes);
    const res = await fetch("/api/settings/business-info", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arrivalWindowMinutes: minutes }),
    });
    if (!res.ok) {
      await reportResponseError(res, "Couldn't save the arrival window.");
      return;
    }
    const info = await res.json().catch(() => null);
    if (info) setArrival(info.arrivalWindowMinutes ?? 0);
  }

  async function toggleMode(key) {
    // Never allowed to reach zero — that would leave a booking page nobody can
    // complete. The last remaining mode simply can't be switched off.
    const next = modes.includes(key) ? modes.filter((m) => m !== key) : [...modes, key];
    if (!next.length) return;
    setModes(next);
    const res = await fetch("/api/settings/business-info", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingModes: next }),
    });
    if (!res.ok) await reportResponseError(res, "Couldn't save how clients can meet you.");
  }

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
        <div className="mb-5">
          <p className="text-sm font-semibold text-foreground mb-1">
            How can clients meet you?
          </p>
          <p className="text-xs text-muted-foreground mb-2.5">
            Pick everything you offer. If you offer more than one, the client
            chooses when they book.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => toggleMode(m.key)}
                title={m.hint}
                className={`text-sm px-3 py-2 rounded-full border transition-colors ${
                  modes.includes(m.key)
                    ? "border-foreground bg-inverted text-inverted-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Travel between jobs ─────────────────────────────────────────
            Only relevant when someone is actually driving to a client, so it's
            hidden entirely for a phone-only company rather than shown greyed
            out — a control that can't apply is noise. */}
        {modes.includes("visit") && (
          <div className="mb-5 pt-5 border-t border-border">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Don&apos;t offer times you can&apos;t drive to
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Clients give an address when they book a visit. Times you
                  couldn&apos;t reach on schedule from your previous job are
                  hidden.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={travel.enabled}
                onClick={() => saveTravel({ travelCheckEnabled: !travel.enabled })}
                className={`shrink-0 w-11 h-6 rounded-full transition-colors ${
                  travel.enabled ? "bg-emerald-600" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    travel.enabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {travel.enabled && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-foreground mb-1">
                  Extra time between jobs
                </p>
                <p className="text-xs text-muted-foreground mb-2.5">
                  Added on top of the drive — parking, unloading, writing up the
                  last job. Starts at none, because guessing on your behalf
                  removes bookable slots you never agreed to give up.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 10, 15, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => saveTravel({ travelBufferMinutes: m })}
                      className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                        travel.buffer === m
                          ? "border-foreground bg-inverted text-inverted-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === 0 ? "None" : `${m} min`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Arrival window ──────────────────────────────────────────── */}
        {modes.includes("visit") && (
          <div className="mb-5 pt-5 border-t border-border">
            <p className="text-sm font-semibold text-foreground mb-1">
              What do you promise the client?
            </p>
            <p className="text-xs text-muted-foreground mb-2.5">
              A window is a promise the road can&apos;t break. Your own schedule
              keeps the exact time either way — this only changes what the
              client is told.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[0, 15, 30, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => saveArrival(m)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    arrival === m
                      ? "border-foreground bg-inverted text-inverted-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === 0 ? "Exact time" : `± ${m} min`}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {arrival === 0
                ? "They'll be told 2:00 PM."
                : `They'll be told "between ${
                    arrival >= 60 ? "1:00" : arrival === 30 ? "1:30" : "1:45"
                  } and ${arrival >= 60 ? "3:00" : arrival === 30 ? "2:30" : "2:15"} PM".`}
            </p>
          </div>
        )}

        <p className="text-sm font-semibold text-foreground mb-1">How long is a visit?</p>
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
