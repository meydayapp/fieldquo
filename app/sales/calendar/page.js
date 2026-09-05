// app/sales/calendar/page.js
//
// A rep's own calendar — the appointments they'll attend and the callbacks they
// promised, on a month grid. Everything on it is theirs: /api/sales/events is
// scoped by salesRepId server-side, so this screen has no notion of "whose"
// events these are and cannot ask for another rep's.
//
// Click a day to book something on it; click an event to edit it, mark it done,
// or call it off. New events fill their contact from the rep's own leads — the
// same pipeline the rest of the portal works from.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Loader2, Phone, CalendarClock } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import EventModal from "./EventModal";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ymd = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const sameDay = (a, b) => ymd(a) === ymd(b);

// The 42-cell (6-week) grid for the month containing `cursor`, starting on the
// Sunday on or before the 1st — the shape every month calendar uses so the
// weekday columns line up.
function monthGrid(cursor) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function SalesCalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // {initial} or null

  const grid = useMemo(() => monthGrid(cursor), [cursor]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const from = grid[0];
      const to = new Date(grid[41]);
      to.setHours(23, 59, 59);
      const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      const data = await fetchJson(`/api/sales/events?${params}`);
      setEvents(data.events || []);
    } catch (err) {
      // Never `if (res.ok)` with no else — the failure class AGENTS.md names.
      setError(err.message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [grid]);

  useEffect(() => {
    load();
  }, [load]);

  // The lead list, once, for the modal's contact picker. A failure here is not
  // fatal to the calendar — the picker just shows no leads and the rep types the
  // contact by hand — so it never sets the page-level error.
  useEffect(() => {
    fetchJson("/api/sales/leads")
      .then((d) => setLeads(d.leads || []))
      .catch(() => setLeads([]));
  }, []);

  const byDay = useMemo(() => {
    const m = new Map();
    for (const e of events) {
      const key = ymd(new Date(e.startAt));
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(e);
    }
    return m;
  }, [events]);

  const today = new Date();

  function openNew(day) {
    const at = new Date(day);
    const now = new Date();
    at.setHours(9, 0, 0, 0); // a sensible default a rep will usually change
    // If they clicked today, start from the next round hour instead of 9am.
    if (sameDay(day, now)) at.setHours(now.getHours() + 1, 0, 0, 0);
    setModal({ initial: { startAt: at.toISOString(), type: "callback" } });
  }

  function saved() {
    setModal(null);
    load();
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground">Your appointments and callbacks.</p>
        </div>
        <button
          onClick={() => openNew(new Date())}
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 shrink-0"
        >
          <Plus size={16} /> New event
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-2 rounded-lg border border-border" aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCursor(new Date())} className="px-3 py-2 rounded-lg border border-border text-sm font-medium">
            Today
          </button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-2 rounded-lg border border-border" aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="font-semibold text-foreground">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          {loading && <Loader2 size={14} className="inline ml-2 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}{" "}
          <button onClick={load} className="underline font-medium">Try again</button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 gap-px mb-px">
              {DOW.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {grid.map((day) => {
                const inMonth = day.getMonth() === cursor.getMonth();
                const isToday = sameDay(day, today);
                const dayEvents = byDay.get(ymd(day)) || [];
                return (
                  <button
                    key={ymd(day)}
                    onClick={() => openNew(day)}
                    className={`min-h-[92px] text-left p-1.5 align-top ${inMonth ? "bg-card" : "bg-muted/40"} hover:bg-accent/50 transition-colors`}
                  >
                    <div className={`text-xs font-medium mb-1 inline-flex items-center justify-center ${isToday ? "bg-blue-600 text-white rounded-full w-5 h-5" : inMonth ? "text-foreground" : "text-muted-foreground"}`}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          role="button"
                          tabIndex={0}
                          onClick={(ev) => { ev.stopPropagation(); setModal({ initial: e }); }}
                          onKeyDown={(ev) => { if (ev.key === "Enter") { ev.stopPropagation(); setModal({ initial: e }); } }}
                          className={`flex items-center gap-1 rounded px-1 py-0.5 text-[11px] leading-tight truncate ${
                            e.type === "callback"
                              ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                              : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                          } ${e.status === "done" ? "line-through opacity-60" : ""}`}
                        >
                          {e.type === "callback" ? <Phone size={10} className="shrink-0" /> : <CalendarClock size={10} className="shrink-0" />}
                          <span className="truncate">{fmtTime(e.startAt)} {e.businessName || e.title || (e.type === "callback" ? "Call back" : "Appointment")}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[11px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {modal && (
        <EventModal
          initial={modal.initial}
          leads={leads}
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
