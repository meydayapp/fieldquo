// lib/schedule/mapStops.js
//
// The day map's rows: calendar entries as numbered, coloured stops.
//
// ── One sequence PER PERSON ────────────────────────────────────────────────
//
// The owner asked for "the 1, 2, 3 sequence so the admin can see all the
// jobs". Numbered across the whole company that is a list of everything
// happening today; numbered per person it is each van's route. The map
// therefore starts every assignee at 1 and counts THEIR stops in time order.
// Two "1"s on the map are two people's first stops, told apart by colour.
// Unassigned stops carry "?" and grey: nobody's route has them yet, and a
// number would claim otherwise.
//
// ── Colour from the member id, distinct on the day ─────────────────────────
//
// A colour hashed from the id is the same on every day and every screen, so
// Marc is always teal. A hash alone cannot promise two people never collide,
// so the day's assignees are resolved as a SET: in sorted-id order, each
// takes the palette slot the hash names or the next free one. Deterministic
// for a given set of people, stable per person unless a collision moved
// them. Twelve slots; a thirteenth person on one day wraps, and the check
// says so rather than pretending the palette is infinite.
//
// Every fill is pre-checked (scripts/check-schedule-map.mjs measures it)
// to carry its label at 4.5:1 or better with either white or dark ink, and
// the ink is chosen by measurement per fill — lib/brand/colour.js's
// readableForeground — never by "is it dark".
//
// ── Rows with no coordinates are rows ──────────────────────────────────────
//
// An appointment whose address did not geocode, a visit on a job with no
// site pair, a callback with no address at all: each is still a stop in the
// list, numbered in its person's sequence, flagged `located: false`. The
// list beside the map says "no location on the map" for it. Dropping it
// would make the map lie about how many places a person is going today.
//
// Pure: no React, no Google, no database. The page and the check both call it.

import { contrastRatio, readableForeground } from "@/lib/brand/colour";
import { aboutLabel, aboutHref } from "@/lib/schedule/appointmentAbout";

/**
 * Twelve fills, each measured to carry white or dark ink at ≥ 4.5:1 (the
 * check asserts this — do not add a mid-tone without measuring it). Ordered
 * so neighbouring slots are far apart in hue, since a hash collision moves a
 * person to the NEXT slot.
 */
export const PIN_PALETTE = [
  "#0f766e", // teal
  "#b45309", // amber
  "#1d4ed8", // blue
  "#be123c", // rose
  "#4d7c0f", // olive
  "#7e22ce", // violet
  "#0e7490", // cyan
  "#c2410c", // orange
  "#4338ca", // indigo
  "#a21caf", // fuchsia
  "#166534", // green
  "#92400e", // brown
];

/** The unassigned pin. Grey with white ink; measured in the check. */
export const UNASSIGNED_FILL = "#5b6472";

/** Dark ink for a light fill — the app's own near-black. */
const DARK_INK = "#0b1a2e";

/** Deterministic 32-bit hash of a string (FNV-1a). */
export function hashId(id) {
  let h = 0x811c9dc5;
  const s = String(id ?? "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The ink that measures best on a fill. */
export function inkFor(fill) {
  return readableForeground(fill, { light: "#ffffff", dark: DARK_INK });
}

/**
 * A colour per id, distinct across the set.
 *
 * @param ids  the people (or work areas) on the map.
 * @returns Map<id, { fill, ink, slot }>
 */
export function assignColours(ids = []) {
  const unique = Array.from(new Set((Array.isArray(ids) ? ids : []).filter((v) => v != null && v !== "")))
    .map(String)
    .sort();
  const taken = new Set();
  const out = new Map();
  for (const id of unique) {
    const wanted = hashId(id) % PIN_PALETTE.length;
    let slot = wanted;
    // Walk to the next free slot. After a full lap every slot is taken and
    // the wanted one is reused — the "thirteenth person" case, not hidden.
    for (let i = 0; i < PIN_PALETTE.length && taken.has(slot); i++) {
      slot = (slot + 1) % PIN_PALETTE.length;
    }
    taken.add(slot);
    const fill = PIN_PALETTE[slot];
    out.set(id, { fill, ink: inkFor(fill), slot });
  }
  return out;
}

const isCancelled = (status) => status === "cancelled" || status === "canceled";

const num = (v) => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * What a stop IS, in the words the calendar card uses: a visit is its job's
 * title; an appointment about a quote is "Site visit · Q-1042"; one about a
 * job or an invoice is that record; a booking is its event type; a plain
 * appointment is just an appointment. `about` is the calendar's own label
 * object so the page can translate the kind word; `ref` and `title` are
 * what it carries.
 */
export function describeStop(entry) {
  if (entry.kind === "visit") {
    return { what: "visit", title: entry.title || null, ref: null, href: entry.jobId ? `/app/jobs/${encodeURIComponent(entry.jobId)}` : null };
  }
  if (entry.kind === "booking") {
    return { what: "booking", title: entry.title || null, ref: null, href: null };
  }
  const label = aboutLabel(entry);
  if (label?.kind === "quote") {
    return { what: "site_visit", title: null, ref: label.ref, href: aboutHref(label) };
  }
  if (label) {
    return { what: label.kind, title: label.title, ref: label.ref, href: aboutHref(label) };
  }
  return { what: "appointment", title: null, ref: null, href: `/app/appointments?day=${dayOf(entry.scheduledAt)}` };
}

function dayOf(at) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The day's stops, numbered per person, coloured per group.
 *
 * @param entries   calendar entries (lib/schedule/feed.js shape) — already
 *                  scoped to the caller and to the day.
 * @param opts.groupOf  (entry) => id to colour BY. Defaults to the assignee.
 *                  Settings → Work areas passes the assignee's work area.
 * @param opts.people   [{ userId, name }] to name assignees whose entry
 *                  carries no `assignedTo`.
 * @param opts.groups   extra group ids to colour even when no stop is in
 *                  them today — the work areas, so a zone's polygon keeps
 *                  its colour on a quiet day.
 * @returns {{ stops, groups, cancelled, unlocated }}
 *   stops     one per entry that is not cancelled, in time order
 *   groups    Map<groupId, { fill, ink, slot }>
 *   cancelled how many rows were left off for being cancelled
 *   unlocated how many stops have no coordinates
 */
export function buildMapStops(entries = [], { groupOf = null, people = [], groups = [] } = {}) {
  const rows = (Array.isArray(entries) ? entries : [])
    .filter((e) => e && e.scheduledAt && !Number.isNaN(new Date(e.scheduledAt).getTime()))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const live = rows.filter((e) => !isCancelled(e.status));
  const cancelled = rows.length - live.length;

  const nameOf = new Map((Array.isArray(people) ? people : []).map((p) => [p.userId, p.name]));
  const groupFor = (e) => {
    const g = typeof groupOf === "function" ? groupOf(e) : e.assignedToId;
    return g == null || g === "" ? null : String(g);
  };

  const colours = assignColours([
    ...live.map(groupFor).filter(Boolean),
    ...(Array.isArray(groups) ? groups : []).map((g) => (g == null ? null : String(g))).filter(Boolean),
  ]);

  // Per-person counters, in the time order `live` already has.
  const counters = new Map();
  const stops = live.map((e) => {
    const assigneeId = e.assignedToId ?? e.assignedTo?.id ?? null;
    let sequence = null;
    if (assigneeId) {
      const n = (counters.get(assigneeId) || 0) + 1;
      counters.set(assigneeId, n);
      sequence = n;
    }
    const group = groupFor(e);
    const colour = group ? colours.get(group) : null;
    const lat = num(e.latitude);
    const lng = num(e.longitude);
    const located = lat != null && lng != null;
    const about = describeStop(e);
    return {
      key: `${e.kind}:${e.id}`,
      kind: e.kind,
      id: e.id,
      jobId: e.jobId ?? null,
      scheduledAt: e.scheduledAt,
      status: e.status || "scheduled",
      assigneeId,
      assigneeName: e.assignedTo?.name || (assigneeId ? nameOf.get(assigneeId) : null) || null,
      group,
      sequence,
      label: sequence == null ? "?" : String(sequence),
      fill: colour?.fill || UNASSIGNED_FILL,
      ink: colour?.ink || inkFor(UNASSIGNED_FILL),
      lat,
      lng,
      located,
      clientName: e.client?.name || null,
      address: e.location || e.client?.address || null,
      ...about,
    };
  });

  spreadCoincident(stops);

  return {
    stops,
    groups: colours,
    cancelled,
    unlocated: stops.filter((s) => !s.located).length,
  };
}

/**
 * Two stops at ONE address — the morning visit and the afternoon return, or
 * two people meeting at a site — would be one pin hiding another, and the
 * hidden one is exactly the one the dispatcher is looking for. Coincident
 * points are fanned into a small ring (about 20 m) for DISPLAY only:
 * `pinLat`/`pinLng` is where the marker sits, `lat`/`lng` stays the truth
 * and is what any distance would be measured from. Mutates in place; called
 * once by buildMapStops.
 */
export function spreadCoincident(stops) {
  const byPoint = new Map();
  for (const s of stops) {
    s.pinLat = s.lat;
    s.pinLng = s.lng;
    if (!s.located) continue;
    const k = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;
    if (!byPoint.has(k)) byPoint.set(k, []);
    byPoint.get(k).push(s);
  }
  const RADIUS = 0.00018; // degrees latitude, ≈ 20 m
  for (const group of byPoint.values()) {
    if (group.length < 2) continue;
    group.forEach((s, i) => {
      const angle = (2 * Math.PI * i) / group.length;
      s.pinLat = s.lat + RADIUS * Math.sin(angle);
      s.pinLng = s.lng + (RADIUS * Math.cos(angle)) / Math.max(0.2, Math.cos((s.lat * Math.PI) / 180));
    });
  }
  return stops;
}

/**
 * Where to centre. The company's own address when it has one; otherwise the
 * mean of the day's located stops; otherwise nothing — the map then shows the
 * world and says why, rather than centring on a guess.
 */
export function mapCentre(company, stops = []) {
  const lat = num(company?.latitude);
  const lng = num(company?.longitude);
  if (lat != null && lng != null) return { lat, lng, source: "company" };
  const located = (Array.isArray(stops) ? stops : []).filter((s) => s.located);
  if (located.length) {
    return {
      lat: located.reduce((a, s) => a + s.lat, 0) / located.length,
      lng: located.reduce((a, s) => a + s.lng, 0) / located.length,
      source: "stops",
    };
  }
  return null;
}

/** For the check: does every palette fill carry its ink at 4.5:1? */
export function paletteContrast() {
  return [...PIN_PALETTE, UNASSIGNED_FILL].map((fill) => ({
    fill,
    ink: inkFor(fill),
    ratio: contrastRatio(fill, inkFor(fill)),
  }));
}
