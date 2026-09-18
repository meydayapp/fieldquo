// @/lib/fetchJson for the console harness. Answers from fixtures; keeps a
// little state so claiming, dialling and dispositions are visible.
import { ITEMS, GROUPS, ITEMS_SHUT, GROUPS_SHUT, TRADES, PLAYBOOK, NOTES, ME, BADGES, currentFor, playbookIn } from "../fixtures.js";
import { dispositionOptions } from "@/lib/sales/calls/dispositions";
import { STATUS_CHOICES, STATE_ORDER, REP_STATES, PAUSE_REASON_ORDER, PAUSE_REASONS } from "@/lib/sales/calls/agentState";
import { weaveDisclosure } from "@/lib/sales/playbook/recordingDisclosure";

// The route weaves the recording aside into every opener as it is read
// (app/api/sales/playbook/route.js); the fixture's stored script is woven
// the same way so the frame shows what a rep reads.
const woven = (body, language) =>
  body?.callScript?.opener ? { ...body, callScript: { ...body.callScript, opener: weaveDisclosure(body.callScript.opener, language) } } : body;

const state = { autodial: false, pending: null, presence: { state: "available", forMs: 12 * 60000, stale: false, pauseReason: null }, notes: [...NOTES], attempts: 0 };
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const scenario = () => new URLSearchParams(window.location.search).get("scenario") || "default";

function queueBody(prospectId) {
  const empty = scenario() === "empty";
  const shut = scenario() === "shut";
  const items = empty ? [] : shut ? (state.topped ? [
    { ...ITEMS_SHUT[5], id: "t1", businessName: "Cascade Volt Works", city: "Bend", province: "OR", window: { ...ITEMS[0].window, zoneShort: "PDT", zone: "America/Los_Angeles", zoneLabel: "Pacific Time", zoneAcronym: "PT", closesAtLocal: "11:00 PM" } },
    { ...ITEMS_SHUT[5], id: "t2", businessName: "Tahoe Electric Co.", city: "Truckee", province: "CA", window: { ...ITEMS[0].window, zoneShort: "PDT", zone: "America/Los_Angeles", zoneLabel: "Pacific Time", zoneAcronym: "PT", closesAtLocal: "11:00 PM" } },
    { ...ITEMS_SHUT[5], id: "t3", businessName: "Puget Sound Wiring", city: "Tacoma", province: "WA", window: { ...ITEMS[0].window, zoneShort: "PDT", zone: "America/Los_Angeles", zoneLabel: "Pacific Time", zoneAcronym: "PT", closesAtLocal: "11:00 PM" } },
    ...ITEMS_SHUT.slice(2)] : ITEMS_SHUT) : ITEMS;
  const wanted = prospectId && items.some((i) => i.id === prospectId) ? prospectId : items[0]?.id;
  const cur = empty ? null : currentFor(wanted || (shut ? "s1" : "p1"));
  if (shut && cur) { cur.callingContext = { country: "US", province: "NY", timeZone: "America/New_York", attemptsLast24h: 0 }; cur.compliance = null; }
  if (cur && cur.id === "p1" && state.extraNumbers?.length) cur.numbers.voice.choices = [...cur.numbers.voice.choices, ...state.extraNumbers];
  return {
    // ?testAccount=1 — the owner's own dialler-testing rep: the shell's
    // banner and the pad's "not saved on this lead" caveat (2026-09-17).
    rep: { id: ME.id, name: ME.name, email: ME.email, testAccount: new URLSearchParams(window.location.search).get("testAccount") === "1" },
    tradeKey: "electrical",
    trades: TRADES,
    queue: { items, empty, emptyReason: empty ? "nothing_claimed" : null, emptyText: empty ? "You have nothing claimed in Electrical. 62 are free to claim — press the button." : null, windows: { repZone: "America/New_York", language: "en", groups: empty ? [] : shut ? (state.topped ? [{ key: "now", kind: "now", count: 3, ids: ["t1", "t2", "t3"] }, ...GROUPS_SHUT.slice(1)] : GROUPS_SHUT) : GROUPS } },
    current: cur,
    claimHours: 48,
    batch: { max: 25, topUpBelow: 5, topUpIntervalMs: 60000, takenToday: 11, timeZone: "America/New_York", result: null },
    // A fixed clock, so the window the console recomputes is the fixture's
    // and not the machine's: 2:00 pm Central for the day scenario, 9:20 pm
    // Eastern for the shut one.
    serverNow: shut ? "2026-09-12T01:20:00.000Z" : "2026-09-11T19:00:00.000Z",
    // The day's automatic give-backs (lib/sales/queueGivenBack.js): one
    // closed-window event, so the "Given back today" strip has a row.
    givenBack: empty
      ? { since: "2026-09-11T04:00:00.000Z", events: [], readError: null }
      : {
          since: "2026-09-11T04:00:00.000Z",
          readError: null,
          events: [{ at: "2026-09-11T17:05:00.000Z", atLocal: "1:05 PM", zone: "ET", reason: "closed", whyKey: "app.salesQueue.givenBack.why.closed", count: 2, names: ["Harbor Light Electric", "Redbud Wiring Co."] }],
        },
  };
}

// ── 2026-09-17 surfaces ───────────────────────────────────────────────────
// What has happened on the phone with a business (CallHistory.js): three
// outbound rows and the two inbound outcomes that used to be invisible —
// a voicemail with Play, and a missed ring-back.
const minsAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
function historyBody(prospectId) {
  if (prospectId !== "p1") return { store: { ready: true, missing: [] }, history: [], lastTime: null, serverNow: new Date().toISOString() };
  return {
    store: { ready: true, missing: [] },
    history: [
      { id: "h1", dialledAt: minsAgo(35), direction: "in", channel: "browser", mine: true, ended: null, talkSeconds: null, disposition: null, dispositionAt: null, autoLogged: false, deferred: false, note: null, callbackAt: null, voicemail: { seconds: 22, href: "/api/sales/voicemail/h1/audio" }, missed: false },
      { id: "h2", dialledAt: minsAgo(50), direction: "in", channel: "browser", mine: true, ended: null, talkSeconds: null, disposition: null, dispositionAt: null, autoLogged: false, deferred: false, note: null, callbackAt: null, voicemail: null, missed: true },
      { id: "h3", dialledAt: minsAgo(65), direction: "out", channel: "browser", mine: true, ended: { key: "app.salesCall.ended.prospect", talkSeconds: 252 }, talkSeconds: 252, disposition: "reached_interested", dispositionAt: minsAgo(60), autoLogged: false, deferred: false, note: "call after the season", callbackAt: new Date(Date.now() + 26 * 3600000).toISOString(), voicemail: null, missed: false },
      { id: "h4", dialledAt: minsAgo(3000), direction: "out", channel: "browser", mine: false, ended: { key: "app.salesCall.ended.noAnswer", talkSeconds: null }, talkSeconds: null, disposition: "no_answer", dispositionAt: minsAgo(2999), autoLogged: true, deferred: false, note: null, callbackAt: null, voicemail: null, missed: false },
    ],
    lastTime: { dialledAt: minsAgo(65), disposition: "reached_interested", note: "call after the season" },
    serverNow: new Date().toISOString(),
  };
}
// The call-backs this rep promised (CallbacksStrip.js): one due on a
// business still held (Call now), one later on the rep's own lead (a link),
// one on a typed number (nothing to press).
function callbacksBody() {
  return {
    store: { ready: true, missing: [] },
    count: 3,
    due: 1,
    items: [
      { id: "cb1", prospectId: "p1", leadId: null, businessName: "South County Electric, LLC", toE164: "+14055550100", callbackAt: minsAgo(20), promisedAt: minsAgo(1500), note: "Dave asked for three o'clock", due: true, held: true },
      { id: "cb2", prospectId: null, leadId: "lead1", businessName: "Bright Current Electrical", toE164: "+19185550123", callbackAt: new Date(Date.now() + 3 * 3600000).toISOString(), promisedAt: minsAgo(400), note: null, due: false, held: false },
      { id: "cb3", prospectId: null, leadId: null, businessName: null, toE164: "+14055550142", callbackAt: new Date(Date.now() + 26 * 3600000).toISOString(), promisedAt: minsAgo(90), note: null, due: false, held: false },
    ],
    serverNow: new Date().toISOString(),
  };
}

export async function fetchJson(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const u = new URL(url, "http://harness.local");
  const body = options.body ? JSON.parse(options.body) : null;
  await delay(20);
  (window.__harnessCalls ||= []).push({ url, method, body });
  const p = u.pathname;
  if (p === "/api/sales/queue" && method === "GET") return queueBody(u.searchParams.get("prospectId"));
  if (p === "/api/sales/queue" && method === "POST") {
    const b = queueBody(body.prospectId || new URLSearchParams(window.location.search).get("prospectId") || null);
    if (body.action === "claim_batch" && body.auto && scenario() === "shut") {
      // The top-up: three Pacific rows open now, appended; two dead Eastern rows released.
      const added = [
        { ...ITEMS_SHUT[5], id: "t1", businessName: "Cascade Volt Works", city: "Bend", province: "OR", window: { ...ITEMS[0].window, zoneShort: "PDT", zone: "America/Los_Angeles", zoneLabel: "Pacific Time", zoneAcronym: "PT", closesAtLocal: "11:00 PM" } },
        { ...ITEMS_SHUT[5], id: "t2", businessName: "Tahoe Electric Co.", city: "Truckee", province: "CA", window: { ...ITEMS[0].window, zoneShort: "PDT", zone: "America/Los_Angeles", zoneLabel: "Pacific Time", zoneAcronym: "PT", closesAtLocal: "11:00 PM" } },
        { ...ITEMS_SHUT[5], id: "t3", businessName: "Puget Sound Wiring", city: "Tacoma", province: "WA", window: { ...ITEMS[0].window, zoneShort: "PDT", zone: "America/Los_Angeles", zoneLabel: "Pacific Time", zoneAcronym: "PT", closesAtLocal: "11:00 PM" } },
      ];
      state.topped = true;
      b.queue.items = [...added, ...ITEMS_SHUT.slice(2)];
      b.current = { ...currentFor("s6"), id: "t1", businessName: "Cascade Volt Works", callingContext: { country: "US", province: "OR", timeZone: "America/Los_Angeles", attemptsLast24h: 0 } };
      b.current = { ...currentFor("s6"), id: "t1", businessName: "Cascade Volt Works", callingContext: { country: "US", province: "OR", timeZone: "America/Los_Angeles", attemptsLast24h: 0 } };
      b.queue.windows.groups = [{ key: "now", kind: "now", count: 3, ids: ["t1", "t2", "t3"] }, ...GROUPS_SHUT.slice(1)];
      b.batch.result = { claimed: 3, claimedIds: ["t1", "t2", "t3"], researched: 3, unresearched: 0, skippedForWindow: 40, skippedForLanguage: 0, openNow: 3, nextOpensAt: new Date().toISOString(), nextOpensAtLocal: "8:00 AM", nextOpensAtZone: "ET", reason: "partial_open", reasonKey: "app.salesQueue.batchReason.partialOpen", auto: true, releasedClosed: 2 };
      return b;
    }
    if (body.action === "claim_batch") b.batch.result = { claimed: 11, researched: 8, unresearched: 3, skippedForWindow: 1, skippedForLanguage: 0, reasonKey: null };
    if (body.action === "release_rest") b.batch.result = { released: 6, kept: 5 };
    return b;
  }
  if (p === "/api/sales/calls" && method === "GET") {
    return {
      rep: { id: ME.id, name: ME.name },
      store: { ready: true, missing: [] },
      dialMode: { mode: "progressive" },
      dial: { ready: true, blockedBy: null },
      dispositions: dispositionOptions(),
      states: STATE_ORDER.map((code) => ({ code, ...REP_STATES[code] })),
      pauseReasons: PAUSE_REASON_ORDER.map((code) => PAUSE_REASONS[code]),
      statusChoices: STATUS_CHOICES,
      autodial: state.autodial,
      presence: state.presence,
      pendingAttempt: state.pending,
      today: null,
      serverNow: new Date().toISOString(),
    };
  }
  if (p === "/api/sales/calls" && method === "POST") {
    if (body.action === "dial") {
      state.attempts += 1;
      // A typed number the record does not carry rings unsaved, and the
      // server flags askToSave so the outcome form asks whether to keep it
      // (2026-09-18). typedE164 arrives only for such a dial.
      const to = body.typedE164 || "+14055550100";
      return { attemptId: "att" + state.attempts, to, callerId: "+14055550999", serverNow: new Date().toISOString(), typedNotSaved: Boolean(body.typedE164), askToSave: Boolean(body.typedE164) };
    }
    if (body.action === "disposition") { state.pending = null; return { ok: true }; }
    if (body.action === "autodial") { state.autodial = Boolean(body.on); return { autodial: state.autodial }; }
    return { ok: true };
  }
  if (p === "/api/sales/calls/token") return { token: "tok", expiresInSeconds: 600 };
  if (p === "/api/sales/calls/history") return historyBody(u.searchParams.get("prospectId") || (u.searchParams.get("leadId") === "lead1" ? "p1" : null));
  if (p === "/api/sales/calls/callbacks") return callbacksBody();
  if (p === "/api/sales/calls/unlogged") return { store: { ready: true, missing: [] }, count: 0, items: [], serverNow: new Date().toISOString() };
  // FieldQuo's own test phones: any number ending 5550006 (Twilio's test
  // number) is one; the rep is a test account only with ?testAccount=1.
  if (p === "/api/sales/calls/test-line") {
    const e164 = u.searchParams.get("e164") || "";
    return { e164, testLine: /5550006$/.test(e164), testAccount: new URLSearchParams(window.location.search).get("testAccount") === "1" };
  }
  if (p === "/api/sales/calls/state") {
    if (method === "POST" && body?.state) state.presence = { ...state.presence, state: body.state, pauseReason: body.pauseReason || null, forMs: 0 };
    return { presence: state.presence, store: { ready: true }, choices: STATUS_CHOICES, autodial: state.autodial };
  }
  if (p === "/api/sales/calls/answered") return { attemptId: "in1", transferable: true };
  if (p === "/api/sales/calls/caller") return { outcome: "prospect", businessName: "Bright Current Electrical", city: "Tulsa", province: "OK", holder: { repId: "r1", name: "Daniel Roy", mine: true }, open: { kind: "console", href: "/sales/queue?prospectId=p1" }, notes: { href: "/sales/queue?prospectId=p1&tab=notes" }, save: null, text: { leadId: null, prospectId: "p1" } };
  // "Text them" (2026-09-18): the opener answers the thread's number; the
  // harness has no Texts screen to land on, so the press ends at the push.
  if (p === "/api/sales/messages/start" && method === "POST") return { ok: true, with: options?.body ? JSON.parse(options.body).phone : "", leadId: "lead1", created: false, recorded: true, unsaved: null };
  if (p.startsWith("/api/sales/calls/transfer")) return { available: false, reason: "No other rep is reachable right now.", targets: [], transfer: null };
  if (p === "/api/sales/calls/numbers") {
    if (String(body?.e164 || "").replace(/\D/g, "").endsWith("0666")) { const e = new Error("This business asked not to be contacted, so no further numbers are recorded for them."); throw e; }
    state.extraNumbers = state.extraNumbers || [];
    const e164 = "+" + String(body.e164).replace(/\D/g, "").replace(/^(?!1)/, "1");
    if (!state.extraNumbers.some((n) => n.e164 === e164)) state.extraNumbers.push({ id: "n-typed-" + state.extraNumbers.length, e164, kind: body.kind, label: body.label, preferred: false });
    return { ok: true, updated: false, numbers: [{ id: "n1", e164: "+14055550100" }, { id: "n2", e164: "+14055550177" }, ...state.extraNumbers] };
  }
  // ?language=fr|es answers with that language's script, after the pause a
  // real on-demand generation takes, so the switch's loading state is real.
  if (p === "/api/sales/playbook") {
    const language = u.searchParams.get("language");
    if (language && language !== "en") { await delay(400); return woven(playbookIn(language), language); }
    return woven(PLAYBOOK, "en");
  }
  if (p === "/api/sales/notes" && method === "POST") { state.notes.unshift({ id: "n" + Date.now(), title: body.body.slice(0, 40), body: body.body, updatedAt: new Date().toISOString() }); return { ok: true }; }
  if (p === "/api/sales/leads" && method === "POST") return { lead: { id: "lead1" } };
  // The Dialer pane's "Text the signup link" (SignupLinkSms): the readiness
  // read, and the send. The body is the shape lib/sales/salesSmsRules.js's
  // signupLinkSmsBody() produces — the rep's own /signup?sales= link.
  if (p === "/api/sales/sms" && method === "GET") {
    return {
      lead: { id: "lead1", phone: "+14055550100", timeZone: "America/Chicago" },
      contact: { choices: [{ id: "n1", e164: "+14055550100", label: "Listing" }], refused: [] },
      messages: state.smsSent ? [{ id: "m1", toE164: "+14055550100", sentAt: new Date().toISOString() }] : [],
      timeZones: [{ value: "America/Chicago", label: "Central Time (Chicago)" }, { value: "America/New_York", label: "Eastern Time (New York)" }],
      sms: {
        canSend: true, blockers: [], warnings: [], to: "+14055550100", from: "+17165550616", timeZone: "America/Chicago", timeZoneSource: "derived",
        body: "Hi Dave, this is Daniel — here is the link to sign up that we talked about: https://www.fieldquo.com/signup?sales=danielroy You can reply to this text if you have any questions.",
      },
    };
  }
  if (p === "/api/sales/sms" && method === "POST") { state.smsSent = true; return { ok: true, messageId: "m1", to: "+14055550100", sentAt: new Date().toISOString() }; }
  if (p.startsWith("/api/sales/leads/")) return { lead: { id: "lead1", status: "new" } };
  if (p === "/api/sales/events") return { events: [] };
  if (p === "/api/sales/tour") return { step: 0, dismissed: true, completed: false };
  if (p === "/api/sales/badges") return BADGES;
  if (p === "/api/sales/me") return { ...ME, testAccount: new URLSearchParams(window.location.search).get("testAccount") === "1" };
  throw new Error("Harness has no answer for " + method + " " + url);
}

// The page and the shell call window.fetch directly for three reads.
const realFetch = window.fetch.bind(window);
window.fetch = async (url, options = {}) => {
  const u = new URL(String(url), "http://harness.local");
  if (u.pathname === "/api/sales/notes") return new Response(JSON.stringify({ notes: state.notes }), { status: 200, headers: { "Content-Type": "application/json" } });
  if (u.pathname === "/api/sales/me") return new Response(JSON.stringify(await fetchJson(u.pathname, options)), { status: 200, headers: { "Content-Type": "application/json" } });
  if (u.pathname === "/api/sales/badges") return new Response(JSON.stringify(BADGES), { status: 200, headers: { "Content-Type": "application/json" } });
  if (u.pathname === "/api/sales/calls") return new Response(JSON.stringify(await fetchJson(u.pathname + u.search, options)), { status: 200, headers: { "Content-Type": "application/json" } });
  if (u.pathname.startsWith("/api/")) return new Response(JSON.stringify(await fetchJson(u.pathname + u.search, options)), { status: 200, headers: { "Content-Type": "application/json" } });
  return realFetch(url, options);
};
