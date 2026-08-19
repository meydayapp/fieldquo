// app/components/public/SlotCalendar.js
//
// Pick a day, then a time. The month grid a homeowner uses to choose when
// someone comes round.
//
// ── Why this file exists ───────────────────────────────────────────────────
//
// This markup was written for the booking flow (app/book/[companySlug]/
// BookingFlow.js, steps 2 and 3) and every decision baked into it was paid for
// there: a month at a time rather than a week, because the grid has to know
// which DAYS are open before you can pick one; a dot rather than a count,
// because "14 times" is unreadable at 40px; h-10 rather than aspect-square,
// because a square cell is 38px on a 375px phone and a thumb needs 40;
// unavailable days at full muted contrast rather than faded, because what marks
// a day bookable is the chip, not a number you have to squint at.
//
// The visit-management page (/visit/[token]) needs exactly that control to
// reschedule. Writing a second calendar would mean two grids that drift, and
// the second one is always the one nobody looks at — so it lives here instead,
// as a component that owns its own month/day state and asks its caller for
// slots.
//
// BookingFlow still has the original copy inline. It could not be pointed at
// this file without editing it, and that file was being worked on in parallel;
// pointing it here is a follow-up, and until it happens the two must be changed
// together. That is the only reason there are two.
//
// ── Colours ────────────────────────────────────────────────────────────────
//
// Everything measurable arrives from the caller as `theme` (documentTheme),
// `solid` (fillPair) and `wash`, so a pale-yellow brand can't produce an
// invisible selected day. Nothing here reads a raw brand hex.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from "lucide-react";

/** Local date, not toISOString() — that converts to UTC first, so anyone west
 *  of Greenwich gets yesterday's date after 5pm. */
export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * @param theme     documentTheme(company)
 * @param solid     fillPair(theme) — the selected day and its text
 * @param wash      { bg, ink, muted } — the times panel and bookable days
 * @param copy      the caller's language pack; see clientDocCopy().visit
 * @param locale    BCP-47 tag for month names and times (documentFormatters)
 * @param timeZone  IANA zone the times should be READ in — the company's, so a
 *                  client travelling doesn't book 3am their time by accident.
 *                  Undefined falls back to the device, which is what the
 *                  booking flow has always done.
 * @param loadSlots async (fromISODate, toISODate) => { "YYYY-MM-DD": [iso, …] }
 *                  Throwing surfaces the message; it is never swallowed.
 * @param onPick    (iso) => void, called when a time is tapped
 * @param selected  the currently picked iso, so the caller can control it
 */
export default function SlotCalendar({
  theme,
  solid,
  wash,
  copy,
  locale,
  timeZone,
  loadSlots,
  onPick,
  selected = null,
}) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), 1));
  });
  const [chosenDay, setChosenDay] = useState(null);
  const [slots, setSlots] = useState({});
  const [loading, setLoading] = useState(true);
  // A load that failed must not look like a month with nothing free. One is
  // "try another month", the other is "the page is broken" — and the second
  // needs to say so rather than quietly render an empty grid.
  const [error, setError] = useState("");

  const fetchMonth = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const first = new Date(
        Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth(), 1),
      );
      const last = new Date(
        Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth() + 1, 0),
      );
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      // Never ask for the past — it can only return nothing.
      const from = isoDate(first < today ? today : first);
      const to = isoDate(last);
      const got = await loadSlots(from, to);
      setSlots(got || {});
    } catch (err) {
      setSlots({});
      // A sentence, not the status line. "Request failed (405)" is accurate and
      // useless to a homeowner in a driveway; the real thing goes to the
      // console, where the person who can fix it will look.
      console.error("[visit] couldn't load times:", err?.message);
      setError(copy.timesFailed);
    } finally {
      setLoading(false);
    }
  }, [monthCursor, loadSlots, copy]);

  useEffect(() => {
    fetchMonth();
  }, [fetchMonth]);

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
      cells.push({
        date,
        key,
        day: d,
        past: date < today,
        count: (slots[key] || []).length,
      });
    }
    return cells;
  }, [monthCursor, slots]);

  // Even one day can be ~36 slots at 15-minute increments; Morning / Afternoon
  // / Evening makes that scannable instead of a wall. Empty groups are dropped
  // rather than shown as headings over nothing.
  const dayTimes = useMemo(() => {
    if (!chosenDay) return [];
    const groups = [
      { label: copy.morning, until: 12, times: [] },
      { label: copy.afternoon, until: 17, times: [] },
      { label: copy.evening, until: 24, times: [] },
    ];
    for (const iso of slots[chosenDay] || []) {
      // Grouped by the hour in the COMPANY's zone when one was given, so a
      // slot the contractor calls "morning" isn't filed under Evening for a
      // client reading it from another timezone.
      const h = hourIn(iso, timeZone);
      (groups.find((g) => h < g.until) || groups[2]).times.push(iso);
    }
    return groups.filter((g) => g.times.length);
  }, [chosenDay, slots, copy, timeZone]);

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

  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone && { timeZone }),
  });

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 text-sm py-10 justify-center"
        style={{ color: theme.inkMuted }}
      >
        <Loader2 size={15} className="animate-spin" /> {copy.findingTimes}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div
          className="rounded-lg px-3 py-2 mb-3 flex items-start gap-2 text-sm border"
          style={{
            color: theme.negative,
            borderColor: theme.negative,
            backgroundColor: theme.paper,
          }}
        >
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Two columns only from md up. At sm the card is still narrower than
          calendar + times side by side, which is how the day cells ended up
          17px wide the first time. */}
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] md:gap-6 md:items-start">
        <div className="mx-auto w-full max-w-sm md:max-w-none">
          <div className="flex items-center justify-between gap-2 mb-2">
            <NavButton
              onClick={() => shiftMonth(-1)}
              disabled={atCurrentMonth}
              label={copy.prevMonth}
              theme={theme}
            >
              <ChevronLeft size={18} />
            </NavButton>
            <span
              className="text-sm font-semibold tabular-nums"
              style={{ color: theme.ink }}
            >
              {monthCursor.toLocaleDateString(locale, {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </span>
            <NavButton onClick={() => shiftMonth(1)} label={copy.nextMonth} theme={theme}>
              <ChevronRight size={18} />
            </NavButton>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekdayInitials(locale).map((d, i) => (
              <div
                key={i}
                className="text-center text-[11px] font-bold uppercase py-1"
                style={{ color: theme.inkMuted }}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((cell, i) => {
              if (!cell) return <div key={i} />;
              const free = !cell.past && cell.count > 0;
              const isChosen = chosenDay === cell.key;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => free && setChosenDay(cell.key)}
                  disabled={!free}
                  aria-label={cell.date.toLocaleDateString(locale, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  className={`relative h-10 sm:h-11 rounded-lg text-sm transition-colors ${
                    free
                      ? "font-semibold border border-[var(--bd)] hover:border-[var(--bd-hover)]"
                      : "font-medium cursor-default"
                  }`}
                  style={
                    isChosen
                      ? {
                          "--bd": solid.bg,
                          "--bd-hover": solid.bg,
                          backgroundColor: solid.bg,
                          color: solid.fg,
                        }
                      : free
                        ? {
                            "--bd": theme.border,
                            "--bd-hover": theme.accentRule,
                            backgroundColor: wash.bg,
                            color: wash.ink,
                          }
                        : { color: theme.inkMuted }
                  }
                >
                  {cell.day}
                  {free && !isChosen && (
                    <span
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ backgroundColor: theme.accentText }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          {!monthHasAny && !error && (
            <div className="text-center py-4">
              <p className="text-sm" style={{ color: theme.inkMuted }}>
                {copy.nothingThisMonth}
              </p>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="mt-1 text-sm font-semibold underline"
                style={{ color: theme.accentText }}
              >
                {copy.tryNextMonth}
              </button>
            </div>
          )}
        </div>

        {/* The panel stays put whether or not a day is chosen, so the column
            doesn't appear and disappear under the visitor's thumb — but it goes
            entirely when the month is empty, because "pick a day" over a grid
            with no pickable days is an instruction that can't be followed. */}
        {monthHasAny && (
          <div
            className="mt-4 md:mt-0 rounded-xl border p-3"
            style={{ borderColor: theme.border, backgroundColor: wash.bg }}
          >
            {!chosenDay ? (
              <p
                className="text-sm py-2 text-center md:text-left"
                style={{ color: wash.muted }}
              >
                {copy.pickADay}
              </p>
            ) : (
              <>
                <div
                  className="text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: wash.ink }}
                >
                  {new Date(`${chosenDay}T12:00:00`).toLocaleDateString(locale, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="space-y-3 md:max-h-[19rem] md:overflow-y-auto md:pr-1">
                  {dayTimes.map((g) => (
                    <div key={g.label}>
                      <div
                        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
                        style={{ color: wash.muted }}
                      >
                        {g.label}
                      </div>
                      <div className="grid grid-cols-3 md:grid-cols-2 gap-1.5">
                        {g.times.map((t) => {
                          const on = selected === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => onPick(t)}
                              aria-pressed={on}
                              className="inline-flex items-center justify-center px-2 min-h-10 rounded-lg border text-sm font-medium tabular-nums transition-colors border-[var(--bd)] hover:border-[var(--bd-hover)]"
                              style={
                                on
                                  ? {
                                      "--bd": solid.bg,
                                      "--bd-hover": solid.bg,
                                      backgroundColor: solid.bg,
                                      color: solid.fg,
                                    }
                                  : {
                                      "--bd": theme.border,
                                      "--bd-hover": theme.accentRule,
                                      backgroundColor: theme.paper,
                                      color: theme.ink,
                                    }
                              }
                            >
                              {timeFmt.format(new Date(t))}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The hour of an ISO instant as read in `zone`. Falls back to the device zone
 *  when the zone is missing or unparseable — a bad IANA string must not throw
 *  in the middle of grouping a day's times. */
function hourIn(iso, zone) {
  const d = new Date(iso);
  if (!zone) return d.getHours();
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: zone,
      }).format(d),
    );
  } catch {
    return d.getHours();
  }
}

/** S M T W T F S, in the reader's language. Built from real dates rather than
 *  a hardcoded English array, which is what the booking flow does and is wrong
 *  the moment the page is rendered in Ukrainian. */
function weekdayInitials(locale) {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
  // 2024-01-07 was a Sunday, which is where the grid starts.
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(Date.UTC(2024, 0, 7 + i))),
  );
}

function NavButton({ children, onClick, disabled, label, theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-10 w-10 grid place-items-center rounded-lg border disabled:opacity-30 transition-colors border-[var(--bd)] hover:border-[var(--bd-hover)]"
      style={{
        "--bd": theme.border,
        "--bd-hover": theme.accentRule,
        color: theme.ink,
        backgroundColor: theme.paper,
      }}
    >
      {children}
    </button>
  );
}
