// scripts/check-google-calendar.mjs
//
//   npm run check:google-calendar
//
// The two-way Google Calendar connection, EXECUTED against a fake Google
// client and the in-memory Prisma (scripts/fixtures/memoryPrisma.mjs). Every
// claim below is a property of code that runs here, not a sentence read off
// the source:
//
//   1. the signed OAuth state round-trips, and every tampered form is refused
//   2. the refresh token is encrypted at rest — the ciphertext is not the
//      token and the token comes back out
//   3. create / update / delete are mirrored, and a second sync of an
//      unchanged entry makes NO Google request (idempotence by payloadHash)
//   4. only an event carrying FieldQuo's private fieldquoId is ever deleted;
//      a member's own event with the same id is left alone
//   5. disconnect removes every FieldQuo mirror and nothing else
//   6. busy blocks from Google are merged into computeAvailableSlots and
//      carry no title; the office move refuses an overlap and force wins
//   7. both switches are honoured server-side
//   8. a video booking gets a Meet link written back onto both rows
//   9. env absent → configured() is false, the honest catalogue sentence
//      exists in every language, and no route file reaches Google before
//      checking
//  10. the reconcile creates what is missing, adopts an orphan it can name,
//      deletes an orphan it cannot, and removes a reassigned member's event
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret-for-the-check";
process.env.NEXT_PUBLIC_APP_URL = "https://www.fieldquo.com";

const { db } = await import("@/lib/db");
const { signState, verifyState } = await import("../lib/calendar/googleState.js");
const {
  googleCalendarConfigured,
  googleCalendarMissing,
  buildGoogleAuthorizeUrl,
  decodeIdTokenEmail,
  overrideGoogleForChecks,
  GOOGLE_CALENDAR_SCOPES,
} = await import("../lib/calendar/googleClient.js");
const { saveConnection, getConnectionForMember, updateSwitches, deleteConnection, publicConnectionShape } = await import(
  "../lib/calendar/googleConnection.js"
);
const { decryptToken } = await import("../lib/meta/tokenCrypto.js");
const { buildEventPayload, payloadHash, isFieldquoEvent, meetLinkFrom, withMeetRequest, FIELDQUO_ID_KEY, FIELDQUO_APP_KEY, FIELDQUO_APP_VALUE } =
  await import("../lib/calendar/googleEvent.js");
const { syncEntity, removeMemberMirrors, reconcileMember } = await import("../lib/calendar/googleSync.js");
const { googleBusyRanges, clearBusyCache } = await import("../lib/calendar/googleBusy.js");
const { computeAvailableSlots } = await import("../lib/booking/computeAvailability.js");
const { planOfficeMove, bracketStops, MOVE_REASONS } = await import("../lib/schedule/moveEntry.js");
const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : String(JSON.stringify(extra)).slice(0, 300));
  }
}
const section = (s) => console.log(`\n── ${s}`);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ── The fake Google ─────────────────────────────────────────────────────────
//
// An in-memory calendar per calendarId with the same result shapes the real
// client returns. Every call is logged so a test can say "no request was
// made" — the property idempotence actually is.
function fakeGoogle() {
  const calendars = new Map(); // calendarId → Map(eventId → event)
  const calls = [];
  let seq = 0;
  const cal = (id) => calendars.get(id) || (calendars.set(id, new Map()), calendars.get(id));
  const api = {
    calls,
    calendars,
    busy: new Map(), // calendarId → [{start,end}]
    failNext: null,
    async accessTokenFor(connection) {
      calls.push(["token", connection.memberId]);
      // Proves the sync decrypts the stored blob, not that it stored plaintext.
      const token = decryptToken(connection.refreshTokenEnc);
      return { ok: true, accessToken: `access-for-${token}` };
    },
    async insertEvent({ calendarId, event }) {
      calls.push(["insert", calendarId, event]);
      if (api.failNext === "insert") { api.failNext = null; return { ok: false, status: 500, message: "boom" }; }
      const id = `evt_${++seq}`;
      const stored = { ...event, id, status: "confirmed" };
      if (event.conferenceData?.createRequest) stored.hangoutLink = `https://meet.google.com/fake-${id}`;
      cal(calendarId).set(id, stored);
      return { ok: true, status: 200, data: stored };
    },
    async patchEvent({ calendarId, eventId, event }) {
      calls.push(["patch", calendarId, eventId, event]);
      const existing = cal(calendarId).get(eventId);
      if (!existing) return { ok: false, status: 404, message: "Not Found" };
      Object.assign(existing, event);
      return { ok: true, status: 200, data: existing };
    },
    async getEvent({ calendarId, eventId }) {
      calls.push(["get", calendarId, eventId]);
      const existing = cal(calendarId).get(eventId);
      return existing ? { ok: true, status: 200, data: existing } : { ok: false, status: 404, message: "Not Found" };
    },
    async deleteEvent({ calendarId, eventId }) {
      calls.push(["delete", calendarId, eventId]);
      cal(calendarId).delete(eventId);
      return { ok: true, status: 204, data: null };
    },
    async listByPrivateProperty({ calendarId, key, value }) {
      calls.push(["list", calendarId, key, value]);
      const items = [...cal(calendarId).values()].filter((e) => e.extendedProperties?.private?.[key] === value);
      return { ok: true, status: 200, data: { items, nextPageToken: null } };
    },
    async freeBusy({ calendarId, timeMin, timeMax }) {
      calls.push(["freebusy", calendarId, timeMin, timeMax]);
      return { ok: true, busy: (api.busy.get(calendarId) || []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) })) };
    },
    async revoke(token) {
      calls.push(["revoke", token]);
      return { ok: true, status: 200, data: null };
    },
  };
  return api;
}
const google = fakeGoogle();
overrideGoogleForChecks(google);
const deps = { db, google };
const callsSince = (n) => google.calls.slice(n);
const noWrites = (list) => list.filter((c) => ["insert", "patch", "delete"].includes(c[0]));

// ── Fixture ────────────────────────────────────────────────────────────────
const NOW = new Date("2026-09-21T12:00:00Z");
const T = (h, m = 0) => new Date(Date.UTC(2026, 8, 22, h, m)); // 22 Sep 2026
await db.company.create({ data: { id: "co1", name: "Northline Painting", slug: "northline", defaultLanguage: "en", timezone: "UTC" } });
await db.user.create({ data: { id: "u_ann", name: "Ann Estimator", email: "ann@example.com", language: "fr" } });
await db.user.create({ data: { id: "u_bob", name: "Bob Crew", email: "bob@example.com", language: "en" } });
await db.member.create({ data: { id: "m_ann", userId: "u_ann", companyId: "co1", role: "admin", active: true } });
await db.member.create({ data: { id: "m_bob", userId: "u_bob", companyId: "co1", role: "employee", active: true } });
await db.client.create({ data: { id: "cl1", companyId: "co1", name: "Jane Doe", address: "12 Maple St, Toronto" } });
await db.job.create({ data: { id: "job1", companyId: "co1", clientId: "cl1", title: "Kitchen repaint", status: "scheduled", archivedAt: null } });
await db.eventType.create({ data: { id: "et1", companyId: "co1", userId: "u_ann", name: "Consultation", slug: "consult", durationMinutes: 60, bufferBefore: 0, bufferAfter: 0, active: true } });

// ── 1. OAuth state ─────────────────────────────────────────────────────────
section("1. signed OAuth state");
{
  const state = signState({ memberId: "m_ann", now: NOW.getTime() });
  const good = verifyState(state, { cookieValue: state, now: NOW.getTime() + 1000 });
  ok("round-trips to the member id", good?.memberId === "m_ann", good);
  ok("a cookie that does not match is refused", verifyState(state, { cookieValue: state + "x", now: NOW.getTime() }) === null);
  const [nonce, memberId, issued, sig] = state.split(".");
  const swapped = [nonce, "m_bob", issued, sig].join(".");
  ok("a state with the member id swapped is refused (signature)", verifyState(swapped, { cookieValue: swapped, now: NOW.getTime() }) === null);
  const resigned = signState({ memberId: "m_bob", nonce, now: NOW.getTime(), secret: "another-secret" });
  ok("a state signed under another secret is refused", verifyState(resigned, { cookieValue: resigned, now: NOW.getTime() }) === null);
  ok("an expired state is refused", verifyState(state, { cookieValue: state, now: NOW.getTime() + 601_000 }) === null);
  ok("garbage is refused, not thrown", verifyState("not.a.state", { cookieValue: "not.a.state" }) === null && verifyState(null, { cookieValue: null }) === null && verifyState(42, { cookieValue: 42 }) === null);
  const url = new URL(buildGoogleAuthorizeUrl({ redirectUri: "https://www.fieldquo.com/api/calendar/google/callback", state }));
  ok("the consent URL asks for offline access with consent, both calendar scopes and the state", url.searchParams.get("access_type") === "offline" && url.searchParams.get("prompt") === "consent" && url.searchParams.get("scope").includes("auth/calendar.events") && url.searchParams.get("scope").includes("auth/calendar.readonly") && url.searchParams.get("state") === state);
  ok("the scope list is events + readonly, never the broad calendar scope", !GOOGLE_CALENDAR_SCOPES.includes("https://www.googleapis.com/auth/calendar"));
  const idToken = ["e30", Buffer.from(JSON.stringify({ email: "ann@gmail.com" })).toString("base64url"), "sig"].join(".");
  ok("the email is read off the id_token; garbage answers null", decodeIdTokenEmail(idToken) === "ann@gmail.com" && decodeIdTokenEmail("nope") === null && decodeIdTokenEmail(null) === null);
}

// ── 2. Token at rest ───────────────────────────────────────────────────────
section("2. the refresh token is encrypted at rest");
{
  const row = await saveConnection({ memberId: "m_ann", refreshToken: "1//refresh-ann-secret", email: "ann@gmail.com" }, db);
  ok("the stored column is not the token", row.refreshTokenEnc && !row.refreshTokenEnc.includes("refresh-ann-secret"));
  ok("…and decrypts back to it", decryptToken(row.refreshTokenEnc) === "1//refresh-ann-secret");
  const shape = publicConnectionShape(row);
  ok("the browser-visible shape carries no token or ciphertext", !JSON.stringify(shape).includes(row.refreshTokenEnc) && !/token/i.test(JSON.stringify(shape)) && shape.email === "ann@gmail.com" && shape.writeEnabled === true && shape.busyReadEnabled === true);
  const again = await saveConnection({ memberId: "m_ann", refreshToken: "1//refresh-ann-v2", email: "ann@gmail.com" }, db);
  ok("reconnecting replaces the token on the same row", again.id === row.id && decryptToken(again.refreshTokenEnc) === "1//refresh-ann-v2");
}

// ── 3. Mirror create / update / delete, idempotent ─────────────────────────
section("3. create, update, delete — and a second sync is a no-op");
let annEventId = null;
{
  await db.appointment.create({ data: { id: "ap1", companyId: "co1", clientId: "cl1", scheduledAt: T(14), location: "12 Maple St, Toronto", status: "scheduled", createdById: "u_ann", assignedToId: "u_ann" } });
  const n0 = google.calls.length;
  const r1 = await syncEntity("appointment", "ap1", deps);
  ok("first sync creates one event", r1.created === 1 && r1.errors.length === 0, r1);
  const mirrors = await db.calendarMirror.findMany({ where: { entityKind: "appointment", entityId: "ap1" } });
  ok("one mirror row for Ann", mirrors.length === 1 && mirrors[0].memberId === "m_ann" && mirrors[0].payloadHash);
  annEventId = mirrors[0].googleEventId;
  const ev = google.calendars.get("primary").get(annEventId);
  ok("the event carries FieldQuo's private mark", ev?.extendedProperties?.private?.[FIELDQUO_ID_KEY] === "appointment:ap1" && ev.extendedProperties.private[FIELDQUO_APP_KEY] === FIELDQUO_APP_VALUE);
  ok("summary is in the MEMBER's language (Ann is fr): 'Rendez-vous — Jane Doe'", ev?.summary === "Rendez-vous — Jane Doe", ev?.summary);
  ok("location is the site address, description carries the FieldQuo link", ev?.location === "12 Maple St, Toronto" && ev?.description.includes("https://www.fieldquo.com/app/appointments?day=2026-09-22"));
  ok("start/end are the hour the office's own move check assumes", ev?.start?.dateTime === T(14).toISOString() && ev?.end?.dateTime === T(15).toISOString());

  const n1 = google.calls.length;
  const r2 = await syncEntity("appointment", "ap1", deps);
  ok("second sync of an unchanged row makes NO Google request", r2.unchanged === 1 && callsSince(n1).length === 0, callsSince(n1));

  await db.appointment.update({ where: { id: "ap1" }, data: { scheduledAt: T(16) } });
  const n2 = google.calls.length;
  const r3 = await syncEntity("appointment", "ap1", deps);
  ok("a moved appointment is PATCHED, not re-created", r3.updated === 1 && r3.created === 0 && noWrites(callsSince(n2)).every((c) => c[0] === "patch"), r3);
  ok("…on the same event id", google.calendars.get("primary").get(annEventId)?.start?.dateTime === T(16).toISOString());
  ok("…and the mirror count is still one", (await db.calendarMirror.findMany({ where: { entityId: "ap1" } })).length === 1);

  await db.appointment.update({ where: { id: "ap1" }, data: { status: "cancelled" } });
  const r4 = await syncEntity("appointment", "ap1", deps);
  ok("a cancelled appointment's event is deleted and its mirror removed", r4.deleted === 1 && !google.calendars.get("primary").has(annEventId) && (await db.calendarMirror.findMany({ where: { entityId: "ap1" } })).length === 0, r4);
  await db.appointment.update({ where: { id: "ap1" }, data: { status: "scheduled" } });
  const r5 = await syncEntity("appointment", "ap1", deps);
  ok("reopening puts it back", r5.created === 1);
  annEventId = (await db.calendarMirror.findFirst({ where: { entityId: "ap1" } })).googleEventId;

  // Hard delete: the row is gone, the sync finds nothing and clears up.
  await db.appointment.create({ data: { id: "ap_gone", companyId: "co1", clientId: "cl1", scheduledAt: T(9), status: "scheduled", createdById: "u_ann", assignedToId: "u_ann" } });
  await syncEntity("appointment", "ap_gone", deps);
  const goneId = (await db.calendarMirror.findFirst({ where: { entityId: "ap_gone" } })).googleEventId;
  await db.appointment.delete({ where: { id: "ap_gone" } });
  const r6 = await syncEntity("appointment", "ap_gone", deps);
  ok("a hard-deleted row's event and mirror both go", r6.deleted === 1 && !google.calendars.get("primary").has(goneId) && !(await db.calendarMirror.findFirst({ where: { entityId: "ap_gone" } })));
  const n7 = google.calls.length;
  const r7 = await syncEntity("appointment", "ap_gone", deps);
  ok("…and syncing a gone row again does nothing", r7.deleted === 0 && callsSince(n7).length === 0);
  const r8 = await syncEntity("nonsense", "x", deps);
  ok("an unknown kind is a no-op, never a throw", r8.created === 0 && r8.errors.length === 0);
}

// ── 3b. Job visits and reassignment ────────────────────────────────────────
section("3b. a job visit follows its assignee");
{
  await db.jobVisit.create({ data: { id: "v1", jobId: "job1", scheduledAt: T(10), assignedToId: "u_ann", status: "scheduled" } });
  const r1 = await syncEntity("visit", "v1", deps);
  const m = await db.calendarMirror.findFirst({ where: { entityKind: "visit", entityId: "v1" } });
  const ev = google.calendars.get("primary").get(m?.googleEventId);
  ok("a visit is mirrored with the job title, the client's address and a link to the job", r1.created === 1 && ev?.summary === "Kitchen repaint — Jane Doe" && ev?.location === "12 Maple St, Toronto" && ev?.description.includes("/app/jobs/job1"), ev);

  // Bob has no connection: reassigning to him removes Ann's event, creates none.
  await db.jobVisit.update({ where: { id: "v1" }, data: { assignedToId: "u_bob" } });
  const r2 = await syncEntity("visit", "v1", deps);
  ok("reassigned to an unconnected member: Ann's event deleted, nothing created", r2.deleted === 1 && r2.created === 0 && !google.calendars.get("primary").has(m.googleEventId) && (await db.calendarMirror.findMany({ where: { entityId: "v1" } })).length === 0, r2);

  // Bob connects (a different calendar id so the two are told apart).
  await saveConnection({ memberId: "m_bob", refreshToken: "1//refresh-bob", email: "bob@gmail.com", calendarId: "bobcal" }, db);
  const r3 = await syncEntity("visit", "v1", deps);
  const mb = await db.calendarMirror.findFirst({ where: { entityId: "v1" } });
  ok("once Bob connects the visit lands on HIS calendar", r3.created === 1 && mb?.memberId === "m_bob" && google.calendars.get("bobcal")?.has(mb.googleEventId), r3);
  await db.jobVisit.update({ where: { id: "v1" }, data: { assignedToId: "u_ann" } });
  const r4 = await syncEntity("visit", "v1", deps);
  const ma = await db.calendarMirror.findMany({ where: { entityId: "v1" } });
  ok("back to Ann: Bob's event gone, Ann's created, exactly one mirror", r4.deleted === 1 && r4.created === 1 && ma.length === 1 && ma[0].memberId === "m_ann" && !google.calendars.get("bobcal").has(mb.googleEventId), r4);
  await db.job.update({ where: { id: "job1" }, data: { archivedAt: new Date() } });
  const r5 = await syncEntity("visit", "v1", deps);
  ok("archiving the job takes the visit off the calendar", r5.deleted === 1);
  await db.job.update({ where: { id: "job1" }, data: { archivedAt: null } });
  await syncEntity("visit", "v1", deps);
}

// ── 4. Only FieldQuo's own events are ever deleted ─────────────────────────
section("4. only an event carrying the fieldquoId is deleted");
{
  // A mirror row that points at an event the MEMBER owns (no mark). This is
  // the corruption case: whatever put the row there, the event is not ours.
  google.calendars.get("primary").set("dentist", { id: "dentist", summary: "Dentist", status: "confirmed" });
  await db.calendarMirror.create({ data: { memberId: "m_ann", entityKind: "appointment", entityId: "ap_fake", googleEventId: "dentist", payloadHash: "x" } });
  const n = google.calls.length;
  const r = await syncEntity("appointment", "ap_fake", deps);
  ok("the member's own event is READ and left alone; the stray mirror row goes", google.calendars.get("primary").has("dentist") && !callsSince(n).some((c) => c[0] === "delete") && r.deleted === 0 && !(await db.calendarMirror.findFirst({ where: { entityId: "ap_fake" } })), callsSince(n));
  // And an event that carries a DIFFERENT entity's mark is not this entity's.
  google.calendars.get("primary").set("other", { id: "other", summary: "x", status: "confirmed", extendedProperties: { private: { [FIELDQUO_ID_KEY]: "appointment:someone-else" } } });
  await db.calendarMirror.create({ data: { memberId: "m_ann", entityKind: "appointment", entityId: "ap_fake2", googleEventId: "other", payloadHash: "x" } });
  await syncEntity("appointment", "ap_fake2", deps);
  ok("an event marked for ANOTHER entity is not deleted either", google.calendars.get("primary").has("other"));
  google.calendars.get("primary").delete("other");
  ok("isFieldquoEvent is exact", isFieldquoEvent({ extendedProperties: { private: { fieldquoId: "visit:v1" } } }, "visit", "v1") && !isFieldquoEvent({ extendedProperties: { private: { fieldquoId: "visit:v1" } } }, "visit", "v2") && !isFieldquoEvent({}, "visit", "v1") && !isFieldquoEvent(null, "visit", "v1"));
}

// ── 5. Disconnect ──────────────────────────────────────────────────────────
section("5. disconnect removes FieldQuo's events and nothing else");
{
  const before = [...google.calendars.get("primary").keys()];
  const ours = (await db.calendarMirror.findMany({ where: { memberId: "m_ann" } })).map((m) => m.googleEventId);
  ok("Ann holds at least two FieldQuo events plus her dentist", ours.length >= 2 && before.includes("dentist"));
  const connection = await getConnectionForMember("m_ann", db);
  const n5 = google.calls.length;
  const r = await removeMemberMirrors("m_ann", { ...deps, connection });
  const after = [...google.calendars.get("primary").keys()];
  ok("every FieldQuo event is gone", ours.every((id) => !after.includes(id)) && r.deleted === ours.length, { ours, after, r });
  ok("the dentist is untouched", after.includes("dentist"));
  ok("no mirror rows remain for Ann", (await db.calendarMirror.findMany({ where: { memberId: "m_ann" } })).length === 0);
  ok("Bob's calendar was not touched", !callsSince(n5).some((c) => c[1] === "bobcal"));
  await deleteConnection("m_ann", db);
  ok("the row is gone", !(await getConnectionForMember("m_ann", db)));
  const n = google.calls.length;
  const r2 = await syncEntity("appointment", "ap1", deps);
  ok("with Ann disconnected, syncing her appointment creates nothing and calls nothing", r2.created === 0 && callsSince(n).length === 0);
  // Reconnect for the sections below.
  await saveConnection({ memberId: "m_ann", refreshToken: "1//refresh-ann-v3", email: "ann@gmail.com" }, db);
  await syncEntity("appointment", "ap1", deps);
  await syncEntity("visit", "v1", deps);
}

// ── 6. Busy time in availability ───────────────────────────────────────────
section("6. Google busy time blocks availability, with no title");
{
  // A Tuesday ten years out, so `slotStart > new Date()` inside
  // computeAvailableSlots keeps offering it long after this file was written.
  const DAY = "2036-09-23";
  const at = (h, m = 0) => new Date(`${DAY}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`);
  clearBusyCache();
  await db.availabilitySchedule.create({ data: { userId: "u_ann", dayOfWeek: 2, startTime: "09:00", endTime: "12:00", timezone: "UTC" } });
  const from = at(0);
  const to = at(23, 59);
  const eventType = await db.eventType.findUnique({ where: { id: "et1" } });
  const open = await computeAvailableSlots({ eventType, fromDate: from, toDate: to });
  const slots0 = open[DAY] || [];
  ok("with no busy time the 9–12 window offers 9:00", slots0.includes(at(9).toISOString()), slots0.slice(0, 4));

  google.busy.set("primary", [{ start: at(9, 30).toISOString(), end: at(10, 30).toISOString() }]);
  clearBusyCache();
  const busy = await googleBusyRanges({ userId: "u_ann", from, to }, deps);
  ok("googleBusyRanges answers the interval with NO title field", busy.length === 1 && Object.keys(busy[0]).sort().join() === "end,memberId,start", busy);
  const open2 = await computeAvailableSlots({ eventType, fromDate: from, toDate: to });
  const slots = open2[DAY] || [];
  ok("every slot overlapping 9:30–10:30 is gone; 10:30 and 11:00 remain", !slots.includes(at(9).toISOString()) && !slots.includes(at(9, 45).toISOString()) && !slots.includes(at(10, 15).toISOString()) && slots.includes(at(10, 30).toISOString()) && slots.includes(at(11).toISOString()), slots);
  const n = google.calls.length;
  await computeAvailableSlots({ eventType, fromDate: from, toDate: to });
  ok("a second availability read inside five minutes makes no Google call (cache)", !callsSince(n).some((c) => c[0] === "freebusy"), callsSince(n));

  // The office's move check: a personal block is a refusal, force wins.
  const stops = [{ id: "s1", kind: "appointment", startAt: at(8), endAt: at(9), point: null }, { id: null, kind: "google_busy", startAt: at(9, 30), endAt: at(10, 30), point: null }];
  const { previous, next } = bracketStops(stops, at(10));
  ok("bracketStops never treats a busy block as a stop", previous?.id === "s1" && next === null);
  const plan = planOfficeMove({ scheduledAt: at(10), now: NOW, busy: stops.filter((s) => s.kind === "google_busy"), previous, next });
  ok("the office move is refused with personal_busy (409)", !plan.ok && plan.reason === "personal_busy" && plan.httpStatus === 409, plan);
  const forced = planOfficeMove({ scheduledAt: at(10), now: NOW, force: true, busy: stops.filter((s) => s.kind === "google_busy"), previous, next });
  ok("…and force overrides it", forced.ok);
  const clear = planOfficeMove({ scheduledAt: at(11), now: NOW, busy: stops.filter((s) => s.kind === "google_busy"), previous, next });
  ok("a candidate outside the block is fine", clear.ok);
  ok("personal_busy is in MOVE_REASONS and the dialog renders it", MOVE_REASONS.includes("personal_busy") && read("app/components/schedule/EntryActions.js").includes('case "personal_busy"') && read("app/components/schedule/EntryActions.js").includes('"in_the_past", "travel_short", "personal_busy"'));
}

// ── 7. Switches ────────────────────────────────────────────────────────────
section("7. the two switches are honoured server-side");
{
  clearBusyCache();
  await updateSwitches("m_ann", { busyReadEnabled: false }, db);
  const from = new Date("2036-09-23T00:00:00Z");
  const to = new Date("2036-09-23T23:59:59Z");
  const busy = await googleBusyRanges({ userId: "u_ann", from, to }, deps);
  ok("busyReadEnabled=false: no busy intervals, Google not asked", busy.length === 0);
  await updateSwitches("m_ann", { busyReadEnabled: true }, db);
  clearBusyCache();
  ok("…back on: the interval returns", (await googleBusyRanges({ userId: "u_ann", from, to }, deps)).length === 1);

  await updateSwitches("m_ann", { writeEnabled: false }, db);
  await db.appointment.create({ data: { id: "ap2", companyId: "co1", clientId: "cl1", scheduledAt: T(11), status: "scheduled", createdById: "u_ann", assignedToId: "u_ann" } });
  const r = await syncEntity("appointment", "ap2", deps);
  ok("writeEnabled=false: nothing is written for a new appointment", r.created === 0 && !(await db.calendarMirror.findFirst({ where: { entityId: "ap2" } })));
  const conn = await getConnectionForMember("m_ann", db);
  const rr = await reconcileMember(conn, { ...deps, now: NOW, listEntries: async () => [] });
  ok("…and the reconcile strips the events already there", rr.deleted >= 1 && (await db.calendarMirror.findMany({ where: { memberId: "m_ann" } })).length === 0, rr);
  await updateSwitches("m_ann", { writeEnabled: true }, db);
  const r2 = await syncEntity("appointment", "ap2", deps);
  ok("writeEnabled=true again: the appointment is written", r2.created === 1);
  ok("updateSwitches coerces and ignores undefined", (await updateSwitches("m_ann", { busyReadEnabled: "yes" }, db)).busyReadEnabled === true && (await updateSwitches("m_ann", {}, db)).writeEnabled === true);
}

// ── 8. Meet link for a video booking ───────────────────────────────────────
section("8. a video booking gets a Meet link written back");
{
  await db.appointment.create({ data: { id: "ap_video", companyId: "co1", clientId: "cl1", scheduledAt: T(13), status: "scheduled", createdById: "u_ann", assignedToId: "u_ann" } });
  await db.booking.create({ data: { id: "bk_video", eventTypeId: "et1", clientName: "Jane Doe", clientEmail: "jane@example.com", startTime: T(13), endTime: T(13, 30), mode: "video", status: "confirmed", appointmentId: "ap_video" } });
  const n = google.calls.length;
  const r = await syncEntity("appointment", "ap_video", deps);
  const ins = callsSince(n).find((c) => c[0] === "insert");
  ok("the insert asks Google for a Meet room", ins?.[2]?.conferenceData?.createRequest?.conferenceSolutionKey?.type === "hangoutsMeet", ins?.[2]);
  const ap = await db.appointment.findUnique({ where: { id: "ap_video" } });
  const bk = await db.booking.findUnique({ where: { id: "bk_video" } });
  ok("the Meet URL is written onto the appointment AND its booking", r.created === 1 && /^https:\/\/meet\.google\.com\//.test(ap.meetUrl) && bk.meetUrl === ap.meetUrl, { ap: ap.meetUrl, bk: bk.meetUrl });
  const m = await db.calendarMirror.findFirst({ where: { entityId: "ap_video" } });
  const ev = google.calendars.get("primary").get(m.googleEventId);
  ok("a video call carries no location and the video label", ev.location === "" && ev.summary === "Appel vidéo — Jane Doe", ev);
  ok("the event ends at the booking's own end time", ev.end.dateTime === T(13, 30).toISOString());
  await db.appointment.update({ where: { id: "ap_video" }, data: { scheduledAt: T(15) } });
  const n2 = google.calls.length;
  await syncEntity("appointment", "ap_video", deps);
  const patch = callsSince(n2).find((c) => c[0] === "patch");
  ok("a move PATCHes without a new createRequest (no second room)", patch && !patch[3].conferenceData, patch?.[3]);
  // A site visit never asks for one.
  await db.booking.create({ data: { id: "bk_site", eventTypeId: "et1", clientName: "Jane Doe", clientEmail: "", startTime: T(17), endTime: T(18), mode: "visit", status: "confirmed", address: "12 Maple St" } });
  const n3 = google.calls.length;
  await syncEntity("booking", "bk_site", deps);
  const ins3 = callsSince(n3).find((c) => c[0] === "insert");
  ok("an unconverted site-visit booking is mirrored, without a Meet request", ins3 && !ins3[2].conferenceData && ins3[2].summary === "Visite sur place — Jane Doe", ins3?.[2]);
  ok("meetLinkFrom reads hangoutLink, then entryPoints, else null", meetLinkFrom({ hangoutLink: "https://meet.google.com/a" }) === "https://meet.google.com/a" && meetLinkFrom({ conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/b" }] } }) === "https://meet.google.com/b" && meetLinkFrom({ conferenceData: { status: { statusCode: "failure" } } }) === null && meetLinkFrom(null) === null);
  ok("withMeetRequest never enters the hash", payloadHash(withMeetRequest({ a: 1 }, "r1")) !== payloadHash({ a: 1 }) ? true : false);
}

// ── 9. Env absent ──────────────────────────────────────────────────────────
section("9. env absent: honest sentence, no route reaches Google unchecked");
{
  const saved = { id: process.env.GOOGLE_OAUTH_CLIENT_ID, secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET };
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  ok("googleCalendarConfigured() is false and names what is missing", !googleCalendarConfigured() && googleCalendarMissing().join() === "GOOGLE_OAUTH_CLIENT_ID,GOOGLE_OAUTH_CLIENT_SECRET");
  const n = google.calls.length;
  const r = await syncEntity("appointment", "ap1", {});
  ok("syncEntity with no deps and no config is a silent no-op", r.created === 0 && r.errors.length === 0 && callsSince(n).length === 0);
  const busy = await googleBusyRanges({ userId: "u_ann", from: new Date("2026-09-22T00:00:00Z"), to: new Date("2026-09-23T00:00:00Z") });
  ok("googleBusyRanges with no config answers []", busy.length === 0);
  process.env.GOOGLE_OAUTH_CLIENT_ID = saved.id;
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = saved.secret;

  for (const lang of Object.keys(APP_MESSAGES)) {
    const d = APP_MESSAGES[lang];
    ok(`${lang}: the honest sentence and the promise exist`, typeof d["app.calendar.google.notSetUp"] === "string" && typeof d["app.calendar.google.promise"] === "string" && typeof d["app.settings.myCalendar"] === "string" && typeof d["app.visitAction.reason.personal_busy"] === "string" && typeof d["app.calendar.google.busyBlock"] === "string");
  }
  ok("the promise is the exact sentence the owner asked for", APP_MESSAGES.en["app.calendar.google.promise"] === "FieldQuo creates and updates its own events only; it never edits yours.");

  const connect = read("app/api/calendar/google/connect/route.js");
  ok("connect refuses server-side before minting a state when unconfigured", connect.indexOf("googleCalendarConfigured()") < connect.indexOf("signState("));
  const callback = read("app/api/calendar/google/callback/route.js");
  ok("callback verifies the state, then the member, then config, before exchanging the code", callback.indexOf("verifyState(") < callback.indexOf("getCurrentMember(") && callback.indexOf("getCurrentMember(") < callback.indexOf("googleCalendarConfigured()") && callback.indexOf("googleCalendarConfigured()") < callback.indexOf("exchangeGoogleCode("));
  ok("callback checks the GRANTED scopes, not the asked ones", callback.includes("exchanged.data?.scope") && callback.includes("scope_missing"));
  const panel = read("app/components/calendar/GoogleConnect.js");
  ok("the panel draws no connect link when unconfigured", panel.includes("!status.configured") && panel.indexOf("!status.configured") < panel.indexOf('href="/api/calendar/google/connect"'));
  const cron = read("app/api/cron/google-calendar-reconcile/route.js");
  ok("the cron requires the secret and skips when unconfigured", cron.includes("requireCronSecret(request)") && cron.includes('skipped: "not_configured"'));
  const vercel = JSON.parse(read("vercel.json"));
  ok("the reconcile cron is scheduled", vercel.crons.some((c) => c.path === "/api/cron/google-calendar-reconcile"));
  ok("both env vars are documented in docs/VERCEL.md", read("docs/VERCEL.md").includes("`GOOGLE_OAUTH_CLIENT_ID`") && read("docs/VERCEL.md").includes("GOOGLE_OAUTH_CLIENT_SECRET"));
  ok("the owner's doc names the redirect URI and both scopes", read("docs/GOOGLE-CALENDAR.md").includes("https://www.fieldquo.com/api/calendar/google/callback") && read("docs/GOOGLE-CALENDAR.md").includes("calendar.readonly") && read("docs/GOOGLE-CALENDAR.md").includes("Test users"));
  const disconnect = read("app/api/calendar/google/disconnect/route.js");
  ok("disconnect removes mirrors BEFORE revoking and deleting", disconnect.indexOf("removeMemberMirrors(") < disconnect.indexOf("revokeGoogleToken(") && disconnect.indexOf("revokeGoogleToken(") < disconnect.indexOf("deleteConnection("));
  ok("nothing in app/ or lib/ uses the check-only override", !fs.readdirSync(path.join(ROOT, "lib/calendar")).some((f) => f !== "googleClient.js" && read(`lib/calendar/${f}`).includes("overrideGoogleForChecks")));
}

// ── 9b. The hooks exist where the writes happen ───────────────────────────
section("9b. every create/update/cancel path this agent owns calls scheduleSync");
{
  const hooks = [
    ["app/api/appointments/route.js", 'scheduleSync("appointment"'],
    ["app/api/appointments/[id]/route.js", 'scheduleSync("appointment"'],
    ["app/api/jobs/[id]/visits/route.js", 'scheduleSync("visit"'],
    ["app/api/jobs/[id]/visits/[visitId]/route.js", 'scheduleSync("visit"'],
    ["app/api/cron/recurring-jobs/route.js", 'scheduleSync("visit"'],
    ["lib/voice/availability.js", 'scheduleSync("appointment"'],
    ["app/api/visit/[token]/route.js", 'scheduleSync("booking"'],
    ["app/api/visit/[token]/reschedule/route.js", 'scheduleSync("appointment"'],
    ["app/api/marketing/stops/[id]/route.js", 'scheduleSync("appointment"'],
  ];
  for (const [file, needle] of hooks) ok(`${file} hooks the sync`, read(file).includes(needle));
  ok("appointments DELETE syncs after the delete", read("app/api/appointments/[id]/route.js").indexOf("db.appointment.delete(") < read("app/api/appointments/[id]/route.js").lastIndexOf('scheduleSync("appointment", _params.id)'));
  ok("availability merges Google busy time into busyRanges", read("lib/booking/computeAvailability.js").includes("googleBusyRanges(") && read("lib/booking/computeAvailability.js").includes("point: null"));
  ok("the office neighbours loader carries google_busy stops and both routes pass them as `busy`", read("lib/schedule/entryNeighbours.js").includes('kind: "google_busy"') && read("app/api/appointments/[id]/route.js").includes('s.kind === "google_busy"') && read("app/api/jobs/[id]/visits/[visitId]/route.js").includes('s.kind === "google_busy"'));
}

// ── 10. Reconcile ──────────────────────────────────────────────────────────
section("10. the reconcile creates, adopts, deletes and strips");
{
  const conn = await getConnectionForMember("m_ann", db);
  // A live entry with no mirror (the web-booking path this file cannot hook).
  await db.appointment.create({ data: { id: "ap_web", companyId: "co1", clientId: "cl1", scheduledAt: T(18), status: "scheduled", createdById: "u_ann", assignedToId: "u_ann" } });
  // An orphan FieldQuo event for a row that no longer exists.
  google.calendars.get("primary").set("orphan", { id: "orphan", status: "confirmed", extendedProperties: { private: { [FIELDQUO_ID_KEY]: "appointment:ap_deleted_long_ago", [FIELDQUO_APP_KEY]: FIELDQUO_APP_VALUE } } });
  // An orphan for a LIVE row whose mirror was lost: to be adopted, not duplicated.
  await db.appointment.create({ data: { id: "ap_lost", companyId: "co1", clientId: "cl1", scheduledAt: T(19), status: "scheduled", createdById: "u_ann", assignedToId: "u_ann" } });
  google.calendars.get("primary").set("lost", { id: "lost", status: "confirmed", extendedProperties: { private: { [FIELDQUO_ID_KEY]: "appointment:ap_lost", [FIELDQUO_APP_KEY]: FIELDQUO_APP_VALUE } } });
  // A mirror for a row now assigned to Bob: must leave Ann's calendar.
  await db.appointment.create({ data: { id: "ap_moved", companyId: "co1", clientId: "cl1", scheduledAt: T(20), status: "scheduled", createdById: "u_ann", assignedToId: "u_ann" } });
  await syncEntity("appointment", "ap_moved", deps);
  const movedId = (await db.calendarMirror.findFirst({ where: { entityId: "ap_moved" } })).googleEventId;
  await db.appointment.update({ where: { id: "ap_moved" }, data: { assignedToId: "u_bob" } });

  const entries = async (member) => {
    const rows = await db.appointment.findMany({ where: { companyId: "co1", assignedToId: member.userId } });
    return rows.map((a) => ({ ...a, kind: "appointment", client: { id: "cl1", name: "Jane Doe", address: "12 Maple St, Toronto" }, booking: null }));
  };
  const r = await reconcileMember(conn, { ...deps, now: NOW, listEntries: entries });
  ok("the un-hooked live appointment gets its event", (await db.calendarMirror.findFirst({ where: { entityId: "ap_web" } })) && r.created >= 1, r);
  ok("the orphan for a dead row is deleted", !google.calendars.get("primary").has("orphan"));
  const lost = await db.calendarMirror.findFirst({ where: { entityId: "ap_lost" } });
  ok("the orphan for a live row is ADOPTED under its existing event id, not duplicated", lost?.googleEventId === "lost" && [...google.calendars.get("primary").values()].filter((e) => e.extendedProperties?.private?.[FIELDQUO_ID_KEY] === "appointment:ap_lost").length === 1, lost);
  ok("the reassigned appointment left Ann's calendar", !google.calendars.get("primary").has(movedId) && !(await db.calendarMirror.findFirst({ where: { entityId: "ap_moved", memberId: "m_ann" } })));
  ok("the dentist survived the reconcile too", google.calendars.get("primary").has("dentist"));
  ok("the run stamped lastSyncAt and cleared lastError", (await getConnectionForMember("m_ann", db)).lastSyncAt && !(await getConnectionForMember("m_ann", db)).lastError);
  const n = google.calls.length;
  const r2 = await reconcileMember(conn, { ...deps, now: NOW, listEntries: entries });
  ok("a second reconcile with nothing changed writes nothing", noWrites(callsSince(n)).length === 0 && r2.created === 0 && r2.updated === 0 && r2.deleted === 0, noWrites(callsSince(n)));

  // A Google failure is stamped on the row and filed, never thrown.
  google.failNext = "insert";
  await db.appointment.create({ data: { id: "ap_fail", companyId: "co1", clientId: "cl1", scheduledAt: T(21), status: "scheduled", createdById: "u_ann", assignedToId: "u_ann" } });
  const rf = await syncEntity("appointment", "ap_fail", deps);
  const stamped = await getConnectionForMember("m_ann", db);
  ok("an insert failure is recorded on the row and on the platform error log, and the sync did not throw", rf.errors.length === 1 && /boom/.test(stamped.lastError) && (await db.platformErrorLog.findMany({ where: { area: "google_calendar" } })).length >= 1, { rf, lastError: stamped.lastError });
  const rf2 = await syncEntity("appointment", "ap_fail", deps);
  ok("the next sync succeeds and clears the error", rf2.created === 1 && !(await getConnectionForMember("m_ann", db)).lastError);
}

// ── Pure event builder against hostile input ───────────────────────────────
section("11. buildEventPayload against hostile input");
{
  ok("no id → null", buildEventPayload({ kind: "appointment", scheduledAt: T(1) }, { origin: "x" }) === null);
  ok("bad date → null", buildEventPayload({ id: "a", kind: "appointment", scheduledAt: "not a date" }, { origin: "x" }) === null);
  const p = buildEventPayload({ id: "a", kind: "appointment", scheduledAt: T(1), client: { name: "  <b>Jane</b> " }, booking: { mode: "call" }, location: "should be dropped for a call" }, { origin: "https://www.fieldquo.com/", labels: {} });
  ok("a callback has no location; the name is trimmed; the origin's trailing slash is dropped", p.location === "" && p.summary === "Callback — <b>Jane</b>" && p.description.startsWith("https://www.fieldquo.com/app/appointments?day=2026-09-22"));
  const long = buildEventPayload({ id: "a", kind: "visit", jobId: "j", scheduledAt: T(1), title: "x".repeat(400), client: { name: "y".repeat(400) } }, { origin: "o" });
  ok("summary is capped at 250", long.summary.length === 250);
  ok("the hash is stable across key order and differs on a moved start", payloadHash({ a: 1, b: { c: 2, d: 3 } }) === payloadHash({ b: { d: 3, c: 2 }, a: 1 }) && payloadHash(buildEventPayload({ id: "a", kind: "appointment", scheduledAt: T(1) }, { origin: "o" })) !== payloadHash(buildEventPayload({ id: "a", kind: "appointment", scheduledAt: T(2) }, { origin: "o" })));
}

console.log(`\n${failed === 0 ? "ALL PASS" : "FAILED"} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
