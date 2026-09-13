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
import { useTranslation } from "@/app/hooks/useTranslation";
import { formatTimeOfDay, weekdayNames } from "@/lib/format/localeDate";
import { localeFormat } from "@/lib/calendar/monthGrid";
import EventModal from "./EventModal";

// Weekday and month names are NOT catalogue keys, and the ["Sun","Mon",…] and
// ["January",…] arrays that used to sit here are gone for the reason
// lib/format/dayNames.js gives at length: CLDR already ships those 19 words in
// every language, and a hand-kept copy also gets the ORDER wrong — "September
// 2026" is "septembre 2026" and "2026年9月". So the columns come from
// weekdayNames() and the header from localeFormat(), both keyed on the rep's
// app language.

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

export default function SalesCalendarPage() {
  const { t, language } = useTranslation();
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

  // Indexed 0 = Sunday, which is the column order monthGrid() lays out.
  const dowLabels = useMemo(() => weekdayNames(language, "short"), [language]);

  // The cursor month's events in time order — the phone's agenda list.
  const monthEvents = useMemo(
    () =>
      events
        .filter((e) => {
          const d = new Date(e.startAt);
          return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();
        })
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt)),
    [events, cursor],
  );

  // One colour rule for the wide grid's chips, the phone grid's dots and the
  // agenda rows, so the three never disagree about what a demo looks like.
  const chipTone = (e) =>
    e.type === "callback"
      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
      : e.type === "demo" || e.type === "walkthrough"
        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
        : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300";
  const dotTone = (e) =>
    e.type === "callback" ? "bg-blue-600" : e.type === "demo" || e.type === "walkthrough" ? "bg-emerald-600" : "bg-amber-500";
  const eventLabel = (e) =>
    `${formatTimeOfDay(e.startAt, language)} ${
      e.type === "demo" ? `${t("app.salesCal.demo")} · ` : e.type === "walkthrough" ? `${t("app.salesCal.walkthrough")} · ` : ""
    }${e.businessName || e.title || t(e.type === "callback" ? "app.salesCal.callBack" : "app.salesCal.appointment")}`;

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
    <div className="py-4" data-tour="sales-calendar">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.salesCal.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("app.salesCal.subtitle")}</p>
        </div>
        <button
          onClick={() => openNew(new Date())}
          className="inline-flex items-center gap-1.5 min-h-[44px] rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 shrink-0"
        >
          <Plus size={16} /> {t("app.salesCal.newEvent")}
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-border" aria-label={t("app.salesCal.previousMonth")}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCursor(new Date())} className="min-h-[44px] px-3 py-2 rounded-lg border border-border text-sm font-medium">
            {t("app.salesCal.today")}
          </button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-border" aria-label={t("app.salesCal.nextMonth")}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="font-semibold text-foreground">
          {localeFormat(cursor, language, { month: "long", year: "numeric" })}
          {loading && <Loader2 size={14} className="inline ml-2 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}{" "}
          <button onClick={load} className="underline font-medium py-2 min-h-[44px]">{t("app.salesCal.tryAgain")}</button>
        </div>
      ) : (
        <>
          {/* ── The month, from md up ───────────────────────────────────
              Seven 92px columns need 640px; below md that grid sat in a
              scroller and a phone saw Sunday to Wednesday with Thursday
              onwards off the edge (docs/screens/sales-mobile/before/
              calendar-375.png). So the wide grid is md-and-up only. */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 gap-px mb-px">
                {dowLabels.map((name, index) => (
                  // Keyed by column index, not by the name: CLDR gives some
                  // languages two identical short weekday names, and a duplicate
                  // React key drops a column.
                  <div key={index} className="text-center text-xs font-medium text-muted-foreground py-1">{name}</div>
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
                            className={`flex items-center gap-1 rounded px-1 py-0.5 text-[11px] leading-tight truncate ${chipTone(e)} ${e.status === "done" ? "line-through opacity-60" : ""}`}
                          >
                            {e.type === "callback" ? <Phone size={10} className="shrink-0" /> : <CalendarClock size={10} className="shrink-0" />}
                            {/* The kind is said on the chip for a demo and a
                                walkthrough — "Demo · Acme" — because the rep's
                                day has three kinds of meeting on it now and
                                the colour alone does not say which. */}
                            <span className="truncate">{eventLabel(e)}</span>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[11px] text-muted-foreground pl-1">{t("app.salesCal.moreEvents", { count: dayEvents.length - 3 })}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── The month on a phone: the whole week, then the agenda ─────
              Seven narrow columns that fit 375px, each day a 44px target
              carrying a dot per event (up to three, in the chip's colour),
              and under it every event of the month in order, each a row
              that opens the same modal the chips do. Nothing the wide grid
              can do is lost: a day still opens "new event" on that day, an
              event still opens itself — the words just moved under the
              grid, where a phone has room for them. */}
          <div className="md:hidden">
            <div className="grid grid-cols-7 gap-px mb-px">
              {dowLabels.map((name, index) => (
                <div key={index} className="text-center text-[11px] font-medium text-muted-foreground py-1 truncate">{name}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden" data-calendar-compact>
              {grid.map((day) => {
                const inMonth = day.getMonth() === cursor.getMonth();
                const isToday = sameDay(day, today);
                const dayEvents = byDay.get(ymd(day)) || [];
                return (
                  <button
                    key={ymd(day)}
                    onClick={() => openNew(day)}
                    aria-label={`${localeFormat(day, language, { weekday: "long", day: "numeric", month: "long" })}${dayEvents.length ? ` · ${dayEvents.length}` : ""}`}
                    className={`min-h-[52px] flex flex-col items-center justify-start gap-1 pt-1.5 pb-1 ${inMonth ? "bg-card" : "bg-muted/40"} active:bg-accent/50`}
                  >
                    <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? "bg-blue-600 text-white" : inMonth ? "text-foreground" : "text-muted-foreground"}`}>
                      {day.getDate()}
                    </span>
                    {dayEvents.length > 0 ? (
                      <span className="flex items-center gap-0.5" aria-hidden="true">
                        {dayEvents.slice(0, 3).map((e) => (
                          <span key={e.id} className={`block w-1.5 h-1.5 rounded-full ${dotTone(e)}`} />
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {monthEvents.length > 0 ? (
              <ul className="mt-4 divide-y divide-border rounded-lg border border-border overflow-hidden bg-card" data-calendar-agenda>
                {monthEvents.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setModal({ initial: e })}
                      className="w-full min-h-[44px] flex items-start gap-3 px-3 py-2.5 text-left active:bg-accent/50"
                    >
                      <span className="w-12 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums pt-0.5">
                        {localeFormat(new Date(e.startAt), language, { day: "numeric", month: "short" })}
                      </span>
                      <span className={`min-w-0 flex-1 flex items-start gap-1.5 rounded px-1.5 py-1 text-xs leading-snug break-words ${chipTone(e)} ${e.status === "done" ? "line-through opacity-60" : ""}`}>
                        {e.type === "callback" ? <Phone size={12} className="shrink-0 mt-0.5" /> : <CalendarClock size={12} className="shrink-0 mt-0.5" />}
                        <span className="min-w-0">{eventLabel(e)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
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
