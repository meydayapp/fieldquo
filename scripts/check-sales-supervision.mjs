// scripts/check-sales-supervision.mjs
//
//   npm run check:sales-supervision
//
// Live-call supervision (listen / whisper / barge / take), hold, and the
// two kinds of call that are not prospect reach (a colleague's browser, a
// typed number outside the queue) — lib/sales/calls/supervision.js and the
// files around it, executed rather than read.
//
// ══ What this executes ════════════════════════════════════════════════════
//
//   1. The setting: OFF unless a literal true; a truthy string is off.
//   2. The bridge's mode: conference only when enabled AND a prospect call.
//   3. Starting supervision: every refusal (off, who, kind, ended, no room,
//      no rep leg, somebody else's) and the lock that is written.
//   4. What each kind does to the supervisor's <Conference>: listen is
//      coach+muted, whisper coach+unmuted, barge/take no coach — rendered
//      through Twilio's own builder and asserted on the XML.
//   5. Take: refused until the leg is in; the row is marked BEFORE the rep
//      is hung up; a held prospect is unheld first.
//   6. Hold: the rep on the call only, conference only, once per edge, and
//      the seconds arithmetic; the platform hold URL rides only when https.
//   7. Who left: the rep leaving ends the room unless the call was taken;
//      the supervisor leaving never does.
//   8. The end of the room closes an open hold and an open supervision.
//   9. The rep is told of barge and take always, of listen and whisper only
//      when the setting says so; the prospect is told nothing (no such
//      shape exists — asserted on the source).
//  10. Internal and off-campaign: privilege, self, unreachable, own number,
//      no location.
//  11. Counting: prospectDialsOnly / onlyProspectDials keep internal and
//      off-campaign out, keep null-kind (pre-column) rows in; the 24-hour
//      cap in store.js does NOT use the prospect filter.
//  12. The recording: conference rows read contractor-first; hold ranges
//      from HOLD/UNHOLD rows; silenceRanges zeroes exactly those samples.
//  13. The routes, on the source: the bridge reads the supervisor's mode
//      from the ROW; the platform route is superadmin-only on every action;
//      the rep-side route is behind requireCallingRep; every notification
//      answers through twilioAck.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import twilio from "twilio";

import {
  DEFAULT_SUPERVISION_SETTINGS,
  SUPERVISION_SETTING_KEY,
  SUP_LISTEN,
  SUP_WHISPER,
  SUP_BARGE,
  SUP_TAKE,
  EV_HOLD,
  EV_UNHOLD,
  EV_SUPERVISION_END,
  KIND_INTERNAL,
  KIND_OFF_CAMPAIGN,
  INTERNAL_NUMBER,
  normaliseSupervisionSettings,
  supervisorIdentity,
  adminIdFromIdentity,
  conferenceNameForAttempt,
  bridgeMode,
  repConferenceAttrs,
  prospectParticipantParams,
  startSupervisionPlan,
  supervisorConferenceAttrs,
  participantUpdateForKind,
  changeSupervisionPlan,
  takePlan,
  endSupervisionPlan,
  repNotice,
  holdPlan,
  conferenceEndPlan,
  participantLeavePlan,
  prospectStatusPlan,
  internalCallPlan,
  offCampaignPlan,
  clockText,
} from "@/lib/sales/calls/supervision";
import { channelSpeakers } from "@/lib/sales/calls/recording";
import { monoWav, silenceRanges, splitWavChannels } from "@/lib/sales/calls/wavChannels";
import { holdRangesFor } from "@/lib/sales/calls/transcribe";
import { prospectDialsOnly, onlyProspectDials, excludingTestDials } from "@/lib/sales/testLines";
import { supervisionFigures } from "@/lib/sales/calls/reporting";
import { dialTableRow } from "@/lib/sales/calls/dialTable";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

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
const section = (h) => console.log(`\n${h}\n`);

const NOW = new Date("2026-09-21T15:00:00Z");
const ROW = {
  id: "att1",
  salesRepId: "rep1",
  kind: "prospect",
  direction: "out",
  endedAt: null,
  providerCallSid: "CApros",
  repCallSid: "CArep",
  conferenceName: "fq_call_att1",
  conferenceSid: null,
  heldAt: null,
  holdSeconds: null,
  supervisedBy: null,
  supervisionKind: null,
  supervisionSeconds: null,
  supervisorCallSid: null,
  supervisedAt: null,
  toE164: "+16135550100",
  fromE164: "+17163713895",
};
const ON = { enabled: true, tellRepOnListen: true, holdMusicUrl: null };

// ═══════════════════════════════════════════════════════════════════════════
section("1. The setting is off unless a literal true");
// ═══════════════════════════════════════════════════════════════════════════
ok("default is off", DEFAULT_SUPERVISION_SETTINGS.enabled === false && normaliseSupervisionSettings(undefined).enabled === false);
ok("the key is sales.supervision", SUPERVISION_SETTING_KEY === "sales.supervision");
for (const hostile of ["true", "yes", 1, [], "on", { enabled: "true" }, { enabled: 1 }, null]) {
  ok(`${JSON.stringify(hostile)} does not switch it on`, normaliseSupervisionSettings(hostile).enabled === false);
}
ok("a literal true does", normaliseSupervisionSettings({ enabled: true }).enabled === true);
ok("tellRepOnListen defaults ON and only a literal false turns it off", normaliseSupervisionSettings({}).tellRepOnListen === true && normaliseSupervisionSettings({ tellRepOnListen: "no" }).tellRepOnListen === true && normaliseSupervisionSettings({ tellRepOnListen: false }).tellRepOnListen === false);
ok("hold music must be https", normaliseSupervisionSettings({ holdMusicUrl: "http://x/y.mp3" }).holdMusicUrl === null && normaliseSupervisionSettings({ holdMusicUrl: "https://x/y.mp3" }).holdMusicUrl === "https://x/y.mp3");
ok("hold music with a quote or angle bracket is refused", normaliseSupervisionSettings({ holdMusicUrl: 'https://x/y"onload' }).holdMusicUrl === null);

// ═══════════════════════════════════════════════════════════════════════════
section("2. The bridge's mode");
// ═══════════════════════════════════════════════════════════════════════════
ok("off → plain bridge", bridgeMode({ settings: { enabled: false }, attempt: ROW }).conference === false);
ok("on + prospect → conference named from the attempt", (() => { const m = bridgeMode({ settings: ON, attempt: ROW }); return m.conference === true && m.conferenceName === "fq_call_att1"; })());
ok("on + internal → never a conference", bridgeMode({ settings: ON, attempt: { ...ROW, kind: KIND_INTERNAL } }).conference === false);
ok("on + off-campaign → conference (it is a prospect-shaped call)", bridgeMode({ settings: ON, attempt: { ...ROW, kind: KIND_OFF_CAMPAIGN } }).conference === true);
ok("a hostile attempt id makes no room", bridgeMode({ settings: ON, attempt: { ...ROW, id: "x y/z" } }).conference === false && conferenceNameForAttempt("../x") === null);
ok("the room's prefix differs from a transfer's", conferenceNameForAttempt("a").startsWith("fq_call_") && !conferenceNameForAttempt("a").startsWith("fq_xfer_"));
{
  const attrs = repConferenceAttrs({ origin: "https://x", attemptId: "att1", conferenceName: "fq_call_att1" });
  ok("the rep's leg does NOT end the room on exit (take needs it to stay)", attrs.endConferenceOnExit === false && attrs.startConferenceOnEnter === true);
  ok("…and reports join/leave/end to the conference route", attrs.statusCallback.includes("/api/rep-dial/conference?attemptId=att1") && attrs.statusCallbackEvent === "join leave end");
  const p = prospectParticipantParams({ attempt: ROW, origin: "https://x", ringSeconds: 30 });
  ok("the prospect's participant is recorded dual, ends the room on exit, hears early media", p.record === true && p.recordingChannels === "dual" && p.endConferenceOnExit === true && p.earlyMedia === true);
  ok("…and its status callback is the same status route as a plain bridge", p.statusCallback === "https://x/api/rep-dial/status?attemptId=att1" && p.statusCallbackEvent.includes("completed"));
  ok("no from number → no participant", prospectParticipantParams({ attempt: { ...ROW, fromE164: null }, origin: "https://x" }) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Starting supervision");
// ═══════════════════════════════════════════════════════════════════════════
const start = (over = {}, kind = SUP_LISTEN, settings = ON, adminId = "adm1") => startSupervisionPlan({ attempt: { ...ROW, ...over }, adminId, kind, settings, now: NOW });
ok("off → refused, code disabled", start({}, SUP_LISTEN, { enabled: false }).code === "disabled");
ok("no admin → refused", start({}, SUP_LISTEN, ON, null).code === "who");
ok("a made-up kind → refused", start({}, "spy").code === "kind");
ok("ended call → refused", start({ endedAt: NOW }).code === "ended");
ok("no conference (a plain bridge) → refused in words that say so", start({ conferenceName: null }).code === "no_conference");
ok("no rep leg → refused", start({ repCallSid: null }).code === "no_rep_leg");
ok("somebody else's → refused", start({ supervisedBy: "adm2" }).code === "taken");
ok("my own, again → allowed (a reconnect)", start({ supervisedBy: "adm1", supervisedAt: NOW, supervisionKind: SUP_LISTEN }).ok === true);
ok("already taken by me → refused", start({ supervisedBy: "adm1", supervisionKind: SUP_TAKE }).code === "already_taken");
{
  const p = start({}, SUP_WHISPER);
  ok("allowed: the lock names the admin, the kind and the time", p.ok && p.lock.supervisedBy === "adm1" && p.lock.supervisionKind === SUP_WHISPER && p.lock.supervisedAt === NOW && p.event === "WHISPER");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. What each kind does to the supervisor's leg — rendered TwiML");
// ═══════════════════════════════════════════════════════════════════════════
function render(kind) {
  const attrs = supervisorConferenceAttrs({ attempt: { ...ROW, supervisedBy: "adm1", supervisionKind: kind }, origin: "https://x" });
  const { name, ...conf } = attrs;
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.dial().conference(conf, name);
  return { attrs, xml: twiml.toString() };
}
{
  const l = render(SUP_LISTEN);
  ok("listen: coach = the rep's leg, muted", l.attrs.coach === "CArep" && l.attrs.muted === true && /coach="CArep"/.test(l.xml) && /muted="true"/.test(l.xml));
  const w = render(SUP_WHISPER);
  ok("whisper: coach = the rep's leg, NOT muted", w.attrs.coach === "CArep" && w.attrs.muted === false && /coach="CArep"/.test(w.xml) && /muted="false"/.test(w.xml));
  const b = render(SUP_BARGE);
  ok("barge: no coach, not muted", b.attrs.coach === undefined && b.attrs.muted === false && !/coach=/.test(b.xml));
  ok("every kind: never starts the room, never ends it, no beep", [l, w, b].every((r) => r.attrs.startConferenceOnEnter === false && r.attrs.endConferenceOnExit === false && r.attrs.beep === false));
  ok("every kind joins the attempt's own room", [l, w, b].every((r) => r.xml.includes(">fq_call_att1<")));
  ok("no rep leg → nothing to render", supervisorConferenceAttrs({ attempt: { ...ROW, repCallSid: null }, origin: "https://x" }) === null);
}
ok("REST updates: listen coaching+muted, whisper coaching+unmuted, barge coaching off", (() => {
  const l = participantUpdateForKind(SUP_LISTEN, "CArep");
  const w = participantUpdateForKind(SUP_WHISPER, "CArep");
  const b = participantUpdateForKind(SUP_BARGE, "CArep");
  return l.coaching && l.muted && l.callSidToCoach === "CArep" && w.coaching && !w.muted && !b.coaching && !b.muted && participantUpdateForKind(SUP_LISTEN, null) === null;
})());
{
  const inRoom = { ...ROW, supervisedBy: "adm1", supervisionKind: SUP_LISTEN, supervisorCallSid: "CAsup", supervisedAt: NOW };
  ok("mode change: not mine → refused", changeSupervisionPlan({ attempt: inRoom, adminId: "adm2", kind: SUP_BARGE }).code === "not_yours");
  ok("mode change: leg not in yet → refused", changeSupervisionPlan({ attempt: { ...inRoom, supervisorCallSid: null }, adminId: "adm1", kind: SUP_BARGE }).code === "not_joined");
  ok("mode change: to take is not a mode", changeSupervisionPlan({ attempt: inRoom, adminId: "adm1", kind: SUP_TAKE }).code === "kind");
  ok("mode change: same kind is a no-op", changeSupervisionPlan({ attempt: inRoom, adminId: "adm1", kind: SUP_LISTEN }).code === "same");
  ok("mode change: listen → whisper unmutes and keeps coaching", (() => { const p = changeSupervisionPlan({ attempt: inRoom, adminId: "adm1", kind: SUP_WHISPER }); return p.ok && p.update.coaching === true && p.update.muted === false && p.event === "WHISPER"; })());
  ok("mode change after take → refused", changeSupervisionPlan({ attempt: { ...inRoom, supervisionKind: SUP_TAKE }, adminId: "adm1", kind: SUP_LISTEN }).code === "taken");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Take the call");
// ═══════════════════════════════════════════════════════════════════════════
{
  const inRoom = { ...ROW, supervisedBy: "adm1", supervisionKind: SUP_BARGE, supervisorCallSid: "CAsup", supervisedAt: NOW };
  ok("refused until the supervisor's leg is in", takePlan({ attempt: { ...inRoom, supervisorCallSid: null }, adminId: "adm1" }).code === "not_joined");
  ok("refused for somebody else", takePlan({ attempt: inRoom, adminId: "adm2" }).code === "not_yours");
  ok("refused twice", takePlan({ attempt: { ...inRoom, supervisionKind: SUP_TAKE }, adminId: "adm1" }).code === "already_taken");
  const p = takePlan({ attempt: inRoom, adminId: "adm1" });
  const types = p.actions.map((a) => a.type);
  ok("the row is marked take BEFORE the rep is hung up", p.ok && types.indexOf("mark") < types.indexOf("hangupRep") && p.actions[0].kind === SUP_TAKE);
  ok("the supervisor is unmuted before the rep goes", types.indexOf("unmuteSupervisor") < types.indexOf("hangupRep"));
  ok("a held prospect is unheld before the rep goes", (() => { const h = takePlan({ attempt: { ...inRoom, heldAt: NOW }, adminId: "adm1" }); const t = h.actions.map((a) => a.type); return t.includes("unholdProspect") && t.indexOf("unholdProspect") < t.indexOf("hangupRep"); })());
  ok("…and not when they are not held", !types.includes("unholdProspect"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Hold");
// ═══════════════════════════════════════════════════════════════════════════
const hold = (over = {}, on = true, repId = "rep1", settings = ON, now = NOW) => holdPlan({ attempt: { ...ROW, ...over }, repId, hold: on, settings, now });
ok("not a boolean → refused", holdPlan({ attempt: ROW, repId: "rep1", hold: "yes" }).code === "which");
ok("somebody else's call → refused", hold({}, true, "rep2").code === "not_yours");
ok("ended → refused", hold({ endedAt: NOW }).code === "ended");
ok("a colleague call → refused (mute instead)", hold({ kind: KIND_INTERNAL }).code === "internal");
ok("a plain bridge → refused, and says it is not in a conference", hold({ conferenceName: null }).code === "no_conference");
ok("not connected yet → refused", hold({ providerCallSid: null }).code === "not_connected");
ok("taken by a supervisor → refused", hold({ supervisionKind: SUP_TAKE, supervisedBy: "adm1" }).code === "taken");
ok("already held → hold refused", hold({ heldAt: NOW }, true).code === "already_held");
ok("not held → resume refused", hold({}, false).code === "not_held");
{
  const h = hold();
  ok("hold: participant hold=true, heldAt written, HOLD event, no music URL by default", h.ok && h.participant.hold === true && !("holdUrl" in h.participant) && h.data.heldAt === NOW && h.event === EV_HOLD);
  const hm = hold({}, true, "rep1", { ...ON, holdMusicUrl: "https://x/h.mp3" });
  ok("hold: the platform's music URL rides when set", hm.participant.holdUrl === "https://x/h.mp3");
  const later = new Date(NOW.getTime() + 42_000);
  const u = hold({ heldAt: NOW, holdSeconds: 10 }, false, "rep1", ON, later);
  ok("resume: participant hold=false, 42 s added to 10, UNHOLD event with the seconds", u.ok && u.participant.hold === false && u.data.heldAt === null && u.data.holdSeconds === 52 && u.event === EV_UNHOLD && u.seconds === 42);
  ok("clockText prints m:ss", clockText(42) === "0:42" && clockText(125) === "2:05" && clockText(-3) === "0:00" && clockText("x") === "0:00");
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Who left, and whether the room ends");
// ═══════════════════════════════════════════════════════════════════════════
{
  const inRoom = { ...ROW, supervisedBy: "adm1", supervisionKind: SUP_LISTEN, supervisorCallSid: "CAsup", supervisedAt: NOW };
  ok("the rep leaves → end the room", participantLeavePlan({ attempt: inRoom, callSid: "CArep" }).endConference === true);
  ok("the rep leaves after a TAKE → keep the room", participantLeavePlan({ attempt: { ...inRoom, supervisionKind: SUP_TAKE }, callSid: "CArep" }).endConference === false);
  ok("the supervisor leaves → keep the room, close their stint", (() => { const p = participantLeavePlan({ attempt: inRoom, callSid: "CAsup" }); return p.endConference === false && p.supervisorLeft === true; })());
  ok("a stranger's leg → nothing", (() => { const p = participantLeavePlan({ attempt: inRoom, callSid: "CAxyz" }); return !p.endConference && !p.supervisorLeft && !p.repLeft; })());
  ok("no-answer / busy / failed / completed on the prospect leg end the room", ["no-answer", "busy", "failed", "completed", "canceled"].every((s) => prospectStatusPlan({ attempt: ROW, status: s }).endConference));
  ok("ringing / answered do not", ["ringing", "answered", "in-progress"].every((s) => !prospectStatusPlan({ attempt: ROW, status: s }).endConference));
  ok("a plain bridge is never ended by this", prospectStatusPlan({ attempt: { ...ROW, conferenceName: null }, status: "completed" }).endConference === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The end of the room closes what is open");
// ═══════════════════════════════════════════════════════════════════════════
{
  const later = new Date(NOW.getTime() + 90_000);
  const open = { ...ROW, heldAt: NOW, holdSeconds: 5, supervisedBy: "adm1", supervisionKind: SUP_WHISPER, supervisedAt: new Date(NOW.getTime() - 30_000), supervisionSeconds: 100, supervisorCallSid: "CAsup" };
  const p = conferenceEndPlan({ attempt: open, now: later });
  ok("hold closed: 90 s added", p.data.heldAt === null && p.data.holdSeconds === 95);
  ok("supervision closed: 120 s added, lock released, kind KEPT", p.data.supervisedBy === null && p.data.supervisionSeconds === 220 && p.data.supervisorCallSid === null && !("supervisionKind" in p.data));
  ok("two events: UNHOLD by the rep, SUPERVISION_END by the admin, each with seconds", p.events.length === 2 && p.events[0].event === EV_UNHOLD && p.events[0].salesRepId === "rep1" && p.events[0].seconds === 90 && p.events[1].event === EV_SUPERVISION_END && p.events[1].platformAdminId === "adm1" && p.events[1].seconds === 120);
  ok("nothing open → nothing written", conferenceEndPlan({ attempt: ROW, now: later }).data === null && conferenceEndPlan({ attempt: ROW }).events.length === 0);
  ok("endSupervisionPlan is idempotent on a released row", endSupervisionPlan({ attempt: ROW }).changed === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. What the rep is told, and the prospect never");
// ═══════════════════════════════════════════════════════════════════════════
{
  const sup = (kind) => ({ ...ROW, supervisedBy: "adm1", supervisionKind: kind, supervisedAt: NOW });
  ok("barge is said whatever the setting", repNotice({ attempt: sup(SUP_BARGE), settings: { ...ON, tellRepOnListen: false }, supervisorName: "Emilio" })?.audible === true);
  ok("take is said whatever the setting", repNotice({ attempt: sup(SUP_TAKE), settings: { ...ON, tellRepOnListen: false } })?.kind === SUP_TAKE);
  ok("listen is said only when the setting says so", repNotice({ attempt: sup(SUP_LISTEN), settings: ON })?.kind === SUP_LISTEN && repNotice({ attempt: sup(SUP_LISTEN), settings: { ...ON, tellRepOnListen: false } }) === null);
  ok("whisper likewise", repNotice({ attempt: sup(SUP_WHISPER), settings: { ...ON, tellRepOnListen: false } }) === null);
  ok("nobody on the call → nothing", repNotice({ attempt: ROW, settings: ON }) === null);
  ok("the name is carried, trimmed", repNotice({ attempt: sup(SUP_BARGE), settings: ON, supervisorName: "  Emilio " }).name === "Emilio");
  const bridge = read("app/api/rep-dial/bridge/route.js");
  ok("the bridge never <Say>s anything on the prospect's participant (no announcement to them)", !/participants\.create\([^)]*say/i.test(bridge) && !/prospectParticipantParams[\s\S]{0,400}twiml\.say/.test(read("lib/sales/calls/supervision.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. Internal and off-campaign");
// ═══════════════════════════════════════════════════════════════════════════
{
  const me = { id: "rep1", canCallColleagues: true, canCallOffCampaign: true };
  const her = { id: "rep2", active: true };
  ok("internal: allowed when reachable", internalCallPlan({ rep: me, colleague: her, reachable: true }).ok === true);
  ok("internal: refused without the privilege", internalCallPlan({ rep: { ...me, canCallColleagues: false }, colleague: her, reachable: true }).code === "not_allowed");
  ok("internal: refused for yourself", internalCallPlan({ rep: me, colleague: { id: "rep1" }, reachable: true }).code === "self");
  ok("internal: refused when not reachable", internalCallPlan({ rep: me, colleague: her, reachable: false }).code === "unreachable");
  ok("internal: refused for a closed account", internalCallPlan({ rep: me, colleague: { ...her, active: false }, reachable: true }).code === "inactive");
  ok("the internal sentinel is not a phone number", INTERNAL_NUMBER === "internal" && !/^\+/.test(INTERNAL_NUMBER));
  ok("off-campaign: refused without the privilege (the default)", offCampaignPlan({ rep: { id: "rep1" }, typed: "613 555 0100", country: "CA", province: "ON" }).code === "not_allowed");
  ok("off-campaign: a non-number is refused", offCampaignPlan({ rep: me, typed: "hello", country: "CA", province: "ON" }).code === "number");
  ok("off-campaign: our own number is refused", offCampaignPlan({ rep: me, typed: "+17163713895", country: "US", province: "NY", ownNumbers: ["+17163713895"] }).code === "own_number");
  ok("off-campaign: no location → refused (no state inferred from an area code)", offCampaignPlan({ rep: me, typed: "+16135550100" }).code === "location");
  ok("off-campaign: allowed with a number and a place, normalised", (() => { const p = offCampaignPlan({ rep: me, typed: "(613) 555-0100", country: "CA", province: "ON" }); return p.ok && p.e164 === "+16135550100"; })());
  ok("identities: supervisor:<id> round-trips and a rep identity is not a supervisor", supervisorIdentity("adm1") === "supervisor:adm1" && adminIdFromIdentity("client:supervisor:adm1") === "adm1" && adminIdFromIdentity("client:sales_rep:rep1") === null && adminIdFromIdentity("client:client:supervisor:adm1") === null && supervisorIdentity("a b") === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. Counting: neither is prospect reach; the cap still counts a real number");
// ═══════════════════════════════════════════════════════════════════════════
{
  const rows = [
    { id: "p", kind: "prospect", jurisdictionCode: "ON" },
    { id: "old", jurisdictionCode: "ON" },
    { id: "i", kind: KIND_INTERNAL, jurisdictionCode: "internal" },
    { id: "o", kind: KIND_OFF_CAMPAIGN, jurisdictionCode: "ON" },
    { id: "t", kind: "prospect", jurisdictionCode: "test" },
  ];
  ok("onlyProspectDials keeps prospect and pre-column rows, drops internal, off-campaign and test", onlyProspectDials(rows).map((r) => r.id).join() === "p,old");
  const where = prospectDialsOnly({ salesRepId: "rep1" });
  ok("prospectDialsOnly ANDs kind=prospect onto the test-dial exclusion", where.salesRepId === "rep1" && where.AND.length === 2 && where.AND[1].kind === "prospect" && JSON.stringify(where.AND[0]) === JSON.stringify(excludingTestDials({}).AND[0]));
  const store = read("lib/sales/calls/store.js");
  const capBody = store.slice(store.indexOf("export async function attemptsLast24h"), store.indexOf("export async function recordDial"));
  ok("the 24-hour cap uses excludingTestDials, NOT the prospect filter", /excludingTestDials\(/.test(capBody) && !/prospectDialsOnly\(/.test(capBody));
  ok("the floor board, the funnel, the performance load, the agency view, the growth model and the badges count prospect dials only", ["lib/sales/calls/floorBoard.js", "lib/sales/funnelData.js", "lib/sales/performanceLoad.js", "lib/sales/agency.js", "lib/platform/growthMeasured.js", "app/api/sales/badges/route.js"].every((p) => /prospectDialsOnly\(/.test(read(p)) && !/excludingTestDials\(/.test(read(p))));
  ok("unloggedWhere never lists a colleague call", /kind: \{ not: KIND_INTERNAL \}/.test(store));
  ok("recordInternalDial writes kind internal and the sentinel", /kind: KIND_INTERNAL,\s*toE164: INTERNAL_NUMBER/.test(store));
  const f = supervisionFigures([{ supervisionKind: "listen", supervisionSeconds: 30 }, { supervisionKind: "take" }, { supervisionKind: null }, {}]);
  ok("supervisionFigures: 2 calls, by kind, seconds over the measured one", f.calls === 2 && f.byKind.listen === 1 && f.byKind.take === 1 && f.seconds === 30 && f.measuredOf === 1);
  const table = dialTableRow([
    { id: "a", direction: "out", dialChannel: "browser", providerCallSid: "CA1", providerStatus: "completed", talkSeconds: 70, answeredAt: NOW, holdSeconds: 90, supervisionKind: "whisper", disposition: "reached_interested" },
    { id: "b", direction: "out", dialChannel: "browser", providerCallSid: "CA2", providerStatus: "no-answer", talkSeconds: 0, holdSeconds: null },
  ], { now: NOW });
  ok("dialTableRow: minutes on hold, held calls and supervised calls", table.minutesOnHold === 2 && table.heldCalls === 1 && table.supervisedCalls === 1 && table.holdSeconds === 90);
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. The recording in conference mode");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("a conference row reads contractor first, rep second", channelSpeakers({ direction: "out", channels: 2, conference: true }).join() === "contractor,rep");
  ok("a plain outbound bridge is unchanged: rep first", channelSpeakers({ direction: "out", channels: 2 }).join() === "rep,contractor");
  ok("mono is still unknown", channelSpeakers({ direction: "out", channels: 1, conference: true }).join() === "unknown");
  const t0 = "2026-09-21T15:00:00Z";
  const ev = (e, s) => ({ event: e, at: new Date(new Date(t0).getTime() + s * 1000).toISOString() });
  const ranges = holdRangesFor({ events: [ev(EV_HOLD, 10), ev(EV_UNHOLD, 15), ev("LISTEN", 20), ev(EV_HOLD, 30)], answeredAt: t0, endSeconds: 40 });
  ok("hold ranges from the events: [10,15] and an open hold to the end", JSON.stringify(ranges) === JSON.stringify([{ start: 10, end: 15 }, { start: 30, end: 40 }]));
  ok("no answeredAt → no ranges", holdRangesFor({ events: [ev(EV_HOLD, 1)], answeredAt: null }).length === 0);
  ok("an UNHOLD without a HOLD is ignored", holdRangesFor({ events: [ev(EV_UNHOLD, 5)], answeredAt: t0 }).length === 0);
  // 2 seconds of 8 kHz "noise" (value 1000), silence seconds 0.5–1.0.
  const pcm = Buffer.alloc(16000 * 2);
  for (let i = 0; i < 16000; i += 1) pcm.writeInt16LE(1000, i * 2);
  const wav = monoWav(pcm, 8000);
  const out = silenceRanges(wav, [{ start: 0.5, end: 1.0 }], 8000);
  ok("silenceRanges zeroes exactly the range (sample 4000..7999) and nothing else", out.readInt16LE(44 + 3999 * 2) === 1000 && out.readInt16LE(44 + 4000 * 2) === 0 && out.readInt16LE(44 + 7999 * 2) === 0 && out.readInt16LE(44 + 8000 * 2) === 1000 && out.length === wav.length);
  ok("…and does not touch the original", wav.readInt16LE(44 + 5000 * 2) === 1000);
  ok("…and survives a re-split", splitWavChannels(out).ok === true);
  const tr = read("lib/sales/calls/transcribe.js");
  ok("the transcriber blanks hold ranges on the REP track only, and only for conference rows", /speaker === "rep" && holdRanges\.length \? silenceRanges/.test(tr) && /if \(attempt\.conferenceName\)/.test(tr));
}

// ═══════════════════════════════════════════════════════════════════════════
section("13. The routes, on the source");
// ═══════════════════════════════════════════════════════════════════════════
{
  const bridge = read("app/api/rep-dial/bridge/route.js");
  ok("the bridge reads the supervisor's mode from the ROW (supervisorConferenceAttrs over the attempt), never from a request parameter", /supervisorConferenceAttrs\(\{ attempt: row/.test(bridge) && !/params\.kind|params\.mode/.test(bridge));
  ok("the bridge refuses a supervisor leg for a row that does not name that admin", /row\.supervisedBy !== supervisorId/.test(bridge));
  ok("the bridge records the supervisor's CallSid from the signed webhook", /recordSupervisorLeg\(\{ attemptId: row\.id, adminId: supervisorId, callSid: params\.CallSid/.test(bridge));
  ok("the bridge reads the setting in the request (loadSupervisionSettings), not from the browser", /bridgeMode\(\{ settings: await loadSupervisionSettings\(\)/.test(bridge));
  ok("an internal call dials <Client> at the colleague's identity from the row", /attempt\.kind === KIND_INTERNAL/.test(bridge) && /repIdentity\(attempt\.internalToRepId\)/.test(bridge) && /dial\.client\(/.test(bridge));
  const plat = read("app/api/platform/sales/supervision/route.js");
  ok("the platform route is superadmin-only, checked in its own gate on GET and POST", /admin\.role !== "superadmin"/.test(plat) && (plat.match(/await gate\(request\)/g) || []).length >= 2);
  ok("start claims the lock conditionally (claimSupervision) before the browser connects", /claimSupervision\(/.test(plat) && /claimed\.claimed/.test(plat));
  ok("take starts as barge on the row", /supervisionKind: "barge"/.test(plat));
  ok("every action writes a SalesCallEvent and an audit row", (plat.match(/recordCallEvent\(/g) || []).length >= 4 && (plat.match(/await audit\(/g) || []).length >= 4);
  const storeSrc = read("lib/sales/calls/supervisionStore.js");
  ok("the lock is a conditional updateMany on supervisedBy null-or-mine", /OR: \[\{ supervisedBy: null \}, \{ supervisedBy: adminId \}\]/.test(storeSrc));
  const repRoute = read("app/api/sales/calls/conference/route.js");
  ok("the rep-side route is behind requireCallingRep and scopes to the rep's own attempt", /requireCallingRep\(request\)/.test(repRoute) && /attempt\.salesRepId !== rep\.id/.test(repRoute));
  const conf = read("app/api/rep-dial/conference/route.js");
  const status = read("app/api/rep-dial/status/route.js");
  ok("the conference and status webhooks answer through twilioAck (no 204 with a body)", /acknowledged\(/.test(conf) && /noContent\(\)/.test(conf) && !/status: 204/.test(conf) && /prospectStatusPlan/.test(status));
  const token = read("app/api/platform/sales/supervision/token/route.js");
  ok("the supervisor token is dial-out only and refused while the setting is off", /incomingAllow: false/.test(token) && /settings\.enabled/.test(token));
  const settings = read("app/api/platform/sales/supervision/settings/route.js");
  ok("the settings PUT is superadmin-only and audited", /superadminOrRefusal/.test(settings) && /sales_supervision_settings_updated/.test(settings));
  const floor = read("app/platform/sales/floor/page.js");
  ok("the floor draws the buttons only when supervision is on and the row is supervisable, and says why otherwise", /supervisionOn && rep\.liveCall\.supervisable/.test(floor) && /Supervision is off/.test(floor));
  const strip = read("app/components/sales/LiveCallStrip.js");
  ok("the rep's Hold button is drawn only when the server says canHold", /state\.canHold \?/.test(strip));
  const gate = read("lib/sales/calls/gate.js");
  ok("the gate reads both privileges fresh per request", /canCallColleagues: true/.test(gate) && /canCallOffCampaign: true/.test(gate));
  const calls = read("app/api/sales/calls/outside/route.js");
  ok("the outside-queue route is behind requireCallingRep and refuses over a live call", /requireCallingRep\(request\)/.test(calls) && /liveCallFor\(rep\.id/.test(calls));
  ok("the off-campaign dial still runs suppression, own numbers, the window and the cap", /offCampaignPlan\(/.test(calls) && /firstSuppression\(db, \{ channel: "phone", phones: \[plan\.e164\] \}\)/.test(calls) && /attemptsLast24h\(plan\.e164/.test(calls) && /salesCallReadiness\(\{\s*prospect: \{ country, province \}/.test(calls));
  ok("the internal dial refuses without the privilege and for an unreachable colleague", /internalCallPlan\(\{ rep, colleague, reachable/.test(calls));
  ok("the main dial route is untouched by either kind (its source-order checks still read it)", !/offCampaign|internalToRepId/.test(read("app/api/sales/calls/route.js")));
  ok("the People card posts to the outside-queue route", /\/api\/sales\/calls\/outside/.test(read("app/components/sales/PeopleCard.js")));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
