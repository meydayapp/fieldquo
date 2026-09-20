// lib/calendar/googleEvent.js
//
// A calendar entry → the Google event FieldQuo writes for it. Pure, so the
// check can run it against every entry shape the schedule feed emits and
// diff the hash of an unchanged one.
//
// ── The one property that makes the whole thing safe ─────────────────────
//
// Every event FieldQuo creates carries extendedProperties.private.fieldquoId.
// The sync deletes an event ONLY when the mirror row names it AND the event
// it reads back carries that id; the reconcile lists events by the same
// private property and touches nothing else. A member's own dentist
// appointment has no such property and is invisible to every write path.
import { createHash } from "node:crypto";
import { DEFAULT_STOP_MINUTES } from "@/lib/schedule/moveEntry";

export const FIELDQUO_ID_KEY = "fieldquoId";
export const FIELDQUO_APP_KEY = "fieldquoApp";
export const FIELDQUO_APP_VALUE = "fieldquo";

/** "appointment:cku…" — the value under the private property. */
export function entityKey(kind, id) {
  return `${kind}:${id}`;
}

export function parseEntityKey(value) {
  const m = /^(appointment|visit|booking):(.+)$/.exec(String(value || ""));
  return m ? { kind: m[1], id: m[2] } : null;
}

/** Does this Google event carry FieldQuo's mark for THIS entity? */
export function isFieldquoEvent(event, kind, id) {
  const priv = event?.extendedProperties?.private;
  return Boolean(priv && priv[FIELDQUO_ID_KEY] === entityKey(kind, id));
}

/**
 * Is the entry one a calendar should still show? Cancelled is off (the
 * time is free again); a pending_payment hold was never booked. Completed
 * STAYS — a visit that happened is history the member is entitled to keep
 * on their own calendar, the same way the FieldQuo calendar keeps it.
 */
export function entryIsLive(entry) {
  const s = String(entry?.status || "").toLowerCase();
  return !["cancelled", "canceled", "pending_payment"].includes(s);
}

function ymd(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * Where the event links back to. A visit opens its job; an appointment or a
 * booking opens the calendar on its day — the page reads `?day=`.
 */
export function entryLink(entry, origin) {
  const base = String(origin || "").replace(/\/+$/, "");
  if (entry.kind === "visit" && entry.jobId) return `${base}/app/jobs/${entry.jobId}`;
  return `${base}/app/appointments?day=${ymd(entry.scheduledAt)}`;
}

/**
 * @param entry   a feed entry (lib/schedule/feed.js shape — kind, id,
 *                scheduledAt, status, client, location, title, booking, jobId)
 * @param labels  { visit, call, video, appointment, jobVisit, managedBy } in
 *                the member's language — resolved by the sync, never here,
 *                so this stays pure
 * @returns the Google event body, or null when the entry cannot be placed
 *          (no valid start).
 */
export function buildEventPayload(entry, { origin, labels }) {
  if (!entry?.id || !entry?.kind) return null;
  const start = new Date(entry.scheduledAt);
  if (Number.isNaN(start.getTime())) return null;
  const bookedEnd = entry.booking?.endTime ? new Date(entry.booking.endTime) : null;
  const end =
    bookedEnd && !Number.isNaN(bookedEnd.getTime()) && bookedEnd > start
      ? bookedEnd
      : new Date(start.getTime() + DEFAULT_STOP_MINUTES * 60000);

  const clientName = entry.client?.name ? String(entry.client.name).trim() : "";
  const mode = entry.booking?.mode || null;
  const L = labels || {};
  let head;
  if (entry.kind === "visit") head = entry.title ? String(entry.title) : L.jobVisit || "Job visit";
  else if (mode === "call") head = L.call || "Callback";
  else if (mode === "video") head = L.video || "Video call";
  else if (mode === "visit") head = L.visit || "Site visit";
  else head = L.appointment || "Appointment";
  const summary = clientName ? `${head} — ${clientName}` : head;

  // Where the van goes. A callback has no address by design, and an invented
  // one on a calendar somebody navigates from is worse than none.
  const location = mode === "call" || mode === "video" ? "" : String(entry.location || entry.client?.address || "").trim();

  const link = entryLink(entry, origin);
  const description = [link, L.managedBy || "Managed in FieldQuo — change it there, not here."].join("\n");

  return {
    summary: summary.slice(0, 250),
    location: location.slice(0, 500),
    description,
    start: { dateTime: start.toISOString(), timeZone: "UTC" },
    end: { dateTime: end.toISOString(), timeZone: "UTC" },
    source: { title: "FieldQuo", url: link },
    reminders: { useDefault: true },
    extendedProperties: {
      private: {
        [FIELDQUO_ID_KEY]: entityKey(entry.kind, entry.id),
        [FIELDQUO_APP_KEY]: FIELDQUO_APP_VALUE,
      },
    },
  };
}

/** Key-sorted at every depth. A JSON.stringify replacer ARRAY would filter
 *  nested keys by the top-level list, which silently drops start.dateTime. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Should this entry carry a Google Meet link? Only a VIDEO-mode booking, and
 * only when the row does not already hold one — a second createRequest on
 * an event that has a link would mint a second room and orphan the first
 * one the client was sent.
 */
export function wantsMeetLink(entry) {
  return entry?.booking?.mode === "video" && !entry?.meetUrl;
}

/**
 * The event body with a Meet room requested. Applied at INSERT time only and
 * never part of the hashed payload: the requestId is random by contract, and
 * a PATCH that re-sent a createRequest would replace the room.
 */
export function withMeetRequest(payload, requestId) {
  return {
    ...payload,
    conferenceData: {
      createRequest: {
        requestId: String(requestId || "").slice(0, 64) || "fieldquo",
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
}

/**
 * The Meet URL off an event Google handed back, or null. `hangoutLink` is
 * the flat field; the entryPoints list is where Workspace accounts put it
 * when the flat one is absent. A `conferenceData.status.statusCode` of
 * "failure" (a Workspace policy refusing Meet) leaves both empty and
 * answers null — the event still exists, only the link does not.
 */
export function meetLinkFrom(event) {
  if (!event || typeof event !== "object") return null;
  if (typeof event.hangoutLink === "string" && /^https:\/\//.test(event.hangoutLink)) return event.hangoutLink;
  const points = event.conferenceData?.entryPoints;
  if (Array.isArray(points)) {
    const video = points.find((p) => p?.entryPointType === "video" && typeof p.uri === "string" && /^https:\/\//.test(p.uri));
    if (video) return video.uri;
  }
  return null;
}

/** What "unchanged" means: the same hash means no round trip to Google. */
export function payloadHash(payload) {
  return createHash("sha256").update(stable(payload)).digest("hex").slice(0, 32);
}
