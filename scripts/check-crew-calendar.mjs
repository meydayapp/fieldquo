// scripts/check-crew-calendar.mjs
//
//   npm run check:crew-calendar
//
// A Crew member's calendar shows their own work. It does not show the client
// list through the side.
//
// ══ What was wrong ═════════════════════════════════════════════════════════
//
// GET /api/appointments merges three sources — Appointment, JobVisit and
// Booking — and narrowed all three with one filter: ownScheduleFilter(), whose
// `includeUnassigned` defaults to true. That default is right for an
// APPOINTMENT ("an unclaimed job nobody can see is a job nobody does", and the
// row is a time plus a client the caller may already read). It was wrong twice
// over on the other two:
//
//   * toCalendarEntry carries the JOB's title, the client's NAME and the SITE
//     ADDRESS. So an unassigned visit on a job the crew member is not on put
//     that homeowner's address on their calendar — while GET /api/jobs/[id]
//     answered 404 for the very same job. The whole point of assignedJobWhere
//     is that a job you are not on does not exist for you; the calendar was
//     handing over its contents one table across.
//
//   * EventType.userId is NULL for a company-wide booking type — the public
//     /book page. "Unassigned" there does not mean spare work waiting to be
//     claimed, it means every booking the company has ever taken through its
//     own front door, each with a stranger's name and street address on it.
//     And there is nothing to claim: a Booking id would 404 against
//     /api/appointments/[id].
//
// The fix is one rule per source, and the visit rule REUSES assignedJobWhere
// rather than writing a second definition of "their job" — two definitions is
// how the calendar and the job board come to disagree about which jobs exist.
//
// ══ Why this file executes rather than reads ═══════════════════════════════
//
// Because the bug was never in the fragment. ownScheduleFilter said exactly
// what it meant and check-schedule-union.mjs proved the route called it three
// times; what leaked was WHICH rows came back when that fragment met the visit
// table. Only a query answers that, so the real GET and PATCH handlers are
// imported and called against a scripted database — the technique
// scripts/check-crew-access.mjs section 10 uses on the job routes, with `OR`
// added to the where-evaluator because the new visit scope is one.
//
// Verified by mutation when it was written; every assertion below was watched
// to FAIL with the fix removed. See the report in the commit for the list.
import { PERMISSION_PRESETS, PRESET_TO_ROLE, can } from "@/lib/permissions";
import { ownScheduleFilter, canSeeTeamSchedule } from "@/lib/schedule/teamScope";
import {
  assignedJobWhere,
  seesOnlyAssignedJobs,
  hasLevel,
} from "@/lib/permissions/enforce";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];
const ok = (label, condition) => {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. The people this check is about\n");
//
// Asserted rather than assumed. If Crew stops holding view_complete_own, or
// Dispatcher stops holding edit_all, every scoping assertion below silently
// becomes a test of nothing — both members would land on the same side of the
// filter and agree for the wrong reason.

const crewValues = PERMISSION_PRESETS.worker.values;
const dispValues = PERMISSION_PRESETS.dispatcher.values;
const estValues = PERMISSION_PRESETS.estimator.values;

ok('the Crew preset is still called "Crew"', PERMISSION_PRESETS.worker.label === "Crew");
ok("Crew see their OWN schedule", crewValues.schedule === "view_complete_own");
ok("…and only the client's name and address", crewValues.clientsProperties === "name_address_only");
ok("…on the role that carries no assign permission", PRESET_TO_ROLE.worker === "employee");
ok(
  "…which is what makes them scoped to the jobs they are on",
  seesOnlyAssignedJobs({ role: "employee", permissions: crewValues, userId: "u_crew" }),
);
ok("a Dispatcher sees EVERYONE's schedule", dispValues.schedule === "edit_all");
ok("…as a supervisor", PRESET_TO_ROLE.dispatcher === "supervisor");
ok(
  "…and may assign an appointment, which Crew may not",
  can("supervisor", "appointment:assign") && !can("employee", "appointment:assign"),
);
// The third member exists to prove the two halves of the visit rule are
// genuinely independent. An Estimator is scoped on the SCHEDULE and unscoped
// on JOBS — they keep the whole board because the job their quote became is
// usually not one they have a visit on.
ok("an Estimator is scoped on the schedule too", estValues.schedule === "view_complete_own");
ok(
  "…but is NOT confined to the jobs they are on",
  !seesOnlyAssignedJobs({ role: "employee", permissions: estValues, userId: "u_est" }),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. The fragments, before any query runs\n");
//
// The route composes two shared builders. This section pins what each one
// hands it, so a failure in section 3 can be read as "the route composed them
// wrongly" rather than "one of them changed underneath".

const crew = { role: "employee", permissions: crewValues, userId: "u_crew" };
const disp = { role: "supervisor", permissions: dispValues, userId: "u_disp" };
const est = { role: "employee", permissions: estValues, userId: "u_est" };

const crewOwn = ownScheduleFilter(crew, "u_crew", {
  field: "assignedToId",
  includeUnassigned: false,
});
ok(
  "includeUnassigned:false narrows to the caller alone — no `OR`",
  crewOwn.assignedToId === "u_crew" && crewOwn.OR === undefined,
);
ok(
  "…while the default still carries the unassigned arm, for appointments",
  Array.isArray(ownScheduleFilter(crew, "u_crew", { field: "assignedToId" }).OR),
);
ok(
  "a member who sees everyone's schedule gets {} either way",
  Object.keys(ownScheduleFilter(disp, "u_disp", { field: "assignedToId" })).length === 0 &&
    Object.keys(
      ownScheduleFilter(disp, "u_disp", {
        field: "assignedToId",
        includeUnassigned: false,
      }),
    ).length === 0,
);
ok(
  "assignedJobWhere still means 'has a visit assigned to me'",
  assignedJobWhere(crew)?.visits?.some?.assignedToId === "u_crew",
);
ok(
  "…and is a no-op for someone who sees the whole board",
  Object.keys(assignedJobWhere(est)).length === 0,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. GET /api/appointments, EXECUTED against a scripted database\n");

const { register } = await import("node:module");

globalThis.__FQ_ROWS = { member: [], appointment: [], jobVisit: [], booking: [] };

// Relation keys on the fixtures, so the projection drops what Prisma drops.
const RELATIONS = new Set([
  "client",
  "assignedTo",
  "booking",
  "job",
  "visits",
  "eventType",
  "user",
]);

/**
 * A small Prisma `where` evaluator: scalars, null, `in`, `not`, `some`,
 * to-one relation filters, compound unique keys — and `OR`.
 *
 * `OR` is the one that had to be added for this check. The visit scope is
 * "mine, or unassigned on a job that is mine", which cannot be expressed
 * without it, and a stub that ignored an unknown key would answer TRUE for
 * every row and pass this whole file on a route with no scoping at all.
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
    // findUnique on a compound key: `{ userId_companyId: { userId, companyId } }`
    // names no column of its own, so it matches against the row itself.
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
        if (!Array.isArray(value) || !value.some((v) => matchWhere(v, cond.some)))
          return false;
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

/** `select` builds up, `include` starts from the row — same as Prisma. */
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
      return all()
        .filter((r) => matchWhere(r, args.where))
        .map((r) => projectRow(r, args));
    },
    async findFirst(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? projectRow(hit, args) : null;
    },
    async findUnique(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? projectRow(hit, args) : null;
    },
    // Writes are applied to the fixture, not swallowed. A PATCH assertion that
    // only reads the response would pass on a handler that returned the right
    // object and wrote nothing.
    async update(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      if (!hit) throw new Error(`dbStub: no ${name} row to update`);
      Object.assign(hit, args.data);
      return projectRow(hit, args);
    },
  };
}

globalThis.__FQ_DB = new Proxy(
  {
    member: stubModel("member"),
    appointment: stubModel("appointment"),
    jobVisit: stubModel("jobVisit"),
    booking: stubModel("booking"),
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Loud, not quiet: a check must never pass because a query it did not
      // model answered "nothing".
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
    return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const calendar = await import("@/app/api/appointments/route.js");
const appointment = await import("@/app/api/appointments/[id]/route.js");

// ── The fixtures ───────────────────────────────────────────────────────────
//
// Two jobs, and the distinction the whole file turns on lives inside them:
// each carries one visit with a name on it and one with nobody on it. The
// unassigned visit on the crew member's OWN job is theirs to pick up. The
// unassigned visit on the other job is a stranger's address.
//
// The client rows are deliberately fat — phone, notes, portal token — because
// what must NOT come back matters as much as what must.

const STRANGER_ADDRESS = "9 Oak Ave";
const STRANGER_NAME = "Bea Nowak";
const WALKIN_ADDRESS = "412 Rue Sainte-Catherine";
const WALKIN_NAME = "Ms Okafor";

const myClient = {
  id: "c_mine",
  name: "Ana Ruiz",
  address: "14 Elm St",
  email: "ana@example.com",
  phone: "+15145550100",
  notes: "Gate code 4417.",
  portalToken: "tok_ana",
};
const strangerClient = {
  id: "c_theirs",
  name: STRANGER_NAME,
  address: STRANGER_ADDRESS,
  email: "bea@example.com",
  phone: "+15145550199",
  notes: "Rear entrance only.",
  portalToken: "tok_bea",
};

const jobRef = (id, title, client, visits, archivedAt = null) => ({
  id,
  companyId: "co",
  archivedAt,
  title,
  client,
  // What `job: { visits: { some: { assignedToId } } }` reads. Kept to the one
  // column the filter names so a fixture visit can't recurse into its own job.
  visits,
});

const MY_JOB = jobRef("job_mine", "Repaint 14 Elm St", myClient, [
  { assignedToId: "u_crew" },
]);
const THEIR_JOB = jobRef("job_theirs", "Deck stain, 9 Oak Ave", strangerClient, [
  { assignedToId: "u_other" },
  { assignedToId: null },
]);
const ARCHIVED_JOB = jobRef(
  "job_archived",
  "Old fence, cancelled",
  myClient,
  [{ assignedToId: "u_crew" }],
  new Date("2026-07-01"),
);

const visitRow = (id, job, assignedToId, name) => ({
  id,
  jobId: job.id,
  scheduledAt: new Date("2026-08-25T13:00:00Z"),
  status: "scheduled",
  notes: null,
  assignedToId,
  assignedTo: assignedToId ? { id: assignedToId, name } : null,
  job,
});

globalThis.__FQ_ROWS.jobVisit = [
  visitRow("v_mine", MY_JOB, "u_crew", "Dani"),
  // Unassigned, on the job they ARE on. Theirs to pick up.
  visitRow("v_open", MY_JOB, null, null),
  visitRow("v_theirs", THEIR_JOB, "u_other", "Sam"),
  // Unassigned, on a job they are NOT on. The leak.
  visitRow("v_stranger", THEIR_JOB, null, null),
  // Assigned to them, on an ARCHIVED job. Excluded for everyone — asserted so
  // the new OR cannot quietly drop the archive rule on its way past.
  visitRow("v_archived", ARCHIVED_JOB, "u_crew", "Dani"),
];

const apptRow = (id, assignedToId, name, client, extra = {}) => ({
  id,
  companyId: "co",
  clientId: client.id,
  scheduledAt: new Date("2026-08-26T09:00:00Z"),
  location: client.address,
  status: "scheduled",
  requiresSupervisor: false,
  createdById: "u_disp",
  assignedToId,
  assignedTo: assignedToId ? { id: assignedToId, name } : null,
  client,
  booking: null,
  ...extra,
});

globalThis.__FQ_ROWS.appointment = [
  apptRow("a_mine", "u_crew", "Dani", myClient),
  apptRow("a_theirs", "u_other", "Sam", strangerClient),
  // Unassigned. STAYS on everyone's calendar — the behaviour this change
  // deliberately does not touch.
  apptRow("a_open", null, null, myClient),
  // Unassigned AND supervisor-required. Nobody without appointment:assign can
  // take it, which is why the UI withholds the claim button on one.
  apptRow("a_super", null, null, myClient, { requiresSupervisor: true }),
];

const bookingRow = (id, ownerId, ownerName, clientName, address) => ({
  id,
  appointmentId: null,
  status: "confirmed",
  startTime: new Date("2026-08-27T14:00:00Z"),
  endTime: new Date("2026-08-27T15:00:00Z"),
  clientName,
  address,
  mode: "visit",
  latitude: null,
  longitude: null,
  eventType: {
    companyId: "co",
    name: ownerId ? "Estimate visit" : "Free estimate",
    userId: ownerId,
    user: ownerId ? { id: ownerId, name: ownerName } : null,
  },
});

globalThis.__FQ_ROWS.booking = [
  bookingRow("bk_mine", "u_crew", "Dani", "Mr Lalonde", "77 Pine Rd"),
  bookingRow("bk_theirs", "u_other", "Sam", "Mrs Tran", "3 Cedar Cres"),
  // The company-wide booking type: EventType.userId is null. Anyone in the
  // city can fill this page in, and every one of them landed on every scoped
  // member's calendar.
  bookingRow("bk_company", null, null, WALKIN_NAME, WALKIN_ADDRESS),
];

const memberRow = (id, userId, role, permissions) => ({
  id,
  userId,
  companyId: "co",
  role,
  permissions,
});

globalThis.__FQ_ROWS.member = [
  memberRow("m_crew", "u_crew", "employee", { ...crewValues }),
  memberRow("m_disp", "u_disp", "supervisor", { ...dispValues }),
  memberRow("m_est", "u_est", "employee", { ...estValues }),
  memberRow("m_other", "u_other", "employee", { ...crewValues }),
];

const asMember = (id) => {
  const row = globalThis.__FQ_ROWS.member.find((m) => m.id === id);
  // The shape getCurrentMember returns: no `permissions`, which is exactly why
  // loadEnforceableMember exists and why the grid is re-read per route.
  globalThis.__FQ_SESSION = {
    id: row.id,
    userId: row.userId,
    companyId: row.companyId,
    role: row.role,
  };
};

const req = (body) => ({
  url: "http://local/api/appointments",
  json: async () => body || {},
});
const ctx = (id) => ({ params: Promise.resolve({ id }) });
const idsOf = (res) => res.body.map((e) => e.id);

asMember("m_crew");
const crewFeed = await calendar.GET(req());
const crewIds = idsOf(crewFeed);

ok("the calendar answers Crew at all (200)", crewFeed.status === 200);

console.log("\n  — visits —");
ok("their own visit is on it", crewIds.includes("v_mine"));
ok(
  "an UNASSIGNED visit on a job they ARE on is on it — theirs to pick up",
  crewIds.includes("v_open"),
);
ok(
  "an unassigned visit on a job they are NOT on is gone",
  !crewIds.includes("v_stranger"),
);
ok("a colleague's visit was never there", !crewIds.includes("v_theirs"));
ok(
  "an archived job's visit stays off, new filter or not",
  !crewIds.includes("v_archived"),
);

console.log("\n  — bookings —");
ok("a booking through their own page is on it", crewIds.includes("bk_mine"));
ok(
  "a COMPANY-WIDE booking is gone — it is not crew work and cannot be claimed",
  !crewIds.includes("bk_company"),
);
ok("a colleague's booking was never there", !crewIds.includes("bk_theirs"));

console.log("\n  — appointments, deliberately unchanged —");
ok("their own appointment is on it", crewIds.includes("a_mine"));
ok(
  "an UNASSIGNED appointment is still on it — an unclaimed job nobody can see is a job nobody does",
  crewIds.includes("a_open") && crewIds.includes("a_super"),
);
ok("a colleague's appointment is not", !crewIds.includes("a_theirs"));

console.log("\n  — the payload itself —");
//
// The id assertions above say which ROWS came back. This says what came back
// ON them, because the leak was never the id: it was the title, the name and
// the street address a crew member is confined away from. Walking the whole
// response catches a future entry shape that carries the same fact under a
// key nobody thought to grep for.
const SECRETS = [STRANGER_ADDRESS, STRANGER_NAME, WALKIN_ADDRESS, WALKIN_NAME];
function leaksIn(value, path = "") {
  const found = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => found.push(...leaksIn(v, `${path}[${i}]`)));
    return found;
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    for (const [key, v] of Object.entries(value)) {
      found.push(...leaksIn(v, path ? `${path}.${key}` : key));
    }
    return found;
  }
  if (typeof value === "string" && SECRETS.some((s) => value.includes(s))) {
    found.push(`${path} (${value})`);
  }
  return found;
}
const leaked = leaksIn(crewFeed.body);
ok(
  `no stranger's name or address anywhere in the response${leaked.length ? `: ${leaked.join(", ")}` : ""}`,
  leaked.length === 0,
);
// The rows they DO get are still redacted to name and address — the
// restriction that was already here, asserted where a regression would show.
const mineEntry = crewFeed.body.find((e) => e.id === "a_mine");
ok(
  "the client on their own appointment is name-and-address only, marked restricted",
  mineEntry?.client?.name === "Ana Ruiz" &&
    mineEntry.client.phone === undefined &&
    mineEntry.client.notes === undefined &&
    mineEntry.client.portalToken === undefined &&
    mineEntry.client.restricted === true,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. Nobody who could see more sees less\n");
//
// The narrowing has to be provably invisible to the people it was never
// about. A scope change that quietly costs a dispatcher half their week is a
// worse bug than the leak it fixes, and it is the one nobody reports for a
// fortnight.

asMember("m_disp");
const dispFeed = await calendar.GET(req());
const dispIds = idsOf(dispFeed);

ok("a Dispatcher still gets every appointment", ["a_mine", "a_theirs", "a_open", "a_super"].every((id) => dispIds.includes(id)));
ok(
  "…every visit on a live job, assigned or not",
  ["v_mine", "v_open", "v_theirs", "v_stranger"].every((id) => dispIds.includes(id)),
);
ok("…including the company-wide booking", dispIds.includes("bk_company"));
ok("…and every other booking", dispIds.includes("bk_mine") && dispIds.includes("bk_theirs"));
ok(
  "…which is the whole calendar minus the archived job, and nothing else",
  dispIds.length === 11 && !dispIds.includes("v_archived"),
);
ok(
  "…and the gate they pass is the one the team list uses, unchanged",
  canSeeTeamSchedule({ role: "supervisor", permissions: dispValues }) &&
    hasLevel({ role: "supervisor", permissions: dispValues }, "schedule", "edit_all"),
);

// The Estimator proves the two halves are independent rather than one rule
// wearing two hats: scoped on the schedule, unscoped on jobs.
asMember("m_est");
const estIds = idsOf(await calendar.GET(req()));
ok(
  "an Estimator — scoped schedule, whole job board — keeps BOTH unassigned visits",
  estIds.includes("v_open") && estIds.includes("v_stranger"),
);
ok(
  "…because the address is on a job they can already open, not because the filter missed",
  !estIds.includes("v_mine") && !estIds.includes("v_theirs"),
);
ok(
  "…and the company-wide booking is still not theirs",
  !estIds.includes("bk_company"),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. PATCH: what an employee may actually change\n");
//
// ── The comment and the code disagreed, and the code was wrong ────────────
//
// The gate read "requires appointment:assign, unless someone is unassigning
// themselves" — and refused exactly that: for `{ assignedToId: null }` on your
// own row, `null !== existing.assignedToId` and `null !== member.userId` both
// hold, so an employee dropping off a job got a 403.
//
// Two comments said otherwise, independently. The DELETE handler's argument
// for having no self-delete is "a worker who wants off a job unassigns
// themselves, which PATCH already allows" — a justification that was simply
// false, leaving a worker no way off a job at all. So the CODE was fixed, and
// this section is the permission assertion that comes with a permission
// change.

asMember("m_crew");

const claimed = await appointment.PATCH(req({ assignedToId: "u_crew" }), ctx("a_open"));
ok("Crew may claim an unassigned appointment (200)", claimed.status === 200);
ok("…and the row really carries their name now", claimed.body?.assignedToId === "u_crew");

const released = await appointment.PATCH(req({ assignedToId: null }), ctx("a_open"));
ok("…and may then drop it again (200)", released.status === 200);
ok("…leaving it unassigned rather than untouched", released.body?.assignedToId === null);

const releasedOwn = await appointment.PATCH(req({ assignedToId: null }), ctx("a_mine"));
ok(
  "Crew may unassign THEMSELVES from an appointment that was given to them",
  releasedOwn.status === 200 && releasedOwn.body?.assignedToId === null,
);
// Same act written the way a <select> writes it. The update stores
// `body.assignedToId || null`, so the gate has to treat "" as the same
// release — otherwise one of the two forms slips past and the other is refused.
globalThis.__FQ_ROWS.appointment.find((a) => a.id === "a_mine").assignedToId = "u_crew";
const releasedEmpty = await appointment.PATCH(req({ assignedToId: "" }), ctx("a_mine"));
ok(
  '…whether the browser sends null or ""',
  releasedEmpty.status === 200 && releasedEmpty.body?.assignedToId === null,
);

// The refusals, which is what keeps the exception narrow.
globalThis.__FQ_ROWS.appointment.find((a) => a.id === "a_mine").assignedToId = "u_crew";
const handedOn = await appointment.PATCH(req({ assignedToId: "u_other" }), ctx("a_mine"));
ok(
  "…but may NOT hand their own appointment to a colleague",
  handedOn.status === 403,
);
const tookTheirs = await appointment.PATCH(
  req({ assignedToId: null }),
  ctx("a_theirs"),
);
ok("…nor unassign somebody ELSE from theirs", tookTheirs.status === 403);
const claimedSupervisor = await appointment.PATCH(
  req({ assignedToId: "u_crew" }),
  ctx("a_super"),
);
ok(
  "…nor take a supervisor-required appointment, which is why no claim button is offered on one",
  claimedSupervisor.status === 400,
);

asMember("m_disp");
const reassigned = await appointment.PATCH(
  req({ assignedToId: "u_crew" }),
  ctx("a_theirs"),
);
ok(
  "a Dispatcher reassigns freely, exactly as before",
  reassigned.status === 200 && reassigned.body?.assignedToId === "u_crew",
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. The screen offers what the server accepts\n");
//
// ── Why this section reads instead of running ─────────────────────────────
//
// Everything above executes. This does not: the calendar is a client
// component whose branch depends on three React hooks (useTranslation,
// usePermissions, useSession), so running it means a bundler, a renderer and
// three stubbed providers — and what would then be asserted is the render of
// a mock, not the shipped screen. The scoping bugs lived in queries and are
// executed above; what is left here is a rendering CONDITION, and reading the
// condition is a fair test of a condition.
//
// The row used to render a select of the whole team for everyone. PATCH
// accepts exactly one assignment from an employee — their own name on an
// unassigned row — so every other option in that list produced an error toast.

const CAL = readFileSync(join(ROOT, "app/app/appointments/page.js"), "utf8");

ok(
  "the page asks the SAME question the server asks — the coarse permission",
  /can\((?:caller\?\.role|[A-Za-z.?]*role), *"appointment:assign"\)/.test(CAL),
);
ok(
  "…and the assignee select is behind it",
  /\) : canAssign \? \(/.test(CAL),
);
ok(
  "…with the claim button posting the caller's OWN id, never a chosen one",
  /onClick=\{\(\) => assign\(appt\.id, myUserId\)\}/.test(CAL),
);
ok(
  "…offered only on an unassigned row",
  /!appt\.assignedToId && !appt\.requiresSupervisor && myUserId/.test(CAL),
);
ok(
  "…and an assigned one reads as a name, the way a visit already does",
  (CAL.match(/\{appt\.assignedTo\?\.name \|\| t\("app\.appts\.unassigned"\)\}/g) || [])
    .length === 2,
);
// Every user-visible string on this page goes through t(). A new key that is
// not in the catalogue yet must carry its English text as the fallback
// argument, or a French screen renders the raw key.
ok(
  "the new control's label is translatable and carries an English fallback",
  /t\("app\.appts\.assignToMe", *"Assign to me"\)/.test(CAL),
);

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exitCode = 1;
}
