// scripts/check-phrases-booking.mjs
//
// The booking group of auto-translated phrases (lib/i18n/phrases.js):
//
//   eventTypeName — an appointment type's name. Drafted on save (the event
//     type routes, and the "Consultation with …" type FieldQuo seeds for a
//     bookable member); printed in the reader's language on /book (a
//     per-language map, because only the browser knows the visitor's
//     language), in the confirmation letter and text, on the manage page and
//     in its cancel / move letters and texts, and in the office's
//     moved / cancelled letters and texts. The office's own copy of a letter
//     keeps the company's words.
//   aiGreeting — the AI employee's opening line. Drafted on save; printed in
//     the reply's language in front of the first reply.
//
// Half executes the shipped code against hostile input — visitView, the
// booking page's picker (lifted out of BookingFlow.js and run as written),
// localServiceName, the letters, the real AI responder with a scripted model
// — and half reads the source for the wiring a check cannot run (routes
// that need a request).
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-phrases-booking.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { phraseKey, loadPhraseTranslations } from "@/lib/i18n/phrases";
import { visitView, loadVisitByToken } from "@/lib/booking/manageVisit";
import { localServiceName } from "@/lib/schedule/clientNotice";
import { buildVisitCancelledEmails, buildVisitRescheduledEmails } from "@/app/admin/lib/email/templates";
import { emailCopy } from "@/lib/i18n/emailCopy";
import { rows as stubRows } from "./fixtures/dbStub.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
// Comment lines out, so a sentence ABOUT the wiring never passes for it.
const code = (f) =>
  read(f)
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};

// ── A translations table, scripted ──────────────────────────────────────────
// Rows shaped exactly as lib/i18n/autoTranslate.js writes them. `fail` stands
// in for Neon idling out.
const hashOf = (ns, text) => phraseKey(ns, text).split(":")[2];
const draft = (ns, text, language, translated, over = {}) => ({
  companyId: "C1",
  key: phraseKey(ns, text),
  language,
  text: translated,
  sourceHash: hashOf(ns, text),
  sourceLanguage: "en",
  status: "drafted",
  ...over,
});
function translationsDb(rows, { fail: failing = false } = {}) {
  const reads = [];
  return {
    reads,
    companyTextTranslation: {
      findMany: async (args) => {
        reads.push(args);
        if (failing) throw new Error("P1001: can't reach database server");
        const w = args.where || {};
        return rows.filter(
          (r) =>
            r.companyId === w.companyId &&
            (!w.language || r.language === w.language) &&
            (!w.key?.in || w.key.in.includes(r.key)) &&
            (!w.status?.in || w.status.in.includes(r.status)),
        );
      },
    },
  };
}

const NAME = "On-site estimate";
const FR = "Estimation à domicile";
const ES = "Presupuesto a domicilio";

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. The manage page (visitView) names the type in the page's language");
const NOW = new Date("2026-08-24T13:00:00Z");
const COMPANY = {
  id: "C1",
  name: "Northline Refinishing",
  email: "office@northline.test",
  phone: "555-0100",
  currency: "CAD",
  timezone: "America/Toronto",
  defaultLanguage: "en",
  logoUrl: null,
  brandColor: "#1F6FEB",
  bookingChangeNoticeHours: 24,
  refundVisitFeeOnCancel: false,
  refundCutoffHours: null,
};
const EVENT_TYPE = { id: "evt_1", name: NAME, durationMinutes: 60, location: null, userId: "usr_1" };
const booking = (over = {}) => ({
  id: "bkg_1",
  status: "confirmed",
  startTime: new Date(NOW.getTime() + 72 * 3_600_000),
  endTime: new Date(NOW.getTime() + 73 * 3_600_000),
  mode: "visit",
  address: "14 Maple St",
  clientName: "Dana",
  clientEmail: "dana@example.test",
  clientPhone: "555-0199",
  feePaidCents: 0,
  feeCurrency: null,
  feeStripePaymentIntentId: null,
  feeRefundedAt: null,
  feeRefundedCents: null,
  appointmentId: null,
  language: null,
  quote: null,
  ...over,
});
const view = (b, names, company = COMPANY) => visitView({ booking: b, eventType: EVENT_TYPE, company, eventTypeNames: names }, NOW);

ok("a French booker reads the French draft", view(booking({ language: "fr" }), { fr: FR, es: ES }).eventTypeName === FR);
ok("…and the page's language is the one the name was picked for", view(booking({ language: "fr" }), { fr: FR }).language === "fr");
ok("the company's own language prints the name as typed", view(booking({ language: "en" }), { fr: FR }).eventTypeName === NAME);
ok("no drafts at all (null) → the name as typed", view(booking({ language: "fr" }), null).eventTypeName === NAME);
ok("drafts not passed at all (an older caller) → the name as typed", visitView({ booking: booking({ language: "fr" }), eventType: EVENT_TYPE, company: COMPANY }, NOW).eventTypeName === NAME);
ok("a draft only in another language → the name as typed, never the wrong language", view(booking({ language: "fr" }), { es: ES }).eventTypeName === NAME);
ok("an empty draft → the name as typed, never a blank", view(booking({ language: "fr" }), { fr: "" }).eventTypeName === NAME);
{
  const v = view(booking({ language: "xx-nonsense" }), { fr: FR, es: ES });
  ok("an unknown booker language falls to a resolved one, and the name follows it", v.eventTypeName === ({ fr: FR, es: ES }[v.language] || NAME), v);
}
ok("the quote's fixed language beats the booker's (non-negotiable 6)", view(booking({ language: "fr", quote: { quoteNumber: "Q-1", language: "es" } }), { fr: FR, es: ES }).eventTypeName === ES);
ok("a French company's page for a French booker with no draft keeps the typed name", view(booking({ language: "fr" }), {}, { ...COMPANY, defaultLanguage: "fr" }).eventTypeName === NAME);
ok("the drafts map itself never reaches the public view", !("eventTypeNames" in view(booking({ language: "fr" }), { fr: FR })));

// loadVisitByToken through the db stub, whose translations table is NOT
// scripted — the read throws, exactly like a lost connection. The visit must
// still load, with no drafts.
{
  stubRows.booking = [
    {
      ...booking({ language: "fr" }),
      manageToken: "tok_0123456789abcdef",
      calendarSequence: 0,
      eventType: { ...EVENT_TYPE, bufferBefore: 0, bufferAfter: 0, company: COMPANY },
    },
  ];
  const origError = console.error;
  console.error = () => {};
  const visit = await loadVisitByToken("tok_0123456789abcdef").finally(() => {
    console.error = origError;
  });
  ok("a failed translations read still loads the visit", Boolean(visit?.booking), visit);
  ok("…with no drafts ({}), so the page prints the typed name", visit && JSON.stringify(visit.eventTypeNames) === "{}" && visitView(visit, NOW).eventTypeName === NAME);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. /book picks the visitor's language from the per-language map");
{
  const flow = read("app/book/[companySlug]/BookingFlow.js");
  const m = /const typeName = (\(et\) => [^;\n]+);/.exec(flow);
  ok("BookingFlow has the one picker", Boolean(m));
  // The shipped arrow, run as written with `language` in scope.
  const pickerFor = (language) => new Function("language", `return ${m?.[1] || "() => null"};`)(language);
  const et = { id: "e1", slug: "est", name: NAME, nameTranslations: { fr: FR, es: ES } };
  ok("fr visitor → French", pickerFor("fr")(et) === FR);
  ok("es visitor → Spanish", pickerFor("es")(et) === ES);
  ok("a language with no draft → the name as typed", pickerFor("de")(et) === NAME);
  ok("undefined language (first paint) → the name as typed", pickerFor(undefined)(et) === NAME);
  ok("no map on the object (the member picker's stand-in) → the name", pickerFor("fr")({ slug: "x", name: "Consultation with Dan" }) === "Consultation with Dan");
  ok("an empty draft → the name, never a blank heading", pickerFor("fr")({ name: NAME, nameTranslations: { fr: "" } }) === NAME);
  ok("no event type at all → empty string, never a crash", pickerFor("fr")(null) === "");
  ok("a hostile key (__proto__) is not a language", pickerFor("__proto__")({ name: NAME, nameTranslations: {} }) === NAME);
  ok("…nor constructor (a function off the prototype React can't render)", pickerFor("constructor")({ name: NAME, nameTranslations: {} }) === NAME);
  ok("a non-string draft (a tampered payload) → the name", pickerFor("fr")({ name: NAME, nameTranslations: { fr: { html: "<b>x</b>" } } }) === NAME);
  const src = code("app/book/[companySlug]/BookingFlow.js");
  ok("no event type name is printed raw any more", !/\{et\.name\}/.test(src) && !/\{eventType\.name\}/.test(src), src.match(/\{(et|eventType)\.name\}/g));
  ok("…the menu, the calendar heading and the summary all go through it", (src.match(/typeName\((et|eventType)\)/g) || []).length >= 3);
}
{
  // The payload's map, built by the same call the route makes.
  const rows = [
    draft("eventTypeName", NAME, "fr", FR),
    draft("eventTypeName", NAME, "es", ES),
    // Written in French and "translated" to French: never printed.
    draft("eventTypeName", "Visite", "fr", "Visite", { sourceLanguage: "fr" }),
    // A row keyed for one text carrying another's hash: never attributed.
    draft("eventTypeName", "Phone call", "fr", "Appel", { sourceHash: hashOf("eventTypeName", NAME) }),
    // Another company's draft of the same words.
    draft("eventTypeName", NAME, "de", "Vor-Ort-Schätzung", { companyId: "OTHER" }),
    draft("eventTypeName", NAME, "it", "Stima", { status: "pending" }),
  ];
  const drafts = await loadPhraseTranslations(translationsDb(rows), "C1", "eventTypeName", [NAME, "Visite", "Phone call", ""]);
  ok("each name maps to its drafts by language", drafts[NAME]?.fr === FR && drafts[NAME]?.es === ES);
  ok("another tenant's draft never leaks in", !drafts[NAME]?.de);
  ok("a pending draft is not served", !drafts[NAME]?.it);
  ok("a draft in the text's own language is dropped", !drafts.Visite);
  ok("a row whose hash is another text's is dropped", !drafts["Phone call"]);
  ok("a name with no drafts is absent — the route sends {}", (drafts.Nothing || {}) && !("Nothing" in drafts));
  const origError = console.error;
  console.error = () => {};
  const onFailure = await loadPhraseTranslations(translationsDb(rows, { fail: true }), "C1", "eventTypeName", [NAME]).catch(() => "threw");
  console.error = origError;
  ok("a failed read is {} — the page still renders every name", JSON.stringify(onFailure) === "{}");
  const route = code("app/api/booking/[companySlug]/route.js");
  ok("the booking GET loads the name drafts for its event types", /loadPhraseTranslations\(\s*db,\s*company\.id,\s*"eventTypeName"/.test(route));
  ok("…and sends them as nameTranslations beside the name", /nameTranslations: nameDrafts\[et\.name\] \|\| \{\}/.test(route));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. The office's moved / cancelled letters and texts (localServiceName)");
{
  const rows = [draft("eventTypeName", NAME, "fr", FR), draft("eventTypeName", "Other", "fr", "Autre")];
  const db = translationsDb(rows);
  ok("French client → the French draft", (await localServiceName({ company: COMPANY, eventTypeName: NAME, language: "fr" }, { db })) === FR);
  ok("English client → the typed name", (await localServiceName({ company: COMPANY, eventTypeName: NAME, language: "en" }, { db })) === NAME);
  ok("an unknown language → the typed name", (await localServiceName({ company: COMPANY, eventTypeName: NAME, language: "zz" }, { db })) === NAME);
  ok("no rows for this text → the typed name", (await localServiceName({ company: COMPANY, eventTypeName: "Kitchen measure", language: "fr" }, { db })) === "Kitchen measure");
  ok("a job visit (job title, no type) → the job title, untouched", (await localServiceName({ company: COMPANY, jobTitle: "Deck stain", language: "fr" }, { db })) === "Deck stain");
  const fallback = await localServiceName({ company: COMPANY, eventTypeName: null, language: "fr" }, { db });
  ok("nothing named → the catalogue's word for a visit, in French", fallback === (emailCopy("fr")?.visit?.serviceFallback || emailCopy("en").visit.serviceFallback), fallback);
  ok("an empty-string name → the same fallback, never a blank", (await localServiceName({ company: COMPANY, eventTypeName: "   ", language: "fr" }, { db })) === fallback);
  const failing = translationsDb(rows, { fail: true });
  const origError = console.error;
  console.error = () => {};
  const onFailure = await localServiceName({ company: COMPANY, eventTypeName: NAME, language: "fr" }, { db: failing });
  console.error = origError;
  ok("a failed read → the typed name, never a failed letter", onFailure === NAME);
  const noCompany = translationsDb(rows);
  ok("no company → the typed name, and no query", (await localServiceName({ company: null, eventTypeName: NAME, language: "fr" }, { db: noCompany })) === NAME && noCompany.reads.length === 0);
  const src = code("lib/schedule/clientNotice.js");
  ok("both office letters name the type through it", (src.match(/eventTypeName: await localServiceName\(\{ company, eventTypeName, jobTitle, language/g) || []).length === 2);
  const appt = code("app/api/appointments/[id]/route.js");
  ok("the appointment route's text uses the same lookup", /service: await localServiceName\(\{\s*company: existing\.company,\s*eventTypeName: common\.eventTypeName/.test(appt));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. The client's letter is in their language; the office's copy in the company's words");
{
  const START = new Date("2026-09-16T21:00:00Z");
  const where = { mode: "visit", address: "12 Elm St", phone: null, email: "d@x.test" };
  const base = { company: COMPANY, clientName: "Dana", clientEmail: "d@x.test", startTime: START, where, timezone: "America/Toronto", language: "fr", initiatedBy: "client" };
  const x = buildVisitCancelledEmails({ ...base, eventTypeName: FR, officeEventTypeName: NAME, refund: {} });
  ok("cancelled: the client's copy names the French type", x.client.html.includes("Estimation") && !x.client.html.includes(NAME));
  ok("…the office's copy names it as the company typed it", x.company.html.includes(NAME) && !x.company.html.includes("Estimation"));
  const m = buildVisitRescheduledEmails({ ...base, eventTypeName: FR, officeEventTypeName: NAME, previousStartTime: START, startTime: new Date(START.getTime() + 864e5) });
  ok("moved: the client's copy names the French type", m.client.html.includes("Estimation") && !m.client.html.includes(NAME));
  ok("…the office's copy names it as typed", m.company.html.includes(NAME) && !m.company.html.includes("Estimation"));
  const legacy = buildVisitCancelledEmails({ ...base, eventTypeName: NAME, refund: {} });
  ok("no office name passed (an older caller) → the same name on both, as before", legacy.client.html.includes(NAME) && legacy.company.html.includes(NAME));
  const visitRoute = code("app/api/visit/[token]/route.js");
  ok("the client's cancel: letter + text from visitView, office copy from the row", /eventTypeName: cancelView\.eventTypeName/.test(visitRoute) && /officeEventTypeName: eventType\.name/.test(visitRoute) && /service: cancelView\.eventTypeName/.test(visitRoute));
  const moveRoute = code("app/api/visit/[token]/reschedule/route.js");
  ok("the client's move: the same", /eventTypeName: movedView\.eventTypeName/.test(moveRoute) && /officeEventTypeName: eventType\.name/.test(moveRoute) && /service: movedView\.eventTypeName/.test(moveRoute));
  ok("neither route prints the raw name to the client any more", !/service: eventType\.name/.test(visitRoute + moveRoute) && !/\beventTypeName: eventType\.name/.test(visitRoute + moveRoute));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. The confirmation letter and text (finalizeBooking)");
{
  const src = code("lib/booking/finalizeBooking.js");
  ok("the type's name is looked up once, in the letter's language", /loadPhrases\(db, company\.id, language, \[\{ ns: "eventTypeName", text: eventType\?\.name \}\]\)/.test(src));
  ok("…the letter prints it", /eventTypeName: typeName,/.test(src));
  ok("…and the text prints the same one", /service: typeName \|\| ""/.test(src));
  ok("nothing else reads the raw name for the client", (src.match(/eventType\??\.name/g) || []).length === 2, src.match(/eventType\??\.name/g));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. Saving a name schedules its drafts");
{
  const post = code("app/api/event-types/route.js");
  ok("a new type schedules eventTypeName with the company's language", /schedulePhrases\(\{[\s\S]*?ns: "eventTypeName",[\s\S]*?texts: \[eventType\.name\],[\s\S]*?sourceLanguage: await companyWritingLanguage\(member\.companyId\)/.test(post));
  ok("…and answers the summary for the banner", /\{ \.\.\.eventType, autoTranslate \}/.test(post));
  const patch = code("app/api/event-types/[id]/route.js");
  ok("a rename schedules — only when the name changed", /if \(name !== undefined && updated\.name !== existing\.name\) \{[\s\S]*?ns: "eventTypeName"/.test(patch));
  ok("…a fee or toggle save answers the bare row, claiming nothing", /return NextResponse\.json\(updated\);/.test(patch));
  const seeded = code("lib/booking/bookableMembers.js");
  ok("the seeded 'Consultation with …' type is scheduled too, from English", /schedulePhrases\(\{ companyId, ns: "eventTypeName", texts: \[created\.name\], sourceLanguage: "en" \}\)/.test(seeded));
  ok("…best-effort: a scheduling failure never fails the setup", /try \{\s*schedulePhrases/.test(seeded));
  const ui = code("app/app/settings/booking-page/page.js");
  ok("Settings → Booking page shows the banner off the create's answer", /const \{ autoTranslate, \.\.\.created \} = await res\.json\(\)/.test(ui) && /<AutoTranslateBanner result=\{nameTranslate\} \/>/.test(ui));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. The AI employee's opening line");
{
  const route = code("app/api/ai-employee/route.js");
  ok("a changed greeting schedules aiGreeting", /"greeting" in data && saved\.greeting && saved\.greeting !== current\.greeting[\s\S]*?ns: "aiGreeting"/.test(route));
  ok("…and the PUT answers the summary", /NextResponse\.json\(\{ employee: publicEmployee\(saved\), autoTranslate \}\)/.test(route));
  const ui = code("app/app/settings/ai-employee/page.js");
  ok("the screen shows the banner for the greeting it saved, for that employee only", /if \(job\.field === "greeting"\) setGreetingTranslate/.test(ui) && /greetingTranslate\?\.id === form\.id && <AutoTranslateBanner/.test(ui));
  const respond = code("lib/aiEmployee/respond.js");
  ok("the responder reads the draft in the reply's language", /loadPhrases\(prisma, companyId, replyLanguage, \[\{ ns: "aiGreeting", text: typedGreeting \}\]\)/.test(respond));
  ok("…and the opening prints that, not the raw column", /greeting \|\| null,/.test(respond) && !/String\(employee\.greeting \|\| ""\)\.trim\(\) \|\| null/.test(respond));
  ok("instructions are not a phrase (model input, not client text)", !/ns: "aiGreeting", text: [^}]*instructions/.test(respond) && !/"aiInstructions"/.test(respond));

  // ── The real responder, a scripted model ──────────────────────────────
  // The same fake Prisma shape check-ai-employee.mjs uses, plus the
  // translations table; the reads are counted so "later replies cost no
  // query" is a fact, not a comment.
  const { respondToMessage } = await import("../lib/aiEmployee/respond.js");
  function matches(row, where = {}) {
    for (const [k, v] of Object.entries(where)) {
      if (k === "OR") {
        if (!v.some((w) => matches(row, w))) return false;
        continue;
      }
      const val = row[k];
      if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
        if ("in" in v && !v.in.includes(val)) return false;
        if ("not" in v && (v.not === null ? val == null : val === v.not)) return false;
        if ("gte" in v && !(new Date(val) >= new Date(v.gte))) return false;
        if ("gt" in v && !(new Date(val) > new Date(v.gt))) return false;
        if ("lte" in v && !(new Date(val) <= new Date(v.lte))) return false;
        if ("lt" in v && !(new Date(val) < new Date(v.lt))) return false;
        if (!["in", "not", "gte", "gt", "lte", "lt"].some((op) => op in v) && !matches(val || {}, v)) return false;
        continue;
      }
      if (val !== v) return false;
    }
    return true;
  }
  const sortBy = (list, orderBy) => {
    if (!orderBy) return list;
    const [[k, dir]] = Object.entries(orderBy);
    return [...list].sort((a, b) => (new Date(a[k]) - new Date(b[k]) || (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0)) * (dir === "desc" ? -1 : 1));
  };
  let seq = 0;
  const model = (store, name, reads) => ({
    findMany: async ({ where, orderBy, take } = {}) => {
      reads.push(name);
      const r = sortBy(store[name].filter((x) => matches(x, where)), orderBy);
      return take ? r.slice(0, take) : r;
    },
    findFirst: async ({ where, orderBy } = {}) => sortBy(store[name].filter((x) => matches(x, where)), orderBy)[0] || null,
    findUnique: async ({ where } = {}) => store[name].find((x) => matches(x, where)) || null,
    count: async ({ where } = {}) => store[name].filter((x) => matches(x, where)).length,
    create: async ({ data }) => {
      const row = { id: `${name}_${++seq}`, createdAt: new Date(), ...data };
      store[name].push(row);
      return row;
    },
    update: async ({ where, data }) => {
      const row = store[name].find((x) => matches(x, where));
      if (!row) throw new Error(`no ${name}`);
      Object.assign(row, data);
      return row;
    },
    aggregate: async ({ where, _sum = {} } = {}) => {
      const hits = store[name].filter((x) => matches(x, where));
      return { _sum: Object.fromEntries(Object.keys(_sum).map((k) => [k, hits.reduce((a, r) => a + (Number(r[k]) || 0), 0)])) };
    },
  });
  const t0 = new Date("2026-09-20T15:00:00Z");
  const AFTER_GRACE = new Date("2026-10-15T12:00:00Z");
  const company = { id: "C1", name: "Acme Painting", businessHours: null, timezone: "America/Toronto", defaultLanguage: "en", country: "US", province: "TX", aiDisclosure: null };
  const GREETING = "Thanks for reaching out to Acme!";
  const FR_GREETING = "Merci d'avoir contacté Acme !";
  function makeDb(translations) {
    const reads = [];
    const store = {
      aiEmployee: [{ id: "R", role: "receptionist", enabled: true, createdAt: "2026-01-01", metaEnabled: true, webChatEnabled: true, smsEnabled: false, intents: [], displayName: "Rosa", companyId: "C1", name: "Rosa", mode: "auto", maxRepliesPerThread: 3, businessHoursOnly: false, disabledTools: [], instructionsFingerprint: "f", greeting: GREETING }],
      messageThread: [{ id: "th1", companyId: "C1", status: "open", participantName: "Sam", channel: { platform: "web" }, lastInboundAt: t0, assignedEmployeeId: null, routingIntent: null, routingReason: null, humanTookOverAt: null }],
      // One inbound message: a second one already there would be merged
      // into it as a burst. The second-reply case adds its own, after.
      message: [
        { id: "m1", threadId: "th1", direction: "in", private: false, body: "Can someone come out Tuesday?", sentAt: new Date(t0.getTime()), attachments: null, failedReason: null, sentByUserId: null },
      ],
      aiEmployeeReply: [],
      aiEmployeeRoutingEvent: [],
      aiEmployeeSource: [],
      company: [company],
      aiFeaturePayer: [],
      voiceCreditEntry: [{ id: "credit", companyId: "C1", pool: "ai", kind: "ai_topup", cents: 10_000 }],
      companyTextTranslation: translations,
    };
    const db = {};
    for (const name of Object.keys(store)) db[name] = model(store, name, reads);
    db.reads = reads;
    db.$store = store;
    return db;
  }
  function harness(db) {
    const sent = [];
    const deps = {
      db,
      now: AFTER_GRACE,
      checkAiQuota: async () => ({ allowed: true }),
      recordAiUsage: async () => {},
      isAiConfigured: () => true,
      notify: async () => {},
      sleep: async () => {},
      complete: async (args) => {
        args.onUsage?.({ model: "gpt-s", promptTokens: 5, completionTokens: 1 });
        return { ok: true, data: { intent: "book", reason: "scripted" } };
      },
      runToolLoop: async ({ onUsage }) => {
        onUsage?.({ model: "gpt-b", promptTokens: 50, completionTokens: 10 });
        return { text: "Sure — happy to help." };
      },
    };
    const send = async (msg) => {
      sent.push(msg);
      return { ok: true, externalId: `x${sent.length}` };
    };
    return { deps, send, sent };
  }
  const run = async (translations, { language = null, messageId = "m1", db = null } = {}) => {
    const d = db || makeDb(translations);
    const h = harness(d);
    const r = await respondToMessage({ companyId: "C1", threadId: "th1", messageId, channel: "web", language, send: h.send, deps: h.deps });
    return { r, h, db: d };
  };
  const frDraft = draft("aiGreeting", GREETING, "fr", FR_GREETING);

  const fr = await run([frDraft], { language: "fr" });
  ok("a French conversation opens with the French draft", fr.r.replied === true && (fr.h.sent[0] || "").startsWith(`${FR_GREETING} `), fr.h.sent[0]);
  ok("…and never with the English line as well", !(fr.h.sent[0] || "").includes(GREETING));
  const en = await run([frDraft], { language: "en" });
  ok("an English conversation opens with the line as typed", (en.h.sent[0] || "").startsWith(`${GREETING} `), en.h.sent[0]);
  const noLang = await run([frDraft]);
  ok("no language from the channel → the company's language → as typed", (noLang.h.sent[0] || "").startsWith(`${GREETING} `), noLang.h.sent[0]);
  const es = await run([frDraft], { language: "es" });
  ok("a language with no draft → the line as typed, never another language's", (es.h.sent[0] || "").startsWith(`${GREETING} `), es.h.sent[0]);
  const stale = await run([draft("aiGreeting", "An older greeting", "fr", "Un ancien message")], { language: "fr" });
  ok("a draft of words the company no longer uses is never printed", (stale.h.sent[0] || "").startsWith(`${GREETING} `) && !(stale.h.sent[0] || "").includes("ancien"), stale.h.sent[0]);
  const wrongHash = await run([draft("aiGreeting", GREETING, "fr", "Faux", { sourceHash: hashOf("aiGreeting", "something else") })], { language: "fr" });
  ok("a row whose hash does not match its text is never printed", (wrongHash.h.sent[0] || "").startsWith(`${GREETING} `), wrongHash.h.sent[0]);
  const pending = await run([draft("aiGreeting", GREETING, "fr", FR_GREETING, { status: "pending" })], { language: "fr" });
  ok("a pending draft is not printed", (pending.h.sent[0] || "").startsWith(`${GREETING} `), pending.h.sent[0]);
  // Second reply on the same thread: no greeting, and no translations read.
  const second = await run([frDraft], { language: "fr", messageId: "m1" });
  const readsBefore = second.db.reads.filter((n) => n === "companyTextTranslation").length;
  // The homeowner writes again, after the first reply went out.
  second.db.$store.message.push({ id: "m2", threadId: "th1", direction: "in", private: false, body: "And Wednesday?", sentAt: new Date(t0.getTime() + 10 * 60_000), attachments: null, failedReason: null, sentByUserId: null });
  const h2 = harness(second.db);
  await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m2", channel: "web", language: "fr", send: h2.send, deps: h2.deps });
  const readsAfter = second.db.reads.filter((n) => n === "companyTextTranslation").length;
  ok("the second reply carries no greeting", h2.sent.length === 1 && !h2.sent[0].includes(FR_GREETING) && !h2.sent[0].includes(GREETING), h2.sent);
  ok("…and costs no translations query", readsAfter === readsBefore, { readsBefore, readsAfter });
  ok("the first reply cost exactly one translations query", readsBefore === 1, readsBefore);
}

console.log(`\ncheck-phrases-booking: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
