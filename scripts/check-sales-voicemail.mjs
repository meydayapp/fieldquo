// scripts/check-sales-voicemail.mjs
//
//   npm run check:sales-voicemail
//
// "Is there a voice mail option for each phone number?" — and, when the answer
// turned out to be "on one line, and only a superadmin can hear it": "It seems
// kinda illogical."
//
// ══ The two faults ════════════════════════════════════════════════════════
//
// 1. THE PERSON THE MESSAGE WAS FOR COULD NOT HEAR IT. A recording is written
//    to SalesCallAttempt.voicemailUrl and the only screen that played it was
//    /platform/sales/floor. A contractor rings the number a rep gave them,
//    leaves that rep a message, and the rep has no way to reach it. Written
//    and never read, in its reachability form — and what it loses is a
//    callback from somebody who already wanted to talk.
//
// 2. THE URL WAS THE PROVIDER'S. `voicemailUrl` holds Twilio's own
//    RecordingUrl and it went straight into an <audio src>. Wrong whichever
//    way Twilio's account setting falls: if the media is public it is an
//    unauthenticated recording of a stranger's voice behind a guessable link,
//    and if it is not, that player never played. This repository already knew
//    better — lib/voice/recording.js proxies TENANT recordings for the same
//    reason — and the sales path simply had not learned it.
//
// ══ Executed, and comment-stripped where it matters ═══════════════════════
//
// The ownership rules run as functions. The source assertions decomment first:
// these files necessarily WRITE about provider URLs in their headers, so a
// naive "no api.twilio.com in this file" would fail on the prose explaining
// why there is no api.twilio.com in the code.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  hasRecording,
  voicemailHref,
  voicemailWhere,
  ownsVoicemail,
  voicemailView,
} from "@/lib/sales/calls/voicemail";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`); }
}
const section = (t) => console.log(`\n${t}\n`);

const MINE = "rep_daniel";
const OTHER = "rep_someone_else";
const MY_NUMBER = "+17166383616";
const NOT_MY_NUMBER = "+16135550100";

// ═══════════════════════════════════════════════════════════════════════════
section("1. Whose message is it");
// ═══════════════════════════════════════════════════════════════════════════

{
  const attributed = { id: "a1", direction: "in", salesRepId: MINE, ourE164: NOT_MY_NUMBER, voicemailUrl: "https://x/RE1" };
  ok("a message already filed to the rep is theirs", ownsVoicemail(attributed, { salesRepId: MINE }));

  // The rule that carries the case the first cannot: inbound attribution comes
  // from matching the CALLER, and a contractor ringing from a mobile we have
  // never seen matches nobody. The message is still for the rep whose number
  // they rang.
  const unmatched = { id: "a2", direction: "in", salesRepId: null, ourE164: MY_NUMBER, voicemailUrl: "https://x/RE2" };
  ok("an unmatched caller on the rep's own number is still theirs",
    ownsVoicemail(unmatched, { salesRepId: MINE, ourNumbers: [MY_NUMBER] }));
  ok("…and would be lost by attribution alone", !ownsVoicemail(unmatched, { salesRepId: MINE, ourNumbers: [] }));

  const theirs = { id: "a3", direction: "in", salesRepId: OTHER, ourE164: NOT_MY_NUMBER, voicemailUrl: "https://x/RE3" };
  ok("another rep's message on a number that is not mine is refused",
    !ownsVoicemail(theirs, { salesRepId: MINE, ourNumbers: [MY_NUMBER] }));

  ok("an outbound call is never a voicemail",
    !ownsVoicemail({ ...attributed, direction: "out" }, { salesRepId: MINE }));
  ok("a row with no recording is refused",
    !ownsVoicemail({ ...attributed, voicemailUrl: null }, { salesRepId: MINE }));
  ok("an empty recording url is refused",
    !ownsVoicemail({ ...attributed, voicemailUrl: "   " }, { salesRepId: MINE }));
  ok("null does not throw", !ownsVoicemail(null, { salesRepId: MINE }));
  ok("hasRecording agrees", hasRecording(attributed) && !hasRecording({ voicemailUrl: "" }));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The query asks the same question");
// ═══════════════════════════════════════════════════════════════════════════

{
  const w = voicemailWhere({ salesRepId: MINE, ourNumbers: [MY_NUMBER] });
  ok("only rows with a recording", w.voicemailUrl?.not === null);
  ok("only inbound", w.direction === "in");
  ok("either mine by attribution or mine by number", w.OR.length === 2, w.OR);
  ok("…the first is attribution", w.OR[0].salesRepId === MINE);
  ok("…the second is the rep's numbers", JSON.stringify(w.OR[1]) === JSON.stringify({ ourE164: { in: [MY_NUMBER] } }));

  // An empty `in` matches nothing, but writing the clause anyway invites
  // somebody to "fix" it later into one that matches everything.
  const none = voicemailWhere({ salesRepId: MINE, ourNumbers: [] });
  ok("a rep with no number gets no number clause", none.OR.length === 1, none.OR);
  // A missing rep id must never widen to everybody.
  const anon = voicemailWhere({});
  ok("no rep id cannot match every message", anon.OR[0].salesRepId === "__none__", anon.OR[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Nothing hands out the provider's URL");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("the href is FieldQuo's own", voicemailHref("a1") === "/api/sales/voicemail/a1/audio");
  ok("…and an id is escaped", voicemailHref("a/b").includes("a%2Fb"));
  ok("…and no id gives no link", voicemailHref("") === null);

  const view = voicemailView({ id: "a1", voicemailUrl: "https://api.twilio.com/2010-04-01/Recordings/RE1", voicemailSeconds: 4 });
  ok("the view never carries the provider url", !JSON.stringify(view).includes("api.twilio.com"), view);
  ok("…and carries the proxied one", view.audioHref === "/api/sales/voicemail/a1/audio");

  const repPage = decomment(read("app/sales/voicemail/page.js"));
  ok("the rep screen plays the proxied href", /src=\{v\.audioHref\}/.test(repPage));
  ok("…and never a provider url", !/api\.twilio\.com/.test(repPage));

  const floor = decomment(read("app/platform/sales/floor/page.js"));
  ok("the floor board no longer plays voicemailUrl directly",
    !/src=\{c\.voicemailUrl\}/.test(floor), "floor board still uses the raw URL");
  ok("…it uses the platform proxy", /api\/platform\/sales\/voicemail\/\$\{encodeURIComponent\(c\.id\)\}\/audio/.test(floor));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Both audio routes are gated, and re-check");
// ═══════════════════════════════════════════════════════════════════════════

{
  const repAudio = decomment(read("app/api/sales/voicemail/[id]/audio/route.js"));
  ok("the rep audio route gates on the rep", /requireOutreachRep\(request\)/.test(repAudio));
  // An attempt id in a URL is a guess anybody can make.
  ok("…and re-checks ownership rather than trusting the id", /ownsVoicemail\(/.test(repAudio));
  ok("…and answers 404 for both 'no such' and 'not yours'", /No such message\./.test(repAudio));
  ok("…and authenticates to the provider", /Authorization: `Basic \$\{auth\}`/.test(repAudio));
  ok("…and never lets a shared cache keep it", /private, no-store/.test(repAudio));
  ok("…and records an upstream refusal rather than swallowing it", /voicemail_upstream_refused/.test(repAudio));

  const admAudio = decomment(read("app/api/platform/sales/voicemail/[id]/audio/route.js"));
  ok("the platform audio route is superadmin only", /admin\.role !== "superadmin"/.test(admAudio));
  ok("…and authenticates to the provider too", /Authorization: `Basic \$\{auth\}`/.test(admAudio));
  ok("…and is also uncacheable", /private, no-store/.test(admAudio));

  const list = decomment(read("app/api/sales/voicemail/route.js"));
  ok("the list route is gated", /requireOutreachRep\(request\)/.test(list));
  ok("…and scopes with the shared helper", /voicemailWhere\(/.test(list));
  ok("…and reads the rep's assigned numbers", /assignedRepId: rep\.id/.test(list));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Zero seconds is not nothing");
// ═══════════════════════════════════════════════════════════════════════════

{
  // The recorder fires after a few seconds of silence, so zero means somebody
  // rang back, heard the beep and thought better of speaking. Warmer than a
  // missed call, colder than a message — and collapsing it into "no message"
  // throws away the warmest signal on the screen.
  const silent = voicemailView({ id: "a1", voicemailSeconds: 0 });
  ok("zero seconds is kept", silent.seconds === 0);
  ok("…and flagged as silent", silent.silent === true);
  const unknown = voicemailView({ id: "a2", voicemailSeconds: null });
  ok("null seconds is not silent", unknown.silent === false && unknown.seconds === null);
  const page = read("app/sales/voicemail/page.js");
  ok("the screen says what a silent message means", /heard the beep and hung up/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The rep can reach it");
// ═══════════════════════════════════════════════════════════════════════════

{
  const shell = read("app/sales/SalesShell.js");
  ok("there is a Voicemail tab", /href: "\/sales\/voicemail"/.test(shell));
  const pkg = JSON.parse(read("package.json"));
  ok("check:sales-voicemail is a script", typeof pkg.scripts?.["check:sales-voicemail"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:sales-voicemail"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
