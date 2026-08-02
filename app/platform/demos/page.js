"use client";

// app/platform/demos/page.js
//
// Booked product demos (DemoBooking) — FieldQuo's own sales calendar, the ones
// prospects grab from the marketing hero. Upcoming at the top, recent/closed
// below. Times shown in Eastern (the tz the slots are offered in) so what's here
// matches the calendar invite that went out.

import { useEffect, useState } from "react";
import { Loader2, CalendarCheck, Mail, Phone, Building2 } from "lucide-react";

const TZ = "America/Toronto";
const whenFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, weekday: "short", month: "short", day: "numeric",
  hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
});

export default function DemosPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/platform/demos");
      if (!res.ok) throw new Error("Couldn't load demo bookings.");
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id, status) {
    setBusyId(id);
    try {
      const res = await fetch("/api/platform/demos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Couldn't update.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }
  if (!data) {
    return (
      <div className="p-6 text-sm text-muted-foreground inline-flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  const Row = ({ b, upcoming }) => (
    <div className="border border-border rounded-xl p-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <CalendarCheck size={15} className="text-muted-foreground" />
          {whenFmt.format(new Date(b.scheduledAt))}
          {b.status !== "booked" && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">
              {b.status}
            </span>
          )}
        </div>
        <div className="text-sm text-foreground mt-1.5">{b.name}</div>
        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <a href={`mailto:${b.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
            <Mail size={12} /> {b.email}
          </a>
          {b.phone && (
            <span className="inline-flex items-center gap-1"><Phone size={12} /> {b.phone}</span>
          )}
          {b.companyName && (
            <span className="inline-flex items-center gap-1"><Building2 size={12} /> {b.companyName}</span>
          )}
        </div>
        {b.notes && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{b.notes}</p>}
      </div>
      {upcoming && (
        <div className="flex gap-2 shrink-0">
          <button
            disabled={busyId === b.id}
            onClick={() => setStatus(b.id, "completed")}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50"
          >
            Mark done
          </button>
          <button
            disabled={busyId === b.id}
            onClick={() => setStatus(b.id, "cancelled")}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Demo bookings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Product demos booked from the marketing site. Times are Eastern.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Upcoming ({data.upcoming.length})
        </h2>
        {data.upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing booked yet.</p>
        ) : (
          <div className="space-y-2">
            {data.upcoming.map((b) => <Row key={b.id} b={b} upcoming />)}
          </div>
        )}
      </section>

      {data.past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Past &amp; closed
          </h2>
          <div className="space-y-2 opacity-80">
            {data.past.map((b) => <Row key={b.id} b={b} upcoming={false} />)}
          </div>
        </section>
      )}
    </div>
  );
}
