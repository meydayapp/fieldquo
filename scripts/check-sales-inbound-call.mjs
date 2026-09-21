#!/usr/bin/env node
//
// scripts/check-sales-inbound-call.mjs
//
//   npm run check:sales-inbound-call
//
// A contractor rang one of FieldQuo's sales numbers back and reached nothing
// at all. Everything below exists because the fix touches three things that
// are each easy to get quietly wrong: a public endpoint that makes a phone
// call, a compliance rule that runs the OPPOSITE way from the outbound one,
// and a second row shape in a table every sales report already counts.
//
// ══ What is EXECUTED rather than read ══════════════════════════════════════
//
// FieldQuo owns zero phone numbers — the Twilio Trust Hub compliance profile
// is not approved, number search returns almost nothing and every purchase is
// refused — so there is no live number to ring. That is not an excuse for
// asserting by reading. Everything that decides anything is a pure function
// taking rows, and every one of them is run here against the cases that
// matter: a withheld caller ID, a number we do not hold, an empty floor, a
// floor we could not read, a rep who left, a suppressed caller, a transfer
// nobody picked up. The store's writes are run too, against a scripted client,
// so "the inbound row is direction in and does not consume the outbound cap"
// is a fact about an argument rather than a sentence in a comment.
//
// What is NOT executed, and is asserted structurally instead: the route
// itself. It imports next/server and the Twilio SDK, and standing those up
// here would test the harness. Those assertions are scoped to ONE named
// function each, over comment-stripped source, for the reason
// scripts/check-demo-spend.mjs records — a whole-file match passed once while
// the guard it checked had been deleted, because an identical string a few
// hundred lines earlier satisfied it.
//
// ══ Mutation-tested ════════════════════════════════════════════════════════
//
// Each guarantee below was broken in turn on disk, the break CONFIRMED present
// by re-reading the file, this script confirmed to FAIL, and the file restored
// from a `cp` backup taken first — never `git checkout`, which restores the
// commit rather than the working copy. The report accompanying this change
// lists which break failed which assertion.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { register } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── A stand-in for @/lib/db ───────────────────────────────────────────────
//
// lib/sales/calls/store.js imports it, and the real one constructs a
// PrismaClient against Neon at module load — so a check that imported the
// store would need a live database. Its own hook rather than
// scripts/db-stub-loader.mjs, following check-sales-auth.mjs's precedent and
// its reason: that stub is shared by several checks and adding a model to it
// is an edit to their fixture.
//
// The stub is deliberately USELESS: every store function below is called with
// an explicit `client`, so if one of them ever ignored the argument and
// reached for the module-level db, it would throw here rather than pass.
//
// Since 2026-09-17 the stub has a second mode: when `globalThis.__inboundDb`
// is set (section 18, which drives the ROUTE itself), the module-level `db`
// delegates to that in-memory client, so the shipped route runs unmodified
// against scripted rows. Unset — every other section — it throws exactly as
// before, so the store's "uses the client argument" property still holds.
//
// `@/lib/notify/push` is replaced the same way: the real one would look up
// subscriptions and hand them to web-push. The stub records every payload
// (title, body, tag, recipients) on `globalThis.__pushes`, rendering the copy
// through the real APP_MESSAGES so a missing key fails here.
const DB_HOOKS = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: "fq-stub:inbound-db", shortCircuit: true };
  if (specifier === "@/lib/notify/push") return { url: "fq-stub:inbound-push", shortCircuit: true };
  if (specifier === "next/server") return { url: "fq-stub:inbound-next", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:inbound-db")
    return { format: "module", shortCircuit: true, source:
      "export const db = new Proxy({}, { get(_t, m) { if (globalThis.__inboundDb) return globalThis.__inboundDb[m]; throw new Error('the module-level db was used instead of the client argument: ' + String(m)); } });" };
  if (url === "fq-stub:inbound-next")
    // next/server has no bare-node entry; the route only needs a Response
    // with a status, headers and a text body, which the standard Response is.
    return { format: "module", shortCircuit: true, source:
      "export class NextResponse extends Response { static json(body, init) { return new NextResponse(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } }); } }" };
  if (url === "fq-stub:inbound-push")
    return { format: "module", shortCircuit: true, source: \`
      import { APP_MESSAGES } from "@/app/i18n/appMessages";
      export async function appSentence(language, key, params = {}) {
        const dict = APP_MESSAGES[String(language || "en").toLowerCase()] || {};
        let raw = dict[key] ?? APP_MESSAGES.en[key];
        if (raw == null) throw new Error("missing app message: " + key);
        for (const [k, v] of Object.entries(params || {})) raw = String(raw).split("{" + k + "}").join(String(v ?? ""));
        return String(raw);
      }
      export async function pushToReps({ salesRepIds, payload }) {
        globalThis.__pushes = globalThis.__pushes || [];
        const p = typeof payload === "function" ? await payload("en") : payload;
        globalThis.__pushes.push({ salesRepIds: [...salesRepIds], ...p });
        return { sent: salesRepIds.length, failed: 0, disabled: 0 };
      }
      export function pushConfigured() { return true; }
    \` };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(DB_HOOKS)}`);

const {
  INBOUND_ACTIONS,
  INBOUND_CONNECT,
  INBOUND_MESSAGE,
  INBOUND_NOT_OURS,
  INBOUND_UNAVAILABLE,
  INBOUND_WEBHOOK_PATH,
  TRANSFER_RING_SECONDS,
  afterTransfer,
  anyRepLive,
  fallbackSayFor,
  inboundPlan,
  inboundWebhookUrl,
  repIsLive,
  salesVoiceInboundState,
} = await import("@/lib/sales/calls/inboundRouting");

const {
  WITHHELD_NUMBER,
  attemptsLast24h,
  lastOutboundBetween,
  recordDial,
  recordInbound,
  salesVoiceNumber,
} = await import("@/lib/sales/calls/store");

const { REP_CALL_WRITES } = await import("@/lib/sales/calls/gate");
const { matchInboundCaller } = await import("@/lib/sales/calls/inboundMatch");
const { normalisePhone } = await import("@/lib/sales/suppressionRules");
const { NOT_TRACKED_CALLS, campaignCallRows, repCallStats } = await import(
  "@/lib/sales/calls/reporting"
);
const {
  STATE_AVAILABLE,
  STATE_OFFLINE,
  STATE_ON_CALL,
  STATE_PAUSED,
} = await import("@/lib/sales/calls/agentState");

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

/** Comments stripped before any regex touches source. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const source = (rel) => stripComments(read(rel));

/**
 * One named function's body, comment-stripped, from its signature to the next
 * top-level declaration. Scoped so a guard deleted from THIS function cannot
 * be satisfied by an identical line elsewhere in the same file.
 */
function fnBody(rel, signature) {
  const src = source(rel);
  const start = src.indexOf(signature);
  if (start === -1) return "";
  const rest = src.slice(start + signature.length);
  const next = rest.search(/\n(export|async function|function) /);
  return next === -1 ? rest : rest.slice(0, next);
}

const ROUTE = "app/api/rep-dial/inbound/route.js";
const OUR_NUMBER = { id: "n1", e164: "+19185550100", purpose: "sales_voice", active: true, voiceUrl: "https://www.fieldquo.com/api/rep-dial/inbound" };
// The team's ONE number (owner's decision, 2026-09-06): purpose "sales", bought
// with both webhooks. And the same purpose bought BEFORE that day — text-only
// at Twilio, no voice URL on the row — which must not answer a ring-back.
const TEAM_NUMBER = { id: "n2", e164: "+13435550100", purpose: "sales", active: true, voiceUrl: "https://www.fieldquo.com/api/rep-dial/inbound" };
const OLD_TEXT_ONLY = { id: "n3", e164: "+13435550199", purpose: "sales", active: true, voiceUrl: null };
const CALLER = "+19185559911";
const DESK = "+16135550123";
const NOW = new Date("2026-09-04T21:30:00Z");

// ═══════════════════════════════════════════════════════════════════════════
section("1. The route exists, is public, and the signature is the only door");

ok("the inbound webhook route is on disk", existsSync(join(ROOT, ROUTE)));

{
  const body = fnBody(ROUTE, "export async function POST(");
  ok(
    "it verifies the Twilio signature",
    /verifyTwilioWebhook\(request\)/.test(body),
  );
  ok(
    "…and refuses with 403 when it does not check out",
    /if \(!ok\)/.test(body) && /status: 403/.test(body),
  );
  ok(
    "…BEFORE it reads anything from the database",
    (() => {
      // Ordering, not presence. A verification that runs after the lookup is
      // not a gate — the same property check-sales-call-handling asserts about
      // the floor board's role check. Since 2026-09-17 every read lives in
      // handle(), which POST reaches only past the refusal; the one write
      // before it is the refusal's own error-log row, which is the point.
      const verify = body.indexOf("verifyTwilioWebhook");
      const refuse = body.indexOf("status: 403");
      const dispatch = body.indexOf("handle(request, params)");
      const readsInPost = body.search(/salesVoiceNumber\(|db\.\w+\.find/);
      const handleReads = fnBody(ROUTE, "async function handle(").search(/salesVoiceNumber\(|db\.\w+\.find/);
      return (
        verify !== -1 && refuse !== -1 && dispatch !== -1 && verify < refuse && refuse < dispatch &&
        readsInPost === -1 && handleReads !== -1
      );
    })(),
  );
  ok(
    "…and a refused request is written to the error log with what Twilio sent",
    /code: "signature_rejected"/.test(body) && /callSid: params\?\.CallSid/.test(body),
  );
  ok(
    "a throw anywhere in the handler is logged with the CallSid and answered with TwiML, never a 500",
    /code: "webhook_threw"/.test(body) && /return speak\(/.test(body) && !/status: 500/.test(body),
  );
  ok(
    "the verifier is the shared one, not a second copy of the HMAC dance",
    /from "@\/lib\/sms\/verifyTwilioWebhook"/.test(source(ROUTE)),
  );
  ok(
    "the second leg is behind the same signature check",
    // The stage branches live in handle(), which only POST calls, and POST
    // calls it after the refusal — or a stranger could post a DialCallStatus
    // for any attempt id they liked.
    (() => {
      const handle = fnBody(ROUTE, "async function handle(");
      const src = source(ROUTE);
      const callers = [...src.matchAll(/await handle\(request, params\)/g)].length;
      return /"after-dial"/.test(handle) && /"status"/.test(handle) && callers === 1 &&
        body.indexOf("verifyTwilioWebhook") < body.indexOf("handle(request, params)");
    })(),
  );
}

ok(
  "the route is declared in check-route-callers' external-caller list",
  read("scripts/check-route-callers.mjs").includes('"/api/rep-dial/inbound":'),
);
ok(
  "…and the path the list names is the path the module builds",
  INBOUND_WEBHOOK_PATH === "/api/rep-dial/inbound",
);
ok(
  "the route is NOT under /api/sales, which middleware refuses without a rep cookie",
  !ROUTE.startsWith("app/api/sales"),
);

// ═══════════════════════════════════════════════════════════════════════════
section("2. THE CALLING WINDOW DOES NOT GATE AN INBOUND ANSWER");

// The single most counter-intuitive rule in this feature, and the one a future
// change is most likely to "fix". A person ringing us has chosen the moment;
// refusing them at 21:00 because Oklahoma's solicitation statute closes at
// 20:00 would refuse a prospect who is trying to buy.
{
  const src = source(ROUTE);
  ok(
    "the route imports nothing from the calling-rules module",
    !/from "@\/lib\/sales\/callingRules"/.test(src),
  );
  ok("…and never calls salesCallReadiness", !/salesCallReadiness/.test(src));
  ok("…and never reads a CALL_ALLOWED decision", !/CALL_ALLOWED|CALL_REFUSED/.test(src));

  const routing = source("lib/sales/calls/inboundRouting.js");
  ok(
    "the routing module imports no calling-window code either",
    !/from "\.\.?\/callingRules"|from "@\/lib\/sales\/callingRules"/.test(routing),
  );
}

// A call arriving at 21:30 UTC — outside every window in the table — is
// answered, and answered the same way it would be at noon.
{
  const late = inboundPlan({
    numberRung: OUR_NUMBER,
    fromE164: CALLER,
    match: matchInboundCaller({ fromE164: CALLER }),
    transferTo: DESK,
    anyRepLive: true,
  });
  ok("a call outside every calling window still connects", late.action === INBOUND_CONNECT, late.action);
  ok("…and is still recorded", late.recordAttempt === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Every branch of the answer, executed");

ok("the action vocabulary is closed and complete", INBOUND_ACTIONS.length === 4 &&
  [INBOUND_NOT_OURS, INBOUND_UNAVAILABLE, INBOUND_CONNECT, INBOUND_MESSAGE].every((a) =>
    INBOUND_ACTIONS.includes(a),
  ));

{
  const notOurs = inboundPlan({ numberRung: null });
  ok("a number we do not hold is refused", notOurs.action === INBOUND_NOT_OURS, notOurs.action);
  ok("…and nothing is written for it", notOurs.recordAttempt === false);
  ok("…and the caller is told something rather than dropped", notOurs.say.length > 0);
}

{
  const noStore = inboundPlan({ numberRung: OUR_NUMBER, storeReady: false, transferTo: DESK });
  ok(
    "a deployment that cannot record the call does not silently take it",
    noStore.action === INBOUND_UNAVAILABLE,
    noStore.action,
  );
  ok("…and does not transfer it either", noStore.transferTo === null);
  ok("…and writes no row it cannot write", noStore.recordAttempt === false);
}

{
  // THE bug of 2026-09-17. This block used to assert the opposite — that no
  // transfer destination meant a message — and production has never had one
  // set, so every ring-back went to the beep while the rep sat in the
  // console. The browsers ring whether or not a desk phone exists.
  const noDest = inboundPlan({ numberRung: OUR_NUMBER, transferTo: null, anyRepLive: true });
  ok("no transfer destination still CONNECTS — the browsers ring without a desk phone", noDest.action === INBOUND_CONNECT, noDest.action);
  ok("…and the call is still recorded", noDest.recordAttempt === true);
  ok("…and the reason says the floor was live, not that a desk was set", noDest.reason === "floor_live", noDest.reason);
  ok("…and no transfer number is invented", noDest.transferTo === null);
  const noDestUnknown = inboundPlan({ numberRung: OUR_NUMBER, transferTo: null, anyRepLive: null });
  ok("…an unreadable floor with no desk phone is rung too", noDestUnknown.action === INBOUND_CONNECT && noDestUnknown.reason === "presence_unknown", noDestUnknown.reason);
  const noDestEmpty = inboundPlan({ numberRung: OUR_NUMBER, transferTo: null, anyRepLive: false });
  ok("…and only an EMPTY floor takes a message without ringing", noDestEmpty.action === INBOUND_MESSAGE && noDestEmpty.reason === "floor_empty");
  const emptyButOwned = inboundPlan({ numberRung: OUR_NUMBER, transferTo: null, anyRepLive: false, ringable: 1 });
  ok("…unless the ring plan found a browser anyway (the number's owner, or the rep who just dialled them)", emptyButOwned.action === INBOUND_CONNECT && emptyButOwned.reason === "floor_empty_ringable" && emptyButOwned.floorEmpty === true, emptyButOwned.reason);
  ok("…and a live floor does not claim to be empty", inboundPlan({ numberRung: OUR_NUMBER, transferTo: null, anyRepLive: true, ringable: 1 }).floorEmpty === false);
}

{
  const empty = inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: false });
  ok("an empty floor is not rung", empty.action === INBOUND_MESSAGE, empty.action);
  ok("…and says why", empty.reason === "floor_empty");
}

{
  // The distinction that costs a call if it is collapsed: `null` is the
  // presence tables being unreadable, NOT an empty floor.
  const unknown = inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: null });
  ok("an UNKNOWN floor is rung anyway", unknown.action === INBOUND_CONNECT, unknown.action);
  ok("…and the reason records that it was a guess", unknown.reason === "transfer_presence_unknown");
  ok("…and it is not confused with a live floor", unknown.reason !== "transfer_floor_live");
}

{
  const live = inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: true });
  ok("a live floor with a destination connects", live.action === INBOUND_CONNECT);
  ok("…to the configured destination and nowhere else", live.transferTo === DESK);
  ok("…with a ring timeout, so it cannot ring forever", live.timeoutSeconds === TRANSFER_RING_SECONDS);
  ok("…and nothing is spoken first, so the ring is not delayed", live.say.length === 0);
  ok("…but the message it falls back to is carried", live.fallbackSay.length > 0);
}

ok(
  "a destination that is not E.164 is not dialled",
  (() => {
    const p = inboundPlan({ numberRung: OUR_NUMBER, transferTo: "the office", anyRepLive: true });
    return p.action === INBOUND_CONNECT && p.transferTo === null;
  })(),
);

// ═══════════════════════════════════════════════════════════════════════════
section("4. Recording is on wherever two people are connected, and off where nobody is");

// 2026-09-17: the owner's decision. The disclosure is in the rep's opening
// script; the conversation is kept. A plan that connects a caller to a rep
// says record: true; a plan that plays a message or refuses has no
// conversation to keep and says false — never a blanket true that would
// claim a recording of a refusal.
for (const [label, plan, expected] of [
  ["a number we do not hold", inboundPlan({ numberRung: null }), false],
  ["an unrecordable deployment", inboundPlan({ numberRung: OUR_NUMBER, storeReady: false }), false],
  // No desk number no longer means a message: browsers ring (2026-09-17),
  // and two people connected is a recorded call.
  ["no desk number, browsers ring", inboundPlan({ numberRung: OUR_NUMBER, transferTo: null }), true],
  ["an empty floor", inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: false }), false],
  ["a transfer", inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: true }), true],
]) {
  ok(`${label}: record is ${expected}`, plan.record === expected, plan.record);
}

// ── Two different things the word "recording" hides ──────────────────────
//
// A CALL RECORDING captures a conversation between two people. Since
// 2026-09-17 every <Dial> in the route carries the attributes
// lib/sales/calls/recording.js hands out — dual-channel, from answer, posted
// to /api/rep-dial/recording — and there is still no environment variable:
// it is a decision, not a setting.
//
// A VOICEMAIL is one person talking to a machine after an announcement. It is
// the <Record> at the end of the queue, written to
// SalesCallAttempt.voicemailUrl and played on the superadmin floor board.
{
  const src = source(ROUTE);
  const dials = src.split("twiml.dial(").length - 1;
  ok("the route has <Dial>s to record", dials >= 2, dials);
  ok(
    "every <Dial> in the route records the conversation",
    (src.match(/\.\.\.dialRecordingAttrs\(/g) || []).length === dials,
    (src.match(/\.\.\.dialRecordingAttrs\(/g) || []).length,
  );
  ok(
    "…and no environment variable decides it",
    !/process\.env\.[A-Z_]*RECORD/.test(src),
  );
  ok(
    "the routing module states the decision on the connecting branch",
    /record: true/.test(source("lib/sales/calls/inboundRouting.js")),
  );
  // The voicemail half, asserted as strongly as the prohibition above: a
  // <Record> with a stage that exists, and a column something reads.
  ok("a caller who waited it out is offered a message", /twiml\.record\(/.test(src));
  ok("…posting to a stage this file handles", /stage=after-voicemail/.test(src) && /stage === "after-voicemail"/.test(src));
  ok("…which writes it to the row", /recordVoicemail\(/.test(src));
  ok("…and it is never transcribed, which is a per-minute charge", /transcribe: false/.test(src) && !/transcribe: true/.test(src));
  ok("…and something reads the column", /voicemailUrl/.test(source("app/platform/sales/floor/page.js")));

  // ── The "nobody free" branch takes the message too ──────────────────────
  //
  // INBOUND_MESSAGE (floor signed out, or no transfer destination) used to
  // fall into speak(), which said "we have logged your call" and hung up —
  // the action named "message" took none. Both real callbacks to the sales
  // line went that way. One <Record> builder now serves the queue's last stop
  // and this branch, so they cannot drift apart.
  ok(
    "an INBOUND_MESSAGE plan is answered with takeMessage, not speak",
    /if \(plan\.action === INBOUND_MESSAGE\) \{\s*return takeMessage\(plan\.say/.test(src),
  );
  ok("…and the branch runs before the generic refusal", src.indexOf("plan.action === INBOUND_MESSAGE") < src.indexOf("plan.action !== INBOUND_CONNECT"));
  ok("…with the attempt id, so the recording has a row to land on", /takeMessage\(plan\.say, \{ origin, attemptId: attempt\?\.id/.test(src));
  ok("there is exactly one <Record> builder in the route", (src.match(/twiml\.record\(/g) || []).length === 1);
  ok(
    "…and both the queue's last stop and takeMessage use it",
    /function takeMessage[\s\S]*?offerMessage\(twiml, \{ origin, attemptId \}\)/.test(src) &&
      /async function queueStage[\s\S]*?offerMessage\(twiml, \{ origin, attemptId: attempt\?\.id/.test(src),
  );
  ok(
    "the offer and the thank-you promise no callback",
    !/ring you back|call you back|get back to you/i.test(
      [/offerMessage\(twiml[\s\S]*?\n\}/.exec(src)?.[0] || "", /async function afterVoicemail[\s\S]*?\n\}/.exec(src)?.[0] || ""].join(" "),
    ),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. What the caller is told is true, and no callback is promised");

{
  const named = fallbackSayFor({ repName: "Daniel Okonkwo" });
  const bare = fallbackSayFor({});
  const all = [...named, ...bare].join(" ");

  ok("a rep who will actually see the row is named", named.join(" ").includes("Daniel"));
  ok("…by first name only", !named.join(" ").includes("Okonkwo"));
  ok("no rep means no name, rather than an invented one", !/undefined|null/.test(bare.join(" ")));
  ok("both say the call was written down", named.some((l) => /logged/i.test(l)) && bare.some((l) => /logged/i.test(l)));

  // The one thing this must never say. A callback is an OUTBOUND call: it has
  // to clear the calling window, the do-not-contact flag and the 24h cap, none
  // of which can be promised from inside an inbound webhook.
  ok(
    "nothing promises a callback",
    !/call you back|ring you back|get back to you|we will call|we'll call/i.test(all),
    all,
  );
  ok("nothing promises a time", !/within|shortly, someone|first thing/i.test(all));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. SalesSuppression binds, and answering is not a breach of it");

{
  const clean = inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: true, suppressed: false });
  const blocked = inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: true, suppressed: true });

  ok("a suppressed caller is still answered — they rang us", blocked.action === clean.action);
  ok("…and the suppression travels on the plan so it can be logged", blocked.suppressed === true);
  ok("…and an unsuppressed caller is not marked as one", clean.suppressed === false);
  ok(
    "the two hear the same words — there is no pitch to soften",
    JSON.stringify(blocked.fallbackSay) === JSON.stringify(clean.fallbackSay),
  );
}

{
  const src = source(ROUTE);
  ok("the route never writes to the suppression list", !/salesSuppression/.test(src));
  ok("…in either direction — nothing unsuppresses either", !/unsuppress/.test(src));
  ok("…and it DOES read it before deciding", /checkSuppression\(/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The gate's permitted writes are not widened by this path");

// The list is enumerated rather than counted, so an addition has to be a
// deliberate edit here naming the model — which is what happened when
// `salesCallTransfer` joined it with agent-to-agent transfer (a rep handing a
// live caller to a colleague: it names that rep and that attempt, moves no
// claim, contacts nobody new, decides no money). What must never change is the
// second half: nothing on this list can pay anybody.
const REP_CALL_WRITES_EXPECTED = [
  "salesCallAttempt",
  "salesCallTransfer",
  "salesRepActivity",
  "prospect",
  "salesLead",
  "salesSuppression",
  // "Call him on his cell" — a second number recorded on the call (6842dc80).
  // It names a number; it moves no money.
  "salesContactNumber",
];
ok(
  `REP_CALL_WRITES is exactly the ${REP_CALL_WRITES_EXPECTED.length} declared models`,
  REP_CALL_WRITES.length === REP_CALL_WRITES_EXPECTED.length &&
    REP_CALL_WRITES_EXPECTED.every((m) => REP_CALL_WRITES.includes(m)),
  REP_CALL_WRITES,
);
ok(
  "…and none of them decides who gets paid",
  ["salesAttribution", "salesCommissionEntry", "salesPayoutBatch", "salesRep", "company"].every(
    (m) => !REP_CALL_WRITES.includes(m),
  ),
  REP_CALL_WRITES,
);
ok(
  "the inbound route writes ONE model, and it is already on that list",
  (() => {
    const src = source(ROUTE);
    const writes = new Set();
    for (const m of src.matchAll(
      /\b(?:db|tx|client|prisma)\.([a-zA-Z]+)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g,
    )) {
      writes.add(m[1]);
    }
    // The route's only write goes through recordInbound/attachProviderCall in
    // the store, so a direct Prisma write appearing here at all is the thing
    // worth failing on.
    return writes.size === 0;
  })(),
);
ok(
  "…and the helpers it calls touch salesCallAttempt only",
  (() => {
    const inbound = fnBody("lib/sales/calls/store.js", "export async function recordInbound(");
    const models = new Set(
      [...inbound.matchAll(/\bclient\.([a-zA-Z]+)\./g)].map((m) => m[1]),
    );
    return models.size === 1 && models.has("salesCallAttempt");
  })(),
);
ok(
  "the inbound path never touches attribution, commission or payouts",
  !/salesAttribution|salesCommissionEntry|salesPayoutBatch/.test(source(ROUTE)),
);
ok(
  "…and never moves a claim",
  // `assignedRepId` legitimately appears in a SELECT — the match reads who
  // holds the claim in order to tell them their prospect rang, which
  // inboundMatch.js is explicit is a fact and not authority. What must not
  // appear is a write of it, or of the lease that goes with it.
  (() => {
    const src = source(ROUTE);
    const assigns = [...src.matchAll(/assignedRepId:\s*([A-Za-z0-9_."'+?.]+)/g)].map((m) => m[1]);
    // `true` is a SELECT. `numberRung.assignedRepId` / `numberRung?.assignedRepId`
    // is that selected value being handed to ringPlan as an argument — a read,
    // and the one the whole inbound distribution order is built on. Anything
    // else in this position would be a write.
    const READS = new Set(["true", "numberRung.assignedRepId", "numberRung?.assignedRepId"]);
    return (
      !/claimExpiresAt/.test(src) &&
      assigns.every((v) => READS.has(v)) &&
      !/db\.prospect\.(update|updateMany|upsert)/.test(src)
    );
  })(),
);

// ═══════════════════════════════════════════════════════════════════════════
section("8. Nothing in the request chooses who gets dialled");

{
  const body = fnBody(ROUTE, "async function handle(");
  ok(
    "the transfer destination comes from the environment",
    /process\.env\.FIELDQUO_SALES_TRANSFER_TO/.test(body),
  );
  // This used to read `dial.number(plan.transferTo)` — the shape from when the
  // only possible destination was one environment variable. inboundDistribution
  // replaced that with a ranked list, and the PROPERTY it was guarding is
  // unchanged: every destination comes off a plan this server built, never off
  // a request field. Asserted over the whole file, because the queue dials from
  // its own stage as well.
  ok(
    "…and every number dialled is the plan's, not a request field",
    (() => {
      const src = source(ROUTE);
      const dialled = [...src.matchAll(/dial\.(number|client)\(([^)]*)\)/g)].map((m) => m[2].trim());
      return (
        dialled.length > 0 &&
        dialled.every((arg) => arg === "target.value" || arg.startsWith("plan."))
      );
    })(),
  );
  ok(
    "the number rung selects a row and is not otherwise trusted",
    /salesVoiceNumber\(rung\)/.test(body),
  );
  ok(
    "a caller ID is only ever the caller or a number we own",
    /callerId: caller \|\| numberRung\.e164/.test(body),
  );
  ok(
    "the attempt id on the second leg travels in a URL we build, not in the body",
    /searchParams\.get\("attemptId"\)/.test(source(ROUTE)),
  );
}

ok(
  "FIELDQUO_SALES_TRANSFER_TO is documented for the owner",
  read("docs/VERCEL.md").includes("FIELDQUO_SALES_TRANSFER_TO"),
);

// ═══════════════════════════════════════════════════════════════════════════
section("9. Presence: one model, and three answers");

ok("no presence row at all is UNKNOWN, not absent", repIsLive(null) === null);
ok(
  "a rep who has never signed in is not live (their derived state is offline)",
  repIsLive({ everSeen: false, state: STATE_OFFLINE }) === false,
);
ok(
  "a stale row is not live, whatever it says",
  repIsLive({ everSeen: true, stale: true, state: STATE_AVAILABLE }) === false,
);
ok(
  "available and fresh is live",
  repIsLive({ everSeen: true, stale: false, state: STATE_AVAILABLE }) === true,
);
ok(
  "on a call is live",
  repIsLive({ everSeen: true, stale: false, state: STATE_ON_CALL }) === true,
);
ok(
  "paused is live — they are at work, just not at the phone",
  repIsLive({ everSeen: true, stale: false, state: STATE_PAUSED }) === true,
);
ok(
  "offline is not live",
  repIsLive({ everSeen: true, stale: false, state: STATE_OFFLINE }) === false,
);

ok("an unreadable presence table is null, not an empty floor", anyRepLive(null) === null);
ok("a floor with no reps is a measured false", anyRepLive([]) === false);
ok(
  "one live rep is enough",
  anyRepLive([
    { salesRepId: "a", presence: { everSeen: true, stale: false, state: STATE_OFFLINE } },
    { salesRepId: "b", presence: { everSeen: true, stale: false, state: STATE_AVAILABLE } },
  ]) === true,
);
ok(
  "a floor of stale rows is not a live floor",
  anyRepLive([{ salesRepId: "a", presence: { everSeen: true, stale: true, state: STATE_AVAILABLE } }]) ===
    false,
);
ok(
  "the routing module does not invent a second presence vocabulary",
  !/available|on_call|after_call/.test(
    fnBody("lib/sales/calls/inboundRouting.js", "export function repIsLive("),
  ),
);

// ═══════════════════════════════════════════════════════════════════════════
section("10. The transfer's outcome");

{
  const plan = inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: true, rep: { id: "r1", name: "Daniel" } });

  const answered = afterTransfer({ dialCallStatus: "completed", plan });
  ok("a completed transfer counts as answered", answered.answered === true);
  ok("…and says nothing more to a caller who has hung up", answered.say.length === 0);

  for (const status of ["no-answer", "busy", "failed", "canceled"]) {
    const r = afterTransfer({ dialCallStatus: status, plan });
    ok(`${status}: not answered, and the caller is told`, r.answered === false && r.say.length > 0);
    ok(
      `${status}: told the same thing the message branch would have said`,
      JSON.stringify(r.say) === JSON.stringify(plan.fallbackSay),
    );
  }

  const missing = afterTransfer({ dialCallStatus: null, plan: null });
  ok("a missing status is not treated as answered", missing.answered === false);
  ok("…and still says something", missing.say.length > 0);
  ok("…and still promises no callback", !/call you back|we will call/i.test(missing.say.join(" ")));
}

{
  const body = fnBody(ROUTE, "async function afterDial(");
  ok("the second leg records what the carrier reported", /attachProviderCall\(/.test(body));
  ok(
    "…and never writes a disposition — that is the rep's account, not the network's",
    !/disposition/.test(body),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. The row: direction, and the cap it must not consume");

// A scriptable client. Every store function takes one, so the real shipped
// function runs and the assertion is about the argument it passed to Prisma.
function stubClient({ attempts = [], numbers = [] } = {}) {
  const calls = [];
  return {
    calls,
    salesCallAttempt: {
      findMany: async (args) => {
        calls.push(["findMany", args]);
        return attempts.filter((a) => {
          if (args.where.direction && a.direction !== args.where.direction) return false;
          if (args.where.toE164 && a.toE164 !== args.where.toE164) return false;
          return true;
        });
      },
      findFirst: async (args) => {
        calls.push(["findFirst", args]);
        return (
          attempts.find((a) => {
            const w = args.where || {};
            if (w.direction && a.direction !== w.direction) return false;
            if (w.toE164 && a.toE164 !== w.toE164) return false;
            if (w.fromE164 && a.fromE164 !== w.fromE164) return false;
            return true;
          }) || null
        );
      },
      create: async (args) => {
        calls.push(["create", args]);
        return { id: "att_new", ...args.data };
      },
      upsert: async (args) => {
        calls.push(["upsert", args]);
        return { id: "att_up", dialledAt: args.create.dialledAt, ...args.create };
      },
    },
    // Present so callStoreState()'s probe finds it. The store answers "are the
    // tables there" from the generated client rather than from a constant, and
    // a stub missing this delegate would make every write below refuse for a
    // reason that has nothing to do with what is being tested.
    salesRepActivity: {
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
    platformSmsNumber: {
      findFirst: async (args) => {
        calls.push(["number.findFirst", args]);
        const w = args.where || {};
        // Prisma shapes the store now uses: `purpose: { in: [...] }` and
        // `voiceUrl: { not: null }`. A stub that ignored either would let a
        // text-only Sales number "answer" a ring-back it cannot take.
        const purposeOk = (n) =>
          w.purpose && typeof w.purpose === "object" ? w.purpose.in.includes(n.purpose) : n.purpose === w.purpose;
        const voiceOk = (n) => (w.voiceUrl && w.voiceUrl.not === null ? n.voiceUrl != null : true);
        return numbers.find((n) => n.e164 === w.e164 && purposeOk(n) && n.active === w.active && voiceOk(n)) || null;
      },
    },
  };
}

{
  const client = stubClient();
  const res = await recordInbound({
    salesRepId: "rep1",
    prospectId: "p1",
    contactE164: CALLER,
    ourE164: OUR_NUMBER.e164,
    providerCallSid: "CA123",
    matchedBy: "phone_e164",
    now: NOW,
    client,
  });
  const write = client.calls.find((c) => c[0] === "upsert");
  const data = write?.[1]?.create || {};

  ok("an inbound call is written", res.ok === true);
  ok("…with direction 'in'", data.direction === "in", data.direction);
  ok("…on its own dial channel, not claimed as a browser dial", data.dialChannel === "inbound");
  ok(
    "…with toE164 the CONTRACTOR, so the cap and callback tracker key on the right number",
    data.toE164 === CALLER,
    data.toE164,
  );
  ok("…and fromE164 the number of ours they rang", data.fromE164 === OUR_NUMBER.e164);
  ok("…recording HOW the caller was matched", data.matchedBy === "phone_e164");
  ok(
    "…and never as a cleared calling decision",
    data.decisionAtDial === "inbound",
    data.decisionAtDial,
  );
  ok("…carrying no jurisdiction, because none was evaluated", !data.jurisdictionCode);
  ok(
    "…keyed on Twilio's CallSid so a webhook retry is not a second call",
    write?.[1]?.where?.providerCallSid === "CA123" &&
      Object.keys(write?.[1]?.update || {}).length === 0,
  );
}

{
  // No CallSid is not a reason to lose the row.
  const client = stubClient();
  await recordInbound({ contactE164: CALLER, ourE164: OUR_NUMBER.e164, now: NOW, client });
  ok(
    "with no CallSid it still writes, as a plain create",
    client.calls.some((c) => c[0] === "create"),
  );
}

{
  const client = stubClient();
  const res = await recordInbound({
    contactE164: null,
    ourE164: OUR_NUMBER.e164,
    now: NOW,
    client,
  });
  const data = (client.calls.find((c) => c[0] === "create") || [])[1]?.data || {};
  ok("a withheld caller ID still produces a row", res.ok === true);
  ok(
    "…and the placeholder is NOT a plausible phone number",
    data.toE164 === WITHHELD_NUMBER && normalisePhone(data.toE164) === null,
    data.toE164,
  );
  ok("…and nothing claims it was matched", !data.matchedBy);
}

{
  const client = stubClient();
  const res = await recordInbound({ contactE164: CALLER, ourE164: null, client });
  ok("a row with no number of ours is refused", res.ok === false && res.attempt === null);
}

{
  // An inbound row may have no rep. An OUTBOUND one may not, and recordDial
  // still says so — the property the nullable column must not have loosened.
  const client = stubClient();
  const res = await recordDial({
    salesRepId: null,
    toE164: CALLER,
    readiness: { decision: "allowed" },
    client,
  });
  ok(
    "an outbound attempt with no rep is still refused",
    res.ok === false && /belong to a rep/i.test(res.error),
    res.error,
  );
  ok("…and nothing was written", !client.calls.some((c) => c[0] === "create"));
}

{
  const client = stubClient();
  await recordDial({
    salesRepId: "rep1",
    toE164: CALLER,
    readiness: { decision: "allowed" },
    now: NOW,
    client,
  });
  const data = (client.calls.find((c) => c[0] === "create") || [])[1]?.data || {};
  ok("an outbound attempt is still written as direction 'out'", data.direction === "out");
}

{
  // The cap. Three inbound calls from one contractor must not spend the three
  // outbound calls Oklahoma and Florida allow.
  const attempts = [
    { toE164: CALLER, direction: "in", dialledAt: new Date(NOW.getTime() - 1000) },
    { toE164: CALLER, direction: "in", dialledAt: new Date(NOW.getTime() - 2000) },
    { toE164: CALLER, direction: "in", dialledAt: new Date(NOW.getTime() - 3000) },
    { toE164: CALLER, direction: "out", dialledAt: new Date(NOW.getTime() - 4000) },
  ];
  const client = stubClient({ attempts });
  const n = await attemptsLast24h(CALLER, { now: NOW, client });
  ok("the 24-hour cap counts calls FieldQuo PLACED", n === 1, n);
  ok(
    "…and the query says so, rather than filtering afterwards",
    /direction: "out"/.test(fnBody("lib/sales/calls/store.js", "export async function attemptsLast24h(")),
  );
  ok("…and null is still not zero", (await attemptsLast24h("nonsense", { now: NOW, client })) === null);
}

{
  const attempts = [
    { id: "a1", toE164: CALLER, fromE164: OUR_NUMBER.e164, direction: "out", salesRepId: "rep1" },
  ];
  const client = stubClient({ attempts });
  const row = await lastOutboundBetween({
    contactE164: CALLER,
    ourE164: OUR_NUMBER.e164,
    client,
  });
  ok("the rep who rang them from this number is findable", row?.salesRepId === "rep1");
  const q = client.calls.find((c) => c[0] === "findFirst")?.[1]?.where || {};
  ok("…matched on the PAIR, not on the caller alone", q.toE164 === CALLER && q.fromE164 === OUR_NUMBER.e164);
  ok("…and only against calls we placed", q.direction === "out");
  ok(
    "an unreadable number matches nothing rather than everything",
    (await lastOutboundBetween({ contactE164: "withheld", ourE164: OUR_NUMBER.e164, client })) === null,
  );
}

{
  const client = stubClient({ numbers: [OUR_NUMBER, TEAM_NUMBER, OLD_TEXT_ONLY, { ...OUR_NUMBER, e164: "+15145550111", purpose: "system" }] });
  const row = await salesVoiceNumber(OUR_NUMBER.e164, { client });
  ok("a sales_voice number resolves", row?.e164 === OUR_NUMBER.e164);
  const q = client.calls.find((c) => c[0] === "number.findFirst")?.[1]?.where || {};
  ok("…scoped to BOTH voice purposes in the query — the team's Sales number calls too",
    Array.isArray(q.purpose?.in) && q.purpose.in.includes("sales") && q.purpose.in.includes("sales_voice"), q.purpose);
  ok("…and to a row that carries a voice webhook", q.voiceUrl?.not === null, q.voiceUrl);
  ok("the team's Sales number (bought with both webhooks) resolves",
    (await salesVoiceNumber(TEAM_NUMBER.e164, { client }))?.e164 === TEAM_NUMBER.e164);
  ok("a Sales number bought text-only, before the change, does NOT — Twilio would not ring the route for it",
    (await salesVoiceNumber(OLD_TEXT_ONLY.e164, { client })) === null);
  ok("…and to an active number", q.active === true);
  ok(
    "a tenant-serving system number is NOT a sales voice number",
    (await salesVoiceNumber("+15145550111", { client })) === null,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. An inbound row is not a dial, and no report counts it as one");

{
  const from = new Date("2026-09-04T00:00:00Z");
  const attempts = [
    { id: "o1", direction: "out", dialledAt: NOW, toE164: CALLER, disposition: "reached_interested" },
    { id: "o2", direction: "out", dialledAt: NOW, toE164: CALLER },
    { id: "i1", direction: "in", dialledAt: NOW, toE164: CALLER },
    { id: "i2", direction: "in", dialledAt: NOW, toE164: CALLER },
    { id: "i3", direction: "in", dialledAt: NOW, toE164: CALLER },
  ];
  const stats = repCallStats({ attempts, from, to: NOW, now: NOW });
  ok("dials counts only what the rep placed", stats.dials === 2, stats.dials);
  ok("callbacks received are counted, and separately", stats.callbacksReceived === 3);
  ok(
    "the outcomes cover both directions — a logged callback is a real conversation",
    stats.dispositions.total === 5,
    stats.dispositions.total,
  );

  const campaigns = campaignCallRows({ attempts, from, to: NOW });
  ok("a campaign's dial count excludes callbacks too", campaigns[0].dials === 2, campaigns[0].dials);
  ok("…and reports them beside it", campaigns[0].callbacksReceived === 3);

  // A row written before the column had a second value carries the default.
  const legacy = repCallStats({ attempts: [{ id: "x", dialledAt: NOW }], from, to: NOW, now: NOW });
  ok("a row with no direction at all counts as a dial, not as a callback", legacy.dials === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
section("13. The match may put a card on a screen and nothing more");

{
  // inboundMatch.js already has its own executed checks. What is asserted here
  // is the one thing this feature could have quietly broken: that an ambiguous
  // match attaches the call to NOBODY rather than to a guess.
  const two = matchInboundCaller({
    fromE164: CALLER,
    prospects: [
      { id: "p1", businessName: "Tulsa Roofing" },
      { id: "p2", businessName: "Tulsa Roofing LLC" },
    ],
  });
  ok("two businesses on one number is ambiguous", two.outcome === "ambiguous");
  ok("…and attaches to neither", two.prospectId === null && two.salesRepId === null);

  const client = stubClient();
  await recordInbound({
    prospectId: two.prospectId,
    leadId: two.salesLeadId,
    contactE164: CALLER,
    ourE164: OUR_NUMBER.e164,
    matchedBy: two.matchedBy,
    now: NOW,
    client,
  });
  const data = (client.calls.find((c) => c[0] === "create") || [])[1]?.data || {};
  ok("…so the row names no business", data.prospectId === null && data.leadId === null);
  ok("…and does not claim a match was made", data.matchedBy === null);
}

{
  const body = fnBody(ROUTE, "async function handle(");
  ok(
    "the rep who rang them wins over the claim holder",
    /repToTell\(\[lastOut\?\.salesRepId, match\.salesRepId\]\)/.test(body),
  );
  const rep = fnBody(ROUTE, "async function repToTell(");
  ok(
    "…and a rep who has left is not chosen, so the row is not filed where nobody looks",
    /canAuthenticate\(/.test(rep),
  );
  ok("…re-read fresh from the database, not carried", /db\.salesRep\s*\n?\s*\.findUnique\(/.test(rep));
}

// ═══════════════════════════════════════════════════════════════════════════
section("14. The write is read: the floor board shows what came in");

{
  const routeSrc = source("app/api/platform/sales/floor/route.js");
  ok("the floor route reads inbound calls", /inboundCalls\(/.test(routeSrc));
  ok(
    "…by direction, so a call that matched no rep is still visible",
    /direction: "in"/.test(
      fnBody("lib/sales/calls/store.js", "export async function inboundCalls("),
    ),
  );
  ok(
    "…and distinguishes 'we could not look' from 'nobody rang'",
    /inbound === undefined\s*\n?\s*\? null/.test(routeSrc),
  );

  const page = source("app/platform/sales/floor/page.js");
  ok("the page renders them", /data\.inboundCalls/.test(page));
  ok("…and renders the null case as a gap rather than a zero", /inboundCalls === null/.test(page));
  ok("…and says which rep it was filed for", /repName/.test(page));
  ok("…and prints the sales_voice state beside the agent's", /data\.salesVoice/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
section("14b. A sales_voice number can actually be BOUGHT");
//
// Everything above reads a purpose-"sales_voice" row — the caller id a rep
// dials from, the number a contractor rings back, the pool the floor page
// reports — and section 15's sentence tells the owner to "buy one under Crew
// lines with the purpose set to Sales voice". For weeks nothing could write
// one: PLATFORM_NUMBER_PURPOSES did not name it, the page did not offer it, and
// no path created a row with it. An instruction pointing at a control that did
// not exist — the failure AGENTS.md opens with — found the day the owner's
// Twilio profile was approved and calling still could not go green. This
// section holds the purchase path to the read path, so the two cannot drift
// apart again.
{
  const buy = source("lib/crew/platformNumber.js");
  // Declaration order is load-bearing: the row written after the try stores
  // voiceUrl. Declared INSIDE the try it is out of scope by then — a
  // ReferenceError thrown after Twilio has sold the number and before the row
  // exists, on every purchase. The build's no-undef pass refused the first
  // version; this holds the fix, because a tidy-up that moves the consts back
  // "closer to where they are used" would reintroduce it without a lint run.
  ok("smsUrl and voiceUrl are resolved BEFORE the try that buys, not inside it", (() => {
    const v = buy.indexOf("const voiceUrl = voiceWebhookUrlFor(purpose, origin);");
    const s = buy.indexOf("const smsUrl = webhookUrlFor(purpose, origin);");
    const t = buy.indexOf("let bought;");
    return v > -1 && s > -1 && t > -1 && v < t && s < t;
  })());
  ok(
    "sales_voice is a purpose the purchase path accepts",
    /PLATFORM_NUMBER_PURPOSES = \[[^\]]*"sales_voice"/.test(buy),
  );
  ok(
    "…bought with its VOICE webhook pointed at the route that answers a ring-back — for BOTH voice purposes",
    /VOICE_PURPOSES = Object\.freeze\(\["sales", "sales_voice"\]\)/.test(buy) &&
      /VOICE_PURPOSES\.includes\(purpose\) \? `\$\{base\}\/api\/rep-dial\/inbound` : null/.test(buy),
  );
  // The purchase side and the read side name the same two purposes. Held
  // together here because a purpose bought with a voice webhook that the
  // store does not name would ring a route that refuses to know the number.
  const store = source("lib/sales/calls/store.js");
  ok(
    "the store's SALES_VOICE_PURPOSES is the purchase side's VOICE_PURPOSES, verbatim",
    /SALES_VOICE_PURPOSES = Object\.freeze\(\["sales", "sales_voice"\]\)/.test(store),
  );
  ok(
    "…and the caller-id pool also requires a voice webhook on the row",
    /purpose: \{ in: SALES_VOICE_PURPOSES \}, active: true, voiceUrl: \{ not: null \}/.test(store) &&
      (store.match(/voiceUrl: \{ not: null \}/g) || []).length >= 2,
  );
  ok(
    "the Sales option says it calls AND texts, and Sales voice says call-only",
    /reps call and text from it; contractors ring it back/.test(source("app/platform/crew-lines/page.js")) &&
      /call-only, for a second number/.test(source("app/platform/crew-lines/page.js")),
  );
  ok(
    "…and the webhook is passed to Twilio only when there is one",
    /\.\.\.\(voiceUrl \? \{ voiceUrl, voiceMethod: "POST" \} : \{\}\)/.test(buy),
  );
  ok(
    "…and stored on the row, so the inbound route can prove the number is ours",
    /create: \{[^}]*voiceUrl[^}]*\}/.test(buy) && /update: \{[^}]*voiceUrl[^}]*\}/.test(buy),
  );
  ok(
    "a sales_voice number gets NO sms webhook (a text to it would be filed under nobody)",
    /if \(purpose === "sales_voice"\) return null;/.test(buy),
  );
  const crewLines = source("app/platform/crew-lines/page.js");
  ok("the crew-lines page offers the purpose", /<option value="sales_voice">/.test(crewLines));
  ok(
    "…and the purchase copy says texts to it are not delivered, rather than letting the owner find out",
    /texts to it are not delivered/.test(crewLines),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("15. What a superadmin is told about the pool");

{
  ok(
    "no numbers held is its own state, and says where to buy one",
    (() => {
      const s = salesVoiceInboundState({ numbers: [] });
      return s.state === "none" && /Twilio numbers/.test(s.text);
    })(),
  );
  ok(
    "a failed lookup is NOT the same as holding none",
    salesVoiceInboundState({ numbers: [], lookupFailed: true }).state === "unknown",
  );
  // Rewritten 2026-09-17 on the owner's verdict: the browsers ring whether
  // or not a desk phone is set, so the paragraph no longer names
  // FIELDQUO_SALES_TRANSFER_TO as missing — a fallback nobody uses is not a
  // fault. scripts/check-sales-costs.mjs asserts the sentence itself.
  ok(
    "numbers held with no transfer destination says who rings, and does NOT name the transfer variable as missing",
    (() => {
      const s = salesVoiceInboundState({ numbers: [OUR_NUMBER.e164], transferConfigured: false, anyLive: true });
      return s.state === "connects" && /number's owner/.test(s.text) && !/FIELDQUO_SALES_TRANSFER_TO/.test(s.text) && !/Nobody can be put through/.test(s.text);
    })(),
  );
  ok(
    "…and with one set, says a desk phone rings after the browsers",
    /desk phone rings after the browsers/.test(salesVoiceInboundState({ numbers: [OUR_NUMBER.e164], transferConfigured: true, anyLive: true }).text),
  );
  ok(
    "an empty floor is said out loud rather than shown as working",
    salesVoiceInboundState({
      numbers: [OUR_NUMBER.e164],
      transferConfigured: true,
      anyLive: false,
    }).state === "floor_empty",
  );
  ok(
    "a live floor with a destination is the only 'connects' state",
    salesVoiceInboundState({
      numbers: [OUR_NUMBER.e164],
      transferConfigured: true,
      anyLive: true,
    }).state === "connects",
  );
  // The paste-this-URL sentence left with the per-number table (2026-09-17):
  // the configuration is read live from Twilio on /platform/crew-lines and a
  // misconfigured number produces a warning line instead. The URL is still
  // carried on the answer for that page.
  ok(
    "the webhook URL travels on the answer, and the paragraph warns only when a number is misconfigured",
    (() => {
      const s = salesVoiceInboundState({
        numbers: [OUR_NUMBER.e164],
        transferConfigured: true,
        anyLive: true,
        webhookUrl: "https://app.fieldquo.com/api/rep-dial/inbound",
        misconfigured: 0,
      });
      const bad = salesVoiceInboundState({ numbers: [OUR_NUMBER.e164], anyLive: true, misconfigured: 1 });
      return s.webhookUrl === "https://app.fieldquo.com/api/rep-dial/inbound" && s.warning === null && /misconfigured/.test(bad.warning);
    })(),
  );
  ok(
    "…and does not print a half-built URL when the origin is unknown",
    !/undefined|null/.test(
      salesVoiceInboundState({ numbers: [OUR_NUMBER.e164], transferConfigured: true }).text,
    ),
  );
}

ok(
  "the webhook URL is built from the origin, with no doubled slash",
  inboundWebhookUrl("https://app.fieldquo.com/") === "https://app.fieldquo.com/api/rep-dial/inbound",
);
ok("no origin means no URL, rather than a relative one", inboundWebhookUrl(null) === null);

ok(
  "the rep-admin screen no longer claims nothing answers a callback",
  /the rep who last called them from that number/.test(read("lib/sales/repAdmin.js")),
);

// ═══════════════════════════════════════════════════════════════════════════
section("16. Twilio is answered with a document, never with an error");

{
  const src = source(ROUTE);
  // Twilio plays "an application error has occurred" on a non-2xx, which is
  // the worst thing a prospect can hear on a number a salesperson gave them.
  // The only non-200 in the file is the 403 for an unsigned request, which
  // Twilio itself never sees.
  const statuses = [...src.matchAll(/status:\s*(\d{3})/g)].map((m) => m[1]);
  // 204 is the status-callback acknowledgement (`?stage=status`): Twilio is
  // not waiting for TwiML there, and an empty 2xx is what it expects.
  ok(
    "every answer is a 200 except the unsigned refusal and the status-callback ack",
    statuses.every((s) => s === "200" || s === "403" || s === "204"),
    statuses,
  );
  ok(
    "…and the 204s are all inside the status stage",
    (() => {
      const stage = fnBody(ROUTE, "async function statusStage(");
      const inStage = [...stage.matchAll(/status:\s*204/g)].length;
      return inStage > 0 && inStage === statuses.filter((s) => s === "204").length;
    })(),
  );
  ok(
    "a failure to record the call does not drop it",
    /recordInbound\([\s\S]*?\.catch\(/.test(src),
  );
  ok("…and is recorded for a human", /area: "sales_inbound"/.test(src));
  ok(
    "a call to a number we do not hold is logged, not silently dropped",
    /code: "unknown_number"/.test(src),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("17. The route itself, executed: every ring-back ends in one of three records");

// ── Why the route is now RUN and not only read ───────────────────────────
//
// The header above says the route "imports next/server and the Twilio SDK,
// and standing those up here would test the harness". Both import cleanly
// under bare node, and on 2026-09-17 the thing that was wrong was not in any
// pure function: it was the ORDER of two checks inside POST — the plan's
// action was consulted before the ring plan existed — which no pure test
// could see and section 3 had asserted as correct. So the shipped handler is
// driven here with signed Twilio-shaped requests against an in-memory
// client, and the assertions are about what ended up in the rows and what
// was pushed. The four cases the owner named: rep answers; rep absent →
// voicemail; rep absent, caller hangs up first → missed-call row + push;
// bad signature → error-log row.

process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "check-sales-inbound-token";
process.env.NEXT_PUBLIC_APP_URL = "https://www.fieldquo.com";
delete process.env.FIELDQUO_SALES_TRANSFER_TO;

const twilio = (await import("twilio")).default;
const { POST } = await import("@/app/api/rep-dial/inbound/route");
const { sweepMissedInbound, MISSED_SWEEP_AFTER_SECONDS, inboundOutcome } = await import("@/lib/sales/calls/missed");
const { HISTORY_SELECT, callHistoryRows } = await import("@/lib/sales/calls/history");
const { MAX_QUEUE_ROUNDS, maxHoldSeconds } = await import("@/lib/sales/calls/queue");

/** A small Prisma-shaped in-memory client: the models the route touches. */
function memoryDb(seed = {}) {
  let n = 0;
  const tables = {
    salesCallAttempt: [...(seed.salesCallAttempt || [])],
    salesRepActivity: [...(seed.salesRepActivity || [])],
    salesRep: [...(seed.salesRep || [])],
    platformSmsNumber: [...(seed.platformSmsNumber || [])],
    prospect: [...(seed.prospect || [])],
    salesLead: [...(seed.salesLead || [])],
    platformErrorLog: [],
    salesSuppression: [],
    salesCallTransfer: [],
  };
  const relations = {
    salesCallAttempt: { salesRep: ["salesRep", "salesRepId"], prospect: ["prospect", "prospectId"], lead: ["salesLead", "leadId"] },
    platformSmsNumber: { assignedRep: ["salesRep", "assignedRepId"] },
  };
  function matchValue(actual, cond) {
    if (cond === null) return actual === null || actual === undefined;
    if (cond instanceof Date) return actual instanceof Date && actual.getTime() === cond.getTime();
    if (typeof cond !== "object") return actual === cond;
    if (Array.isArray(cond.in)) return cond.in.includes(actual);
    if ("not" in cond) return cond.not === null ? actual !== null && actual !== undefined : actual !== cond.not;
    const t = actual instanceof Date ? actual.getTime() : actual;
    const v = (x) => (x instanceof Date ? x.getTime() : x);
    if ("gte" in cond && !(t >= v(cond.gte))) return false;
    if ("gt" in cond && !(t > v(cond.gt))) return false;
    if ("lte" in cond && !(t <= v(cond.lte))) return false;
    if ("lt" in cond && !(t < v(cond.lt))) return false;
    return true;
  }
  function matches(row, where = {}) {
    for (const [k, cond] of Object.entries(where)) {
      if (k === "OR") { if (!cond.some((w) => matches(row, w))) return false; continue; }
      if (k === "AND") { if (!cond.every((w) => matches(row, w))) return false; continue; }
      if (cond && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date) && !("in" in cond) && !("not" in cond) && !("gte" in cond) && !("gt" in cond) && !("lte" in cond) && !("lt" in cond)) {
        continue; // a nested relation filter: not modelled, and not used by the route
      }
      if (!matchValue(row[k], cond)) return false;
    }
    return true;
  }
  function project(model, row, select) {
    if (!row) return null;
    const out = { ...row };
    const rel = relations[model] || {};
    for (const [field, [table, key]] of Object.entries(rel)) {
      if (select && select[field]) out[field] = tables[table].find((r) => r.id === row[key]) || null;
      else delete out[field];
    }
    return out;
  }
  function sortBy(rows, orderBy) {
    if (!orderBy) return rows;
    const [[k, dir]] = Object.entries(orderBy);
    return [...rows].sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (dir === "desc" ? -1 : 1));
  }
  const api = {};
  for (const model of Object.keys(tables)) {
    api[model] = {
      findMany: async ({ where = {}, orderBy, take, select } = {}) => {
        let rows = sortBy(tables[model].filter((r) => matches(r, where)), orderBy);
        if (take) rows = rows.slice(0, take);
        return rows.map((r) => project(model, r, select));
      },
      findFirst: async ({ where = {}, orderBy, select } = {}) =>
        project(model, sortBy(tables[model].filter((r) => matches(r, where)), orderBy)[0] || null, select),
      findUnique: async ({ where = {}, select } = {}) =>
        project(model, tables[model].find((r) => matches(r, where)) || null, select),
      count: async ({ where = {} } = {}) => tables[model].filter((r) => matches(r, where)).length,
      create: async ({ data }) => {
        const row = { id: `${model}_${++n}`, createdAt: new Date(), ...data };
        tables[model].push(row);
        return { ...row };
      },
      upsert: async ({ where, create }) => {
        const existing = tables[model].find((r) => matches(r, where));
        if (existing) return { ...existing };
        const row = { id: `${model}_${++n}`, createdAt: new Date(), ...create };
        tables[model].push(row);
        return { ...row };
      },
      updateMany: async ({ where = {}, data }) => {
        let count = 0;
        for (const r of tables[model]) if (matches(r, where)) { Object.assign(r, data); count++; }
        return { count };
      },
    };
  }
  api.$tables = tables;
  return api;
}

const ORIGIN = "https://www.fieldquo.com";
function signedRequest(path, params, { badSignature = false } = {}) {
  const url = `${ORIGIN}${path}`;
  const sig = badSignature ? "not-the-signature" : twilio.getExpectedTwilioSignature(process.env.TWILIO_AUTH_TOKEN, url, params);
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": sig },
    body: new URLSearchParams(params).toString(),
  });
}
async function post(path, params, opts) {
  const res = await POST(signedRequest(path, params, opts));
  return { status: res.status, body: await res.text() };
}
const attr = (xml, tag, name) => {
  const m = new RegExp(`<${tag}[^>]*\\s${name}="([^"]*)"`).exec(xml);
  return m ? m[1].replace(/&amp;/g, "&") : null;
};

const REP = { id: "rep_owner", name: "Favor", active: true, endedAt: null, acceptedAt: NOW, kind: "rep", passwordHash: "x", language: "en", sellsIn: [], lastSeenAt: NOW };
const OTHER = { id: "rep_other", name: "Daniel", active: true, endedAt: null, acceptedAt: NOW, kind: "rep", passwordHash: "x", language: "fr", sellsIn: [], lastSeenAt: NOW };
const LINE = { id: "num_1", e164: TEAM_NUMBER.e164, purpose: "sales", active: true, voiceUrl: `${ORIGIN}/api/rep-dial/inbound`, assignedRepId: REP.id, assignedAdminId: null };
const POOL_LINE = { id: "num_2", e164: OUR_NUMBER.e164, purpose: "sales_voice", active: true, voiceUrl: `${ORIGIN}/api/rep-dial/inbound`, assignedRepId: null, assignedAdminId: null };
const BUSINESS = { id: "pr_1", businessName: "Benchmark Painting", phoneE164: CALLER, assignedRepId: REP.id, province: "ON" };
const available = (repId, at = new Date()) => ({ id: `act_${repId}`, salesRepId: repId, state: "available", startedAt: new Date(at.getTime() - 60_000), endedAt: null, heartbeatAt: at });
const NEW_CALL = (sid) => ({ CallSid: sid, To: TEAM_NUMBER.e164, From: CALLER, CallStatus: "ringing", Direction: "inbound" });

function scenario(seed) {
  globalThis.__pushes = [];
  const client = memoryDb(seed);
  globalThis.__inboundDb = client;
  return client;
}
const pushes = () => globalThis.__pushes || [];

// ── A. The rep answers ───────────────────────────────────────────────────
{
  const client = scenario({
    salesRep: [REP, OTHER],
    platformSmsNumber: [LINE],
    prospect: [BUSINESS],
    salesRepActivity: [available(REP.id)],
  });
  const first = await post("/api/rep-dial/inbound", NEW_CALL("CA_answer"));
  const dialAction = attr(first.body, "Dial", "action");
  const row = client.$tables.salesCallAttempt[0];
  ok("A. a ring-back to an owned number rings a browser client", first.status === 200 && /<Client>/.test(first.body), first.body);
  ok("A. …the owner's, first", new RegExp(`<Client>[^<]*${REP.id}`).test(first.body));
  ok("A. …WITHOUT any transfer number configured", !process.env.FIELDQUO_SALES_TRANSFER_TO && /<Dial/.test(first.body));
  ok("A. …and the attempt row is written before anybody answers", row && row.direction === "in" && row.providerCallSid === "CA_answer" && row.salesRepId === REP.id);
  ok("A. …with the caller as the other party and our line as ours", row?.toE164 === CALLER && row?.fromE164 === TEAM_NUMBER.e164);
  ok("A. …and the rep's browser is pushed 'Incoming call' with the business name", pushes().some((p) => p.salesRepIds.includes(REP.id) && p.title === "Incoming call" && p.body === "Benchmark Painting"), pushes());
  const after = new URL(dialAction);
  const answered = await post(after.pathname + after.search, { CallSid: "CA_answer", DialCallStatus: "completed", DialCallDuration: "42" });
  ok("A. the after-dial callback records the answer", answered.status === 200 && row.answeredAt instanceof Date && row.talkSeconds === 42);
  ok("A. …and the outcome reads 'answered'", inboundOutcome(row) === "answered");
  const status = await post("/api/rep-dial/inbound?stage=status", { CallSid: "CA_answer", CallStatus: "completed", CallDuration: "42" });
  ok("A. the number's status callback is a 204 and does not turn an answered call into a miss", status.status === 204 && !row.missedAt && inboundOutcome(row) === "answered");
  ok("A. …and pushes nothing more", !pushes().some((p) => p.title === "Missed call"));
}

// ── B. The rep is absent and the caller leaves a message ────────────────
{
  const client = scenario({
    salesRep: [REP, OTHER],
    platformSmsNumber: [POOL_LINE],
    prospect: [BUSINESS],
    // The rep rang them two hours ago and has been gone since; the floor
    // is empty.
    salesCallAttempt: [{ id: "out_1", direction: "out", salesRepId: REP.id, toE164: CALLER, fromE164: OUR_NUMBER.e164, dialledAt: new Date(Date.now() - 2 * 3600e3), dialChannel: "browser" }],
    salesRepActivity: [],
  });
  const params = { ...NEW_CALL("CA_vm"), To: OUR_NUMBER.e164 };
  const first = await post("/api/rep-dial/inbound", params);
  const row = client.$tables.salesCallAttempt.find((r) => r.providerCallSid === "CA_vm");
  ok("B. an empty floor is not rung; the caller is offered a message", first.status === 200 && !/<Dial/.test(first.body) && /<Record/.test(first.body), first.body);
  ok("B. …and the row is filed to the rep who rang them", row?.salesRepId === REP.id);
  const recAction = attr(first.body, "Record", "action");
  ok("B. …with the recording callback carrying the attempt id", recAction && recAction.includes(`attemptId=${row.id}`), recAction);
  const u = new URL(recAction);
  const left = await post(u.pathname + u.search, { CallSid: "CA_vm", RecordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC1/Recordings/RE1", RecordingDuration: "12" });
  ok("B. the message is attached to the row", left.status === 200 && row.voicemailUrl?.endsWith("/RE1") && row.voicemailSeconds === 12);
  ok("B. …the outcome reads 'voicemail'", inboundOutcome(row) === "voicemail");
  await new Promise((r) => setTimeout(r, 10));
  const vmPush = pushes().find((p) => p.title === "New voicemail");
  ok("B. …and the rep is pushed 'New voicemail' naming the business and the length", Boolean(vmPush) && vmPush.salesRepIds.includes(REP.id) && /Benchmark Painting/.test(vmPush.body) && /12/.test(vmPush.body), vmPush);
  const again = await post(u.pathname + u.search, { CallSid: "CA_vm", RecordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC1/Recordings/RE1", RecordingDuration: "12" });
  await new Promise((r) => setTimeout(r, 10));
  ok("B. a Twilio retry of the recording callback does not push twice", again.status === 200 && pushes().filter((p) => p.title === "New voicemail").length === 1);
  await post("/api/rep-dial/inbound?stage=status", { CallSid: "CA_vm", CallStatus: "completed" });
  ok("B. the status callback after a voicemail marks nothing missed", !row.missedAt && inboundOutcome(row) === "voicemail" && !pushes().some((p) => p.title === "Missed call"));
  const hist = callHistoryRows([{ ...row, direction: "in" }], { repId: REP.id })[0];
  ok("B. the rep's call history shows the message with a FieldQuo-served link", hist.voicemail && hist.voicemail.seconds === 12 && hist.voicemail.href === `/api/sales/voicemail/${row.id}/audio` && hist.missed === false, hist);
  ok("B. …and HISTORY_SELECT reads the columns it renders", HISTORY_SELECT.voicemailUrl === true && HISTORY_SELECT.voicemailSeconds === true && HISTORY_SELECT.missedAt === true);
}

// ── B2. The floor is live but nobody can be rung: hold, then a message ──
{
  const client = scenario({
    salesRep: [REP, OTHER],
    platformSmsNumber: [POOL_LINE],
    prospect: [BUSINESS],
    salesCallAttempt: [{ id: "out_1", direction: "out", salesRepId: REP.id, toE164: CALLER, fromE164: OUR_NUMBER.e164, dialledAt: new Date(Date.now() - 2 * 3600e3), dialChannel: "browser" }],
    // Somebody is on the floor (paused, live) but nobody is available.
    salesRepActivity: [{ ...available(OTHER.id), state: "paused" }],
  });
  const first = await post("/api/rep-dial/inbound", { ...NEW_CALL("CA_queue"), To: OUR_NUMBER.e164 });
  const row = client.$tables.salesCallAttempt.find((r) => r.providerCallSid === "CA_queue");
  ok("B2. nobody reachable on a live floor goes to the queue, not the beep", /<Redirect[^>]*>[^<]*stage=queue/.test(first.body), first.body);
  ok("B2. …and the rep the call is filed to is still pushed 'Incoming call'", pushes().some((p) => p.title === "Incoming call" && p.salesRepIds.includes(REP.id)), pushes());
  const last = await post(`/api/rep-dial/inbound?stage=queue&round=${MAX_QUEUE_ROUNDS}&attemptId=${row.id}`, { CallSid: "CA_queue", To: OUR_NUMBER.e164, From: CALLER });
  ok("B2. …and when the rounds run out the caller is offered a message", /<Record/.test(last.body) && attr(last.body, "Record", "action").includes(`attemptId=${row.id}`), last.body);
}

// ── B3. The rep who rang them is on another call: held for her, and told ─
{
  const client = scenario({
    salesRep: [REP, OTHER],
    platformSmsNumber: [POOL_LINE],
    prospect: [BUSINESS],
    salesCallAttempt: [{ id: "out_1", direction: "out", salesRepId: REP.id, toE164: CALLER, fromE164: OUR_NUMBER.e164, dialledAt: new Date(Date.now() - 2 * 60e3), dialChannel: "browser" }],
    salesRepActivity: [{ ...available(REP.id), state: "on_call" }],
  });
  const first = await post("/api/rep-dial/inbound", { ...NEW_CALL("CA_hold"), To: OUR_NUMBER.e164 });
  ok("B3. a rep on another call is not rung; the caller is held", !/<Dial/.test(first.body) && /stage=queue/.test(first.body), first.body);
  const p = pushes().find((x) => x.salesRepIds.includes(REP.id));
  ok("B3. …and she is told, by name, that they are ringing back and holding", Boolean(p) && p.title === "Incoming call" && /Benchmark Painting is ringing back/.test(p.body) && /holding for you/.test(p.body), p);
  // Her call ends; the next queue round re-plans and rings her.
  client.$tables.salesRepActivity[0].state = "after_call";
  const row = client.$tables.salesCallAttempt.find((r) => r.providerCallSid === "CA_hold");
  const next = await post(`/api/rep-dial/inbound?stage=queue&round=1&attemptId=${row.id}`, { CallSid: "CA_hold", To: OUR_NUMBER.e164, From: CALLER });
  ok("B3. …and the moment she is writing up, the next round rings her", new RegExp(`<Client>[^<]*${REP.id}`).test(next.body), next.body);
}

// ── C. The rep is absent and the caller hangs up before the beep ────────
{
  const client = scenario({
    salesRep: [REP, OTHER],
    platformSmsNumber: [LINE],
    prospect: [BUSINESS],
    salesRepActivity: [],
  });
  const first = await post("/api/rep-dial/inbound", NEW_CALL("CA_hangup"));
  const row = client.$tables.salesCallAttempt.find((r) => r.providerCallSid === "CA_hangup");
  ok("C. the owner's browser is rung even with nobody marked available", /<Client>/.test(first.body) && row, first.body);
  const action = attr(first.body, "Dial", "action") || "";
  ok("C. …and the dial's action says the floor read empty", /floor=empty/.test(action), action);
  {
    // Had the owner's browser rung out instead, an empty floor is not held:
    // straight to the message, no four rounds of "still trying".
    const probe = scenario({ salesRep: [REP, OTHER], platformSmsNumber: [LINE], prospect: [BUSINESS], salesRepActivity: [] });
    const r1 = await post("/api/rep-dial/inbound", NEW_CALL("CA_ringout"));
    const u = new URL(attr(r1.body, "Dial", "action"));
    const r2 = await post(u.pathname + u.search, { CallSid: "CA_ringout", DialCallStatus: "no-answer" });
    ok("C. a ring-out on an empty floor goes straight to the beep, not the hold queue", /<Record/.test(r2.body) && !/stage=queue/.test(r2.body), r2.body);
    ok("C. …and the ring-out is recorded on the row", probe.$tables.salesCallAttempt.find((r) => r.providerCallSid === "CA_ringout")?.providerStatus === "no-answer");
    globalThis.__inboundDb = client;
    globalThis.__pushes = globalThis.__pushes.filter((p) => p.salesRepIds && p.title !== "Incoming call");
  }
  // No after-dial, no after-voicemail: the caller hung up while it rang and
  // Twilio requests neither. Only the number's status callback arrives.
  const status = await post("/api/rep-dial/inbound?stage=status", { CallSid: "CA_hangup", CallStatus: "completed", CallDuration: "8" });
  ok("C. the status callback marks the call missed", status.status === 204 && row.missedAt instanceof Date && row.providerStatus === "completed" && row.endedAt instanceof Date);
  ok("C. …the outcome reads 'missed'", inboundOutcome(row) === "missed");
  await new Promise((r) => setTimeout(r, 10));
  const missedPush = pushes().find((p) => p.title === "Missed call");
  ok("C. …and the rep is pushed 'Missed call from Benchmark Painting, just now'", Boolean(missedPush) && missedPush.salesRepIds.includes(REP.id) && missedPush.body === "Missed call from Benchmark Painting, just now" && missedPush.url === "/sales/voicemail", missedPush);
  const retry = await post("/api/rep-dial/inbound?stage=status", { CallSid: "CA_hangup", CallStatus: "completed", CallDuration: "8" });
  await new Promise((r) => setTimeout(r, 10));
  ok("C. a Twilio retry of the status callback pushes nothing twice", retry.status === 204 && pushes().filter((p) => p.title === "Missed call").length === 1);
  const hist = callHistoryRows([{ ...row, direction: "in" }], { repId: REP.id })[0];
  ok("C. the rep's call history says so", hist.missed === true && hist.voicemail === null);
  ok("C. a status for a CallSid we never wrote is logged, not dropped", (await post("/api/rep-dial/inbound?stage=status", { CallSid: "CA_stranger", CallStatus: "completed" })).status === 204 && client.$tables.platformErrorLog.some((e) => e.code === "status_for_unknown_call" && e.detail?.callSid === "CA_stranger"));
  ok("C. a non-final status is acknowledged and changes nothing", (await post("/api/rep-dial/inbound?stage=status", { CallSid: "CA_hangup", CallStatus: "ringing" })).status === 204);
}

// ── C2. The same, for a number whose status callback is not set: the sweep ─
{
  const old = new Date(Date.now() - (MISSED_SWEEP_AFTER_SECONDS + 30) * 1000);
  const young = new Date(Date.now() - 30 * 1000);
  const client = scenario({
    salesRep: [REP, OTHER],
    platformSmsNumber: [LINE],
    prospect: [BUSINESS],
    salesCallAttempt: [
      { id: "in_old", direction: "in", salesRepId: REP.id, prospectId: BUSINESS.id, toE164: CALLER, fromE164: TEAM_NUMBER.e164, dialledAt: old, providerCallSid: "CA_old", answeredAt: null, voicemailUrl: null, missedAt: null, endedAt: null },
      { id: "in_young", direction: "in", salesRepId: REP.id, toE164: CALLER, fromE164: TEAM_NUMBER.e164, dialledAt: young, providerCallSid: "CA_young", answeredAt: null, voicemailUrl: null, missedAt: null, endedAt: null },
      { id: "in_vm", direction: "in", salesRepId: REP.id, toE164: CALLER, fromE164: TEAM_NUMBER.e164, dialledAt: old, providerCallSid: "CA_oldvm", answeredAt: null, voicemailUrl: "https://api.twilio.com/x/RE9", voicemailSeconds: 3, missedAt: null, endedAt: null },
      { id: "in_ans", direction: "in", salesRepId: REP.id, toE164: CALLER, fromE164: TEAM_NUMBER.e164, dialledAt: old, providerCallSid: "CA_oldans", answeredAt: old, voicemailUrl: null, missedAt: null, endedAt: null },
      { id: "out_old", direction: "out", salesRepId: REP.id, toE164: CALLER, fromE164: TEAM_NUMBER.e164, dialledAt: old, providerCallSid: "CA_oldout", answeredAt: null, voicemailUrl: null, missedAt: null, endedAt: null },
    ],
  });
  const res = await sweepMissedInbound({ client, now: new Date() });
  const t = client.$tables.salesCallAttempt;
  ok("C2. the sweep marks the old, unanswered, messageless inbound row and only that one", res.marked === 1 && t.find((r) => r.id === "in_old").missedAt instanceof Date, res);
  ok("C2. …a row still young enough to be on hold is left alone", !t.find((r) => r.id === "in_young").missedAt);
  ok("C2. …a voicemail is not a miss", !t.find((r) => r.id === "in_vm").missedAt);
  ok("C2. …an answered call is not a miss", !t.find((r) => r.id === "in_ans").missedAt);
  ok("C2. …and an outbound row is never touched", !t.find((r) => r.id === "out_old").missedAt);
  ok("C2. …the sweep invents no carrier status", t.find((r) => r.id === "in_old").providerStatus === undefined || t.find((r) => r.id === "in_old").providerStatus === null);
  const p = pushes().find((x) => x.title === "Missed call");
  ok("C2. …and pushes the rep once, with how long ago", Boolean(p) && /Benchmark Painting/.test(p.body) && /min ago/.test(p.body), p);
  const second = await sweepMissedInbound({ client, now: new Date() });
  ok("C2. a second sweep finds nothing to do", second.marked === 0 && pushes().filter((x) => x.title === "Missed call").length === 1);
  ok("C2. the sweep threshold is derived from the queue's own limits, not a guess", MISSED_SWEEP_AFTER_SECONDS >= maxHoldSeconds() + 120 && MISSED_SWEEP_AFTER_SECONDS < 15 * 60);
}

// ── D. A request that fails the signature check ────────────────────────
{
  const client = scenario({ salesRep: [REP], platformSmsNumber: [LINE] });
  const res = await post("/api/rep-dial/inbound", NEW_CALL("CA_forged"), { badSignature: true });
  const logged = client.$tables.platformErrorLog.find((e) => e.code === "signature_rejected");
  ok("D. an unsigned request is refused with 403", res.status === 403);
  ok("D. …writes no attempt row", client.$tables.salesCallAttempt.length === 0);
  ok("D. …rings nobody and pushes nobody", pushes().length === 0);
  ok("D. …and is written to the platform error log with the CallSid, the URL and whether a token was set", Boolean(logged) && logged.area === "sales_inbound" && logged.detail?.callSid === "CA_forged" && /rep-dial\/inbound/.test(logged.detail?.url || "") && logged.detail?.authTokenSet === true, logged);
}

// ── E. The handler throws ───────────────────────────────────────────────
{
  const client = scenario({ salesRep: [REP], platformSmsNumber: [LINE], prospect: [BUSINESS] });
  // A synchronous throw from the client: the `.catch` the route hangs on the
  // promise never attaches, so the exception reaches POST's own try.
  client.salesRep.findMany = () => { throw new Error("connection reset"); };
  const res = await post("/api/rep-dial/inbound", NEW_CALL("CA_boom"));
  const logged = client.$tables.platformErrorLog.find((e) => e.code === "webhook_threw");
  ok("E. a throw inside the handler is still a 200 with spoken TwiML", res.status === 200 && /<Say/.test(res.body) && /<Hangup/.test(res.body), res);
  ok("E. …and is logged with the CallSid and the stack", Boolean(logged) && logged.detail?.callSid === "CA_boom" && /connection reset/.test(logged.message), logged);
}

delete globalThis.__inboundDb;

// ── The purchase path sets the status callback, and the audit reads hosts ─
{
  const src = source("lib/crew/platformNumber.js");
  ok("a sales number is bought with its status callback pointed at ?stage=status", /statusCallback,\s*statusCallbackMethod: "POST"/.test(src) && /\?stage=status/.test(src));
  const { salesNumberWebhookAudit } = await import("@/lib/voice/numberAudit");
  const audit = salesNumberWebhookAudit({
    origin: "https://www.fieldquo.com",
    numbers: [
      { e164: "+15550000001", purpose: "sales", voiceUrl: "https://www.fieldquo.com/api/rep-dial/inbound" },
      { e164: "+15550000002", purpose: "sales", voiceUrl: "https://fieldquo-git-preview.vercel.app/api/rep-dial/inbound" },
      { e164: "+15550000003", purpose: "sales", voiceUrl: "https://www.fieldquo.com/api/sms/inbound" },
      { e164: "+15550000004", purpose: "sales", voiceUrl: null },
      { e164: "+15550000005", purpose: "sales", voiceUrl: "not a url" },
    ],
  });
  const st = Object.fromEntries(audit.lines.map((l) => [l.e164, l.state]));
  ok("the audit says which numbers point at THIS host", st["+15550000001"] === "points_here" && st["+15550000002"] === "wrong_host" && st["+15550000003"] === "wrong_path" && st["+15550000004"] === "no_voice_url" && st["+15550000005"] === "unparseable", st);
  ok("…counts them honestly", audit.counts.held === 5 && audit.counts.pointsHere === 1 && audit.counts.wrong === 3 && audit.counts.noVoiceUrl === 1, audit.counts);
  ok("…and does not invent an inbound region it never stored", audit.lines.every((l) => l.region === null && l.regionSource === "not_recorded"));
  ok("…and an unknown origin is its own state, not a mismatch", salesNumberWebhookAudit({ origin: null, numbers: [{ e164: "+1", voiceUrl: "https://x/api/rep-dial/inbound" }] }).lines[0].state === "origin_unknown");
}

// ── The copy exists in every language the portal speaks ─────────────────
{
  const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
  const keys = [
    "app.notify.missedCall.title", "app.notify.missedCall.body", "app.notify.ago.justNow", "app.notify.ago.minutes",
    "app.notify.voicemail.title", "app.notify.voicemail.body", "app.notify.voicemail.bodyNoLength", "app.notify.ringingBack.body",
    "app.salesDial.missedCalls", "app.salesDial.missedIntro", "app.salesDial.noMissedCalls", "app.salesDial.missedNotLogged", "app.salesDial.missedLogged", "app.salesDial.hungUpWhileRinging",
    "app.salesCall.history.voicemail", "app.salesCall.history.voicemailSeconds", "app.salesCall.history.play", "app.salesCall.history.missed",
  ];
  const langs = Object.keys(APP_MESSAGES);
  const missing = langs.flatMap((l) => keys.filter((k) => typeof APP_MESSAGES[l][k] !== "string" || !APP_MESSAGES[l][k].trim()).map((k) => `${l}:${k}`));
  ok(`every new rep-facing string exists in all ${langs.length} languages`, langs.length === 9 && missing.length === 0, missing);
  ok("…and the placeholders survive translation", langs.every((l) => /\{who\}/.test(APP_MESSAGES[l]["app.notify.missedCall.body"]) && /\{ago\}/.test(APP_MESSAGES[l]["app.notify.missedCall.body"]) && /\{minutes\}/.test(APP_MESSAGES[l]["app.notify.ago.minutes"]) && /\{seconds\}/.test(APP_MESSAGES[l]["app.notify.voicemail.body"])));
}

// ═══════════════════════════════════════════════════════════════════════════
section("18. This check runs in check:all");

{
  const pkg = read("package.json");
  ok("the script is defined", /"check:sales-inbound-call":/.test(pkg));
  ok("…and is in check:all", /check:all[\s\S]*?check:sales-inbound-call/.test(pkg));
}

console.log(
  `\n${failures.length === 0 ? "PASS" : "FAIL"} — ${pass} checks passed, ${failures.length} failed.`,
);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
