// lib/callbacks/rules.js
//
// "Every Monday, list clients with no job in 10+ months, last ticket over
// $1,500, area Kanata → up to 8." The rule, and the selection it makes —
// pure, so scripts/check-callback-rotation.mjs can hand it a client book and
// assert who is on the list and, more importantly, who is not.
//
// ── What is excluded, and why ─────────────────────────────────────────────
//
//   do-not-contact     Client.doNotContactAt set — never, whatever the rule
//   recently listed    on any list in the last `monthsSinceJob` months — the
//                      rotation calls somebody ONCE per dormancy period, not
//                      every Monday until they pick up
//   call back later    a "call_back" outcome with a date still ahead — they
//                      said when; the list respects it
//   not interested     within the last 12 months — "no" means no for a while
//   no phone           nothing to dial
//   never had a job    the rule is about PAST clients; a lead with no job is
//                      the sales pipeline's, not this list's
//
// Built from THIS company's own Job and Invoice rows and nothing else
// (non-negotiable #8): the candidate list the route hands in is already
// scoped, and nothing here reaches outside it.

const MONTH_MS = 30.4375 * 24 * 60 * 60 * 1000;

export const AREA_KINDS = ["postcode", "city", "work_area"];

const int = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : dflt;
};

/** A rule as stored, from whatever the settings screen sent. */
export function normaliseRule(input = {}) {
  const areaKind = AREA_KINDS.includes(input.areaKind) ? input.areaKind : null;
  const areaValue = areaKind && typeof input.areaValue === "string" ? input.areaValue.trim().slice(0, 80) : "";
  const minTicket = Number(input.minTicket);
  return {
    enabled: input.enabled !== false,
    weekday: int(input.weekday, 0, 6, 1),
    monthsSinceJob: int(input.monthsSinceJob, 1, 120, 10),
    minTicket: Number.isFinite(minTicket) && minTicket >= 0 ? Math.round(minTicket * 100) / 100 : 0,
    areaKind: areaValue ? areaKind : null,
    areaValue: areaValue || null,
    weeklyCap: int(input.weeklyCap, 1, 100, 8),
    assigneeMemberId: typeof input.assigneeMemberId === "string" && input.assigneeMemberId ? input.assigneeMemberId : null,
  };
}

/** "YYYY-MM-DD" of the Monday that starts the week containing `date`, in `timezone`. */
export function weekOfKey(date, timezone) {
  const parts = ymdInZone(date, timezone);
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const back = (utc.getUTCDay() + 6) % 7;
  const monday = new Date(utc.getTime() - back * 86400000);
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;
}

/** Local weekday (0 Sunday) and calendar parts, without a library. */
export function ymdInZone(date, timezone) {
  const d = date instanceof Date ? date : new Date(date);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "America/Toronto",
      year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
    }).formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get("weekday")];
    return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday: wd ?? d.getUTCDay() };
  } catch {
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() };
  }
}

/**
 * Should this rule build a list right now?
 *
 * Due when it is the rule's weekday where the company is AND no list exists
 * for this week yet. The second half is what makes "once per week" hold
 * across a cron that runs daily and may run twice: the (ruleId, weekOf)
 * unique on CallbackList is the lock, this is the check that avoids trying.
 *
 * @param {object} rule           normalised
 * @param {Date} now
 * @param {string} timezone
 * @param {string[]} existingWeeks  weekOf keys of lists this rule already has
 */
export function isDue(rule, now, timezone, existingWeeks = []) {
  if (!rule?.enabled) return { due: false, reason: "disabled" };
  const { weekday } = ymdInZone(now, timezone);
  if (weekday !== rule.weekday) return { due: false, reason: "not_the_day" };
  const weekOf = weekOfKey(now, timezone);
  if (existingWeeks.includes(weekOf)) return { due: false, reason: "already_built", weekOf };
  return { due: true, weekOf };
}

/** Ray-cast point-in-polygon; polygon is [{lat,lng}] as lib/workAreas/polygon.js stores it. */
export function pointInPolygon(point, polygon) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) return false;
  const x = Number(point.lng);
  const y = Number(point.lat);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = Number(polygon[i]?.lng);
    const yi = Number(polygon[i]?.lat);
    const xj = Number(polygon[j]?.lng);
    const yj = Number(polygon[j]?.lat);
    if (![xi, yi, xj, yj].every(Number.isFinite)) return false;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const norm = (s) => (typeof s === "string" ? s.trim().toLowerCase().replace(/\s+/g, "") : "");

/** Does a client (with their last job) fall in the rule's area? No area → yes. */
export function inArea(rule, candidate, workAreaPolygon = null) {
  if (!rule.areaKind || !rule.areaValue) return true;
  const want = norm(rule.areaValue);
  if (rule.areaKind === "postcode") {
    const have = norm(candidate.lastJob?.sitePostalCode || candidate.client?.postalCode);
    return Boolean(have) && have.startsWith(want);
  }
  if (rule.areaKind === "city") {
    const have = norm(candidate.lastJob?.siteCity || candidate.client?.city);
    return Boolean(have) && have === want;
  }
  if (rule.areaKind === "work_area") {
    const lat = candidate.lastJob?.siteLatitude ?? candidate.lastJob?.latitude;
    const lng = candidate.lastJob?.siteLongitude ?? candidate.lastJob?.longitude;
    return pointInPolygon({ lat, lng }, workAreaPolygon);
  }
  return false;
}

/**
 * Pick this week's clients.
 *
 * @param {object} p
 * @param {object} p.rule       normalised
 * @param {Date}   p.now
 * @param {Array}  p.candidates [{ client: {id, name, phone, city, postalCode,
 *                              doNotContactAt}, lastJob: {completedAt|createdAt,
 *                              title, siteCity, sitePostalCode, lat/lng…},
 *                              lastTicket: number|null, history: [{ weekOf,
 *                              outcome, callBackOn, outcomeAt }] }]
 * @param {Array}  [p.workAreaPolygon]
 * @returns {{ picked: Array, excluded: Array<{ clientId, reason }> }}
 */
export function selectCandidates({ rule, now, candidates, workAreaPolygon = null }) {
  const cutoff = now.getTime() - rule.monthsSinceJob * MONTH_MS;
  const listedCutoff = cutoff; // same window: once per dormancy period
  const notInterestedCutoff = now.getTime() - 12 * MONTH_MS;
  const picked = [];
  const excluded = [];
  for (const c of Array.isArray(candidates) ? candidates : []) {
    const client = c?.client;
    if (!client?.id) continue;
    const drop = (reason) => excluded.push({ clientId: client.id, reason });
    if (client.doNotContactAt) {
      drop("do_not_contact");
      continue;
    }
    if (!client.phone) {
      drop("no_phone");
      continue;
    }
    const lastAt = c.lastJob ? new Date(c.lastJob.completedAt || c.lastJob.endDate || c.lastJob.createdAt).getTime() : NaN;
    if (!Number.isFinite(lastAt)) {
      drop("no_job");
      continue;
    }
    if (lastAt > cutoff) {
      drop("recent_job");
      continue;
    }
    const ticket = Number(c.lastTicket);
    if (rule.minTicket > 0 && !(Number.isFinite(ticket) && ticket >= rule.minTicket)) {
      drop("ticket_too_small");
      continue;
    }
    if (!inArea(rule, c, workAreaPolygon)) {
      drop("outside_area");
      continue;
    }
    const history = Array.isArray(c.history) ? c.history : [];
    let blocked = null;
    for (const h of history) {
      if (h.outcome === "do_not_contact") blocked = "do_not_contact";
      else if (h.outcome === "call_back" && h.callBackOn && new Date(h.callBackOn).getTime() > now.getTime()) blocked = "call_back_later";
      else if (h.outcome === "not_interested" && h.outcomeAt && new Date(h.outcomeAt).getTime() > notInterestedCutoff) blocked = "not_interested";
      else if (h.listedAt && new Date(h.listedAt).getTime() > listedCutoff && h.outcome !== "call_back") blocked = "recently_listed";
      if (blocked) break;
    }
    if (blocked) {
      drop(blocked);
      continue;
    }
    picked.push({ ...c, lastAt, ticket: Number.isFinite(ticket) ? ticket : null });
  }
  // Biggest ticket first: the eight calls a week go to the eight most
  // valuable dormant clients, which is the whole point of the cap.
  picked.sort((a, b) => (b.ticket || 0) - (a.ticket || 0) || a.lastAt - b.lastAt);
  return { picked: picked.slice(0, rule.weeklyCap), excluded };
}
