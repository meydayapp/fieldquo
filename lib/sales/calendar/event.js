// lib/sales/calendar/event.js
//
// Pure shaping and validation for a rep's calendar events — no database, so it
// runs under a check script against hostile input without a loader.

export const EVENT_TYPES = ["callback", "appointment"];
export const EVENT_STATUSES = ["scheduled", "done", "cancelled"];

export const isEventType = (v) => EVENT_TYPES.includes(v);
export const isEventStatus = (v) => EVENT_STATUSES.includes(v);

/**
 * A Date from an ISO string, or null. Never throws, never invents "now" for a
 * bad value — a callback booked for a time nobody chose is worse than a
 * refusal, the same rule dispositions.js applies to a callback with no time.
 */
export function parseWhen(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Trim to null, and cap length so a pasted essay can't bloat a row. */
export function clean(value, max = 2000) {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/**
 * The shape a list/detail response returns — the snapshot fields flattened so
 * the browser never has to reach through a relation it may not have loaded.
 */
export function shapeEvent(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    startAt: row.startAt,
    endAt: row.endAt,
    location: row.location,
    notes: row.notes,
    status: row.status,
    leadId: row.leadId,
    businessName: row.businessName,
    contactName: row.contactName,
    phone: row.phone,
    website: row.website,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
