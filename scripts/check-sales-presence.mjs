// scripts/check-sales-presence.mjs
//
//   npm run check:sales-presence
//
// Presence is derived from the keepalive — Off · Available · Busy · Paused —
// and the floor board reads the performance page's calls table. Both landed
// on 2026-09-21, after the owner read one rep as "Off" while they dialled,
// one as "Writing it up · 76h 26m", and a floor card whose "Answered
// (carrier) 64.3%" and "Conversation (transcript) 8 of 9" disagreed with the
// performance page about the same calls.
//
// lib/sales/calls/agentState.js's header has the model (OMniLeads's, read in
// place). This file EXECUTES it: livePresence() against clock-driven
// fixtures shaped like today's production rows, store.js's heartbeat() and
// setRepState() against an in-memory client, nextDial() inside and after the
// write-up window, the ring plan against the derived rows, and the two
// boards against one set of attempts. The structural half — which route
// writes `offline`, which does not — is read with comments stripped.
//
// Judged by the exit code.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_AFTER_CALL_SECONDS,
  HEARTBEAT_SECONDS,
  PRESENCE_OFF_MINUTES,
  PRESENCE_OFF_MS,
  PRESENCE_STALE_MINUTES,
  STATE_AFTER_CALL,
  STATE_AVAILABLE,
  STATE_OFFLINE,
  STATE_ON_CALL,
  STATE_PAUSED,
  STATUS_CHOICES,
  TRANSITIONS,
  WORD_AVAILABLE,
  WORD_BUSY,
  WORD_OFF,
  WORD_PAUSED,
  activityTotals,
  canTransition,
  countdownText,
  livePresence,
  presenceHeadline,
  presenceWord,
  rowPeriodEnd,
} from "@/lib/sales/calls/agentState";
import { heartbeat, presenceFor, setRepState } from "@/lib/sales/calls/store";
import { AUTODIAL_REASONS, nextDial } from "@/lib/sales/autodial";
import { reachable, ringPlan, lastCallerVerdict, LAST_CALLER_RING, LAST_CALLER_SKIP } from "@/lib/sales/calls/inboundDistribution";
import { DEFAULT_FLOOR_SETTINGS, AFTER_CALL_SECONDS_MAX, FLOOR_SETTINGS_KEY, normaliseFloorSettings, validateFloorSettings } from "@/lib/sales/calls/floorSettings";
import { repOnShift } from "@/lib/sales/queueBatch";
import { otherTabsAlive, prunedRegistry, REGISTRY_TTL_MS } from "@/app/components/sales/presenceBeat";
import { dialTableRow } from "@/lib/sales/calls/dialTable";
import { repCallStats, teamCallRows } from "@/lib/sales/calls/reporting";
import { buildCallActivity } from "@/lib/sales/performanceReport";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

const NOW = new Date("2026-09-21T22:20:00Z");
const ago = (ms) => new Date(NOW.getTime() - ms);
const min = (n) => ago(n * 60000);
const sec = (n) => ago(n * 1000);
const iso = (d) => (d ? new Date(d).toISOString() : null);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The words, the window, the graph");
// ═══════════════════════════════════════════════════════════════════════════

ok("the Off window is the owner's two minutes, and the old name is the same number", PRESENCE_OFF_MINUTES === 2 && PRESENCE_STALE_MINUTES === 2 && PRESENCE_OFF_MS === 120000);
ok("the shell beats inside the window — a live browser misses at most one beat", HEARTBEAT_SECONDS * 1000 < PRESENCE_OFF_MS);
ok("the four words", [WORD_OFF, WORD_AVAILABLE, WORD_BUSY, WORD_PAUSED].join() === "off,available,busy,paused");
ok("on_call and after_call are both Busy, with the detail that says which", presenceWord(STATE_ON_CALL).word === WORD_BUSY && presenceWord(STATE_ON_CALL).detail === "on_call" && presenceWord(STATE_AFTER_CALL).word === WORD_BUSY && presenceWord(STATE_AFTER_CALL).detail === "writing_up");
ok("there is no Busy button: every picker choice is Available or a named pause, and none is Off", STATUS_CHOICES.every((c) => c.state === STATE_AVAILABLE || c.state === STATE_PAUSED) && !STATUS_CHOICES.some((c) => c.state === STATE_OFFLINE));
ok("paperwork is the admin pause on the picker", STATUS_CHOICES.some((c) => c.code === "admin" && c.pauseReason === "admin"));
ok("no state in the graph is `busy` — Busy is what a call makes you", !Object.keys(TRANSITIONS).includes("busy") && !Object.values(TRANSITIONS).flat().includes("busy"));
ok("a present rep with no row (offline on the ledger) may go straight to a pause", canTransition({ from: STATE_OFFLINE, to: STATE_PAUSED, pauseReason: "break" }).ok === true);
ok("the default write-up window is sixty seconds and an outcome is required", DEFAULT_AFTER_CALL_SECONDS === 60 && DEFAULT_FLOOR_SETTINGS.afterCallSeconds === 60 && DEFAULT_FLOOR_SETTINGS.requireWriteUp === true);
ok("countdownText: 0:41, 1:05, never negative", countdownText(41) === "0:41" && countdownText(65) === "1:05" && countdownText(-3) === null);

// ═══════════════════════════════════════════════════════════════════════════
section("2. livePresence — today's production rows, and every rule");
// ═══════════════════════════════════════════════════════════════════════════

const call = (over) => ({ dialledAt: min(3), answeredAt: min(3), endedAt: min(2), disposition: "no_answer", dialChannel: "browser", live: false, ...over });

// Umar: a picker-written `offline` row at 21:30:40, beaten by the gate until
// 22:05:27 (he kept working), last dial 21:29:33. At 22:20 he is Off — since
// the last beat, NOT since the button; at 22:06 he was Available.
const umarRow = { state: STATE_OFFLINE, startedAt: new Date("2026-09-21T21:30:40Z"), heartbeatAt: new Date("2026-09-21T22:05:27Z"), endedAt: null };
const umarCall = { dialledAt: new Date("2026-09-21T21:29:33Z"), endedAt: new Date("2026-09-21T21:30:29Z"), disposition: "no_answer", dialChannel: "browser", live: false };
{
  const p = livePresence(umarRow, NOW, { portalSeenAt: new Date("2026-09-21T22:04:47Z"), lastCall: umarCall });
  ok("Umar at 22:20: Off since 22:05:27 — the last beat, not the 21:30 button", p.state === STATE_OFFLINE && p.word === WORD_OFF && iso(p.offSince) === "2026-09-21T22:05:27.000Z", { state: p.state, off: iso(p.offSince) });
  const q = livePresence(umarRow, new Date("2026-09-21T22:06:00Z"), { portalSeenAt: new Date("2026-09-21T22:04:47Z"), lastCall: umarCall });
  ok("…and at 22:06, thirty-five minutes after that stray Off, he was Available: the row was contradicted by his own keepalive", q.state === STATE_AVAILABLE, q.state);
}
// Favor: after_call since Thursday 18:01, last beat Saturday 19:54:14.
const favorRow = { state: STATE_AFTER_CALL, startedAt: new Date("2026-09-18T18:01:59Z"), heartbeatAt: new Date("2026-09-19T19:54:14Z"), endedAt: null };
{
  const p = livePresence(favorRow, NOW, { portalSeenAt: new Date("2026-09-19T19:54:14Z"), lastCall: { dialledAt: new Date("2026-09-18T17:59:00Z"), endedAt: new Date("2026-09-18T18:01:50Z"), disposition: "reached", dialChannel: "browser", live: false } });
  ok("Favor: Off since Sat 19:54 — never \"Writing it up · 76h\" — with the row's word kept as history", p.state === STATE_OFFLINE && iso(p.offSince) === "2026-09-19T19:54:14.000Z" && p.lastState === STATE_AFTER_CALL, { state: p.state, off: iso(p.offSince), last: p.lastState });
  const h = presenceHeadline(p, { now: NOW });
  ok("…and her headline is \"Off since <weekday time>\", the sub-line the ledger's word", h.key === "app.salesPresence.offSince" && /^Off since /.test(h.english) && h.params.time.length > 5, h);
}
// Daniel: paused/training since Saturday, the row beaten seconds ago (present).
{
  const p = livePresence({ state: STATE_PAUSED, pauseReason: "training", startedAt: new Date("2026-09-20T18:04:30Z"), heartbeatAt: sec(49), endedAt: null }, NOW, { portalSeenAt: min(20), lastCall: null });
  ok("Daniel: present (the row's beat is a keepalive) and Paused · training", p.state === STATE_PAUSED && p.pauseReason === "training" && p.word === WORD_PAUSED, p);
  ok("…headline \"Paused · Training\"", presenceHeadline(p).english === "Paused · Training");
}
ok("present, no row at all: Available — no button needed", livePresence(null, NOW, { portalSeenAt: sec(30) }).state === STATE_AVAILABLE);
ok("…with no counter: Available has no start to count from", livePresence(null, NOW, { portalSeenAt: sec(30) }).forMs === null);
ok("never a keepalive, never a row: Never signed in", presenceHeadline(livePresence(null, NOW, {})).key === "app.salesPresence.never" && livePresence(null, NOW, {}).everSignedIn === false);
ok("keepalive two minutes and one second old, nothing else: Off since that beat", (() => { const p = livePresence(null, NOW, { portalSeenAt: sec(121) }); return p.state === STATE_OFFLINE && iso(p.offSince) === iso(sec(121)); })());
ok("keepalive 119 seconds old: Available", livePresence(null, NOW, { portalSeenAt: sec(119) }).state === STATE_AVAILABLE);
ok("a hand-set pause with an expired beat is Off — a pause does not survive an absence", livePresence({ state: STATE_PAUSED, pauseReason: "break", startedAt: min(30), heartbeatAt: min(10) }, NOW, { portalSeenAt: min(10) }).state === STATE_OFFLINE);

// Busy · on a call.
ok("a live browser leg is Busy · on a call whatever the row says", (() => { const p = livePresence(umarRow, NOW, { portalSeenAt: min(30), lastCall: call({ dialledAt: sec(40), endedAt: null, live: true }) }); return p.state === STATE_ON_CALL && p.word === WORD_BUSY && p.detail === "on_call"; })());
ok("a dial one minute ago with no end overrides a stale offline row (the owner's 2026-09-16 rule)", livePresence({ state: STATE_OFFLINE, startedAt: min(30), heartbeatAt: min(30) }, NOW, { portalSeenAt: min(30), lastCall: call({ dialledAt: min(1), endedAt: null, live: false }) }).state === STATE_ON_CALL);
ok("a handset dial's open on_call row is on a call until the outcome closes it", livePresence({ state: STATE_ON_CALL, startedAt: min(4), heartbeatAt: sec(10) }, NOW, { portalSeenAt: sec(10), lastCall: call({ dialledAt: min(4), endedAt: null, dialChannel: "handset", live: false }) }).state === STATE_ON_CALL);

// The write-up window.
{
  const ended = sec(30);
  const inWindow = livePresence({ state: STATE_AFTER_CALL, startedAt: ended, heartbeatAt: NOW }, NOW, { portalSeenAt: NOW, lastCall: call({ endedAt: ended, disposition: null }) });
  ok("thirty seconds after a call: Busy · writing it up, window ends at +60 s, outcome pending", inWindow.state === STATE_AFTER_CALL && inWindow.detail === "writing_up" && iso(inWindow.writeUpEndsAt) === iso(new Date(ended.getTime() + 60000)) && inWindow.writeUpPending === true, inWindow);
  const h = presenceHeadline(inWindow, { now: NOW });
  ok("…headline Busy · writing it up with a 30-second countdown", h.english === "Busy · writing it up" && h.countdownSeconds === 30 && countdownText(h.countdownSeconds) === "0:30", h);
  const fromCarrier = livePresence(null, NOW, { portalSeenAt: NOW, lastCall: call({ endedAt: sec(20), disposition: "reached" }) });
  ok("…the carrier's endedAt opens the window on its own when the browser's after_call post was lost", fromCarrier.state === STATE_AFTER_CALL && fromCarrier.writeUpPending === false);
  const expiredSaved = livePresence({ state: STATE_AFTER_CALL, startedAt: sec(90), heartbeatAt: NOW }, NOW, { portalSeenAt: NOW, lastCall: call({ endedAt: sec(90), disposition: "reached" }) });
  ok("ninety seconds after a call with the outcome saved: Available on its own (auto-unpause)", expiredSaved.state === STATE_AVAILABLE);
  const expiredPending = livePresence({ state: STATE_AFTER_CALL, startedAt: sec(90), heartbeatAt: NOW }, NOW, { portalSeenAt: NOW, lastCall: call({ endedAt: sec(90), disposition: null }) });
  ok("…with NO outcome and requireWriteUp on: held in the window, no end on it (the forced disposition)", expiredPending.state === STATE_AFTER_CALL && expiredPending.writeUpEndsAt === null && expiredPending.writeUpPending === true);
  ok("…the held window's headline says \"outcome needed\"", presenceHeadline(expiredPending, { now: NOW }).sub?.english === "outcome needed" && presenceHeadline(expiredPending, { now: NOW }).countdownSeconds === null);
  const notRequired = livePresence({ state: STATE_AFTER_CALL, startedAt: sec(90), heartbeatAt: NOW }, NOW, { portalSeenAt: NOW, lastCall: call({ endedAt: sec(90), disposition: null }), requireWriteUp: false });
  ok("…and with requireWriteUp off: Available", notRequired.state === STATE_AVAILABLE);
  const shorter = livePresence({ state: STATE_AFTER_CALL, startedAt: sec(30), heartbeatAt: NOW }, NOW, { portalSeenAt: NOW, lastCall: call({ endedAt: sec(30), disposition: "reached" }), afterCallSeconds: 20 });
  ok("the platform's setting is read: a 20-second window is over at 30 seconds", shorter.state === STATE_AVAILABLE);
  const zero = livePresence({ state: STATE_AFTER_CALL, startedAt: sec(1), heartbeatAt: NOW }, NOW, { portalSeenAt: NOW, lastCall: call({ endedAt: sec(1), disposition: "reached" }), afterCallSeconds: 0 });
  ok("…and zero is no window at all", zero.state === STATE_AVAILABLE);
  const pressedNext = livePresence({ state: STATE_AVAILABLE, startedAt: sec(10), heartbeatAt: NOW }, NOW, { portalSeenAt: NOW, lastCall: call({ endedAt: sec(30), disposition: "reached" }) });
  ok("Next — an available row newer than the call's end — ends the window early", pressedNext.state === STATE_AVAILABLE);
  const pausedInWindow = livePresence({ state: STATE_PAUSED, pauseReason: "break", startedAt: sec(10), heartbeatAt: NOW }, NOW, { portalSeenAt: NOW, lastCall: call({ endedAt: sec(30), disposition: "reached" }) });
  ok("…so does Paused by hand", pausedInWindow.state === STATE_PAUSED);
}

// Off, explicitly.
ok("sign-out (an open offline row, nothing later) is Off at once — before the keepalive ages", (() => { const p = livePresence({ state: STATE_OFFLINE, startedAt: sec(10), heartbeatAt: sec(10) }, NOW, { portalSeenAt: sec(15) }); return p.state === STATE_OFFLINE && iso(p.offSince) === iso(sec(10)); })());
ok("…but a dial after the offline row wins over it", livePresence({ state: STATE_OFFLINE, startedAt: min(5), heartbeatAt: min(5) }, NOW, { portalSeenAt: min(5), lastCall: call({ dialledAt: min(1), endedAt: null }) }).state === STATE_ON_CALL);
ok("`stale` is always false now — there is no third tone", [livePresence(umarRow, NOW, {}), livePresence(null, NOW, { portalSeenAt: NOW }), livePresence(favorRow, NOW, {})].every((p) => p.stale === false));

// ═══════════════════════════════════════════════════════════════════════════
section("3. The ledger: an open row ends at its last beat plus the window");
// ═══════════════════════════════════════════════════════════════════════════

{
  const end = rowPeriodEnd(favorRow, NOW);
  ok("Favor's open after_call row ends at 19:56:14 on the 19th, not now", iso(end) === "2026-09-19T19:56:14.000Z", iso(end));
  const t = activityTotals([favorRow], { from: new Date("2026-09-21T00:00:00Z"), to: NOW });
  ok("…so today's ledger carries none of it: 0 minutes writing up, not 76 hours", t.afterCallMs === 0, t.afterCallMs);
  const beaten = activityTotals([{ state: STATE_AVAILABLE, startedAt: min(10), heartbeatAt: sec(20), endedAt: null }], { to: NOW });
  ok("a row beaten twenty seconds ago is measured to now", beaten.availableMs === 10 * 60000);
  ok("a closed row keeps its endedAt", iso(rowPeriodEnd({ startedAt: min(10), heartbeatAt: min(9), endedAt: min(5) }, NOW)) === iso(min(5)));
  ok("repOnShift reads the keepalive: a rep with an open tab and no ledger row is at the desk", repOnShift({ activity: null, lastDialAt: null, portalSeenAt: sec(30), now: NOW }) === true && repOnShift({ activity: null, lastDialAt: null, portalSeenAt: min(5), now: NOW }) === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. store.js — the beat closes what the rep walked away from; sign-out and leaving write Off; nothing else does");
// ═══════════════════════════════════════════════════════════════════════════

/** An in-memory client with the four tables presence touches. */
function memoryClient({ activity = [], reps = [], attempts = [], settings = null } = {}) {
  let seq = 0;
  const state = { activity: activity.map((r) => ({ id: r.id || `a${(seq += 1)}`, pauseReason: null, callAttemptId: null, heartbeatAt: null, endedAt: null, ...r })), reps, attempts, settings };
  const matches = (row, where) => {
    if (where.id !== undefined) {
      if (typeof where.id === "object" && Array.isArray(where.id.in)) { if (!where.id.in.includes(row.id)) return false; }
      else if (row.id !== where.id) return false;
    }
    if (where.salesRepId !== undefined) {
      if (typeof where.salesRepId === "object") { if (!where.salesRepId.in.includes(row.salesRepId)) return false; }
      else if (row.salesRepId !== where.salesRepId) return false;
    }
    if (where.endedAt === null && row.endedAt !== null) return false;
    return true;
  };
  const delegate = {
    findFirst: async ({ where }) => state.activity.filter((r) => matches(r, where)).sort((a, b) => b.startedAt - a.startedAt)[0] || null,
    findMany: async ({ where }) => state.activity.filter((r) => matches(r, where)).sort((a, b) => b.startedAt - a.startedAt),
    updateMany: async ({ where, data }) => { let n = 0; for (const r of state.activity) if (matches(r, where)) { Object.assign(r, data); n += 1; } return { count: n }; },
    create: async ({ data }) => { const row = { id: `a${(seq += 1)}`, pauseReason: null, callAttemptId: null, heartbeatAt: null, endedAt: null, ...data }; state.activity.push(row); return row; },
  };
  const client = {
    salesRepActivity: delegate,
    salesCallAttempt: { findMany: async () => state.attempts },
    salesRep: { findMany: async ({ where }) => state.reps.filter((r) => where.id.in.includes(r.id)) },
    platformSetting: { findUnique: async ({ where }) => (where.key === FLOOR_SETTINGS_KEY && state.settings ? { key: FLOOR_SETTINGS_KEY, value: state.settings } : null) },
    $transaction: async (fn) => fn(client),
    state,
  };
  return client;
}

{
  // Umar's shape: an open offline row the picker wrote, the rep still present.
  const c = memoryClient({ activity: [{ salesRepId: "u", state: STATE_OFFLINE, startedAt: min(50), heartbeatAt: min(15) }], reps: [{ id: "u", lastSeenAt: sec(5) }] });
  const r = await heartbeat("u", { now: NOW, client: c });
  ok("the beat CLOSES an open offline row (the rep is back) — closed at now", r.closed === 1 && iso(c.state.activity[0].endedAt) === iso(NOW), r);
  const rows = await presenceFor(["u"], { now: NOW, client: c });
  ok("…and the derivation then says Available", rows[0].presence.state === STATE_AVAILABLE, rows[0].presence.state);
}
{
  // A pause the rep walked away from: closed at its last beat + the window.
  const c = memoryClient({ activity: [{ salesRepId: "d", state: STATE_PAUSED, pauseReason: "training", startedAt: min(300), heartbeatAt: min(30) }], reps: [{ id: "d", lastSeenAt: sec(5) }] });
  const r = await heartbeat("d", { now: NOW, client: c });
  ok("the beat closes a row whose beat expired — at that beat plus two minutes, the moment the board stopped believing it", r.closed === 1 && iso(c.state.activity[0].endedAt) === iso(min(28)), { r, ended: iso(c.state.activity[0].endedAt) });
  ok("…a fresh login after an absence is Available, the pause did not survive (OMniLeads _close_open_session)", (await presenceFor(["d"], { now: NOW, client: c }))[0].presence.state === STATE_AVAILABLE);
}
{
  const c = memoryClient({ activity: [{ salesRepId: "a", state: STATE_PAUSED, pauseReason: "break", startedAt: min(3), heartbeatAt: sec(50) }], reps: [{ id: "a", lastSeenAt: sec(5) }] });
  const r = await heartbeat("a", { now: NOW, client: c });
  ok("a live row is beaten, not closed — the heartbeat keeps a pause (and an available) alive", r.closed === 0 && r.updated === 1 && iso(c.state.activity[0].heartbeatAt) === iso(NOW) && c.state.activity[0].endedAt === null);
  ok("…and the pause holds while the tab is present", (await presenceFor(["a"], { now: NOW, client: c }))[0].presence.state === STATE_PAUSED);
  ok("the beat never OPENS a row", c.state.activity.length === 1);
}
{
  // Call end goes on_call → after_call → available, never offline.
  const c = memoryClient({ activity: [{ salesRepId: "u", state: STATE_OFFLINE, startedAt: min(50), heartbeatAt: min(15) }], reps: [{ id: "u", lastSeenAt: sec(5) }] });
  const dial = await setRepState({ salesRepId: "u", to: STATE_ON_CALL, callAttemptId: "att1", now: min(2), client: c });
  ok("a dial from an offline row flips to on_call", dial.ok === true && dial.from === STATE_OFFLINE && dial.activity.state === STATE_ON_CALL);
  const ended = await setRepState({ salesRepId: "u", to: STATE_AFTER_CALL, callAttemptId: "att1", now: min(1), client: c });
  ok("call end → after_call", ended.ok === true && ended.activity.state === STATE_AFTER_CALL);
  const next = await setRepState({ salesRepId: "u", to: STATE_AVAILABLE, now: NOW, client: c });
  ok("Next / the window's end → available", next.ok === true && next.activity.state === STATE_AVAILABLE);
  ok("…and no row in that sequence is offline after the dial", c.state.activity.filter((r) => r.startedAt >= min(2)).every((r) => r.state !== STATE_OFFLINE), c.state.activity.map((r) => r.state));
  const out = await setRepState({ salesRepId: "u", to: STATE_OFFLINE, now: NOW, client: c });
  ok("sign-out writes offline through setRepState — the one sanctioned path, from any state", out.ok === true && out.activity.state === STATE_OFFLINE);
  ok("…and the derivation reads that as Off at once", (await presenceFor(["u"], { now: NOW, client: c }))[0].presence.state === STATE_OFFLINE);
}
{
  const c = memoryClient({ activity: [], reps: [{ id: "s", lastSeenAt: sec(5) }], settings: { afterCallSeconds: 45, requireWriteUp: false } });
  const rows = await presenceFor(["s"], { now: NOW, client: c });
  ok("presenceFor reads the floor settings when none are handed in", rows.length === 1 && rows[0].presence.state === STATE_AVAILABLE);
  const c2 = memoryClient({ activity: [], reps: [{ id: "s", lastSeenAt: sec(5) }], attempts: [{ id: "x", salesRepId: "s", direction: "out", dialChannel: "browser", dialledAt: min(2), answeredAt: min(2), endedAt: sec(40), disposition: null, providerStatus: "completed", hungUpBy: null }], settings: { afterCallSeconds: 45, requireWriteUp: false } });
  const p2 = (await presenceFor(["s"], { now: NOW, client: c2 }))[0].presence;
  ok("…and applies them: a 45-second window, 40 seconds after the carrier's end, is Busy · writing it up ending at +45", p2.state === STATE_AFTER_CALL && iso(p2.writeUpEndsAt) === iso(sec(-5)), p2);
  const p3 = (await presenceFor(["s"], { now: NOW, client: c2, settings: { afterCallSeconds: 30, requireWriteUp: false } }))[0].presence;
  ok("…settings handed in win over the table (the board reads them once)", p3.state === STATE_AVAILABLE);
}

// ── Structural: who may write offline ───────────────────────────────────
{
  const calls = decomment(read("app/api/sales/calls/route.js"));
  ok("the state action refuses `offline` from a screen, in words", /body\.state === STATE_OFFLINE\)/.test(calls) && /Off is not set from here/.test(calls));
  ok("the disposition branch never writes offline, and only a handset outcome writes available", !/to: STATE_OFFLINE/.test(calls) && /dialChannel === "handset"\)\s*\{\s*await setRepState\(\{ salesRepId: rep\.id, to: STATE_AVAILABLE/.test(calls));
  ok("…the auto_log branch writes no state (the window ends on its own)", !/autoLogAttempt\([\s\S]{0,400}setRepState\(/.test(calls));
  const logout = decomment(read("app/api/sales/auth/logout/route.js"));
  ok("sign-out writes offline", /setRepState\(\{ salesRepId: claims\.salesRepId, to: STATE_OFFLINE/.test(logout));
  const presence = decomment(read("app/api/sales/presence/route.js"));
  ok("the presence route stamps the keepalive through the gate's fence, beats, and writes offline only on `leaving: true`", /stampLastSeen\(rep\.id, now\)/.test(presence) && /heartbeat\(rep\.id, \{ now \}\)/.test(presence) && /if \(leaving\)[\s\S]{0,300}to: STATE_OFFLINE/.test(presence) && (presence.match(/STATE_OFFLINE/g) || []).length === 2);
  ok("the gate exports stampLastSeen and still writes that one column only", /export async function stampLastSeen/.test(read("lib/sales/gate.js")) && /GATE_WRITES_ON_SALES_REP = \["lastSeenAt"\]/.test(read("lib/sales/gate.js")));
  const components = ["app/components/sales/RepStatus.js", "app/components/sales/CallSession.js", "app/components/sales/IncomingCallDock.js", "app/components/sales/CallPanel.js", "app/components/sales/AutodialControl.js", "app/sales/SalesShell.js"].map((p) => decomment(read(p)));
  ok("no component posts `offline` — not on hangup, not on unmount, not on route change", components.every((src) => !/state:\s*STATE_OFFLINE/.test(src) && !/state:\s*"offline"/.test(src)));
  const rs = decomment(read("app/components/sales/RepStatus.js"));
  ok("the provider beats POST /api/sales/presence on the interval, on visibilitychange, and says goodbye from the last tab on pagehide", /setInterval\(beat, HEARTBEAT_SECONDS \* 1000\)/.test(rs) && /visibilitychange/.test(rs) && /pagehide/.test(rs) && /if \(!othersAlive && !sessionLostRef\.current\) sendBeat\(\{ leaving: true \}\)/.test(rs));
  ok("…and its unmount clears timers and listeners only — never a leave", /return \(\) => \{\s*stopped = true;\s*clearInterval\(id\);[\s\S]{0,400}removeEventListener\("pagehide", onHide\);\s*\};/.test(rs) && !/return \(\) => \{[\s\S]{0,500}leaving: true/.test(rs));
  ok("…the window's end re-reads presence and counts one automatic press for the dialler", /writeUpEndsAt - Date\.now\(\)/.test(rs) && /if \(body\?\.presence\?\.state === STATE_AVAILABLE\) setAvailablePresses/.test(rs));
  ok("…and Next is the available transition through postState", /const next = useCallback\(async \(\) => \{\s*const result = await postState\(\{ state: STATE_AVAILABLE \}\);/.test(rs));
  ok("the state read derives through presenceFor with the settings, not livePresence(open, …, { portalSeenAt: now })", /presenceFor\(\[rep\.id\], \{ now, settings \}\)/.test(decomment(read("app/api/sales/calls/state/route.js"))) && !/livePresence\(/.test(decomment(read("app/api/sales/calls/state/route.js"))));
  ok("…and so does the console's GET", /presenceFor\(\[rep\.id\], \{ now \}\)/.test(calls) && !/livePresence\(/.test(calls));
}

// ── The tab registry ─────────────────────────────────────────────────────
{
  const t = NOW.getTime();
  ok("another fresh tab means not the last one", otherTabsAlive({ me: t, other: t - 10000 }, "me", t) === true);
  ok("only my own entry, or only dead ones: the last tab", otherTabsAlive({ me: t }, "me", t) === false && otherTabsAlive({ me: t, crashed: t - REGISTRY_TTL_MS - 1 }, "me", t) === false);
  ok("unreadable storage answers \"others may be alive\" — never a stray Off", otherTabsAlive(null, "me", t) === true);
  ok("pruning drops junk and dead entries", JSON.stringify(prunedRegistry({ a: t, b: "x", c: t - REGISTRY_TTL_MS - 1 }, t)) === JSON.stringify({ a: t }));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The dialler and the ring plan honour the window");
// ═══════════════════════════════════════════════════════════════════════════

{
  const base = { order: [{ id: "p1", dialled: false }], cursor: null, readiness: { decision: "allowed" }, switchOn: true, callUp: false, inboundRinging: false, browserReady: true, now: NOW.getTime() };
  const d = nextDial({ ...base, state: STATE_AFTER_CALL, writeUpEndsAt: NOW.getTime() + 41000 });
  ok("inside the window nothing dials: the stop is named and carries the end", d.stop === true && d.reason === AUTODIAL_REASONS.write_up_window && d.endsAt === NOW.getTime() + 41000);
  ok("held for a missing outcome: the same stop, no end", nextDial({ ...base, state: STATE_AFTER_CALL, writeUpEndsAt: null }).endsAt === null);
  ok("at expiry the presence is available and the dialler dials", nextDial({ ...base, state: STATE_AVAILABLE }).dial === "p1");
  const inWindow = livePresence({ state: STATE_AFTER_CALL, startedAt: sec(30), heartbeatAt: NOW }, NOW, { portalSeenAt: NOW, lastCall: call({ endedAt: sec(30), disposition: "reached" }) });
  ok("the ring plan does not ring a rep in the window (the sweep wants Available)", reachable(inWindow, NOW) === false && ringPlan({ presence: [{ salesRepId: "w", presence: inWindow }], now: NOW }).targets.length === 0);
  ok("…except the contractor they were just speaking to, who rings back into the write-up — the owner's 2026-09-17 rule, and OMniLeads keeps the contact attached in ACW", lastCallerVerdict(inWindow, { lastCalledAt: min(3), now: NOW }) === LAST_CALLER_RING);
  const off = livePresence(null, NOW, { portalSeenAt: min(5) });
  ok("an Off rep is never rung, whatever the row said", reachable(off, NOW) === false && lastCallerVerdict(off, { lastCalledAt: min(40), now: NOW }) === LAST_CALLER_SKIP);
  const avail = livePresence(null, NOW, { portalSeenAt: sec(20) });
  ok("a present rep with no row is Available and IS rung", reachable(avail, NOW) === true);
  const paused = livePresence({ state: STATE_PAUSED, pauseReason: "admin", startedAt: min(3), heartbeatAt: NOW }, NOW, { portalSeenAt: NOW });
  ok("a rep on the admin pause (paperwork) is left alone", reachable(paused, NOW) === false);
  const ac = decomment(read("app/components/sales/AutodialControl.js"));
  ok("the control hands nextDial the window's end and words the stop", (ac.match(/writeUpEndsAt: l\.writeUpEndsAt/g) || []).length === 2 && /writeUpEndsAt,\s*switchOn,/.test(ac) && /app\.salesAutodial\.stop\.writeUpWindow/.test(ac) && /app\.salesAutodial\.stop\.writeUpOutcome/.test(ac));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The floor settings");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("garbage normalises to the defaults, field by field", JSON.stringify(normaliseFloorSettings({ afterCallSeconds: "x", requireWriteUp: "yes" })) === JSON.stringify(DEFAULT_FLOOR_SETTINGS) && normaliseFloorSettings(null).afterCallSeconds === 60);
  ok("a stored 90 / false comes back as 90 / false, with the default limits beside them", (() => { const n = normaliseFloorSettings({ afterCallSeconds: 90, requireWriteUp: false }); return n.afterCallSeconds === 90 && n.requireWriteUp === false && n.pauseLimits.break === 15; })());
  ok("the console refuses rather than clamps: 601, -1, 12.5, a string", [601, -1, 12.5, "60"].every((v) => validateFloorSettings({ afterCallSeconds: v, requireWriteUp: true }).ok === false) && validateFloorSettings({ afterCallSeconds: 0, requireWriteUp: false }).ok === true && AFTER_CALL_SECONDS_MAX === 600);
  const route = decomment(read("app/api/platform/sales/floor-settings/route.js"));
  ok("the route is superadmin on PUT, validated, audit-logged", /superadminOrRefusal\(request\)/.test(route) && /validateFloorSettings\(body\)/.test(route) && /sales_floor_settings_updated/.test(route));
  const board = decomment(read("lib/sales/calls/floorBoard.js"));
  ok("the board reads the settings once and hands them to presenceFor, and returns them", /loadFloorSettings\(\{ client \}\)/.test(board) && /presenceFor\(ids, \{ now, client, settings \}\)/.test(board) && /settings: \{ \.\.\.settings, offAfterMinutes: PRESENCE_OFF_MINUTES \}/.test(board));
  const page = decomment(read("app/platform/sales/floor/page.js"));
  ok("/platform/sales/floor has the settings card, PUTting to the route", /data-floor-settings/.test(page) && /\/api\/platform\/sales\/floor-settings/.test(page) && /data-floor-after-call-seconds/.test(page) && /data-floor-require-write-up/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The two boards print the four words, sort Off last, and say \"No calls today\"");
// ═══════════════════════════════════════════════════════════════════════════

{
  for (const p of ["app/platform/sales/floor/page.js", "app/sales/agency/page.js"]) {
    const src = decomment(read(p));
    ok(`${p} draws the headline through presenceHeadline and the counts through DialBuckets`, /presenceHeadline\(p, \{ labels: \{ pauseReasons: pauseLabels \} \}\)/.test(src) && /<DialBuckets table=\{s\.table\}/.test(src));
    ok(`…sorts live reps first and Off last`, /function sortedReps/.test(src) && /offA - offB/.test(src));
    ok(`…prints one line for a day with no dials`, /data-no-calls/.test(src) && /noCalls \? "hidden"/.test(src));
    ok(`…prints the day's window`, /data-floor-window/.test(src) && /dayWindowParts\(from\)/.test(src));
    ok(`…and never the old stale sentence or "Signed in — not on the floor"`, !/has not said anything since/.test(src) && !/Signed in — not on the floor/.test(src) && !/signedInNotOnFloor/.test(src));
  }
  const platform = decomment(read("app/platform/sales/floor/page.js"));
  ok("the platform card prints \"last state: …\" under an Off headline", /last state: \{/.test(platform) && /head\.word === WORD_OFF && p\?\.lastState/.test(platform));
  ok("…and the four bucket names are the performance page's", ['nobodyAnswered: "Nobody answered"', 'hungUpFast: "Hung up fast"', 'voicemailOrBrief: "Voicemail or brief"', 'realConversation: "Real conversation"'].every((w) => platform.includes(w) && read("app/platform/sales/performance/page.js").includes(w)));
  const reps = decomment(read("app/platform/sales/reps/page.js"));
  ok("/platform/sales/reps prints the same headline", /p\.headline/.test(reps) && !/stale\. This is the disconnected/.test(reps));
  const langs = Object.keys(APP_MESSAGES);
  const keys = ["app.salesStatus.admin", "app.salesPresence.never", "app.salesPresence.offSince", "app.salesPresence.available", "app.salesPresence.busyOnCall", "app.salesPresence.busyWritingUp", "app.salesPresence.outcomeNeeded", "app.salesPresence.paused", "app.salesPresence.next", "app.salesPresence.windowRule", "app.salesAutodial.stop.writeUpWindow", "app.salesAutodial.stop.writeUpOutcome", "app.salesAgency.floorDay", "app.salesAgency.windowToday", "app.salesAgency.windowYesterday", "app.salesAgency.lastState", "app.salesAgency.callsToday", "app.salesAgency.fromLines", "app.salesAgency.byHandset", "app.salesAgency.noCallsToday", "app.salesAgency.dialsWithLeg", "app.salesAgency.ofDials", "app.salesAgency.realConversationTranscript", "app.salesAgency.transcribed", "app.salesAgency.meanTalk", "app.salesAgency.meanTalkNote", "app.salesAgency.overConversations", "app.salesAgency.noConversationYet", "app.salesAgency.timeOnCallsNote"];
  ok(`nine languages carry every new key (${keys.length} keys)`, langs.length === 9 && keys.every((k) => langs.every((l) => typeof APP_MESSAGES[l][k] === "string" && APP_MESSAGES[l][k].length > 0)), keys.filter((k) => !langs.every((l) => APP_MESSAGES[l][k])));
  ok("…with the placeholders intact", langs.every((l) => /\{time\}/.test(APP_MESSAGES[l]["app.salesPresence.offSince"]) && /\{reason\}/.test(APP_MESSAGES[l]["app.salesPresence.paused"]) && /\{seconds\}/.test(APP_MESSAGES[l]["app.salesAutodial.stop.writeUpWindow"]) && /\{count\}/.test(APP_MESSAGES[l]["app.salesAgency.fromLines"]) && /\{lines\}/.test(APP_MESSAGES[l]["app.salesAgency.fromLines"])));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. One table: the floor and the performance page agree, by attempt, never by line");
// ═══════════════════════════════════════════════════════════════════════════

{
  // Umar's day, in shape: his attempts went out from Rachel's 438 line and
  // Jesus's 716 line (chooseCallerId picks the line nearest the prospect).
  // Attribution is the salesRepId on the attempt; the lines are reported
  // under him, and nothing is counted under the lines' owners.
  const T = new Date("2026-09-21T21:20:00Z");
  const say = (n) => [{ speaker: "contractor", text: Array.from({ length: n }, () => "word").join(" ") }];
  let n = 0;
  const att = (rep, talk, over = {}) => ({ id: `at${(n += 1)}`, salesRepId: rep, direction: "out", dialChannel: "browser", providerCallSid: `CA${n}`, providerStatus: "completed", talkSeconds: talk, answeredAt: T, dialledAt: T, toE164: `+1716555${String(1000 + n)}`, ...over });
  const attempts = [
    att("umar", 0, { providerStatus: "no-answer", answeredAt: null, fromE164: "+17165550002", callerIdRule: "pool_local", disposition: "no_answer" }),
    att("umar", 0, { providerStatus: "no-answer", answeredAt: null, fromE164: "+17165550002", callerIdRule: "pool_local", disposition: "no_answer" }),
    att("umar", 12, { fromE164: "+17165550002", callerIdRule: "pool_local", disposition: "no_answer" }),
    att("umar", 40, { fromE164: "+14385550001", callerIdRule: "pool_local", disposition: "voicemail" }),
    att("umar", 45, { fromE164: "+14385550001", callerIdRule: "pool_local", disposition: "reached", transcript: say(30), recordingSid: "RE1" }),
    att("umar", 200, { fromE164: "+14385550001", callerIdRule: "pool_local", disposition: "reached", transcript: say(2), recordingSid: "RE2" }),
    att("umar", 120, { fromE164: "+17165550002", callerIdRule: "pool_local", disposition: "reached_interested" }),
    att("umar", 30, { fromE164: null, dialChannel: "handset", providerCallSid: null, providerStatus: null, disposition: "reached" }),
    att("rachel", 90, { fromE164: "+14385550001", callerIdRule: "assigned", disposition: "reached" }),
    { id: "in1", salesRepId: "umar", direction: "in", dialChannel: "browser", providerCallSid: "CAin", providerStatus: "completed", talkSeconds: 300, answeredAt: T, dialledAt: T, disposition: "reached", toE164: "+17165551234" },
  ];
  const reps = [{ id: "umar", name: "Umar", active: true }, { id: "rachel", name: "Rachel", active: true }];
  const from = new Date("2026-09-21T00:00:00Z");
  const floorRows = teamCallRows({ reps, attempts, activity: [], presence: [], from, to: T, now: T });
  const perf = buildCallActivity({ reps, attempts, from, to: T, now: T });
  const umarFloor = floorRows.find((r) => r.id === "umar").stats.table;
  const umarPerf = perf.reps.find((r) => r.id === "umar").table;
  const umarPerfRow = perf.reps.find((r) => r.id === "umar");
  ok("the performance row's `table` IS its stats.table (one composition, in repCallStats), and the floor's table for Umar carries the same buckets", umarPerfRow.table === umarPerfRow.stats.table && JSON.stringify(umarFloor.buckets) === JSON.stringify(umarPerf.buckets) && JSON.stringify(umarFloor.lines) === JSON.stringify(umarPerf.lines) && umarFloor.meanConversationSeconds === umarPerf.meanConversationSeconds);
  ok("attribution by attempt: 8 calls placed, 7 with a carrier leg, none of them under Rachel though 4 went out from her line", umarFloor.dials === 7 && floorRows.find((r) => r.id === "umar").stats.dials === 8 && perf.reps.find((r) => r.id === "rachel").table.dials === 1, { umar: umarFloor.dials, rachel: perf.reps.find((r) => r.id === "rachel").table.dials });
  ok("the four buckets: nobody 2 · hung up fast 1 · voicemail or brief 2 · real 2", JSON.stringify(umarFloor.buckets) === '{"nobodyAnswered":2,"hungUpFast":1,"voicemailOrBrief":2,"realConversation":2}', umarFloor.buckets);
  ok("the lines his calls went OUT from: 716 (4) and 438 (3), plus one handset dial with no line", umarFloor.lines.count === 2 && umarFloor.lines.rows[0].e164 === "+17165550002" && umarFloor.lines.rows[0].calls === 4 && umarFloor.lines.rows[1].calls === 3 && umarFloor.lines.noLine === 1, umarFloor.lines);
  ok("\"Real conversation (transcript)\": 1 by the transcript's own verdict, 2 transcribed — never \"2 of 2\" as a rate", umarFloor.realConversationFromTranscript === 1 && umarFloor.conversationFromTranscript === 2);
  ok("mean talk time over the 2 real conversations only: (45 + 120) / 2 = 83 s — not over the 5 answered", umarFloor.meanConversationSeconds === 83 && umarFloor.conversationTalkSeconds === 165 && umarFloor.answeredCalls === 5, { mean: umarFloor.meanConversationSeconds, answered: umarFloor.answeredCalls });
  ok("no conversation, no mean — null, not zero", dialTableRow([attempts[0]], { now: T }).meanConversationSeconds === null);
  ok("the handset dial is unverified, in no bucket and in no line", umarFloor.unverified.handset === 1);
  ok("the inbound call is in neither table", umarFloor.dials === 7 && !umarFloor.lines.rows.some((l) => l.calls > 4));
  ok("the floor total over everyone is the performance page's total", JSON.stringify(dialTableRow(attempts, { now: T }).buckets) === JSON.stringify(perf.totalTable.buckets));
  ok("repCallStats itself carries the table over PLACED calls", repCallStats({ attempts, from, to: T, now: T }).table.dials === 8);
  const board = decomment(read("lib/sales/calls/floorBoard.js"));
  ok("the board's floor-wide table is dialTableRow over the day's attempts, and `connect` is gone from it", /const table = dialTableRow\(attempts, \{ now \}\)/.test(board) && !/reportedReachRate: rate\(mix\.reached/.test(board) && !/^\s*connect,\s*$/m.test(board));
  const platform = decomment(read("app/platform/sales/floor/page.js"));
  ok("the platform card prints Calls today, the lines used, the transcript count and the mean over conversations — and no \"their line\", no \"Answered (carrier)\", no \"Conversation (transcript)\" rate", /Calls today/.test(platform) && /data-lines-used/.test(platform) && /data-transcript-conversations/.test(platform) && /data-mean-talk/.test(platform) && !/their line/.test(platform) && !/Answered \(carrier\)/.test(platform) && !/connect\.answerRate|connect\.conversationRate|measured\.meanTalkText/.test(platform));
  ok("…\"Time on calls\" says it includes ringing and voicemail", /including ringing and voicemail/.test(platform));
  ok("…and \"No number assigned\" is still printed when the next dial has no line", /No number assigned/.test(platform));
  const agency = decomment(read("app/sales/agency/page.js"));
  ok("the agency tab reads the same fields through t()", /app\.salesAgency\.callsToday/.test(agency) && /data-lines-used/.test(agency) && /app\.salesAgency\.realConversationTranscript/.test(agency) && /app\.salesAgency\.transcribed/.test(agency) && /data-mean-talk/.test(agency) && /app\.salesAgency\.timeOnCallsNote/.test(agency));
  const agencyRoute = decomment(read("app/api/sales/agency/floor/route.js"));
  ok("the agency floor route returns the team's table and the settings, still through visibleRepIds", /table: board\.table/.test(agencyRoute) && /settings: board\.settings/.test(agencyRoute) && /floorBoard\(\{ repIds: visibleRepIds\(viewer\)/.test(agencyRoute));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. One active session — the newer sign-in wins, a supervisor's Sign out ends every token");
// ═══════════════════════════════════════════════════════════════════════════

{
  const { sessionSuperseded, SESSION_SIGNED_IN_ELSEWHERE, SESSION_SIGNED_OUT_BY_SUPERVISOR } = await import("@/lib/sales/auth");
  const boundary = new Date("2026-09-21T22:00:00Z");
  const iat = (d) => Math.floor(new Date(d).getTime() / 1000);
  ok("no boundary stored: every token stands (the column landed after the sign-in)", sessionSuperseded({ sessionIssuedAt: null }, { issuedAt: iat("2026-09-01T00:00:00Z") }) === null);
  ok("a token minted in the boundary's own second is the current session", sessionSuperseded({ sessionIssuedAt: boundary, sessionEndedBy: "login" }, { issuedAt: iat(boundary) }) === null);
  ok("…and one minted later is too (clock skew, a refresh)", sessionSuperseded({ sessionIssuedAt: boundary, sessionEndedBy: "login" }, { issuedAt: iat(boundary) + 30 }) === null);
  const older = sessionSuperseded({ sessionIssuedAt: boundary, sessionEndedBy: "login" }, { issuedAt: iat(boundary) - 1 });
  ok("a token from before a newer sign-in is refused: 401, signed_in_elsewhere", older?.status === 401 && older.body.code === SESSION_SIGNED_IN_ELSEWHERE, older);
  const forced = sessionSuperseded({ sessionIssuedAt: boundary, sessionEndedBy: "supervisor" }, { issuedAt: iat(boundary) - 600 });
  ok("…and after a supervisor's Sign out the same refusal says so: signed_out_by_supervisor", forced?.body.code === SESSION_SIGNED_OUT_BY_SUPERVISOR && /supervisor/.test(forced.body.error));
  ok("a token with no iat is older than any boundary", sessionSuperseded({ sessionIssuedAt: boundary }, { issuedAt: null })?.body.code === SESSION_SIGNED_IN_ELSEWHERE);
  ok("two tabs of one sign-in share one token and are never refused — the rule is per sign-in", sessionSuperseded({ sessionIssuedAt: boundary }, { issuedAt: iat(boundary) }) === null);
  for (const g of ["lib/sales/gate.js", "lib/sales/calls/gate.js", "lib/sales/queueGate.js", "lib/sales/demoGate.js", "lib/sales/outreachGate.js", "lib/sales/smsGate.js", "lib/sales/calendar/gate.js"]) {
    const src = decomment(read(g));
    ok(`${g} selects the boundary, calls sessionSuperseded after canAuthenticate, and strips the columns from the rep`, /sessionIssuedAt: true,\s*sessionEndedBy: true,/.test(src) && /if \(!canAuthenticate\(row\)\)[\s\S]{0,300}const superseded = sessionSuperseded\(row, claims\);\s*if \(superseded\) return \{ rep: null, refusal: superseded \};/.test(src) && /sessionIssuedAt: _sessionIssuedAt, sessionEndedBy: _sessionEndedBy, \.\.\.rep \} = row/.test(src));
  }
  const login = decomment(read("app/api/sales/auth/login/route.js"));
  ok("the login route records the new token's iat as the boundary, through the fenced writer", /const claims = await verifySalesToken\(token\);/.test(login) && /beginSession\(\{ salesRepId: rep\.id, issuedAt: claims\?\.issuedAt/.test(login));
  const sw = decomment(read("lib/sales/sessionWrite.js"));
  ok("beginSession stores the boundary and closes whatever the last session left open (OMniLeads _close_open_session)", /sessionIssuedAt: at, sessionEndedBy: "login"/.test(sw) && /updateMany\(\{ where: \{ salesRepId, endedAt: null \}, data: \{ endedAt: now \} \}\)/.test(sw));
  ok("endSessionByAdmin moves the boundary to now under \"supervisor\" and writes the rep Off under the admin's id", /sessionIssuedAt: now, sessionEndedBy: "supervisor"/.test(sw) && /setRepState\(\{ salesRepId, to: STATE_OFFLINE, setByAdminId: adminId, now, client \}\)/.test(sw));
  ok("verifySalesToken hands the iat out", /issuedAt: Number\.isFinite\(payload\.iat\) \? payload\.iat : null/.test(read("lib/sales/auth.js")));
  const rs = decomment(read("app/components/sales/RepStatus.js"));
  ok("the provider stops beating and posting on a session refusal, and the shell prints the banner with a way back", /SESSION_ENDED_CODES = new Set\(\[SESSION_SIGNED_IN_ELSEWHERE, SESSION_SIGNED_OUT_BY_SUPERVISOR\]\)/.test(rs) && /if \(stopped \|\| sessionLostRef\.current\) return;/.test(rs) && /if \(body\?\.refused\) \{[\s\S]{0,200}noteSessionLoss\(body\.code\);\s*return;/.test(rs) && /export function SessionEndedBanner/.test(rs) && /<SessionEndedBanner \/>/.test(decomment(read("app/sales/SalesShell.js"))));
  ok("…and CallSession tears the Device down on it", /if \(!presence\.sessionLost\) return;[\s\S]{0,200}deviceRef\.current\?\.destroy\?\.\(\)/.test(decomment(read("app/components/sales/CallSession.js"))));
  ok("the two codes map to catalogue keys, in nine languages", ["app.salesAuth.session.elsewhere", "app.salesAuth.session.supervisor", "app.salesAuth.session.signInAgain"].every((k) => Object.keys(APP_MESSAGES).every((l) => APP_MESSAGES[l][k])) && /signed_in_elsewhere: "app\.salesAuth\.session\.elsewhere"/.test(read("lib/sales/authRefusals.js")));
  const schema = read("prisma/schema.prisma");
  ok("the schema carries the three additive columns", /sessionIssuedAt DateTime\?/.test(schema) && /sessionEndedBy String\?/.test(schema) && /setByAdminId String\?/.test(schema));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. Pause sets with limits, and the supervisor's three buttons");
// ═══════════════════════════════════════════════════════════════════════════

{
  const { PAUSE_REASONS, PAUSE_REASON_ORDER, DEFAULT_PAUSE_LIMITS, PAUSE_TYPE_PRODUCTIVE, PAUSE_TYPE_RECREATIONAL, pauseOverBy, pauseBreakdown } = await import("@/lib/sales/calls/agentState");
  ok("every reason has a type and a default limit (null for supervision)", PAUSE_REASON_ORDER.every((c) => [PAUSE_TYPE_PRODUCTIVE, PAUSE_TYPE_RECREATIONAL].includes(PAUSE_REASONS[c].type)) && DEFAULT_PAUSE_LIMITS.break === 15 && DEFAULT_PAUSE_LIMITS.lunch === 60 && DEFAULT_PAUSE_LIMITS.supervision === null);
  ok("break, lunch and dinner are recreational; meeting, training, admin, technical, other, supervision productive", ["break", "lunch", "dinner"].every((c) => PAUSE_REASONS[c].type === PAUSE_TYPE_RECREATIONAL) && ["meeting", "training", "admin", "technical", "other", "supervision"].every((c) => PAUSE_REASONS[c].type === PAUSE_TYPE_PRODUCTIVE));
  ok("supervision is on the closed list and never on the picker", PAUSE_REASON_ORDER.includes("supervision") && !STATUS_CHOICES.some((c) => c.pauseReason === "supervision"));
  ok("a 19-minute break is over by 4 minutes; a 14-minute one is not; supervision never is", pauseOverBy("break", min(19), NOW) === 4 * 60000 && pauseOverBy("break", min(14), NOW) === null && pauseOverBy("supervision", min(500), NOW) === null);
  ok("…the platform's limits win over the defaults", pauseOverBy("break", min(19), NOW, { break: 30 }) === null && pauseOverBy("break", min(19), NOW, { break: 10 }) === 9 * 60000);
  const over = livePresence({ state: STATE_PAUSED, pauseReason: "break", startedAt: min(19), heartbeatAt: NOW }, NOW, { portalSeenAt: NOW });
  ok("livePresence carries the overrun and the limit", over.pauseOverByMs === 4 * 60000 && over.pauseMaxMinutes === 15);
  const h = presenceHeadline(over, { now: NOW });
  ok("…and the headline says \"Over by 4 min\" as an alert", h.sub?.english === "Over by 4 min" && h.sub.alert === true && h.sub.key === "app.salesPresence.overBy");
  const sup = livePresence({ state: STATE_PAUSED, pauseReason: "supervision", startedAt: min(3), heartbeatAt: NOW, setByAdminId: "admin1" }, NOW, { portalSeenAt: NOW });
  ok("a supervisor's pause: Paused · Supervision, \"a supervisor paused you\", set by admin", sup.setByAdmin === true && presenceHeadline(sup, { now: NOW }).sub?.key === "app.salesPresence.bySupervisor" && presenceHeadline(sup, { now: NOW }).english === "Paused · Supervision");
  const split = pauseBreakdown([
    { state: STATE_PAUSED, pauseReason: "lunch", startedAt: min(200), endedAt: min(20) },
    { state: STATE_PAUSED, pauseReason: "meeting", startedAt: min(20), endedAt: min(5) },
  ], { to: NOW });
  ok("reports split paused time by type: a three-hour lunch is 180 min recreational, the meeting 15 min productive", split.byType.recreational === 180 * 60000 && split.byType.productive === 15 * 60000);
  ok("repCallStats.pauses carries byType and each row's type", (() => { const st = repCallStats({ attempts: [], activity: [{ salesRepId: "r", state: STATE_PAUSED, pauseReason: "lunch", startedAt: min(200), endedAt: min(20) }], from: min(300), to: NOW, now: NOW }); return st.pauses.byType.recreational.ms === 180 * 60000 && st.pauses.rows.find((r) => r.code === "lunch").type === "recreational"; })());
  const { normalisePauseLimits, PAUSE_LIMIT_MINUTES_MAX } = await import("@/lib/sales/calls/floorSettings");
  ok("the settings carry the limits, normalised per reason, junk to the default, null kept as none", JSON.stringify(normaliseFloorSettings({}).pauseLimits) === JSON.stringify(DEFAULT_PAUSE_LIMITS) && normalisePauseLimits({ break: "x", lunch: null, dinner: 9999 }).break === 15 && normalisePauseLimits({ lunch: null }).lunch === null && normalisePauseLimits({ dinner: 9999 }).dinner === PAUSE_LIMIT_MINUTES_MAX);
  ok("the console refuses a limit for a reason that does not exist, or 0, or a fraction", validateFloorSettings({ afterCallSeconds: 60, requireWriteUp: true, pauseLimits: { nap: 5 } }).ok === false && validateFloorSettings({ afterCallSeconds: 60, requireWriteUp: true, pauseLimits: { break: 0 } }).ok === false && validateFloorSettings({ afterCallSeconds: 60, requireWriteUp: true, pauseLimits: { break: 2.5 } }).ok === false && validateFloorSettings({ afterCallSeconds: 60, requireWriteUp: true, pauseLimits: { break: 20, lunch: null } }).ok === true);
  ok("a PUT that names one limit keeps the others as stored", /pauseLimits: \{ \.\.\.current\.pauseLimits, \.\.\.\(value\?\.pauseLimits \|\| \{\}\) \}/.test(read("lib/sales/calls/floorSettingsStore.js")));
  ok("presenceFor hands the limits to the derivation", /pauseLimits: floor\.pauseLimits,/.test(read("lib/sales/calls/store.js")));

  const rs = decomment(read("app/components/sales/RepStatus.js"));
  ok("the rep's header turns red past the limit and offers one-tap Available", /data-status-back-available/.test(rs) && /const overLimit = Boolean\(head\.sub\?\.alert\);/.test(rs) && /data-status-alert=\{alert \? "true" : undefined\}/.test(rs));
  const platform = decomment(read("app/platform/sales/floor/page.js"));
  ok("the board prints the overrun in red, the pause limits in the settings card, and paused time by type", /data-pause-over/.test(platform) && /data-floor-pause-limits/.test(platform) && /data-pause-limit=\{r\.code\}/.test(platform) && /data-paused-by-type/.test(platform));
  ok("…and the agency tab prints the overrun in red too", /data-pause-over/.test(decomment(read("app/sales/agency/page.js"))));

  const { SUPERVISOR_ACTIONS, SUPERVISOR_ACTION_LABELS } = await import("@/lib/sales/calls/supervisorActions");
  ok("the three supervisor actions, closed", JSON.stringify(SUPERVISOR_ACTIONS) === '["pause","available","sign_out"]' && SUPERVISOR_ACTIONS.every((a) => SUPERVISOR_ACTION_LABELS[a]));
  const route = decomment(read("app/api/platform/sales/floor/rep-state/route.js"));
  ok("the route is superadmin-only, validates against the list, writes through setRepState / endSessionByAdmin under the admin's id, and audit-logs", /superadminOrRefusal\(request\)/.test(route) && /SUPERVISOR_ACTIONS\.includes\(action\)/.test(route) && /pauseReason: "supervision", setByAdminId: admin\.id/.test(route) && /to: STATE_AVAILABLE, setByAdminId: admin\.id/.test(route) && /endSessionByAdmin\(\{ salesRepId: repId, adminId: admin\.id, now \}\)/.test(route) && /sales_rep_state_\$\{action\}/.test(route));
  ok("…refuses an inactive rep and an unknown action in words", /That rep is not on the floor/.test(route) && /action one of/.test(route));
  ok("the board draws the three buttons per rep from the same list, Sign out behind a confirm", /SUPERVISOR_ACTIONS\.map\(\(action\)/.test(platform) && /data-supervisor-action=\{action\}/.test(platform) && /window\.confirm\(`Sign \$\{rep\.name\} out/.test(platform) && /<SupervisorButtons rep=\{rep\} onDone=\{load\} \/>/.test(platform));
  ok("setRepState writes setByAdminId on the row", /setByAdminId: setByAdminId \|\| null,/.test(read("lib/sales/calls/store.js")));
  // Executed: a supervisor's pause and unpause through the store.
  const c = memoryClient({ activity: [], reps: [{ id: "r", lastSeenAt: sec(5) }] });
  const paused = await setRepState({ salesRepId: "r", to: STATE_PAUSED, pauseReason: "supervision", setByAdminId: "admin1", now: min(1), client: c });
  ok("a supervisor's pause is a paused/supervision row under the admin's id", paused.ok === true && paused.activity.pauseReason === "supervision" && paused.activity.setByAdminId === "admin1");
  const p = (await presenceFor(["r"], { now: NOW, client: c }))[0].presence;
  ok("…the rep's next keepalive reads it: Paused · Supervision, set by a supervisor, never over a limit", p.state === STATE_PAUSED && p.pauseReason === "supervision" && p.setByAdmin === true && p.pauseOverByMs === null);
  const unpaused = await setRepState({ salesRepId: "r", to: STATE_AVAILABLE, setByAdminId: "admin1", now: NOW, client: c });
  ok("Make available is the available transition under the admin's id", unpaused.ok === true && unpaused.activity.setByAdminId === "admin1" && (await presenceFor(["r"], { now: NOW, client: c }))[0].presence.state === STATE_AVAILABLE);
  ok("the rep's own pause is not attributed to anybody", (await setRepState({ salesRepId: "r", to: STATE_PAUSED, pauseReason: "break", now: NOW, client: c })).activity.setByAdminId === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. Registered");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:sales-presence is registered and in check:all", typeof pkg.scripts["check:sales-presence"] === "string" && /check:sales-presence/.test(pkg.scripts["check:all"]));
}

console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("Failed:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
