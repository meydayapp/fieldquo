// lib/sales/queueWindows.js
//
// The day's list, grouped by when each row can be rung — in the rep's clock.
//
// ══ What the owner asked for ══════════════════════════════════════════════
//
// "In the queue when we fetch 100 leads is there a way to tell the agent these
// leads are from this time zone and these ones are from this other time zone,
// so that they can focus on the ones that can be called — for example Eastern
// time if it is 8am ET — and not have a lead from California accidentally."
//
// lib/sales/queueBatch.js's selectBatch already refuses a row whose window
// will not open before the shift ends, and deliberately KEEPS one that opens
// later in the shift: a batch claimed at eight in the morning Eastern
// legitimately holds Pacific rows that open at eleven. The owner wants those
// told apart, not removed. So the held rows are grouped:
//
//   Callable now                       — the one that shuts soonest first
//   Opens at 09:00 (Central Time)      — one group per distinct opening
//   Opens at 10:00 (Mountain Time)       instant, earliest first
//   Opens at 11:00 (Pacific Time, Mountain Standard Time)
//   Not callable today                 — opens after the shift, or nobody
//                                        can say when; empty on an ordinary
//                                        day, and said out loud when not
//
// Inside a group the claim order stands (researched first, then the pool's
// own — queueBatch.js), except in "Callable now", which is sorted by closing
// time so that in the afternoon an Atlantic row that shuts at seven is rung
// before a Pacific row that shuts at eleven.
//
// ══ Whose clock ═══════════════════════════════════════════════════════════
//
// Every time printed here is in the REP's zone — the zone the browser sends
// with the request, the same way the batch claim does — because the question
// a rep asks is "when can I ring these", and the answer is on their own wall
// clock. The prospect's zone is still what the RULE is evaluated in
// (lib/sales/callingRules.js does that; this file never re-evaluates it); it
// appears here only as the chip on the row, so "PDT · Window opens 11:00"
// reads as one fact with two clocks on it.
//
// Zone names come from Intl in the rep's language, never from a hand-typed
// table: `timeZoneName: "short"` for the chip (EDT, PDT, MST — or GMT-7 in a
// language whose CLDR data has no abbreviation, which is honest rather than
// English), `longGeneric` for the group label (Pacific Time, hora del
// Pacífico). A runtime without the generic name falls back to the short one,
// and then to the IANA id, so a label is never blank.
//
// ══ Pure, and executed ════════════════════════════════════════════════════
//
// No db, no clock of its own. scripts/check-queue-windows.mjs runs
// groupByWindow over Eastern, Central, Pacific and Phoenix rows at 8 am, 1 pm
// and 8 pm Eastern, for an Eastern rep and a Pacific one, and asserts the
// group order, the closes-soonest sort, the rep-clock labels and the DST edge.

import { CALL_ALLOWED, salesCallReadiness } from "./callingRules";
import { nextClosing, usableTimeZone } from "./queueBatch";
import { windowPolicyFor } from "./windowPolicy";

/** The three kinds of group, in the order they are shown. */
export const WINDOW_GROUP_NOW = "now";
export const WINDOW_GROUP_OPENS = "opens";
export const WINDOW_GROUP_LATER = "later";

const isDate = (v) => v instanceof Date && !Number.isNaN(v.getTime());

/** The two blocker codes that mean "shut for now, but opens" rather than "no". */
const WAITABLE = new Set(["outside_window", "time_zone_ambiguous"]);

/**
 * One Intl zone-name part, or null when the runtime cannot produce it. The
 * `at` instant matters: EDT in September is EST in January.
 */
function zoneNamePart(zone, language, style, at) {
  if (!zone) return null;
  try {
    const parts = new Intl.DateTimeFormat(language || "en", { timeZone: zone, timeZoneName: style }).formatToParts(at);
    return parts.find((p) => p.type === "timeZoneName")?.value || null;
  } catch {
    return null;
  }
}

/** "PDT" — the chip. */
export function zoneShortName(zone, { language = "en", at = new Date() } = {}) {
  return zoneNamePart(zone, language, "short", at) || zone || null;
}

/** "Pacific Time" — the group label. */
/**
 * The acronym a rep says: ET · CT · MT · PT · AT · NT.
 *
 * The owner, 9:20 pm Eastern with a batch of shut windows: "fix them by time
 * zones with a little tab — ET, PT, the acronyms". So the chips on the list
 * wear the two-letter names, and they are ENGLISH in every portal language
 * on purpose — "ET" is what the trade says in Laval and in Fresno, and a
 * French "HE" on a chip beside an English "Opens at 11:00 (Pacific Time)"
 * is two systems on one row.
 *
 * Derived, not tabled: Intl's `shortGeneric` in `en` gives "ET", "CT",
 * "MT", "PT", "AT", "NT" for the North American zones, and those are taken
 * as they come. Anything else — Honolulu's "HST", a zone Intl only knows
 * by offset, a garbage id — falls back to the `short` form so a row is
 * never chipless, and to the id itself when even that fails. Exported so
 * scripts/check-queue-windows.mjs can run the nine zones through it.
 */
export const ZONE_ACRONYMS = Object.freeze(["ET", "CT", "MT", "PT", "AT", "NT"]);
const GENERIC_INITIAL = /^(Eastern|Central|Mountain|Pacific|Atlantic|Newfoundland)\b/;
export function zoneAcronym(zone, { at = new Date() } = {}) {
  if (!zone) return null;
  const generic = zoneNamePart(zone, "en", "shortGeneric", at);
  if (generic && ZONE_ACRONYMS.includes(generic)) return generic;
  // Intl names Phoenix "MST", Regina "CST" and St. John's "St. John’s Time"
  // generically — one of the six by any rep's reckoning. The long generic
  // name's first word says which: "Mountain Standard Time" → MT,
  // "Newfoundland Time" → NT.
  const long = zoneNamePart(zone, "en", "longGeneric", at);
  const m = long ? GENERIC_INITIAL.exec(long) : null;
  if (m) return `${m[1][0]}T`;
  // Not one of the six: the generic short form when it is letters ("AKT",
  // "HST"), else the short form ("GMT-7"), else the id.
  if (generic && /^[A-Z]{2,5}$/.test(generic)) return generic;
  return zoneNamePart(zone, "en", "short", at) || zone;
}

export function zoneLongName(zone, { language = "en", at = new Date() } = {}) {
  return (
    zoneNamePart(zone, language, "longGeneric", at) ||
    zoneNamePart(zone, language, "short", at) ||
    zone ||
    null
  );
}

/** "YYYY-MM-DD" in a zone, or null. */
function localDate(zone, at) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return null;
  }
}

/**
 * An instant on the rep's wall clock: "11:00" when it falls on the rep's
 * local today, "Sat 12 Sep, 08:00" when it does not — a time with no day on
 * it reads as today, and a row that opens tomorrow must not.
 *
 * With no usable rep zone the instant is printed in UTC and says so; that is
 * the one case where the label is not the rep's clock, and it is not
 * silently somebody else's.
 */
export function repClock(at, { repZone = null, language = "en", now = new Date() } = {}) {
  if (!isDate(at)) return null;
  const zone = usableTimeZone(repZone, now) || "UTC";
  const sameDay = localDate(zone, at) === localDate(zone, now);
  try {
    const time = new Intl.DateTimeFormat(language || "en", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      ...(sameDay ? {} : { weekday: "short", day: "numeric", month: "short" }),
    }).format(at);
    return zone === "UTC" ? `${time} UTC` : time;
  } catch {
    return at.toISOString();
  }
}

/**
 * Everything one row needs said about its window, in the rep's clock.
 *
 * @param prospect  `{ country, province }`.
 * @param timeZone  the zone somebody stated for the prospect, or null.
 * @param repZone   the zone the rep's browser reported.
 * @param shiftEnd  when the rep's shift ends; a row opening after it is
 *                  "later". Null means "no bound" — every opening is today's.
 * @param policyContext  `{ overrides, registeredKeys }` from
 *                  lib/sales/windowOverrides.js, resolved per row through the
 *                  one resolver; null keeps every window enforced. A row
 *                  whose window the console switched off lands in "Callable
 *                  now" at any hour, which is what the console said.
 */
export function windowFor({
  prospect = {},
  timeZone = null,
  repZone = null,
  shiftEnd = null,
  now = new Date(),
  language = "en",
  policyContext = null,
} = {}) {
  const readiness = salesCallReadiness({
    prospect,
    timeZone,
    now,
    language,
    windowPolicy: policyContext ? windowPolicyFor(prospect, policyContext) : null,
  });
  const zone = readiness.zones?.[0] || null;
  const callableNow = readiness.decision === CALL_ALLOWED;
  const codes = (readiness.blockers || []).map((b) => b?.code);
  const waitable = !callableNow && codes.length > 0 && codes.every((c) => WAITABLE.has(c)) && isDate(readiness.opensAt);
  const opensAt = waitable ? readiness.opensAt : null;
  const closesAt = callableNow ? nextClosing({ prospect, timeZone, now }) : null;
  const beforeShiftEnd = !isDate(shiftEnd) || (isDate(opensAt) && opensAt.getTime() < shiftEnd.getTime());
  const kind = callableNow ? WINDOW_GROUP_NOW : opensAt && beforeShiftEnd ? WINDOW_GROUP_OPENS : WINDOW_GROUP_LATER;
  return {
    decision: readiness.decision,
    // The override that bound this row, for the chip: "warn only" or "off"
    // beside a row that is callable outside its hours. Null is enforce.
    override: readiness.windowOverride?.mode && readiness.windowOverride.mode !== "enforce"
      ? readiness.windowOverride.mode
      : null,
    inWindow: readiness.inWindow,
    zone,
    zoneShort: zone ? zoneShortName(zone, { language, at: now }) : null,
    zoneLabel: zone ? zoneLongName(zone, { language, at: now }) : null,
    zoneAcronym: zone ? zoneAcronym(zone, { at: now }) : null,
    callableNow,
    opensAtIso: opensAt ? opensAt.toISOString() : null,
    opensAtLocal: opensAt ? repClock(opensAt, { repZone, language, now }) : null,
    closesAtIso: closesAt ? closesAt.toISOString() : null,
    closesAtLocal: closesAt ? repClock(closesAt, { repZone, language, now }) : null,
    kind,
    // Why a "later" row is later, for the sentence under that group: the
    // first blocker's code, or "opens_after_shift" when the only thing wrong
    // is the hour.
    reasonCode: kind === WINDOW_GROUP_LATER ? (opensAt ? "opens_after_shift" : codes[0] || "unknown") : null,
  };
}

/**
 * Group the held rows by window and order them for the day.
 *
 * @param rows     `[{ id, country, province, timeZone }]` in claim order.
 * @returns `{ groups, order, byId }` — `groups` in display order, each
 *          `{ key, kind, opensAtIso, opensAtLocal, zoneLabel, zones, count,
 *          ids }`; `order` every id in grouped order; `byId` the windowFor()
 *          answer per row.
 */
export function groupByWindow(
  rows = [],
  { repZone = null, shiftEnd = null, now = new Date(), language = "en", policyContext = null } = {},
) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r.id === "string" && r.id);
  const byId = {};
  const entries = list.map((row, position) => {
    const w = windowFor({
      prospect: { country: row.country, province: row.province },
      timeZone: row.timeZone || null,
      repZone,
      shiftEnd,
      now,
      language,
      policyContext,
    });
    byId[row.id] = w;
    return { id: row.id, position, w };
  });

  const stamp = (iso) => (iso ? Date.parse(iso) : Number.POSITIVE_INFINITY);

  // Callable now: shuts soonest first, claim order for ties. A row with no
  // closing time (nothing shuts it within a day) sorts last, not first.
  const now_ = entries
    .filter((e) => e.w.kind === WINDOW_GROUP_NOW)
    .sort((a, b) => stamp(a.w.closesAtIso) - stamp(b.w.closesAtIso) || a.position - b.position);

  // One group per distinct opening instant, earliest first; the zones that
  // share it are all named, so Phoenix and Los Angeles opening together in
  // September read as one group with two names rather than a wrong one.
  const opensGroups = new Map();
  for (const e of entries.filter((x) => x.w.kind === WINDOW_GROUP_OPENS)) {
    const key = e.w.opensAtIso;
    if (!opensGroups.has(key)) {
      opensGroups.set(key, { key: `opens:${key}`, kind: WINDOW_GROUP_OPENS, opensAtIso: key, opensAtLocal: e.w.opensAtLocal, zones: [], labels: [], ids: [] });
    }
    const g = opensGroups.get(key);
    if (e.w.zone && !g.zones.includes(e.w.zone)) g.zones.push(e.w.zone);
    if (e.w.zoneLabel && !g.labels.includes(e.w.zoneLabel)) g.labels.push(e.w.zoneLabel);
    g.ids.push(e.id);
  }
  const opens = [...opensGroups.values()].sort((a, b) => stamp(a.opensAtIso) - stamp(b.opensAtIso));

  const later = entries.filter((e) => e.w.kind === WINDOW_GROUP_LATER);

  const groups = [];
  if (now_.length) {
    groups.push({ key: WINDOW_GROUP_NOW, kind: WINDOW_GROUP_NOW, opensAtIso: null, opensAtLocal: null, zoneLabel: null, zones: [], count: now_.length, ids: now_.map((e) => e.id) });
  }
  for (const g of opens) {
    groups.push({ key: g.key, kind: g.kind, opensAtIso: g.opensAtIso, opensAtLocal: g.opensAtLocal, zoneLabel: g.labels.join(", ") || null, zones: g.zones, count: g.ids.length, ids: g.ids });
  }
  if (later.length) {
    groups.push({ key: WINDOW_GROUP_LATER, kind: WINDOW_GROUP_LATER, opensAtIso: null, opensAtLocal: null, zoneLabel: null, zones: [], count: later.length, ids: later.map((e) => e.id) });
  }
  const order = groups.flatMap((g) => g.ids);
  for (const g of groups) for (const id of g.ids) byId[id].group = g.key;
  return { groups, order, byId };
}
