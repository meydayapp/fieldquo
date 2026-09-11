#!/usr/bin/env node
//
// scripts/check-sales-autodial.mjs
//
//   npm run check:sales-autodial
//
// The rep's status, the state ledger, and the progressive autodialler —
// executed, not read.
//
// ══ What this holds ══════════════════════════════════════
//
//   1. The picker's vocabulary: Available · Break · Dinner · Meeting ·
//      Training · Off, every pause choice a real PAUSE_REASONS entry, and
//      every non-available choice UNREACHABLE for inbound — reachable() is
//      executed against a livePresence() row for each one, the way
//      check-inbound-distribution builds rows, so the router and the picker
//      cannot disagree.
//   2. The ledger summary: summariseDay() over a day of SalesRepActivity rows
//      — on-call, wrap, pause by reason, an unclosed last row counted to
//      `now`, and garbage that must land in no bucket.
//   3. The dialler's decision: nextDial() through every branch — the switch,
//      a call up, an inbound ring, each non-available state, the handset-only
//      path, an exhausted order, a cursor that is dialled or skipped, a
//      refused readiness, a null readiness — and the three answer shapes.
//   4. Source: the countdown is one exported constant the screen imports; the
//      dial goes through CallPanel's place() and there is exactly one
//      `device.connect` under app/; the switch's stored value never arms a
//      countdown; the after_call transition is written from the hangup.
//   5. Wiring: the script is in check:all, the schema carries
//      SalesRep.autodial, and the tour steps have their targets.
//
// ══ Judged by exit code ═══════════════════════════════════
//
// Every assertion goes through ok() and the process exits 1 if any failed.
// Sources are decommented before a regex touches them.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AUTODIAL_COUNTDOWN_SECONDS,
  AUTODIAL_REASONS,
  nextCandidate,
  nextDial,
} from "@/lib/sales/autodial";
import { summariseDay, normaliseEvent } from "@/lib/sales/calls/stateLedger";
import {
  PAUSE_REASONS,
  PAUSE_REASON_ORDER,
  REP_STATES,
  STATE_AFTER_CALL,
  STATE_AVAILABLE,
  STATE_OFFLINE,
  STATE_ON_CALL,
  STATE_PAUSED,
  STATUS_CHOICES,
  canTransition,
  isPauseReason,
  livePresence,
  statusChoiceFor,
} from "@/lib/sales/calls/agentState";
import { reachable } from "@/lib/sales/calls/inboundDistribution";
import { SALES_TOUR_STEPS } from "@/app/sales/tourSteps";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

const NOW = new Date("2026-09-11T17:00:00Z");
const at = (h, m = 0) => new Date(Date.UTC(2026, 8, 11, h, m));
const H = 3600 * 1000;
const M = 60 * 1000;

// ═══════════════════════════════════════════════════════════════════════════
section("1. The status picker's vocabulary, and what inbound makes of it");
// ═══════════════════════════════════════════════════════════════════════════

ok("dinner is a pause reason", isPauseReason("dinner") && PAUSE_REASONS.dinner.paid === false);
ok("…and lunch is still one — rows already say it", isPauseReason("lunch"));
ok("…and both are in the order", PAUSE_REASON_ORDER.includes("dinner") && PAUSE_REASON_ORDER.includes("lunch"));

const codes = STATUS_CHOICES.map((c) => c.code);
ok(
  "the picker offers Available · Break · Dinner · Meeting · Training · Off, in that order",
  JSON.stringify(codes) === JSON.stringify(["available", "break", "dinner", "meeting", "training", "off"]),
  codes,
);
ok(
  "every pause choice names a real reason, and the two non-pause choices name none",
  STATUS_CHOICES.every((c) =>
    c.state === STATE_PAUSED ? isPauseReason(c.pauseReason) : c.pauseReason === null,
  ),
);
ok(
  "every choice is a transition the graph allows from Available or from Paused",
  STATUS_CHOICES.every((c) => {
    const from = c.state === STATE_AVAILABLE ? STATE_PAUSED : STATE_AVAILABLE;
    return canTransition({ from, to: c.state, pauseReason: c.pauseReason }).ok;
  }),
);
ok(
  "every choice's label key exists in every language",
  Object.keys(APP_MESSAGES).every((lang) => STATUS_CHOICES.every((c) => c.labelKey in APP_MESSAGES[lang])),
);
ok(
  "every state has a picker-facing label key in every language",
  Object.keys(APP_MESSAGES).every((lang) =>
    Object.keys(REP_STATES).every((s) => `app.salesStatus.state.${s}` in APP_MESSAGES[lang]),
  ),
);

// The one property that matters: a rep in any picker state but Available is
// not rung. Built with livePresence, the real producer, from a fresh row.
const presenceFor = (choice) =>
  livePresence(
    { state: choice.state, pauseReason: choice.pauseReason, startedAt: NOW, heartbeatAt: NOW },
    NOW,
    { portalSeenAt: NOW },
  );
for (const c of STATUS_CHOICES) {
  const p = presenceFor(c);
  if (c.state === STATE_AVAILABLE) {
    ok(`"${c.label}" IS reachable for inbound`, reachable(p, NOW) === true, p);
  } else {
    ok(`"${c.label}" is NOT reachable for inbound`, reachable(p, NOW) === false, p);
  }
}
for (const reason of PAUSE_REASON_ORDER) {
  const p = livePresence({ state: STATE_PAUSED, pauseReason: reason, startedAt: NOW, heartbeatAt: NOW }, NOW);
  ok(`paused for "${reason}" is not reachable`, reachable(p, NOW) === false);
}
ok("statusChoiceFor maps a paused-dinner row to the Dinner choice", statusChoiceFor(presenceFor(STATUS_CHOICES[2]))?.code === "dinner");
ok("…and an on_call row to no choice at all", statusChoiceFor(livePresence({ state: STATE_ON_CALL, startedAt: NOW, heartbeatAt: NOW }, NOW)) === null);
ok("…and a paused-admin row to no choice — not rounded to Break", statusChoiceFor(livePresence({ state: STATE_PAUSED, pauseReason: "admin", startedAt: NOW, heartbeatAt: NOW }, NOW)) === null);

// ═══════════════════════════════════════════════════════════════════════════
section("2. The ledger: one rep's day, summarised");
// ═══════════════════════════════════════════════════════════════════════════

// 09:00 available · 09:10 on_call · 09:22 after_call · 09:25 available ·
// 10:00 paused/break · 10:15 available · 12:00 paused/dinner · 12:45 available
// · 13:00 on_call · 13:30 after_call · 13:35 paused/meeting … still open at 17:00.
const day = [
  { state: STATE_AVAILABLE, startedAt: at(9), endedAt: at(9, 10) },
  { state: STATE_ON_CALL, startedAt: at(9, 10), endedAt: at(9, 22), callAttemptId: "a1" },
  { state: STATE_AFTER_CALL, startedAt: at(9, 22), endedAt: at(9, 25), callAttemptId: "a1" },
  { state: STATE_AVAILABLE, startedAt: at(9, 25), endedAt: at(10) },
  { state: STATE_PAUSED, pauseReason: "break", startedAt: at(10), endedAt: at(10, 15) },
  { state: STATE_AVAILABLE, startedAt: at(10, 15), endedAt: at(12) },
  // The request's own event shape — `at` and `reason` — mixed in on purpose.
  { state: STATE_PAUSED, reason: "dinner", at: at(12), endedAt: at(12, 45) },
  { state: STATE_AVAILABLE, startedAt: at(12, 45), endedAt: at(13) },
  { state: STATE_ON_CALL, startedAt: at(13), endedAt: at(13, 30), callAttemptId: "a2" },
  { state: STATE_AFTER_CALL, startedAt: at(13, 30), endedAt: at(13, 35), callAttemptId: "a2" },
  { state: STATE_PAUSED, pauseReason: "meeting", startedAt: at(13, 35), endedAt: null },
];
const s = summariseDay(day, { from: at(0), to: NOW });

ok("on-call time is the two call periods: 12m + 30m", s.onCallMs === 42 * M, s.onCallMs / M);
ok("wrap time is the two after_call periods: 3m + 5m", s.wrapMs === 8 * M, s.wrapMs / M);
ok("the unclosed meeting is counted up to now: 13:35 → 17:00", s.pauseByReason.meeting === 3 * H + 25 * M, s.pauseByReason.meeting / M);
ok("break is 15m", s.pauseByReason.break === 15 * M);
ok("dinner is 45m — read from the `at` / `reason` shape", s.pauseByReason.dinner === 45 * M);
ok("every closed-list reason is present, zero when unused", PAUSE_REASON_ORDER.every((r) => typeof s.pauseByReason[r] === "number") && s.pauseByReason.lunch === 0);
ok("total paused is the sum of the reasons", s.pausedMs === s.pauseByReason.break + s.pauseByReason.dinner + s.pauseByReason.meeting);
ok("available is the rest of the working day", s.availableMs === 10 * M + 35 * M + 105 * M + 15 * M, s.availableMs / M);
ok("the day sums to 8h of working time", s.workingMs === 8 * H, s.workingMs / H);
ok("the open row is reported", s.open === true);
ok("eleven rows counted, none ignored", s.counted === 11 && s.ignored === 0);

// Garbage in. Nothing here may land in a state bucket.
const junk = summariseDay(
  [
    null,
    42,
    "paused",
    { state: "on_lunch", startedAt: at(9), endedAt: at(10) },
    { state: STATE_PAUSED, pauseReason: "nap", startedAt: at(10), endedAt: at(10, 30) },
    { state: STATE_ON_CALL },
    { state: STATE_ON_CALL, startedAt: "not a date", endedAt: at(11) },
    { state: STATE_AVAILABLE, startedAt: at(12), endedAt: at(11) },
  ],
  { from: at(0), to: NOW },
);
ok("a made-up state is unknown time, not any state's", junk.unknownMs === 1 * H && junk.onCallMs === 0 && junk.workingMs === 30 * M);
ok("a paused row with a made-up reason is unattributed, not 'other'", junk.pauseUnattributedMs === 30 * M && junk.pauseByReason.other === 0);
ok("rows with no start, a bad start, or a negative length count nothing", junk.availableMs === 0);
ok("non-object rows are ignored and counted as such", junk.ignored >= 3, junk);
ok("summariseDay(null) is null, not an empty day", summariseDay(null) === null && summariseDay("x") === null);
ok("normaliseEvent prefers the row's own columns over the request aliases", (() => {
  const r = normaliseEvent({ state: STATE_PAUSED, pauseReason: "break", reason: "dinner", startedAt: at(1), at: at(2) });
  return r.pauseReason === "break" && r.startedAt.getTime() === at(1).getTime();
})());

// ═══════════════════════════════════════════════════════════════════════════
section("3. The decision: nextDial through every branch");
// ═══════════════════════════════════════════════════════════════════════════

const order = [
  { id: "p1", dialled: true },
  { id: "p2", dialled: false },
  { id: "p3", dialled: false },
  { id: "p4", dialled: true },
];
const allowed = { decision: "allowed" };
const base = {
  order,
  cursor: "p1",
  readiness: allowed,
  state: STATE_AVAILABLE,
  switchOn: true,
  callUp: false,
  inboundRinging: false,
  browserReady: true,
};

ok("the ordinary case dials the first undialled row after the cursor", nextDial(base).dial === "p2");
ok("a cursor that is itself undialled is the candidate", nextDial({ ...base, cursor: "p2" }).dial === "p2");
ok("a null cursor starts from the top", nextDial({ ...base, cursor: null }).dial === "p2");
ok("a cursor not in the order reads as the top", nextDial({ ...base, cursor: "gone" }).dial === "p2");
ok("bare ids are read as undialled rows", nextDial({ ...base, order: ["x", "y"], cursor: null }).dial === "x");
ok("a skipped row is not offered again", nextDial({ ...base, skipped: ["p2"] }).dial === "p3");
ok("it resumes after the cursor first", nextDial({ ...base, cursor: "p3" }).dial === "p3" && nextDial({ ...base, cursor: "p1" }).dial === "p2");
ok("…and when nothing after the cursor is left it continues from the top rather than calling a regrouped list exhausted", nextDial({ ...base, cursor: "p4" }).dial === "p2");
ok("…the rep's choices survive that: a skipped row before the cursor is still not offered", nextDial({ ...base, cursor: "p4", skipped: ["p2"] }).dial === "p3" && nextDial({ ...base, cursor: "p4", skipped: ["p2", "p3"] }).reason === AUTODIAL_REASONS.exhausted);

// ── The window wall ────────────────────────────────────────────────────────
{
  const T = Date.parse("2026-09-11T14:00:00Z"); // 10:00 ET
  const opens11 = Date.parse("2026-09-11T15:00:00Z");
  const grouped = [
    { id: "e1", dialled: true, opensAt: null },
    { id: "e2", dialled: false, opensAt: null },
    { id: "c1", dialled: false, opensAt: opens11 },
    { id: "c2", dialled: false, opensAt: new Date(opens11) },
    { id: "c3", dialled: false, opensAt: new Date(opens11).toISOString() },
    { id: "m1", dialled: false, opensAt: opens11 + 3_600_000 },
  ];
  const g = { ...base, order: grouped, cursor: "e1", now: T };
  ok("a callable row before the wall is dialled", nextDial(g).dial === "e2");
  const w = nextDial({ ...g, cursor: "e2", skipped: ["e2"] });
  ok("with every callable row done it WAITS at the next group rather than dialling into it", w.wait === "c1" && w.reason === AUTODIAL_REASONS.window_not_open && w.opensAt === opens11, w);
  ok("…counting the rows that open at that instant, whatever form the instant took (ms, Date, ISO)", w.count === 3, w.count);
  ok("…and not the group after it", w.count !== 4);
  ok("at the instant itself the wall is gone and the first row of the group is dialled", nextDial({ ...g, cursor: "e2", skipped: ["e2"], now: opens11 }).dial === "c1");
  ok("…one millisecond before, it is still a wait", nextDial({ ...g, cursor: "e2", skipped: ["e2"], now: opens11 - 1 }).wait === "c1");
  ok("the wait is asked AFTER the gates: a paused rep with a wall ahead hears 'paused', not a countdown", nextDial({ ...g, cursor: "e2", skipped: ["e2"], state: STATE_PAUSED }).reason === AUTODIAL_REASONS.not_available);
  ok("…and with the switch off, 'switch off'", nextDial({ ...g, cursor: "e2", skipped: ["e2"], switchOn: false }).reason === AUTODIAL_REASONS.switch_off);
  ok("a wall is never crossed to reach a callable row behind it in the order", (() => {
    const order = [{ id: "a", dialled: true }, { id: "wall", opensAt: opens11 }, { id: "z", opensAt: null }];
    return nextDial({ ...base, order, cursor: "a", now: T }).wait === "wall";
  })());
  ok("a row with a garbage opensAt is read as callable now (judged at zero by its readiness), not as a wall", nextDial({ ...base, order: [{ id: "x", opensAt: "not a date" }], cursor: null, now: T }).dial === "x");
  ok("nextCandidate() answers null during a wait rather than a row", nextCandidate({ order: grouped, cursor: "e2", skipped: ["e2"], now: T }) === null);
  ok("`now` defaults to the wall clock, so an omitted clock judges a wall in the past as open", nextDial({ ...base, order: [{ id: "old", opensAt: T }], cursor: null }).dial === "old");
}

ok("the switch off stops it", nextDial({ ...base, switchOn: false }).reason === AUTODIAL_REASONS.switch_off);
ok("a call up stops it — never two at once", nextDial({ ...base, callUp: true }).reason === AUTODIAL_REASONS.call_up);
ok("an inbound ring stops it", nextDial({ ...base, inboundRinging: true }).reason === AUTODIAL_REASONS.inbound_ringing);
ok("the switch outranks the call, the call outranks the ring", (() => {
  const a = nextDial({ ...base, switchOn: false, callUp: true, inboundRinging: true });
  const b = nextDial({ ...base, callUp: true, inboundRinging: true });
  return a.reason === AUTODIAL_REASONS.switch_off && b.reason === AUTODIAL_REASONS.call_up;
})());
for (const state of Object.keys(REP_STATES)) {
  if (state === STATE_AVAILABLE) continue;
  const d = nextDial({ ...base, state });
  ok(`state "${state}" stops it, naming the state`, d.stop === true && d.reason === AUTODIAL_REASONS.not_available && d.state === state, d);
}
ok("no state at all stops it", nextDial({ ...base, state: null }).reason === AUTODIAL_REASONS.not_available);
ok("the handset-only path stops it rather than opening a tel: link on a timer", nextDial({ ...base, browserReady: false }).reason === AUTODIAL_REASONS.no_browser_calling);
ok("an exhausted order stops it", nextDial({ ...base, order: [{ id: "p1", dialled: true }] }).reason === AUTODIAL_REASONS.exhausted);
ok("an empty order stops it", nextDial({ ...base, order: [] }).reason === AUTODIAL_REASONS.exhausted);
ok("an order that is not an array stops it", nextDial({ ...base, order: "p2" }).reason === AUTODIAL_REASONS.exhausted);
ok("every row skipped stops it", nextDial({ ...base, skipped: ["p2", "p3"] }).reason === AUTODIAL_REASONS.exhausted);

ok("a refused readiness SKIPS the candidate with the reason", (() => {
  const d = nextDial({ ...base, readiness: { decision: "refused", reason: "do_not_contact" } });
  return d.skip === "p2" && d.reason === "do_not_contact";
})());
ok("a refused readiness with no reason skips with not_ready", nextDial({ ...base, readiness: { decision: "unknown" } }).reason === AUTODIAL_REASONS.not_ready);
ok("no readiness at all is a skip, never a dial — absence is not permission", nextDial({ ...base, readiness: null }).reason === AUTODIAL_REASONS.readiness_unknown);
ok("a readiness that is not an object is the same", nextDial({ ...base, readiness: "allowed" }).reason === AUTODIAL_REASONS.readiness_unknown);
ok("only the literal decision 'allowed' dials", nextDial({ ...base, readiness: { decision: "ALLOWED" } }).skip === "p2");
ok("the gates are asked before the order, so a paused rep with an empty order hears 'paused'", nextDial({ ...base, order: [], state: STATE_PAUSED }).reason === AUTODIAL_REASONS.not_available);
ok("every answer is exactly one of the four shapes", (() => {
  const answers = [
    nextDial(base),
    nextDial({ ...base, readiness: null }),
    nextDial({ ...base, switchOn: false }),
    nextDial({ ...base, order: [{ id: "w", opensAt: Date.now() + 60_000 }], cursor: null }),
  ];
  return answers.every((d) => ["dial" in d, "skip" in d, "stop" in d, "wait" in d].filter(Boolean).length === 1) && "wait" in answers[3];
})());
ok("nextDial() with no arguments stops rather than throws", nextDial().stop === true);
ok("nextCandidate selects without judging readiness", nextCandidate({ order, cursor: "p1" }) === "p2" && nextCandidate({ order: [], cursor: null }) === null);

// ═══════════════════════════════════════════════════════════════════════════
section("4. Source: the countdown, the one dial path, and no self-resume");
// ═══════════════════════════════════════════════════════════════════════════

const control = decomment(read("app/components/sales/AutodialControl.js"));
const panel = decomment(read("app/components/sales/CallPanel.js"));
const queue = decomment(read("app/sales/queue/page.js"));
const lib = decomment(read("lib/sales/autodial.js"));
const status = decomment(read("app/components/sales/RepStatus.js"));
const dock = decomment(read("app/components/sales/IncomingCallDock.js"));
const route = decomment(read("app/api/sales/calls/route.js"));

ok("the countdown is five seconds", AUTODIAL_COUNTDOWN_SECONDS === 5);
ok("…declared once in lib/sales/autodial.js", /export const AUTODIAL_COUNTDOWN_SECONDS = 5;/.test(lib));
ok("…and the control imports it rather than typing a number", /AUTODIAL_COUNTDOWN_SECONDS/.test(control) && /AUTODIAL_COUNTDOWN_SECONDS \* 1000/.test(control) && !/\b5000\b/.test(control));
ok("the dial goes through CallPanel's place(\"browser\") — the manual path", /place\("browser"\)\.then/.test(panel) && /onClick=\{\(\) => place\("browser"\)\}/.test(panel));
ok("there is exactly one device.connect under app/ and it is CallPanel's", (() => {
  const files = [
    "app/components/sales/CallPanel.js",
    "app/components/sales/AutodialControl.js",
    "app/components/sales/DialRegion.js",
    "app/components/sales/RepStatus.js",
    "app/components/sales/IncomingCallDock.js",
    "app/sales/queue/page.js",
  ];
  const hits = files.filter((f) => /device\.connect\(/.test(decomment(read(f))));
  return hits.length === 1 && hits[0] === "app/components/sales/CallPanel.js";
})());
ok("neither the control nor the queue imports the Twilio SDK or posts a dial of its own", !/@twilio\/voice-sdk|action: "dial"/.test(control) && !/@twilio\/voice-sdk|action: "dial"/.test(queue));
ok("the panel consumes an autodial token once and refuses when not idle", /autoDialSeen\.current === autoDial\.token\) return;/.test(panel) && /reason: "not_idle"/.test(panel));
ok("the control never arms from the switch's stored value", /useEffect\(\(\) => \{\s*if \(switchOn\) return;/.test(control) && !/prevSwitch/.test(control));
ok("…the switch's own press is what arms it", /else if \(turningOn\) auto\.resume\(\);/.test(control));
ok("…and a pause resumes only on the rep's press of Available, never on the state", /availablePresses/.test(control) && /prevPresses\.current === availablePresses\) return;/.test(control) && /availablePresses/.test(status) && /setAvailablePresses\(\(n\) => n \+ 1\)/.test(status));
ok("the arm after an outcome waits for the reloaded order", /pendingArm\.current = true;/.test(control) && /\}, \[order, arm\]\);/.test(control));
ok("the dialler selects the candidate before judging it, and judges it at zero with that row's readiness", /if \(id !== l\.currentId\) l\.select\?\.\(id\);/.test(control) && /const ready = loaded \? l\.readiness : null;/.test(control));
ok("a wait is a phase of its own, entered only through arm(), and at zero it calls arm() again rather than dialling", /setPhase\("waiting"\)/.test(control) && (control.match(/setPhase\("waiting"\)/g) || []).length === 1 && /if \(phase !== "waiting" \|\| !endsAt\) return undefined;/.test(control) && /arm\(waiting\?\.cursor \|\| null\);/.test(control) && !/setToken\(\{[^}]*\}\);\s*\}\s*\}, \[phase, endsAt, waiting/.test(control));
ok("…the wait is cancelled by the same world the countdown is (status, switch, call, ring), and Pause halts it", /if \(phase !== "countdown" && phase !== "waiting"\) return;/.test(control) && /if \(phase !== "countdown" && phase !== "waiting"\) return;\s*halt\("cancelled"\);/.test(control));
ok("…and a press of Available while already waiting does not start a second clock", /phase === "waiting" \|\| phase === "dialling"\) return;/.test(control));
ok("the dialler's clock is the server's, carried by an offset the queue stamps", /clockOffsetMs/.test(control) && /Date\.now\(\) \+ \(Number\(latest\.current\.clockOffsetMs\) \|\| 0\)/.test(control) && /clockOffsetMs = clock \? clock\.serverMs - clock\.localMs : 0/.test(queue) && /useAutodial\(\{[^}]*clockOffsetMs/.test(queue));
ok("the queue hands the dialler each row's opening instant, null for a row callable now", /opensAt: item\.window\?\.callableNow \? null : item\.window\?\.opensAtIso \|\| null/.test(queue));
ok("an inbound ring cancels a countdown", /if \(gate\.stop\) \{\s*halt\(gate\.reason/.test(control) && /inboundRinging/.test(control) && /setInboundRinging\(true\)/.test(dock));
ok("the hangup writes after_call to the ledger, with the attempt", /postState\(\{ state: STATE_AFTER_CALL, callAttemptId: body\.attemptId \}\)/.test(panel));
ok("…and an answered callback writes on_call", /state: STATE_ON_CALL,\s*callAttemptId: body\?\.attemptId/.test(dock));
ok("the state route attributes the attempt only when this rep owns it", /where: \{ id: body\.callAttemptId\.trim\(\), salesRepId: rep\.id \}/.test(route));
ok("the autodial action takes a boolean and writes it through the fenced writer, never db.salesRep itself", /typeof body\.on !== "boolean"/.test(route) && /saveRepAutodial\(\{ salesRepId: rep\.id, on: body\.on \}\)/.test(route) && !/db\.salesRep\.update/.test(route) && /data: \{ autodial: on \}/.test(decomment(read("lib/sales/autodialWrite.js"))));
ok("the heartbeat beats from the shell, not the panel", /HEARTBEAT_SECONDS \* 1000/.test(status) && !/action: "heartbeat"/.test(panel));
ok("the queue passes the token and the result handler through DialRegion", /autoDial=\{auto\.token\}/.test(queue) && /onAutoDialResult=\{auto\.onResult\}/.test(queue));
ok("the queue's readiness for the dialler is dialSpace's state AND the live window decision", /space\.state === DIAL_READY && compliance\?\.decision === CALL_ALLOWED/.test(queue));
ok("the library says why this is progressive and not predictive", /64\.1200\(a\)\(7\)/.test(read("lib/sales/autodial.js")) && /CRTC/.test(read("lib/sales/autodial.js")));

// ═══════════════════════════════════════════════════════════════════════════
section("5. Wiring: check:all, the schema, the tour");
// ═══════════════════════════════════════════════════════════════════════════

const pkg = JSON.parse(read("package.json"));
ok("check:sales-autodial exists", typeof pkg.scripts["check:sales-autodial"] === "string");
ok("…and check:all runs it", /npm run check:sales-autodial\b/.test(pkg.scripts["check:all"]));
const schema = read("prisma/schema.prisma");
ok("SalesRep carries the persisted switch, off by default", /autodial Boolean @default\(false\)/.test(schema));
ok("SalesRepActivity is the ledger — no second table for the same events", /model SalesRepActivity \{/.test(schema) && !/model SalesAgentStateEvent/.test(schema));
const autodialStep = SALES_TOUR_STEPS.find((s) => s.key === "autodial");
const statusStep = SALES_TOUR_STEPS.find((s) => s.key === "status");
ok("the tour has an autodial step pointing at the switch on the queue", autodialStep?.href === "/sales/queue" && autodialStep?.target === '[data-tour="sales-queue-autodial"]');
ok("…and the control renders that target", /data-tour="sales-queue-autodial"/.test(control));
ok("the tour has a status step pointing at the picker", statusStep?.target === '[data-tour="sales-status"]');
ok("…and the picker renders that target", /data-tour="sales-status"/.test(status));
ok("both steps' strings exist in every language", Object.keys(APP_MESSAGES).every((lang) => [autodialStep, statusStep].every((st) => st.titleKey in APP_MESSAGES[lang] && st.bodyKey in APP_MESSAGES[lang])));
ok("every autodial and status string exists in every language", (() => {
  const keys = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.salesAutodial.") || k.startsWith("app.salesStatus."));
  return keys.length >= 45 && Object.keys(APP_MESSAGES).every((lang) => keys.every((k) => k in APP_MESSAGES[lang]));
})());
ok("the wait has its own sentence in every language, and the control says it", ["app.salesAutodial.waitingForWindow", "app.salesAutodial.waitingForWindowNoZone", "app.salesAutodial.waitingForWindowNote"].every((k) => Object.keys(APP_MESSAGES).every((lang) => typeof APP_MESSAGES[lang][k] === "string") && control.includes(`"${k}"`)));
ok("the tour's autodial sentence says it waits for a window", /waits for the next window/.test(APP_MESSAGES.en["app.salesTour.autodialBody"]));
const shell = decomment(read("app/sales/SalesShell.js"));
ok("the shell mounts the provider around everything and the picker in the header and the drawer", /<RepPresenceProvider>/.test(shell) && /<RepStatusPicker layout="row" \/>/.test(shell) && /drawerExtra=\{<RepStatusPicker layout="list" \/>\}/.test(shell));

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  failures.length === 0
    ? `\nALL PASS — ${pass} checks`
    : `\n${pass} passed, ${failures.length} FAILED\n` + failures.map((f) => `  ✗ ${f}`).join("\n"),
);
process.exit(failures.length ? 1 : 0);
