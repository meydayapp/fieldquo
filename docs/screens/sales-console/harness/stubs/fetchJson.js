// @/lib/fetchJson for the console harness. Answers from fixtures; keeps a
// little state so claiming, dialling and dispositions are visible.
import { ITEMS, GROUPS, ITEMS_SHUT, GROUPS_SHUT, TRADES, PLAYBOOK, NOTES, ME, BADGES, currentFor } from "../fixtures.js";
import { dispositionOptions } from "@/lib/sales/calls/dispositions";
import { STATUS_CHOICES, STATE_ORDER, REP_STATES, PAUSE_REASON_ORDER, PAUSE_REASONS } from "@/lib/sales/calls/agentState";

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
    rep: { id: ME.id, name: ME.name, email: ME.email },
    tradeKey: "electrical",
    trades: TRADES,
    queue: { items, empty, emptyReason: empty ? "nothing_claimed" : null, emptyText: empty ? "You have nothing claimed in Electrical. 62 are free to claim — press the button." : null, windows: { repZone: "America/New_York", language: "en", groups: empty ? [] : shut ? (state.topped ? [{ key: "now", kind: "now", count: 3, ids: ["t1", "t2", "t3"] }, ...GROUPS_SHUT.slice(1)] : GROUPS_SHUT) : GROUPS } },
    current: cur,
    claimHours: 48,
    batch: { max: 25, topUpBelow: 5, topUpIntervalMs: 60000, dailyCap: 250, takenToday: 11, remainingToday: 239, timeZone: "America/New_York", result: null },
    // A fixed clock, so the window the console recomputes is the fixture's
    // and not the machine's: 2:00 pm Central for the day scenario, 9:20 pm
    // Eastern for the shut one.
    serverNow: shut ? "2026-09-12T01:20:00.000Z" : "2026-09-11T19:00:00.000Z",
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
    if (body.action === "dial") { state.attempts += 1; return { attemptId: "att" + state.attempts, to: "+14055550100", callerId: "+14055550999", serverNow: new Date().toISOString() }; }
    if (body.action === "disposition") { state.pending = null; return { ok: true }; }
    if (body.action === "autodial") { state.autodial = Boolean(body.on); return { autodial: state.autodial }; }
    return { ok: true };
  }
  if (p === "/api/sales/calls/token") return { token: "tok", expiresInSeconds: 600 };
  if (p === "/api/sales/calls/state") {
    if (method === "POST" && body?.state) state.presence = { ...state.presence, state: body.state, pauseReason: body.pauseReason || null, forMs: 0 };
    return { presence: state.presence, store: { ready: true }, choices: STATUS_CHOICES, autodial: state.autodial };
  }
  if (p === "/api/sales/calls/answered") return { attemptId: "in1", transferable: true };
  if (p === "/api/sales/calls/caller") return { outcome: "prospect", businessName: "Bright Current Electrical", holder: { repId: "r1", name: "Daniel Roy", mine: true } };
  if (p.startsWith("/api/sales/calls/transfer")) return { available: false, reason: "No other rep is reachable right now.", targets: [], transfer: null };
  if (p === "/api/sales/calls/numbers") {
    if (String(body?.e164 || "").replace(/\D/g, "").endsWith("0666")) { const e = new Error("This business asked not to be contacted, so no further numbers are recorded for them."); throw e; }
    state.extraNumbers = state.extraNumbers || [];
    const e164 = "+" + String(body.e164).replace(/\D/g, "").replace(/^(?!1)/, "1");
    if (!state.extraNumbers.some((n) => n.e164 === e164)) state.extraNumbers.push({ id: "n-typed-" + state.extraNumbers.length, e164, kind: body.kind, label: body.label, preferred: false });
    return { ok: true, updated: false, numbers: [{ id: "n1", e164: "+14055550100" }, { id: "n2", e164: "+14055550177" }, ...state.extraNumbers] };
  }
  if (p === "/api/sales/playbook") return PLAYBOOK;
  if (p === "/api/sales/notes" && method === "POST") { state.notes.unshift({ id: "n" + Date.now(), title: body.body.slice(0, 40), body: body.body, updatedAt: new Date().toISOString() }); return { ok: true }; }
  if (p === "/api/sales/leads" && method === "POST") return { lead: { id: "lead1" } };
  if (p.startsWith("/api/sales/leads/")) return { lead: { id: "lead1", status: "new" } };
  if (p === "/api/sales/events") return { events: [] };
  if (p === "/api/sales/tour") return { step: 0, dismissed: true, completed: false };
  if (p === "/api/sales/badges") return BADGES;
  if (p === "/api/sales/me") return ME;
  throw new Error("Harness has no answer for " + method + " " + url);
}

// The page and the shell call window.fetch directly for three reads.
const realFetch = window.fetch.bind(window);
window.fetch = async (url, options = {}) => {
  const u = new URL(String(url), "http://harness.local");
  if (u.pathname === "/api/sales/notes") return new Response(JSON.stringify({ notes: state.notes }), { status: 200, headers: { "Content-Type": "application/json" } });
  if (u.pathname === "/api/sales/me") return new Response(JSON.stringify(ME), { status: 200, headers: { "Content-Type": "application/json" } });
  if (u.pathname === "/api/sales/badges") return new Response(JSON.stringify(BADGES), { status: 200, headers: { "Content-Type": "application/json" } });
  if (u.pathname === "/api/sales/calls") return new Response(JSON.stringify(await fetchJson(u.pathname + u.search, options)), { status: 200, headers: { "Content-Type": "application/json" } });
  if (u.pathname.startsWith("/api/")) return new Response(JSON.stringify(await fetchJson(u.pathname + u.search, options)), { status: 200, headers: { "Content-Type": "application/json" } });
  return realFetch(url, options);
};
