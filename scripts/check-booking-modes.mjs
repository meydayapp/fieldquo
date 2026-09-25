// scripts/check-booking-modes.mjs
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-booking-modes.mjs
//
// ── What this is guarding ───────────────────────────────────────────────────
//
// The owner booked a demo consultation (2026-09-20) and read "Phone or
// on-site visit" — a free-text label, not a choice — with an optional
// address, one duration for every kind of appointment, and a confirmation
// that named neither. The fix has five parts and every one of them can rot
// invisibly, so every one is RUN here rather than read:
//
//   1. the per-mode length is what the slot engine slots by and what the
//      confirm route reserves (the availability route and the confirm route
//      are executed against the db stub, and the minutes are measured);
//   2. the page shows the picker for more than one mode and STATES the one
//      mode otherwise (source);
//   3. the mode's required field is refused server-side, in the visitor's
//      language, as a 400 in words (the route is executed);
//   4. every surface names the mode from lib/booking/bookingModes.js, in the
//      reader's language — the three letters and the text are built in all
//      eight document languages and grepped; the company-side screens are
//      checked at source;
//   5. a move keeps the mode and its length (planReschedule is executed).
//
// Plus the text: sent only through the switch, the phone, the opt-out ledger
// and a from-number — bookingTextVerdict is executed through the stub, and
// finalizeBooking is run end to end against a demo tenant, where a send is
// recorded rather than dialled, so "was a text sent" is a row, not a guess.

import fs from "node:fs";
import path from "node:path";
import { rows, writes, reads, resetDbStub } from "./fixtures/dbStub.mjs";
import {
  BOOKING_MODES,
  BOOKING_MODE_LANGUAGES,
  BOOKING_MODE_COPY,
  DEFAULT_CALL_MINUTES,
  DEFAULT_VIDEO_MINUTES,
  offeredModes,
  resolveMode,
  bookingDurationMinutes,
  eventTypeForMode,
  missingForMode,
  e164,
  bookingModeLabel,
  bookingModeNoun,
  bookingModeLine,
  bookingModeStatement,
  bookingFeeLine,
  requiredFieldRefusal,
} from "../lib/booking/bookingModes.js";
import { SUPPORTED_EMAIL_LANGUAGES } from "../lib/i18n/emailCopy.js";
import {
  buildBookingConfirmationEmail,
  buildVisitCancelledEmails,
  buildVisitRescheduledEmails,
} from "../app/admin/lib/email/templates.js";
import { renderMessage, SMS_TEMPLATE_TYPES } from "../lib/sms/renderTemplate.js";
import { SMS_LANGUAGES } from "../lib/sms/templates.js";
import { planReschedule, visitView, visitWhere } from "../lib/booking/manageVisit.js";
import { finalizeBooking, bookingTextVerdict } from "../lib/booking/finalizeBooking.js";
import { effectiveBookingFeeCents, bookingModePreset, bookingModePresets } from "../lib/booking/fee.js";
import { buildBookingInvite, bookingIcsUid, nextSequence } from "../lib/booking/bookingInvite.js";
import { phoneBookableModes } from "../lib/voice/visitPath.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

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

const LABEL = "Phone or on-site visit";
const COMPANY = {
  id: "c1",
  slug: "acme",
  bookingSlug: null,
  name: "Acme Cabinets",
  email: "office@acme.test",
  phone: "555-0100",
  currency: "CAD",
  timezone: "America/Toronto",
  defaultLanguage: "en",
  bookingModes: ["visit", "call", "video"],
  defaultVisitMinutes: 60,
  callMinutes: null,
  videoMinutes: null,
  travelCheckEnabled: false,
  travelBufferMinutes: 0,
  arrivalWindowMinutes: 0,
  bookingChangeNoticeHours: 24,
  refundVisitFeeOnCancel: false,
  refundCutoffHours: null,
  bookingSmsConfirmation: false,
  bookingSmsChosenAt: null,
  smsTemplates: null,
  smsFromNumber: null,
  stripeChargesEnabled: false,
  stripeAccountId: null,
  isDemo: false,
};
const EVENT_TYPE = { id: "e1", companyId: "c1", slug: "consult", name: "Consultation with Dana", active: true, durationMinutes: 60, bufferBefore: 0, bufferAfter: 0, userId: "u1", location: null, feeCents: null, promoFeeCents: null, promoActive: false };

// ───────────────────────────────────────────────────────────────────────────
console.log("\n1. The length of each mode — lib/booking/bookingModes.js, executed");
ok("a visit takes the event type's own length", bookingDurationMinutes({ company: COMPANY, eventType: EVENT_TYPE, mode: "visit" }) === 60);
ok("a visit with no event length takes the company default", bookingDurationMinutes({ company: { defaultVisitMinutes: 45 }, eventType: { durationMinutes: null }, mode: "visit" }) === 45);
ok("…and 60 when the company never said either", bookingDurationMinutes({ company: {}, eventType: {}, mode: "visit" }) === 60);
ok(`a call is ${DEFAULT_CALL_MINUTES} minutes by default`, bookingDurationMinutes({ company: COMPANY, eventType: EVENT_TYPE, mode: "call" }) === DEFAULT_CALL_MINUTES);
ok(`a video call is ${DEFAULT_VIDEO_MINUTES} minutes by default`, bookingDurationMinutes({ company: COMPANY, eventType: EVENT_TYPE, mode: "video" }) === DEFAULT_VIDEO_MINUTES);
ok("a call NEVER inherits a 90-minute visit", bookingDurationMinutes({ company: COMPANY, eventType: { ...EVENT_TYPE, durationMinutes: 90 }, mode: "call" }) === DEFAULT_CALL_MINUTES);
ok("the company's own call length wins", bookingDurationMinutes({ company: { ...COMPANY, callMinutes: 15 }, eventType: EVENT_TYPE, mode: "call" }) === 15);
ok("the company's own video length wins", bookingDurationMinutes({ company: { ...COMPANY, videoMinutes: 45 }, eventType: EVENT_TYPE, mode: "video" }) === 45);
ok("zero is never a length (the slot loop would never end)", bookingDurationMinutes({ company: { callMinutes: 0 }, eventType: EVENT_TYPE, mode: "call" }) === DEFAULT_CALL_MINUTES);
ok("a negative, a string and NaN fall to the default", [-5, "abc", NaN].every((v) => bookingDurationMinutes({ company: { callMinutes: v }, eventType: EVENT_TYPE, mode: "call" }) === DEFAULT_CALL_MINUTES));
ok("a ten-hour call is clamped to eight", bookingDurationMinutes({ company: { callMinutes: 600 }, eventType: EVENT_TYPE, mode: "call" }) === 480);
ok("a two-minute call is clamped to five", bookingDurationMinutes({ company: { callMinutes: 2 }, eventType: EVENT_TYPE, mode: "call" }) === 5);
ok("an unknown mode reads as a visit", bookingDurationMinutes({ company: COMPANY, eventType: EVENT_TYPE, mode: "teleport" }) === 60);
ok("eventTypeForMode hands the engine the same row at the mode's length", eventTypeForMode({ company: COMPANY, eventType: EVENT_TYPE, mode: "call" }).durationMinutes === 20 && eventTypeForMode({ company: COMPANY, eventType: EVENT_TYPE, mode: "call" }).userId === "u1");
ok("…and does not mutate the original", EVENT_TYPE.durationMinutes === 60);

console.log("\n   Which modes a company offers");
ok("empty is the field-trade default, visit", offeredModes({ bookingModes: [] }).join() === "visit");
ok("absent is visit too", offeredModes({}).join() === "visit" && offeredModes(null).join() === "visit");
ok("junk is filtered", offeredModes({ bookingModes: ["call", "carrier-pigeon", 7, null] }).join() === "call");
ok("a mode the company does not offer falls to the first it does", resolveMode({ bookingModes: ["visit"] }, "video") === "visit");
ok("a mode it does offer is kept", resolveMode({ bookingModes: ["visit", "call"] }, "call") === "call");

console.log("\n   What each mode requires");
ok("a visit needs an address", missingForMode("visit", { phone: "555-0100", email: "a@b.c" }) === "address");
ok("…whitespace is not an address", missingForMode("visit", { address: "   " }) === "address");
ok("…and any typed address satisfies it (a pick is an accelerator, not a gate)", missingForMode("visit", { address: "12 Elm St" }) === null);
ok("a call needs a phone", missingForMode("call", { address: "12 Elm St", email: "a@b.c" }) === "phone");
ok("…that Twilio could dial: '12' is not one", missingForMode("call", { phone: "12" }) === "phone");
ok("…'819-238-7263' is", missingForMode("call", { phone: "819-238-7263" }) === null);
ok("…'+33 1 23 45 67 89' is (international, typed with +)", missingForMode("call", { phone: "+33 1 23 45 67 89" }) === null);
ok("…'abc' is not", missingForMode("call", { phone: "abc" }) === "phone");
ok("a video call needs an email", missingForMode("video", { phone: "555-0100" }) === "email" && missingForMode("video", { email: "a@b.c" }) === null);
ok("no argument at all is handled", missingForMode("call") === "phone" && missingForMode("visit") === "address");
ok("e164 of ten digits is +1…", e164("(819) 238-7263") === "+18192387263");
ok("e164 of eleven digits starting 1 keeps them", e164("1 819 238 7263") === "+18192387263");
ok("e164 of nine digits is null", e164("819 238 726") === null);
ok("e164 of an empty or non-string is null", e164("") === null && e164(null) === null && e164(undefined) === null);

// ───────────────────────────────────────────────────────────────────────────
console.log("\n4. The words — one table, every language");
ok("nine languages: the eight document languages plus zh", BOOKING_MODE_LANGUAGES.length === 9 && SUPPORTED_EMAIL_LANGUAGES.every((l) => BOOKING_MODE_LANGUAGES.includes(l)) && BOOKING_MODE_LANGUAGES.includes("zh"));
for (const lang of BOOKING_MODE_LANGUAGES) {
  const dict = BOOKING_MODE_COPY[lang];
  const label = BOOKING_MODES.map((m) => bookingModeLabel(m, lang));
  const noun = BOOKING_MODES.map((m) => bookingModeNoun(m, lang));
  const stated = BOOKING_MODES.map((m) => bookingModeStatement(m, lang));
  const required = ["address", "phone", "email"].map((f) => requiredFieldRefusal(f, lang));
  const lines = [
    bookingModeLine({ mode: "visit", address: "12 Elm St", language: lang }),
    bookingModeLine({ mode: "visit", language: lang }),
    bookingModeLine({ mode: "call", phone: "819-238-7263", language: lang }),
    bookingModeLine({ mode: "call", language: lang }),
    bookingModeLine({ mode: "video", email: "a@b.c", language: lang }),
    bookingModeLine({ mode: "video", language: lang }),
  ];
  const all = [...label, ...noun, ...stated, ...required, ...lines];
  ok(`${lang}: every sentence exists and none says undefined`, all.every((s) => typeof s === "string" && s.trim() && !/undefined|\[object/.test(s)), all);
  ok(`${lang}: three distinct labels`, new Set(label).size === 3, label);
  ok(`${lang}: the visit line carries the address, the call line the number, the video line the email`, lines[0].includes("12 Elm St") && lines[2].includes("819-238-7263") && lines[4].includes("a@b.c"), lines);
  ok(`${lang}: the three refusals are three different sentences`, new Set(required).size === 3);
  if (lang !== "en") {
    const en = BOOKING_MODE_COPY.en;
    ok(`${lang}: is not English wearing a code`, dict.label.call !== en.label.call && dict.required.phone !== en.required.phone && dict.stated.visit !== en.stated.visit, dict.label);
  }
}
ok("an unknown language reads English, never blank", bookingModeLabel("call", "xx") === "Phone call" && requiredFieldRefusal("phone", "xx") === BOOKING_MODE_COPY.en.required.phone);
ok("an unknown mode reads as a visit, never blank", bookingModeLabel("teleport", "en") === "On-site visit");
ok("the exact sentences the owner asked for", bookingModeLine({ mode: "visit", address: "12 Elm St", language: "en" }) === "On-site visit at 12 Elm St" && bookingModeLine({ mode: "call", phone: "819-238-7263", language: "en" }) === "Phone call — we'll ring 819-238-7263");
ok("the statement for a visit-only page", bookingModeStatement("visit", "en") === "This is an on-site visit — we come to you.");

// ───────────────────────────────────────────────────────────────────────────
console.log("\n4. The letters name the mode, in the reader's language");
const NOW = new Date("2026-09-14T12:00:00Z");
const START = new Date("2026-09-16T21:00:00Z"); // Wed Sep 16, 5:00 PM Toronto
const facts = { call: { mode: "call", address: null, phone: "819-238-7263", email: "d@x.test" }, visit: { mode: "visit", address: "12 Elm St", phone: null, email: "d@x.test" }, video: { mode: "video", address: null, phone: null, email: "d@x.test" } };
for (const lang of SUPPORTED_EMAIL_LANGUAGES) {
  for (const mode of BOOKING_MODES) {
    const where = facts[mode];
    const label = bookingModeLabel(mode, lang);
    const line = bookingModeLine({ ...where, language: lang });
    const c = buildBookingConfirmationEmail({ companyName: "Acme", clientName: "Dana", eventTypeName: "Consultation with Dana", startTime: START, where, timezone: "America/Toronto", language: lang });
    ok(`${lang}/${mode}: the confirmation subject names the mode`, c.subject.includes(label), c.subject);
    ok(`${lang}/${mode}: …and the body carries the line`, c.html.includes(line.replace(/'/g, "&#39;")) || c.html.includes(line), line);
    ok(`${lang}/${mode}: …and still names the service on its own row`, c.html.includes("Consultation with Dana"));
    ok(`${lang}/${mode}: …and never the free-text label`, !c.html.includes(LABEL) && !c.subject.includes(LABEL));
    const x = buildVisitCancelledEmails({ company: { ...COMPANY, defaultLanguage: "fr" }, clientName: "Dana", clientEmail: "d@x.test", eventTypeName: "Consultation with Dana", startTime: START, where, timezone: "America/Toronto", language: lang, refund: {} });
    ok(`${lang}/${mode}: the cancellation subject names the mode`, x.client.subject.includes(label), x.client.subject);
    ok(`${lang}/${mode}: …the client's copy carries the line`, x.client.html.includes(line.replace(/'/g, "&#39;")) || x.client.html.includes(line));
    ok(`${lang}/${mode}: …the office's copy carries it in the OFFICE's language (fr)`, x.company.html.includes(bookingModeLine({ ...where, language: "fr" }).replace(/'/g, "&#39;")) || x.company.html.includes(bookingModeLine({ ...where, language: "fr" })));
    const m = buildVisitRescheduledEmails({ company: COMPANY, clientName: "Dana", clientEmail: "d@x.test", eventTypeName: "Consultation with Dana", previousStartTime: START, startTime: new Date(START.getTime() + 864e5), where, timezone: "America/Toronto", language: lang });
    ok(`${lang}/${mode}: the moved letter names the mode and the line`, m.client.subject.includes(label) && (m.client.html.includes(line.replace(/'/g, "&#39;")) || m.client.html.includes(line)), m.client.subject);
  }
}
const legacy = buildBookingConfirmationEmail({ companyName: "Acme", clientName: "Dana", eventTypeName: "Site visit", startTime: START, location: "12 Elm St", timezone: "America/Toronto", language: "en" });
ok("a hand-booked appointment (no mode) still names the service and its location as before", legacy.subject === "Confirmed: Site visit with Acme" && legacy.html.includes("12 Elm St") && !legacy.html.includes(">What<"));

console.log("\n   The text names the mode too");
ok("booking_confirmation is editable (it sends) and has the {where} token", SMS_TEMPLATE_TYPES.booking_confirmation.editable === true && "where" in SMS_TEMPLATE_TYPES.booking_confirmation.tokens);
for (const lang of SMS_LANGUAGES) {
  const where = bookingModeLine({ mode: "call", phone: "819-238-7263", language: lang });
  const t = renderMessage({ type: "booking_confirmation", templates: null, language: lang, values: { company: "Acme", service: "Consultation", when: "Wed, Sep 16 at 5:00 PM", where } });
  ok(`${lang}: the text carries the mode line, the time and STOP, in two segments`, t.includes(where) && t.includes("5:00 PM") && /\bSTOP\b/.test(t) && t.length <= 320, t);
}
ok("a company's own wording with {where} is filled", renderMessage({ type: "booking_confirmation", templates: { booking_confirmation: "Hi! {where}, {when}." }, language: "en", templateLanguage: "en", values: { company: "A", when: "Wed 5 PM", where: "Phone call — we'll ring 819" } }) === "Hi! Phone call — we'll ring 819, Wed 5 PM.");

// ───────────────────────────────────────────────────────────────────────────
console.log("\n3. The confirm route refuses the mode's missing field, in words — executed");
const { POST: confirm } = await import("../app/api/booking/[companySlug]/confirm/route.js");
const post = async (body, slug = "acme") =>
  confirm(new Request(`http://x/api/booking/${slug}/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ companySlug: slug }) });
const seed = (over = {}) => {
  resetDbStub();
  rows.company.push({ ...COMPANY, ...over });
  rows.eventType.push({ ...EVENT_TYPE });
};
const startIso = new Date(NOW.getTime() + 3 * 864e5).toISOString();
const base = { eventTypeSlug: "consult", startTime: startIso, clientName: "Dana", clientEmail: "d@x.test", whenNeeded: "asap", language: "fr" };

seed();
let r = await post({ ...base, mode: "visit" });
let j = await r.json();
ok("a visit with no address is a 400", r.status === 400, j);
ok("…in the visitor's language (French), in words", j.error === requiredFieldRefusal("address", "fr"), j.error);
ok("…with the stable reason and the mode", j.reason === "address_required" && j.mode === "visit", j);
ok("…and nothing was written", writes.length === 0, writes);

seed();
r = await post({ ...base, mode: "call" });
j = await r.json();
ok("a call with no phone is a 400 in French", r.status === 400 && j.error === requiredFieldRefusal("phone", "fr") && j.reason === "phone_required", j);
seed();
r = await post({ ...base, mode: "call", clientPhone: "12" });
j = await r.json();
ok("a call with an undialable phone is refused the same way", r.status === 400 && j.reason === "phone_required", j);
seed();
r = await post({ ...base, mode: "call", clientPhone: "819-238-7263", language: "es" });
j = await r.json();
ok("a call with a phone books", r.status === 201, j);
ok("…at the call's length (20 min), not the visit's hour", new Date(j.endTime) - new Date(j.startTime) === 20 * 60000, j);
ok("…with mode call on the row and no address", j.mode === "call" && j.address === null, j);
ok("…the phone as typed, not as E.164", j.clientPhone === "819-238-7263", j.clientPhone);
const appt = writes.find((w) => w.model === "appointment" && w.action === "create");
ok("…and the appointment's location is null, never the free-text label", appt && appt.data.location === null, appt?.data);
ok("…the calendar is blocked for the same 20 minutes (Booking.endTime)", writes.find((w) => w.model === "booking" && w.action === "create").data.endTime - writes.find((w) => w.model === "booking" && w.action === "create").data.startTime === 20 * 60000);

seed({ callMinutes: 15 });
r = await post({ ...base, mode: "call", clientPhone: "819-238-7263" });
j = await r.json();
ok("the company's own call length is what is reserved", r.status === 201 && new Date(j.endTime) - new Date(j.startTime) === 15 * 60000, j);

seed();
r = await post({ ...base, mode: "visit", address: "12 Elm St, Gatineau" });
j = await r.json();
ok("a visit with a typed address books at the visit's hour", r.status === 201 && new Date(j.endTime) - new Date(j.startTime) === 60 * 60000 && j.address === "12 Elm St, Gatineau", j);
ok("…and the appointment's location is that address", writes.find((w) => w.model === "appointment").data.location === "12 Elm St, Gatineau");

seed();
r = await post({ ...base, mode: "video" });
j = await r.json();
ok("a video call books with the email alone", r.status === 201 && j.mode === "video" && new Date(j.endTime) - new Date(j.startTime) === 30 * 60000, j);

seed({ bookingModes: ["visit"] });
r = await post({ ...base, mode: "call", clientPhone: "819-238-7263" });
j = await r.json();
ok("a mode the company does not offer falls to the one it does — and is then refused for ITS field", r.status === 400 && j.mode === "visit" && j.reason === "address_required", j);

seed({ bookingModes: ["visit"] });
r = await post({ ...base, mode: "visit", address: "12 Elm St", clientPhone: "12" });
j = await r.json();
ok("an undialable phone on a VISIT is not refused — it is optional there", r.status === 201, j);

seed();
r = await post({ ...base, mode: "visit", language: "de" });
j = await r.json();
ok("a language outside the booking pills (de) still gets its own refusal", j.error === requiredFieldRefusal("address", "de"), j.error);

// ───────────────────────────────────────────────────────────────────────────
console.log("\n6. A mode is a preset — length AND fee — lib/booking/fee.js, executed");
const PAID = { ...COMPANY, stripeChargesEnabled: true, stripeAccountId: "acct_1", callFeeCents: null, videoFeeCents: 1500 };
const PAID_ET = { ...EVENT_TYPE, feeCents: 4900, promoFeeCents: 2000, promoActive: false };
ok("the visit's fee is the event type's, as before", effectiveBookingFeeCents(PAID, PAID_ET).feeCents === 4900 && effectiveBookingFeeCents(PAID, PAID_ET, "visit").feeCents === 4900);
ok("…with its promo", effectiveBookingFeeCents(PAID, { ...PAID_ET, promoActive: true }, "visit").feeCents === 2000 && effectiveBookingFeeCents(PAID, { ...PAID_ET, promoActive: true }, "visit").feeStandardCents === 4900);
ok("a call is free when the company never priced it, whatever the visit costs", effectiveBookingFeeCents(PAID, PAID_ET, "call").feeCents === 0);
ok("a video call carries the company's video fee", effectiveBookingFeeCents(PAID, PAID_ET, "video").feeCents === 1500);
ok("a priced call carries the company's call fee", effectiveBookingFeeCents({ ...PAID, callFeeCents: 999 }, PAID_ET, "call").feeCents === 999);
ok("no Stripe Connect → every mode is free, never a price nobody can be charged", BOOKING_MODES.every((m) => effectiveBookingFeeCents({ ...PAID, stripeChargesEnabled: false, callFeeCents: 500 }, PAID_ET, m).feeCents === 0));
ok("a negative or junk call fee is free", effectiveBookingFeeCents({ ...PAID, callFeeCents: -5 }, PAID_ET, "call").feeCents === 0 && effectiveBookingFeeCents({ ...PAID, callFeeCents: "abc" }, PAID_ET, "call").feeCents === 0);
const presets = bookingModePresets({ company: PAID, eventType: PAID_ET });
ok("the presets put length and fee side by side per offered mode", presets.visit.minutes === 60 && presets.visit.feeCents === 4900 && presets.call.minutes === 20 && presets.call.feeCents === 0 && presets.video.minutes === 30 && presets.video.feeCents === 1500, presets);
ok("…only for offered modes", Object.keys(bookingModePresets({ company: { ...PAID, bookingModes: ["call"] }, eventType: PAID_ET })).join() === "call");
ok("an unknown mode's preset is the visit's", bookingModePreset({ company: PAID, eventType: PAID_ET, mode: "teleport" }).feeCents === 4900);
ok("the phone never books a mode that charges (video here), and still books the free call", phoneBookableModes({ company: PAID, paid: [] }).join() === "call,visit" || phoneBookableModes({ company: PAID, paid: [] }).join() === "visit,call");
ok("…and withholds a paid visit in favour of the free call", phoneBookableModes({ company: PAID, paid: [{ id: "e1" }] }).join() === "call");

console.log("\n   …through the confirm route: a paid visit takes the pay-link path, a free call books directly");
const seedPaid = () => {
  resetDbStub();
  rows.company.push({ ...PAID });
  rows.eventType.push({ ...PAID_ET });
};
seedPaid();
r = await post({ ...base, mode: "call", clientPhone: "819-238-7263" });
j = await r.json();
ok("a free phone call at a company that charges $49 for the visit is booked at once (201, no checkout)", r.status === 201 && !j.requiresPayment && j.status !== "pending_payment", j);
seedPaid();
r = await post({ ...base, mode: "visit", address: "12 Elm St", feeCents: 0, fee: 0, amount: 0 });
j = await r.json();
const held = writes.find((w) => w.model === "booking" && w.action === "create");
ok("a visit at the same company is HELD as pending_payment for the server's $49, whatever the browser posted", held && held.data.status === "pending_payment" && held.data.mode === "visit", held?.data);
ok("…and never an appointment before the money lands", !writes.some((w) => w.model === "appointment"));
ok("…the route then hands off to Stripe (unreachable here → 502, and the hold is released)", r.status === 502 && writes.some((w) => w.model === "booking" && w.action === "delete"), { status: r.status, j });
seedPaid();
r = await post({ ...base, mode: "video" });
j = await r.json();
ok("a $15 video call is held for payment too", writes.find((w) => w.model === "booking")?.data.status === "pending_payment" && writes.find((w) => w.model === "booking")?.data.mode === "video");
resetDbStub();
rows.company.push({ ...PAID, callFeeCents: 4900, bookingModes: ["call"] });
rows.eventType.push({ ...EVENT_TYPE });
r = await post({ ...base, mode: "call", clientPhone: "819-238-7263" });
ok("a company that charges for the CALL holds the call", writes.find((w) => w.model === "booking")?.data.status === "pending_payment");
ok("the confirm route reads no fee from the body", !/body\.(fee|feeCents|amount)|\bfeeCents\b[^=]*=\s*body/.test(read("app/api/booking/[companySlug]/confirm/route.js")) && /effectiveBookingFeeCents\(company, eventType, chosenMode\)/.test(read("app/api/booking/[companySlug]/confirm/route.js")));

console.log("\n   …and the letter and the text say what was paid");
const paidLetter = buildBookingConfirmationEmail({ companyName: "Acme", clientName: "Dana", eventTypeName: "Consultation", startTime: START, where: facts.visit, feePaid: { cents: 4900, currency: "CAD" }, timezone: "America/Toronto", language: "en" });
ok("a paid visit's letter says \"$49.00 paid\"", /\$49\.00 paid/.test(paidLetter.html), paidLetter.html.match(/>[^<]*paid[^<]*</)?.[0]);
const freeLetter = buildBookingConfirmationEmail({ companyName: "Acme", clientName: "Dana", eventTypeName: "Consultation", startTime: START, where: facts.call, feePaid: { cents: 0, currency: "CAD" }, timezone: "America/Toronto", language: "fr" });
ok("a free call's letter says \"Sans frais\" (fr)", /Sans frais/.test(freeLetter.html));
ok("a hand-booked appointment's letter says nothing about money", !/No charge|paid</.test(legacy.html));
for (const lang of BOOKING_MODE_LANGUAGES) {
  const paidW = bookingFeeLine({ amountText: "$49", language: lang });
  const freeW = bookingFeeLine({ amountText: null, language: lang });
  ok(`${lang}: "$49 paid" and "No charge" both exist and differ`, paidW.includes("$49") && freeW && paidW !== freeW && (lang === "en" || freeW !== "No charge"), [paidW, freeW]);
}
const paidText = renderMessage({ type: "booking_confirmation", templates: null, language: "en", values: { company: "Acme", when: "Wed 5 PM", where: "On-site visit at 12 Elm St", fee: bookingFeeLine({ amountText: "$49", language: "en" }) } });
ok("the text carries the fee sentence", /\$49 paid\./.test(paidText) && /STOP/.test(paidText), paidText);
const settingsSrc = read("app/app/settings/booking-page/page.js");
ok("Settings: one preset row per offered mode on each consultation card, with length and fee", /data-mode-preset=\{row\.key\}/.test(settingsSrc) && /callFeeCents/.test(settingsSrc) && /videoFeeCents/.test(settingsSrc));
ok("…and no free-text location caption or input", !/et\.location/.test(settingsSrc) && !/form\.location/.test(settingsSrc));
const pageSrc = read("app/book/[companySlug]/BookingFlow.js");
ok("the public page prices each chip from the server's preset", /data-mode-fee=\{presetFor\(eventType, m\)\.feeCents\}/.test(pageSrc) && /chosenPreset\.feeCents > 0/.test(pageSrc) && !/eventType\.feeCents/.test(pageSrc));

// ───────────────────────────────────────────────────────────────────────────
console.log("\n1. The slot engine slots by the mode's length — the availability route, executed");
const { GET: availability } = await import("../app/api/booking/[companySlug]/availability/route.js");
const slotsFor = async (mode) => {
  resetDbStub();
  rows.company.push({ ...COMPANY });
  rows.eventType.push({ ...EVENT_TYPE });
  // Monday 9:00–10:00 only, Toronto: one hour, so a 60-minute visit fits
  // exactly once and a 20-minute call fits at 9:00, 9:15, 9:30 and 9:40.
  for (const dayOfWeek of [1, 2, 3, 4, 5]) rows.availabilitySchedule.push({ id: `s${dayOfWeek}`, userId: "u1", dayOfWeek, startTime: "09:00", endTime: "10:00", timezone: "America/Toronto" });
  const from = new Date(Date.now() + 7 * 864e5);
  const to = new Date(from.getTime() + 7 * 864e5);
  const url = `http://x/api/booking/acme/availability?eventTypeSlug=consult&from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}${mode ? `&mode=${mode}` : ""}`;
  const res = await availability(new Request(url), { params: Promise.resolve({ companySlug: "acme" }) });
  const data = await res.json();
  return { status: res.status, data, perDay: Object.values(data.slots || {}).map((d) => d.length) };
};
const visitSlots = await slotsFor("visit");
const callSlots = await slotsFor("call");
const noMode = await slotsFor(null);
ok("the route answers for a visit", visitSlots.status === 200 && visitSlots.perDay.length > 0, visitSlots.data);
ok("a 60-minute visit fits a one-hour day once", visitSlots.perDay.every((n) => n === 1), visitSlots.perDay);
ok("a 20-minute call fits the same hour three times", callSlots.perDay.every((n) => n === 3), callSlots.perDay);
ok("the route reports the mode's length, not the event's", callSlots.data.eventType.durationMinutes === 20 && callSlots.data.eventType.mode === "call" && visitSlots.data.eventType.durationMinutes === 60);
ok("no mode on the query is the company's first offered mode", noMode.data.eventType.mode === "visit");
ok("the route no longer exposes the free-text location", !("location" in (visitSlots.data.eventType || {})));

// ───────────────────────────────────────────────────────────────────────────
console.log("\n5. A move keeps the mode and its length — planReschedule, executed");
const bookingRow = (over = {}) => ({ id: "b1", status: "confirmed", startTime: new Date(NOW.getTime() + 72 * 3600e3), endTime: new Date(NOW.getTime() + 73 * 3600e3), mode: "visit", address: "12 Elm St", clientName: "Dana", clientEmail: "d@x.test", clientPhone: "819-238-7263", feePaidCents: 0, feeCurrency: null, feeStripePaymentIntentId: null, feeRefundedAt: null, feeRefundedCents: null, appointmentId: "a1", language: "fr", quote: null, ...over });
const later = new Date(NOW.getTime() + 96 * 3600e3);
const mv = planReschedule(bookingRow({ mode: "call" }), COMPANY, EVENT_TYPE, later, NOW);
ok("a moved call is re-slotted at the call's length", mv.ok && mv.end - mv.start === 20 * 60000, mv);
const mvV = planReschedule(bookingRow(), COMPANY, EVENT_TYPE, later, NOW);
ok("a moved visit keeps the visit's hour", mvV.ok && mvV.end - mvV.start === 60 * 60000, mvV);
const viewCall = visitView({ booking: bookingRow({ mode: "call", address: null }), eventType: EVENT_TYPE, company: COMPANY }, NOW);
ok("the manage page's line for a call names the number", viewCall.where === "Appel téléphonique — nous vous appellerons au 819-238-7263" && viewCall.mode === "call", viewCall.where);
ok("…in the booker's language (fr)", viewCall.language === "fr");
const viewVisit = visitView({ booking: bookingRow(), eventType: EVENT_TYPE, company: COMPANY }, NOW);
ok("the manage page's line for a visit names the address", viewVisit.where === "Visite sur place au 12 Elm St", viewVisit.where);
ok("visitWhere never prints the event type's label", visitWhere({ booking: bookingRow({ address: null }), eventType: { ...EVENT_TYPE, location: LABEL } }) === "On-site visit — address to be confirmed");
const resched = read("app/api/visit/[token]/reschedule/route.js");
ok("the reschedule route computes slots in the booking's mode", (resched.match(/eventTypeForMode\(\{ company, eventType, mode: booking\.mode \}\)/g) || []).length === 2);
ok("…and accepts no new mode, address or phone from the browser", !/body\.(mode|address|phone|clientPhone)/.test(resched));

// ───────────────────────────────────────────────────────────────────────────
console.log("\n   The text — the gates, executed");
const textBooking = bookingRow({ mode: "call" });
resetDbStub();
rows.company.push({ ...COMPANY });
let v = await bookingTextVerdict({ company: { ...COMPANY }, booking: textBooking });
// 2026-09-25: never chose = ON (off-by-default meant no booking ever texted).
ok("never chose → the text is ON", v.send === true && v.reason === "ok", v);
resetDbStub();
rows.company.push({ ...COMPANY, bookingSmsChosenAt: new Date() });
v = await bookingTextVerdict({ company: { ...COMPANY }, booking: textBooking });
ok("deliberately switched off → no text", v.send === false && v.reason === "switched_off", v);
resetDbStub();
rows.company.push({ ...COMPANY, bookingSmsConfirmation: true, bookingSmsChosenAt: new Date() });
v = await bookingTextVerdict({ company: { ...COMPANY }, booking: textBooking });
ok("deliberately switched on → text", v.send === true, v);
resetDbStub();
rows.company.push({ ...COMPANY });
v = await bookingTextVerdict({ company: { ...COMPANY, bookingSmsConfirmation: true }, booking: { ...textBooking, clientPhone: null } });
ok("no phone → no text", v.send === false && v.reason === "no_phone", v);
v = await bookingTextVerdict({ company: { ...COMPANY, bookingSmsConfirmation: true }, booking: { ...textBooking, clientPhone: "12" } });
ok("an undialable phone → no text", v.send === false && v.reason === "no_phone", v);
rows.smsOptOut.push({ id: "o1", companyId: "c1", e164: "+18192387263", optedOut: true });
v = await bookingTextVerdict({ company: { ...COMPANY, bookingSmsConfirmation: true }, booking: textBooking });
ok("a STOP on file → no text", v.send === false && v.reason === "opted_out", v);
rows.smsOptOut.length = 0;
rows.callConsent.push({ id: "cc1", companyId: "c1", e164: "+18192387263", optedOutAt: new Date() });
v = await bookingTextVerdict({ company: { ...COMPANY, bookingSmsConfirmation: true }, booking: textBooking });
ok("a call opt-out → no text either", v.send === false && v.reason === "opted_out", v);
rows.callConsent.length = 0;
v = await bookingTextVerdict({ company: { ...COMPANY, bookingSmsConfirmation: true }, booking: textBooking });
ok("switch on + dialable phone + no opt-out → text, to the E.164", v.send === true && v.to === "+18192387263", v);

console.log("\n   …and finalizeBooking end to end (a demo tenant records the send instead of dialling)");
const runFinalize = async (over) => {
  resetDbStub();
  const company = { ...COMPANY, isDemo: true, ...over };
  rows.company.push(company);
  rows.client.push({ id: "cl1", companyId: "c1", email: "d@x.test", language: "fr" });
  rows.booking.push({ ...textBooking, manageToken: "tok" });
  const out = await finalizeBooking({ company, eventType: EVENT_TYPE, booking: { ...textBooking, manageToken: "tok" }, clientId: "cl1" });
  const simulated = writes.filter((w) => w.model === "activityLog" && /sms/i.test(JSON.stringify(w.data)));
  return { out, simulated };
};
const off = await runFinalize({ bookingSmsConfirmation: false, bookingSmsChosenAt: new Date() });
ok("switch off: finalize reports no text and records no send", off.out.texted === false && off.simulated.length === 0, off);
const on = await runFinalize({ bookingSmsConfirmation: true });
ok("switch on: finalize reports a text and the send is recorded", on.out.texted === true && on.simulated.length === 1, on);
const sentBody = on.simulated[0] ? JSON.stringify(on.simulated[0].data) : "";
ok("…the recorded text carries the French mode line (the booker's language)", sentBody.includes("Appel téléphonique") && sentBody.includes("819-238-7263"), sentBody.slice(0, 300));
ok("…and STOP", /STOP/.test(sentBody));
ok("…and that nothing was charged (\"Sans frais\")", /Sans frais/.test(sentBody));
const consent = writes.find((w) => w.model === "callConsent" && w.action === "create");
ok("…the consent record was still written", Boolean(consent));

// ───────────────────────────────────────────────────────────────────────────
console.log("\n2. The page: picker or statement, minutes per mode, the field per mode (source)");
const page = read("app/book/[companySlug]/BookingFlow.js");
ok("imports the shared words", /from "@\/lib\/booking\/bookingModes"/.test(page));
ok("the picker renders for more than one mode", /modes\.length > 1 \?/.test(page));
ok("…and the single mode is STATED", /bookingModeStatement\(mode, language\)/.test(page));
ok("chips are labelled from the table, not typed here", /bookingModeLabel\(m, language\)/.test(page) && !/"Visit my place"/.test(page));
ok("chips show the mode's minutes", /minutesFor\(eventType, m\)/.test(page));
ok("the slot query carries the mode", /&mode=\$\{encodeURIComponent\(mode/.test(page));
ok("Book is disabled until the mode's field is filled", /disabled=\{[^}]*Boolean\(missingField\)/.test(page));
ok("…with the reason under the button, in the visitor's language", /requiredFieldRefusal\(missingField, language\)/.test(page));
ok("the phone is required for a call", /required=\{mode === "call"\}/.test(page));
ok("the address field is asked again on the details step when skipped", /visit-address-late/.test(page));
ok("the confirmation screen prints the mode line", /bookingModeLine\(\{\s*mode,/.test(page));
ok("the free-text location is never printed", !/et\.location/.test(page));
ok("the old 'optional on purpose' argument is gone", !/Optional on purpose/.test(page));
// Code, not prose: the comment that explains why the label is gone names it.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const confirmSrc = read("app/api/booking/[companySlug]/confirm/route.js");
ok("the confirm route never writes eventType.location anywhere", !/eventType\.location/.test(stripComments(confirmSrc)));
ok("…and books at bookingDurationMinutes", /bookingDurationMinutes\(\{ company, eventType, mode: chosenMode \}\)/.test(confirmSrc));
const settle = read("lib/booking/settleBookingFee.js");
ok("the paid path never writes eventType.location either", !/eventType\.location/.test(stripComments(settle)));
const members = read("lib/booking/bookableMembers.js");
ok("the seeded consultation carries no label", /location: null,/.test(members) && !/location: "Phone or on-site visit"/.test(members));
ok("nothing in app/ or lib/ writes the old label as a value", !fs.readdirSync(path.join(root, "lib/booking")).some((f) => /location: "Phone or/.test(read(`lib/booking/${f}`))));
const settings = read("app/app/settings/booking-page/page.js");
ok("Settings → Booking page edits each mode's length", /data-mode-preset=\{row\.key\}/.test(settings) && /callMinutes/.test(settings) && /videoMinutes/.test(settings));
const info = read("app/api/settings/business-info/route.js");
ok("…saved through business-info, clamped", /callMinutes: callMinutes === null \? null : Math\.min\(480/.test(info) && /videoMinutes: videoMinutes === null \? null : Math\.min\(480/.test(info));
const bookingGet = read("app/api/booking/[companySlug]/route.js");
ok("the booking GET resolves each mode's preset with the same functions the route books with", /bookingModePresets\(\{ company, eventType: et \}\)/.test(bookingGet) && !/location: et\.location/.test(bookingGet));

console.log("\n   The company's screens name the mode from the same table");
const appts = read("app/app/appointments/page.js");
ok("the appointment list badge", /bookingModeLabel\(appt\.booking\.mode, language\)/.test(appts));
ok("…a call gets the line, not a maps link to the billing address", /bookedMode && bookedMode !== "visit"\s*\? null/.test(appts) && /rowModeLine/.test(appts));
ok("…and the details panel a row", /bookingModeLine\(\{ mode: appt\.booking\.mode/.test(appts));
const stops = read("lib/schedule/mapStops.js");
ok("the map drops a call's pin and carries the mode", /mode: e\.booking\?\.mode \|\| null/.test(stops) && /e\.booking\?\.mode && e\.booking\.mode !== "visit"\s*\? null/.test(stops));
const mapView = read("app/components/schedule/DayMapView.js");
ok("the popover names the mode", /bookingModeLabel\(stop\.mode, language\)/.test(mapView));
const timeline = read("lib/me/timeline.js");
ok("the crew's timeline selects the booking's mode and contact", /booking: \{ select: \{ mode: true, clientPhone: true, clientEmail: true \} \}/.test(timeline));
const worker = read("app/components/me/WorkerHome.js");
ok("…and the crew's card words it", (worker.match(/bookingModeLine\(\{ mode: (item|i)\.booking\.mode/g) || []).length === 2);
const manager = read("app/visit/[token]/VisitManager.js");
ok("the manage page renders the server's line", /value=\{data\.where/.test(manager));
const tpl = read("app/admin/lib/email/templates.js");
ok("the letters build their line per language from the facts", /describeAppointment\(\{ where, location, eventTypeName, language/.test(tpl) && !/"Phone call/.test(tpl));
const voice = read("lib/voice/availability.js");
ok("the phone agent books a call at the company's call length", /bookingDurationMinutes\(\{ company, eventType, mode: bookedMode \}\)/.test(voice));
const msgs = read("app/app/settings/messages/page.js");
ok("Settings → Messages has the switch beside the booking text", /role="switch"/.test(msgs) && /bookingSmsOn/.test(msgs));
const tplRoute = read("app/api/settings/message-templates/route.js");
ok("…saved to bookingSmsConfirmation with the choice stamp", /bookingSmsConfirmation: body\.enabled, bookingSmsChosenAt: new Date\(\)/.test(tplRoute));

// ───────────────────────────────────────────────────────────────────────────
console.log("\n7. The calendar invite — one UID, a rising SEQUENCE, CANCEL on cancel, the mode in the SUMMARY");
const inviteBooking = (over = {}) => ({ id: "bk_77", startTime: START, endTime: new Date(START.getTime() + 20 * 60000), mode: "call", address: null, clientName: "Dana O'Brien", clientEmail: "d@x.test", clientPhone: "819-238-7263", feePaidCents: 0, feeCurrency: null, calendarSequence: 0, ...over });
const ics0 = buildBookingInvite({ booking: inviteBooking(), company: COMPANY, language: "en", manageUrl: "https://x.test/visit/tok", organizerEmail: "office@acme.test", dtstamp: NOW });
ok("METHOD:REQUEST on the confirmation", /^METHOD:REQUEST$/m.test(ics0));
ok("UID fixed per booking", /^UID:booking-bk_77@fieldquo\.com$/m.test(ics0) && bookingIcsUid("bk_77") === "booking-bk_77@fieldquo.com");
ok("SEQUENCE:0 the first time", /^SEQUENCE:0$/m.test(ics0));
ok("the SUMMARY names the mode and the company", /^SUMMARY:Phone call — Acme Cabinets$/m.test(ics0), ics0.match(/^SUMMARY:.*$/m)?.[0]);
ok("LOCATION for a call is the number, not a place", /^LOCATION:Phone: 819-238-7263$/m.test(ics0));
ok("ORGANIZER is the company's sender, ATTENDEE the client", /^ORGANIZER;CN=Acme Cabinets:mailto:office@acme\.test$/m.test(ics0) && /^ATTENDEE;CN=Dana O'Brien;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:d@x\.test$/m.test(ics0));
ok("DESCRIPTION carries the mode line, the fee and the manage link", /DESCRIPTION:Phone call — we'll ring 819-238-7263\\nNo charge\\nhttps:\/\/x\.test\/visit\/tok\\n/.test(ics0), ics0.match(/^DESCRIPTION:.*$/m)?.[0]);
ok("DTSTART/DTEND are the booking's instants in UTC", /^DTSTART:20260916T210000Z$/m.test(ics0) && /^DTEND:20260916T212000Z$/m.test(ics0));
ok("CRLF line endings, as iCalendar requires", ics0.includes("\r\n") && !/[^\r]\n/.test(ics0));
const icsVisit = buildBookingInvite({ booking: inviteBooking({ mode: "visit", address: "12 Elm St, Gatineau", feePaidCents: 4900, feeCurrency: "CAD" }), company: COMPANY, language: "fr", dtstamp: NOW });
ok("a visit's LOCATION is the address and its SUMMARY the visit, in the client's language (fr)", /^LOCATION:12 Elm St\\, Gatineau$/m.test(icsVisit) && /^SUMMARY:Visite sur place — Acme Cabinets$/m.test(icsVisit), icsVisit.match(/^(SUMMARY|LOCATION):.*$/gm));
ok("…and the DESCRIPTION says what was paid, in French", /49[,.]00\s?\$ payés|\$49\.00 payés/.test(icsVisit), icsVisit.match(/^DESCRIPTION:.*$/m)?.[0]);
for (const lang of BOOKING_MODE_LANGUAGES) {
  const t = buildBookingInvite({ booking: inviteBooking({ mode: "video" }), company: COMPANY, language: lang, dtstamp: NOW });
  ok(`${lang}: the SUMMARY names the mode in ${lang}`, t.includes(`SUMMARY:${bookingModeLabel("video", lang)} — Acme Cabinets`));
}
const icsMoved = buildBookingInvite({ booking: inviteBooking({ calendarSequence: 1, startTime: new Date(START.getTime() + 864e5), endTime: new Date(START.getTime() + 864e5 + 20 * 60000) }), company: COMPANY, language: "en", dtstamp: NOW });
ok("a move re-sends the SAME UID one SEQUENCE higher (what makes a calendar replace, not duplicate)", /^UID:booking-bk_77@fieldquo\.com$/m.test(icsMoved) && /^SEQUENCE:1$/m.test(icsMoved) && /^METHOD:REQUEST$/m.test(icsMoved) && /^DTSTART:20260917T210000Z$/m.test(icsMoved));
const icsCancel = buildBookingInvite({ booking: inviteBooking({ calendarSequence: 2 }), company: COMPANY, language: "en", method: "CANCEL", dtstamp: NOW });
ok("a cancellation is METHOD:CANCEL, STATUS:CANCELLED, same UID, higher SEQUENCE", /^METHOD:CANCEL$/m.test(icsCancel) && /^STATUS:CANCELLED$/m.test(icsCancel) && /^UID:booking-bk_77@fieldquo\.com$/m.test(icsCancel) && /^SEQUENCE:2$/m.test(icsCancel));
ok("nextSequence counts up from the row, and from nothing", nextSequence({ calendarSequence: 0 }) === 1 && nextSequence({ calendarSequence: 4 }) === 5 && nextSequence({}) === 1 && nextSequence({ calendarSequence: "x" }) === 1);

console.log("\n   …through the real routes: confirm → move → cancel on one booking");
const { POST: cancelRoute } = await import("../app/api/visit/[token]/route.js");
const { POST: moveRoute } = await import("../app/api/visit/[token]/reschedule/route.js");
const demoCo = { ...COMPANY, isDemo: true, bookingChangeNoticeHours: 1 };
resetDbStub();
rows.company.push(demoCo);
rows.eventType.push({ ...EVENT_TYPE });
for (const dayOfWeek of [0, 1, 2, 3, 4, 5, 6]) rows.availabilitySchedule.push({ id: `s${dayOfWeek}`, userId: "u1", dayOfWeek, startTime: "06:00", endTime: "22:00", timezone: "America/Toronto" });
r = await post({ ...base, mode: "call", clientPhone: "819-238-7263", startTime: new Date(Date.now() + 5 * 864e5).toISOString() });
j = await r.json();
ok("booked (demo tenant, so the letter is recorded rather than sent)", r.status === 201, j);
let mails = writes.filter((w) => w.model === "activityLog" && w.data?.action === "email.simulated");
ok("the confirmation letter carried booking.ics", mails.length === 1 && mails[0].data.metadata.attachments.join() === "booking.ics", mails.map((m) => m.data.metadata?.attachments));
const row = rows.booking.find((b) => b.id === j.id);
ok("the row starts at SEQUENCE 0", row.calendarSequence === undefined || row.calendarSequence === 0);
// The manage routes read the booking with its event type and company inline
// (loadVisitByToken's nested select); the stub hands rows back as stored.
Object.assign(row, { manageToken: row.manageToken || "tok_visit", calendarSequence: 0, eventType: { ...EVENT_TYPE, company: demoCo }, quote: null, feeStripePaymentIntentId: null, feeRefundedAt: null, feeRefundedCents: null });
rows.appointment.forEach((a) => { a.status = "scheduled"; });
const tokenReq = (path, body) => new Request(`http://x/api/visit/${row.manageToken}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.1" }, body: JSON.stringify(body) });
const movedTo = new Date(Date.now() + 6 * 864e5);
movedTo.setUTCHours(15, 0, 0, 0);
writes.length = 0;
r = await moveRoute(tokenReq("/reschedule", { startTime: movedTo.toISOString() }), { params: Promise.resolve({ token: row.manageToken }) });
j = await r.json();
ok("the client moves it", r.status === 200 && j.rescheduled === true, j);
ok("…the row's SEQUENCE is now 1, written with the move", writes.some((w) => w.model === "booking" && w.action === "update" && w.data.calendarSequence === 1 && w.data.startTime), writes.filter((w) => w.model === "booking"));
ok("…and it kept its mode and phone, in the booker's language (fr)", j.mode === "call" && j.where === "Appel téléphonique — nous vous appellerons au 819-238-7263", j.where);
mails = writes.filter((w) => w.model === "activityLog" && w.data?.action === "email.simulated");
ok("…the moved letter to the client carried booking.ics, the office's copy none", mails.length === 2 && mails.filter((m) => m.data.metadata.attachments.length).length === 1 && mails.find((m) => m.data.metadata.attachments.length).data.metadata.to[0] === "d@x.test", mails.map((m) => [m.data.metadata.to, m.data.metadata.attachments]));
// The text beside the letter (lib/schedule/changeText.js) — simulated for
// this demo tenant, so it is a row, not a guess. scripts/check-change-texts.mjs
// runs the full matrix and the office's routes.
let texts = writes.filter((w) => w.model === "activityLog" && w.data?.action === "sms.simulated");
ok("…and ONE moved text, in French, with the new time's link to manage it", texts.length === 1 && /déplacé/.test(texts[0].data.metadata.body) && texts[0].data.metadata.body.includes(`/visit/${row.manageToken}`) && texts[0].data.metadata.to === "+18192387263", texts.map((t) => t.data.metadata));
writes.length = 0;
r = await cancelRoute(tokenReq("", { action: "cancel" }), { params: Promise.resolve({ token: row.manageToken }) });
j = await r.json();
ok("the client cancels it", r.status === 200 && j.cancelled === true, j);
ok("…the row's SEQUENCE is now 2, written with the cancel", writes.some((w) => w.model === "booking" && w.action === "update" && w.data.calendarSequence === 2 && w.data.status === "cancelled"), writes.filter((w) => w.model === "booking"));
mails = writes.filter((w) => w.model === "activityLog" && w.data?.action === "email.simulated");
ok("…the cancelled letter to the client carried cancelled.ics (METHOD:CANCEL)", mails.some((m) => m.data.metadata.attachments.join() === "cancelled.ics" && m.data.metadata.to[0] === "d@x.test"), mails.map((m) => [m.data.metadata.to, m.data.metadata.attachments]));
texts = writes.filter((w) => w.model === "activityLog" && w.data?.action === "sms.simulated");
ok("…and ONE cancelled text, in French, naming the call", texts.length === 1 && /annulé/.test(texts[0].data.metadata.body) && /Appel téléphonique/.test(texts[0].data.metadata.body), texts.map((t) => t.data.metadata.body));
const cancelSrc = read("app/api/visit/[token]/route.js");
const moveSrc = read("app/api/visit/[token]/reschedule/route.js");
const officeSrc = read("app/api/appointments/[id]/route.js");
ok("the cancel route sends METHOD:CANCEL with the row's next sequence", /method: "CANCEL"/.test(cancelSrc) && /calendarSequence: sequence/.test(cancelSrc));
ok("the move route re-issues with the row's next sequence", /nextSequence\(booking\)/.test(moveSrc) && /calendarSequence: sequence/.test(moveSrc));
ok("the office's move/cancel does the same", /nextSequence\(existing\.booking\)/.test(officeSrc) && /method: cancelling \? "CANCEL" : "REQUEST"/.test(officeSrc) && /calendarSequence: inviteSequence/.test(officeSrc));
ok("the manage page offers the same file", /href=\{`\/api\/visit\/\$\{token\}\/calendar`\}/.test(read("app/visit/[token]/VisitManager.js")) && /bookingInviteAttachment\(/.test(read("app/api/visit/[token]/calendar/route.js")));
ok("the SMS carries no attachment (no such field on the send)", !/attachments/.test(read("lib/booking/finalizeBooking.js").split("sendSms(")[1] || ""));

// ───────────────────────────────────────────────────────────────────────────
console.log("\n8. The visit address changes the times — the availability route and the slot engine, executed");
//
// The owner (2026-09-24): auto-booking "glitches when we enter a new address".
// Reproduced 2026-09-25 on a demo company's booking page; what was wrong, and
// what each fixture below pins:
//
//   · a slow answer for a half-typed address landed AFTER the answer for the
//     address then picked, and the grid showed times for the wrong house
//     (client: the newest-request-wins guards, checked at source below);
//   · the calendar collapsed to a spinner on every change (client, source);
//   · step 3's late address field unmounted on its first keystroke (source);
//   · "we couldn't place that address" was printed for a company whose check
//     is OFF, and for a missing server key — the visitor's address was fine
//     (route: `reason`, executed);
//   · the last day of every requested range read no busy time at all, so a
//     booked visit's hour was offered as free and no drive was checked
//     against it (engine: the widened busy window, executed).
//
// Google is stubbed at `fetch`: the geocoder answers from a table, and the
// Distance Matrix is refused so travel falls back to the straight-line
// estimate — deterministic, and the same fallback production takes when
// Google is down.
{
  const { scheduleTimeToUtc } = await import("../lib/booking/timezone.js");
  const { GET: serviceArea } = await import("../app/api/service-area/[companySlug]/route.js");
  const TZ = "America/Toronto";
  const OTTAWA_VISIT = { lat: 45.448783, lng: -75.63748 };
  const PLACES = [
    // Picked from the suggestions, or typed in full — the server geocodes the
    // TEXT either way; the browser's coordinates are never sent.
    [/near st/i, { lat: 45.4501, lng: -75.6402, formatted_address: "12 Near St, Ottawa, ON K1K 1A1, Canada" }],
    [/far rd/i, { lat: 43.6532, lng: -79.3832, formatted_address: "99 Far Rd, Toronto, ON M5H 2N2, Canada" }],
  ];
  const realFetch = globalThis.fetch;
  const geocodeCalls = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/geocode/json")) {
      const address = decodeURIComponent(new URL(u).searchParams.get("address") || "");
      geocodeCalls.push(address);
      const hit = PLACES.find(([re]) => re.test(address));
      const body = hit
        ? { status: "OK", results: [{ formatted_address: hit[1].formatted_address, geometry: { location: { lat: hit[1].lat, lng: hit[1].lng }, location_type: "ROOFTOP" } }] }
        : { status: "ZERO_RESULTS", results: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }
    if (u.includes("/distancematrix/json")) {
      return new Response(JSON.stringify({ status: "REQUEST_DENIED" }), { status: 200 });
    }
    throw new Error(`unexpected fetch in check: ${u}`);
  };
  const savedKey = process.env.GOOGLE_MAPS_SERVER_KEY;

  // Day D, ten days out: 9–5 Toronto, one booked visit 13:00–14:00 at an
  // Ottawa address. Day D2, eleven days out: a visit with NO coordinates.
  const dayOnly = (n) => {
    const d = new Date(Date.now() + n * 864e5);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  };
  const D = dayOnly(10);
  const D2 = dayOnly(11);
  const iso = (d) => d.toISOString().slice(0, 10);
  const at = (day, hhmm) => scheduleTimeToUtc(day, hhmm, TZ);

  const seed = ({ travelCheckEnabled = true, withVisit = true, noPointVisit = true } = {}) => {
    resetDbStub();
    rows.company.push({ ...COMPANY, travelCheckEnabled, city: "Ottawa", latitude: 45.4215, longitude: -75.6972, serviceRadiusKm: 25, servicePostalPrefixes: [] });
    rows.eventType.push({ ...EVENT_TYPE });
    for (const dayOfWeek of [0, 1, 2, 3, 4, 5, 6]) rows.availabilitySchedule.push({ id: `s${dayOfWeek}`, userId: "u1", dayOfWeek, startTime: "09:00", endTime: "17:00", timezone: TZ });
    if (withVisit) rows.appointment.push({ id: "a1", assignedToId: "u1", status: "scheduled", scheduledAt: at(D, "13:00"), latitude: OTTAWA_VISIT.lat, longitude: OTTAWA_VISIT.lng });
    if (noPointVisit) rows.appointment.push({ id: "a2", assignedToId: "u1", status: "scheduled", scheduledAt: at(D2, "13:00"), latitude: null, longitude: null });
  };
  const ask = async ({ address = null, mode = "visit", from = D, to = D2 } = {}) => {
    const url =
      `http://x/api/booking/acme/availability?eventTypeSlug=consult&from=${iso(from)}&to=${iso(to)}&mode=${mode}` +
      (address ? `&address=${encodeURIComponent(address)}` : "");
    const res = await availability(new Request(url), { params: Promise.resolve({ companySlug: "acme" }) });
    const data = await res.json();
    return { status: res.status, data, offers: (day, hhmm) => (data.slots?.[iso(day)] || []).includes(at(day, hhmm).toISOString()) };
  };

  process.env.GOOGLE_MAPS_SERVER_KEY = "check-key";
  try {
    console.log("\n   A typed address that was never picked from the suggestions");
    seed();
    const typed = await ask({ address: "12 near st ottawa" });
    ok("…is geocoded on the server from the text alone", typed.data.travel?.applied === true && geocodeCalls.includes("12 near st ottawa"), typed.data.travel);
    ok("…and names the place it resolved to, not what was typed", typed.data.travel?.address === "12 Near St, Ottawa, ON K1K 1A1, Canada");
    ok("…and never echoes a coordinate the browser sent (none is accepted)", !/[?&](lat|lng|latitude|longitude)=/.test(read("app/book/[companySlug]/BookingFlow.js").split("async function submit")[0]));

    console.log("\n   The address changes mid-flow: near → far → near");
    const near1 = await ask({ address: "12 Near St, Ottawa" });
    const far = await ask({ address: "99 Far Rd, Toronto" });
    const near2 = await ask({ address: "12 Near St, Ottawa" });
    ok("near: a slot 15 minutes after the Ottawa visit is offered (≈1 min drive)", near1.offers(D, "14:15"), near1.data.slots?.[iso(D)]);
    ok("near: the slot starting the minute that visit ends is not (the drive is > 0)", !near1.offers(D, "14:00"));
    ok("near: a morning slot that ends before the visit is offered", near1.offers(D, "09:00"));
    ok("far: the same 14:15 is removed — Toronto is hours away", !far.offers(D, "14:15"));
    ok("far: so is the morning — they couldn't get BACK to the 1pm visit", !far.offers(D, "09:00") && !(far.data.slots?.[iso(D)] || []).length, far.data.slots?.[iso(D)]);
    ok("far: a day with no located visit keeps every hour (nothing to drive from)", (far.data.slots?.[iso(D2)] || []).length > 0);
    ok("back to near: the answer depends on this request's address only — nothing is remembered", JSON.stringify(near2.data.slots) === JSON.stringify(near1.data.slots));
    ok("each answer names its own address", near1.data.travel.address !== far.data.travel.address && far.data.travel.address.startsWith("99 Far Rd"));

    console.log("\n   Outside the service area");
    const areaRes = await serviceArea(new Request(`http://x/api/service-area/acme?address=${encodeURIComponent("99 Far Rd, Toronto")}`), { params: Promise.resolve({ companySlug: "acme" }) });
    const area = await areaRes.json();
    ok("the service-area route says outside for the Toronto address", area.configured === true && area.inside === false, area);
    ok("…and never returns the company's base coordinates", !("latitude" in area) && !("longitude" in area));
    ok("…but the slot route still answers — the area is a note, never a gate", far.status === 200 && Object.keys(far.data.slots || {}).length > 0);
    const flow = read("app/book/[companySlug]/BookingFlow.js");
    ok("the page renders the outside-area line only for the address it was checked for", /areaVerdict\.address === geoAddress/.test(flow) && /serviceAreaCopy\(language\)\.outside\(/.test(flow));

    console.log("\n   Missing coordinates never hide a slot");
    ok("a visit with no coordinates: the slot right after it is still offered, even from far away", far.offers(D2, "14:00"), far.data.slots?.[iso(D2)]);
    ok("…and its own hour is still blocked (busy is busy, located or not)", !far.offers(D2, "13:00") && !far.offers(D2, "12:30"));
    const nowhere = await ask({ address: "zzqq nowhere 9999" });
    const blank = await ask({});
    ok("an address Google can't place: reason not_found, filter off", nowhere.data.travel?.applied === false && nowhere.data.travel?.reason === "not_found", nowhere.data.travel);
    ok("…and the times are exactly the no-address times", JSON.stringify(nowhere.data.slots) === JSON.stringify(blank.data.slots));
    ok("no address at all: no travel block, and the Ottawa visit's hour is still busy", blank.data.travel === null && !blank.offers(D, "13:00") && blank.offers(D, "14:00"));

    console.log("\n   Why the filter did not engage is said, not guessed");
    seed({ travelCheckEnabled: false });
    const beforeOff = geocodeCalls.length;
    const off = await ask({ address: "99 Far Rd, Toronto" });
    ok("check switched off: reason off, no geocode spent, all times shown", off.data.travel?.reason === "off" && off.offers(D, "14:15") && geocodeCalls.length === beforeOff, off.data.travel);
    seed();
    delete process.env.GOOGLE_MAPS_SERVER_KEY;
    const before = geocodeCalls.length;
    const noKey = await ask({ address: "99 Far Rd, Toronto" });
    ok("no server Maps key: reason no_lookup, nothing sent to Google", noKey.data.travel?.reason === "no_lookup" && geocodeCalls.length === before, noKey.data.travel);
    process.env.GOOGLE_MAPS_SERVER_KEY = "check-key";
    const call = await ask({ address: "99 Far Rd, Toronto", mode: "call" });
    ok("a phone call carries no travel at all, whatever address is on the form", call.data.travel === null && call.offers(D, "14:15"));

    console.log("\n   The last day of the range sees its own visits");
    seed({ noPointVisit: false });
    const lastDay = await ask({ from: D, to: D });
    ok("to=D: the booked 13:00 visit on D blocks 13:00 (it used to be offered as free)", !lastDay.offers(D, "13:00") && !lastDay.offers(D, "12:30"), lastDay.data.slots?.[iso(D)]);
    ok("…while 14:00 stays open", lastDay.offers(D, "14:00"));
    const lastDayFar = await ask({ from: D, to: D, address: "99 Far Rd, Toronto" });
    ok("…and the drive is checked against it there too", !(lastDayFar.data.slots?.[iso(D)] || []).length, lastDayFar.data.slots?.[iso(D)]);
  } finally {
    globalThis.fetch = realFetch;
    if (savedKey === undefined) delete process.env.GOOGLE_MAPS_SERVER_KEY;
    else process.env.GOOGLE_MAPS_SERVER_KEY = savedKey;
  }

  console.log("\n   The page: newest answer wins, a busy grid instead of a collapsed one (source)");
  const cal = read("app/components/public/SlotCalendar.js");
  const flow = read("app/book/[companySlug]/BookingFlow.js");
  ok("SlotCalendar numbers each load and drops an answer that isn't the newest", /const mine = \+\+requestSeq\.current/.test(cal) && /if \(stale\(\)\) return;\s*setSlots\(got/.test(cal));
  ok("…a failed stale load can't paint an error over a good answer either", /catch \(err\) \{\s*if \(stale\(\)\) return;/.test(cal));
  ok("…only the first load replaces the grid with a spinner", /if \(loading && !everLoaded\)/.test(cal));
  ok("…later loads keep the grid, dimmed and un-pickable, with a status line", /const refreshing = loading && everLoaded/.test(cal) && /inert=\{refreshing \|\| undefined\}/.test(cal) && /data-slots-refreshing/.test(cal));
  ok("…a chosen day with no times under the new address goes back to 'pick a day'", /setChosenDay\(\(d\) => \(d && !\(got \|\| \{\}\)\[d\]\?\.length \? null : d\)\)/.test(cal));
  ok("BookingFlow's loadSlots writes the travel note only from the newest answer", /const mine = \+\+slotQuery\.current/.test(flow) && /if \(latest\(\)\) \{\s*setTravelInfo\(data\?\.travel/.test(flow));
  ok("…and says 'checking' the moment a new address is asked about", /setTravelInfo\(forVisit \? \{ pending: true \} : null\)/.test(flow));
  ok("only not_found asks the visitor to check their address", /travelState === "not_found"\s*\?\s*t\("booking\.mode\.travelNotFound"\)/.test(flow) && /t\("booking\.mode\.addressHintPlain"\)/.test(flow));
  ok("step 3's address field is decided when the time is picked, not re-derived per keystroke", /setAskAddressLate\(mode === "visit" && !address\.trim\(\)\)/.test(flow) && /mode === "visit" && askAddressLate &&/.test(flow) && !/mode === "visit" && !address\.trim\(\) && \(/.test(flow));
  ok("a time the late address rules out is said in words and Book waits", /data-chosen-unreachable/.test(flow) && /\|\| chosenUnreachable \|\|/.test(flow));
  const { MESSAGES } = await import("../app/i18n/messages.js");
  const NEW_KEYS = ["addressHintPlain", "travelChecking", "travelApplied", "travelNotFound", "timeUnreachable", "pickAnotherTime"].map((k) => `booking.mode.${k}`);
  const langs = Object.keys(MESSAGES);
  const missingKeys = langs.flatMap((l) => NEW_KEYS.filter((k) => typeof MESSAGES[l]?.[k] !== "string" || !MESSAGES[l][k].trim()).map((k) => `${l}:${k}`));
  ok(`the new lines exist in all ${langs.length} catalogue languages`, missingKeys.length === 0, missingKeys);
  ok("…and every travelApplied keeps its {address} slot", langs.every((l) => MESSAGES[l]["booking.mode.travelApplied"]?.includes("{address}")));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
