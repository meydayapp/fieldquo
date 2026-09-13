// lib/hr/log.js
//
// The manager's day book — see ManagerLogEntry in prisma/schema.prisma for
// why it is not JobDailyLog. This file is the validation: a date, a body, a
// closed tag list.
export const LOG_TAGS = Object.freeze(["weather", "incident", "staffing", "client", "equipment", "other"]);
const TAG_SET = new Set(LOG_TAGS);
const BODY_MAX = 5000;

/** YYYY-MM-DD → a UTC-midnight Date for a @db.Date column, or null. */
export function parseDay(raw) {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A Date (or ISO string) as the YYYY-MM-DD the @db.Date column holds. */
export function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function parseLogBody(body, { creating = false } = {}) {
  const out = {};
  if (creating || body?.date !== undefined) {
    const date = parseDay(body?.date);
    if (!date) return { error: "Pick the day this entry is about." };
    out.date = date;
  }
  if (creating || body?.body !== undefined) {
    const text = typeof body?.body === "string" ? body.body.trim().slice(0, BODY_MAX) : "";
    if (!text) return { error: "Write something first." };
    out.body = text;
  }
  if (creating || body?.tags !== undefined) {
    const raw = Array.isArray(body?.tags) ? body.tags : [];
    const tags = [...new Set(raw.filter((t) => typeof t === "string" && TAG_SET.has(t)))];
    if (raw.length !== tags.length && raw.some((t) => typeof t !== "string" || !TAG_SET.has(t))) {
      return { error: `Tags must be some of: ${LOG_TAGS.join(", ")}.` };
    }
    out.tags = tags;
  }
  return { data: out };
}

/** The list filter the page sends: ?day=YYYY-MM-DD&tag=weather, both optional. */
export function parseLogFilter(searchParams) {
  const where = {};
  const day = searchParams?.get?.("day");
  if (day) {
    const d = parseDay(day);
    if (!d) return { error: "That day isn't a date." };
    where.date = d;
  }
  const tag = searchParams?.get?.("tag");
  if (tag) {
    if (!TAG_SET.has(tag)) return { error: "That tag isn't one of the list." };
    where.tags = { has: tag };
  }
  return { where };
}

export const LOG_SELECT = Object.freeze({
  id: true,
  authorMemberId: true,
  authorName: true,
  date: true,
  body: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
});
