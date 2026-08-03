// app/book/[companySlug]/BookingFlow.js
//
// Pick a service → pick a time → leave your details. Three steps in one
// component rather than three routes, because this often runs inside a
// 600px iframe on the company's own site, where a full page navigation
// scrolls the *parent* page and loses the visitor's place.
//
// The single most important thing on this page is that a homeowner who is
// mildly annoyed and holding a phone can finish it. Everything else is
// secondary to that.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { readableForeground } from "@/lib/brand/colour";
import {
  Clock,
  MapPin,
  Phone,
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

function isoDate(d) {
  // Local date, not toISOString() — that converts to UTC first, so anyone
  // west of Greenwich gets yesterday's date after 5pm.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BookingFlow({ companySlug, initialEventSlug }) {
  const [company, setCompany] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [eventType, setEventType] = useState(null);
  // Bookable team members ("pick your estimator"). When present, Step 1 is a
  // people picker; each member's consultation event is what actually gets
  // booked, so selecting one just sets the matching eventType.
  const [members, setMembers] = useState([]);
  const [slots, setSlots] = useState({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  // Which month the calendar is showing, and which day was tapped.
  //
  // Replaces a week-at-a-time list that rendered EVERY slot for EVERY day at
  // once: 8am–5pm at 15-minute increments is ~36 buttons a day, so a week was
  // ~180 buttons on one screen. Nobody scans 180 buttons — they pick a day
  // first, which is what a calendar is for.
  const [monthCursor, setMonthCursor] = useState(() => {
    const n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), 1));
  });
  const [chosenDay, setChosenDay] = useState(null);
  // How the client wants to meet. Only asked when the company offers a choice —
  // a segmented control with one option is a label pretending to be a control.
  const [mode, setMode] = useState(null);
  const [chosen, setChosen] = useState(null);

  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  // ── The visit address ────────────────────────────────────────────────────
  //
  // Two pieces of state, not one. `address` is what they're typing; `geoAddress`
  // is what the slot query has been run against. Refetching on every keystroke
  // would be a geocode per character, so the query only moves when typing stops.
  //
  // `travelInfo` is what came back — whether the filter actually applied. Null
  // means we haven't asked; { applied: false } means we asked and couldn't
  // place the address, which must LOOK different to the visitor from a
  // successful filter, or an unrecognised address silently shows unreachable
  // times.
  const [address, setAddress] = useState("");
  const [geoAddress, setGeoAddress] = useState("");
  const [travelInfo, setTravelInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/booking/${companySlug}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) throw new Error(data?.error || "Booking page not found.");
        setCompany(data);

        // The estimator list. Best-effort — if it fails or is empty, Step 1
        // falls back to the plain service menu below.
        try {
          const mRes = await fetch(`/api/booking/${companySlug}/members`);
          const mData = await mRes.json().catch(() => null);
          if (!cancelled && mRes.ok && Array.isArray(mData?.members)) {
            setMembers(mData.members);
          }
        } catch {
          /* fall back to the service menu */
        }

        // Arrived via /book/<company>/<service> — skip straight to the
        // calendar. Falls through to the menu if the slug doesn't match
        // anything, which is what happens when a service is deactivated after
        // the link was shared.
        const direct =
          initialEventSlug &&
          data.eventTypes?.find((et) => et.slug === initialEventSlug);
        if (direct) {
          setEventType(direct);
        } else if (data.eventTypes?.length === 1) {
          // One service on offer is the common case for a small shop.
          // Skipping a menu with a single item saves everyone a tap.
          setEventType(data.eventTypes[0]);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companySlug, initialEventSlug]);

  useEffect(() => {
    const offered = company?.bookingModes?.length ? company.bookingModes : ["visit"];
    setMode((m) => m || offered[0]);
  }, [company]);

  useEffect(() => {
    const t = setTimeout(() => setGeoAddress(address.trim()), 700);
    return () => clearTimeout(t);
  }, [address]);

  const loadSlots = useCallback(async () => {
    if (!eventType) return;
    setSlotsLoading(true);
    try {
      // A whole month per request, not a week.
      //
      // The calendar needs to know which DAYS have anything free before you pick
      // one, so a week's worth of data can't fill it. One request per month view
      // is also fewer round trips than one per week for the same browsing.
      const first = new Date(Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth(), 1));
      const last = new Date(Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth() + 1, 0));
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      // Never ask for the past — it can only return nothing.
      const from = isoDate(first < today ? today : first);
      const to = isoDate(last);
      // The address is only relevant to an in-person visit. Sending it for a
      // phone consult would filter times by a drive nobody is making.
      const forVisit = mode === "visit" && geoAddress.length > 5;
      const res = await fetch(
        `/api/booking/${companySlug}/availability?eventTypeSlug=${encodeURIComponent(
          eventType.slug,
        )}&from=${from}&to=${to}` +
          (forVisit ? `&address=${encodeURIComponent(geoAddress)}` : ""),
      );
      const data = await res.json().catch(() => null);
      setSlots(res.ok ? data?.slots || {} : {});
      setTravelInfo(res.ok ? data?.travel || null : null);
    } catch {
      setSlots({});
    } finally {
      setSlotsLoading(false);
    }
  }, [companySlug, eventType, monthCursor, mode, geoAddress]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  // The month as a 7-column grid, padded so the 1st lands on the right weekday.
  const monthGrid = useMemo(() => {
    const y = monthCursor.getUTCFullYear();
    const m = monthCursor.getUTCMonth();
    const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const key = isoDate(date);
      const times = slots[key] || [];
      cells.push({ date, key, day: d, past: date < today, count: times.length });
    }
    return cells;
  }, [monthCursor, slots]);

  // Times for the tapped day, split into parts of the day.
  //
  // Even one day can be 36 slots; "Morning / Afternoon / Evening" makes that
  // scannable instead of a wall. Empty groups are dropped rather than shown as
  // headings over nothing.
  const dayTimes = useMemo(() => {
    if (!chosenDay) return [];
    const list = slots[chosenDay] || [];
    const groups = [
      { label: "Morning", until: 12, times: [] },
      { label: "Afternoon", until: 17, times: [] },
      { label: "Evening", until: 24, times: [] },
    ];
    for (const iso of list) {
      const h = new Date(iso).getHours();
      (groups.find((g) => h < g.until) || groups[2]).times.push(iso);
    }
    return groups.filter((g) => g.times.length);
  }, [chosenDay, slots]);

  const monthHasAny = monthGrid.some((c) => c && !c.past && c.count > 0);
  const atCurrentMonth = (() => {
    const n = new Date();
    return (
      monthCursor.getUTCFullYear() === n.getFullYear() &&
      monthCursor.getUTCMonth() === n.getMonth()
    );
  })();
  const shiftMonth = (by) => {
    setChosenDay(null);
    setMonthCursor(
      (c) => new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + by, 1)),
    );
  };

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/booking/${companySlug}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTypeSlug: eventType.slug,
          startTime: chosen,
          clientName: form.name.trim(),
          clientEmail: form.email.trim(),
          clientPhone: form.phone.trim() || null,
          mode,
          address: mode === "visit" ? address.trim() || null : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // 409 means someone took the slot between loading and submitting.
        // Send them back to the grid with fresh times rather than leaving
        // them staring at a form for a time that no longer exists.
        if (res.status === 409) {
          setChosen(null);
          await loadSlots();
        }
        throw new Error(data?.error || "Couldn't book that time.");
      }
      setConfirmed({ startTime: chosen, ...data });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-black/10 rounded w-1/2" />
          <div className="h-40 bg-black/10 rounded-xl" />
        </div>
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell>
        <div className="text-center py-10">
          <p className="font-semibold text-[#2d2520]">{loadError}</p>
          <p className="text-sm text-[#2d2520]/60 mt-1">
            Double-check the link, or get in touch with the company directly.
          </p>
        </div>
      </Shell>
    );
  }

  const accent = company.brandColor || "#06356b";
  // Measured, not assumed white/dark — a dark brand (or the default navy) makes
  // hardcoded dark text on the accent unreadable. This is the "Confirm booking"
  // button and the logo bubble: the two elements that sit ON the accent.
  const accentOn = readableForeground(accent);

  if (confirmed) {
    return (
      <Shell>
        <Header company={company} accent={accent} />
        <div className="text-center py-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: `${accent}33` }}
          >
            <Check size={26} style={{ color: accent }} />
          </div>
          <h2 className="text-lg font-bold text-[#2d2520]">You&apos;re booked</h2>
          <p className="text-sm text-[#2d2520]/70 mt-2">
            {new Date(confirmed.startTime).toLocaleString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <p className="text-sm text-[#2d2520]/60 mt-3">
            A confirmation is on its way to {form.email}. {company.name} will be
            in touch if anything changes.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header company={company} accent={accent} />

      {/* Step 1 — pick your estimator (member-first), or the service menu */}
      {!eventType && (
        <div>
          {members.length > 0 ? (
            <>
              <h2 className="font-semibold text-[#2d2520] mb-3">
                Choose who you&apos;d like to meet
              </h2>
              <div className="space-y-2">
                {members.map((m) => {
                  const et = company.eventTypes?.find((e) => e.slug === m.eventSlug);
                  const initials = m.name
                    .replace(/[^a-zA-Z ]/g, "")
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase())
                    .join("");
                  return (
                    <button
                      key={m.eventSlug}
                      onClick={() => setEventType(et || { slug: m.eventSlug, name: `Consultation with ${m.name}`, durationMinutes: m.durationMinutes })}
                      className="w-full text-left border border-black/10 hover:border-black/25 rounded-xl px-4 py-3 bg-white transition-colors flex items-center gap-3"
                    >
                      <span
                        className="shrink-0 w-11 h-11 rounded-full grid place-items-center text-sm font-bold text-white"
                        style={{ backgroundColor: accent }}
                      >
                        {initials || "★"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-[#2d2520]">{m.name}</span>
                        <span className="block text-xs text-[#2d2520]/55">
                          {m.title}
                          {m.nextSlot
                            ? ` · next ${new Date(m.nextSlot).toLocaleDateString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`
                            : " · limited availability"}
                        </span>
                      </span>
                      <ChevronRight size={16} className="text-[#2d2520]/30 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </>
          ) : company.eventTypes?.length ? (
            <>
              <h2 className="font-semibold text-[#2d2520] mb-3">
                What can we help with?
              </h2>
              <div className="space-y-2">
                {company.eventTypes.map((et) => (
                  <button
                    key={et.id}
                    onClick={() => setEventType(et)}
                    className="w-full text-left border border-black/10 hover:border-black/25 rounded-xl px-4 py-3 bg-white transition-colors"
                  >
                    <div className="font-medium text-[#2d2520]">{et.name}</div>
                    <div className="text-xs text-[#2d2520]/50 mt-1 flex gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} /> {et.durationMinutes} min
                      </span>
                      {et.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} /> {et.location}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-[#2d2520]/60">
              {company.name} hasn&apos;t set up online booking yet.
              {company.phone && ` Give them a call on ${company.phone}.`}
            </p>
          )}
        </div>
      )}

      {/* Step 2 — which time */}
      {eventType && !chosen && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="min-w-0">
              {company.eventTypes?.length > 1 && (
                <button
                  onClick={() => setEventType(null)}
                  className="inline-flex items-center gap-1 text-xs text-[#2d2520]/50 hover:text-[#2d2520]"
                >
                  <ArrowLeft size={11} /> Change service
                </button>
              )}
              <h2 className="font-semibold text-[#2d2520]">{eventType.name}</h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-semibold text-[#2d2520] tabular-nums">
                {monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
              </span>
              <button
                onClick={() => shiftMonth(-1)}
                disabled={atCurrentMonth}
                className="p-1.5 rounded-lg border border-black/10 disabled:opacity-30"
                aria-label="Previous month"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => shiftMonth(1)}
                className="p-1.5 rounded-lg border border-black/10"
                aria-label="Next month"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* ── How would you like to meet? ──────────────────────────────────
              EventType.location was free text ("Phone or on-site visit"), which
              is a label, not a choice: the visitor couldn't say which they
              wanted and the crew found out on the day. A roofer doing a
              satellite estimate wants calls; a cabinet maker measuring a kitchen
              needs to be in the room. Both is common, so the company says which
              it offers and the client picks. */}
          {(company.bookingModes?.length || 0) > 1 && (
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#2d2520]/40 mb-1.5">
                How would you like to meet?
              </div>
              <div className="flex flex-wrap gap-1.5">
                {company.bookingModes.map((m) => {
                  const label =
                    m === "call" ? "Phone call" : m === "video" ? "Video call" : "Visit my place";
                  const Icon = m === "visit" ? MapPin : Phone;
                  return (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        mode === m
                          ? "bg-[#2d2520] text-white border-[#2d2520]"
                          : "bg-white border-black/15 text-[#2d2520] hover:border-black/40"
                      }`}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Where are we coming to? ────────────────────────────────────
              Asked BEFORE the times, not after, because it changes which times
              are real. An estimator finishing across town at 5:00 cannot be at
              a door at 5:30, and offering that slot is a promise the company
              breaks on the day.

              Optional on purpose. Someone who won't type an address still gets
              the full grid — the times are then merely unfiltered, which is
              exactly what every booking page did before this. Blocking the
              calendar behind a required field would cost more bookings than
              the occasional tight drive does. */}
          {mode === "visit" && (
            <div className="mb-4">
              <label
                htmlFor="visit-address"
                className="block text-xs font-semibold uppercase tracking-wide text-[#2d2520]/40 mb-1.5"
              >
                Where should we come?
              </label>
              <div className="relative">
                <MapPin
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2d2520]/35 pointer-events-none"
                />
                <input
                  id="visit-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, Montreal"
                  autoComplete="street-address"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-black/15 bg-white text-sm text-[#2d2520] placeholder:text-[#2d2520]/30 focus:border-[#2d2520]/50 focus:outline-none"
                />
              </div>

              {/* Three states, and they must not look alike. */}
              <p className="text-xs text-[#2d2520]/50 mt-1.5">
                {travelInfo?.applied
                  ? `Showing times we can reach ${travelInfo.address || "you"} on schedule.`
                  : travelInfo
                    ? "We couldn't place that address, so all times are shown. Double-check it before you book."
                    : "Optional — it lets us hide times we couldn't get to you on time."}
              </p>
            </div>
          )}

          {slotsLoading ? (
            <div className="flex items-center gap-2 text-sm text-[#2d2520]/50 py-10 justify-center">
              <Loader2 size={15} className="animate-spin" /> Finding times…
            </div>
          ) : (
            <div className="sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] sm:gap-6">
              {/* ── Pick a day ── */}
              <div>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-bold uppercase text-[#2d2520]/35 py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthGrid.map((cell, i) => {
                    if (!cell) return <div key={i} />;
                    const free = !cell.past && cell.count > 0;
                    const selected = chosenDay === cell.key;
                    return (
                      <button
                        key={cell.key}
                        onClick={() => free && setChosenDay(cell.key)}
                        disabled={!free}
                        aria-label={`${cell.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${free ? `, ${cell.count} times available` : ", nothing available"}`}
                        className={`relative aspect-square rounded-lg text-sm font-medium transition-colors ${
                          selected
                            ? "bg-[#2d2520] text-white"
                            : free
                              ? "bg-white border border-black/10 text-[#2d2520] hover:border-black/40"
                              : "text-[#2d2520]/25 cursor-default"
                        }`}
                      >
                        {cell.day}
                        {/* A dot, not a count. "14 times" is noise at this size;
                            what a visitor needs to know is "this day is open". */}
                        {free && !selected && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2d2520]/40" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {!monthHasAny && (
                  <div className="text-center py-4">
                    <p className="text-sm text-[#2d2520]/60">Nothing free this month.</p>
                    <button
                      onClick={() => shiftMonth(1)}
                      className="mt-1 text-sm font-semibold underline text-[#2d2520]"
                    >
                      Try next month
                    </button>
                  </div>
                )}
              </div>

              {/* ── Then a time, grouped ── */}
              <div className="mt-5 sm:mt-0">
                {!chosenDay ? (
                  <p className="text-sm text-[#2d2520]/50 sm:pt-8">
                    Pick a day to see the times.
                  </p>
                ) : (
                  <>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#2d2520]/40 mb-2">
                      {new Date(`${chosenDay}T12:00:00`).toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    {/* Capped height with its own scroll: a full day is still ~36
                        times, and letting that push the calendar off the screen is
                        the problem this rebuild exists to fix. */}
                    <div className="space-y-3 sm:max-h-[19rem] sm:overflow-y-auto sm:pr-1">
                      {dayTimes.map((g) => (
                        <div key={g.label}>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#2d2520]/35 mb-1.5">
                            {g.label}
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-2 gap-1.5">
                            {g.times.map((t) => (
                              <button
                                key={t}
                                onClick={() => setChosen(t)}
                                className="px-2 py-2 rounded-lg border border-black/15 bg-white text-sm font-medium text-[#2d2520] hover:border-black/40 tabular-nums"
                              >
                                {new Date(t).toLocaleTimeString(undefined, {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — who are you */}
      {eventType && chosen && (
        <form onSubmit={submit}>
          <button
            type="button"
            onClick={() => setChosen(null)}
            className="inline-flex items-center gap-1 text-xs text-[#2d2520]/50 hover:text-[#2d2520] mb-2"
          >
            <ArrowLeft size={11} /> Pick another time
          </button>

          <h2 className="font-semibold text-[#2d2520]">
            {new Date(chosen).toLocaleString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </h2>
          <p className="text-xs text-[#2d2520]/50 mb-4">
            {eventType.name} · {eventType.durationMinutes} min
          </p>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {submitError}
            </div>
          )}

          <div className="space-y-3">
            <Input
              label="Your name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
              autoFocus
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              required
              hint="We'll send your confirmation here."
            />
            <Input
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              hint="Optional, but it helps if we're running late."
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !form.name.trim() || !form.email.trim()}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: accent, color: accentOn }}
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Confirm booking
          </button>
        </form>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  // No min-h-screen: inside a 600px iframe that would force a scrollbar on
  // content that fits.
  return (
    <div className="bg-[#f5f2ec] p-4 sm:p-6">
      <div className="max-w-md mx-auto bg-white/60 rounded-2xl p-5 border border-black/5">
        {children}
      </div>
    </div>
  );
}

function Header({ company, accent }) {
  return (
    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-black/5">
      {company.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={company.logoUrl}
          alt={company.name}
          className="h-9 w-auto object-contain"
        />
      ) : (
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: accent }}
        >
          <Building2 size={16} style={{ color: readableForeground(accent) }} />
        </div>
      )}
      <div className="min-w-0">
        <div className="font-bold text-[#2d2520] truncate">{company.name}</div>
        <div className="text-xs text-[#2d2520]/50">Book an appointment</div>
      </div>
    </div>
  );
}

function Input({ label, hint, value, onChange, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#2d2520] mb-1">
        {label}
      </label>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-black/40"
      />
      {hint && <p className="text-xs text-[#2d2520]/40 mt-1">{hint}</p>}
    </div>
  );
}
