#!/usr/bin/env node
//
// scripts/check-sales-call-handling.mjs
//
//   npm run check:sales-call-handling
//
// A dial produced no record at all until this landed. Everything below exists
// because a call is the one thing a sales rep does that a statute has an
// opinion about, and because the numbers a supervisor reads are computed from
// what a rep types after it.
//
// ══ What is EXECUTED rather than read ══════════════════════════════════════
//
// Every decision in lib/sales/calls/ is a pure function taking rows, so this
// runs the real code against the cases that matter: a callback with no time, a
// call at the boundary of the 24-hour window, a rep who closed their laptop
// mid-call, a team lead looking at somebody else's note, a caller ID we do not
// own. AGENTS.md asks for exactly this — "execute pure functions against
// hostile input" — and it is how the real bugs in this repo have been found.
//
// ══ Three traps this file is written around ════════════════════════════════
//
// All three produced a false PASS in this project before:
//
//   1. Reading source RAW instead of comment-stripped. A rule described in a
//      comment satisfied a regex looking for the rule. Everything structural
//      below goes through stripComments() first.
//   2. `ok(condition, label)` — the arguments are LABEL FIRST. Reversed, every
//      assertion passes and prints a boolean as its name.
//   3. `Number(null) === 0`. Any assertion about a count distinguishes null
//      from zero explicitly, with `=== null`, never with a falsy test.
//
// ══ The structural half, and why it is positional ══════════════════════════
//
// Three properties cannot be executed here, because executing them would mean
// standing up a Twilio account and a browser. They are asserted against the
// source, scoped to ONE function each rather than a whole file — the lesson
// scripts/check-demo-spend.mjs records after a whole-file search passed while
// the guard it was checking had been deleted, because an identical string a
// few hundred lines earlier satisfied it.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  CLAIM_HOLD,
  CLAIM_RELEASE,
  CLAIM_WORKED,
  DISPOSITIONS,
  DISPOSITION_ORDER,
  MAX_CALLBACK_DAYS,
  attemptsWithin24h,
  dispositionFor,
  dispositionOptions,
  isDisposition,
  planDisposition,
} from "@/lib/sales/calls/dispositions";
import {
  PAUSE_REASONS,
  PAUSE_REASON_ORDER,
  PRESENCE_STALE_MINUTES,
  REP_STATES,
  STATE_AFTER_CALL,
  STATE_AVAILABLE,
  STATE_OFFLINE,
  STATE_ON_CALL,
  STATE_ORDER,
  STATE_PAUSED,
  TRANSITIONS,
  activityTotals,
  canTransition,
  describeDuration,
  livePresence,
  pauseBreakdown,
} from "@/lib/sales/calls/agentState";
import {
  NO_REP,
  TEAM_LEAD_CANNOT_DO,
  TEAM_LEAD_CANNOT_SEE,
  VIEWER_REP,
  VIEWER_TEAM_LEAD,
  canReadTeamNote,
  canViewRep,
  noteVisibilityNotice,
  platformViewer,
  repScopeWhere,
  repViewer,
  visibleRepIds,
  wouldCycle,
} from "@/lib/sales/team";
import {
  IDENTITY_PREFIX,
  TOKEN_TTL_SECONDS,
  browserDialReadiness,
  callCostCents,
  callPlan,
  chooseCallerId,
  repIdentity,
  salesRepIdFromIdentity,
} from "@/lib/sales/calls/browserDial";
import {
  MODE_PREDICTIVE,
  MODE_PREVIEW,
  MODE_PROGRESSIVE,
  automatedDialEnabled,
  canDialAutomatically,
  dialModeState,
} from "@/lib/sales/calls/dialMode";
import {
  MATCH_AMBIGUOUS,
  MATCH_LEAD,
  MATCH_NONE,
  MATCH_PROSPECT,
  MATCH_UNKNOWN,
  inboundHandling,
  matchInboundCaller,
} from "@/lib/sales/calls/inboundMatch";
import {
  NOT_TRACKED_CALLS,
  callbackState,
  campaignCallRows,
  dispositionMix,
  measuredDurations,
  repCallStats,
  teamCallRows,
} from "@/lib/sales/calls/reporting";
import { REP_CALL_WRITES } from "@/lib/sales/calls/gate";
import { REQUIRED_MODELS, callStoreState } from "@/lib/sales/calls/store";
import { CLAIM_HOURS } from "@/lib/sales/prospectView";
import { CALL_ALLOWED, CALL_REFUSED, CALL_UNKNOWN } from "@/lib/sales/callingRules";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (title) => console.log(`\n${title}`);

/** Comments stripped before any regex touches source. A rule named in a comment is not a rule. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}
function source(rel) {
  return stripComments(read(rel));
}

/**
 * The text of one named function, comment-stripped — from its signature to the
 * next top-level `export`. Scoped so a guard deleted from THIS function cannot
 * be satisfied by an identical line somewhere else in the file.
 */
function fnBody(rel, signature) {
  const src = source(rel);
  const start = src.indexOf(signature);
  if (start === -1) return "";
  const rest = src.slice(start + signature.length);
  const next = rest.search(/\n(export|async function|function) /);
  return next === -1 ? rest : rest.slice(0, next);
}

const T0 = new Date("2026-09-03T15:00:00Z");
const hoursFrom = (base, h) => new Date(base.getTime() + h * 60 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The disposition vocabulary is closed, complete and ordered");

ok(
  "every ordered code is a real disposition",
  DISPOSITION_ORDER.every((c) => isDisposition(c)),
);
ok(
  "every disposition appears in the order — one nobody ordered is invisible on screen",
  Object.keys(DISPOSITIONS).every((c) => DISPOSITION_ORDER.includes(c)),
  Object.keys(DISPOSITIONS).filter((c) => !DISPOSITION_ORDER.includes(c)),
);
ok("the order has no duplicates", new Set(DISPOSITION_ORDER).size === DISPOSITION_ORDER.length);
ok(
  "every disposition declares all seven decision fields",
  Object.values(DISPOSITIONS).every(
    (d) =>
      typeof d.label === "string" &&
      typeof d.hint === "string" &&
      typeof d.reached === "boolean" &&
      [CLAIM_HOLD, CLAIM_WORKED, CLAIM_RELEASE].includes(d.claim) &&
      (d.prospectStatus === null || d.prospectStatus === "needs_review") &&
      (d.leadStatus === null || ["contacted", "lost"].includes(d.leadStatus)) &&
      typeof d.doNotContact === "boolean",
  ),
);
ok("an unknown code is not a disposition", isDisposition("left_a_message_with_the_wife") === false);
ok("a non-string is not a disposition", isDisposition(null) === false && isDisposition(7) === false);
ok("dispositionFor refuses an unknown code rather than defaulting", dispositionFor("nope") === null);
ok(
  "a released claim always comes with a status that keeps it out of the pool",
  Object.values(DISPOSITIONS).every((d) => d.claim !== CLAIM_RELEASE || d.prospectStatus !== null),
);
ok(
  "a rep can never reject a prospect outright — only send it for review",
  Object.values(DISPOSITIONS).every((d) => d.prospectStatus === null || d.prospectStatus === "needs_review"),
);
ok(
  "“not interested” keeps the prospect worked, so nobody else re-pitches them",
  DISPOSITIONS.reached_not_interested.claim === CLAIM_WORKED,
);
ok("“do not call” writes the list, not just the row", DISPOSITIONS.do_not_call.doNotContact === true);
ok("“do not call” refuses to be logged without words", DISPOSITIONS.do_not_call.requiresNote === true);
ok(
  "the picker options carry the two fields the form branches on",
  dispositionOptions().every(
    (o) => typeof o.requiresNote === "boolean" && typeof o.requiresCallback === "boolean",
  ),
);
ok(
  "the picker renders in the declared order",
  dispositionOptions().map((o) => o.code).join() === DISPOSITION_ORDER.join(),
);

// ═══════════════════════════════════════════════════════════════════════════
section("2. planDisposition — every refusal, and the arithmetic behind each claim");

const plan = (over) => planDisposition({ now: T0, ...over });

ok("an unknown code is refused, and the refusal lists the real ones", (() => {
  const r = plan({ code: "wrong_number" });
  return r.ok === false && r.reason.includes("no_answer");
})());
ok("a missing code is refused", plan({}).ok === false);
ok("do_not_call with no words is refused", plan({ code: "do_not_call" }).ok === false);
ok("do_not_call with only whitespace is refused", plan({ code: "do_not_call", note: "   " }).ok === false);
ok("do_not_call with words is planned", plan({ code: "do_not_call", note: "Take me off your list." }).ok === true);
ok("not_a_fit with no words is refused", plan({ code: "not_a_fit" }).ok === false);

ok("a callback with no time is refused", plan({ code: "callback" }).ok === false);
ok("a callback in the past is refused", plan({ code: "callback", callbackAt: hoursFrom(T0, -1) }).ok === false);
ok("a callback exactly now is refused", plan({ code: "callback", callbackAt: T0 }).ok === false);
ok("a callback an hour out is planned", plan({ code: "callback", callbackAt: hoursFrom(T0, 1) }).ok === true);
ok(`a callback past ${MAX_CALLBACK_DAYS} days is refused`, (() => {
  const tooFar = hoursFrom(T0, (MAX_CALLBACK_DAYS + 1) * 24);
  return plan({ code: "callback", callbackAt: tooFar }).ok === false;
})());
ok("a callback time sent with a code that does not take one is refused, not dropped", (() => {
  const r = plan({ code: "no_answer", callbackAt: hoursFrom(T0, 1) });
  return r.ok === false && /does not take a callback/.test(r.reason);
})());
ok("an unparseable callback date is refused rather than treated as absent",
  plan({ code: "callback", callbackAt: "not a date" }).ok === false);

ok("a held claim restarts the lease from now", (() => {
  const r = plan({ code: "no_answer" });
  return r.prospect.claimExpiresAt.getTime() === T0.getTime() + CLAIM_HOURS * 3600 * 1000;
})());
ok("a callback carries the lease past the promised time", (() => {
  const due = hoursFrom(T0, 72);
  const r = plan({ code: "callback", callbackAt: due });
  return r.prospect.claimExpiresAt.getTime() === due.getTime() + CLAIM_HOURS * 3600 * 1000;
})());
ok("a near callback does not SHORTEN the ordinary lease", (() => {
  const r = plan({ code: "callback", callbackAt: hoursFrom(T0, 1) });
  return r.prospect.claimExpiresAt.getTime() >= T0.getTime() + CLAIM_HOURS * 3600 * 1000;
})());
ok("a worked claim clears the expiry and keeps the rep", (() => {
  const r = plan({ code: "reached_interested" });
  return r.prospect.claimExpiresAt === null && r.prospect.assignedRepId === "keep";
})());
ok("a released claim clears the rep", (() => {
  const r = plan({ code: "bad_number" });
  return r.prospect.assignedRepId === null && r.prospect.status === "needs_review";
})());
ok("only do_not_call produces a suppression plan", (() => {
  const withDnc = plan({ code: "do_not_call", note: "stop" }).suppression;
  const without = DISPOSITION_ORDER.filter((c) => c !== "do_not_call").every((code) => {
    const r = planDisposition({ code, now: T0, note: "x", callbackAt: DISPOSITIONS[code].requiresCallback ? hoursFrom(T0, 2) : null });
    return r.ok === false || r.suppression === null;
  });
  return withDnc !== null && without;
})());
ok("the suppression is scoped to the phone channel, not widened to every channel", (() => {
  const s = plan({ code: "do_not_call", note: "stop calling" }).suppression;
  return s.channels.length === 1 && s.channels[0] === "phone";
})());
ok("the suppression records that the request arrived on a call", (() => {
  const s = plan({ code: "do_not_call", note: "stop calling" }).suppression;
  return s.source === "call" && s.reason === "stop calling";
})());
ok("the lead status follows the vocabulary and never invents one", (() => {
  const interested = plan({ code: "reached_interested" }).lead;
  const no = plan({ code: "reached_not_interested" }).lead;
  const nothing = plan({ code: "no_answer" }).lead;
  return interested.status === "contacted" && no.status === "lost" && nothing === null;
})());
ok("every planned attempt records the code it came from", (() => {
  const r = plan({ code: "voicemail" });
  return r.attempt.disposition === "voicemail" && r.attempt.dispositionAt.getTime() === T0.getTime();
})());
ok("a refusal carries no partial plan a caller could half-apply", (() => {
  const r = plan({ code: "callback" });
  return r.attempt === null && r.prospect === null && r.lead === null && r.suppression === null;
})());

// ═══════════════════════════════════════════════════════════════════════════
section("3. The 24-hour cap — counted by number, and null is never zero");

const dial = (hoursAgo) => ({ dialledAt: hoursFrom(T0, -hoursAgo) });

ok("an empty list is a real zero", attemptsWithin24h([], T0) === 0);
ok("a non-array is unknown, NOT zero", attemptsWithin24h(null, T0) === null);
ok("undefined is unknown, NOT zero", attemptsWithin24h(undefined, T0) === null);
ok("a string is unknown, NOT zero", attemptsWithin24h("3", T0) === null);
ok("three calls today count as three", attemptsWithin24h([dial(1), dial(5), dial(20)], T0) === 3);
ok("a call exactly 24 hours ago is outside the window", attemptsWithin24h([dial(24)], T0) === 0);
ok("a call 23h59m ago is inside it", attemptsWithin24h([{ dialledAt: hoursFrom(T0, -23.98) }], T0) === 1);
ok("a call stamped in the future is not counted", attemptsWithin24h([{ dialledAt: hoursFrom(T0, 1) }], T0) === 0);
ok("a row with no timestamp is skipped, not counted", attemptsWithin24h([{}, dial(1)], T0) === 1);
ok("a row with a broken timestamp is skipped", attemptsWithin24h([{ dialledAt: "nope" }, dial(1)], T0) === 1);
ok("the count has no rep parameter — the cap is per called party", (() => {
  const body = fnBody("lib/sales/calls/store.js", "export async function attemptsLast24h(");
  return !/salesRepId/.test(body);
})());
ok("the store returns null rather than zero when the tables are absent", (() => {
  const body = fnBody("lib/sales/calls/store.js", "export async function attemptsLast24h(");
  return /if \(!callStoreState\(client\)\.ready\) return null;/.test(body);
})());

// ═══════════════════════════════════════════════════════════════════════════
section("4. Agent state — a graph, not a set of booleans");

ok("every state in the order is a real state", STATE_ORDER.every((s) => REP_STATES[s]));
ok("every state appears in the order", Object.keys(REP_STATES).every((s) => STATE_ORDER.includes(s)));
ok("every state has an edge list", Object.keys(REP_STATES).every((s) => Array.isArray(TRANSITIONS[s])));
ok("every edge lands on a real state",
  Object.values(TRANSITIONS).every((list) => list.every((s) => Boolean(REP_STATES[s]))));
ok("offline is the only state that does not count as working", REP_STATES[STATE_OFFLINE].working === false);

ok("a rep cannot pause from inside a call", canTransition({ from: STATE_ON_CALL, to: STATE_PAUSED, pauseReason: "break" }).ok === false);
ok("a paused rep who dials is allowed to", canTransition({ from: STATE_PAUSED, to: STATE_ON_CALL }).ok === true);
ok("a laptop closing mid-call is recorded, not refused", canTransition({ from: STATE_ON_CALL, to: STATE_OFFLINE }).ok === true);
ok("moving to the state you are already in is refused", canTransition({ from: STATE_AVAILABLE, to: STATE_AVAILABLE }).ok === false);
ok("an unknown target state is refused", canTransition({ from: STATE_AVAILABLE, to: "on_lunch" }).ok === false);
ok("a null target state is refused", canTransition({ from: STATE_AVAILABLE, to: null }).ok === false);
ok("an unknown CURRENT state is treated as offline, not as a crash", canTransition({ from: "???", to: STATE_AVAILABLE }).ok === true);
ok("a pause with no reason is refused", canTransition({ from: STATE_AVAILABLE, to: STATE_PAUSED }).ok === false);
ok("a pause with an unknown reason is refused", canTransition({ from: STATE_AVAILABLE, to: STATE_PAUSED, pauseReason: "vibes" }).ok === false);
ok("a pause with a real reason carries it through", (() => {
  const r = canTransition({ from: STATE_AVAILABLE, to: STATE_PAUSED, pauseReason: "lunch" });
  return r.ok === true && r.pauseReason === "lunch";
})());
ok("a reason attached to a non-pause is refused, not dropped",
  canTransition({ from: STATE_PAUSED, to: STATE_AVAILABLE, pauseReason: "lunch" }).ok === false);
ok("every ordered pause reason is a real one", PAUSE_REASON_ORDER.every((r) => PAUSE_REASONS[r]));
ok("every pause reason appears in the order", Object.keys(PAUSE_REASONS).every((r) => PAUSE_REASON_ORDER.includes(r)));

// ── Presence ──────────────────────────────────────────────────────────────
ok("a rep with no row has never been seen", (() => {
  const p = livePresence(null, T0);
  return p.state === STATE_OFFLINE && p.everSeen === false && p.stale === false;
})());
ok("a closed row is not what somebody is doing now", (() => {
  const p = livePresence({ state: STATE_ON_CALL, startedAt: hoursFrom(T0, -2), endedAt: hoursFrom(T0, -1) }, T0);
  return p.state === STATE_OFFLINE && p.everSeen === true;
})());
ok("a fresh open row is live and not stale", (() => {
  const p = livePresence({ state: STATE_AVAILABLE, startedAt: hoursFrom(T0, -0.1), heartbeatAt: hoursFrom(T0, -0.01) }, T0);
  return p.state === STATE_AVAILABLE && p.stale === false;
})());
ok(`an open row unheard from for over ${PRESENCE_STALE_MINUTES} minutes goes stale`, (() => {
  const p = livePresence(
    { state: STATE_AVAILABLE, startedAt: hoursFrom(T0, -4), heartbeatAt: hoursFrom(T0, -1) },
    T0,
  );
  return p.state === STATE_AVAILABLE && p.stale === true;
})());
ok("a stale row keeps its state — the board shows both, not one instead of the other", (() => {
  const p = livePresence({ state: STATE_ON_CALL, startedAt: hoursFrom(T0, -6) }, T0);
  return p.state === STATE_ON_CALL && p.stale === true && p.forMs > 0;
})());
ok("a paused row reports its reason", (() => {
  const p = livePresence({ state: STATE_PAUSED, pauseReason: "lunch", startedAt: T0, heartbeatAt: T0 }, T0);
  return p.pauseReason === "lunch";
})());
ok("a paused row with a junk reason reports none rather than inventing one", (() => {
  const p = livePresence({ state: STATE_PAUSED, pauseReason: "zzz", startedAt: T0, heartbeatAt: T0 }, T0);
  return p.pauseReason === null;
})());
ok("an unknown state on an open row reads as offline rather than as itself",
  livePresence({ state: "dialing", startedAt: T0 }, T0).state === STATE_OFFLINE);

// ── Durations ─────────────────────────────────────────────────────────────
const shift = [
  { state: STATE_AVAILABLE, startedAt: hoursFrom(T0, -4), endedAt: hoursFrom(T0, -3) },
  { state: STATE_ON_CALL, startedAt: hoursFrom(T0, -3), endedAt: hoursFrom(T0, -2.5) },
  { state: STATE_AFTER_CALL, startedAt: hoursFrom(T0, -2.5), endedAt: hoursFrom(T0, -2.4) },
  { state: STATE_PAUSED, pauseReason: "lunch", startedAt: hoursFrom(T0, -2.4), endedAt: hoursFrom(T0, -1.9) },
  { state: STATE_AVAILABLE, startedAt: hoursFrom(T0, -1.9) },
];
ok("a non-array of rows is unknown, not an empty day", activityTotals(null) === null);
ok("the open row is measured up to now, not dropped", (() => {
  const t = activityTotals(shift, { to: T0 });
  return t.availableMs === 1000 * 60 * 60 * (1 + 1.9);
})());
ok("time on calls is half an hour", activityTotals(shift, { to: T0 }).onCallMs === 30 * 60 * 1000);
ok("a window clamps a period that started before it", (() => {
  const t = activityTotals(shift, { from: hoursFrom(T0, -3.5), to: T0 });
  return t.totals[STATE_AVAILABLE] === 0.5 * 3600 * 1000 + 1.9 * 3600 * 1000;
})());
ok("an unknown state's time is reported apart, never folded into a real one", (() => {
  const t = activityTotals(
    [{ state: "dialing", startedAt: hoursFrom(T0, -1), endedAt: T0 }],
    { to: T0 },
  );
  return t.unknownMs === 3600 * 1000 && t.onCallMs === 0;
})());
ok("a row with no start is counted as unmeasurable, not as zero length", (() => {
  const t = activityTotals([{ state: STATE_PAUSED }], { to: T0 });
  return t.unmeasurable === 1 && t.pausedMs === 0;
})());
ok("working time excludes offline", (() => {
  const t = activityTotals(
    [
      { state: STATE_OFFLINE, startedAt: hoursFrom(T0, -2), endedAt: hoursFrom(T0, -1) },
      { state: STATE_AVAILABLE, startedAt: hoursFrom(T0, -1), endedAt: T0 },
    ],
    { to: T0 },
  );
  return t.workingMs === 3600 * 1000;
})());
ok("pause time is split by reason", (() => {
  const b = pauseBreakdown(shift, { to: T0 });
  return b.byReason.lunch.ms === 0.5 * 3600 * 1000 && b.byReason.break.ms === 0;
})());
ok("a pause with an unreadable reason is NOT counted as “other”", (() => {
  const b = pauseBreakdown(
    [{ state: STATE_PAUSED, pauseReason: "zzz", startedAt: hoursFrom(T0, -1), endedAt: T0 }],
    { to: T0 },
  );
  return b.byReason.other.ms === 0 && b.unattributedMs === 3600 * 1000;
})());
ok("describeDuration refuses a non-number rather than printing NaN", describeDuration(null) === null);
ok("describeDuration prints hours, minutes and seconds in the right shapes", (() => {
  return describeDuration(45 * 1000) === "45s" &&
    describeDuration(125 * 1000) === "2m 05s" &&
    describeDuration(3 * 3600 * 1000 + 4 * 60 * 1000) === "3h 04m";
})());

// ═══════════════════════════════════════════════════════════════════════════
section("5. Three tiers — and the scope fragment that never widens by accident");

const superadmin = platformViewer("superadmin");
const platformAdmin = platformViewer("admin");
const support = platformViewer("support");
const soloRep = repViewer("rep_a");
const lead = repViewer("rep_lead", ["rep_a", "rep_b"]);

ok("a superadmin sees every rep", visibleRepIds(superadmin) === null);
ok("a platform ADMIN sees no reps at all", visibleRepIds(platformAdmin).join() === NO_REP);
ok("a platform SUPPORT session sees no reps at all", visibleRepIds(support).join() === NO_REP);
ok("a viewer with no role sees nothing", visibleRepIds(platformViewer(null)).join() === NO_REP);
ok("null is a refusing scope, never an open one", visibleRepIds(null).join() === NO_REP);
ok("a garbage viewer is a refusing scope", visibleRepIds({ kind: "wizard" }).join() === NO_REP);
ok("a rep with no id is a refusing scope", visibleRepIds(repViewer(null)).join() === NO_REP);
ok("a plain rep sees only themselves", visibleRepIds(soloRep).join() === "rep_a");
ok("a rep with no reports is not a team lead", repViewer("rep_a").kind === VIEWER_REP);
ok("a rep with reports is a team lead", lead.kind === VIEWER_TEAM_LEAD);
ok("a team lead sees their line INCLUDING themselves", (() => {
  const ids = visibleRepIds(lead);
  return ids.includes("rep_lead") && ids.includes("rep_a") && ids.includes("rep_b") && ids.length === 3;
})());
ok("a rep listed as their own report does not become a team lead", repViewer("rep_a", ["rep_a"]).kind === VIEWER_REP);

ok("an empty where is returned for a superadmin and ONLY a superadmin", (() => {
  const open = Object.keys(repScopeWhere(superadmin)).length === 0;
  const others = [platformAdmin, support, soloRep, lead, null, { kind: "wizard" }].every(
    (v) => Object.keys(repScopeWhere(v)).length > 0,
  );
  return open && others;
})());
ok("the refusing where filters on a sentinel no cuid can equal",
  repScopeWhere(support).salesRepId.in.join() === NO_REP);
ok("canViewRep refuses a rep outside the line", canViewRep(lead, "rep_c") === false);
ok("canViewRep allows a rep inside the line", canViewRep(lead, "rep_b") === true);
ok("canViewRep allows a superadmin anybody", canViewRep(superadmin, "rep_z") === true);
ok("canViewRep refuses an empty id even for a superadmin", canViewRep(superadmin, "") === false);

// ── Notes ─────────────────────────────────────────────────────────────────
const noteBy = (id, at) => ({ salesRepId: id, createdAt: at });
const BOUNDARY = new Date("2026-09-01T00:00:00Z");

ok("with no boundary set, a team lead reads NO report's note", (() => {
  return canReadTeamNote(lead, noteBy("rep_a", T0)) === false;
})());
ok("with a boundary set, a team lead reads a report's later note",
  canReadTeamNote(lead, noteBy("rep_a", T0), { from: BOUNDARY }) === true);
ok("a note written BEFORE the boundary stays out of reach", (() => {
  return canReadTeamNote(lead, noteBy("rep_a", new Date("2026-08-30T00:00:00Z")), { from: BOUNDARY }) === false;
})());
ok("a note by somebody outside the line is out of reach whatever the date",
  canReadTeamNote(lead, noteBy("rep_c", T0), { from: BOUNDARY }) === false);
ok("a team lead always reads their own note", canReadTeamNote(lead, noteBy("rep_lead", T0)) === true);
ok("a plain rep is not a team-lead reader of anything",
  canReadTeamNote(soloRep, noteBy("rep_a", T0), { from: BOUNDARY }) === false);
ok("a superadmin does not read notes through THIS function — theirs is the notes module",
  canReadTeamNote(superadmin, noteBy("rep_a", T0), { from: BOUNDARY }) === false);
ok("a note with no author is unreadable", canReadTeamNote(lead, { createdAt: T0 }, { from: BOUNDARY }) === false);
ok("a note with an unreadable date is unreadable",
  canReadTeamNote(lead, noteBy("rep_a", "never"), { from: BOUNDARY }) === false);

ok("the compose notice promises other reps cannot read, while that is true", (() => {
  const n = noteVisibilityNotice({ hasTeamLead: true, from: null });
  return /Other sales reps cannot/.test(n.detail) && !/team lead/i.test(n.headline);
})());
ok("the compose notice names the team lead the moment one can read", (() => {
  const n = noteVisibilityNotice({ hasTeamLead: true, from: BOUNDARY });
  return /team lead/i.test(n.headline);
})());
ok("a rep with no team lead is not told one is reading", (() => {
  const n = noteVisibilityNotice({ hasTeamLead: false, from: BOUNDARY });
  return !/team lead/i.test(n.headline);
})());
ok("the notice says what happens to notes written before the change", (() => {
  const n = noteVisibilityNotice({ hasTeamLead: true, from: BOUNDARY });
  return /before/.test(n.detail);
})());

ok("what a team lead may not see is written down, with a reason each",
  TEAM_LEAD_CANNOT_SEE.length >= 5 && TEAM_LEAD_CANNOT_SEE.every((e) => e.reason.length > 40));
ok("commission amounts are on that list", TEAM_LEAD_CANNOT_SEE.some((e) => e.key === "commission_amounts"));
ok("what a team lead may not DO is written down too",
  TEAM_LEAD_CANNOT_DO.length >= 3 && TEAM_LEAD_CANNOT_DO.every((e) => e.reason.length > 40));

// ── The reporting line cannot loop ────────────────────────────────────────
const chain = { a: "b", b: "c", c: null };
ok("a rep cannot report to themselves", wouldCycle("a", "a", chain) === true);
ok("a two-link loop is caught", wouldCycle("c", "a", chain) === true);
ok("a legal move up an existing chain is allowed", wouldCycle("d", "a", { ...chain, d: null }) === false);
ok("a chain that ends is not a cycle", wouldCycle("x", "c", chain) === false);
ok("a missing manager is not a cycle", wouldCycle("x", "ghost", chain) === false);
ok("a Map is accepted as well as an object",
  wouldCycle("c", "a", new Map([["a", "b"], ["b", "c"], ["c", null]])) === true);
ok("no ids at all is not a cycle", wouldCycle(null, "a", chain) === false);

// ═══════════════════════════════════════════════════════════════════════════
section("6. In-browser calling — identity, caller ID, and the second door");

ok("an identity round-trips", salesRepIdFromIdentity(repIdentity("clx123")) === "clx123");
ok("the identity is prefixed", repIdentity("clx123").startsWith(IDENTITY_PREFIX));
ok("an unprefixed identity is refused — a webhook must not supply a bare primary key",
  salesRepIdFromIdentity("clx123") === null);
ok("Twilio's own client: prefix is understood — this is how a real bridge arrives",
  salesRepIdFromIdentity(`client:${repIdentity("clx123")}`) === "clx123");
ok("a doubled client: prefix is refused rather than unwrapped twice",
  salesRepIdFromIdentity(`client:client:${repIdentity("clx123")}`) === null);
ok("client: on its own is not an identity", salesRepIdFromIdentity("client:") === null);
ok("an identity for another prefix is refused", salesRepIdFromIdentity("worker:clx123") === null);
ok("an id with unsafe characters cannot become an identity", repIdentity("a/../b") === null);
ok("a non-string identity is refused", salesRepIdFromIdentity(null) === null);
ok("the token lives ten minutes or less", TOKEN_TTL_SECONDS <= 600);

const OURS = ["+15145550100", "+19185550111", "+19185550122"];
ok("a local number is preferred", chooseCallerId("+19185551234", OURS) === "+19185550111");
ok("with no local match a real number is still presented", OURS.includes(chooseCallerId("+16135551234", OURS)));
ok("the fallback is stable — the same prospect sees the same number twice", (() => {
  const a = chooseCallerId("+16135551234", OURS);
  const b = chooseCallerId("+16135551234", [...OURS].reverse());
  return a === b;
})());
ok("holding no numbers presents nothing rather than inventing one", chooseCallerId("+19185551234", []) === null);
ok("a non-E.164 candidate is never presented", chooseCallerId("+19185551234", ["9185550111"]) === null);

const allowed = { decision: CALL_ALLOWED, jurisdiction: { code: "US-OK" }, windowText: "08:00–20:00", zones: ["America/Chicago"], zoneSource: "derived" };
ok("a refused window cannot be dialled through the browser either",
  callPlan({ toE164: "+19185551234", readiness: { decision: CALL_REFUSED }, callerNumbers: OURS }).ok === false);
ok("an unknown window cannot be dialled through the browser either",
  callPlan({ toE164: "+19185551234", readiness: { decision: CALL_UNKNOWN }, callerNumbers: OURS }).ok === false);
ok("no readiness at all cannot be dialled",
  callPlan({ toE164: "+19185551234", readiness: null, callerNumbers: OURS }).ok === false);
ok("an allowed window with a number we own is planned",
  callPlan({ toE164: "+19185551234", readiness: allowed, callerNumbers: OURS }).ok === true);
ok("our own infrastructure cannot be dialled", (() => {
  const r = callPlan({ toE164: "+15145550100", readiness: allowed, callerNumbers: OURS, ownNumbers: OURS });
  return r.ok === false && /own numbers/.test(r.reason);
})());
ok("a non-E.164 destination is refused",
  callPlan({ toE164: "5145550100", readiness: allowed, callerNumbers: OURS }).ok === false);
ok("holding no caller numbers refuses the call rather than spoofing one",
  callPlan({ toE164: "+19185551234", readiness: allowed, callerNumbers: [] }).ok === false);
ok("recording is off on every plan this function can produce", (() => {
  const r = callPlan({ toE164: "+19185551234", readiness: allowed, callerNumbers: OURS });
  return r.record === false;
})());
ok("there is no parameter that turns recording on", (() => {
  const body = fnBody("lib/sales/calls/browserDial.js", "export function callPlan(");
  return !/record:\s*(true|record|Boolean)/.test(body);
})());

ok("readiness names the first missing link", (() => {
  const r = browserDialReadiness({ twilioConfigured: false, twimlAppSid: "AP1", callerNumbers: OURS, origin: "https://x" });
  return r.ready === false && r.blockedBy.key === "twilio";
})());
ok("a missing TwiML app blocks", (() => {
  const r = browserDialReadiness({ twilioConfigured: true, twimlAppSid: null, callerNumbers: OURS, origin: "https://x" });
  return r.ready === false && r.blockedBy.key === "twiml_app";
})());
ok("holding no number blocks", (() => {
  const r = browserDialReadiness({ twilioConfigured: true, twimlAppSid: "AP1", callerNumbers: [], origin: "https://x" });
  return r.ready === false && r.blockedBy.key === "caller_id";
})());
ok("a denied microphone blocks", (() => {
  const r = browserDialReadiness({ twilioConfigured: true, twimlAppSid: "AP1", callerNumbers: OURS, origin: "https://x", micPermission: "denied" });
  return r.ready === false && r.blockedBy.key === "microphone";
})());
ok("an unasked microphone does NOT block — three-valued, not two", (() => {
  const r = browserDialReadiness({ twilioConfigured: true, twimlAppSid: "AP1", callerNumbers: OURS, origin: "https://x", micPermission: null });
  return r.ready === true && r.pending === true;
})());
ok("everything present and granted is ready", (() => {
  const r = browserDialReadiness({ twilioConfigured: true, twimlAppSid: "AP1", callerNumbers: OURS, origin: "https://x", micPermission: "granted" });
  return r.ready === true && r.pending === false;
})());

ok("a provider price is read as a positive cost", callCostCents("-0.0140") === 1.4);
ok("no price is null cost, never zero", callCostCents(null) === null);
ok("an unreadable price is null cost", callCostCents("free") === null);

// ═══════════════════════════════════════════════════════════════════════════
section("7. Automated dialling is built and switched off");

const env = (mode, on) => ({ SALES_DIAL_MODE: mode, SALES_AUTOMATED_DIAL_ENABLED: on });
ok("an unset mode is preview", dialModeState(env(undefined, undefined)).mode === MODE_PREVIEW);
ok("preview is not automated", dialModeState(env(MODE_PREVIEW, undefined)).automated === false);
ok("progressive without the master switch falls back to preview and says so", (() => {
  const s = dialModeState(env(MODE_PROGRESSIVE, undefined));
  return s.mode === MODE_PREVIEW && s.refused === true && /switched off/.test(s.reason);
})());
ok("predictive without the master switch falls back to preview",
  dialModeState(env(MODE_PREDICTIVE, undefined)).mode === MODE_PREVIEW);
ok("the refusal says the position is pending, not that the thing is impossible",
  /pending/.test(dialModeState(env(MODE_PROGRESSIVE, undefined)).reason));
ok("“1” does not turn the master switch on", automatedDialEnabled(env(MODE_PROGRESSIVE, "1")) === false);
ok("“yes” does not turn the master switch on", automatedDialEnabled(env(MODE_PROGRESSIVE, "yes")) === false);
ok("“TRUE” does not turn the master switch on", automatedDialEnabled(env(MODE_PROGRESSIVE, "TRUE")) === false);
ok("exactly “true” does", automatedDialEnabled(env(MODE_PROGRESSIVE, "true")) === true);
ok("both switches together select progressive", dialModeState(env(MODE_PROGRESSIVE, "true")).mode === MODE_PROGRESSIVE);
ok("canDialAutomatically is false with the default environment", canDialAutomatically(env(undefined, undefined)) === false);
ok("canDialAutomatically is false with only one switch", canDialAutomatically(env(MODE_PROGRESSIVE, undefined)) === false);
ok("an unknown mode falls back to preview and reports the refusal", (() => {
  const s = dialModeState(env("turbo", "true"));
  return s.mode === MODE_PREVIEW && s.refused === true;
})());
ok("the dial-mode module reaches no telephony vendor", (() => {
  const src = source("lib/sales/calls/dialMode.js");
  return !/from "(twilio|@twilio|@\/lib\/voice)/.test(src);
})());
ok("nothing in lib/sales/calls reaches lib/voice/outboundCall.js", (() => {
  for (const f of [
    "dispositions.js", "agentState.js", "store.js", "reporting.js",
    "dialMode.js", "browserDial.js", "inboundMatch.js", "gate.js",
  ]) {
    if (/outboundCall/.test(source(`lib/sales/calls/${f}`))) return false;
  }
  return true;
})());

// ═══════════════════════════════════════════════════════════════════════════
section("8. Inbound — a caller ID is a hint, and ambiguity is reported");

ok("a withheld number is UNKNOWN, not “nobody we know”",
  matchInboundCaller({ fromE164: null }).outcome === MATCH_UNKNOWN);
ok("an unreadable number is UNKNOWN", matchInboundCaller({ fromE164: "not a phone" }).outcome === MATCH_UNKNOWN);
ok("a number nobody carries is NONE", matchInboundCaller({ fromE164: "+15145550199" }).outcome === MATCH_NONE);
ok("unknown and none are different outcomes", MATCH_UNKNOWN !== MATCH_NONE);
ok("one prospect matches", (() => {
  const m = matchInboundCaller({
    fromE164: "+15145550199",
    prospects: [{ id: "p1", businessName: "Acme Painting", assignedRepId: "rep_a" }],
  });
  return m.outcome === MATCH_PROSPECT && m.prospectId === "p1" && m.salesRepId === "rep_a";
})());
ok("two prospects on one number is ambiguous, and both are returned", (() => {
  const m = matchInboundCaller({
    fromE164: "+15145550199",
    prospects: [{ id: "p1", businessName: "A" }, { id: "p2", businessName: "B" }],
  });
  return m.outcome === MATCH_AMBIGUOUS && m.prospectId === null && m.candidates.length === 2;
})());
ok("a lead matches when no prospect does", (() => {
  const m = matchInboundCaller({
    fromE164: "+15145550199",
    leads: [{ id: "l1", businessName: "Acme", salesRepId: "rep_b" }],
  });
  return m.outcome === MATCH_LEAD && m.salesLeadId === "l1" && m.salesRepId === "rep_b";
})());
ok("two reps holding one number is ambiguous", (() => {
  const m = matchInboundCaller({
    fromE164: "+15145550199",
    leads: [{ id: "l1" }, { id: "l2" }],
  });
  return m.outcome === MATCH_AMBIGUOUS;
})());
ok("no match result carries anything a caller could read as permission", (() => {
  const m = matchInboundCaller({
    fromE164: "+15145550199",
    prospects: [{ id: "p1", assignedRepId: "rep_a" }],
  });
  return !("allowed" in m) && !("authenticated" in m) && !("canWrite" in m);
})());

ok("with the agent off, an inbound call reaches nothing and the screen says so",
  inboundHandling({ agentEnabled: false }).answeredBy === "nobody");
ok("with no transfer destination, the agent answers and nobody can be reached",
  inboundHandling({ agentEnabled: true, canTransfer: false }).answeredBy === "agent");
ok("with presence unknown, the screen says it cannot say rather than guessing", (() => {
  const h = inboundHandling({ agentEnabled: true, canTransfer: true, anyRepLive: null });
  return h.tone === "unknown";
})());
ok("with nobody on the floor, the screen says the transfer will not find anybody", (() => {
  const h = inboundHandling({ agentEnabled: true, canTransfer: true, anyRepLive: false });
  return h.answeredBy === "agent" && h.tone === "gap";
})());
ok("with somebody on the floor, a caller can be put through",
  inboundHandling({ agentEnabled: true, canTransfer: true, anyRepLive: true }).answeredBy === "agent_then_human");

// ═══════════════════════════════════════════════════════════════════════════
section("9. Reporting — pending is a bucket, and a mean carries its denominator");

const attempts = [
  { id: "a1", salesRepId: "rep_a", toE164: "+19185550001", dialledAt: hoursFrom(T0, -5), disposition: "no_answer", dialChannel: "browser", talkSeconds: 0, providerCostCents: 1.2 },
  { id: "a2", salesRepId: "rep_a", toE164: "+19185550002", dialledAt: hoursFrom(T0, -4), disposition: "reached_interested", dialChannel: "browser", talkSeconds: 300, providerCostCents: 4.4 },
  { id: "a3", salesRepId: "rep_a", toE164: "+19185550003", dialledAt: hoursFrom(T0, -3), disposition: "reached_not_interested", dialChannel: "handset" },
  { id: "a4", salesRepId: "rep_a", toE164: "+19185550004", dialledAt: hoursFrom(T0, -2), disposition: null },
  { id: "a5", salesRepId: "rep_a", toE164: "+19185550005", dialledAt: hoursFrom(T0, -1), disposition: "gone_fishing" },
];

ok("a non-array is unknown, not an empty day", dispositionMix(null) === null);
ok("an unlogged call is its own bucket", dispositionMix(attempts).pending === 1);
ok("an unreadable outcome is counted apart, never dropped", dispositionMix(attempts).unknown === 1);
ok("the logged denominator excludes both", dispositionMix(attempts).logged === 3);
ok("reached counts only dispositions that say a human answered", dispositionMix(attempts).reached === 2);
ok("every known disposition is present with a real zero", (() => {
  const mix = dispositionMix(attempts);
  return DISPOSITION_ORDER.every((c) => typeof mix.byCode[c] === "number") && mix.byCode.voicemail === 0;
})());

ok("only answered calls contribute to mean talk time", (() => {
  const m = measuredDurations(attempts);
  return m.measuredOf === 1 && m.meanTalkMs === 300000;
})());
ok("the handset row is counted in the total but not in the measurement", (() => {
  const m = measuredDurations(attempts);
  return m.total === 5 && m.bridged === 2;
})());
ok("nothing measured is a null mean, NOT zero", (() => {
  const m = measuredDurations([{ dialledAt: T0, dialChannel: "handset" }]);
  return m.meanTalkMs === null && m.talkMs === null && m.measuredOf === 0;
})());
ok("carrier cost is summed only from calls that reported one", (() => {
  const m = measuredDurations(attempts);
  return m.costOf === 2 && Math.abs(m.costCents - 5.6) < 0.001;
})());
ok("cost is null when nothing reported one, NOT zero",
  measuredDurations([{ dialledAt: T0 }]).costCents === null);
ok("a mean never travels without the count it came from", (() => {
  const m = measuredDurations(attempts);
  return "measuredOf" in m && "total" in m;
})());

const callbacks = [
  { id: "c1", toE164: "+19185550010", dialledAt: hoursFrom(T0, -50), callbackAt: hoursFrom(T0, -2) },
  { id: "c2", toE164: "+19185550011", dialledAt: hoursFrom(T0, -50), callbackAt: hoursFrom(T0, 5) },
  { id: "c3", toE164: "+19185550012", dialledAt: hoursFrom(T0, -50), callbackAt: hoursFrom(T0, -3) },
  { id: "c4", toE164: "+19185550012", dialledAt: hoursFrom(T0, -1) },
];
ok("a callback whose time has passed with no later call is overdue", (() => {
  const s = callbackState(callbacks, T0);
  return s.overdue.length === 1 && s.overdue[0].attemptId === "c1";
})());
ok("a callback that was followed by another call is not overdue", (() => {
  const s = callbackState(callbacks, T0);
  return !s.overdue.some((o) => o.attemptId === "c3");
})());
ok("a callback still ahead is upcoming, not overdue", (() => {
  const s = callbackState(callbacks, T0);
  return s.upcoming.length === 1 && s.upcoming[0].attemptId === "c2";
})());
ok("overdue callbacks come out soonest first", (() => {
  const s = callbackState(
    [
      { id: "x", toE164: "+1", dialledAt: hoursFrom(T0, -50), callbackAt: hoursFrom(T0, -1) },
      { id: "y", toE164: "+2", dialledAt: hoursFrom(T0, -50), callbackAt: hoursFrom(T0, -9) },
    ],
    T0,
  );
  return s.overdue[0].attemptId === "y";
})());

ok("a rep's own stats report a reach RATE that is labelled as reported", (() => {
  const s = repCallStats({ attempts, activity: null, from: hoursFrom(T0, -24), to: T0, now: T0 });
  return "reportedReachRate" in s && !("connectRate" in s) && !("talkTime" in s);
})());
ok("with no presence rows, times are null rather than zero", (() => {
  const s = repCallStats({ attempts, activity: null, from: hoursFrom(T0, -24), to: T0, now: T0 });
  return s.onCallMs === null && s.pausedMs === null && s.pauses === null;
})());
ok("with presence rows, times are computed", (() => {
  const s = repCallStats({ attempts, activity: shift, from: hoursFrom(T0, -24), to: T0, now: T0 });
  return s.onCallMs === 30 * 60 * 1000 && s.pauses.rows.some((r) => r.code === "lunch" && r.ms > 0);
})());
ok("the rate is suppressed below the floor and prints a fraction instead", (() => {
  const s = repCallStats({ attempts, activity: null, from: hoursFrom(T0, -24), to: T0, now: T0 });
  return s.reportedReachRate.value === null && s.reportedReachRate.sampleSize === 3;
})());

ok("a team board row carries a rep's presence and their stats", (() => {
  const rows = teamCallRows({
    reps: [{ id: "rep_a", name: "Ana", active: true }, { id: "rep_b", name: "Bo", active: true }],
    attempts,
    activity: shift.map((r) => ({ ...r, salesRepId: "rep_a" })),
    presence: [{ salesRepId: "rep_a", presence: livePresence({ state: STATE_ON_CALL, startedAt: T0, heartbeatAt: T0 }, T0) }],
    from: hoursFrom(T0, -24),
    to: T0,
    now: T0,
  });
  return rows[0].id === "rep_a" && rows[0].presence.state === STATE_ON_CALL && rows[1].stats.dials === 0;
})());
ok("a rep with no presence row shows null, not a fabricated state", (() => {
  const rows = teamCallRows({
    reps: [{ id: "rep_b", name: "Bo", active: true }],
    attempts: [],
    activity: [],
    presence: [],
    now: T0,
  });
  return rows[0].presence === null;
})());
ok("the board sorts by dials, never by a rate", (() => {
  const body = fnBody("lib/sales/calls/reporting.js", "export function teamCallRows(");
  return /stats\.dials/.test(body) && !/reportedReachRate\s*\|\|/.test(body);
})());

ok("ungrouped attempts get a named bucket rather than vanishing", (() => {
  const rows = campaignCallRows({ attempts });
  return rows.length === 1 && /No campaign/.test(rows[0].label) && rows[0].dials === 5;
})());
ok("attempts group by the key the caller attached", (() => {
  const rows = campaignCallRows({
    attempts: [
      { ...attempts[0], groupKey: "painters", groupLabel: "Painters" },
      { ...attempts[1], groupKey: "painters", groupLabel: "Painters" },
      { ...attempts[2], groupKey: "flooring", groupLabel: "Flooring" },
    ],
  });
  return rows[0].key === "painters" && rows[0].dials === 2 && rows[1].dials === 1;
})());

ok("what cannot be measured is named, with the missing input each time",
  NOT_TRACKED_CALLS.length >= 4 && NOT_TRACKED_CALLS.every((e) => e.reason.length > 60));
ok("recording is on that list, with consent as the reason and not a missing feature",
  NOT_TRACKED_CALLS.some((e) => e.key === "recording" && /consent/i.test(e.reason)));

// ═══════════════════════════════════════════════════════════════════════════
section("10. Structural — the properties that cannot be executed here");

ok("the calls route resolves its rep through the declared gate", (() => {
  const src = source("app/api/sales/calls/route.js");
  return /requireCallingRep\(request\)/.test(src) && /if \(refusal\)/.test(src);
})());
ok("POST re-asks the calling gate rather than trusting the screen", (() => {
  const body = fnBody("app/api/sales/calls/route.js", "export async function POST(");
  return /salesCallReadiness\(\{/.test(body);
})());
ok("POST passes the counted attempts into the gate, so the cap is enforced not reported", (() => {
  // Both halves: the count is taken, AND it is handed to the gate. Taking it
  // and not passing it is exactly the state this whole feature exists to end —
  // the gate would go on reporting the cap as `unenforced` beside a table full
  // of the rows that could have enforced it.
  //
  // The argument object is SLICED OUT before it is searched. A lazy `[\s\S]*?`
  // spanning from the call to the first match is what a first draft of this
  // used, and mutation testing caught it passing after the field had been
  // deleted from the gate call — because the same field name appears later in
  // the response body, and the lazy span happily reached it.
  const body = fnBody("app/api/sales/calls/route.js", "export async function POST(");
  const counted = /const attempts24h = await attemptsLast24h\(/.test(body);
  const open = body.indexOf("salesCallReadiness({");
  const close = open === -1 ? -1 : body.indexOf("});", open);
  const args = open === -1 || close === -1 ? "" : body.slice(open, close);
  const passed = /attemptsLast24h:\s*attempts24h/.test(args);
  return counted && passed;
})());
ok("POST refuses anything that is not an allowed decision", (() => {
  const body = fnBody("app/api/sales/calls/route.js", "export async function POST(");
  return /readiness\.decision !== CALL_ALLOWED/.test(body);
})());
ok("the attempt is recorded only after the gate clears", (() => {
  const body = fnBody("app/api/sales/calls/route.js", "export async function POST(");
  const gate = body.indexOf("readiness.decision !== CALL_ALLOWED");
  const record = body.indexOf("recordDial(");
  return gate !== -1 && record !== -1 && gate < record;
})());
ok("a do-not-contact prospect is refused before any of that", (() => {
  const body = fnBody("app/api/sales/calls/route.js", "export async function POST(");
  const dnc = body.indexOf("target.doNotContactAt");
  const record = body.indexOf("recordDial(");
  return dnc !== -1 && dnc < record;
})());

ok("the token route takes the identity from the gate, never from the body", (() => {
  const src = source("app/api/sales/calls/token/route.js");
  return /repIdentity\(rep\.id\)/.test(src) && !/body\??\.\s*salesRepId/.test(src) && !/request\.json\(\)/.test(src);
})());
ok("the token route requires an API KEY, not just any Twilio credential", (() => {
  const src = source("app/api/sales/calls/token/route.js");
  return /TWILIO_API_KEY_SID/.test(src) && /TWILIO_API_KEY_SECRET/.test(src);
})());
ok("the token grants no INCOMING calls to a rep's browser", (() => {
  const src = source("app/api/sales/calls/token/route.js");
  return /incomingAllow:\s*false/.test(src);
})());

ok("the bridge verifies Twilio's signature before anything else", (() => {
  const body = fnBody("app/api/rep-dial/bridge/route.js", "export async function POST(");
  const verify = body.indexOf("verifyTwilioWebhook(request)");
  const query = body.indexOf("salesCallAttempt");
  return verify !== -1 && verify < query;
})());
ok("the bridge dials the number off OUR row, not one from the request", (() => {
  const body = fnBody("app/api/rep-dial/bridge/route.js", "export async function POST(");
  return /dial\.number\([\s\S]*attempt\.toE164/.test(body) && !/params\.To/.test(body);
})());
ok("the bridge presents a caller ID off our row too", (() => {
  const body = fnBody("app/api/rep-dial/bridge/route.js", "export async function POST(");
  return /callerId:\s*attempt\.fromE164/.test(body);
})());
ok("the bridge scopes the attempt to the identity's own rep", (() => {
  const body = fnBody("app/api/rep-dial/bridge/route.js", "export async function POST(");
  return /salesRepId:\s*identity/.test(body);
})());
ok("the bridge refuses a stale attempt rather than dialling on an old decision", (() => {
  const body = fnBody("app/api/rep-dial/bridge/route.js", "export async function POST(");
  return /BRIDGE_WINDOW_SECONDS/.test(body);
})());
ok("the bridge never records the call", (() => {
  const src = source("app/api/rep-dial/bridge/route.js");
  return !/record:\s*["']?(true|record-)/.test(src);
})());
ok("the status route verifies the signature too", (() => {
  const body = fnBody("app/api/rep-dial/status/route.js", "export async function POST(");
  return /verifyTwilioWebhook\(request\)/.test(body);
})());
ok("the status route never writes a disposition", (() => {
  const src = source("app/api/rep-dial/status/route.js");
  return !/disposition/.test(src);
})());
ok("the status route takes the attempt id from the URL we ourselves built", (() => {
  const body = fnBody("app/api/rep-dial/status/route.js", "export async function POST(");
  return /searchParams\.get\("attemptId"\)/.test(body);
})());
ok("the webhooks are NOT under /api/sales, which middleware would refuse to Twilio", (() => {
  return existsSync(join(ROOT, "app/api/rep-dial/bridge/route.js")) &&
    !existsSync(join(ROOT, "app/api/sales/rep-dial/bridge/route.js"));
})());

ok("no dial string appears in the call panel — the href still comes from dialHref", (() => {
  const src = source("app/sales/queue/CallPanel.js");
  return !/tel:/.test(src) && /fallbackHref/.test(src);
})());
ok("the call panel reads the store's own readiness rather than asserting it", (() => {
  const src = source("app/sales/queue/CallPanel.js");
  return /config\.store\?\.ready|config\.store\.ready/.test(src);
})());
ok("the handset path records the attempt BEFORE following the link", (() => {
  const src = source("app/sales/queue/CallPanel.js");
  const post = src.indexOf('action: "dial"');
  const follow = src.indexOf("window.location.href = fallbackHref");
  return post !== -1 && follow !== -1 && post < follow;
})());
ok("a denied microphone takes the in-app button away rather than leaving it live", (() => {
  const src = source("app/sales/queue/CallPanel.js");
  return /mic !== "denied"/.test(src);
})());

ok("the floor board refuses anybody below a superadmin", (() => {
  const body = fnBody("app/api/platform/sales/floor/route.js", "export async function GET(");
  return /admin\.role !== "superadmin"/.test(body) && /status: 403/.test(body);
})());
ok("it refuses BEFORE it reads anybody's activity", (() => {
  // Ordering, not presence. A role check that runs after the query is not a
  // check — the same property scripts/check-demo-spend.mjs asserts about a
  // demo guard sitting before the spend.
  const body = fnBody("app/api/platform/sales/floor/route.js", "export async function GET(");
  const gate = body.indexOf('admin.role !== "superadmin"');
  const read = body.indexOf("db.salesRep.findMany");
  return gate !== -1 && read !== -1 && gate < read;
})());
ok("the floor board writes nothing at all — the console views and does not edit", (() => {
  const src = source("app/api/platform/sales/floor/route.js");
  return !/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/.test(src) &&
    !/export async function (POST|PATCH|PUT|DELETE)\(/.test(src);
})());

ok("the calling gate declares exactly the models the call routes may write", (() => {
  return REP_CALL_WRITES.includes("salesCallAttempt") &&
    REP_CALL_WRITES.includes("salesSuppression") &&
    !REP_CALL_WRITES.includes("salesAttribution") &&
    !REP_CALL_WRITES.includes("salesCommissionEntry") &&
    !REP_CALL_WRITES.includes("salesRep");
})());
ok("the calls routes write no model outside that list", (() => {
  const files = ["app/api/sales/calls/route.js", "app/api/sales/calls/token/route.js"];
  const writes = /\b(?:db|tx|client|prisma)\.([a-zA-Z]+)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g;
  for (const f of files) {
    const src = source(f);
    for (const m of src.matchAll(writes)) {
      if (!REP_CALL_WRITES.includes(m[1])) return false;
    }
  }
  return true;
})());
ok("the gate re-reads the rep row rather than trusting the token", (() => {
  const body = fnBody("lib/sales/calls/gate.js", "export async function requireCallingRep(");
  return /db\.salesRep\.findUnique\(/.test(body) && /canAuthenticate\(/.test(body);
})());
ok("the gate never hands a password hash back to a route", (() => {
  const body = fnBody("lib/sales/calls/gate.js", "export async function requireCallingRep(");
  return /passwordHash:\s*_passwordHash/.test(body);
})());
ok("the new gate is declared in check-sales-auth's list of sales gates", (() => {
  return /requireCallingRep/.test(read("scripts/check-sales-auth.mjs"));
})());

// ═══════════════════════════════════════════════════════════════════════════
section("11. The store is honest about tables that do not exist yet");

ok("the store names both models it needs", (() => {
  const models = Object.values(REQUIRED_MODELS);
  return models.includes("SalesCallAttempt") && models.includes("SalesRepActivity");
})());
ok("the pending schema file exists where the store points", (() => {
  return existsSync(join(ROOT, "lib/sales/calls/schema.pending.prisma"));
})());
ok("the pending schema defines both models", (() => {
  const s = read("lib/sales/calls/schema.pending.prisma");
  return /model SalesCallAttempt \{/.test(s) && /model SalesRepActivity \{/.test(s);
})());
ok("nothing here can run a schema push — the owner owns the schema", (() => {
  // Matched on the ability to shell out, not on the WORDS "prisma db push":
  // those words appear in CallStoreUnavailable's message, which is the whole
  // point of that message. A check that failed on the instruction telling a
  // human what to do would be a check arguing with its own documentation.
  for (const f of [
    "lib/sales/calls/store.js", "app/api/sales/calls/route.js",
    "app/api/rep-dial/bridge/route.js", "app/api/rep-dial/status/route.js",
  ]) {
    const src = source(f);
    if (/child_process|execSync|spawnSync|\$executeRaw/.test(src)) return false;
  }
  return true;
})());
ok("readiness is computed from the client, never asserted as a constant", (() => {
  const body = fnBody("lib/sales/calls/store.js", "export function callStoreState(");
  return /client\?\.\[delegate\]/.test(body);
})());
ok("the state this deployment is actually in is reported, whatever it is", (() => {
  const s = callStoreState();
  return typeof s.ready === "boolean" && Array.isArray(s.missing);
})());
ok("every write path requires the store first", (() => {
  for (const fn of [
    "export async function recordDial(",
    "export async function saveDisposition(",
    "export async function setRepState(",
  ]) {
    if (!/requireStore\(client\)/.test(fnBody("lib/sales/calls/store.js", fn))) return false;
  }
  return true;
})());
ok("a disposition never overwrites one already recorded", (() => {
  // The literal guard, not merely the words. `if (false && existing.disposition)`
  // contains the words and does nothing, which is how a check certifies a hole.
  const body = fnBody("lib/sales/calls/store.js", "export async function saveDisposition(");
  return /if \(existing\.disposition\) \{/.test(body) && /already has an outcome/.test(body);
})());
ok("the suppression write is inside the same transaction as the attempt", (() => {
  const body = fnBody("lib/sales/calls/store.js", "export async function saveDisposition(");
  const tx = body.indexOf("$transaction");
  const sup = body.indexOf("suppressWithin(tx");
  return tx !== -1 && sup !== -1 && tx < sup;
})());
ok("a failed suppression takes the whole outcome down rather than leaving a record we ignored", (() => {
  const body = fnBody("lib/sales/calls/store.js", "export async function saveDisposition(");
  return /throw new Error\(`The do-not-call list refused/.test(body);
})());
ok("a do-not-contact date already set is never moved", (() => {
  const body = fnBody("lib/sales/calls/store.js", "export async function saveDisposition(");
  return /if \(!row\?\.doNotContactAt\)/.test(body);
})());
ok("a heartbeat can age a row but never open one", (() => {
  const body = fnBody("lib/sales/calls/store.js", "export async function heartbeat(");
  return /updateMany/.test(body) && !/\.create\(/.test(body);
})());
ok("an empty scope list produces an empty board, never every rep", (() => {
  const body = fnBody("lib/sales/calls/store.js", "export async function presenceFor(");
  return /ids\.length === 0\) return \[\]/.test(body);
})());
ok("the board takes ids the caller decided, so scope lives in one place", (() => {
  const src = source("lib/sales/calls/store.js");
  return !/visibleRepIds/.test(src);
})());

// ═══════════════════════════════════════════════════════════════════════════
section("12. The tripwire, and what replaces it");

ok("the calling-window check still carries its SalesCallAttempt tripwire", (() => {
  return /model\\s\+SalesCallAttempt/.test(read("scripts/check-sales-calling-window.mjs"));
})());
ok("if the model lands, the queue route must count the cap — asserted, not remembered", (() => {
  const schema = read("prisma/schema.prisma");
  if (!/model\s+SalesCallAttempt\b/.test(schema)) {
    // Not there yet. The gate must still be REPORTING the cap rather than
    // silently ignoring it, which lib/sales/callingRules.js does via
    // `unenforced` — proven in check:sales-calling-window.
    return true;
  }
  const body = fnBody("app/api/sales/calls/route.js", "export async function POST(");
  return /attemptsLast24h/.test(body);
})());

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailed:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
