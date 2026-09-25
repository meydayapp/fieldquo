// scripts/check-rep-demo-page.mjs
//
//   npm run check:rep-demo-page
//
// The rep's public demo page (app/demo/[repCode]), executed against hostile
// input: the slot maths in a zone, overlaps with the rep's calendar, the
// lead time, the token → prefill, a double booking refused, a token from
// another rep refused, and the Today counter telling a booking from a
// request. Plus the wiring — the intro email mints the new URL, the old
// /i link forwards, the keys exist in every language.
//
// Run with the db stub so book.js can be imported without a database; the
// client it is handed is the fake below. Judged by exit code.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
}

const {
  DEFAULT_DEMO_HOURS, REP_DEMO_MINUTES, busyFromEvents, initialsOf, parseDemoHours, repDemoSlots, repDemoWindows, repDemoZone, repFreeAt, usableTimeZone,
} = await import("@/lib/sales/demoBooking/slots");
const { REP_DEMO_COPY, repDemoCopy, repDemoLanguage, fillDemoCopy, whenLabel } = await import("@/lib/sales/demoBooking/copy");
const { repDemoUrl } = await import("@/lib/sales/demoBooking/url");
const { bookRepDemo, repDemoPageState } = await import("@/lib/sales/demoBooking/book");
const { sealIntroLink } = await import("@/lib/sales/outreach/introLink");
const { introRequestsForRep } = await import("@/lib/sales/outreach/introRequests");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");

// ── Slot maths ─────────────────────────────────────────────────────────────
// Friday 2026-09-18 11:00 EDT.
const now = new Date("2026-09-18T15:00:00.000Z");
{
  ok("the default hours are Monday–Friday 09:00–17:00", DEFAULT_DEMO_HOURS.length === 5 && DEFAULT_DEMO_HOURS.every((h) => h.startTime === "09:00" && h.endTime === "17:00"));
  ok("a rep with no zone reads in FieldQuo's own, and says so", JSON.stringify(repDemoZone({})) === '{"timeZone":"America/Toronto","stated":false}');
  ok("a rep's stated zone is used", repDemoZone({ timeZone: "America/Vancouver" }).stated === true);
  ok("a typo of a zone is not a zone", usableTimeZone("America/Vancuver") === false && repDemoZone({ timeZone: "America/Vancuver" }).stated === false);
  ok("hours not stated → the default, flagged", repDemoWindows({}).stated === false && repDemoWindows({}).windows.length === 5);
  ok("an empty list is a statement: nothing bookable", repDemoWindows({ demoHours: [] }).windows.length === 0 && repDemoWindows({ demoHours: [] }).stated === true);

  const rep = { timeZone: "America/Toronto", demoHours: null };
  const slots = repDemoSlots(rep, [], now);
  ok("slots are 15 minutes apart", slots.length > 10 && slots[1].getTime() - slots[0].getTime() === REP_DEMO_MINUTES * 60_000, slots.slice(0, 2));
  ok("nothing inside the two-hour lead time (first slot is 13:00 EDT)", slots[0].toISOString() === "2026-09-18T17:00:00.000Z", slots[0]);
  const local = (d) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit", hour12: false, weekday: "short" }).format(d);
  ok("every slot is a weekday 09:00–16:45 in the rep's zone", slots.every((d) => { const s = local(d); return !/Sat|Sun/.test(s) && /(09|1[0-6]):/.test(s); }), slots.filter((d) => /Sat|Sun/.test(local(d))).slice(0, 2).map(local));
  ok("the last bookable start ends by 17:00", slots.every((d) => !/16:(4[6-9]|5\d)/.test(local(d)) && !/17:/.test(local(d))));

  const vanRep = { timeZone: "America/Vancouver", demoHours: null };
  const van = repDemoSlots(vanRep, [], now);
  const localVan = (d) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Vancouver", hour: "numeric", minute: "2-digit", hour12: false }).format(d);
  ok("a Vancouver rep's 09:00 is 09:00 in Vancouver, not Toronto", van.some((d) => localVan(d) === "09:00") && !van.some((d) => localVan(d) === "06:00"), van.slice(0, 3).map(localVan));

  // A callback at 13:05 with no end blocks 13:00 (overlap) and 13:15 (occupies one demo length); 13:30 stays.
  const busyRep = repDemoSlots(rep, [{ startAt: new Date("2026-09-18T17:05:00.000Z"), endAt: null, status: "scheduled" }], now);
  const at = (iso) => busyRep.some((d) => d.toISOString() === iso);
  ok("a callback with no end blocks the slot it sits in and the one it runs into", !at("2026-09-18T17:00:00.000Z") && !at("2026-09-18T17:15:00.000Z") && at("2026-09-18T17:30:00.000Z"));
  const cancelled = repDemoSlots(rep, [{ startAt: new Date("2026-09-18T17:00:00.000Z"), endAt: new Date("2026-09-18T18:00:00.000Z"), status: "cancelled" }], now);
  ok("a cancelled event blocks nothing", cancelled.some((d) => d.toISOString() === "2026-09-18T17:00:00.000Z"));
  const span = repDemoSlots(rep, [{ startAt: new Date("2026-09-18T17:00:00.000Z"), endAt: new Date("2026-09-18T18:00:00.000Z"), status: "scheduled" }], now);
  ok("an hour-long event blocks four slots", !span.some((d) => d >= new Date("2026-09-18T17:00:00.000Z") && d < new Date("2026-09-18T18:00:00.000Z")) && span.some((d) => d.toISOString() === "2026-09-18T18:00:00.000Z"));
  ok("repFreeAt refuses a hand-posted 03:00", repFreeAt(rep, [], "2026-09-19T07:00:00.000Z", now) === false);
  ok("repFreeAt refuses a past slot", repFreeAt(rep, [], "2026-09-18T13:00:00.000Z", now) === false);
  ok("repFreeAt refuses garbage", repFreeAt(rep, [], "not a date", now) === false);
  ok("repFreeAt accepts a listed slot", repFreeAt(rep, [], "2026-09-18T17:00:00.000Z", now) === true);
  ok("busyFromEvents drops a bad date and keeps a good one", busyFromEvents([{ startAt: "garbage" }, { startAt: now, endAt: null }]).length === 1);

  ok("parseDemoHours refuses a non-list", parseDemoHours("Mon 9-5").ok === false);
  ok("parseDemoHours refuses an end before the start", parseDemoHours([{ dayOfWeek: 1, startTime: "17:00", endTime: "09:00" }]).ok === false);
  ok("parseDemoHours refuses a window shorter than a demo", parseDemoHours([{ dayOfWeek: 1, startTime: "09:00", endTime: "09:10" }]).ok === false);
  ok("parseDemoHours refuses day 7 and 25:00", parseDemoHours([{ dayOfWeek: 7, startTime: "09:00", endTime: "17:00" }]).ok === false && parseDemoHours([{ dayOfWeek: 1, startTime: "09:00", endTime: "25:00" }]).ok === false);
  ok("parseDemoHours normalises 9:00 to 09:00", parseDemoHours([{ dayOfWeek: 1, startTime: "9:00", endTime: "17:00" }]).hours[0].startTime === "09:00");
  ok("parseDemoHours accepts an empty list (nothing bookable)", parseDemoHours([]).ok === true && parseDemoHours([]).hours.length === 0);
  ok("initials: two names → two letters, one name → two letters", initialsOf("Daniel Ortega") === "DO" && initialsOf("Cher") === "CH" && initialsOf("") === "");
}

// ── Copy ───────────────────────────────────────────────────────────────────
{
  const en = Object.keys(REP_DEMO_COPY.en).sort().join(",");
  for (const l of ["fr", "es"]) {
    ok(`${l} carries every English key and no other`, Object.keys(REP_DEMO_COPY[l]).sort().join(",") === en);
    const echoed = Object.keys(REP_DEMO_COPY.en).filter((k) => REP_DEMO_COPY[l][k] === REP_DEMO_COPY.en[k]);
    ok(`no ${l} value is the English sentence`, echoed.length === 0, echoed);
  }
  ok("an unknown language is English", repDemoCopy("xx") === REP_DEMO_COPY.en && repDemoLanguage("de") === null && repDemoLanguage("FR") === "fr");
  ok("fill replaces every placeholder", fillDemoCopy("{rep} at {when}", { rep: "A", when: "B" }) === "A at B");
  ok("whenLabel is in the language and zone", /vendredi/.test(whenLabel(now, { language: "fr", timeZone: "America/Toronto" })) && /11/.test(whenLabel(now, { language: "en", timeZone: "America/Toronto" })));
  ok("the URL carries the code and the token, encoded", repDemoUrl("https://app.fieldquo.com/", "dan-o", { token: "a b" }) === "https://app.fieldquo.com/demo/dan-o?t=a+b");
}

// ── Booking against a fake client ──────────────────────────────────────────
function fakeClient() {
  const reps = new Map();
  const intro = new Map();
  const events = [];
  const leads = [];
  const client = {
    reps, intro, events, leads,
    // The page resolves its path segment through lib/sales/repLink.js:
    // the opaque token by findUnique, the legacy code by a case-insensitive
    // findFirst.
    salesRep: {
      findUnique: async ({ where }) =>
        [...reps.values()].find((r) => (where.referralToken ? r.referralToken === where.referralToken : where.code ? r.code === where.code : r.id === where.id)) || null,
      findFirst: async ({ where }) =>
        [...reps.values()].find((r) => where.code?.equals && String(r.code).toLowerCase() === String(where.code.equals).toLowerCase()) || null,
    },
    salesIntroEmail: {
      findUnique: async ({ where }) => intro.get(where.id) || null,
      findMany: async ({ where }) => [...intro.values()].filter((r) => r.salesRepId === where.salesRepId && !r.handledAt && where.OR.some((o) => Object.keys(o).every((k) => r[k]))),
      updateMany: async ({ where, data }) => {
        const r = intro.get(where.id);
        if (!r || ("demoEventId" in where && where.demoEventId === null && r.demoEventId)) return { count: 0 };
        Object.assign(r, data);
        return { count: 1 };
      },
    },
    salesEvent: {
      findMany: async ({ where }) => events.filter((e) => (where.id ? where.id.in.includes(e.id) : e.salesRepId === where.salesRepId && e.status !== "cancelled" && e.startAt >= where.startAt.gte && e.startAt <= where.startAt.lte)),
      findUnique: async ({ where }) => events.find((e) => e.id === where.id) || null,
      create: async ({ data }) => { const e = { id: `ev_${events.length + 1}`, ...data }; events.push(e); return e; },
    },
    salesLead: { findFirst: async ({ where }) => leads.find((l) => l.salesRepId === where.salesRepId && l.email === where.email) || null },
    salesCallAttempt: { findMany: async () => [] },
    platformSmsNumber: { findFirst: async () => null },
    salesMailbox: { findUnique: async () => null },
    $queryRaw: async () => [],
    $transaction: async (fn) => fn(client),
  };
  return client;
}

{
  const client = fakeClient();
  const expiresAt = new Date(now.getTime() + 30 * 86400000);
  client.reps.set("rep_1", { id: "rep_1", code: "dan", referralToken: "k3m9x2pq", name: "Daniel Ortega", email: "dan@login.example", workEmail: null, timeZone: "America/Toronto", demoHours: null, active: true, kind: "rep", language: "en", endedAt: null });
  client.reps.set("rep_2", { id: "rep_2", code: "eve", name: "Eve", email: "eve@login.example", workEmail: null, timeZone: null, demoHours: [], active: true, kind: "rep", language: "en", endedAt: null });
  client.reps.set("rep_3", { id: "rep_3", code: "inf", name: "Influencer", email: "i@x.example", workEmail: null, timeZone: null, demoHours: null, active: true, kind: "influencer", language: "en", endedAt: null });
  const lead = { id: "lead_1", businessName: "Acme Roofing", contactName: "Dave Martin", phone: "+16135550199", email: "dave@acme.example", timeZone: "America/Toronto", country: "CA", province: "ON", prospect: { websiteUrl: "https://acme.example" } };
  client.intro.set("ie_1", { id: "ie_1", salesRepId: "rep_1", leadId: "lead_1", toAddress: "dave@acme.example", language: "fr", sentAt: now, expiresAt, callbackRequestedAt: null, callbackEventId: null, demoRequestedAt: null, demoEventId: null, handledAt: null, salesRep: { id: "rep_1", name: "Daniel Ortega" }, lead });
  const token = sealIntroLink({ introEmailId: "ie_1", leadId: "lead_1", salesRepId: "rep_1", kind: "demo", expiresAt });
  const callbackToken = sealIntroLink({ introEmailId: "ie_1", leadId: "lead_1", salesRepId: "rep_1", kind: "callback", expiresAt });

  const unknown = await repDemoPageState({ repCode: "nobody", client, now });
  ok("an unknown code is refused", unknown.ok === false && unknown.reason === "unknown_rep");
  const influencer = await repDemoPageState({ repCode: "inf", client, now });
  ok("an influencer's code is not a calendar", influencer.ok === false);

  const state = await repDemoPageState({ repCode: "dan", token, client, now });
  ok("the token prefills the lead's name, address, phone and business", state.ok && state.prefill.name === "Dave Martin" && state.prefill.email === "dave@acme.example" && state.prefill.phone === "+16135550199" && state.prefill.business === "Acme Roofing", state.prefill);
  ok("…in the email's language, whatever ?lang says", state.language === "fr" && (await repDemoPageState({ repCode: "dan", token, lang: "es", client, now })).language === "fr");
  // A stranger's page: the rep's PUBLIC name — work name, else first name —
  // never the full real name (lib/sales/repIdentity.js).
  ok("…with the rep's public name and initials, never the surname", state.repName === "Daniel" && state.initials === "DA" && !JSON.stringify(state).includes("Ortega"));
  const byToken = await repDemoPageState({ repCode: "k3m9x2pq", token, client, now });
  ok("the page opens on the opaque token as well as the legacy code", byToken.ok && byToken.repName === "Daniel");
  client.reps.get("rep_1").workName = "Dan";
  ok("a work name replaces the first name on the page", (await repDemoPageState({ repCode: "dan", token, client, now })).repName === "Dan");
  client.reps.get("rep_1").workName = null;
  ok("an unknown code is not found", (await repDemoPageState({ repCode: "zzzzzzzz", client, now })).ok === false);
  ok("…and the slots", state.slots.length > 10 && state.slots[0] === "2026-09-18T17:00:00.000Z");
  const bare = await repDemoPageState({ repCode: "dan", lang: "es", client, now });
  ok("the bare link has no prefill and speaks ?lang", bare.ok && bare.prefill.name === "" && bare.language === "es" && bare.fromEmail === false);
  const wrongRep = await repDemoPageState({ repCode: "eve", token, client, now });
  ok("a demo token on another rep's page is refused", wrongRep.ok === false && wrongRep.reason === "invalid");
  const wrongKind = await repDemoPageState({ repCode: "dan", token: callbackToken, client, now });
  ok("a callback token does not open the demo page", wrongKind.ok === false && wrongKind.reason === "invalid");
  const none = await repDemoPageState({ repCode: "eve", client, now });
  ok("a rep with empty hours offers no slots", none.ok && none.slots.length === 0);

  const past = await bookRepDemo({ repCode: "dan", token, slot: "2026-09-18T15:30:00.000Z", name: "Dave", email: "dave@acme.example", client, now });
  ok("a slot inside the lead time is refused as past", past.ok === false && past.reason === "past");
  const offGrid = await bookRepDemo({ repCode: "dan", token, slot: "2026-09-19T07:00:00.000Z", name: "Dave", email: "dave@acme.example", client, now });
  ok("a hand-posted 03:00 is refused as taken (not on the grid)", offGrid.ok === false && offGrid.reason === "taken");
  const noName = await bookRepDemo({ repCode: "dan", token, slot: "2026-09-18T17:00:00.000Z", name: "  ", email: "dave@acme.example", client, now });
  ok("no name is refused", noName.ok === false && noName.reason === "need_name");
  const badEmail = await bookRepDemo({ repCode: "dan", token, slot: "2026-09-18T17:00:00.000Z", name: "Dave", email: "dave@", client, now });
  ok("a bad address is refused", badEmail.ok === false && badEmail.reason === "need_email");

  const booked = await bookRepDemo({ repCode: "dan", token, slot: "2026-09-18T17:00:00.000Z", name: "Dave Martin", email: "dave@acme.example", phone: "+16135550199", business: "Acme Roofing", client, now });
  ok("a good confirm books", booked.ok === true && booked.at === "2026-09-18T17:00:00.000Z" && booked.language === "fr", booked);
  const ev = client.events[0];
  ok("…as a SalesEvent of type demo, 15 minutes, linked to the lead and snapshotting the contact", client.events.length === 1 && ev.type === "demo" && ev.leadId === "lead_1" && ev.endAt.getTime() - ev.startAt.getTime() === 15 * 60_000 && ev.contactName === "Dave Martin" && ev.businessName === "Acme Roofing", ev);
  ok("…and stamps the intro row with the event and the request time", client.intro.get("ie_1").demoEventId === "ev_1" && client.intro.get("ie_1").demoRequestedAt === now);
  ok("the label is in French in the lead's zone", /vendredi/.test(booked.when) && /13/.test(booked.when), booked.when);

  const again = await bookRepDemo({ repCode: "dan", token, slot: "2026-09-18T17:30:00.000Z", name: "Dave Martin", email: "dave@acme.example", client, now });
  ok("the same token a second time is 'already', with the booked time, and writes nothing", again.ok === false && again.reason === "already" && again.at === "2026-09-18T17:00:00.000Z" && client.events.length === 1);
  const stateAfter = await repDemoPageState({ repCode: "dan", token, client, now });
  ok("the page after booking shows the booking and no slots", stateAfter.booked?.at === "2026-09-18T17:00:00.000Z" && stateAfter.slots.length === 0);

  const rival = await bookRepDemo({ repCode: "dan", slot: "2026-09-18T17:00:00.000Z", name: "Rita", email: "rita@other.example", client, now });
  ok("another prospect confirming the same slot is refused as taken", rival.ok === false && rival.reason === "taken" && client.events.length === 1);
  const next = await bookRepDemo({ repCode: "dan", slot: "2026-09-18T17:15:00.000Z", name: "Rita", email: "rita@other.example", client, now });
  ok("…and the next slot is free (the bare link books with no lead)", next.ok === true && client.events.length === 2 && client.events[1].leadId === null && client.events[1].contactName === "Rita");
  client.leads.push({ id: "lead_9", salesRepId: "rep_1", email: "known@x.example" });
  const known = await bookRepDemo({ repCode: "dan", slot: "2026-09-18T17:30:00.000Z", name: "Known", email: "Known@x.example", client, now });
  ok("a bare-link booking from an address the rep has as a lead links that lead", known.ok && client.events[2].leadId === "lead_9");

  const counts = await introRequestsForRep({ salesRepId: "rep_1", client, now });
  ok("Today counts the booking as a booking, not a request", counts.demoBookings === 1 && counts.demos === 0 && counts.items[0].kind === "demo_booked" && counts.items[0].at === "2026-09-18T17:00:00.000Z", counts);
  client.events[0].status = "done";
  const after = await introRequestsForRep({ salesRepId: "rep_1", client, now });
  ok("a demo marked done leaves the list", after.demoBookings === 0);
}

// ── Wiring ─────────────────────────────────────────────────────────────────
{
  const send = decomment(read("lib/sales/outreach/introSend.js"));
  ok("the intro email mints the demo button as the rep's page with the token", /demoUrl: repDemoUrl\(appOrigin, repRow\?\.code, \{ token: sealIntroLink\(/.test(send));
  const iPage = decomment(read("app/i/[token]/page.js"));
  ok("the old /i link forwards a demo token to the page", /opened\.kind === "demo"/.test(iPage) && /redirect\(repDemoUrl\(/.test(iPage));
  const route = decomment(read("app/api/demo/rep/[repCode]/route.js"));
  ok("the public route rate-limits both verbs and reads on GET only", (route.match(/rateLimit\(request/g) || []).length === 2 && /repDemoPageState/.test(route) && /bookRepDemo/.test(route));
  ok("the GET writes nothing", !/bookRepDemo/.test(route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"))));
  const today = decomment(read("app/sales/page.js"));
  ok("Today prints demo bookings and keeps requests only while there are any", /app\.salesIntro\.today\.demoBookings/.test(today) && /demoBookings > 0/.test(today));
  const settings = decomment(read("app/sales/settings/page.js"));
  ok("the settings screen mounts the demo-hours card", /<RepDemoHours \/>/.test(settings));
  const book = decomment(read("lib/sales/demoBooking/book.js"));
  ok("the booking locks the rep row and re-checks the slot inside the transaction", /FOR UPDATE/.test(book) && book.indexOf("repFreeAt(") > book.indexOf("$transaction("));
  ok("the invite is sent after the response, never on its path", /afterResponse\(async/.test(book) && /sendRepDemoInvite/.test(book));
  const KEYS = ["app.salesIntro.today.demoBookings", "app.salesIntro.today.kind.demo_booked", "app.notify.repDemoBooked.title", "app.notify.repDemoBooked.body", "app.salesSettings.demoHeading", "app.salesSettings.demoIntro", "app.salesSettings.demoZoneFallback", "app.salesSettings.demoHoursDefault", "app.salesSettings.demoSave"];
  for (const lang of Object.keys(APP_MESSAGES)) {
    const missing = KEYS.filter((k) => !(k in APP_MESSAGES[lang]));
    ok(`${lang} carries the demo-page keys`, missing.length === 0, missing);
  }
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
