// scripts/check-calendar-feed.mjs
//
//   npm run check:calendar-feed
//
// The personal calendar subscribe feed — GET /api/calendar/feed/{token}.ics
// and the settings route that mints the token — executed, not read.
//
// ══ Why this file executes ═════════════════════════════════════════════════
//
// The feed's promises are all about which ROWS come out for which member and
// what is printed on them: a crew member's phone must not carry a stranger's
// address or a client's phone number, a wrong token must answer an empty 404,
// a moved appointment must carry a higher SEQUENCE than the copy the phone
// holds, and a Toronto 9:00 must stay 9:00 across the DST change. None of
// those is a property of the source. So the real route handlers are imported
// and called against a scripted database — the technique
// scripts/check-crew-calendar.mjs uses on GET /api/appointments, with two
// additions the feed needs: a `gte`/`lt` range on the date columns (the
// window) and a `create` that records the activity row on rotate.
//
// The ICS that comes back is parsed by a small reader below (unfold, split
// VEVENTs, read properties) so every assertion is about the file a phone
// would receive, not about the object that produced it.
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import { FEED_COPY, FEED_COPY_LANGS, FEED_COPY_KEYS } from "@/lib/calendar/feedCopy";
import { feedUrls, mintFeedToken } from "@/lib/calendar/feedToken";
import { buildVtimezone, resolveTimeZone, localWallClock } from "@/lib/calendar/vtimezone";
import { feedEventsFor, buildFeedCalendar, foldLine, feedWindow } from "@/lib/calendar/feed";
import { SETTINGS_ROW_CAPABILITY, canSeeSettingsRow } from "@/lib/permissions/settingsAccess";
import { APP_PAGES } from "@/lib/analytics/product/appPages.js";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { SCREENS } from "../docs/screens/app-guide/harness/screens.js";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
const warnings = [];
const ok = (label, condition, detail = "") => {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? `  ${detail}` : ""}`);
  }
};
const warn = (label) => {
  warnings.push(label);
  console.log(`  warn ${label}`);
};

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. A minimal ICS reader\n");
//
// Enough of RFC 5545 to make claims about a file: unfold continuation lines
// (CRLF + space), split the calendar into components, and read each line as
// NAME;PARAM=VALUE:VALUE. Written here rather than pulled from a library so
// the reader cannot be more forgiving than a phone is.

function unfold(text) {
  return String(text).replace(/\r\n[ \t]/g, "");
}

function parseLine(line) {
  const colon = line.indexOf(":");
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...params] = head.split(";");
  const p = {};
  for (const kv of params) {
    const eq = kv.indexOf("=");
    p[kv.slice(0, eq)] = kv.slice(eq + 1);
  }
  return { name, params: p, value };
}

/** { props: {NAME: {params, value}}, events: [...], tz: { tzid, observances: [...] } } */
function parseIcs(text) {
  const lines = unfold(text).split("\r\n").filter(Boolean);
  const cal = { props: {}, events: [], tz: null, raw: text };
  let cur = null;
  let obs = null;
  for (const line of lines) {
    const { name, params, value } = parseLine(line);
    if (name === "BEGIN" && value === "VEVENT") {
      cur = { props: {} };
      continue;
    }
    if (name === "END" && value === "VEVENT") {
      cal.events.push(cur);
      cur = null;
      continue;
    }
    if (name === "BEGIN" && value === "VTIMEZONE") {
      cal.tz = { tzid: null, observances: [] };
      continue;
    }
    if (name === "END" && value === "VTIMEZONE") continue;
    if (name === "BEGIN" && (value === "STANDARD" || value === "DAYLIGHT")) {
      obs = { kind: value, props: {} };
      continue;
    }
    if (name === "END" && (value === "STANDARD" || value === "DAYLIGHT")) {
      cal.tz.observances.push(obs);
      obs = null;
      continue;
    }
    const target = cur ? cur.props : obs ? obs.props : cal.tz && !cal.events.length && name === "TZID" ? null : cal.props;
    if (cal.tz && name === "TZID" && !cur && !obs) {
      cal.tz.tzid = value;
      continue;
    }
    if (target) target[name] = { params, value };
  }
  return cal;
}

const sample = "BEGIN:VCALENDAR\r\nX-TEST:abc\r\n def\r\nBEGIN:VEVENT\r\nUID:u1\r\nDTSTART;TZID=America/Toronto:20260115T090000\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
const parsed = parseIcs(sample);
ok("the reader unfolds a continuation line", parsed.props["X-TEST"]?.value === "abcdef");
ok("…and reads a TZID parameter off DTSTART", parsed.events[0]?.props.DTSTART?.params.TZID === "America/Toronto" && parsed.events[0].props.DTSTART.value === "20260115T090000");

ok(
  "foldLine splits at 75 octets and never inside a multi-byte character",
  (() => {
    const long = "SUMMARY:" + "é".repeat(80);
    const folded = foldLine(long);
    const parts = folded.split("\r\n");
    return (
      parts.every((p) => Buffer.byteLength(p, "utf8") <= 75) &&
      parts.slice(1).every((p) => p.startsWith(" ")) &&
      unfold(folded) === long
    );
  })(),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. The scripted database and the real handlers\n");

const { register } = await import("node:module");

const crewValues = PERMISSION_PRESETS.worker.values;
const estValues = PERMISSION_PRESETS.estimator.values;
ok("Crew still see their own schedule at name-and-address only", crewValues.schedule === "view_complete_own" && crewValues.clientsProperties === "name_address_only");
ok("an Estimator is scoped on the schedule and unscoped on jobs", estValues.schedule === "view_complete_own" && PRESET_TO_ROLE.estimator === "employee");

globalThis.__FQ_ROWS = { member: [], appointment: [], jobVisit: [], booking: [], company: [], user: [], activityLog: [] };
globalThis.__FQ_WRITES = [];

const RELATIONS = new Set(["client", "assignedTo", "booking", "job", "visits", "eventType", "user", "quote", "invoice"]);

/**
 * The same evaluator check-crew-calendar.mjs carries, plus `gte`/`lt`/`lte`/
 * `gt` on a Date column — the feed asks for a window, and a stub that
 * ignored the range would pass a route that forgot to pass one.
 */
function matchWhere(row, where = {}) {
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === "OR") {
      if (!cond.some((branch) => matchWhere(row, branch))) return false;
      continue;
    }
    if (key === "AND") {
      if (!cond.every((branch) => matchWhere(row, branch))) return false;
      continue;
    }
    if (key.includes("_") && cond && typeof cond === "object" && !(key in row)) {
      if (!matchWhere(row, cond)) return false;
      continue;
    }
    const value = row[key];
    if (cond === null) {
      if (value != null) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("some" in cond) {
        if (!Array.isArray(value) || !value.some((v) => matchWhere(v, cond.some))) return false;
        continue;
      }
      if ("in" in cond) {
        if (!cond.in.includes(value)) return false;
        continue;
      }
      if ("not" in cond) {
        if (cond.not === null ? value == null : value === cond.not) return false;
        continue;
      }
      if ("gte" in cond || "lt" in cond || "gt" in cond || "lte" in cond) {
        const t = value instanceof Date ? value.getTime() : value;
        if ("gte" in cond && !(t >= cond.gte.getTime())) return false;
        if ("gt" in cond && !(t > cond.gt.getTime())) return false;
        if ("lt" in cond && !(t < cond.lt.getTime())) return false;
        if ("lte" in cond && !(t <= cond.lte.getTime())) return false;
        continue;
      }
      if (!matchWhere(value, cond)) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}

function projectRelation(value, spec) {
  if (spec === true) return value;
  if (Array.isArray(value)) return value.map((v) => projectRow(v, spec));
  if (value == null) return null;
  return projectRow(value, spec);
}

function projectRow(row, spec = {}) {
  if (!row) return row;
  if (spec.select) {
    const out = {};
    for (const [key, sub] of Object.entries(spec.select)) {
      out[key] = sub === true ? row[key] : projectRelation(row[key], sub);
    }
    return out;
  }
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (!RELATIONS.has(key)) out[key] = value;
  }
  for (const [key, sub] of Object.entries(spec.include || {})) {
    out[key] = sub === true ? row[key] : projectRelation(row[key], sub);
  }
  return out;
}

function stubModel(name) {
  const all = () => globalThis.__FQ_ROWS[name] || [];
  return {
    async findMany(args = {}) {
      return all().filter((r) => matchWhere(r, args.where)).map((r) => projectRow(r, args));
    },
    async findFirst(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? projectRow(hit, args) : null;
    },
    async findUnique(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? projectRow(hit, args) : null;
    },
    async update(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      if (!hit) throw new Error(`dbStub: no ${name} row to update`);
      Object.assign(hit, args.data);
      globalThis.__FQ_WRITES.push({ model: name, op: "update", data: args.data });
      return projectRow(hit, args);
    },
    async create(args = {}) {
      const row = { id: `${name}_${all().length + 1}`, ...args.data };
      all().push(row);
      globalThis.__FQ_WRITES.push({ model: name, op: "create", data: args.data });
      return row;
    },
  };
}

globalThis.__FQ_DB = new Proxy(
  Object.fromEntries(Object.keys(globalThis.__FQ_ROWS).map((m) => [m, stubModel(m)])),
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      throw new Error(`dbStub: db.${String(prop)} is not scripted in this check`);
    },
  },
);

globalThis.__FQ_MEMBER = async () => globalThis.__FQ_SESSION;

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "next/server": "fq-stub:next",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    return { format: "module", shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  }
  if (url === "fq-stub:member") {
    return { format: "module", shortCircuit: true,
      source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);" };
  }
  if (url === "fq-stub:next") {
    // A NextResponse that behaves like a Response for the two things the
    // feed route does with it: a body with headers and a status, and
    // NextResponse.json. Backed by the platform Response so .text() and
    // .headers.get() are the real ones.
    return { format: "module", shortCircuit: true,
      source: "export class NextResponse extends Response { static json(body, init) { return new NextResponse(JSON.stringify(body), { ...(init || {}), headers: { 'content-type': 'application/json', ...((init && init.headers) || {}) } }); } }" };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const feedRoute = await import("@/app/api/calendar/feed/[token]/route.js");
const linkRoute = await import("@/app/api/calendar/feed/route.js");

// ── Fixtures ───────────────────────────────────────────────────────────────
//
// The same three people check-crew-calendar.mjs uses, over rows that carry
// exactly the facts a feed must and must not print: a stranger's address on
// a job the crew member is not on, a phone number on every client, a booking
// that is a phone call, a cancelled appointment, and one in the past beyond
// the window.

const NOW = new Date("2026-06-15T12:00:00Z");
const ORIGIN = "https://app.fieldquo.test";
const CREW_TOKEN = "crewtoken_0123456789abcdefABCDEF";
const OWNER_TOKEN = "ownertoken_0123456789abcdefABCD";
const EST_TOKEN = "esttoken_0123456789abcdefABCDEF";

const STRANGER_ADDRESS = "9 Oak Ave";
const STRANGER_NAME = "Bea Nowak";
const MY_PHONE = "+15145550100";
const MY_EMAIL = "ana@example.com";
const CALLER_PHONE = "+14385550177";
const CALLER_EMAIL = "lalonde@example.com";

const myClient = { id: "c_mine", name: "Ana Ruiz", address: "14 Elm St", email: MY_EMAIL, phone: MY_PHONE, notes: "Gate code 4417.", portalToken: "tok_ana" };
const strangerClient = { id: "c_theirs", name: STRANGER_NAME, address: STRANGER_ADDRESS, email: "bea@example.com", phone: "+15145550199", notes: "Rear entrance only.", portalToken: "tok_bea" };

const jobRef = (id, title, client, visits) => ({ id, companyId: "co", archivedAt: null, title, client, visits, latitude: null, longitude: null, siteLatitude: null, siteLongitude: null });
const MY_JOB = jobRef("job_mine", "Repaint 14 Elm St", myClient, [{ assignedToId: "u_crew" }]);
const THEIR_JOB = jobRef("job_theirs", "Deck stain, 9 Oak Ave", strangerClient, [{ assignedToId: "u_other" }, { assignedToId: null }]);

const at = (iso) => new Date(iso);
const visitRow = (id, job, assignedToId, name, extra = {}) => ({
  id, jobId: job.id, scheduledAt: at("2026-07-15T13:00:00Z"), status: "scheduled", notes: null,
  assignedToId, assignedTo: assignedToId ? { id: assignedToId, name } : null, job,
  updatedAt: at("2026-06-01T10:00:00Z"), ...extra,
});
globalThis.__FQ_ROWS.jobVisit = [
  visitRow("v_mine", MY_JOB, "u_crew", "Dani"),
  visitRow("v_open", MY_JOB, null, null),
  visitRow("v_theirs", THEIR_JOB, "u_other", "Sam"),
  visitRow("v_stranger", THEIR_JOB, null, null),
  visitRow("v_cancelled", MY_JOB, "u_crew", "Dani", { status: "cancelled", scheduledAt: at("2026-06-20T13:00:00Z") }),
];

const apptRow = (id, assignedToId, name, client, extra = {}) => ({
  id, companyId: "co", clientId: client.id, scheduledAt: at("2026-07-16T13:00:00Z"), location: client.address,
  status: "scheduled", requiresSupervisor: false, createdById: "u_disp", assignedToId,
  assignedTo: assignedToId ? { id: assignedToId, name } : null, client, booking: null, quote: null, job: null, invoice: null,
  notes: null, updatedAt: at("2026-06-02T10:00:00Z"), ...extra,
});
globalThis.__FQ_ROWS.appointment = [
  // 09:00 Toronto in JULY (EDT, -0400) and in JANUARY (EST, -0500).
  apptRow("a_mine", "u_crew", "Dani", myClient, { scheduledAt: at("2026-07-16T13:00:00Z") }),
  apptRow("a_winter", "u_crew", "Dani", myClient, { scheduledAt: at("2027-01-14T14:00:00Z"), notes: "Bring the sample book." }),
  apptRow("a_theirs", "u_other", "Sam", strangerClient),
  apptRow("a_open", null, null, myClient),
  apptRow("a_cancelled", "u_crew", "Dani", myClient, { status: "cancelled", scheduledAt: at("2026-06-18T13:00:00Z") }),
  // Older than the window: was cancelled 40 days ago. Must not be in the feed.
  apptRow("a_old", "u_crew", "Dani", myClient, { status: "cancelled", scheduledAt: at("2026-05-01T13:00:00Z") }),
  // Beyond the window: 400 days out.
  apptRow("a_far", "u_crew", "Dani", myClient, { scheduledAt: at("2027-08-01T13:00:00Z") }),
  // A phone call, converted from a booking: the mode and the real end time.
  apptRow("a_call", "u_crew", "Dani", myClient, {
    scheduledAt: at("2026-07-17T15:00:00Z"),
    booking: { endTime: at("2026-07-17T15:30:00Z"), source: "booking_page", mode: "call" },
  }),
];

const bookingRow = (id, ownerId, ownerName, clientName, address, extra = {}) => ({
  id, appointmentId: null, status: "confirmed", startTime: at("2026-07-18T14:00:00Z"), endTime: at("2026-07-18T15:00:00Z"),
  clientName, clientPhone: CALLER_PHONE, clientEmail: CALLER_EMAIL, address, mode: "visit", latitude: null, longitude: null, source: null,
  updatedAt: at("2026-06-03T10:00:00Z"),
  eventType: { companyId: "co", name: ownerId ? "Estimate visit" : "Free estimate", userId: ownerId, user: ownerId ? { id: ownerId, name: ownerName } : null },
  ...extra,
});
globalThis.__FQ_ROWS.booking = [
  bookingRow("bk_mine", "u_crew", "Dani", "Mr Lalonde", "77 Pine Rd"),
  bookingRow("bk_call", "u_crew", "Dani", "Mr Lalonde", null, { mode: "call", startTime: at("2026-07-19T14:00:00Z"), endTime: at("2026-07-19T14:20:00Z") }),
  bookingRow("bk_theirs", "u_other", "Sam", "Mrs Tran", "3 Cedar Cres"),
  bookingRow("bk_company", null, null, "Ms Okafor", "412 Rue Sainte-Catherine"),
];

const memberRow = (id, userId, role, permissions, calendarFeedToken, active = true) => ({ id, userId, companyId: "co", role, permissions, calendarFeedToken, active });
globalThis.__FQ_ROWS.member = [
  memberRow("m_crew", "u_crew", "employee", { ...crewValues }, CREW_TOKEN),
  memberRow("m_owner", "u_owner", "owner", null, OWNER_TOKEN),
  memberRow("m_est", "u_est", "employee", { ...estValues }, EST_TOKEN),
  memberRow("m_other", "u_other", "employee", { ...crewValues }, null),
  memberRow("m_gone", "u_gone", "employee", { ...crewValues }, "gonetoken_0123456789abcdefABCD", false),
];
globalThis.__FQ_ROWS.company = [{ id: "co", name: "Peinture Lalonde", timezone: "America/Toronto", defaultLanguage: "fr" }];
globalThis.__FQ_ROWS.user = [{ id: "u_crew", name: "Dani", email: "dani@example.com" }];

const feedReq = (token) => new Request(`${ORIGIN}/api/calendar/feed/${token}`, { headers: { "x-forwarded-host": "app.fieldquo.test", "x-forwarded-proto": "https" } });
const ctx = (token) => ({ params: Promise.resolve({ token }) });

// Freeze "now" for the window so the fixtures' dates mean what the comments say.
const realDate = Date;
globalThis.Date = class extends realDate {
  constructor(...args) {
    super(...(args.length ? args : [NOW.getTime()]));
  }
  static now() {
    return NOW.getTime();
  }
};

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. The token gate\n");

const wrong = await feedRoute.GET(feedReq("wrongtoken_0123456789abcdef.ics"), ctx("wrongtoken_0123456789abcdef.ics"));
ok("a wrong token answers 404", wrong.status === 404);
ok("…with an EMPTY body — no JSON, no reason", (await wrong.text()) === "");

const short = await feedRoute.GET(feedReq("abc.ics"), ctx("abc.ics"));
ok("a token shorter than 16 characters is refused before any query (404, empty)", short.status === 404 && (await short.text()) === "");

const junk = await feedRoute.GET(feedReq("../../etc/passwd"), ctx("../../etc/passwd"));
ok("a token outside the base64url alphabet is refused (404)", junk.status === 404);

const inactive = await feedRoute.GET(feedReq("gonetoken_0123456789abcdefABCD.ics"), ctx("gonetoken_0123456789abcdefABCD.ics"));
ok("a deactivated member's token answers the same 404", inactive.status === 404 && (await inactive.text()) === "");

const crewRes = await feedRoute.GET(feedReq(`${CREW_TOKEN}.ics`), ctx(`${CREW_TOKEN}.ics`));
ok("the right token answers 200", crewRes.status === 200);
ok("…as text/calendar", /^text\/calendar/.test(crewRes.headers.get("content-type") || ""));
ok("…privately cached for fifteen minutes", crewRes.headers.get("cache-control") === "private, max-age=900");
ok("…inline, named fieldquo.ics", /inline; filename="fieldquo\.ics"/.test(crewRes.headers.get("content-disposition") || ""));
const crewIcs = await crewRes.text();
const crew = parseIcs(crewIcs);

const bareRes = await feedRoute.GET(feedReq(CREW_TOKEN), ctx(CREW_TOKEN));
ok("the .ics suffix is optional — the bare token answers the same calendar", bareRes.status === 200 && (await bareRes.text()) === crewIcs);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. The scoping matrix — the same rows loadScheduleFeed gives each member\n");

const uidsOf = (cal) => cal.events.map((e) => e.props.UID?.value);
const crewUids = uidsOf(crew);

ok("Crew: their own appointment, visit and booking", ["appt-a_mine@fieldquo", "visit-v_mine@fieldquo", "booking-bk_mine@fieldquo"].every((u) => crewUids.includes(u)));
ok("Crew: the unassigned visit on THEIR job", crewUids.includes("visit-v_open@fieldquo"));
ok("Crew: the unassigned appointment", crewUids.includes("appt-a_open@fieldquo"));
ok("Crew: NOT the unassigned visit on a stranger's job", !crewUids.includes("visit-v_stranger@fieldquo"));
ok("Crew: NOT a colleague's rows", !crewUids.some((u) => /a_theirs|v_theirs|bk_theirs/.test(u)));
ok("Crew: NOT the company-wide booking", !crewUids.includes("booking-bk_company@fieldquo"));
ok("Crew: a row 40 days in the past is outside the window", !crewUids.includes("appt-a_old@fieldquo"));
ok("Crew: a row 400 days out is outside the window", !crewUids.includes("appt-a_far@fieldquo"));
ok("Crew: a cancellation from three weeks ago is still in the feed (it leaves after 30 days)", crewUids.includes("appt-a_cancelled@fieldquo") && crewUids.includes("visit-v_cancelled@fieldquo"));

const ownerRes = await feedRoute.GET(feedReq(`${OWNER_TOKEN}.ics`), ctx(`${OWNER_TOKEN}.ics`));
const ownerIcs = await ownerRes.text();
const owner = parseIcs(ownerIcs);
const ownerUids = uidsOf(owner);
ok("Owner: every appointment in the window", ["a_mine", "a_winter", "a_theirs", "a_open", "a_cancelled", "a_call"].every((id) => ownerUids.includes(`appt-${id}@fieldquo`)));
ok("Owner: every visit, assigned or not", ["v_mine", "v_open", "v_theirs", "v_stranger", "v_cancelled"].every((id) => ownerUids.includes(`visit-${id}@fieldquo`)));
ok("Owner: every booking, the company-wide one included", ["bk_mine", "bk_call", "bk_theirs", "bk_company"].every((id) => ownerUids.includes(`booking-${id}@fieldquo`)));
ok("Owner: and still nothing outside the window", !ownerUids.includes("appt-a_old@fieldquo") && !ownerUids.includes("appt-a_far@fieldquo"));

const estRes = await feedRoute.GET(feedReq(`${EST_TOKEN}.ics`), ctx(`${EST_TOKEN}.ics`));
const estUids = uidsOf(parseIcs(await estRes.text()));
ok("Estimator: both unassigned visits (whole job board), none of the assigned ones", estUids.includes("visit-v_open@fieldquo") && estUids.includes("visit-v_stranger@fieldquo") && !estUids.includes("visit-v_mine@fieldquo"));
ok("Estimator: not the company-wide booking", !estUids.includes("booking-bk_company@fieldquo"));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. Every event is a complete VEVENT, and the VTIMEZONE is there\n");

const REQUIRED = ["UID", "DTSTART", "DTEND", "SUMMARY", "SEQUENCE", "STATUS", "DTSTAMP", "LAST-MODIFIED"];
for (const cal of [crew, owner]) {
  const missing = cal.events.flatMap((e) => REQUIRED.filter((p) => !e.props[p]).map((p) => `${e.props.UID?.value}: ${p}`));
  ok(`every event carries ${REQUIRED.join(", ")}`, missing.length === 0, missing.join(", "));
  ok("every DTSTART and DTEND carries TZID=America/Toronto and no Z", cal.events.every((e) => e.props.DTSTART.params.TZID === "America/Toronto" && e.props.DTEND.params.TZID === "America/Toronto" && !/Z$/.test(e.props.DTSTART.value)));
  ok("DTSTAMP and LAST-MODIFIED are UTC (trailing Z)", cal.events.every((e) => /Z$/.test(e.props.DTSTAMP.value) && /Z$/.test(e.props["LAST-MODIFIED"].value)));
  ok("SEQUENCE is a non-negative integer", cal.events.every((e) => /^\d+$/.test(e.props.SEQUENCE.value)));
}
ok("METHOD:PUBLISH, a PRODID and X-PUBLISHED-TTL:PT15M", crew.props.METHOD?.value === "PUBLISH" && /FieldQuo/.test(crew.props.PRODID?.value || "") && crew.props["X-PUBLISHED-TTL"]?.value === "PT15M");
ok("X-WR-CALNAME is «{Company} — my schedule» in the company's language (fr)", crew.props["X-WR-CALNAME"]?.value === `Peinture Lalonde — ${FEED_COPY.fr.mySchedule}`);
ok("a VTIMEZONE for America/Toronto is present", crew.tz?.tzid === "America/Toronto" && crew.tz.observances.length >= 2);
ok("no raw line exceeds 75 octets", crewIcs.split("\r\n").every((l) => Buffer.byteLength(l, "utf8") <= 75));
ok("UIDs are stable per row and kind-prefixed", crewUids.every((u) => /^(appt|visit|booking)-[A-Za-z0-9_]+@fieldquo$/.test(u)));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. What the events say\n");

const byUid = (cal, uid) => cal.events.find((e) => e.props.UID?.value === uid);
const aMine = byUid(crew, "appt-a_mine@fieldquo");
const vMine = byUid(crew, "visit-v_mine@fieldquo");
const bkMine = byUid(crew, "booking-bk_mine@fieldquo");
const aCall = byUid(crew, "appt-a_call@fieldquo");
const bkCall = byUid(crew, "booking-bk_call@fieldquo");
const aWinter = byUid(crew, "appt-a_winter@fieldquo");

ok("a plain appointment: «Rendez-vous — Ana Ruiz»", aMine?.props.SUMMARY.value === "Rendez-vous — Ana Ruiz");
ok("a job visit: «Visite de chantier: Repaint 14 Elm St — Ana Ruiz»", vMine?.props.SUMMARY.value === "Visite de chantier: Repaint 14 Elm St — Ana Ruiz");
ok("a booking of mode visit: «Visite sur place — Mr Lalonde»", bkMine?.props.SUMMARY.value === "Visite sur place — Mr Lalonde");
ok("an appointment from a call booking: «Appel téléphonique — Ana Ruiz»", aCall?.props.SUMMARY.value === "Appel téléphonique — Ana Ruiz");
ok("LOCATION on a visit is the site address", vMine?.props.LOCATION?.value === "14 Elm St");
ok("LOCATION on a booking is the booking's address", bkMine?.props.LOCATION?.value === "77 Pine Rd");
ok("the visit's DESCRIPTION links to its job", /Ouvrir dans FieldQuo: https:\/\/app\.fieldquo\.test\/app\/jobs\/job_mine/.test(vMine?.props.DESCRIPTION?.value || ""));
ok("the appointment's DESCRIPTION links to the calendar on its (company-local) day", /\/app\/appointments\?day=2026-07-16/.test(aMine?.props.DESCRIPTION?.value || ""));
ok("a booking with a real end time keeps it (14:00–15:00 local 10:00–11:00)", bkMine?.props.DTSTART.value === "20260718T100000" && bkMine?.props.DTEND.value === "20260718T110000");
ok("an appointment with no duration is shown as one hour AND says so", aMine?.props.DTEND.value === "20260716T100000" && (aMine?.props.DESCRIPTION?.value || "").includes(FEED_COPY.fr.durationNotSet.replace(/,/g, "\\,")));
ok("…while the booking with a real end time does NOT carry the caveat", !(bkMine?.props.DESCRIPTION?.value || "").includes("Durée non définie"));
ok("notes ride in the DESCRIPTION", (aWinter?.props.DESCRIPTION?.value || "").includes("Bring the sample book."));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. A moved row carries a higher SEQUENCE\n");

const seqBefore = Number(aMine.props.SEQUENCE.value);
const row = globalThis.__FQ_ROWS.appointment.find((a) => a.id === "a_mine");
row.scheduledAt = at("2026-07-16T15:00:00Z");
row.updatedAt = at("2026-06-14T09:00:00Z");
const movedRes = await feedRoute.GET(feedReq(`${CREW_TOKEN}.ics`), ctx(`${CREW_TOKEN}.ics`));
const moved = byUid(parseIcs(await movedRes.text()), "appt-a_mine@fieldquo");
ok("the same UID comes back", Boolean(moved));
ok("…at the new time", moved?.props.DTSTART.value === "20260716T110000");
ok("…with a higher SEQUENCE", Number(moved?.props.SEQUENCE.value) > seqBefore);
ok("…and SEQUENCE is floor(updatedAt / 1000)", Number(moved?.props.SEQUENCE.value) === Math.floor(row.updatedAt.getTime() / 1000));
ok("…and DTSTAMP is the row's updatedAt", moved?.props.DTSTAMP.value === "20260614T090000Z");

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n8. Cancelled rows\n");

const aCanc = byUid(crew, "appt-a_cancelled@fieldquo");
const vCanc = byUid(crew, "visit-v_cancelled@fieldquo");
ok("a cancelled appointment is STATUS:CANCELLED", aCanc?.props.STATUS.value === "CANCELLED");
ok("a cancelled visit is STATUS:CANCELLED", vCanc?.props.STATUS.value === "CANCELLED");
ok("…and its SUMMARY says so in the company's language", (aCanc?.props.SUMMARY.value || "").startsWith(`${FEED_COPY.fr.cancelled}: `));
ok("everything else is STATUS:CONFIRMED", crew.events.filter((e) => !/a_cancelled|v_cancelled/.test(e.props.UID.value)).every((e) => e.props.STATUS.value === "CONFIRMED"));
{
  const b = globalThis.__FQ_ROWS.booking.find((x) => x.id === "bk_mine");
  b.status = "cancelled";
  const res = await feedRoute.GET(feedReq(`${CREW_TOKEN}.ics`), ctx(`${CREW_TOKEN}.ics`));
  const ev = byUid(parseIcs(await res.text()), "booking-bk_mine@fieldquo");
  ok("a cancelled booking is STATUS:CANCELLED", ev?.props.STATUS.value === "CANCELLED");
  b.status = "confirmed";
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n9. The company timezone across DST\n");

ok("09:00 Toronto in JULY comes back as 090000 local", aMine?.props.DTSTART.value === "20260716T090000");
ok("09:00 Toronto in JANUARY comes back as 090000 local", aWinter?.props.DTSTART.value === "20270114T090000");
const daylight = crew.tz.observances.filter((o) => o.kind === "DAYLIGHT");
const standard = crew.tz.observances.filter((o) => o.kind === "STANDARD");
ok("the DAYLIGHT observance is -0500 → -0400", daylight.length >= 1 && daylight.every((o) => o.props.TZOFFSETFROM.value === "-0500" && o.props.TZOFFSETTO.value === "-0400"));
ok("the STANDARD observance is -0400 → -0500", standard.length >= 1 && standard.every((o) => o.props.TZOFFSETFROM.value === "-0400" && o.props.TZOFFSETTO.value === "-0500"));
ok("a July event falls in a DAYLIGHT segment, a January one in STANDARD", (() => {
  // The observance in force at a local time is the latest whose DTSTART precedes it.
  const inForce = (local) => crew.tz.observances.filter((o) => o.props.DTSTART.value <= local).sort((a, b) => (a.props.DTSTART.value < b.props.DTSTART.value ? 1 : -1))[0];
  return inForce("20260716T090000")?.kind === "DAYLIGHT" && inForce("20270114T090000")?.kind === "STANDARD";
})());
ok("the observances' DTSTARTs are the real transitions (2026-03-08 02:00, 2026-11-01 02:00)", crew.tz.observances.some((o) => o.props.DTSTART.value === "20260308T020000") && crew.tz.observances.some((o) => o.props.DTSTART.value === "20261101T020000"));

{
  const w = feedWindow(NOW);
  const phx = buildVtimezone({ timeZone: "America/Phoenix", from: w.from, to: w.to });
  const obs = phx.lines.filter((l) => l === "BEGIN:STANDARD" || l === "BEGIN:DAYLIGHT");
  ok("a zone with no DST (America/Phoenix) yields exactly one observance", obs.length === 1 && obs[0] === "BEGIN:STANDARD");
  ok("…whose TZOFFSETFROM equals its TZOFFSETTO (-0700)", phx.lines.includes("TZOFFSETFROM:-0700") && phx.lines.includes("TZOFFSETTO:-0700"));
  ok("an unknown zone falls back to America/Toronto", resolveTimeZone("Mars/Olympus_Mons") === "America/Toronto" && resolveTimeZone(null) === "America/Toronto" && buildVtimezone({ timeZone: 42, from: w.from, to: w.to }).tzid === "America/Toronto");
  ok("localWallClock of a half-hour zone (Asia/Kolkata) is exact", localWallClock(new Date("2026-07-16T13:00:00Z"), "Asia/Kolkata") === "20260716T183000");
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n10. No client phone or email in a crew feed\n");

const SECRETS = [MY_PHONE, MY_EMAIL, CALLER_PHONE, CALLER_EMAIL, STRANGER_ADDRESS, STRANGER_NAME, "bea@example.com", "+15145550199"];
const crewLeaks = SECRETS.filter((s) => crewIcs.includes(s));
ok("the crew ICS carries no phone, email, stranger name or stranger address", crewLeaks.length === 0, crewLeaks.join(", "));
ok("Crew: a phone-call appointment's LOCATION says it is a call, with no number", aCall?.props.LOCATION?.value === FEED_COPY.fr.phoneCall);
ok("Crew: a phone-call BOOKING (synthetic client, phone always on the row) — still no number", bkCall?.props.LOCATION?.value === FEED_COPY.fr.phoneCall && !(bkCall?.props.DESCRIPTION?.value || "").includes(CALLER_PHONE));
const ownerCall = byUid(owner, "appt-a_call@fieldquo");
const ownerBkCall = byUid(owner, "booking-bk_call@fieldquo");
ok("Owner: the phone-call appointment's LOCATION carries the client's number", ownerCall?.props.LOCATION?.value === `${FEED_COPY.fr.phone}: ${MY_PHONE}`);
ok("Owner: the phone-call booking's LOCATION carries the caller's number", ownerBkCall?.props.LOCATION?.value === `${FEED_COPY.fr.phone}: ${CALLER_PHONE}`);
ok("Owner: no email anywhere, and no phone in any DESCRIPTION", !ownerIcs.includes(MY_EMAIL) && !ownerIcs.includes(CALLER_EMAIL) && owner.events.every((e) => !(e.props.DESCRIPTION?.value || "").includes(MY_PHONE) && !(e.props.DESCRIPTION?.value || "").includes(CALLER_PHONE)));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n11. The settings route: mint, rotate, log\n");

globalThis.__FQ_SESSION = { id: "m_other", userId: "u_other", companyId: "co", role: "employee" };
const linkReq = (body) => new Request(`${ORIGIN}/api/calendar/feed`, { method: body ? "POST" : "GET", headers: { "x-forwarded-host": "app.fieldquo.test", "x-forwarded-proto": "https", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

const minted = await linkRoute.GET(linkReq());
const mintedBody = await minted.json();
ok("GET mints a token for a member who has none", minted.status === 200 && /^[A-Za-z0-9_-]{32}$/.test(mintedBody.token));
ok("…and writes it to the member row", globalThis.__FQ_ROWS.member.find((m) => m.id === "m_other").calendarFeedToken === mintedBody.token);
ok("…and the four URL shapes", mintedBody.urls.https === `${ORIGIN}/api/calendar/feed/${mintedBody.token}.ics` && mintedBody.urls.webcal === `webcal://app.fieldquo.test/api/calendar/feed/${mintedBody.token}.ics` && mintedBody.urls.google === `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(mintedBody.urls.webcal)}` && mintedBody.urls.outlook === mintedBody.urls.https);
const again = await (await linkRoute.GET(linkReq())).json();
ok("a second GET returns the SAME token — minting is once", again.token === mintedBody.token);
ok("feedUrls and mintFeedToken agree with the route", feedUrls(ORIGIN, "abc").https === `${ORIGIN}/api/calendar/feed/abc.ics` && /^[A-Za-z0-9_-]{32}$/.test(mintFeedToken()));

const mintedFeed = await feedRoute.GET(feedReq(`${mintedBody.token}.ics`), ctx(`${mintedBody.token}.ics`));
ok("the minted token opens the feed", mintedFeed.status === 200);

const writesBefore = globalThis.__FQ_WRITES.length;
const rotated = await linkRoute.POST(linkReq({ action: "rotate" }));
const rotatedBody = await rotated.json();
ok("POST rotate answers a NEW token", rotated.status === 200 && rotatedBody.token !== mintedBody.token && /^[A-Za-z0-9_-]{32}$/.test(rotatedBody.token));
const oldFeed = await feedRoute.GET(feedReq(`${mintedBody.token}.ics`), ctx(`${mintedBody.token}.ics`));
ok("the OLD token now answers 404", oldFeed.status === 404);
const newFeed = await feedRoute.GET(feedReq(`${rotatedBody.token}.ics`), ctx(`${rotatedBody.token}.ics`));
ok("the new one answers 200", newFeed.status === 200);
const activity = globalThis.__FQ_WRITES.slice(writesBefore).find((w) => w.model === "activityLog");
ok("an activity row records the rotation, keyed for the reader's language", activity?.data.action === "calendar_feed.rotated" && activity.data.actorMemberId === "m_other" && activity.data.metadata?.i18n?.key === "app.activity.event.calendarFeedRotated");
const badAction = await linkRoute.POST(linkReq({ action: "explode" }));
ok("an unknown action is a 400", badAction.status === 400);
globalThis.__FQ_SESSION = null;
const noSession = await linkRoute.GET(linkReq());
ok("no session → 401", noSession.status === 401);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n12. The pure builder over hostile entries\n");

{
  const events = feedEventsFor({
    entries: [
      null,
      { id: "x" }, // no date
      { id: "y", kind: "appointment", scheduledAt: "not a date" },
      { id: "z", kind: "appointment", scheduledAt: "2026-07-01T12:00:00Z", client: null, status: "scheduled" },
      { id: "w", kind: "visit", scheduledAt: new Date("2026-07-02T12:00:00Z"), jobId: null, title: null, client: { name: "  " } },
    ],
    full: { role: "employee", permissions: { ...crewValues } },
    company: { name: "X", timezone: "Nowhere/Nope", defaultLanguage: "xx" },
    origin: "https://x.test///",
    now: NOW,
  });
  ok("rows without a usable date are dropped, the rest survive", events.length === 2 && events[0].uid === "appt-z@fieldquo" && events[1].uid === "visit-w@fieldquo");
  ok("an unknown language falls back to English", events[0].summary === "Appointment" && events[1].summary === "Job visit");
  ok("a trailing slash on the origin does not double up", events[0].description.startsWith("Open in FieldQuo: https://x.test/app/appointments?day="));
  const ics = buildFeedCalendar({ events, company: { name: "X", timezone: "Nowhere/Nope" }, from: NOW, to: NOW });
  ok("the calendar still builds, on the default zone", ics.includes("TZID:America/Toronto") && ics.endsWith("END:VCALENDAR\r\n"));
  const escaped = buildFeedCalendar({ events: feedEventsFor({ entries: [{ id: "e", kind: "appointment", scheduledAt: NOW, client: { name: "Smith; Jones, Ltd\\" }, status: "scheduled" }], full: {}, company: {}, origin: "", now: NOW }), company: {}, from: NOW, to: NOW });
  ok("semicolons, commas and backslashes are escaped in SUMMARY", escaped.includes("SUMMARY:Appointment — Smith\\; Jones\\, Ltd\\\\"));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n13. The nine-language copy table\n");

const LANGS = Object.keys(APP_MESSAGES);
ok(`the table carries the app's languages (${LANGS.join(", ")})`, LANGS.every((l) => FEED_COPY_LANGS.includes(l)) && FEED_COPY_LANGS.length === LANGS.length);
for (const lang of FEED_COPY_LANGS) {
  const missing = FEED_COPY_KEYS.filter((k) => typeof FEED_COPY[lang][k] !== "string" || !FEED_COPY[lang][k].trim());
  const extra = Object.keys(FEED_COPY[lang]).filter((k) => !FEED_COPY_KEYS.includes(k));
  ok(`${lang}: every key, no extra`, missing.length === 0 && extra.length === 0, [...missing, ...extra].join(", "));
}
const echoed = FEED_COPY_LANGS.filter((l) => l !== "en").filter((l) => FEED_COPY_KEYS.filter((k) => FEED_COPY[l][k] === FEED_COPY.en[k]).length > 2);
ok("no language is an English echo (at most two shared spellings)", echoed.length === 0, echoed.join(", "));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n14. The screen, the row, the catalogue and the guide\n");

const sidebar = read("app/components/layout/SettingsSidebar.js");
ok("the sidebar has the My calendar row", /key: "app\.settings\.myCalendar", href: "\/app\/settings\/my-calendar"/.test(sidebar));
ok("…with a helpArticle", /key: "app\.settings\.myCalendar"[^\n]*helpArticle: "settings-my-calendar"/.test(sidebar));
ok("the page exists and is a thin shell mounting SubscribeFeedSection", existsSync(join(ROOT, "app/app/settings/my-calendar/page.js")) && read("app/app/settings/my-calendar/page.js").includes("<SubscribeFeedSection />") && read("app/app/settings/my-calendar/page.js").includes("BackToHome"));
ok("the section is its own file", existsSync(join(ROOT, "app/components/calendar/SubscribeFeedSection.js")));
{
  const section = read("app/components/calendar/SubscribeFeedSection.js");
  ok("the section offers the three subscribe surfaces and the raw link", section.includes("urls.google") && section.includes("urls.webcal") && section.includes("urls.outlook") && section.includes("urls.https"));
  ok("…confirms before regenerating", section.includes("app.myCalendar.regenerateConfirm") && section.includes('action: "rotate"'));
  ok("…and says how often each calendar re-reads", section.includes("app.myCalendar.refreshNote"));
}
ok("every member may see the row (capability «everyone»)", SETTINGS_ROW_CAPABILITY["app.settings.myCalendar"] === "everyone");
ok("…executed: a crew member's sidebar keeps it", canSeeSettingsRow({ role: "employee", impersonation: false }, "app.settings.myCalendar", { role: "employee", permissions: { ...crewValues } }));
ok("the app-guide screens list carries the row", SCREENS.some((s) => s.nav === "app.settings.myCalendar" && s.href === "/app/settings/my-calendar" && s.slug === "settings-my-calendar"));
ok("…and its fixture answers GET /api/calendar/feed", read("docs/screens/app-guide/harness/fixtures/routes-settings-a.js").includes('path: "/api/calendar/feed"') && read("docs/screens/app-guide/harness/fixtures/routes-settings-a.js").includes('"settings-my-calendar"'));
ok("the appPages catalogue lists the page under its navKey", APP_PAGES.some((p) => p.href === "/app/settings/my-calendar" && p.navKey === "app.settings.myCalendar"));
for (const lang of LANGS) {
  const need = ["app.settings.myCalendar", "app.myCalendar.title", "app.myCalendar.google", "app.myCalendar.regenerateConfirm", "app.mySchedule.subscribeLink", "app.activity.event.calendarFeedRotated"];
  const missing = need.filter((k) => typeof APP_MESSAGES[lang][k] !== "string");
  ok(`${lang}: the page's keys are in the catalogue`, missing.length === 0, missing.join(", "));
}
ok("My schedule links to the page beside Add to calendar", /href="\/app\/settings\/my-calendar"/.test(read("app/app/me/schedule/page.js")) && read("app/app/me/schedule/page.js").includes("app.mySchedule.subscribeLink"));
ok("the help tree has the article on this screen", /A\("settings-my-calendar", "My calendar", \{ screen: "settings-my-calendar"/.test(read("lib/help/tree.js")));
ok("package.json runs this check in check:all", /check:all[^\n]*npm run check:calendar-feed/.test(read("package.json")));
ok("the visit and booking entries carry updatedAt", /updatedAt: visit\.updatedAt/.test(read("lib/schedule/jobVisits.js")) && /updatedAt: booking\.updatedAt/.test(read("lib/schedule/jobVisits.js")));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n15. Deferred work, reported not failed\n");
//
// The booking-modes label helper (lib/booking) is being written elsewhere;
// until it lands the feed reads Booking.mode words directly. The marker is
// what the next reader greps for, and this line is what keeps it from being
// forgotten without turning a known deferral into a red build.
if (/TODO\(booking-modes\)/.test(read("lib/calendar/feed.js"))) {
  warn("lib/calendar/feed.js still carries TODO(booking-modes): swap in the mode label helper from lib/booking once it lands");
} else {
  ok("the booking-modes TODO has been resolved", true);
}

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s), ${warnings.length} warning(s).\n`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exitCode = 1;
}
