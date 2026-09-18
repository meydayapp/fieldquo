// scripts/check-inbound-answer.mjs
//
//   npm run check:inbound-answer
//
// "Why can I not pick up an inbound call? I'm sure there's a way to do it with
//  the browser."
//
// ══ Why nothing rang ══════════════════════════════════════════════════════
//
// Two halves, and each one hid the other.
//
// The Voice access token granted `incomingAllow: false`, so a rep's identity
// was not permitted to receive a call at all. Its comment was not an oversight
// — it said so on purpose, and said what would have to be true first: "turning
// this on later is a deliberate change with its own routing decision behind
// it." That routing decision arrived this morning as
// lib/sales/calls/inboundDistribution.js.
//
// And the Twilio Device was built inside place() in CallPanel — constructed to
// make one outbound call and destroyed on disconnect — so even with the grant
// there was no registered client between calls. ringPlan was emitting exactly
// correct TwiML at a client that did not exist.
//
// ══ The bug this check exists to keep out ═════════════════════════════════
//
// Enabling the grant makes register() dangerous in the OUTBOUND path: Twilio
// rings every registered client on an identity, and CallPanel's device has no
// `incoming` handler. A second registration there means a contractor ringing
// back while the rep is mid-call is answered by a Device that does nothing
// with it. One registered client per rep, and it is the dock.
//
// ══ Executed and source-asserted ══════════════════════════════════════════
//
// The token grant is executed — the JWT is minted and decoded, so the
// assertion is about the token Twilio will actually receive, not about a line
// of source that looks right.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import twilio from "twilio";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/**
 * The file with its comments stripped.
 *
 * Written after a mutation that should have failed did not: the token-refresh
 * assertion matched the word `tokenWillExpire` in the dock's own header, so
 * deleting the handler left the check green. A check that can be satisfied by
 * prose about the code is not a check on the code — and the prose in this
 * repository is deliberately thorough, which makes the trap likelier here than
 * most places.
 */
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`); }
}
const section = (t) => console.log(`\n${t}\n`);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The token actually permits receiving");
// ═══════════════════════════════════════════════════════════════════════════

{
  // Minted and decoded rather than grepped: what matters is the claim inside
  // the JWT Twilio reads, and a source line can be right while the grant is
  // built from something else.
  const { AccessToken } = twilio.jwt;
  const t = new AccessToken("AC" + "0".repeat(32), "SK" + "0".repeat(32), "secret", {
    identity: "sales_rep:test",
    ttl: 600,
  });
  t.addGrant(new AccessToken.VoiceGrant({ outgoingApplicationSid: "AP" + "0".repeat(32), incomingAllow: true }));
  const decoded = JSON.parse(Buffer.from(t.toJwt().split(".")[1], "base64").toString());
  ok("a voice grant with incomingAllow decodes as incoming-allowed",
    decoded?.grants?.voice?.incoming?.allow === true, decoded?.grants?.voice);

  const route = read("app/api/sales/calls/token/route.js");
  const routeCode = decomment(route);
  ok("the route grants incomingAllow: true", /incomingAllow: true/.test(routeCode));
  ok("…and no longer grants false", !/incomingAllow: false/.test(routeCode));
  // The property that made turning it on safe, and it must not quietly rot.
  ok("the identity still comes from the gate, not the request body",
    /const identity = repIdentity\(rep\.id\)/.test(route));
  ok("…and a rep id that cannot be an identity is refused",
    /cannot be used as a calling identity/.test(route));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Something is listening, on every screen");
// ═══════════════════════════════════════════════════════════════════════════

// 2026-09-18: the Device is CallSession's — built, registered and its
// token refreshed there, mounted once in SalesShell. The dock subscribes to
// its `incoming` event and draws the ring; the microphone warning and the
// Device error are the session's, printed by the dock.
{
  const dock = read("app/components/sales/IncomingCallDock.js");
  const dockCode = decomment(dock);
  const session = read("app/components/sales/CallSession.js");
  const sessionCode = decomment(session);
  ok("the session registers the device", /await device\.register\(\)/.test(sessionCode));
  ok("…and forwards the incoming event", /device\.on\("incoming"/.test(sessionCode) && /incomingHandlers\.current/.test(sessionCode));
  ok("…the dock subscribes to it", /sessionRef\.current\.onIncoming\(/.test(dockCode));
  ok("…with a way to answer", /call\.accept\(\)/.test(dockCode));

  // reject() hands the call back to Twilio so the ring plan's NEXT target gets
  // it. disconnect() would end the call for the contractor — a rep declining
  // one call would hang up on them.
  ok("declining rejects rather than disconnects", /call\.reject\(\)/.test(dockCode));
  // The sentence moved into app/i18n/appMessages.js when the sales portal was
  // translated, so this matches the KEY the screen renders. The words are
  // still asserted — scripts/check-sales-portal-i18n.mjs section 6 holds the
  // English catalogue value to them, which is where they now live.
  ok("…and says so to the rep", /app\.salesDial\.decliningNotice/.test(dock));

  // A token expires. A device that registered once and never refreshed works
  // for an hour and then goes quiet with nothing on screen saying so.
  ok("the token is refreshed before it expires", /device\.on\("tokenWillExpire"/.test(sessionCode));
  ok("…by updating in place", /device\.updateToken\(/.test(sessionCode));
  // The owner saw "AccessTokenExpired (20104)" on the queue page: the error
  // handler recovered from 20101 (invalid) but not from 20104 (expired), and
  // a backgrounded tab had throttled both refresh timers. Every spelling of
  // "bad token" is recoverable, and coming back to the tab refreshes at once.
  {
    // Read from the source rather than imported: the file is a "use client"
    // component with JSX, which bare Node cannot load.
    const setLine = /TOKEN_ERROR_CODES = new Set\(\[([^\]]*)\]\)/.exec(sessionCode);
    const codes = setLine ? setLine[1].split(",").map((n) => Number(n.trim())) : [];
    ok("every token refusal Twilio can send is recoverable: 20101, 20104, 31204, 31205", [20101, 20104, 31204, 31205].every((c) => codes.includes(c)));
    ok("…and the error handler consults that set, not a hand-typed pair", /TOKEN_ERROR_CODES\.has\(err\?\.code\)/.test(sessionCode));
    ok("the token is refreshed the moment the tab becomes visible again", /document\.addEventListener\("visibilitychange", onVisible\)/.test(sessionCode) && /visibilityState === "visible"\) refresh\("visible"\)/.test(sessionCode));
    ok("…and that listener is removed on teardown", /removeEventListener\("visibilitychange", onVisible\)/.test(sessionCode));
  }

  // Registered is not the same as being rung. Who is rung is decided
  // server-side from presence; a client that also had an opinion is how a
  // paused rep's laptop starts ringing.
  ok("the client keeps no opinion about who should be rung",
    !/STATE_AVAILABLE|reachable\(|presenceOf\(/.test(sessionCode) && !/STATE_AVAILABLE|reachable\(|presenceOf\(/.test(dockCode));

  ok("a missing microphone is reported, not swallowed", /availableInputDevices/.test(sessionCode));
  ok("…in words about a headset", /noMicrophone/.test(session) || /headset/i.test(session), "the session raises the mic warning");

  const shell = read("app/sales/SalesShell.js");
  ok("the dock is mounted in the portal shell", /<IncomingCallDock \/>/.test(shell));
  ok("…under the one Device provider", /<CallSessionProvider>/.test(shell));
  // The point of mounting it in the shell: a call does not arrive on a page.
  ok("…so it is not tied to one screen", /wherever they are in the portal/.test(shell));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Exactly one registered client per rep");
// ═══════════════════════════════════════════════════════════════════════════

{
  const panel = read("app/components/sales/CallPanel.js");
  const panelCode = decomment(panel);
  const session = read("app/components/sales/CallSession.js");
  const sessionCode = decomment(session);
  // The outbound path used to build a SECOND Device per call. It connects on
  // the session's ONE registered Device now, so there is no second client to
  // register — the bug the grant could have introduced cannot exist.
  ok("the outbound path builds no Device of its own", !/new Device\(/.test(panelCode), "CallPanel still constructs a Device");
  ok("…and registers no second client", !/\.register\(\)/.test(panelCode), "CallPanel still calls register()");
  ok("the session is the one registered client, and says why", /One registered client per rep/.test(session) || /a second registered client on this rep's identity/.test(panel));
  ok("the outbound path connects through the session", /connectOutbound\(/.test(panelCode) && /device\.connect\(/.test(sessionCode));
  ok("…and the session tears the Device down only with the shell", /device\?\.destroy\?\.\(\)/.test(sessionCode));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The routing this depended on is still there");
// ═══════════════════════════════════════════════════════════════════════════

{
  const route = read("app/api/rep-dial/inbound/route.js");
  ok("inbound still dials a browser client", /dial\.client\(target\.value\)/.test(route));
  ok("…from a ring plan", /ringPlan\(\{/.test(route));
  const dist = read("lib/sales/calls/inboundDistribution.js");
  ok("…whose targets are client identities", /kind: "client"/.test(dist));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:inbound-answer is a script", typeof pkg.scripts?.["check:inbound-answer"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:inbound-answer"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
