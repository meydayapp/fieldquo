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
import {
  Clock,
  MapPin,
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(d) {
  // Local date, not toISOString() — that converts to UTC first, so anyone
  // west of Greenwich gets yesterday's date after 5pm.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeek(d) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
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
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [slots, setSlots] = useState({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [chosen, setChosen] = useState(null);

  const [form, setForm] = useState({ name: "", email: "", phone: "" });
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

  const loadSlots = useCallback(async () => {
    if (!eventType) return;
    setSlotsLoading(true);
    try {
      const from = isoDate(weekStart);
      const to = isoDate(new Date(weekStart.getTime() + 6 * DAY_MS));
      const res = await fetch(
        `/api/booking/${companySlug}/availability?eventTypeSlug=${encodeURIComponent(
          eventType.slug,
        )}&from=${from}&to=${to}`,
      );
      const data = await res.json().catch(() => null);
      setSlots(res.ok ? data?.slots || {} : {});
    } catch {
      setSlots({});
    } finally {
      setSlotsLoading(false);
    }
  }, [companySlug, eventType, weekStart]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart.getTime() + i * DAY_MS);
      return {
        date,
        key: isoDate(date),
        past: date < today,
        times: slots[isoDate(date)] || [],
      };
    });
  }, [weekStart, slots]);

  const atCurrentWeek =
    weekStart.getTime() <= startOfWeek(new Date()).getTime();

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

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() =>
                  setWeekStart(new Date(weekStart.getTime() - 7 * DAY_MS))
                }
                disabled={atCurrentWeek}
                className="p-1.5 rounded-lg border border-black/10 disabled:opacity-30"
                aria-label="Previous week"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() =>
                  setWeekStart(new Date(weekStart.getTime() + 7 * DAY_MS))
                }
                className="p-1.5 rounded-lg border border-black/10"
                aria-label="Next week"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {slotsLoading ? (
            <div className="flex items-center gap-2 text-sm text-[#2d2520]/50 py-8 justify-center">
              <Loader2 size={15} className="animate-spin" /> Finding times…
            </div>
          ) : days.every((d) => d.times.length === 0) ? (
            <div className="text-center py-8">
              <p className="text-sm text-[#2d2520]/60">
                Nothing free this week.
              </p>
              <button
                onClick={() =>
                  setWeekStart(new Date(weekStart.getTime() + 7 * DAY_MS))
                }
                className="mt-2 text-sm font-semibold underline text-[#2d2520]"
              >
                Try next week
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {days
                .filter((d) => !d.past && d.times.length > 0)
                .map((d) => (
                  <div key={d.key}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#2d2520]/40 mb-2">
                      {d.date.toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {d.times.map((t) => (
                        <button
                          key={t}
                          onClick={() => setChosen(t)}
                          className="px-3 py-2 rounded-lg border border-black/15 bg-white text-sm font-medium text-[#2d2520] hover:border-black/40"
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
            className="mt-5 w-full inline-flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold text-[#2d2520] disabled:opacity-50"
            style={{ backgroundColor: accent }}
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
          <Building2 size={16} className="text-[#2d2520]" />
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
