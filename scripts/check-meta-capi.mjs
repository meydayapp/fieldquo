// scripts/check-meta-capi.mjs
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-meta-capi.mjs
//
// "Send lead results to Meta" (lib/meta/capi/), executed rather than read.
//
// ══ What is at stake ═══════════════════════════════════════════════════════
//
// This feature sends facts about a contractor's customers to Meta. Three
// things must never happen and none of them can be seen by reading the code:
// a raw email or phone leaving FieldQuo, one company's events landing in
// another company's dataset, and an event sent while the company's switch is
// off. And one thing must always happen: an accidental tap must never be
// reported to Meta as a lead.
//
// So the real functions are imported and called — the stage rules, the
// payload builders, the hashing, the outbox (enqueue, the batched sender with
// its split-on-400 and backoff), the sweep against an in-memory database, the
// capture hooks, and the Graph client itself against a FAKE fetch. Nothing in
// this file can reach graph.facebook.com: globalThis.fetch is replaced before
// the client is imported, and the replacement throws on any URL it was not
// told to expect.
//
// The UI and the routes are scanned positionally for the few properties that
// are about wiring rather than behaviour.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const readCode = (p) =>
  read(p)
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    })
    .join("\n");

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ok   ${label}`))
    : (console.log(`  FAIL ${label}`), fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`));
const section = (t) => console.log(`\n${t}\n`);
const sha = (v) => createHash("sha256").update(v, "utf8").digest("hex");

// ── No live Meta, ever ─────────────────────────────────────────────────────
const fetchCalls = [];
let fetchScript = null; // (url, init) => { status, body }
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!fetchScript) throw new Error(`check-meta-capi: unexpected network call to ${u}`);
  fetchCalls.push({ url: u, init });
  const { status = 200, body = {} } = await fetchScript(u, init);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  };
};
process.env.META_TOKEN_ENCRYPTION_KEY = "22".repeat(32);

const hash = await import("../lib/meta/capi/hash.js");
const ev = await import("../lib/meta/capi/events.js");
const settingsMod = await import("../lib/meta/capi/settings.js");
const outbox = await import("../lib/meta/capi/outbox.js");
const sweep = await import("../lib/meta/capi/sweep.js");
const capture = await import("../lib/meta/capi/capture.js");
const testEv = await import("../lib/meta/capi/testEvent.js");
const client = await import("../lib/meta/client.js");
const crypto = await import("../lib/meta/tokenCrypto.js");
const stub = await import("./fixtures/dbStub.mjs");

// ═══════════════════════════════════════════════════════════════════════════
// An in-memory Prisma with just enough of the query language
// ═══════════════════════════════════════════════════════════════════════════
const OPS = new Set(["in", "not", "gte", "lte", "gt", "lt", "equals", "path"]);
function matches(row, where) {
  if (!where) return true;
  for (const [k, cond] of Object.entries(where)) {
    if (k === "OR") {
      if (!cond.some((w) => matches(row, w))) return false;
      continue;
    }
    if (k === "AND") {
      if (!cond.every((w) => matches(row, w))) return false;
      continue;
    }
    const v = row[k];
    if (cond && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)) {
      const keys = Object.keys(cond);
      if (keys.some((x) => OPS.has(x))) {
        if ("in" in cond && !cond.in.includes(v)) return false;
        if ("not" in cond && (cond.not === null ? v === null || v === undefined : v === cond.not)) return false;
        if ("gte" in cond && !(v !== null && v !== undefined && new Date(v) >= new Date(cond.gte))) return false;
        if ("lte" in cond && !(v !== null && v !== undefined && new Date(v) <= new Date(cond.lte))) return false;
        continue;
      }
      if (!v || typeof v !== "object" || !matches(v, cond)) return false;
      continue;
    }
    if (v !== cond) return false;
  }
  return true;
}
let idn = 0;
function fakePrisma(seed = {}) {
  const T = {
    metaConversionSettings: [],
    metaConversionEvent: [],
    metaPageConnection: [],
    company: [],
    leadRequest: [],
    messageThread: [],
    appointment: [],
    quote: [],
    funnelVisit: [],
    booking: [],
    ...seed,
  };
  const apply = (row, data) => {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && "increment" in v) row[k] = (row[k] || 0) + v.increment;
      else row[k] = v;
    }
    row.updatedAt = new Date();
  };
  const model = (name) => ({
    findUnique: async ({ where }) => T[name].find((r) => matches(r, where.companyId ? { companyId: where.companyId } : where)) || null,
    findFirst: async ({ where } = {}) => T[name].find((r) => matches(r, where)) || null,
    findMany: async ({ where, take, orderBy } = {}) => {
      let out = T[name].filter((r) => matches(r, where));
      if (orderBy) {
        const list = Array.isArray(orderBy) ? orderBy : [orderBy];
        out = [...out].sort((a, b) => {
          for (const o of list) {
            const [k, dir] = Object.entries(o)[0];
            const x = a[k] instanceof Date ? a[k].getTime() : a[k];
            const y = b[k] instanceof Date ? b[k].getTime() : b[k];
            if (x < y) return dir === "asc" ? -1 : 1;
            if (x > y) return dir === "asc" ? 1 : -1;
          }
          return 0;
        });
      }
      return take ? out.slice(0, take) : out;
    },
    createMany: async ({ data, skipDuplicates }) => {
      let count = 0;
      for (const d of data) {
        if (name === "metaConversionEvent" && T[name].some((r) => r.companyId === d.companyId && r.kind === d.kind && r.eventId === d.eventId)) {
          if (skipDuplicates) continue;
          throw new Error("unique violation");
        }
        T[name].push({ id: `${name}_${++idn}`, attempts: 0, createdAt: new Date(), ...d });
        count++;
      }
      return { count };
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const r of T[name]) if (matches(r, where)) (apply(r, data), count++);
      return { count };
    },
    upsert: async ({ where, create, update }) => {
      const r = T[name].find((x) => matches(x, where));
      if (r) {
        apply(r, update);
        return r;
      }
      const row = { id: `${name}_${++idn}`, ...create };
      T[name].push(row);
      return row;
    },
  });
  const p = { T };
  for (const k of Object.keys(T)) p[k] = model(k);
  return p;
}

const NOW = new Date("2026-10-05T12:00:00Z");
const daysAgo = (d) => new Date(NOW.getTime() - d * 86400000);
const META_LEAD = "123456789012345678".slice(0, 16); // 16 digits
const TOKEN_A = "EAAG" + "a".repeat(80);
const TOKEN_B = "EAAG" + "b".repeat(80);
const settingsRow = (companyId, over = {}) => ({
  id: `s_${companyId}`,
  companyId,
  enabled: true,
  termsAcceptedAt: daysAgo(1),
  datasetId: companyId === "co_a" ? "1111111111111111" : "2222222222222222",
  datasetTokenEnc: crypto.encryptToken(companyId === "co_a" ? TOKEN_A : TOKEN_B),
  ...over,
});

// ═══════════════════════════════════════════════════════════════════════════
section("Hashing — Meta's normalisation, then SHA-256");
// ═══════════════════════════════════════════════════════════════════════════
ok("email: trimmed and lower-cased before hashing", hash.normaliseEmail("  Jane.Doe@Example.COM ") === "jane.doe@example.com");
ok("email: hash is sha256 of the normalised value", hash.hashedEmail(" Jane.Doe@Example.COM")[0] === sha("jane.doe@example.com"));
ok("email: not an address → nothing", hash.hashedEmail("jane at example") === undefined && hash.hashedEmail(null) === undefined);
ok("phone: +1 (514) 555-0101 → 15145550101", hash.normalisePhone("+1 (514) 555-0101") === "15145550101");
ok("phone: national CA number gets the country code", hash.normalisePhone("514-555-0101", "CA") === "15145550101");
ok("phone: CA number already carrying 1", hash.normalisePhone("1 514 555 0101", "CA") === "15145550101");
ok("phone: UK trunk 0 dropped, 44 added", hash.normalisePhone("07700 900123", "GB") === "447700900123");
ok("phone: 00 international prefix", hash.normalisePhone("0044 7700 900123") === "447700900123");
ok("phone: Italy keeps its 0 (no trunk prefix)", hash.normalisePhone("06 1234 5678", "IT") === "390612345678");
ok("phone: country unknowable → nothing (never a guess)", hash.normalisePhone("514-555-0101", null) === null);
ok("phone: too short → nothing", hash.normalisePhone("555-0101", "CA") === null);
ok("phone: hash is of digits with the country code", hash.hashedPhone("(514) 555-0101", "CA")[0] === sha("15145550101"));
const contact = hash.hashedContact({ email: "A@B.co", phone: "514 555 0101", country: "CA" });
ok("hashedContact carries only hex digests", Object.values(contact).flat().every((v) => /^[0-9a-f]{64}$/.test(v)) && !JSON.stringify(contact).includes("@"), contact);

// ═══════════════════════════════════════════════════════════════════════════
section("CRM stages (Conversion Leads)");
// ═══════════════════════════════════════════════════════════════════════════
const lead = { id: "lead_1", metaLeadId: META_LEAD, createdAt: daysAgo(3), temperature: "warm", lostReason: null };
const stages = (over = {}, extra = {}) => ev.crmStagesForLead({ lead: { ...lead, ...over }, now: NOW, currency: "CAD", ...extra }).map((s) => s.stage);
ok("a warm form lead: Raw Lead then Qualified", JSON.stringify(stages()) === '["raw_lead","qualified"]', stages());
ok("a cold form lead: Raw Lead only", JSON.stringify(stages({ temperature: "cold" })) === '["raw_lead"]');
ok("warm but its conversation tier is `conversation` → not Qualified", !stages({}, { tier: "conversation" }).includes("qualified"));
ok("tier tap_only → Disqualified, and nothing after it", JSON.stringify(stages({}, { tier: "tap_only", quote: { status: "sent", sentAt: daysAgo(1) } })) === '["raw_lead","disqualified"]', stages({}, { tier: "tap_only" }));
ok("tier not_relevant → Disqualified", stages({}, { tier: "not_relevant" }).includes("disqualified"));
ok("a person's not-a-lead mark → Disqualified", stages({}, { notALead: true }).includes("disqualified"));
ok("lost as not a real inquiry → Disqualified", stages({ lostReason: "not_real_inquiry" }).includes("disqualified"));
ok("lost for price → NOT Disqualified (a real lead that went elsewhere)", !stages({ lostReason: "price_too_high" }).includes("disqualified"));
const full = ev.crmStagesForLead({
  lead,
  quote: { status: "accepted", sentAt: daysAgo(2), acceptedAt: daysAgo(1), total: "1000.00", acceptedTotal: "1234.5" },
  appointmentAt: daysAgo(2.5),
  currency: "cad",
  now: NOW,
});
ok("the whole funnel in order", JSON.stringify(full.map((s) => s.stage)) === '["raw_lead","qualified","appointment_booked","quote_sent","converted"]', full.map((s) => s.stage));
const conv = full.find((s) => s.stage === "converted");
ok("Converted carries acceptedTotal (not total) and the currency upper-cased", conv.value === 1234.5 && conv.currency === "CAD", conv);
ok("an appointment from BEFORE the lead is not this lead's booking", !ev.crmStagesForLead({ lead, appointmentAt: daysAgo(10), now: NOW }).some((s) => s.stage === "appointment_booked"));
ok("observed stages stop after Meta's 28-day window", !ev.crmStagesForLead({ lead: { ...lead, createdAt: daysAgo(40) }, now: NOW }).some((s) => s.stage === "qualified"));
ok("no Meta lead id → no CRM stages at all", ev.crmStagesForLead({ lead: { ...lead, metaLeadId: null }, now: NOW }).length === 0);
ok("a lead id that is not 15-17 digits is refused", ev.cleanMetaLeadId("12345") === null && ev.cleanMetaLeadId("1234567890123456789") === null && ev.cleanMetaLeadId(META_LEAD) === META_LEAD);

const crm = ev.crmEvent({ leadId: "lead_1", metaLeadId: META_LEAD, stage: "qualified", at: NOW, contact });
ok("CRM payload: action_source system_generated", crm.action_source === "system_generated");
ok("CRM payload: user_data.lead_id is Meta's lead id", crm.user_data.lead_id === META_LEAD);
ok("CRM payload: custom_data { lead_event_source: FieldQuo, event_source: crm }", crm.custom_data.lead_event_source === "FieldQuo" && crm.custom_data.event_source === "crm" && Object.keys(crm.custom_data).length === 2, crm.custom_data);
ok("CRM payload: event_id is leadId:stage", crm.event_id === "lead_1:qualified");
ok("CRM payload: event_name is the fixed English stage name", crm.event_name === "Qualified");
ok("CRM payload: event_time in UNIX seconds", crm.event_time === Math.floor(NOW.getTime() / 1000));
ok("CRM payload: em/ph hashed, nothing raw", crm.user_data.em[0] === sha("a@b.co") && !JSON.stringify(crm).includes("a@b.co"));
const crmConv = ev.crmEvent({ leadId: "lead_1", metaLeadId: META_LEAD, stage: "converted", at: NOW, value: 1234.5, currency: "CAD" });
ok("Converted: value and currency in custom_data", crmConv.custom_data.value === 1234.5 && crmConv.custom_data.currency === "CAD", crmConv.custom_data);
const ser = ev.serialiseEvents([crm]);
ok("serialised: lead_id goes out as a bare number, digits untouched", ser.includes(`"lead_id":${META_LEAD}`) && !ser.includes(`"lead_id":"`), ser.slice(0, 200));
ok("serialised: still valid JSON", (() => { try { JSON.parse(ser); return true; } catch { return false; } })());

// ═══════════════════════════════════════════════════════════════════════════
section("Business Messaging");
// ═══════════════════════════════════════════════════════════════════════════
const thread = (over = {}) => ({
  id: "th_1",
  createdAt: daysAgo(2),
  platform: "facebook",
  adReferral: { adId: "1" },
  temperature: "hot",
  leadCapture: { qualification: { tier: "lead", origin: "ad" } },
  ...over,
});
const mstages = (t, extra = {}) => ev.messagingStagesForThread({ thread: t, now: NOW, currency: "CAD", ...extra }).map((s) => s.stage);
ok("an ad conversation that is a hot lead → LeadSubmitted", JSON.stringify(mstages(thread())) === '["lead_submitted"]');
ok("tap_only → NOTHING (no event at all)", mstages(thread({ leadCapture: { qualification: { tier: "tap_only", origin: "ad" } } })).length === 0);
ok("not_relevant → NOTHING", mstages(thread({ leadCapture: { qualification: { tier: "not_relevant", origin: "ad" } } })).length === 0);
ok("tap_only with an accepted quote → still nothing", mstages(thread({ leadCapture: { qualification: { tier: "tap_only" } } }), { quote: { status: "accepted", total: 500, acceptedAt: daysAgo(1) } }).length === 0);
ok("a person's override to not_relevant wins over the rules' lead", mstages(thread({ leadCapture: { qualification: { tier: "lead", override: { tier: "not_relevant" } } } })).length === 0);
ok("marked not-a-lead → nothing", mstages(thread({ leadCapture: { qualification: { tier: "lead" }, notALead: { at: "x" } } })).length === 0);
ok("never classified → nothing", mstages(thread({ leadCapture: null })).length === 0);
ok("organic (no ad) conversation → nothing", mstages(thread({ adReferral: null, leadCapture: { qualification: { tier: "lead", origin: "organic" } } })).length === 0);
ok("history thread with the classifier's ad marker counts as ad", mstages(thread({ adReferral: null })).includes("lead_submitted"));
ok("cold lead tier → no LeadSubmitted", mstages(thread({ temperature: "cold" })).length === 0);
ok("WhatsApp is not a CAPI messaging channel here", mstages(thread({ platform: "whatsapp" })).length === 0);
const withSale = ev.messagingStagesForThread({ thread: thread(), quote: { status: "accepted", total: "800", acceptedTotal: null, acceptedAt: daysAgo(1) }, currency: "usd", now: NOW });
const purchase = withSale.find((s) => s.stage === "purchase");
ok("accepted quote → Purchase with value and currency", purchase && purchase.value === 800 && purchase.currency === "USD", withSale);
const msg = ev.messagingEvent({ threadId: "th_1", channel: "messenger", ownerId: "998877665544", scopedUserId: "PSID123", stage: "lead_submitted", at: NOW });
ok("Messenger payload: action_source business_messaging", msg.action_source === "business_messaging");
ok("Messenger payload: messaging_channel messenger", msg.messaging_channel === "messenger");
ok("Messenger payload: user_data { page_id, page_scoped_user_id } only", JSON.stringify(msg.user_data) === JSON.stringify({ page_id: "998877665544", page_scoped_user_id: "PSID123" }), msg.user_data);
ok("Messenger payload: event_name LeadSubmitted, event_id threadId:stage", msg.event_name === "LeadSubmitted" && msg.event_id === "th_1:lead_submitted");
const ig = ev.messagingEvent({ threadId: "th_2", channel: "instagram", ownerId: "17841400000000", scopedUserId: "IGSID9", stage: "purchase", at: NOW, value: 99.999, currency: "CAD" });
ok("Instagram payload: instagram_business_account_id + ig_sid", ig.user_data.instagram_business_account_id === "17841400000000" && ig.user_data.ig_sid === "IGSID9" && ig.messaging_channel === "instagram");
ok("Purchase: value rounded to cents, currency set", ig.custom_data.value === 100 && ig.custom_data.currency === "CAD", ig.custom_data);
ok("Purchase without a value is not built (Meta needs both)", ev.messagingEvent({ threadId: "t", channel: "messenger", ownerId: "1", scopedUserId: "2", stage: "purchase", at: NOW }) === null);

// ═══════════════════════════════════════════════════════════════════════════
section("Website — the same event_id as the browser pixel");
// ═══════════════════════════════════════════════════════════════════════════
const web = ev.websiteEvent({ eventId: "lead_web", stage: "lead", at: NOW, eventSourceUrl: "https://x.test/f/a/b", userAgent: "Mozilla/5.0", ip: "203.0.113.9", fbc: "fb.1.1.abc", contact });
ok("website Lead: event_name Lead (the pixel's own event name)", web.event_name === "Lead");
ok("website Lead: event_id is the lead id, as the browser's eventID", web.event_id === "lead_web");
ok("website Lead: action_source website, url + UA + fbc present", web.action_source === "website" && web.event_source_url && web.user_data.client_user_agent && web.user_data.fbc === "fb.1.1.abc");
ok("website Lead without a user agent is not built (Meta requires it)", ev.websiteEvent({ eventId: "x", stage: "lead", at: NOW, eventSourceUrl: "https://x.test/" }) === null);
const funnelSubmit = readCode("app/api/funnels/public/[companySlug]/[funnelSlug]/submit/route.js");
ok("funnel submit: the pixel's eventId IS the lead id", /eventId:\s*lead\.id/.test(funnelSubmit));
ok("funnel submit: the server Lead is queued with that same lead id", /captureWebsiteLead\(db,\s*\{[\s\S]{0,120}leadId:\s*lead\.id/.test(funnelSubmit));
const iq = readCode("app/api/instant-quote/[companySlug]/request/route.js");
ok("instant estimate: pixel eventId and server Lead both use the lead row's id", /eventId:\s*leadRow\?\.id/.test(iq) && /const leadId = leadRow\.id;[\s\S]{0,200}captureWebsiteLead\(db,\s*\{[^}]*leadId/.test(iq));
ok("browser Lead fires with eventID from the server's tracking.eventId", /eventId:\s*d\?\.tracking\?\.eventId/.test(read("app/f/[companySlug]/[funnelSlug]/FunnelRunner.js")));
ok("browser Schedule fires with the booking id as eventID", /tracking\.fire\("Schedule",[^)]*eventId:\s*b\?\.id/.test(read("app/instant-quote/[companySlug]/InstantQuoteFlow.js")));
ok("BookingFlow hands the booking id to onBooked", /onBooked\?\.\(\{\s*id:/.test(read("app/book/[companySlug]/BookingFlow.js")));
ok("pixels.js passes eventId to fbq as eventID", /fbq\("track", event, clean, \{ eventID: String\(eventId\) \}\)/.test(read("lib/funnels/pixels.js")));

// ═══════════════════════════════════════════════════════════════════════════
section("Readiness and the settings rules");
// ═══════════════════════════════════════════════════════════════════════════
const R = settingsMod.capiReadiness;
ok("no row → everything off", R({ settings: null }).crm === "off" && R({ settings: null }).messenger.state === "off");
ok("on without terms → no_terms", R({ settings: { enabled: true } }).crm === "no_terms");
ok("on, terms, no dataset → no_dataset", R({ settings: { enabled: true, termsAcceptedAt: NOW } }).crm === "no_dataset");
ok("on, terms, dataset, no token → no_token", R({ settings: { enabled: true, termsAcceptedAt: NOW, datasetId: "1111111111111111" } }).crm === "no_token");
ok("all set → ready", R({ settings: settingsRow("co_a") }).crm === "ready");
const page = { pageId: "998877665544", instagramUserId: "17841400000000", scopes: "pages_messaging,pages_show_list" };
ok("messaging without page_events → needs_permission naming page_events", R({ settings: settingsRow("co_a"), pageConnection: page }).messenger.state === "needs_permission" && R({ settings: settingsRow("co_a"), pageConnection: page }).messenger.permission === "page_events");
ok("instagram without instagram_manage_events → needs_permission", R({ settings: settingsRow("co_a"), pageConnection: page }).instagram.permission === "instagram_manage_events");
ok("with page_events granted → messenger ready", R({ settings: settingsRow("co_a"), pageConnection: { ...page, scopes: "page_events,pages_messaging" } }).messenger.state === "ready");
ok("no page → no_page", R({ settings: settingsRow("co_a"), pageConnection: null }).messenger.state === "no_page");
ok("token validation: whitespace refused", !settingsMod.cleanDatasetToken("EAAG abc " + "x".repeat(50)).ok && settingsMod.cleanDatasetToken(TOKEN_A).ok);
const bad = settingsMod.validateCapiPatch({ datasetId: "fbq('init','1')" });
ok("a pasted fbq line is refused as a dataset id", bad.errors.includes("datasetId"));
ok("public settings never carry the token", !JSON.stringify(settingsMod.publicCapiSettings(settingsRow("co_a"))).includes("datasetTokenEnc") && !JSON.stringify(settingsMod.publicCapiSettings(settingsRow("co_a"))).includes(TOKEN_A));
{
  const p = fakePrisma();
  const r = await settingsMod.saveCapiSettings({ companyId: "co_x", actor: { userId: "u1", name: "Owner" }, patch: settingsMod.validateCapiPatch({ enabled: true }), prisma: p, now: NOW });
  ok("switching ON without accepted terms is refused (terms_required)", !r.ok && r.error === "terms_required", r);
  const r2 = await settingsMod.saveCapiSettings({ companyId: "co_x", actor: { userId: "u1", name: "Owner" }, patch: settingsMod.validateCapiPatch({ enabled: true, acceptTerms: true, datasetId: "1111111111111111", datasetToken: TOKEN_A }), prisma: p, now: NOW });
  ok("terms accepted with who and when, then switched on", r2.ok && r2.row.enabled && r2.row.termsAcceptedById === "u1" && r2.row.termsAcceptedByName === "Owner" && r2.row.termsAcceptedAt === NOW, r2.row);
  ok("token stored encrypted, hint is the last four", r2.row.datasetTokenEnc && !r2.row.datasetTokenEnc.includes(TOKEN_A) && r2.row.datasetTokenHint === TOKEN_A.slice(-4));
}

// ═══════════════════════════════════════════════════════════════════════════
section("The Graph client — fake fetch, test_event_code, version constant");
// ═══════════════════════════════════════════════════════════════════════════
fetchScript = () => ({ status: 200, body: { events_received: 1 } });
const sent = await client.sendConversionEvents({ accessToken: TOKEN_A, datasetId: "1111111111111111", events: [crm], testEventCode: "TEST123", serialise: ev.serialiseEvents });
const call = fetchCalls.at(-1);
const form = new URLSearchParams(String(call.init.body));
ok("POST to /{dataset}/events on GRAPH_API_VERSION", call.url === `https://graph.facebook.com/${client.GRAPH_API_VERSION}/1111111111111111/events` && call.init.method === "POST", call.url);
ok("test_event_code honoured", form.get("test_event_code") === "TEST123");
ok("data is the serialised batch (lead_id bare)", form.get("data") === ev.serialiseEvents([crm]));
ok("success → ok", sent.ok === true);
fetchScript = () => ({ status: 200, body: {} });
await client.sendConversionEvents({ accessToken: TOKEN_A, datasetId: "1111111111111111", events: [crm] });
ok("no test code → no test_event_code param", !new URLSearchParams(String(fetchCalls.at(-1).init.body)).has("test_event_code"));
fetchScript = () => ({ status: 400, body: { error: { code: 100, message: "Invalid parameter" } } });
const refused = await client.sendConversionEvents({ accessToken: TOKEN_A, datasetId: "1111111111111111", events: [crm] });
ok("a refusal carries its HTTP status and Meta code", refused.ok === false && refused.status === 400 && refused.code === 100, refused);
const before = fetchCalls.length;
const tooMany = await client.sendConversionEvents({ accessToken: TOKEN_A, datasetId: "1111111111111111", events: new Array(1001).fill(crm) });
ok("more than 1,000 events is refused before any request", !tooMany.ok && fetchCalls.length === before);
ok("a test event names no person (external_id hash only)", JSON.stringify(Object.keys(testEv.testEvent({ companyId: "co_a" }).user_data)) === '["external_id"]');
ok("test codes are letters and digits only", testEv.cleanTestEventCode("TEST12345") === "TEST12345" && testEv.cleanTestEventCode("x; drop") === null);
fetchScript = null;

// ═══════════════════════════════════════════════════════════════════════════
section("The outbox — idempotency, the sender, retries");
// ═══════════════════════════════════════════════════════════════════════════
{
  const p = fakePrisma();
  const row = { kind: "crm", stage: "qualified", eventName: "Qualified", eventId: crm.event_id, leadId: "lead_1", eventTime: NOW, payload: crm };
  const a = await outbox.enqueueEvents(p, "co_a", [row], { now: NOW });
  const b = await outbox.enqueueEvents(p, "co_a", [{ ...row, eventTime: daysAgo(-1) }], { now: NOW });
  ok("event_id idempotency: the same leadId:stage twice is ONE row", a.queued === 1 && b.queued === 0 && p.T.metaConversionEvent.length === 1);
  ok("…and the first build is kept (observed time never moves)", p.T.metaConversionEvent[0].eventTime.getTime() === NOW.getTime());
  ok("the stored payload hash is sha256 of the payload", p.T.metaConversionEvent[0].payloadHash === sha(JSON.stringify(crm)));
  await outbox.enqueueEvents(p, "co_a", [{ ...row, eventId: "lead_old:raw_lead", eventTime: daysAgo(9) }], { now: NOW });
  ok("an event older than Meta's 7 days is stored expired, never pending", p.T.metaConversionEvent.find((r) => r.eventId === "lead_old:raw_lead").status === "expired");
  ok("the same event_id under another company is its own row", (await outbox.enqueueEvents(p, "co_b", [row], { now: NOW })).queued === 1);
}

const mkRows = (companyId, n, { bad = -1, prefix = "l" } = {}) =>
  Array.from({ length: n }, (_, i) => {
    const payload = ev.crmEvent({ leadId: `${prefix}${i}`, metaLeadId: META_LEAD, stage: "raw_lead", at: NOW });
    if (i === bad) payload.user_data.lead_id = "BAD";
    return { id: `${companyId}_r${i}`, companyId, kind: "crm", stage: "raw_lead", eventName: "Raw Lead", eventId: payload.event_id, eventTime: NOW, payload, status: "pending", attempts: 0, nextAttemptAt: NOW, createdAt: NOW };
  });

{
  section("…switch off → nothing sent");
  const p = fakePrisma({ metaConversionSettings: [settingsRow("co_a", { enabled: false })], company: [{ id: "co_a", name: "Alpha Painting" }], metaConversionEvent: mkRows("co_a", 3) });
  const calls = [];
  const s = await outbox.deliverPending(p, { now: NOW, send: async (x) => (calls.push(x), { ok: true }) });
  ok("switch off: the sender is never called", calls.length === 0, calls.length);
  ok("switch off: rows stay pending (and will expire), not sent", p.T.metaConversionEvent.every((r) => r.status === "pending") && s.skipped === 3);
  const sw = await sweep.sweepCompany(p, { companyId: "co_a", now: NOW });
  ok("switch off: the sweep queues nothing", sw.enabled === false && sw.queued === 0);
  const cap = await capture.captureDeletedNotALead(p, { companyId: "co_a", leads: [{ id: "x", createdAt: daysAgo(1), metaLeadIds: [META_LEAD] }], now: NOW });
  ok("switch off: a not-a-lead delete queues nothing", cap.queued === 0 && p.T.metaConversionEvent.length === 3);
}

{
  section("…two companies, two datasets — never crossed");
  const p = fakePrisma({
    metaConversionSettings: [settingsRow("co_a"), settingsRow("co_b")],
    company: [{ id: "co_a", name: "Alpha Painting" }, { id: "co_b", name: "Beta Floors" }],
    metaConversionEvent: [...mkRows("co_a", 2, { prefix: "a" }), ...mkRows("co_b", 3, { prefix: "b" })],
  });
  const calls = [];
  await outbox.deliverPending(p, { now: NOW, send: async (x) => (calls.push(x), { ok: true, data: { events_received: x.events.length } }) });
  const aCall = calls.find((c) => c.events.some((e) => e.event_id.startsWith("a")));
  const bCall = calls.find((c) => c.events.some((e) => e.event_id.startsWith("b")));
  ok("company A's events go to A's dataset with A's token only", aCall && aCall.datasetId === "1111111111111111" && aCall.accessToken === TOKEN_A && aCall.events.every((e) => e.event_id.startsWith("a")));
  ok("company B's events go to B's dataset with B's token only", bCall && bCall.datasetId === "2222222222222222" && bCall.accessToken === TOKEN_B && bCall.events.every((e) => e.event_id.startsWith("b")));
  ok("one request per company here (batched)", calls.length === 2, calls.length);
  ok("every row marked sent with sentAt", p.T.metaConversionEvent.every((r) => r.status === "sent" && r.sentAt));
}

{
  section("…a 400 in a batch: split down to the bad event, the rest delivered");
  const rows = mkRows("co_a", 8, { bad: 5 });
  const p = fakePrisma({ metaConversionSettings: [settingsRow("co_a")], company: [{ id: "co_a", name: "Alpha Painting" }], metaConversionEvent: rows });
  const calls = [];
  const s = await outbox.deliverPending(p, {
    now: NOW,
    send: async (x) => {
      calls.push(x.events.length);
      return x.events.some((e) => e.user_data.lead_id === "BAD") ? { ok: false, kind: "unknown_error", status: 400, code: 100, message: "Invalid lead_id" } : { ok: true };
    },
  });
  const badRow = p.T.metaConversionEvent.find((r) => r.id === "co_a_r5");
  ok("the bad event is failed with Meta's reason and status", badRow.status === "failed" && badRow.lastStatusCode === 400 && /Invalid lead_id/.test(badRow.lastError), badRow);
  ok("the seven good events beside it were delivered", p.T.metaConversionEvent.filter((r) => r.status === "sent").length === 7, s);
  ok("a failed 400 is not retried: no future attempt", badRow.status !== "pending");
  const again = [];
  await outbox.deliverPending(p, { now: new Date(NOW.getTime() + 86400000), send: async (x) => (again.push(x), { ok: true }) });
  ok("…a later run does not send it again", again.length === 0);
  const logged = stub.rows.platformErrorLog.find((r) => r.companyId === "co_a" && r.area === "meta_capi");
  ok("the refusal is in the platform error log with the company NAMED", logged && /Alpha Painting/.test(logged.message), logged);
}

{
  section("…5xx: retried with backoff, then given up on");
  const p = fakePrisma({ metaConversionSettings: [settingsRow("co_a")], company: [{ id: "co_a", name: "Alpha Painting" }], metaConversionEvent: mkRows("co_a", 2) });
  const send = async () => ({ ok: false, kind: "unknown_error", status: 500, message: "Service temporarily unavailable" });
  await outbox.deliverPending(p, { now: NOW, send });
  const r = p.T.metaConversionEvent[0];
  ok("a 500 leaves the row pending with one attempt", r.status === "pending" && r.attempts === 1);
  ok("…and a next attempt in the future (backoff)", r.nextAttemptAt > NOW, r.nextAttemptAt);
  ok("backoff grows: 5 min, 10 min, 20 min …", outbox.nextAttemptAfter(1, NOW) - NOW === 5 * 60000 && outbox.nextAttemptAfter(3, NOW) - NOW === 20 * 60000);
  ok("backoff is capped at 6 hours", outbox.nextAttemptAfter(30, NOW) - NOW === 6 * 3600000);
  const notDue = [];
  await outbox.deliverPending(p, { now: new Date(NOW.getTime() + 60000), send: async (x) => (notDue.push(x), { ok: true }) });
  ok("not retried before its backoff is up", notDue.length === 0);
  let t = NOW.getTime();
  for (let i = 0; i < outbox.MAX_ATTEMPTS + 2; i++) {
    t += 7 * 3600000;
    await outbox.deliverPending(p, { now: new Date(Math.min(t, NOW.getTime() + 6.5 * 86400000)), send });
  }
  ok(`after ${outbox.MAX_ATTEMPTS} attempts it is failed, not retried forever`, p.T.metaConversionEvent.every((x) => x.status === "failed" && x.attempts === outbox.MAX_ATTEMPTS), p.T.metaConversionEvent.map((x) => [x.status, x.attempts]));
  ok("failureAction: 400 alone → fail; 400 in a batch → split; 429/401/500 → retry", outbox.failureAction({ status: 400 }, 1) === "fail" && outbox.failureAction({ status: 400 }, 2) === "split" && outbox.failureAction({ status: 429, kind: "rate_limited" }, 1) === "retry" && outbox.failureAction({ status: 401, kind: "auth_error" }, 1) === "retry" && outbox.failureAction({ status: 500 }, 1) === "retry");
}

{
  section("…a row past Meta's window is expired at send time");
  const rows = mkRows("co_a", 1);
  rows[0].eventTime = daysAgo(8);
  const p = fakePrisma({ metaConversionSettings: [settingsRow("co_a")], company: [{ id: "co_a", name: "A" }], metaConversionEvent: rows });
  const calls = [];
  await outbox.deliverPending(p, { now: NOW, send: async (x) => (calls.push(x), { ok: true }) });
  ok("expired, and not sent", p.T.metaConversionEvent[0].status === "expired" && calls.length === 0);
}

{
  section("…a batch over 1,000 goes in chunks of Meta's maximum");
  const p = fakePrisma({ metaConversionSettings: [settingsRow("co_a")], company: [{ id: "co_a", name: "A" }], metaConversionEvent: mkRows("co_a", 2100) });
  const sizes = [];
  await outbox.deliverPending(p, { now: NOW, send: async (x) => (sizes.push(x.events.length), { ok: true }) });
  ok("2,100 events → 1000 + 1000 + 100", JSON.stringify(sizes) === "[1000,1000,100]", sizes);
}

// ═══════════════════════════════════════════════════════════════════════════
section("The sweep against an in-memory database");
// ═══════════════════════════════════════════════════════════════════════════
{
  const p = fakePrisma({
    metaConversionSettings: [settingsRow("co_a"), settingsRow("co_b")],
    company: [{ id: "co_a", name: "Alpha", currency: "CAD", country: "CA" }, { id: "co_b", name: "Beta", currency: "USD", country: "US" }],
    metaPageConnection: [{ companyId: "co_a", pageId: "998877665544", instagramUserId: "17841400000000", scopes: "page_events,pages_messaging", pageAccessTokenEnc: crypto.encryptToken("PAGE_TOKEN_A"), disconnectedAt: null, connectedAt: daysAgo(30) }],
    leadRequest: [
      { id: "L_warm", companyId: "co_a", metaLeadId: "1000000000000001", createdAt: daysAgo(2), temperature: "hot", lostReason: null, email: "Hot@Lead.com", phone: "514 555 0101", quoteId: "Q1", quote: { id: "Q1", status: "accepted", sentAt: daysAgo(1.5), acceptedAt: daysAgo(1), total: "2000", acceptedTotal: "2100", clientId: "C1" } },
      { id: "L_tap", companyId: "co_a", metaLeadId: "1000000000000002", createdAt: daysAgo(2), temperature: "warm", lostReason: null, email: null, phone: null, quoteId: null, quote: null },
      { id: "L_web", companyId: "co_a", metaLeadId: null, createdAt: daysAgo(1), temperature: "warm", lostReason: null, email: "web@x.co", phone: null, quoteId: "Q2", quote: { id: "Q2", status: "accepted", acceptedAt: daysAgo(0.5), total: "500", acceptedTotal: null, clientId: "C2" }, attribution: { fbc: "fb.1.1.zz" } },
      { id: "L_other", companyId: "co_b", metaLeadId: "1000000000000003", createdAt: daysAgo(2), temperature: "hot", lostReason: null, email: null, phone: null, quoteId: null, quote: null },
    ],
    messageThread: [
      { id: "T_tap", companyId: "co_a", leadId: "L_tap", createdAt: daysAgo(2), participantExternalId: "PSID_TAP", adReferral: { adId: "9" }, leadCapture: { qualification: { tier: "tap_only", origin: "ad" } }, temperature: null, clientId: null, quoteId: null, channel: { platform: "facebook", externalId: "998877665544" } },
      { id: "T_lead", companyId: "co_a", leadId: null, createdAt: daysAgo(1), participantExternalId: "PSID_LEAD", adReferral: { adId: "9" }, leadCapture: { qualification: { tier: "lead", origin: "ad" } }, temperature: "warm", clientId: "C1", quoteId: null, channel: { platform: "facebook", externalId: "998877665544" } },
      { id: "T_ig", companyId: "co_a", leadId: null, createdAt: daysAgo(1), participantExternalId: "IGSID_X", adReferral: { adId: "8" }, leadCapture: { qualification: { tier: "not_relevant", origin: "ad" } }, temperature: "hot", clientId: null, quoteId: null, channel: { platform: "instagram", externalId: "17841400000000" } },
    ],
    appointment: [{ companyId: "co_a", quoteId: "Q1", clientId: "C1", createdAt: daysAgo(1.8) }],
    quote: [{ id: "Q1", companyId: "co_a", status: "accepted", sentAt: daysAgo(1.5), acceptedAt: daysAgo(1), total: "2000", acceptedTotal: "2100", clientId: "C1" }],
  });
  const r = await sweep.sweepCompany(p, { companyId: "co_a", now: NOW });
  const q = p.T.metaConversionEvent.filter((x) => x.companyId === "co_a");
  const ids = q.map((x) => x.eventId).sort();
  ok("warm lead: raw, qualified, appointment, quote sent, converted", ["L_warm:raw_lead", "L_warm:qualified", "L_warm:appointment_booked", "L_warm:quote_sent", "L_warm:converted"].every((i) => ids.includes(i)), ids);
  ok("the tap lead (its conversation was tap_only): raw + disqualified, never qualified", ids.includes("L_tap:disqualified") && !ids.includes("L_tap:qualified"), ids);
  ok("the tap conversation itself sends NO messaging event", !ids.some((i) => i.startsWith("T_tap")));
  ok("the not_relevant Instagram conversation sends nothing", !ids.some((i) => i.startsWith("T_ig")));
  ok("the warm ad conversation: LeadSubmitted, and Purchase from its client's accepted quote", ids.includes("T_lead:lead_submitted") && ids.includes("T_lead:purchase"), ids);
  const purch = q.find((x) => x.eventId === "T_lead:purchase");
  ok("…Purchase value 2100 CAD (acceptedTotal), page id and PSID", purch.payload.custom_data.value === 2100 && purch.payload.custom_data.currency === "CAD" && purch.payload.user_data.page_scoped_user_id === "PSID_LEAD" && purch.payload.user_data.page_id === "998877665544", purch.payload);
  const conv2 = q.find((x) => x.eventId === "L_warm:converted");
  ok("Converted carries 2100 CAD", conv2.payload.custom_data.value === 2100 && conv2.payload.custom_data.currency === "CAD");
  ok("CRM rows carry hashed em/ph from the lead, CA country code applied", conv2.payload.user_data.em[0] === sha("hot@lead.com") && conv2.payload.user_data.ph[0] === sha("15145550101"));
  ok("no raw email or phone anywhere in the outbox", !JSON.stringify(p.T.metaConversionEvent).match(/Hot@Lead|hot@lead\.com|514 555/i));
  ok("the other company's lead is not in this company's sweep", !ids.some((i) => i.startsWith("L_other")));
  ok("a website lead without a captured Lead row gets no Purchase (no user agent to send)", !ids.some((i) => i.startsWith("L_web")));
  const again = await sweep.sweepCompany(p, { companyId: "co_a", now: new Date(NOW.getTime() + 15 * 60000) });
  ok("a second sweep queues nothing new (idempotent)", again.queued === 0, again.queued);
  // the messaging permission missing → no messaging rows
  p.T.metaPageConnection[0].scopes = "pages_messaging";
  p.T.metaConversionEvent.length = 0;
  await sweep.sweepCompany(p, { companyId: "co_a", now: NOW });
  ok("without page_events granted, NO messaging events are queued", !p.T.metaConversionEvent.some((x) => x.kind === "messaging"));
  ok("…while lead-form stages still flow (they need no App Review)", p.T.metaConversionEvent.some((x) => x.kind === "crm"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("Capture hooks");
// ═══════════════════════════════════════════════════════════════════════════
{
  const p = fakePrisma({ metaConversionSettings: [settingsRow("co_a")], company: [{ id: "co_a", name: "Alpha", currency: "CAD", country: "CA", pixelConsentRequired: false, metaPixelId: "1111111111111111" }] });
  const r = await capture.captureDeletedNotALead(p, { companyId: "co_a", leads: [{ id: "L9", createdAt: daysAgo(3), metaLeadIds: [META_LEAD] }], now: NOW });
  const row = p.T.metaConversionEvent[0];
  ok("delete-as-not-a-lead → Disqualified queued under Meta's lead id", r.queued === 1 && row.stage === "disqualified" && row.payload.user_data.lead_id === META_LEAD && row.eventId === "L9:disqualified", row);
  ok("…with no contact details at all", JSON.stringify(Object.keys(row.payload.user_data)) === '["lead_id"]');
  const routes = ["app/api/leads/route.js", "app/api/leads/[id]/route.js", "app/api/leads/review-conversations/route.js"].map(readCode);
  ok("all three delete routes queue it AFTER the response", routes.every((s) => /afterResponse\(\(\) => captureDeletedNotALead\(/.test(s)));
  ok("the website Lead and Schedule captures run after the response too", /afterResponse\(\(\) =>\s*captureWebsiteLead\(/.test(readCode("app/api/funnels/public/[companySlug]/[funnelSlug]/submit/route.js")) && /afterResponse\(\(\) => captureWebsiteLead\(/.test(readCode("app/api/instant-quote/[companySlug]/request/route.js")) && /afterResponse\(\(\) => captureWebsiteBooking\(/.test(readCode("app/api/booking/[companySlug]/confirm/route.js")));
  ok("afterResponse uses Next's after() and never throws outside a request", /nextServer\.after\(task\)/.test(readCode("lib/meta/capi/afterResponse.js")));
  ok("deleteLeads hands over metaDisqualify only with the not-a-lead mark", /metaDisqualify:\s*notALead/.test(readCode("lib/leads/deleteLead.js")));

  const req = (ua = "Mozilla/5.0 (iPhone)") => ({
    url: "https://fieldquo.com/api/funnels/public/a/b/submit",
    headers: { get: (k) => ({ "user-agent": ua, referer: "https://fieldquo.com/f/acme/kitchen?utm_source=fb&fbclid=XYZ", "x-forwarded-for": "203.0.113.7, 10.0.0.1" })[k.toLowerCase()] || null },
  });
  p.T.leadRequest.push({ id: "LW", companyId: "co_a", email: "W@X.co", phone: null, createdAt: NOW, attribution: { fbc: "fb.1.170.XYZ" } });
  const w = await capture.captureWebsiteLead(p, { companyId: "co_a", leadId: "LW", pixelId: "1111111111111111", request: req(), now: NOW });
  const wr = p.T.metaConversionEvent.find((x) => x.kind === "website");
  ok("website Lead queued with event_id = lead id", w.queued === 1 && wr.eventId === "LW" && wr.payload.event_id === "LW");
  ok("…url without its query string (no fbclid/utm leaked twice)", wr.payload.event_source_url === "https://fieldquo.com/f/acme/kitchen");
  ok("…UA, first-hop IP, fbc and hashed email", wr.payload.user_data.client_user_agent === "Mozilla/5.0 (iPhone)" && wr.payload.user_data.client_ip_address === "203.0.113.7" && wr.payload.user_data.fbc === "fb.1.170.XYZ" && wr.payload.user_data.em[0] === sha("w@x.co"));
  p.T.leadRequest.push({ id: "LW2", companyId: "co_a", email: "a@b.co", createdAt: NOW, attribution: { fbc: "fb.1.1.Q" } });
  ok("a funnel whose pixel is NOT the chosen dataset sends nothing", (await capture.captureWebsiteLead(p, { companyId: "co_a", leadId: "LW2", pixelId: "3333333333333333", request: req(), now: NOW })).reason === "different_pixel");
  p.T.leadRequest.push({ id: "LW3", companyId: "co_a", email: "a@b.co", createdAt: NOW, attribution: { source: "direct" } });
  ok("a visit with no Meta click sends nothing", (await capture.captureWebsiteLead(p, { companyId: "co_a", leadId: "LW3", request: req(), now: NOW })).reason === "no_click");
  p.T.company[0].pixelConsentRequired = true;
  ok("a company that asks visitors first sends nothing server-side", (await capture.captureWebsiteLead(p, { companyId: "co_a", leadId: "LW2", pixelId: "1111111111111111", request: req(), now: NOW })).reason === "consent_required");
  p.T.company[0].pixelConsentRequired = false;
  ok("another company's lead id is not found under this company", (await capture.captureWebsiteLead(p, { companyId: "co_b", leadId: "LW", request: req(), now: NOW })).queued === 0);
  // Purchase for the captured website lead, through the sweep
  p.T.leadRequest.find((l) => l.id === "LW").quoteId = "QW";
  p.T.leadRequest.find((l) => l.id === "LW").quote = { id: "QW", status: "accepted", acceptedAt: NOW, total: "750", acceptedTotal: null, clientId: "CW" };
  await sweep.sweepCompany(p, { companyId: "co_a", now: NOW });
  const wp = p.T.metaConversionEvent.find((x) => x.eventId === "LW:purchase");
  ok("website Purchase reuses the captured browser facts, with 750 + currency", wp && wp.payload.user_data.client_user_agent === "Mozilla/5.0 (iPhone)" && wp.payload.custom_data.value === 750, wp?.payload);

  p.T.booking.push({ id: "BK1", eventType: { companyId: "co_a" }, clientEmail: "b@k.co", clientPhone: null, status: "confirmed" });
  p.T.funnelVisit.push({ companyId: "co_a", bookingId: "BK1", fbc: "fb.1.2.BK" });
  const bk = await capture.captureWebsiteBooking(p, { companyId: "co_a", bookingId: "BK1", request: req(), now: NOW });
  const bkr = p.T.metaConversionEvent.find((x) => x.eventId === "BK1");
  ok("website Schedule queued with event_id = booking id", bk.queued === 1 && bkr.payload.event_name === "Schedule" && bkr.payload.user_data.fbc === "fb.1.2.BK");
}

// ═══════════════════════════════════════════════════════════════════════════
section("Wiring: settings screen, routes, cron, env");
// ═══════════════════════════════════════════════════════════════════════════
const panel = readCode("app/app/settings/meta-ads/MetaConversionsPanel.js");
ok("the switch cannot turn ON before the terms are accepted", /disabled=\{saving \|\| \(!s\.enabled && !termsAccepted\)\}/.test(panel));
ok("the test button's disabled state and title both read the same reason", /disabled=\{Boolean\(testDisabledReason\) \|\| testing\}\s*title=\{testDisabledReason \|\| undefined\}/.test(panel));
ok("the messaging state names the missing Meta permission", /needsPermission", \{ permission: c\.permission \}/.test(panel));
ok("the panel is on the Meta Ads screen", /<MetaConversionsPanel \/>/.test(readCode("app/app/settings/meta-ads/page.js")));
const route = readCode("app/api/settings/meta-conversions/route.js");
ok("PATCH refuses a support session and non-admins", /export async function PATCH[\s\S]*member\.impersonation[\s\S]*isBillingAdmin/.test(route));
ok("the test route refuses a support session", /member\.impersonation/.test(readCode("app/api/settings/meta-conversions/test/route.js")));
const vercel = read("vercel.json");
ok("the quarter-hour cron is scheduled", /"\/api\/cron\/meta-conversions",\s*"schedule": "\*\/15 \* \* \* \*"/.test(vercel));
ok("the daily catch-up cron is scheduled", /"\/api\/cron\/meta-conversions-daily"/.test(vercel));
ok("both cron routes are gated by requireCronSecret", ["app/api/cron/meta-conversions/route.js", "app/api/cron/meta-conversions-daily/route.js"].every((f) => /requireCronSecret\(request\)/.test(readCode(f))));
ok("META_PAGE_EVENTS_ENABLED is documented in docs/VERCEL.md", read("docs/VERCEL.md").includes("META_PAGE_EVENTS_ENABLED"));
ok("the Graph version comes from the one constant (no second version string)", !/graph\.facebook\.com\/v\d/.test(readCode("lib/meta/capi/outbox.js") + readCode("lib/meta/capi/capture.js")));
ok("with META_PAGE_EVENTS_ENABLED unset, the Pages scope is unchanged", !client.metaPagesRequestedScope().includes("page_events"));
process.env.META_PAGE_EVENTS_ENABLED = "1";
ok("with it set, page_events and instagram_manage_events are asked for", client.metaPagesRequestedScope().includes("page_events") && client.metaPagesRequestedScope().includes("instagram_manage_events"));
delete process.env.META_PAGE_EVENTS_ENABLED;
ok("no live call to Meta was made by this check", fetchCalls.every((c) => c.url.startsWith(`https://graph.facebook.com/${client.GRAPH_API_VERSION}/1111111111111111/events`)));

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
