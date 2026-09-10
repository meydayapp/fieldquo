// scripts/check-inbound-transfer.mjs
//
//   npm run check:inbound-transfer
//
// "In the SOP you also say that we can transfer the call to someone — did you
//  actually build that?"
//
// It was built, and it was reachable on OUTBOUND calls only. Three separate
// things stopped a rep who ANSWERED a contractor's callback from handing them
// to anybody, and the second is a bug in its own right.
//
//   1. IncomingCallDock had no attempt id. The transfer API keys on one.
//   2. NOBODY WAS RECORDED AS HAVING ANSWERED. An inbound attempt's
//      `salesRepId` is written before the phone rings, from whoever last rang
//      that contractor, and ringPlan offers the call to up to three browsers
//      at once. So the floor board, a rep's own call history and every report
//      credited an answered callback to somebody who was not on it, or to
//      nobody — and the transfer route, which scoped on that column, told the
//      rep holding the handset it was not one of their calls.
//   3. THE LEGS ARE THE OTHER WAY ROUND. On an outbound call the rep's browser
//      is the PARENT of the <Dial> and the contractor is the child; on an
//      inbound call it is reversed. Twilio hangs the child up when the parent
//      is redirected, so moving "the caller" into the conference on an inbound
//      call would have dropped the rep — leaving nobody to hand the caller
//      back to, which is the one outcome transfer.js exists to prevent.
//
// ══ Executed, not read, wherever it can be ════════════════════════════════
//
// lib/sales/calls/answered.js and the leg decision in lib/sales/calls/
// transfer.js are pure over rows their callers have already read, the shape
// lib/sales/calls/inboundDistribution.js established. Every branch below runs
// the real function with no database and no phone: an unknown CallSid, a leg
// rung at a different rep, an outbound attempt, an attempt somebody else has
// already answered, a second claim by the same rep, a rep transferring to
// themselves, and nobody reachable at all.
//
// Section 5 renders the document moveRepToConference pushes onto the rep's leg
// through Twilio's own builder and asserts on the XML, because an ordering or
// attribute guarantee is only true if it survives into what Twilio reads.
//
// ══ Comments are stripped before any source assertion ═════════════════════
//
// This repository's checks have twice been fooled by matching their own header
// prose — see the note on `decomment` in scripts/check-inbound-answer.mjs,
// which this copies. The prose here is deliberately thorough, which makes the
// trap likelier than in most codebases.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Every guarantee below was broken on disk in turn, confirmed to fail here,
// and restored from a `cp` backup — never `git checkout`. The mutations are
// listed at the foot of this file.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  LEG_CHILD,
  LEG_PARENT,
  claimAnswer,
  isCallSid,
  legAnsweredBy,
} from "@/lib/sales/calls/answered";
import {
  MOVE_CALLER,
  MOVE_REP,
  TRANSFER_WARM,
  conferenceMoveLeg,
  conferenceNameFor,
  repLegPlan,
  startTransferPlan,
  transferTargets,
} from "@/lib/sales/calls/transfer";
import { conferenceJoinTwiml } from "@/lib/sales/calls/transferRest";
import { repIdentity } from "@/lib/sales/calls/browserDial";
import { livePresence, STATE_AVAILABLE, STATE_PAUSED } from "@/lib/sales/calls/agentState";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readRaw = (p) => readFileSync(join(ROOT, p), "utf8");

/**
 * The file with its comments stripped.
 *
 * Copied from scripts/check-inbound-answer.mjs, where it was written after a
 * mutation that should have failed did not: the assertion matched the word it
 * was looking for in the file's own header. A check that can be satisfied by
 * prose about the code is not a check on the code.
 */
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
const read = (p) => decomment(readRaw(p));

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

const NOW = new Date("2026-09-10T12:00:00Z");
const SID = (tail) => `CA${String(tail).padStart(32, "0")}`;
const CALLER_SID = SID(1);
const REP_LEG_SID = SID(2);
const OTHER_SID = SID(3);

/** A SalesCallAttempt row as the routes select one. */
const attemptRow = (over = {}) => ({
  id: "a1",
  direction: "in",
  providerCallSid: CALLER_SID,
  repCallSid: null,
  answeredByRepId: null,
  ...over,
});

// Presence rows built by the REAL producer, exactly as check-call-transfer
// does and for the reason its header records: presenceFor NESTS the state
// under `presence`, and a check that builds the shape it wishes for passes
// while the shipped code answers "unreachable" for every rep on the floor.
const row = (id, { state = STATE_AVAILABLE, mins = 0 } = {}) => ({
  salesRepId: id,
  presence: livePresence(
    {
      state,
      startedAt: new Date(NOW - mins * 60000),
      heartbeatAt: new Date(NOW - mins * 60000),
      endedAt: null,
    },
    NOW,
    { portalSeenAt: new Date(NOW - mins * 60000) },
  ),
});
const REPS = [
  { id: "daniel", name: "Daniel" },
  { id: "maria", name: "Maria" },
];

// ═══════════════════════════════════════════════════════════════════════════
section("1. A CallSid is a claim, and this is what settles it");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("a real CallSid is accepted", isCallSid(CALLER_SID));
  ok("an empty string is not a call", isCallSid("") === false);
  ok("a null is not a call", isCallSid(null) === false);
  ok("a number is not a call", isCallSid(34) === false);
  // Refused HERE rather than sent on: Twilio answers a malformed SID with a
  // 404 that is indistinguishable from "that call does not exist".
  ok("a conference SID is not a call", isCallSid(`CF${"0".repeat(32)}`) === false);
  ok("a short SID is refused", isCallSid("CA0123") === false);
  ok("a long SID is refused", isCallSid(`${CALLER_SID}0`) === false);
  ok("upper-case hex is refused rather than lower-cased", isCallSid(`CA${"A".repeat(32)}`) === false);
  ok("a SID with a newline in it is refused", isCallSid(`${CALLER_SID}\n`) === false);
  ok("SQL-ish input is refused", isCallSid("CA' OR 1=1 --") === false);

  // The whole access control: the leg has to have been rung AT THIS REP.
  const mine = `client:${repIdentity("daniel")}`;
  ok("a leg Twilio says was rung at this rep is theirs", legAnsweredBy({ carrierTo: mine, repId: "daniel" }));
  ok("…and the same leg is not another rep's", legAnsweredBy({ carrierTo: mine, repId: "maria" }) === false);
  ok("a leg rung at a phone number is nobody's", legAnsweredBy({ carrierTo: "+16135550142", repId: "daniel" }) === false);
  ok("a missing `to` is nobody's", legAnsweredBy({ carrierTo: null, repId: "daniel" }) === false);
  ok("a missing rep claims nothing", legAnsweredBy({ carrierTo: mine, repId: null }) === false);
  // The identity is REBUILT from the session's rep id and compared, never
  // parsed out of the carrier's string and trusted.
  ok("a bare identity with no client: prefix is refused",
    legAnsweredBy({ carrierTo: repIdentity("daniel"), repId: "daniel" }) === false);
  ok("a doubled client: prefix is refused",
    legAnsweredBy({ carrierTo: `client:client:${repIdentity("daniel")}`, repId: "daniel" }) === false);
  ok("a rep id outside Twilio's identity character set claims nothing",
    legAnsweredBy({ carrierTo: "client:sales_rep:da niel", repId: "da niel" }) === false);
  ok("a prefix of another rep's identity is not a match",
    legAnsweredBy({ carrierTo: "client:sales_rep:danielle", repId: "daniel" }) === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Who answered, and what an answer may overwrite");
// ═══════════════════════════════════════════════════════════════════════════

{
  const claimed = claimAnswer({ attempt: attemptRow(), repId: "daniel", legSid: REP_LEG_SID });
  ok("an unclaimed inbound call can be answered", claimed.ok === true, claimed.reason);
  ok("…and the answering rep is recorded as having answered",
    claimed.data.answeredByRepId === "daniel", claimed.data);
  // The column would be one nothing reads — AGENTS.md failure class 1 — if the
  // reports keyed on salesRepId were left pointing at the pre-answer guess.
  ok("…and the call is filed to them, which is what every report reads",
    claimed.data.salesRepId === "daniel", claimed.data);
  ok("…and their own leg is written down, which is what a transfer needs",
    claimed.data.repCallSid === REP_LEG_SID, claimed.data);
  ok("…so the call can be handed on", claimed.transferable === true);

  // THE GUARANTEE. An attribution established by an actual answer is never
  // silently replaced by a second claim.
  const taken = claimAnswer({
    attempt: attemptRow({ answeredByRepId: "maria", repCallSid: OTHER_SID }),
    repId: "daniel",
    legSid: REP_LEG_SID,
  });
  ok("a call another rep already answered is refused", taken.ok === false);
  ok("…and says so in words a rep can act on", /somebody else/i.test(taken.reason), taken.reason);
  ok("…and writes nothing", taken.data === null);
  ok("…and offers no transfer", taken.transferable === false);

  // A dock that reconnects mid-call, or a double press.
  const again = claimAnswer({
    attempt: attemptRow({ answeredByRepId: "daniel", repCallSid: REP_LEG_SID }),
    repId: "daniel",
    legSid: REP_LEG_SID,
  });
  ok("the same rep claiming twice is idempotent, not a refusal", again.ok === true, again.reason);

  // An outbound row already names the rep who placed it, in the only column
  // that can name one. Allowing an answer onto one is the widest thing this
  // route could do.
  const out = claimAnswer({ attempt: attemptRow({ direction: "out" }), repId: "daniel", legSid: REP_LEG_SID });
  ok("an outbound attempt cannot be answered", out.ok === false);
  ok("…and says why", /placed/i.test(out.reason), out.reason);
  ok("a row with no direction at all is refused",
    claimAnswer({ attempt: attemptRow({ direction: null }), repId: "daniel", legSid: REP_LEG_SID }).ok === false);

  ok("no attempt is refused", claimAnswer({ attempt: null, repId: "daniel", legSid: REP_LEG_SID }).ok === false);
  ok("no rep is refused", claimAnswer({ attempt: attemptRow(), repId: null, legSid: REP_LEG_SID }).ok === false);
  ok("a non-string rep id is refused",
    claimAnswer({ attempt: attemptRow(), repId: { id: "daniel" }, legSid: REP_LEG_SID }).ok === false);

  // The PARENT case: we have the contractor's leg and not the rep's. Honest
  // rather than guessed — transfer.js refuses without the rep's leg, so the
  // control must not be offered.
  const parentOnly = claimAnswer({ attempt: attemptRow(), repId: "daniel", legSid: null });
  ok("a claim with no rep leg still records who answered", parentOnly.ok === true);
  ok("…but does not invent a leg", parentOnly.data.repCallSid === undefined, parentOnly.data);
  ok("…and says the call cannot be handed on", parentOnly.transferable === false);
  // A redelivered claim carrying no leg must not erase one already holding a
  // live transfer together.
  const keeps = claimAnswer({
    attempt: attemptRow({ answeredByRepId: "daniel", repCallSid: REP_LEG_SID }),
    repId: "daniel",
    legSid: null,
  });
  ok("…and never erases a leg that is already on the row", keeps.data.repCallSid === undefined, keeps.data);
  ok("…which leaves that call transferable", keeps.transferable === true);

  ok("a call the carrier never gave us a leg for is not transferable",
    claimAnswer({ attempt: attemptRow({ providerCallSid: null }), repId: "daniel", legSid: REP_LEG_SID })
      .transferable === false);

  ok("the two leg kinds are distinct", LEG_PARENT !== LEG_CHILD);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. WHICH LEG MOVES — the one that is not the same in both directions");
// ═══════════════════════════════════════════════════════════════════════════

{
  // Twilio's rule: redirecting the CHILD of a <Dial> ends the Dial cleanly and
  // sends the parent to its action URL; redirecting the PARENT hangs the child
  // up. Outbound, the rep's browser is the parent. Inbound, the contractor is.
  ok("an outbound call moves the CALLER", conferenceMoveLeg("out") === MOVE_CALLER);
  ok("an INBOUND call moves the REP", conferenceMoveLeg("in") === MOVE_REP);
  ok("the two are different legs", MOVE_CALLER !== MOVE_REP);
  // A row written before the column existed, or one read without it selected,
  // must fall to the outbound behaviour — which is what every existing row is.
  ok("an unknown direction falls back to the outbound leg", conferenceMoveLeg(undefined) === MOVE_CALLER);
  ok("a null direction falls back to the outbound leg", conferenceMoveLeg(null) === MOVE_CALLER);
  ok("`inbound` is not `in` and is not treated as it", conferenceMoveLeg("inbound") === MOVE_CALLER);

  const targets = transferTargets({
    reps: REPS,
    presence: [row("maria")],
    excludeRepId: "daniel",
    now: NOW,
  });
  const inbound = startTransferPlan({
    kind: TRANSFER_WARM,
    targetKey: "rep:maria",
    targets,
    attempt: { id: "a1", direction: "in", providerCallSid: CALLER_SID, repCallSid: REP_LEG_SID },
  });
  ok("an inbound call with both legs may be transferred", inbound.ok === true, inbound.reason);
  ok("…and the plan carries the leg to move, so the route decides nothing",
    inbound.moveLeg === MOVE_REP, inbound.moveLeg);

  const outbound = startTransferPlan({
    kind: TRANSFER_WARM,
    targetKey: "rep:maria",
    targets,
    attempt: { id: "a1", direction: "out", providerCallSid: CALLER_SID, repCallSid: REP_LEG_SID },
  });
  ok("an outbound transfer is unchanged", outbound.ok === true && outbound.moveLeg === MOVE_CALLER, outbound.moveLeg);
  ok("a refusal names no leg to move",
    startTransferPlan({ kind: null, targetKey: "rep:maria", targets, attempt: null }).moveLeg === null);

  // An inbound call whose rep leg was never recorded — the state EVERY inbound
  // call was in before /api/sales/calls/answered existed.
  const noLeg = startTransferPlan({
    kind: TRANSFER_WARM,
    targetKey: "rep:maria",
    targets,
    attempt: { id: "a1", direction: "in", providerCallSid: CALLER_SID, repCallSid: null },
  });
  ok("an inbound call with no rep leg is refused, not guessed at", noLeg.ok === false);
  ok("…because there would be no way to hand the caller back",
    /hand the caller back/i.test(noLeg.reason), noLeg.reason);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Nobody to hand them to, and handing them to yourself");
// ═══════════════════════════════════════════════════════════════════════════

{
  // Transferring a caller to yourself is not a no-op: it moves the caller into
  // a conference, rings your own client, and finds it busy on the call it is
  // already on.
  const alone = transferTargets({ reps: REPS, presence: [row("daniel")], excludeRepId: "daniel", now: NOW });
  ok("a rep is never on their own transfer list", alone.length === 0, alone);
  ok("…so a transfer to yourself cannot even be named",
    startTransferPlan({
      kind: TRANSFER_WARM,
      targetKey: "rep:daniel",
      targets: alone,
      attempt: { id: "a1", direction: "in", providerCallSid: CALLER_SID, repCallSid: REP_LEG_SID },
    }).ok === false);

  // Nobody reachable at all. The picker must say so rather than render empty.
  const paused = transferTargets({
    reps: REPS,
    presence: [row("maria", { state: STATE_PAUSED })],
    excludeRepId: "daniel",
    now: NOW,
  });
  ok("a paused rep is not a transfer target", paused.length === 0, paused);
  const stale = transferTargets({ reps: REPS, presence: [row("maria", { mins: 600 })], excludeRepId: "daniel", now: NOW });
  ok("a rep whose browser went quiet is not a transfer target", stale.length === 0, stale);
  ok("no presence at all offers nobody", transferTargets({ reps: REPS, presence: null, excludeRepId: "daniel", now: NOW }).length === 0);
  // Deliberately NOT padded with unreachable reps marked "offline" so the
  // picker looks fuller — AGENTS.md failure class 5.
  ok("an unreachable rep is never listed as a greyed option",
    transferTargets({ reps: REPS, presence: [row("maria", { state: STATE_PAUSED })], excludeRepId: "daniel", now: NOW })
      .every((t) => t.salesRepId !== "maria"));
  // The standing number is the one thing left when the floor is empty.
  const fallback = transferTargets({
    reps: REPS,
    presence: [row("maria", { state: STATE_PAUSED })],
    excludeRepId: "daniel",
    transferTo: "+16135550142",
    now: NOW,
  });
  ok("the standing transfer number is still offered when nobody is free", fallback.length === 1);
  ok("…and it is a number, not a client", fallback[0].kind === "number");

  const empty = startTransferPlan({
    kind: TRANSFER_WARM,
    targetKey: "rep:maria",
    targets: [],
    attempt: { id: "a1", direction: "in", providerCallSid: CALLER_SID, repCallSid: REP_LEG_SID },
  });
  ok("an empty target list refuses every transfer", empty.ok === false);
  ok("…in words rather than silence", typeof empty.reason === "string" && empty.reason.length > 10, empty.reason);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The document pushed onto the rep's leg, as Twilio reads it");
// ═══════════════════════════════════════════════════════════════════════════

{
  const transfer = {
    id: "t1",
    attemptId: "a1",
    fromRepId: "daniel",
    toRepId: "maria",
    kind: TRANSFER_WARM,
    state: "ringing",
    conferenceName: conferenceNameFor("t1"),
    callerCallSid: CALLER_SID,
    repCallSid: REP_LEG_SID,
    targetCallSid: null,
  };
  const plan = repLegPlan({ transfer });
  const xml = conferenceJoinTwiml({
    plan,
    conferenceName: plan.conferenceName,
    origin: "https://fieldquo.com",
    transferId: "t1",
  }).toString();

  ok("the rep is put into the transfer's own conference", xml.includes(">fq_xfer_t1<"), xml);
  // A rep entering starts the room. The alternative — entering with
  // startConferenceOnEnter false — leaves it unstarted, and a transfer
  // cancelled before the target answers would then unhold two people into a
  // conference that never began: hold music with no end.
  ok("…and starts it", /startConferenceOnEnter="true"/.test(xml), xml);
  // NEVER true. The transferring rep steps out of a completed transfer on
  // purpose, and ending the conference on their way would drop the caller and
  // the person who just took them.
  ok("…and does NOT end it when they step out", /endConferenceOnExit="false"/.test(xml), xml);
  ok("…and reports joins and leaves, which is what the state machine runs on",
    /statusCallbackEvent="join leave"/.test(xml), xml);
  ok("…to a callback naming this transfer", xml.includes("transferId=t1"), xml);
  // Rendered through Twilio's own builder rather than concatenated, so the
  // callback URL's `&` is escaped as XML requires.
  ok("…with the query string's ampersand escaped", xml.includes("&amp;stage=conference") || xml.includes("stage=conference&amp;"), xml);
  ok("the rep is told what is happening before they hear anything", /<Say/.test(xml), xml);

  // A transfer that has already ended must not put a leg into a room.
  const over = repLegPlan({ transfer: { ...transfer, state: "completed" } });
  const dead = conferenceJoinTwiml({ plan: over, conferenceName: over.conferenceName, origin: "https://fieldquo.com", transferId: "t1" }).toString();
  ok("a finished transfer joins nothing", !/<Conference/.test(dead), dead);
  ok("…and ends the leg rather than leaving it open", /<Hangup/.test(dead), dead);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The route the dock calls, and what it will not take on trust");
// ═══════════════════════════════════════════════════════════════════════════

{
  const route = read("app/api/sales/calls/answered/route.js");

  // The CALLING gate, not the outreach one: this writes SalesCallAttempt,
  // which is on lib/sales/calls/gate.js's list and not on outreachGate's.
  ok("the route is gated", /requireCallingRep\(request\)/.test(route));
  ok("…and returns the gate's refusal verbatim", /if \(refusal\) return NextResponse\.json\(refusal\.body/.test(route));
  ok("the rep comes from the gate, never from the body", !/body\.(repId|salesRepId)/.test(route));

  // The whole access control: Twilio has to agree the leg was rung at this rep.
  ok("the leg is read back from the carrier", /twilioRest\.calls\(callSid\)\.fetch\(\)/.test(route));
  ok("…and refused unless it was rung at this rep", /legAnsweredBy\(/.test(route));
  ok("…and matched on the PARENT of that leg", /parentCallSid/.test(route));
  ok("the posted SID is shape-checked before anything is asked", /isCallSid\(callSid\)/.test(route));

  // Never silence. A call that cannot be matched is refused in words.
  ok("an unmatchable call is refused rather than quietly ignored", /404\)/.test(route));
  ok("a lost claim is refused with a status a client can branch on", /409\)/.test(route));
  ok("…and recorded, because two reps claiming one call is worth seeing",
    /recordError\(/.test(route) && /answer_claim_lost/.test(route));

  // The decision is not made here.
  ok("the route makes no decision of its own", /claimAnswer\(\{/.test(route));
  ok("…and writes what the decision returned", /data: plan\.data/.test(route));
  ok("the answer says whether the call can be handed on", /transferable: plan\.transferable/.test(route));

  const store = read("lib/sales/calls/store.js");
  // Conditional, never read-then-write: two browsers can accept the same
  // ringing call inside the same second.
  ok("the write is conditional on nobody having claimed it",
    /answeredByRepId: null/.test(store), "recordAnswered is not guarded");
  ok("…and the same rep re-claiming is allowed", /answeredByRepId: repId/.test(store));
  ok("…and it is an updateMany, so the condition is in the WHERE",
    /recordAnswered[\s\S]{0,900}?salesCallAttempt\.updateMany/.test(store));
  ok("…scoped to inbound rows", /recordAnswered[\s\S]{0,900}?direction: "in"/.test(store));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The transfer route can now find an answered call");
// ═══════════════════════════════════════════════════════════════════════════

{
  const route = read("app/api/sales/calls/transfer/route.js");
  // The bug: scoping on salesRepId alone meant the rep holding an answered
  // callback failed the WHERE and was told it was not one of their calls.
  ok("an attempt is found by the rep who ANSWERED it too",
    /OR: \[\{ salesRepId: repId \}, \{ answeredByRepId: repId \}\]/.test(route));
  ok("…and the row's direction is selected, because the leg to move depends on it",
    /direction: true/.test(route));
  ok("the route branches on the plan's leg rather than re-deriving it",
    /plan\.moveLeg === MOVE_REP/.test(route));
  ok("…moving the rep on an inbound call", /moveRepToConference\(\{ transfer: created\.transfer/.test(route));
  ok("…and the caller on an outbound one", /moveCallerToConference\(\{ transfer: created\.transfer/.test(route));
  ok("nothing in this route reads `direction` to decide the leg itself",
    !/direction === "in"/.test(route));

  const rest = read("lib/sales/calls/transferRest.js");
  ok("moving the rep is its own function", /export async function moveRepToConference/.test(rest));
  ok("…and refuses without a rep leg rather than moving nothing",
    /moveRepToConference[\s\S]{0,400}?There is no rep leg to move/.test(readRaw("lib/sales/calls/transferRest.js")));
  // One builder for the join document. Two copies is the copy that forgets
  // endConferenceOnExit and ends the room when a rep steps out.
  ok("the join document is built in one place", /export function conferenceJoinTwiml/.test(rest));
  const webhook = read("app/api/rep-dial/transfer/route.js");
  ok("…and the webhook uses that one", /conferenceJoinTwiml\(\{/.test(webhook));
  ok("…rather than building a conference of its own",
    !/dial\.conference\(/.test(webhook), "the webhook still builds its own conference");

  // The caller's half of an inbound transfer: their <Dial> ends the moment the
  // rep's leg leaves it, and they arrive at the inbound action URL.
  const inbound = read("app/api/rep-dial/inbound/route.js");
  ok("the inbound Dial action honours a transfer in flight", /openTransferFor\(attemptId\)/.test(inbound));
  ok("…matched on the leg, not merely on the attempt",
    /open\.callerCallSid === params\.CallSid/.test(inbound));
  ok("…and puts the caller in the same conference", /callerConferenceTwiml\(\{ transfer: open/.test(inbound));
  // Falling through would mark the attempt ended while the caller is still on
  // the line, and answer with an empty document — which hangs up on the person
  // the transfer was supposed to keep hold of.
  ok("…before anything marks the call over",
    inbound.indexOf("callerConferenceTwiml") < inbound.indexOf("attachProviderCall({"),
    "the transfer check runs after the call is marked ended");
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. One transfer control, rendered by both screens");
// ═══════════════════════════════════════════════════════════════════════════

{
  const control = read("app/components/sales/TransferControl.js");
  ok("the transfer control is its own component", /export default function TransferControl/.test(control));
  ok("it starts a transfer", /action: "start"/.test(control));
  ok("…completes one", /endTransfer\("complete"\)/.test(control));
  ok("…and cancels one", /endTransfer\("cancel"\)/.test(control));
  // Nothing at all when the call cannot be transferred. A greyed button with a
  // tooltip is still a control that does not work.
  ok("it renders nothing without an attempt", /if \(!attemptId \|\| !active\) return null/.test(control));
  ok("…and nothing when the server says this call has no second leg",
    /xfer\?\.ready && xfer\?\.transferable/.test(control));
  // The sentence moved into app/i18n/appMessages.js when the sales portal was
  // translated, so this matches the KEY the screen renders. The words are
  // still asserted — scripts/check-sales-portal-i18n.mjs section 6 holds the
  // English catalogue value to them, which is where they now live.
  ok("…and says so when nobody is free rather than showing an empty picker",
    /app\.salesDial\.nobodyElseFree/.test(control));

  const panel = read("app/components/sales/CallPanel.js");
  ok("the outbound dialler renders the shared control", /<TransferControl/.test(panel));
  // The copy that rots is the one nobody looks at — AGENTS.md failure class 4.
  ok("…and no longer carries a picker of its own",
    !/action: "start"/.test(panel), "CallPanel still posts its own transfer");
  ok("…and no longer holds transfer state", !/setShowTransfer/.test(panel));

  const dock = read("app/components/sales/IncomingCallDock.js");
  ok("the inbound dock renders the SAME control", /<TransferControl/.test(dock));
  ok("…and imports it rather than copying it", /from "\.\/TransferControl"/.test(dock));
  ok("the dock tells the server who answered, on the accept", /\/api\/sales\/calls\/answered/.test(dock));
  ok("…with the SID the SDK gave it", /call\?\.parameters\?\.CallSid/.test(dock));
  // The click IS the user gesture browsers require before audio plays, so
  // nothing is awaited before it.
  ok("…after the call is accepted, never before",
    dock.indexOf("call.accept()") < dock.indexOf("/api/sales/calls/answered"),
    "the dock waits on the server before picking up");
  ok("the dock renders no transfer control until the server names the call",
    /attemptId=\{answered\?\.attemptId \|\| null\}/.test(dock));
  ok("…and says why when it cannot be handed on", /answered\?\.note/.test(dock));
  ok("the attempt is forgotten when the call ends", /setAnswered\(null\)/.test(dock));
  // Who is rung is decided server-side from presence. A client with an opinion
  // is how a paused rep's laptop starts ringing.
  ok("the dock still keeps no opinion about who should be rung",
    !/STATE_AVAILABLE|reachable\(|presenceOf\(/.test(dock));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The column, and the check, are wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const schema = readRaw("prisma/schema.prisma");
  const model = schema.slice(schema.indexOf("model SalesCallAttempt {"));
  const body = model.slice(0, model.indexOf("\n}"));
  ok("SalesCallAttempt has a column for who answered", /answeredByRepId String\?/.test(body));
  ok("…nullable, because most rows are outbound and nobody answered them",
    /answeredByRepId String\?/.test(body) && !/answeredByRepId String\b(?!\?)/.test(body));
  // Written AND read — AGENTS.md failure class 1 in both directions.
  const store = read("lib/sales/calls/store.js");
  const transferRoute = read("app/api/sales/calls/transfer/route.js");
  ok("something writes it", /answeredByRepId/.test(store));
  ok("something reads it", /answeredByRepId/.test(transferRoute));

  const pkg = JSON.parse(readRaw("package.json"));
  ok("check:inbound-transfer is a script", typeof pkg.scripts?.["check:inbound-transfer"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:inbound-transfer"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}

// ══ Mutations run against this check ══════════════════════════════════════
//
// Each was applied on disk, this script was run, and the file was restored
// from a `cp` backup taken first — never `git checkout`, which restores the
// last commit rather than the working copy.
//
//   1. claimAnswer stops refusing a call another rep already answered.
//   2. claimAnswer writes salesRepId no longer, leaving every report on the
//      pre-answer guess.
//   3. claimAnswer accepts an outbound attempt.
//   4. conferenceMoveLeg returns MOVE_CALLER for an inbound call — the bug
//      that would hang the rep up.
//   5. recordAnswered drops `answeredByRepId: null` from its WHERE, making the
//      write last-writer-wins.
//   6. the transfer route scopes attemptFor on salesRepId alone again.
//   7. the inbound after-dial stops honouring an open transfer.
//   8. conferenceJoinTwiml ends the conference when a rep steps out.
//   9. the dock awaits the server before accepting the call.
//  10. the dock renders TransferControl with a hard-coded attempt id.
