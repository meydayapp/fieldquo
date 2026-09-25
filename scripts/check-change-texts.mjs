// scripts/check-change-texts.mjs
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-change-texts.mjs
//
// ── What this is guarding ───────────────────────────────────────────────────
//
// The owner booked with TrueFinish Cabinets (2026-09-20) and asked whether a
// client hears about it by TEXT when the visit is moved or cancelled. They
// did not: the confirmation texted, and every move or cancel — the office's
// dialog, the client's own manage link — sent the letter alone. Now every one
// of those paths also texts, through lib/schedule/changeText.js, behind the
// confirmation's own gates. Each claim below is RUN, not read:
//
//   1. the gates: the booking-text switch (one switch for booking texts),
//      the phone, a STOP or a call opt-out, a demo tenant simulating — and
//      the two guards that stop a double text (a "move" to the same time, a
//      cancel of what is already cancelled);
//   2. the wording: the client's language, the mode line, the new time, the
//      manage link when there is one and the company's phone when not, the
//      company's own template when it wrote one;
//   3. the tracking: every real send opens an SmsDelivery row with purpose
//      booking_moved / booking_cancelled and the ref of the row the calendar
//      draws, so its "Texts" line shows it;
//   4. every path: the office's appointment PATCH and job-visit PATCH (the
//      EntryActions dialog) and the client's own reschedule and cancel
//      routes, executed end to end — with `notifyClient: false` sending
//      nothing at all.
//
// Twilio is replaced by a recorder (no text leaves this machine), the
// database by scripts/fixtures/dbStub.mjs, and the signed-in member by a
// fixture. Resend has no key here, so a real letter is "skipped", and a demo
// tenant's letter and text are recorded as simulated — both as in production.

import { register } from "node:module";

// Registered before any product module is imported (every import below is
// dynamic), so the recorder stands in for the twilio SDK and the fixture
// member for the session. Registered after db-stub-loader, so it runs first
// and falls through to it for everything else.
const HOOKS = `
export async function resolve(specifier, context, next) {
  if (specifier === "twilio" && /\\/lib\\/sms\\/twilioClient\\.js$/.test(context.parentURL || "")) {
    return { url: "data:text/javascript,export default (...a) => globalThis.__twilioFactory(...a);", shortCircuit: true };
  }
  if (specifier === "@/lib/currentMember") {
    return { url: "data:text/javascript,export const getCurrentMember = async () => globalThis.__member;", shortCircuit: true };
  }
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

// Nothing here may reach a real provider.
delete process.env.RESEND_API_KEY;
process.env.TWILIO_ACCOUNT_SID = "ACstub";
process.env.TWILIO_AUTH_TOKEN = "stub";
process.env.TWILIO_PHONE_NUMBER = "+17165550100";
delete process.env.TWILIO_API_KEY_SID;
delete process.env.TWILIO_API_KEY_SECRET;

const sent = [];
globalThis.__twilioFactory = () => ({
  messages: {
    create: async (payload) => {
      sent.push(payload);
      return { sid: "SM" + String(sent.length).padStart(32, "0"), status: "queued", errorCode: null, errorMessage: null };
    },
  },
});
globalThis.__member = { id: "m1", companyId: "c1", userId: "u_owner", role: "owner" };

const { rows, writes, resetDbStub, db: stubDb } = await import("./fixtures/dbStub.mjs");

// Prisma hands back a FRESH object from every read; the stub hands back the
// fixture row itself, and its update() then mutates that same object. The
// routes read `existing.scheduledAt` / `existing.status` after the write to
// say what the row WAS — true in production, false against the aliasing
// stub. Copy on read here, for the two rows the routes read and then write,
// so the check sees what the database would give them.
for (const name of ["appointment", "jobVisit"]) {
  const read = stubDb[name].findFirst;
  stubDb[name].findFirst = async (args) => {
    const row = await read(args);
    return row ? { ...row } : row;
  };
}
const { textClientOfChange, changeTextWhere, changeTextSkip, CHANGE_TEXT_TYPES } = await import("@/lib/schedule/changeText");
const { formatWhen } = await import("@/lib/sms/templates");
const { SMS_PURPOSES } = await import("@/lib/sms/deliveryStatus");

let pass = 0;
let fail = 0;
function ok(what, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${what}`);
  } else {
    fail++;
    console.log(`  ✗ ${what}${detail !== undefined ? `  got: ${JSON.stringify(detail)}` : ""}`);
  }
}

const COMPANY = {
  id: "c1",
  slug: "truefinish",
  name: "TrueFinish Cabinets",
  email: "office@truefinish.test",
  phone: "819-555-0100",
  currency: "CAD",
  timezone: "America/Toronto",
  defaultLanguage: "en",
  bookingModes: ["visit", "call"],
  defaultVisitMinutes: 60,
  callMinutes: null,
  videoMinutes: null,
  travelCheckEnabled: false,
  travelBufferMinutes: 0,
  arrivalWindowMinutes: 0,
  bookingChangeNoticeHours: 1,
  refundVisitFeeOnCancel: false,
  refundCutoffHours: null,
  // Never chose: the switch reads ON (lib/booking/bookingText.js).
  bookingSmsConfirmation: false,
  bookingSmsChosenAt: null,
  smsTemplates: null,
  smsFromNumber: "+18195550142",
  isDemo: false,
  emailDomain: null,
  emailDomainStatus: null,
  emailFromLocal: null,
  logoUrl: null,
  brandColor: "#1f3a5f",
};
const T0 = new Date("2026-10-06T14:00:00Z"); // Tue 10:00 AM Toronto
const T1 = new Date("2026-10-08T18:30:00Z"); // Thu 2:30 PM Toronto
const PHONE = "819-238-7263";
const E164 = "+18192387263";

const simulatedTexts = () => writes.filter((w) => w.model === "activityLog" && w.data?.action === "sms.simulated");
const simulatedMails = () => writes.filter((w) => w.model === "activityLog" && w.data?.action === "email.simulated");
const deliveries = () => rows.smsDelivery;

function fresh(companyOver = {}) {
  resetDbStub();
  sent.length = 0;
  const company = { ...COMPANY, ...companyOver };
  rows.company.push(company);
  return company;
}

const base = (over = {}) => ({
  kind: "moved",
  company: COMPANY,
  phone: PHONE,
  language: "en",
  startTime: T1,
  previousStartTime: T0,
  where: { mode: "visit", address: "12 Elm St, Gatineau", phone: PHONE, email: "d@x.test" },
  service: "Kitchen consultation",
  manageUrl: "https://app.fieldquo.com/visit/tok_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
  ref: { type: "appointment", id: "a1" },
  clientId: "cl1",
  ...over,
});

// ───────────────────────────────────────────────────────────────────────────
console.log("\n1. The gates — textClientOfChange, executed");

let c = fresh();
let r = await textClientOfChange(base());
ok("never chose → ON: the moved text goes", r.texted === true && r.reason === "ok", r);
ok("…exactly one Twilio send, to the E.164, from the company's own line", sent.length === 1 && sent[0].to === E164 && sent[0].from === "+18195550142", sent);
ok("…tracked: purpose booking_moved, ref appointment:a1, client cl1", deliveries().length === 1 && deliveries()[0].purpose === "booking_moved" && deliveries()[0].refType === "appointment" && deliveries()[0].refId === "a1" && deliveries()[0].clientId === "cl1", deliveries());
const movedBody = sent[0]?.body || "";
ok("…names the new time in the company's zone", movedBody.includes(formatWhen(T1, { language: "en", timezone: "America/Toronto" })) && /2:30/.test(movedBody), movedBody);
ok("…the mode line", movedBody.includes("On-site visit at 12 Elm St, Gatineau"), movedBody);
ok("…the manage link", movedBody.includes("/visit/tok_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"), movedBody);
ok("…and STOP", /\bSTOP\b/.test(movedBody), movedBody);
console.log(`     → "${movedBody}"`);

c = fresh();
r = await textClientOfChange(base({ kind: "cancelled", startTime: T0, previousStartTime: null, manageUrl: null }));
const cxBody = sent[0]?.body || "";
ok("the cancelled text goes, tracked as booking_cancelled", r.texted && deliveries()[0]?.purpose === "booking_cancelled", deliveries());
ok("…names the time that was called off, and the number to rebook", cxBody.includes(formatWhen(T0, { language: "en", timezone: "America/Toronto" })) && cxBody.includes("819-555-0100") && /cancelled/.test(cxBody), cxBody);
ok("…carries no link (a cancelled visit has nothing to manage)", !/visit\/tok_/.test(cxBody), cxBody);
console.log(`     → "${cxBody}"`);

c = fresh();
r = await textClientOfChange(base({ phone: null }));
ok("no phone → no text", r.texted === false && r.reason === "no_phone" && sent.length === 0 && deliveries().length === 0, r);
r = await textClientOfChange(base({ phone: "12" }));
ok("an undialable phone → no text", r.texted === false && r.reason === "no_phone" && sent.length === 0, r);

c = fresh();
rows.smsOptOut.push({ id: "o1", companyId: "c1", e164: E164, optedOut: true });
r = await textClientOfChange(base());
ok("a STOP on file → no text", r.texted === false && r.reason === "opted_out" && sent.length === 0, r);
c = fresh();
rows.callConsent.push({ id: "cc1", companyId: "c1", e164: E164, optedOutAt: new Date() });
r = await textClientOfChange(base({ kind: "cancelled" }));
ok("a call opt-out → no text either", r.texted === false && r.reason === "opted_out" && sent.length === 0, r);

c = fresh({ bookingSmsConfirmation: false, bookingSmsChosenAt: new Date() });
r = await textClientOfChange(base());
ok("the booking-text switch deliberately OFF → no moved text", r.texted === false && r.reason === "switched_off" && sent.length === 0, r);
r = await textClientOfChange(base({ kind: "cancelled" }));
ok("…and no cancelled text (one switch governs every booking text)", r.texted === false && r.reason === "switched_off" && sent.length === 0, r);
c = fresh({ bookingSmsConfirmation: true, bookingSmsChosenAt: new Date() });
r = await textClientOfChange(base());
ok("deliberately ON → text", r.texted === true && sent.length === 1, r);

c = fresh();
r = await textClientOfChange(base({ previousStartTime: T1, startTime: new Date(T1) }));
ok("a 'move' to the time it already had → no text (not a move)", r.texted === false && r.reason === "unchanged" && sent.length === 0, r);
r = await textClientOfChange(base({ kind: "cancelled", alreadyCancelled: true }));
ok("cancelling what is already cancelled → no text (a retry, not news)", r.texted === false && r.reason === "already_cancelled" && sent.length === 0, r);
ok("changeTextSkip: a one-minute move IS a move (no minimum invented)", changeTextSkip({ kind: "moved", previousStartTime: T0, startTime: new Date(T0.getTime() + 60000) }) === null);

c = fresh({ isDemo: true });
r = await textClientOfChange(base());
ok("demo tenant: reported as texted (the flow works)…", r.texted === true, r);
ok("…but simulated: no Twilio call, no delivery row, one sms.simulated record", sent.length === 0 && deliveries().length === 0 && simulatedTexts().length === 1, { sent, sim: simulatedTexts().length });
ok("…whose body is the moved text", /has moved/.test(simulatedTexts()[0]?.data?.metadata?.body || ""), simulatedTexts()[0]?.data?.metadata?.body);

c = fresh({ smsFromNumber: null });
r = await textClientOfChange(base());
ok("no company line → the shared system number", r.texted && sent[0]?.from === "+17165550100", sent[0]?.from);

// ───────────────────────────────────────────────────────────────────────────
console.log("\n2. The wording — the client's language, the company's words");

c = fresh();
await textClientOfChange(base({ language: "fr", where: { mode: "call", address: null, phone: PHONE, email: null } }));
const fr = sent[0]?.body || "";
ok("French client: the French sentence", /Votre rendez-vous a été déplacé/.test(fr), fr);
ok("…the French mode line for a call", fr.includes("Appel téléphonique — nous vous appellerons au 819-238-7263"), fr);
ok("…the French time (14 h 30)", /14 h 30/.test(fr), fr);
for (const lang of ["es", "it", "de", "uk", "pa", "tl"]) {
  c = fresh();
  await textClientOfChange(base({ kind: "cancelled", language: lang }));
  const body = sent[0]?.body || "";
  ok(`${lang}: the cancelled text is not the English sentence and keeps STOP`, body && !/is cancelled/.test(body) && /\bSTOP\b/.test(body), body);
}

c = fresh({ smsTemplates: { booking_moved: "{company}: {service} moved from {previous} to {when}. {link}" } });
await textClientOfChange(base());
const custom = sent[0]?.body || "";
ok("the company's own moved wording, every token filled", custom.startsWith("TrueFinish Cabinets: Kitchen consultation moved from ") && custom.includes(formatWhen(T0, { language: "en", timezone: "America/Toronto" })) && custom.includes("/visit/tok_") && !/\{\w+\}/.test(custom), custom);
c = fresh({ smsTemplates: { booking_moved: "{company}: {service} moved to {when}." } });
await textClientOfChange(base({ language: "es" }));
ok("…a Spanish client of an English template gets the built-in Spanish", /Su cita ha cambiado/.test(sent[0]?.body || ""), sent[0]?.body);

ok("where: a booking's facts give its mode line", changeTextWhere({ where: { mode: "call", phone: PHONE }, language: "en" }) === "Phone call — we'll ring 819-238-7263");
ok("where: a hand-booked row is a visit at its location", changeTextWhere({ location: "40 Site Rd", language: "en" }) === "On-site visit at 40 Site Rd");
ok("where: neither → nothing (no invented 'address to be confirmed')", changeTextWhere({ location: "   ", language: "en" }) === null);
c = fresh();
await textClientOfChange(base({ where: null, location: null, manageUrl: null }));
const bare = sent[0]?.body || "";
ok("…and the text drops the clause cleanly, pointing at the phone with no link", !/null|undefined|\. ,/.test(bare) && bare.includes("Questions? Call 819-555-0100"), bare);

ok("both types are registered SmsDelivery purposes (not filed as 'other')", Object.values(CHANGE_TEXT_TYPES).every((p) => SMS_PURPOSES.includes(p)));

// ───────────────────────────────────────────────────────────────────────────
console.log("\n3. The office's dialog → PATCH /api/appointments/[id], executed");

const appointments = await import("@/app/api/appointments/[id]/route.js");
const visits = await import("@/app/api/jobs/[id]/visits/[visitId]/route.js");
const patchReq = (url, body) => new Request(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

function seedAppointment({ company, withBooking = true, clientPhone = PHONE, status = "scheduled" } = {}) {
  rows.member.push({ id: "m1", userId: "u_owner", role: "owner", permissions: null, companyId: "c1" });
  const client = { id: "cl1", name: "Dana O'Brien", email: "d@x.test", language: "fr", address: "12 Elm St", phone: clientPhone };
  rows.client.push({ ...client, companyId: "c1" });
  const booking = withBooking
    ? {
        id: "b1",
        status: status === "cancelled" ? "cancelled" : "confirmed",
        endTime: new Date(T0.getTime() + 20 * 60000),
        mode: "call",
        address: null,
        clientPhone,
        clientEmail: "d@x.test",
        clientName: "Dana O'Brien",
        startTime: T0,
        calendarSequence: 0,
        manageToken: "tok_office_0123456789",
        feePaidCents: 0,
        feeCurrency: null,
        eventType: { name: "Kitchen consultation", durationMinutes: 20 },
      }
    : null;
  if (booking) rows.booking.push({ ...booking, appointmentId: "a1", companyId: "c1" });
  rows.appointment.push({
    id: "a1",
    companyId: "c1",
    clientId: "cl1",
    scheduledAt: T0,
    status,
    assignedToId: null,
    location: withBooking ? null : "40 Site Rd",
    latitude: null,
    longitude: null,
    quoteId: null,
    jobId: null,
    invoiceId: null,
    client,
    quote: null,
    job: null,
    invoice: null,
    company,
    booking,
  });
}

c = fresh();
seedAppointment({ company: c });
let res = await appointments.PATCH(patchReq("http://x/api/appointments/a1", { scheduledAt: T1.toISOString(), notifyClient: true }), { params: Promise.resolve({ id: "a1" }) });
let data = await res.json();
ok("office move: 200, the notice reports the text", res.status === 200 && data.notice?.texted === true, { status: res.status, notice: data.notice, error: data.error });
ok("…one text, tracked against the APPOINTMENT (what the calendar draws)", sent.length === 1 && deliveries()[0]?.purpose === "booking_moved" && deliveries()[0]?.refType === "appointment" && deliveries()[0]?.refId === "a1" && deliveries()[0]?.clientId === "cl1", deliveries());
ok("…in the letter's language (the client's French) with the booking's mode line and manage link", /déplacé/.test(sent[0]?.body || "") && (sent[0]?.body || "").includes("Appel téléphonique") && (sent[0]?.body || "").includes("/visit/tok_office_0123456789"), sent[0]?.body);
ok("…and the notice's language is the letter's", data.notice?.language === "fr", data.notice);

c = fresh();
seedAppointment({ company: c });
res = await appointments.PATCH(patchReq("http://x/api/appointments/a1", { status: "cancelled", cancelReason: "Crew sick", notifyClient: true }), { params: Promise.resolve({ id: "a1" }) });
data = await res.json();
ok("office cancel: one cancelled text, tracked", res.status === 200 && data.notice?.texted === true && sent.length === 1 && deliveries()[0]?.purpose === "booking_cancelled" && deliveries()[0]?.refId === "a1", { notice: data.notice, d: deliveries() });

c = fresh();
seedAppointment({ company: c, status: "cancelled" });
res = await appointments.PATCH(patchReq("http://x/api/appointments/a1", { status: "cancelled", notifyClient: true }), { params: Promise.resolve({ id: "a1" }) });
data = await res.json();
ok("cancelling an already-cancelled appointment again → no second text", res.status === 200 && data.notice?.texted === false && sent.length === 0, data.notice);

c = fresh();
seedAppointment({ company: c });
res = await appointments.PATCH(patchReq("http://x/api/appointments/a1", { scheduledAt: T1.toISOString(), notifyClient: false }), { params: Promise.resolve({ id: "a1" }) });
data = await res.json();
ok("notifyClient: false (agreed by phone) → no text and no letter", res.status === 200 && data.notice?.texted === false && data.notice?.sent === false && sent.length === 0, data.notice);

c = fresh();
seedAppointment({ company: c, withBooking: false });
res = await appointments.PATCH(patchReq("http://x/api/appointments/a1", { scheduledAt: T1.toISOString() }), { params: Promise.resolve({ id: "a1" }) });
data = await res.json();
ok("a hand-booked appointment (no booking): texted to the client record's phone", data.notice?.texted === true && sent[0]?.to === E164, { notice: data.notice, sent });
ok("…as a visit at its location, pointing at the company's phone (no manage link)", (sent[0]?.body || "").includes("40 Site Rd") && (sent[0]?.body || "").includes("819-555-0100") && !/\/visit\//.test(sent[0]?.body || ""), sent[0]?.body);

c = fresh();
seedAppointment({ company: c, clientPhone: null });
res = await appointments.PATCH(patchReq("http://x/api/appointments/a1", { scheduledAt: T1.toISOString() }), { params: Promise.resolve({ id: "a1" }) });
data = await res.json();
ok("no phone anywhere → the move still saves, no text", res.status === 200 && data.notice?.texted === false && sent.length === 0, data.notice);

c = fresh({ isDemo: true });
seedAppointment({ company: c });
res = await appointments.PATCH(patchReq("http://x/api/appointments/a1", { scheduledAt: T1.toISOString() }), { params: Promise.resolve({ id: "a1" }) });
data = await res.json();
ok("demo tenant, office move: the letter AND the text are simulated, nothing dialled", data.notice?.texted === true && sent.length === 0 && simulatedTexts().length === 1 && simulatedMails().length >= 1, { notice: data.notice, texts: simulatedTexts().length, mails: simulatedMails().length });

// ───────────────────────────────────────────────────────────────────────────
console.log("\n4. The job page's visit → PATCH /api/jobs/[id]/visits/[visitId], executed");

function seedVisit({ company, phone = PHONE, status = "scheduled" } = {}) {
  rows.member.push({ id: "m1", userId: "u_owner", role: "owner", permissions: null, companyId: "c1" });
  const client = { id: "cl2", name: "Sam Roy", email: null, language: "es", address: "9 Oak Ave", phone };
  rows.jobVisit.push({
    id: "v1",
    jobId: "j1",
    scheduledAt: T0,
    status,
    assignedToId: null,
    checklistItems: null,
    photos: [],
    notes: null,
    job: { id: "j1", companyId: "c1", title: "Deck stain", siteAddress: "9 Oak Ave", client, company, quote: null, recurring: false },
  });
}

c = fresh();
seedVisit({ company: c });
res = await visits.PATCH(patchReq("http://x/api/jobs/j1/visits/v1", { scheduledAt: T1.toISOString() }), { params: Promise.resolve({ id: "j1", visitId: "v1" }) });
data = await res.json();
ok("office moves a crew visit: a client with a phone and NO email is still told — by text", res.status === 200 && data.notice?.sent === false && data.notice?.texted === true, { status: res.status, notice: data.notice, error: data.error });
ok("…tracked against the VISIT", deliveries()[0]?.purpose === "booking_moved" && deliveries()[0]?.refType === "visit" && deliveries()[0]?.refId === "v1" && deliveries()[0]?.clientId === "cl2", deliveries());
ok("…in the client's Spanish, at the job site, pointing at the company's phone", /Su cita ha cambiado/.test(sent[0]?.body || "") && (sent[0]?.body || "").includes("9 Oak Ave") && (sent[0]?.body || "").includes("819-555-0100"), sent[0]?.body);

c = fresh();
seedVisit({ company: c });
res = await visits.PATCH(patchReq("http://x/api/jobs/j1/visits/v1", { status: "cancelled", cancelReason: "Rain" }), { params: Promise.resolve({ id: "j1", visitId: "v1" }) });
data = await res.json();
ok("office cancels a crew visit: one cancelled text against the visit", data.notice?.texted === true && sent.length === 1 && deliveries()[0]?.purpose === "booking_cancelled" && deliveries()[0]?.refId === "v1", { notice: data.notice, d: deliveries() });

c = fresh();
seedVisit({ company: c, status: "cancelled" });
res = await visits.PATCH(patchReq("http://x/api/jobs/j1/visits/v1", { status: "cancelled" }), { params: Promise.resolve({ id: "j1", visitId: "v1" }) });
data = await res.json();
ok("…cancelling it again → no second text", data.notice?.texted === false && sent.length === 0, data.notice);

c = fresh();
seedVisit({ company: c });
res = await visits.PATCH(patchReq("http://x/api/jobs/j1/visits/v1", { scheduledAt: T1.toISOString(), notifyClient: false }), { params: Promise.resolve({ id: "j1", visitId: "v1" }) });
data = await res.json();
ok("…notifyClient: false → no text", data.notice?.texted === false && sent.length === 0, data.notice);

c = fresh();
seedVisit({ company: c });
res = await visits.PATCH(patchReq("http://x/api/jobs/j1/visits/v1", { status: "completed" }), { params: Promise.resolve({ id: "j1", visitId: "v1" }) });
data = await res.json();
ok("completing a visit sends no change text", res.status === 200 && !data.notice?.texted && !deliveries().some((d) => /booking_/.test(d.purpose)), data.notice);

// ───────────────────────────────────────────────────────────────────────────
console.log("\n5. The client's own manage link → reschedule and cancel, executed");

const { POST: moveRoute } = await import("@/app/api/visit/[token]/reschedule/route.js");
const { POST: cancelRoute } = await import("@/app/api/visit/[token]/route.js");
const EVENT_TYPE = { id: "e1", companyId: "c1", slug: "consult", name: "Kitchen consultation", active: true, durationMinutes: 60, bufferBefore: 0, bufferAfter: 0, userId: "u1", location: null, feeCents: null, promoFeeCents: null, promoActive: false };

function seedBooking(company, { clientPhone = PHONE } = {}) {
  rows.eventType.push({ ...EVENT_TYPE });
  for (const dayOfWeek of [0, 1, 2, 3, 4, 5, 6]) rows.availabilitySchedule.push({ id: `s${dayOfWeek}`, userId: "u1", dayOfWeek, startTime: "06:00", endTime: "22:00", timezone: "America/Toronto" });
  rows.appointment.push({ id: "a9", companyId: "c1", clientId: "cl9", scheduledAt: T0, status: "scheduled", assignedToId: "u1" });
  const booking = { id: "b9", companyId: "c1", eventTypeId: "e1", status: "confirmed", startTime: T0, endTime: new Date(T0.getTime() + 20 * 60000), mode: "call", address: null, latitude: null, longitude: null, clientName: "Dana O'Brien", clientEmail: "d@x.test", clientPhone, feePaidCents: 0, feeCurrency: null, feeStripePaymentIntentId: null, feeRefundedAt: null, feeRefundedCents: null, appointmentId: "a9", language: "fr", calendarSequence: 0, manageToken: "tok_client_0123456789", quote: null, eventType: { ...EVENT_TYPE, company } };
  rows.booking.push(booking);
  return booking;
}
const tokenReq = (token, p, body) => new Request(`http://x/api/visit/${token}${p}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 200)}` }, body: JSON.stringify(body) });

c = fresh();
let bk = seedBooking(c);
res = await moveRoute(tokenReq(bk.manageToken, "/reschedule", { startTime: T1.toISOString() }), { params: Promise.resolve({ token: bk.manageToken }) });
data = await res.json();
ok("the client moves their own visit: 200", res.status === 200 && data.rescheduled === true, data);
ok("…one moved text, tracked against the appointment the booking became, with its client", sent.length === 1 && deliveries()[0]?.purpose === "booking_moved" && deliveries()[0]?.refType === "appointment" && deliveries()[0]?.refId === "a9" && deliveries()[0]?.clientId === "cl9", deliveries());
ok("…in the page's language (fr), with the link they are holding", /déplacé/.test(sent[0]?.body || "") && (sent[0]?.body || "").includes("/visit/tok_client_0123456789"), sent[0]?.body);

res = await cancelRoute(tokenReq(bk.manageToken, "", { action: "cancel" }), { params: Promise.resolve({ token: bk.manageToken }) });
data = await res.json();
ok("then cancels it: one cancelled text", res.status === 200 && data.cancelled === true && sent.length === 2 && deliveries()[1]?.purpose === "booking_cancelled" && deliveries()[1]?.refId === "a9", deliveries());
res = await cancelRoute(tokenReq(bk.manageToken, "", { action: "cancel" }), { params: Promise.resolve({ token: bk.manageToken }) });
data = await res.json();
ok("…a double tap on cancel sends no second text", data.alreadyCancelled === true && sent.length === 2, { already: data.alreadyCancelled, sent: sent.length });

c = fresh();
bk = seedBooking(c, { clientPhone: null });
res = await moveRoute(tokenReq(bk.manageToken, "/reschedule", { startTime: T1.toISOString() }), { params: Promise.resolve({ token: bk.manageToken }) });
ok("booked without a phone → their move texts nobody", res.status === 200 && sent.length === 0);

c = fresh({ bookingSmsConfirmation: false, bookingSmsChosenAt: new Date() });
bk = seedBooking(c);
res = await moveRoute(tokenReq(bk.manageToken, "/reschedule", { startTime: T1.toISOString() }), { params: Promise.resolve({ token: bk.manageToken }) });
ok("company switched booking texts off → the client's move texts nobody", res.status === 200 && sent.length === 0);

c = fresh({ isDemo: true });
bk = seedBooking(c);
res = await cancelRoute(tokenReq(bk.manageToken, "", { action: "cancel" }), { params: Promise.resolve({ token: bk.manageToken }) });
ok("demo tenant: the client's cancel is simulated, not dialled", res.status === 200 && sent.length === 0 && simulatedTexts().length === 1 && /annulé/.test(simulatedTexts()[0]?.data?.metadata?.body || ""), simulatedTexts().map((w) => w.data.metadata.body));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
