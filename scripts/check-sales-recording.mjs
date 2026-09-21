// scripts/check-sales-recording.mjs
//
// Every sales call is recorded, and the rep says so — inside the opener.
//
// Executes the pure pieces against synthetic input: the webhook parser, the
// WAV splitter, the track merge, the speaker map, the disclosure aside and
// the weave that puts it into every opener, old or new. Then the wiring the
// check can only read.
//
//   npm run check:sales-recording
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  DIAL_RECORDING,
  CONFERENCE_RECORDING,
  dialRecordingAttrs,
  conferenceRecordingAttrs,
  recordingFromWebhook,
  channelSpeakers,
  twilioMediaAuth,
  transcriptToText,
} from "@/lib/sales/calls/recording";
import { splitWavChannels, monoWav, isSilentWav } from "@/lib/sales/calls/wavChannels";
import { mergeTracks, transcriptionCostMicros } from "@/lib/sales/calls/transcribe";
import { callPlan } from "@/lib/sales/calls/browserDial";
import { CALL_ALLOWED } from "@/lib/sales/callingRules";
import { callerConferenceTwiml, conferenceJoinTwiml } from "@/lib/sales/calls/transferRest";
import { RECORDING_ASIDE, recordingDisclosureFor, carriesDisclosure, weaveDisclosure } from "@/lib/sales/playbook/recordingDisclosure";
import { OPENER, seedPlaybooks } from "@/lib/sales/playbook/defaults";
import { CALL_SCRIPT_STYLE_EXAMPLE } from "@/lib/sales/intel/callScript";
import { recordingsCsv } from "@/lib/sales/calls/recordingsList";
import { recordCallRecording } from "@/lib/sales/calls/store";
import { acknowledged, noContent } from "@/lib/sales/calls/twilioAck";
import { answeredAtFrom } from "@/lib/sales/calls/providerStatus";
import { recordingFromResource, legColumnsFromCall, pickProspectLeg, reconcileRecordings, reconcileProspectLegs } from "@/lib/sales/calls/reconcileProvider";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`); }
}
const section = (t) => console.log(`\n${t}\n`);
const ORIGIN = "https://www.example.test";
const SID = "RE" + "0".repeat(31) + "1";

section("1. The attributes, and where they land");
{
  const a = dialRecordingAttrs({ origin: ORIGIN, attemptId: "att 1" });
  ok("a <Dial> records dual-channel from answer", a.record === DIAL_RECORDING && DIAL_RECORDING === "record-from-answer-dual");
  ok("…and posts the finished file to /api/rep-dial/recording with the attempt id", a.recordingStatusCallback === `${ORIGIN}/api/rep-dial/recording?attemptId=att%201`);
  ok("…on completion only", a.recordingStatusCallbackEvent === "completed" && a.recordingStatusCallbackMethod === "POST");
  ok("a dial with a transfer id carries that instead", dialRecordingAttrs({ origin: ORIGIN, transferId: "tr1" }).recordingStatusCallback.endsWith("?transferId=tr1"));
  const none = dialRecordingAttrs({ origin: ORIGIN });
  ok("a dial with neither still records and posts to the bare URL", none.record === DIAL_RECORDING && none.recordingStatusCallback === `${ORIGIN}/api/rep-dial/recording`);
  ok("a conference records from start", conferenceRecordingAttrs({ origin: ORIGIN, transferId: "tr1" }).record === CONFERENCE_RECORDING);
  ok("in supervision mode the contractor's participant is recorded dual on its own leg, posting to the same recording route", (() => {
    const src = read("lib/sales/calls/supervision.js");
    return /record: true,\s*recordingChannels: "dual",\s*recordingTrack: "both"/.test(src) && /recordingCallbackUrl\(\{ origin, attemptId: attempt\.id \}\)/.test(read("app/api/rep-dial/bridge/route.js"));
  })());

  for (const route of ["app/api/rep-dial/bridge/route.js", "app/api/rep-dial/inbound/route.js"]) {
    const src = read(route);
    // A <Dial><Conference> in the bridge (2026-09-21, supervision mode) is
    // NOT recorded on the <Dial>: the contractor's participant is recorded
    // dual on its own leg (lib/sales/calls/supervision.js
    // prospectParticipantParams, asserted below), and the supervisor's leg
    // is never recorded at all. Those two dials are counted apart.
    const dials = src.split("twiml.dial(").length - 1;
    const conferenceDials = (src.match(/\.conference\(conf, name\)/g) || []).length;
    const spread = (src.match(/\.\.\.dialRecordingAttrs\(/g) || []).length;
    ok(`${route}: every <Dial> that is not a <Conference> (${dials - conferenceDials}) carries the recording attributes`, dials > 0 && spread === dials - conferenceDials, { dials, conferenceDials, spread });
    ok(`${route}: no environment variable decides it`, !/process\.env\.[A-Z_]*RECORD/.test(src));
  }
  ok("both conference documents carry the recording attributes", (read("lib/sales/calls/transferRest.js").match(/\.\.\.conferenceRecordingAttrs\(/g) || []).length === 2);
  const caller = callerConferenceTwiml({ transfer: { id: "tr1", conferenceName: "room" }, origin: ORIGIN }).toString();
  ok("the caller's conference XML says record-from-start", /record="record-from-start"/.test(caller), caller);
  ok("…and names the recording callback with the transfer", /recordingStatusCallback="[^"]*transferId=tr1"/.test(caller));
  ok("the rep's conference XML says the same", /record="record-from-start"/.test(conferenceJoinTwiml({ plan: { join: true, say: [] }, conferenceName: "room", origin: ORIGIN, transferId: "tr1" }).toString()));
  const plan = callPlan({ toE164: "+15005550006", readiness: { decision: CALL_ALLOWED }, callerNumbers: ["+15005550001"] });
  ok("callPlan says record: true on a call it allows", plan.ok === true && plan.record === true, plan);
  ok("…and false on one it refuses", callPlan({ toE164: "nope" }).record === false);
}

section("2. The webhook body, read defensively");
{
  const good = { RecordingSid: SID, RecordingUrl: `https://api.twilio.com/2010-04-01/Accounts/AC0/Recordings/${SID}`, RecordingStatus: "completed", RecordingDuration: "63", RecordingChannels: "2", CallSid: "CA0" };
  const r = recordingFromWebhook(good);
  ok("a completed recording is read", r && r.sid === SID && r.seconds === 63 && r.channels === 2 && r.callSid === "CA0");
  ok("…with the url stored without an extension", recordingFromWebhook({ ...good, RecordingUrl: `${good.RecordingUrl}.wav` }).url === good.RecordingUrl);
  ok("an in-progress event is ignored", recordingFromWebhook({ ...good, RecordingStatus: "in-progress" }) === null);
  ok("a sid that is not a sid is ignored", recordingFromWebhook({ ...good, RecordingSid: "RE'; drop table" }) === null);
  ok("a url off twilio.com is ignored", recordingFromWebhook({ ...good, RecordingUrl: "https://evil.example/x" }) === null);
  ok("a duration that is not a number is null, not zero", recordingFromWebhook({ ...good, RecordingDuration: "abc" }).seconds === null);
  ok("three channels is not a thing", recordingFromWebhook({ ...good, RecordingChannels: "3" }).channels === null);
  ok("an empty body is null", recordingFromWebhook({}) === null && recordingFromWebhook() === null);
}

section("3. Splitting the tracks");
{
  const rate = 8000, frames = rate;
  const pcm = Buffer.alloc(frames * 4);
  for (let f = 0; f < frames; f += 1) { pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * f) / rate) * 12000), f * 4); pcm.writeInt16LE(0, f * 4 + 2); }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "ascii"); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8, "ascii"); h.write("fmt ", 12, "ascii"); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write("data", 36, "ascii"); h.writeUInt32LE(pcm.length, 40);
  const stereo = Buffer.concat([h, pcm]);
  const s = splitWavChannels(stereo);
  ok("a stereo file splits into two", s.ok && s.channels.length === 2 && s.sampleRate === rate, s.reason);
  ok("…each a second long", s.ok && Math.abs(s.seconds - 1) < 0.001, s.seconds);
  ok("…the left carries the tone", s.ok && !isSilentWav(s.channels[0]));
  ok("…and the right is silent", s.ok && isSilentWav(s.channels[1]));
  ok("a split track is itself a mono WAV", s.ok && splitWavChannels(s.channels[0]).ok && splitWavChannels(s.channels[0]).channels.length === 1);
  ok("garbage is refused in words", splitWavChannels(Buffer.from("not audio at all, sorry, not even close to 44 bytes of it")).ok === false);
  ok("a short buffer is refused", splitWavChannels(Buffer.alloc(10)).ok === false);
  ok("a non-buffer is refused", splitWavChannels("string").ok === false);
  const eight = Buffer.from(stereo); eight.writeUInt16LE(8, 34);
  ok("8-bit samples are refused rather than misread", splitWavChannels(eight).ok === false);
  ok("monoWav round-trips", splitWavChannels(monoWav(Buffer.alloc(16), rate)).ok);
}

section("4. Who said what");
{
  ok("outbound: the parent leg is the rep", JSON.stringify(channelSpeakers({ direction: "out", channels: 2 })) === '["rep","contractor"]');
  ok("inbound: the parent leg is the contractor", JSON.stringify(channelSpeakers({ direction: "in", channels: 2 })) === '["contractor","rep"]');
  ok("a mixed track is unknown, never guessed", JSON.stringify(channelSpeakers({ direction: "out", channels: 1 })) === '["unknown"]');
  const merged = mergeTracks([
    { speaker: "rep", segments: [{ start: 0, end: 3, text: "Hi, is that the office?" }, { start: 8, end: 12, text: "Great." }] },
    { speaker: "contractor", segments: [{ start: 3.5, end: 7, text: "Yes, speaking." }, { start: 0, end: 1, text: "   " }] },
  ]);
  ok("segments interleave by time", merged.map((s) => s.speaker).join(",") === "rep,contractor,rep", merged);
  ok("blank segments are dropped", merged.length === 3);
  ok("the flat text says the speaker first", transcriptToText(merged).startsWith("rep: Hi, is that the office?\ncontractor: Yes, speaking."));
  ok("hostile input merges to nothing", mergeTracks(null).length === 0 && mergeTracks([{ segments: "x" }]).length === 0);
  ok("a minute costs 6000 micros", transcriptionCostMicros(60) === 6000 && transcriptionCostMicros(-5) === 0 && transcriptionCostMicros("x") === 0);
}

section("5. Credentials, and the aside inside the opener");
{
  ok("the API key pair is preferred", twilioMediaAuth({ TWILIO_API_KEY_SID: "SK0", TWILIO_API_KEY_SECRET: "s", TWILIO_ACCOUNT_SID: "AC0", TWILIO_AUTH_TOKEN: "t" }) === `Basic ${Buffer.from("SK0:s").toString("base64")}`);
  ok("the account token is the fallback", twilioMediaAuth({ TWILIO_ACCOUNT_SID: "AC0", TWILIO_AUTH_TOKEN: "t" }) === `Basic ${Buffer.from("AC0:t").toString("base64")}`);
  ok("nothing set is null, not a broken header", twilioMediaAuth({}) === null);

  ok("the aside exists in EN, FR and ES", ["en", "fr", "es"].every((l) => typeof RECORDING_ASIDE[l] === "string" && RECORDING_ASIDE[l].length > 10));
  ok("a French call gets the French line", recordingDisclosureFor("fr-CA").language === "fr");
  ok("Ukrainian falls back to English and says so", recordingDisclosureFor("uk").fallback === true);
  ok("the shared rules opener carries the aside", carriesDisclosure(OPENER), OPENER);
  ok("…as a clause after the rep says where from, before the candour line", OPENER.indexOf("from FieldQuo — quick heads-up, this call may be recorded.") > 0 && OPENER.indexOf("recorded") < OPENER.indexOf("out of nowhere"));
  ok("…and so does every seeded playbook's opening line", seedPlaybooks().every((p) => carriesDisclosure(p.stages.find((s) => s.stageKey === "open").say)));
  ok("the style example the model imitates carries the aside", carriesDisclosure(CALL_SCRIPT_STYLE_EXAMPLE));
  const woven = weaveDisclosure("Hi, is that Acme Plumbing? My name's Sam and I'm calling from FieldQuo. I saw your listing. Do you have a minute?", "en");
  ok("the aside is woven after the sentence that says who the rep is", woven.startsWith("Hi, is that Acme Plumbing? My name's Sam and I'm calling from FieldQuo — quick heads-up, this call may be recorded. I saw"), woven);
  ok("…in French for a French script", /petite précision, cet appel peut être enregistré/.test(weaveDisclosure("Bonjour, c'est bien Acme? Je m'appelle Sam, de FieldQuo. J'ai vu votre fiche.", "fr")));
  ok("…in Spanish for a Spanish script", /un aviso rápido, esta llamada puede ser grabada/.test(weaveDisclosure("Hola, ¿hablo con Acme? Me llamo Sam, de FieldQuo. Vi su anuncio.", "es")));
  ok("…and not twice", weaveDisclosure(woven, "en") === woven);
  ok("an opener that already says it in other words is left alone", weaveDisclosure("Hi — this call is being recorded, is that Acme?", "en") === "Hi — this call is being recorded, is that Acme?");
  ok("hostile input is returned as-is", weaveDisclosure(null, "en") === null && weaveDisclosure("", "en") === "");
  ok("the call screen draws NO separate box — the aside lives in the opener", !/RecordingDisclosure/.test(read("app/components/sales/CallPlaybook.js")));
  ok("a stored script's opener is woven as it is read", /weaveDisclosure\(row\.script\.opener/.test(read("app/api/sales/playbook/route.js")));
  ok("a generated opener is woven as it is validated", /opener: weaveDisclosure\(/.test(read("lib/sales/intel/callScript.js")));
  ok("the manual no longer says calls are never recorded", ["en", "fr", "es"].every((l) => !/never recorded|jamais enregistr|nunca se graban/i.test(read(`docs/sales/manual/content.${l}.js`))));
  ok("the not-tracked list no longer lists recording", !/key: "recording"/.test(read("lib/sales/calls/reporting.js")));
}

section("6. The export");
{
  const csv = recordingsCsv([{ id: "a", direction: "out", rep: { name: 'A "Rep" Name', email: "rep@example.test" }, business: { name: "Biz, Inc" }, transcriptText: "rep: hi\ncontractor: yes" }]);
  const lines = csv.split("\r\n");
  ok("a header and one row", lines.length === 2 && lines[0].startsWith("attemptId,direction"));
  ok("quotes, commas and newlines are quoted", lines[1].includes('"A ""Rep"" Name"') && lines[1].includes('"Biz, Inc"') && lines[1].includes('"rep: hi\ncontractor: yes"'));
  ok("an empty list is a header alone", recordingsCsv([]).split("\r\n").length === 1);
}

section("7. Wiring the check can only read");
{
  const hook = read("app/api/rep-dial/recording/route.js");
  ok("the webhook verifies the signature first", hook.indexOf("verifyTwilioWebhook(request)") > -1 && hook.indexOf("verifyTwilioWebhook(request)") < hook.indexOf("recordingFromWebhook("));
  ok("…and transcribes after the reply", /after\(async/.test(hook) && /transcribeAttempt\(/.test(hook));
  const pkg = JSON.parse(read("package.json"));
  ok("check:sales-recording is a script", typeof pkg.scripts["check:sales-recording"] === "string");
  ok("…and check:all runs it", /check:sales-recording\b/.test(pkg.scripts["check:all"]));
  const schema = read("prisma/schema.prisma");
  ok("the columns exist", ["recordingSid", "recordingUrl", "recordingSeconds", "recordingChannels", "transcript ", "transcriptText", "transcribedAt", "transcriptError"].every((c) => schema.includes(`  ${c}`)));
}

section("8. 2026-09-18 — the day nothing filed (both faults, executed)");
{
  // The visible fault: a 204 with a string body is not a Response.
  let threw = null;
  try { new Response("", { status: 204 }); } catch (err) { threw = err; }
  ok("the platform refuses `new Response(\"\", { status: 204 })` — the line every event answered 500 from", threw instanceof TypeError, threw?.message);
  const nc = noContent();
  ok("noContent() is a 204 with a null body", nc.status === 204 && nc.body === null);
  const code = (p) => read(p).split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  const routes = ["app/api/rep-dial/status/route.js", "app/api/rep-dial/recording/route.js", "app/api/rep-dial/transfer/route.js", "app/api/rep-dial/inbound/route.js", "app/api/crew/inbound/route.js", "app/api/sms/inbound/route.js"];
  ok("no route answers a 204 with a string body", routes.every((r) => !/Response\(\s*""\s*,\s*\{\s*status:\s*204/.test(code(r))));
  for (const r of ["app/api/rep-dial/status/route.js", "app/api/rep-dial/recording/route.js"]) {
    ok(`${r}: the whole handler runs inside acknowledged()`, /export async function POST\(request\) \{\s*return acknowledged\(/.test(code(r)));
  }
  ok("inbound?stage=status runs inside acknowledged()", /stage === "status"[\s\S]{0,200}acknowledged\(\(\) => statusStage\(params\)/.test(code("app/api/rep-dial/inbound/route.js")));
  ok("the transfer route's noted() is noContent()", /const noted = \(\) => noContent\(\)/.test(code("app/api/rep-dial/transfer/route.js")));

  // acknowledged(): a throw is a 204, and a good answer passes through.
  const logged = [];
  const log = async (row) => { logged.push(row); };
  const fine = await acknowledged(async () => new Response("<Response/>", { status: 200 }), { area: "sales_dial", what: "x", log });
  ok("acknowledged() returns the handler's own answer", fine.status === 200 && logged.length === 0);
  const crashed = await acknowledged(async () => { throw new Error("boom"); }, { area: "sales_dial", code: "c", what: "A call status for attempt a1", log });
  ok("…and a throw becomes a 204", crashed.status === 204 && crashed.body === null);
  ok("…with the reason on the platform's error log, naming the event", logged.length === 1 && logged[0].area === "sales_dial" && logged[0].code === "c" && /A call status for attempt a1 .*boom/.test(logged[0].message), logged[0]);

  // The silent fault: NOT on a NULL column excluded the one row to update.
  const calls = [];
  const fakeClient = (count, rowWithSid) => ({
    salesCallAttempt: {
      updateMany: async (args) => { calls.push(args.where); return { count }; },
      findFirst: async () => rowWithSid,
    },
    salesRepActivity: {}, salesCallTransfer: { findUnique: async () => null },
  });
  const rec = { sid: SID, url: "https://api.twilio.com/x", seconds: 46, channels: 2, callSid: "CA0" };
  const first = await recordCallRecording({ attemptId: "att1", recording: rec, client: fakeClient(1, { id: "att1" }) });
  ok("a first recording files on its attempt", first.ok && first.updated === 1 && first.attemptId === "att1", first);
  const where = JSON.stringify(calls[0]);
  ok("…and the WHERE names NULL by name — never a bare `not` that SQL skips", /"recordingSid":null/.test(where) && !/"NOT":\{"recordingSid":"RE/.test(where), where);
  ok("…while still refusing the same sid twice", /"recordingSid":\{"not":"RE/.test(where));
  const again = await recordCallRecording({ attemptId: "att1", recording: rec, client: fakeClient(0, { id: "att1" }) });
  ok("zero rows AND a row carrying the sid is 'already'", again.ok && again.updated === 0 && again.reason === "already" && again.attemptId === "att1", again);
  const nobody = await recordCallRecording({ attemptId: "ghost", recording: rec, client: fakeClient(0, null) });
  ok("zero rows and NO row carrying the sid is 'no_row', not a false 'already'", nobody.ok === false && nobody.reason === "no_row", nobody);
  ok("the route logs an orphan for anything that is not ok", /!filed\.ok \|\|/.test(read("app/api/rep-dial/recording/route.js")));

  // answeredAt: completed is stamped at the hang-up, so subtract the duration.
  const end = new Date("2026-09-18T17:15:04Z");
  ok("completed: answered = end − CallDuration", answeredAtFrom({ status: "completed", at: end, seconds: 45 })?.toISOString() === "2026-09-18T17:14:19.000Z");
  ok("in-progress: answered = the event's own time", answeredAtFrom({ status: "in-progress", at: end, seconds: NaN })?.getTime() === end.getTime());
  ok("a zero-second completed call is stamped at its end", answeredAtFrom({ status: "completed", at: end, seconds: 0 })?.getTime() === end.getTime());
  ok("ringing / no-answer / nothing is null", [answeredAtFrom({ status: "ringing", at: end }), answeredAtFrom({ status: "no-answer", at: end, seconds: 0 }), answeredAtFrom({}), answeredAtFrom({ status: "completed", at: "yesterday", seconds: 3 })].every((v) => v === null));
  ok("the status route uses it", /answeredAt: answeredAtFrom\(\{ status, at, seconds \}\)/.test(read("app/api/rep-dial/status/route.js")));
}

section("9. The net under the webhooks — lib/sales/calls/reconcileProvider.js");
{
  const res = { sid: SID, callSid: "CAparent", conferenceSid: null, status: "completed", duration: "46", channels: 2, source: "DialVerb", uri: `/2010-04-01/Accounts/AC0/Recordings/${SID}.json` };
  const f = recordingFromResource(res);
  ok("a Recording resource reads into the webhook's shape", f && f.sid === SID && f.seconds === 46 && f.channels === 2 && f.callSid === "CAparent" && f.url === `https://api.twilio.com/2010-04-01/Accounts/AC0/Recordings/${SID}`, f);
  ok("…refusing an unfinished one, a bad sid, a foreign uri", recordingFromResource({ ...res, status: "processing" }) === null && recordingFromResource({ ...res, sid: "nope" }) === null && recordingFromResource({ ...res, uri: "/evil" }) === null && recordingFromResource() === null);

  const call = { sid: "CAchild", status: "completed", duration: "45", endTime: new Date("2026-09-18T17:15:04Z"), direction: "outbound-dial", to: "+18193459008" };
  const cols = legColumnsFromCall(call);
  ok("a completed child leg gives status, talk, end and the pickup (end − duration)", cols.providerStatus === "completed" && cols.talkSeconds === 45 && cols.endedAt.toISOString() === "2026-09-18T17:15:04.000Z" && cols.answeredAt.toISOString() === "2026-09-18T17:14:19.000Z" && cols.providerCallSid === "CAchild", cols);
  const na = legColumnsFromCall({ ...call, status: "no-answer", duration: "0" });
  ok("a no-answer leg is the status and the end reason, no pickup", na.providerStatus === "no-answer" && na.endReason === "no-answer" && !na.answeredAt && na.talkSeconds === 0, na);
  ok("a leg still ringing is null — nothing final to write", legColumnsFromCall({ ...call, status: "in-progress" }) === null && legColumnsFromCall({}) === null);

  const kids = [{ sid: "CAt", direction: "outbound-dial", to: "+15550001111" }, { sid: "CAp", direction: "outbound-dial", to: "+1 819-345-9008" }, { sid: "CAx", direction: "inbound", to: "+18193459008" }];
  ok("the prospect leg is the outbound-dial child to the dialled number, formatting aside", pickProspectLeg(kids, "+18193459008")?.sid === "CAp");
  ok("one outbound child and no number match is that child", pickProspectLeg([kids[0]], "+19999999999")?.sid === "CAt");
  ok("two outbound children and no match is nobody — never a guess", pickProspectLeg(kids, "+19999999999") === null && pickProspectLeg([], "+1") === null);

  // The recordings sweep against a fake carrier and a fake store.
  const writes = [];
  const fakeStore = {
    salesCallAttempt: {
      findMany: async ({ where }) => (where.recordingSid?.in ? [{ recordingSid: "RE" + "1".repeat(32) }] : []),
      updateMany: async (args) => { writes.push(args); return { count: /CAknown/.test(JSON.stringify(args.where)) ? 1 : 0 }; },
      findFirst: async ({ where }) => (writes.some((w) => w.data.recordingSid === where.recordingSid && /CAknown/.test(JSON.stringify(w.where))) ? { id: "att-known" } : null),
    },
    salesRepActivity: {}, salesCallTransfer: { findUnique: async () => null },
  };
  const carrier = {
    recordings: { list: async () => [
      { ...res, sid: "RE" + "1".repeat(32), callSid: "CAknown" },
      { ...res, sid: "RE" + "2".repeat(32), callSid: "CAknown" },
      { ...res, sid: "RE" + "3".repeat(32), callSid: "CAnobody" },
      { ...res, sid: "RE" + "4".repeat(32), status: "processing" },
    ] },
  };
  process.env.TWILIO_ACCOUNT_SID ||= "AC0"; process.env.TWILIO_AUTH_TOKEN ||= "t";
  const swept = await reconcileRecordings({ client: fakeStore, twilio: carrier, now: new Date("2026-09-20T00:00:00Z") });
  ok("the sweep files the recording no row had, skips the one a row has, counts the orphan, ignores the unfinished", swept.listed === 3 && swept.filed === 1 && swept.alreadyFiled === 1 && swept.unmatched === 1 && swept.filedAttemptIds[0] === "att-known", swept);
  ok("…matching by EITHER leg's sid", /providerCallSid.*CAknown.*repCallSid.*CAknown|repCallSid.*CAknown.*providerCallSid.*CAknown/.test(JSON.stringify(writes[0].where)), writes[0].where);

  // The legs sweep: the overwrite repair needs no carrier; the fetches are capped.
  const legWrites = [];
  const end = new Date("2026-09-18T17:15:04Z");
  const legStore = {
    salesCallAttempt: {
      findMany: async ({ where, take }) => {
        if (where.providerStatus === "completed") return [{ id: "a1", answeredAt: end, endedAt: end, talkSeconds: 45 }, { id: "a2", answeredAt: new Date(end - 1000), endedAt: end, talkSeconds: 45 }];
        if (where.providerCallSid?.not === null) return [{ id: "b1", providerCallSid: "CAdone" }].slice(0, take);
        if (where.repCallSid?.not === null) return [{ id: "c1", repCallSid: "CArep", toE164: "+18193459008" }, { id: "c2", repCallSid: "CAlonely", toE164: "+15550000000" }].slice(0, take);
        return [];
      },
      updateMany: async (args) => { legWrites.push(args); return { count: 1 }; },
    },
  };
  const legCarrier = {
    calls: Object.assign((sid) => ({ fetch: async () => ({ sid, status: "completed", duration: "30", endTime: end }) }), {
      list: async ({ parentCallSid }) => (parentCallSid === "CArep" ? [{ sid: "CAkid", direction: "outbound-dial", to: "+18193459008", status: "no-answer", duration: "0", endTime: end }] : []),
    }),
  };
  const legs = await reconcileProspectLegs({ client: legStore, twilio: legCarrier, now: new Date("2026-09-20T00:00:00Z"), limit: 10 });
  ok("answeredAt equal to endedAt is repaired to end − talk, and a row already right is left alone", legs.repairedAnsweredAt === 1 && legWrites[0].where.id === "a1" && legWrites[0].data.answeredAt.toISOString() === "2026-09-18T17:14:19.000Z", legs);
  ok("a sid with no status is fetched and written", legWrites.some((w) => w.where.id === "b1" && w.data.providerStatus === "completed" && w.data.talkSeconds === 30));
  ok("a rep leg's outbound child becomes the prospect leg", legWrites.some((w) => w.where.id === "c1" && w.data.providerCallSid === "CAkid" && w.data.providerStatus === "no-answer"));
  ok("a rep leg with no child is closed as failed / no_prospect_leg, so it is not asked again", legWrites.some((w) => w.where.id === "c2" && w.data.providerStatus === "failed" && w.data.endReason === "no_prospect_leg") && legs.noLeg === 1);
  ok("carrier reads are counted and capped", legs.fetched === 3 && legs.updated === 2);

  const cron = read("app/api/cron/sales-pipeline/route.js");
  ok("the cron runs both sweeps and one catch-up transcription a tick, each in its own try", /reconcileRecordings\(\{ now, client: db/.test(cron) && /reconcileProspectLegs\(\{ now, client: db/.test(cron) && /transcribeMissing\(\{ limit: 1, retryUnconfigured: true, client: db \}\)/.test(cron));
  ok("…before the AI slice measures what is left", cron.indexOf("transcribeMissing({ limit: 1") < cron.indexOf("const elapsed = Date.now() - now.getTime()"));
  ok("answering-machine detection is named as the thing NOT turned on", /machineDetection/.test(read("lib/sales/calls/reconcileProvider.js")) && !/machineDetection/.test(read("app/api/rep-dial/bridge/route.js")));
}

console.log(`\n${failures.length === 0 ? "PASS" : "FAIL"} — ${pass} checks passed, ${failures.length} failed.`);
if (failures.length) process.exit(1);
