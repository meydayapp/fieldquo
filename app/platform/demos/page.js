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

// DemoBooking.status is a String column, not an enum, and the PATCH here only
// ever writes one of these three (see the route's own allow-list). It was
// printed raw into a pill — "cancelled", "completed", grey either way — so the
// call that HAPPENED and the call that was called off read identically at a
// glance on a sales calendar. A value from anywhere else says it is unknown
// rather than being shown as if it were expected.
const STATUS_META = {
  booked: { label: "Booked", className: "border-border text-muted-foreground" },
  completed: {
    label: "Done",
    className:
      "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  },
};

function statusMeta(status) {
  return (
    STATUS_META[status] || {
      label: `Unrecognised: ${status}`,
      className:
        "border-purple-300 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200",
    }
  );
}

const whenFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, weekday: "short", month: "short", day: "numeric",
  hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
});

export default function DemosPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/platform/demos");
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || `Couldn't load demo bookings (${res.status}).`);
      }
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

  // The error used to REPLACE the whole page, so a failed "Mark done" wiped the
  // calendar an agent was reading between calls and left them a red sentence
  // with no way back. It is a banner over the list now, and the list only
  // disappears when there is genuinely nothing loaded to show. (text-red-600
  // also had no dark variant — 3.54:1 on --card, the same measurement the
  // Cancel button below was fixed for and this line was not.)
  const banner = error ? (
    <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-3">
      <span>{error}</span>
      <button onClick={load} className="font-semibold underline underline-offset-2 shrink-0">
        Try again
      </button>
    </div>
  ) : null;

  if (!data) {
    return (
      <div className="max-w-3xl p-4 sm:p-6 space-y-4">
        {banner}
        {!error && (
          <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        )}
        {error && (
          <p className="text-sm text-muted-foreground">
            No bookings are shown because none could be read. Nothing has been
            cancelled — check again before telling anyone their slot is gone.
          </p>
        )}
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
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusMeta(b.status).className}`}
            >
              {statusMeta(b.status).label}
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
            // No dark variant at all, so both halves were wrong in dark mode:
            // red-600 measures 3.54:1 on --card, and the hover fill painted a
            // near-white pill onto a dark page. red-700/red-400 is 6.42:1 and
            // 5.84:1 on the surface each actually lands on.
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
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

      {banner}

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
