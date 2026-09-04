// lib/company/businessHours.js
//
// When the business is open.
//
// ── Why this is not AvailabilitySchedule ────────────────────────────────────
//
// FieldQuo already stores availability, but it hangs off a USER and answers a
// different question: "when can this person be booked". Business hours answer
// "when is the company open". They diverge constantly — Dave takes Friday off
// and the office is still open; the shop closes at noon Saturday and nobody has
// bookable slots then anyway.
//
// Deriving one from the other produces a website that says CLOSED because one
// estimator went on holiday. So these are stored separately, on the Company,
// and the two are allowed to disagree.
//
// ── The actual payoff is not the website ────────────────────────────────────
//
// These feed `openingHoursSpecification` in the LocalBusiness JSON-LD, which
// is what puts "Open ⋅ Closes 5 PM" in a Google result. That box is seen by
// people who never load the site. For a contractor who will never think about
// SEO, it is most of the value of the feature.
//
// ── Times are strings, not Dates ────────────────────────────────────────────
//
// "08:00" is a wall-clock time, not an instant. A Date would silently acquire
// a date and an offset, and the first daylight-saving change would shift every
// company's opening time by an hour. A string in a fixed timezone is the whole
// model, and it's correct all year.

/** Day index → English name. 0 = Sunday, matching Company.weekStartsOn. */
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DAY_LABELS = DAY_NAMES;
export const DAY_SHORT = SHORT_NAMES;

/**
 * Weekday names in a reader's language, indexed the same way (0 = Sunday).
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * The two English tables above are correct for what they were written for: the
 * schema.org `dayOfWeek` IRI, which is `https://schema.org/Monday` in every
 * language on earth, and the back-office editor, which is English. They were
 * also the only source of a day name, so the tenant WEBSITE — translated down
 * to its eyebrows — put "Fermé · ouvre Friday 8:00 a.m." in the header of a
 * French page and "Mon – Fri" in its opening-hours table.
 *
 * Intl rather than eight more hand-written tables: a weekday name is not
 * product copy, every runtime already ships CLDR's, and a table would be seven
 * more strings to forget the next time a language is added.
 *
 * 2000-01-02 was a Sunday, so index i is that date plus i days. Formatted in
 * UTC for the same reason formatTime is — these are labels, not instants.
 */
export function dayNames(locale = "en-CA", { short = false } = {}) {
  try {
    const fmt = new Intl.DateTimeFormat(locale, {
      weekday: short ? "short" : "long",
      timeZone: "UTC",
    });
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(Date.UTC(2000, 0, 2 + i))),
    );
  } catch {
    // An unknown locale must not blank a public page over a weekday label.
    return short ? SHORT_NAMES : DAY_NAMES;
  }
}

/**
 * What a trade business looks like before anyone edits it.
 *
 * A real default rather than seven blank rows: a form that opens already
 * correct for most people gets finished, and one that opens empty gets
 * abandoned with hours half-entered — which is worse than none, because a
 * website confidently listing three days is a website that says you're shut on
 * the other four.
 */
export const DEFAULT_HOURS = [
  { day: 0, closed: true, open: "09:00", close: "17:00" },
  { day: 1, closed: false, open: "08:00", close: "17:00" },
  { day: 2, closed: false, open: "08:00", close: "17:00" },
  { day: 3, closed: false, open: "08:00", close: "17:00" },
  { day: 4, closed: false, open: "08:00", close: "17:00" },
  { day: 5, closed: false, open: "08:00", close: "16:00" },
  { day: 6, closed: true, open: "09:00", close: "13:00" },
];

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * "8:5" → "08:05". Anything that isn't a real wall-clock time → the fallback.
 *
 * Zero-padding is fixed; out-of-range values are NOT clamped. "99:99" could be
 * turned into "23:59", and an earlier version did — but a clamped value is a
 * plausible-looking wrong answer that gets published to a search engine,
 * whereas the fallback is at least the company's own default. Garbage in
 * should not become confident garbage out.
 */
function cleanTime(value, fallback) {
  const raw = String(value ?? "").trim();
  const loose = /^(\d{1,2}):(\d{1,2})$/.exec(raw);
  if (loose) {
    const h = Number(loose[1]);
    const m = Number(loose[2]);
    if (h <= 23 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  return TIME_RE.test(raw) ? raw : fallback;
}

const minutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Always returns exactly seven entries, in day order, with valid times.
 *
 * This is the boundary between "whatever was in the Json column or the request
 * body" and the rest of the module. Everything downstream — the renderer, the
 * JSON-LD, openState — may assume seven well-formed rows, which is why none of
 * them contain a length check.
 *
 * ── A missing day is CLOSED, not the default ────────────────────────────────
 *
 * This originally filled gaps from DEFAULT_HOURS, which meant a company that
 * saved only "Sunday: closed" got Monday to Friday 8–5 invented for them — and
 * published, and fed to Google as structured data. Absence of a statement is
 * not a statement. DEFAULT_HOURS is now only a source of fallback TIMES (what
 * to show when a day is ticked open) and a starting point the editor offers
 * explicitly, never a value that arrives by omission.
 */
export function normaliseHours(value) {
  const byDay = new Map();
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const day = Number(entry.day);
      if (!Number.isInteger(day) || day < 0 || day > 6) continue;
      byDay.set(day, entry);
    }
  }

  return DEFAULT_HOURS.map((fallback) => {
    const entry = byDay.get(fallback.day);
    if (!entry) return { ...fallback, closed: true };

    const open = cleanTime(entry.open, fallback.open);
    let close = cleanTime(entry.close, fallback.close);

    // A close at or before the open is either a typo or an overnight shift.
    // Contractors are not open overnight, so it's a typo — and storing it
    // would produce a Google listing that says "Closes 8 AM". Treat the day as
    // closed rather than guessing which of the two numbers was wrong.
    const invalid = minutes(close) <= minutes(open);

    return {
      day: fallback.day,
      closed: Boolean(entry.closed) || invalid,
      open,
      close,
    };
  });
}

/** True when at least one day is open. Seven closed days is the same as none. */
export function hasBusinessHours(value) {
  if (!Array.isArray(value) || value.length === 0) return false;
  return normaliseHours(value).some((d) => !d.closed);
}

/**
 * Display order, rotated by the company's weekStartsOn.
 *
 * Rotates the VIEW only — every entry keeps its own `day`, so nothing that
 * reads the data downstream has to know a preference was applied. Same
 * approach as orderedWeekdays in lib/format/companyDate.js.
 */
export function orderedHours(hours, weekStartsOn = 0) {
  const start = Number.isInteger(weekStartsOn) ? ((weekStartsOn % 7) + 7) % 7 : 0;
  const list = normaliseHours(hours);
  return Array.from({ length: 7 }, (_, i) => list[(start + i) % 7]);
}

/** "08:00" → "8:00 AM". 12-hour because that's how a homeowner reads a sign. */
export function formatTime(hhmm, locale = "en-CA") {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  // A fixed UTC date carrying the wall-clock time, formatted in UTC. Purely a
  // vehicle for Intl's locale-aware AM/PM placement — no timezone maths here.
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

/**
 * Collapses identical consecutive days into runs.
 *
 * Seven rows saying the same thing is a table nobody reads; "Mon – Fri" is a
 * sign. Runs are computed in DISPLAY order, so a company that starts its week
 * on Monday gets "Mon – Fri" while one starting on Sunday gets the same days
 * grouped the same way — the rotation happens first, deliberately.
 *
 * `locale` names the days as well as the times now — it used to reach only
 * formatTime, so a French site got "Mon – Fri 8:00 a.m. – 5:00 p.m.". Same
 * reason `closedLabel` is a parameter: "Closed" was the one word in the table
 * that no caller could translate. Both default to what this function already
 * did, so the settings editor and the voice prompt are unchanged.
 *
 * @returns [{ label: "Mon – Fri", closed: false, open, close, days: [1..5] }]
 */
export function groupHours(
  hours,
  { weekStartsOn = 0, locale = "en-CA", closedLabel = "Closed" } = {},
) {
  const ordered = orderedHours(hours, weekStartsOn);
  const short = dayNames(locale, { short: true });
  const runs = [];

  for (const entry of ordered) {
    const last = runs[runs.length - 1];
    const same =
      last &&
      last.closed === entry.closed &&
      (entry.closed || (last.open === entry.open && last.close === entry.close));

    if (same) {
      last.days.push(entry.day);
    } else {
      runs.push({
        closed: entry.closed,
        open: entry.open,
        close: entry.close,
        days: [entry.day],
      });
    }
  }

  return runs.map((run) => {
    const first = short[run.days[0]];
    const last = short[run.days[run.days.length - 1]];
    return {
      ...run,
      label:
        run.days.length === 1
          ? first
          : run.days.length === 2
            ? `${first}, ${last}`
            : `${first} – ${last}`,
      hours: run.closed
        ? closedLabel
        : `${formatTime(run.open, locale)} – ${formatTime(run.close, locale)}`,
    };
  });
}

/**
 * schema.org OpeningHoursSpecification.
 *
 * Closed days are OMITTED rather than emitted with equal open and close times.
 * Search engines read an absent day as closed; an entry claiming 00:00–00:00
 * has been read as open twenty-four hours, which is the one wrong answer that
 * actually costs the company a phone call at 3am.
 */
export function openingHoursSpecification(hours) {
  return normaliseHours(hours)
    .filter((d) => !d.closed)
    .map((d) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAY_NAMES[d.day]}`,
      opens: d.open,
      closes: d.close,
    }));
}

/**
 * Whether they're open at this instant, in the company's timezone.
 *
 * @returns {{ open: boolean, opensAt?: string, closesAt?: string,
 *             opensDayIndex?: number }}
 *          `null` when no hours are set — the caller must show nothing rather
 *          than guess, because "Closed" on a business that never entered hours
 *          is a lie the visitor acts on.
 *
 * `opensDayIndex` is a NUMBER, not a name. It used to be `opensDay`, an English
 * name out of DAY_NAMES, and its only consumer is the tenant website's header
 * pill — which is translated, and which therefore read "Fermé · ouvre Friday".
 * A function that knows a day index has no business deciding what language the
 * page is in; the caller does. Null when the next opening is later today, so
 * the pill says "opens 8:00" rather than naming today back at the reader.
 */
export function openState(hours, timezone = "America/Toronto") {
  if (!hasBusinessHours(hours)) return null;

  const list = normaliseHours(hours);

  // The visitor's clock is irrelevant — someone browsing from another province
  // must still see whether the contractor's office is open. Intl does the
  // timezone conversion, including DST, without a date library.
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
  } catch {
    // An invalid timezone string would otherwise throw inside a server
    // component and blank the whole page over a status pill.
    return null;
  }

  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  const dayIndex = SHORT_NAMES.indexOf(get("weekday").slice(0, 3));
  if (dayIndex < 0) return null;

  const now = Number(get("hour")) * 60 + Number(get("minute"));
  const today = list[dayIndex];

  if (!today.closed && now >= minutes(today.open) && now < minutes(today.close)) {
    return { open: true, closesAt: today.close };
  }

  // Not open now — find the next opening, looking at today first in case it
  // hasn't opened yet.
  for (let i = 0; i < 8; i++) {
    const entry = list[(dayIndex + i) % 7];
    if (entry.closed) continue;
    if (i === 0 && now >= minutes(entry.open)) continue;
    return {
      open: false,
      opensAt: entry.open,
      opensDayIndex: i === 0 ? null : entry.day,
    };
  }

  return { open: false };
}
