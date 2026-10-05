// scripts/check-booking-leads.mjs
//
//   npm run check:booking-leads
//
// A visit booked with no enquiry before it is a lead (2026-10-05) — executed
// against an in-memory store (scripts/fixtures/memoryPrisma.mjs) with the
// real createScoredLead, so the scoring, the attribution and the "no second
// lead" rule are run, not read:
//
//   1. the match: same email or phone (normalised) or the same estimate,
//      within 180 days, this company only, never a name alone;
//   2. ensureBookingLead: creates one (source booking_page, scored, the
//      page's landing as attribution, the service as its category, no
//      "New enquiry" alert), links a later booking to it, links to an
//      enquiry that already existed, an AI booking keeps its own channel,
//      a failure never throws;
//   3. the paid path settles, then links; the free and AI paths call it;
//   4. it reaches the agency funnel: channel "website", the booking's
//      appointment counted for the lead;
//   5. labels in nine languages, the help, wiring.
//
// Ends with a mutation pass over lib/booking/bookingLead.js (cp backups).

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MUTANT = process.argv.includes("--mutant");
const code = (rel) => readFileSync(join(ROOT, rel), "utf8");

const { findBookingLead, contactKeysOf, ensureBookingLead, bookingLeadSource, BOOKING_LEAD_WINDOW_DAYS } = await import("@/lib/booking/bookingLead");
const { settleBookingFee } = await import("@/lib/booking/settleBookingFee");
const { channelOf } = await import("@/lib/agency/channels");
const { loadLeadFacts } = await import("@/lib/agency/leadFacts");
const { leadSourceLabelKey } = await import("@/lib/leads/sourceLabel");
const { unaskedForScoring, NOT_ASKED_BY_SOURCE } = await import("@/lib/leads/qualifiers");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
const { db } = await import("@/lib/db");

let pass = 0;
const fails = [];
const ok = (label, cond, got) => {
  if (cond) {
    pass++;
    if (!MUTANT) console.log(`  ✓ ${label}`);
  } else {
    fails.push(`${label}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
    if (!MUTANT) console.log(`  ✗ ${label}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (t) => !MUTANT && console.log(`\n${t}`);
const NOW = new Date("2026-10-05T15:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000);
const CO = "co_bl";

// ═══════════════════════════════════════════════════════════════════════════
section("1. Whose lead is this booking?");
// ═══════════════════════════════════════════════════════════════════════════
const leads = [
  { id: "l_email", companyId: CO, email: "Ana.Lopez@Example.com ", phone: null, quoteId: null, createdAt: daysAgo(30) },
  { id: "l_phone", companyId: CO, email: null, phone: "(613) 555-0142", quoteId: null, createdAt: daysAgo(10) },
  { id: "l_quote", companyId: CO, email: "other@x.test", phone: null, quoteId: "q_9", createdAt: daysAgo(5) },
  { id: "l_old", companyId: CO, email: "old@x.test", phone: null, quoteId: null, createdAt: daysAgo(BOOKING_LEAD_WINDOW_DAYS + 1) },
  { id: "l_edge", companyId: CO, email: "edge@x.test", phone: null, quoteId: null, createdAt: daysAgo(BOOKING_LEAD_WINDOW_DAYS - 1) },
  { id: "l_foreign", companyId: "co_other", email: "zed@x.test", phone: null, quoteId: null, createdAt: daysAgo(1) },
  { id: "l_name", companyId: CO, name: "Bo Chen", email: null, phone: null, quoteId: null, createdAt: daysAgo(1) },
];
const find = (contact, quoteId = null) => findBookingLead({ leads, companyId: CO, keys: contactKeysOf(contact), quoteId, now: NOW })?.id || null;
ok("same email, any case or spacing → that lead", find({ email: "ana.lopez@example.com" }) === "l_email");
ok("same phone, any format → that lead", find({ phone: "+1 613-555-0142" }) === "l_phone");
ok("the estimate the booking came from → its lead", find({ email: "new@x.test" }, "q_9") === "l_quote");
ok(`inside ${BOOKING_LEAD_WINDOW_DAYS} days → linked; a day past it → a new lead`, find({ email: "edge@x.test" }) === "l_edge" && find({ email: "old@x.test" }) === null);
ok("another company's lead, never", find({ email: "zed@x.test" }) === null);
ok("a name alone is not a match", find({ name: "Bo Chen" }) === null);
ok("several matches → the most recent", findBookingLead({ leads: [...leads, { id: "l_newer", companyId: CO, email: "ana.lopez@example.com", createdAt: daysAgo(2) }], companyId: CO, keys: contactKeysOf({ email: "ana.lopez@example.com" }), now: NOW })?.id === "l_newer");
ok("the client's own details count as well as the booking's", findBookingLead({ leads, companyId: CO, keys: contactKeysOf({ email: "typo@x.test" }, { phone: "6135550142" }), now: NOW })?.id === "l_phone");
ok("the source: booking_page for the web; the AI channels keep their own", bookingLeadSource({ source: null }) === "booking_page" && bookingLeadSource({ source: "phone_assistant" }) === "phone_agent" && bookingLeadSource({ source: "ai_employee" }) === "ai_employee");

// ═══════════════════════════════════════════════════════════════════════════
section("2. ensureBookingLead, against the store");
// ═══════════════════════════════════════════════════════════════════════════
async function seed() {
  db.__reset();
  await db.company.create({ data: { id: CO, name: "BL Painting", slug: "bl-painting", currency: "CAD", country: "CA", defaultLanguage: "en" } });
  await db.user.create({ data: { id: "u_owner", email: "owner@bl.test", name: "Owner", language: "en" } });
  await db.member.create({ data: { id: "m_owner", userId: "u_owner", companyId: CO, role: "owner", active: true, permissions: null } });
  await db.serviceCategory.create({ data: { id: "cat_ext", key: "exterior_painting", label: "Exterior painting" } });
  await db.client.create({ data: { id: "cl_new", companyId: CO, name: "Dee New", email: "dee@x.test", phone: "+16135550199", createdAt: daysAgo(0) } });
}
await seed();
const booking = async (id, over = {}) =>
  db.booking.create({ data: { id, clientName: "Dee New", clientEmail: "dee@x.test", clientPhone: "+16135550199", language: "fr", notes: "When needed: This month\nPaint the front porch", serviceKey: "exterior_painting", mode: "visit", status: "confirmed", source: null, leadRequestId: null, quoteId: null, ...over } });
const landing = { source: "facebook", utmSource: "facebook", utmMedium: "paid_social", utmCampaign: "Fall porches", fbc: "fb.1.1727000000000.IwAR0abcdefghij", landedAt: daysAgo(0).toISOString() };

const b1 = await booking("bk_1");
const r1 = await ensureBookingLead({ booking: b1, companyId: CO, clientId: "cl_new", attribution: landing, now: NOW });
const created = r1.leadId ? await db.leadRequest.findFirst({ where: { id: r1.leadId } }) : null;
ok("no enquiry before it → a lead is created", r1.action === "created" && Boolean(created), r1);
ok("…source booking_page, the booker's name, email, phone and language", created?.source === "booking_page" && created?.name === "Dee New" && created?.email === "dee@x.test" && created?.phone === "+16135550199" && created?.language === "fr", created);
ok("…through the normal intake: scored like any inbound lead", Number.isFinite(created?.score) && ["hot", "warm", "cold"].includes(created?.temperature), [created?.score, created?.temperature]);
ok("…the booking's own words as its message, the service as its category", /front porch/.test(created?.message || "") && created?.categoryId === "cat_ext");
ok("…the booking page's landing as its attribution (UTMs and the ad click)", created?.attribution?.utmCampaign === "Fall porches" && created?.attribution?.fbc === landing.fbc);
ok("…and the booking names it", (await db.booking.findFirst({ where: { id: "bk_1" } })).leadRequestId === r1.leadId);
ok("…with no \"New enquiry\" alert — the booking already told the company", (await db.notificationEvent.findMany({ where: { type: "lead.created" } })).length === 0);

const b2 = await booking("bk_2", { clientEmail: "DEE@x.test" });
const r2 = await ensureBookingLead({ booking: b2, companyId: CO, clientId: "cl_new", now: NOW });
ok("a second booking by the same person → linked to that lead, no duplicate", r2.action === "linked" && r2.leadId === r1.leadId && (await db.leadRequest.findMany({ where: { companyId: CO } })).length === 1, r2);
const again = await ensureBookingLead({ booking: await db.booking.findFirst({ where: { id: "bk_2" } }), companyId: CO, clientId: "cl_new", now: NOW });
ok("a booking already linked is left alone", again.action === "already" && again.leadId === r1.leadId);

await db.leadRequest.create({ data: { id: "l_enq", companyId: CO, name: "Eve Enquirer", email: null, phone: "613-555-0177", source: "self_quote", status: "contacted", createdAt: daysAgo(20), updatedAt: daysAgo(20) } });
const b3 = await booking("bk_3", { clientName: "Eve Enquirer", clientEmail: "eve@x.test", clientPhone: "+1 (613) 555-0177" });
const r3 = await ensureBookingLead({ booking: b3, companyId: CO, now: NOW });
ok("someone who enquired 20 days ago and then booked → linked to their enquiry, never a second lead", r3.action === "linked" && r3.leadId === "l_enq" && (await db.leadRequest.findMany({ where: { companyId: CO } })).length === 2, r3);
ok("…and the enquiry keeps its own source and status", (await db.leadRequest.findFirst({ where: { id: "l_enq" } })).source === "self_quote" && (await db.leadRequest.findFirst({ where: { id: "l_enq" } })).status === "contacted");

await db.leadRequest.create({ data: { id: "l_stale", companyId: CO, name: "Fay Former", email: "fay@x.test", source: "self_quote", createdAt: daysAgo(200), updatedAt: daysAgo(200) } });
const r4 = await ensureBookingLead({ booking: await booking("bk_4", { clientName: "Fay Former", clientEmail: "fay@x.test", clientPhone: null, serviceKey: null, notes: null }), companyId: CO, now: NOW });
ok("an enquiry older than 180 days does not hold the booking → a new lead", r4.action === "created" && r4.leadId !== "l_stale", r4);

const r5 = await ensureBookingLead({ booking: await booking("bk_5", { clientName: "Gus Caller", clientEmail: "", clientPhone: "+16135550123", source: "phone_assistant", serviceKey: null }), companyId: CO, now: NOW });
const aiLead = r5.leadId ? await db.leadRequest.findFirst({ where: { id: r5.leadId } }) : null;
ok("an AI receptionist's booking → a lead in the phone's own source, never \"website\"", r5.action === "created" && aiLead?.source === "phone_agent" && channelOf(aiLead) === "organic", aiLead?.source);

const r6 = await ensureBookingLead({ booking: await booking("bk_6", { clientEmail: "", clientPhone: null, clientName: "Nobody" }), companyId: CO, now: NOW });
ok("nothing to reach them on → no lead (no email, no phone, nothing anyone can work)", r6.action === "failed" && r6.reason === "no_contact");
const broken = { client: { findFirst: async () => null }, leadRequest: { findMany: async () => { throw new Error("db down"); } }, booking: { update: async () => ({}) } };
const r7 = await ensureBookingLead({ booking: { id: "bk_x", clientEmail: "a@b.test" }, companyId: CO, now: NOW, deps: { db: broken } }).catch(() => "THREW");
ok("a database failure is logged and returned, never thrown into the booking", r7 !== "THREW" && r7.action === "failed");

// ═══════════════════════════════════════════════════════════════════════════
section("3. The three ways a booking is confirmed");
// ═══════════════════════════════════════════════════════════════════════════
await db.eventType.create({ data: { id: "et_1", companyId: CO, userId: "u_owner", name: "Estimate", slug: "estimate", durationMinutes: 60 } });
await db.booking.create({ data: { id: "bk_paid", eventTypeId: "et_1", clientName: "Hal Paid", clientEmail: "hal@x.test", clientPhone: null, startTime: daysAgo(-3), endTime: daysAgo(-3), mode: "visit", status: "pending_payment", notes: "Deck", serviceKey: null, leadRequestId: null, quoteId: null } });
// settleBookingFee reads the event type with its company.
const realFind = db.booking.findUnique.bind(db.booking);
db.booking.findUnique = async (args) => {
  const r = await realFind({ where: args.where });
  if (r && args?.include?.eventType) r.eventType = { ...(await db.eventType.findFirst({ where: { id: r.eventTypeId } })), company: await db.company.findFirst({ where: { id: CO } }) };
  return r;
};
let ensureCalledAfter = null;
const settled = await settleBookingFee("bk_paid", { amountCents: 5000, currency: "cad" }, {
  db,
  finalize: async () => {
    ensureCalledAfter = "finalize";
  },
  ensureLead: async (args) => {
    ensureCalledAfter = ensureCalledAfter === "finalize" ? "finalize+lead" : "lead-before-finalize";
    return ensureBookingLead({ ...args, now: NOW });
  },
});
db.booking.findUnique = realFind;
const paid = await db.booking.findFirst({ where: { id: "bk_paid" } });
ok("a PAID booking: once the fee settles, the lead is made — after the confirmation, never for an unpaid hold", settled.settled === true && ensureCalledAfter === "finalize+lead" && Boolean(paid.leadRequestId), { settled, ensureCalledAfter, lead: paid.leadRequestId });
ok("…a hold that never settles makes no lead", (await settleBookingFee("bk_missing", {}, { db, finalize: async () => {}, ensureLead: async () => { throw new Error("called"); } })).settled === false);
const confirm = code("app/api/booking/[companySlug]/confirm/route.js");
ok("the FREE booking page path calls it after the confirmation, with the page visit's landing", /await finalizeBooking\(\{ company, eventType, booking, clientId: client\.id \}\);[\s\S]{0,600}await ensureBookingLead\(\{ booking, companyId: company\.id, clientId: client\.id, attribution: attributionFromVisit\(visit\) \}\)/.test(confirm));
ok("…and the visit it reads is the one linkBookingVisit already found (returned, not looked up twice)", /const visit = await linkBookingVisit\(company\.id, visitToken, booking\.id\);/.test(confirm) && /return visit;/.test(confirm));
const voice = code("lib/voice/availability.js");
ok("the AI booking (receptionist and AI employee) calls it, and puts the lead on the call so save_caller updates it", /ensureBookingLead\(\{ booking, companyId, clientId: client\.id \}\)/.test(voice) && /voiceCall\.updateMany\(\{ where: \{ id: callId, companyId, leadId: null \}, data: \{ leadId: linked\.leadId \} \}\)/.test(voice));
const settleSrc = code("lib/booking/settleBookingFee.js");
ok("the paid path's own default reads the visit that booking was made from", /visitForBooking\(\{ companyId: args\.companyId, bookingId: args\.booking\.id \}\)/.test(settleSrc));

// ═══════════════════════════════════════════════════════════════════════════
section("4. Into the agency funnel");
// ═══════════════════════════════════════════════════════════════════════════
ok("a booking_page lead is the company's website channel; with an ad's landing it is the ad's", channelOf({ source: "booking_page" }) === "website" && channelOf({ source: "booking_page", attribution: landing }) === "facebook_ad");
const appt = await db.appointment.create({ data: { companyId: CO, clientId: "cl_new", scheduledAt: daysAgo(-2), status: "scheduled", createdAt: NOW } });
await db.booking.update({ where: { id: "bk_1" }, data: { appointmentId: appt.id } });
const { facts } = await loadLeadFacts({ db, companyId: CO, where: { id: { in: [r1.leadId] } }, now: new Date(NOW.getTime() + 60_000), assignRefs: false });
ok("the booking's appointment is the lead's appointment (it reaches \"appointments\" in the funnel)", facts[0]?.appointment?.id === appt.id, facts[0]?.appointment);

// ═══════════════════════════════════════════════════════════════════════════
section("5. Labels and wiring");
// ═══════════════════════════════════════════════════════════════════════════
const langs = Object.keys(APP_MESSAGES);
ok("the lead's source reads \"Booked on your booking page\", in all nine languages", leadSourceLabelKey("booking_page") === "app.leads.source.booking_page" && langs.length === 9 && langs.every((l) => typeof APP_MESSAGES[l]["app.leads.source.booking_page"] === "string") && APP_MESSAGES.en["app.leads.source.booking_page"] === "Booked on your booking page");
ok("the page asks no budget or timeline column, so neither is held against the score or shown as declined", unaskedForScoring("booking_page").length === 2 && NOT_ASKED_BY_SOURCE.booking_page?.length === 2);
const createLead = code("lib/leads/createLead.js");
ok("createScoredLead skips the alert only on an explicit notify: false", /if \(!importedAt && input\.notify !== false\) notifyEvent\(/.test(createLead));
const schema = code("prisma/schema.prisma");
ok("Booking.leadRequestId: optional, indexed, SetNull — deleting a lead never takes a booking", /leadRequestId String\?\s+leadRequest\s+LeadRequest\? @relation\(fields: \[leadRequestId\], references: \[id\], onDelete: SetNull\)\s+@@index\(\[leadRequestId\]\)/.test(schema));
const pkg = JSON.parse(code("package.json"));
ok("check:booking-leads is in check:all", /check:booking-leads/.test(pkg.scripts["check:all"]));

// ═══════════════════════════════════════════════════════════════════════════
// Mutation pass (cp backups only — never git checkout)
// ═══════════════════════════════════════════════════════════════════════════
if (!MUTANT && !fails.length) {
  console.log("\nMutation pass — each change to lib/booking/bookingLead.js must fail this check");
  const LIB = join(ROOT, "lib/booking/bookingLead.js");
  const backupDir = join(ROOT, ".mutation-backup-booking-leads");
  mkdirSync(backupDir, { recursive: true });
  copyFileSync(LIB, join(backupDir, "bookingLead.js"));
  const ORIGINAL = readFileSync(LIB, "utf8");
  const MUTATIONS = [
    ["no 180-day window", "if (!Number.isFinite(at) || at < floor) return false;", "if (!Number.isFinite(at)) return false;"],
    ["email not matched", "if (e && keys.emails.has(e)) return true;", ""],
    ["phone not matched", "return Boolean(p && keys.phones.has(p));", "return false;"],
    ["any company's lead", "if (!l || l.companyId !== companyId) return false;", "if (!l) return false;"],
    ["the alert sent", "notify: false,", ""],
    ["the booking never names its lead", "await db.booking.update({ where: { id: booking.id }, data: { leadRequestId: lead.id }, select: { id: true } });", ""],
    ["attribution dropped", "...(attribution && typeof attribution === \"object\" ? { attribution } : {}),", ""],
    ["throws into the booking", "    console.error(\"[booking] lead not linked:\", booking?.id, err?.message);\n    return { action: \"failed\", reason: \"error\" };", "    throw err;"],
  ];
  const escaped = [];
  try {
    for (const [label, from, to] of MUTATIONS) {
      if (!ORIGINAL.includes(from)) {
        escaped.push(`${label} — target not found`);
        continue;
      }
      writeFileSync(LIB, ORIGINAL.replace(from, to));
      let survived = false;
      try {
        execFileSync(process.execPath, ["--import", "./scripts/alias-loader.mjs", "--import", "./scripts/memory-route-stub-loader.mjs", "scripts/check-booking-leads.mjs", "--mutant"], { cwd: ROOT, stdio: "pipe" });
        survived = true;
      } catch {
        survived = false;
      }
      writeFileSync(LIB, ORIGINAL);
      if (survived) escaped.push(`${label} — NOT caught`);
      else console.log(`  ✓ caught: ${label}`);
    }
  } finally {
    writeFileSync(LIB, ORIGINAL);
    rmSync(backupDir, { recursive: true, force: true });
  }
  ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
}

if (!MUTANT) console.log(fails.length ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}` : `\nPASSED — ${pass}/${pass} assertions`);
process.exit(fails.length ? 1 : 0);
