// lib/sales/calendar/event.js
//
// Pure shaping and validation for a rep's calendar events — no database, so it
// runs under a check script against hostile input without a loader.

// "demo" and "walkthrough" joined on 2026-09-11 with the three next steps
// (lib/sales/nextSteps.js): a thirty-minute demo with the rep, and a one-hour
// walkthrough with a specialist that is ALSO a DemoBooking on the staff
// calendar. Both are spans, so the route fills endAt from NEXT_STEP_MINUTES
// when the browser sent none.
export const EVENT_TYPES = ["callback", "appointment", "demo", "walkthrough"];
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
  if (Number.isNaN(d.getTime())) return null;
  // A calendar for calls this year and next, not for year 0 (Postgres has
  // none — the write was a bare 500) or +275760 (JavaScript's last date —
  // the write "succeeded" and the row never appeared on any calendar).
  // Outside the range the caller answers "that time isn't valid", which is
  // true, rather than the database answering for it.
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) return null;
  return d;
}

/** Trim to null, and cap length so a pasted essay can't bloat a row. */
export function clean(value, max = 2000) {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/**
 * The four contact fields of an event, from what the rep TYPED and what the
 * linked lead's snapshot says.
 *
 * Typed wins; the snapshot fills the blanks. The first version had it the
 * other way round — `snapshot?.phone ?? typed` — which meant the modal's
 * prefill (itself copied from the lead) could never be corrected: a rep who
 * fixed a wrong number and saved got the wrong number back, silently, on
 * every save, because the modal resends the same leadId each time. A
 * control that appears to work and doesn't, on the screen a rep uses to
 * remember who to ring. `website` could never be stored at all on a linked
 * event, since the snapshot's null won over the typed value.
 */
export function contactFields(body = {}, snapshot = null) {
  const pick = (key, max) => clean(body?.[key], max) ?? (snapshot ? snapshot[key] ?? null : null);
  return {
    businessName: pick("businessName", 200),
    contactName: pick("contactName", 200),
    phone: pick("phone", 60),
    website: pick("website", 300),
  };
}

/**
 * Whether a PATCH that names a lead is RE-LINKING (snapshot again, from the
 * new lead) or merely resending the lead it already had (leave the rep's
 * edits alone). The modal always sends leadId, so "present in the body" is
 * not a change; "different from what is stored" is.
 */
export function leadChanged(bodyLeadId, existingLeadId) {
  if (bodyLeadId === undefined) return false;
  const next = bodyLeadId === "" ? null : bodyLeadId;
  return next !== (existingLeadId ?? null);
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
