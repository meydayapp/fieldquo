// scripts/check-call-transfer.mjs
//
//   npm run check:call-transfer
//
// Two things a sales floor cannot work without, and neither of them existed.
//
// ══ What was missing ══════════════════════════════════════════════════════
//
//   1. TRANSFER. A rep who reached the wrong person, or who needed the owner
//      on the line, had one move: "let me get somebody to call you back", and
//      hang up. Every contact-centre reference this floor was modelled on has
//      transfer as a first-class verb.
//   2. A QUEUE. One glance at a presence table decided the whole call: nobody
//      free, voicemail, goodbye — while a rep four seconds from hanging up
//      would have taken it.
//
// ══ What this executes, rather than reads ═════════════════════════════════
//
// lib/sales/calls/transfer.js and lib/sales/calls/queue.js are pure over rows
// their callers have already read, which is the whole reason they are shaped
// that way. Every branch below runs the real function: nobody reachable, the
// target being the transferrer, stale presence, a rep who hung up mid-transfer,
// a webhook redelivered after the transfer finished, a caller left alone in a
// conference, an empty queue, a queue whose floor fills up mid-wait, and a
// caller who abandons.
//
// Section 6 renders TwiML through Twilio's own library and asserts on the XML,
// because an ordering or attribute guarantee is only true if it survives into
// what Twilio actually reads. Section 7 executes the webhook signature
// verifier against a URL with a query string — the bug that made every
// second-leg webhook in this feature a silent 403.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// The round cap's position ahead of the availability check, the exclusion of
// the transferring rep from their own target list, the caller-before-rep
// ordering on completion, the refusal to complete a warm transfer nobody has
// answered, and the query string in the signature were each broken on disk in
// turn, confirmed to fail here, and restored from a `cp` backup — never
// `git checkout`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import twilio from "twilio";
import { getExpectedTwilioSignature } from "twilio/lib/webhooks/webhooks.js";

import {
  TRANSFER_WARM,
  TRANSFER_COLD,
  TRANSFER_KINDS,
  TRANSFER_RING_SECONDS,
  TRANSFER_STATES,
  XFER_RINGING,
  XFER_TALKING,
  XFER_COMPLETED,
  XFER_RETURNED,
  XFER_CANCELLED,
  XFER_FAILED,
  conferenceNameFor,
  describeTransfer,
  isTransferOpen,
  onCancel,
  onComplete,
  onParticipantJoin,
  onParticipantLeave,
  onTargetEnded,
  repLegPlan,
  startTransferPlan,
  targetLegPlan,
  transferTargets,
} from "@/lib/sales/calls/transfer";
import {
  MAX_QUEUE_ROUNDS,
  QUIET_PAUSE_SECONDS,
  maxHoldSeconds,
  queueStep,
  requeueSay,
} from "@/lib/sales/calls/queue";
import { callerConferenceTwiml } from "@/lib/sales/calls/transferRest";
import { ringPlan } from "@/lib/sales/calls/inboundDistribution";
import { livePresence, STATE_AVAILABLE, PRESENCE_STALE_MINUTES } from "@/lib/sales/calls/agentState";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { REP_CALL_WRITES } from "@/lib/sales/calls/gate";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
/** Comments stripped before any regex touches source. A rule in a comment is not a rule. */
const source = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

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

// Rows built by the REAL producer, exactly as check-inbound-distribution does,
// and for the reason its header records: presenceFor NESTS the state under
// `presence`, and a check that builds the shape it wishes for passes while the
// shipped code answers "unreachable" for every rep on the floor.
const row = (id, { state = STATE_AVAILABLE, mins = 0 } = {}) => ({
  salesRepId: id,
  presence: livePresence(
    { state, startedAt: new Date(NOW - mins * 60000), heartbeatAt: new Date(NOW - mins * 60000), endedAt: null },
    NOW,
    { portalSeenAt: new Date(NOW - mins * 60000) },
  ),
});
const fresh = (id, mins = 0) => row(id, { mins });
const REPS = [
  { id: "daniel", name: "Daniel" },
  { id: "maria", name: "Maria" },
  { id: "owner", name: "The owner" },
];

/** A transfer row shaped exactly as SalesCallTransfer stores one. */
const transferRow = (over = {}) => ({
  id: "t1",
  attemptId: "a1",
  fromRepId: "daniel",
  toRepId: "maria",
  toE164: null,
  kind: TRANSFER_WARM,
  state: XFER_RINGING,
  conferenceName: conferenceNameFor("t1"),
  callerCallSid: "CAcaller",
  repCallSid: "CArep",
  targetCallSid: "CAtarget",
  failureReason: null,
  ...over,
});

const types = (r) => (r.actions || []).map((a) => `${a.type}${a.who ? `:${a.who}` : ""}`);

// ═══════════════════════════════════════════════════════════════════════════
section("1. Who a rep may hand a caller to");
// ═══════════════════════════════════════════════════════════════════════════

{
  const targets = transferTargets({
    reps: REPS,
    presence: [fresh("daniel"), fresh("maria", 5), fresh("owner", 9)],
    excludeRepId: "daniel",
    now: NOW,
  });

  // The rule this whole list exists to enforce. Transferring to yourself would
  // move the caller into a conference and then ring the client that is already
  // on the call — a busy signal, and a caller on hold with nobody coming.
  ok("the transferring rep is never on their own list", !targets.some((t) => t.salesRepId === "daniel"), targets.map((t) => t.salesRepId));
  ok("everybody else who is free is", targets.map((t) => t.salesRepId).join(",") === "owner,maria", targets.map((t) => t.salesRepId));
  ok("…longest idle first, the same fairness rule the router uses", targets[0]?.salesRepId === "owner");
  ok("…as browser clients", targets.every((t) => t.kind === "client"));
  ok("…using the identity the Device registered with", targets[0]?.value === "sales_rep:owner");
  ok("…and carrying a name a screen can print", targets[0]?.name === "The owner");

  // Presence is not re-decided here. It is inboundDistribution's `reachable`,
  // unchanged, so the transfer list and the inbound router cannot disagree.
  const stale = transferTargets({
    reps: REPS,
    presence: [fresh("maria", PRESENCE_STALE_MINUTES + 1)],
    excludeRepId: "daniel",
    now: NOW,
  });
  ok(`a rep last seen ${PRESENCE_STALE_MINUTES + 1} minutes ago is not offered`, stale.length === 0, stale);
  ok(
    "…while one seen a minute inside the window is",
    transferTargets({ reps: REPS, presence: [fresh("maria", PRESENCE_STALE_MINUTES - 1)], excludeRepId: "daniel", now: NOW }).length === 1,
  );
  ok(
    "a rep on another call is not offered",
    transferTargets({ reps: REPS, presence: [row("maria", { state: "on_call" })], excludeRepId: "daniel", now: NOW }).length === 0,
  );
  ok(
    "a paused rep is not offered",
    transferTargets({ reps: REPS, presence: [row("maria", { state: "paused" })], excludeRepId: "daniel", now: NOW }).length === 0,
  );

  // The shape bug that shipped once: state read flat instead of nested.
  ok(
    "a flat presence row yields nobody rather than everybody",
    transferTargets({ reps: REPS, presence: [{ salesRepId: "maria", state: "available", lastSeenAt: NOW }], excludeRepId: "daniel", now: NOW }).length === 0,
  );

  const withNumber = transferTargets({
    reps: REPS,
    presence: [fresh("maria")],
    excludeRepId: "daniel",
    transferTo: "+15551234567",
    now: NOW,
  });
  ok("the standing transfer number is offered", withNumber.some((t) => t.kind === "number"));
  ok("…and is always last, after every rep", withNumber.at(-1).kind === "number", withNumber.map((t) => t.kind));
  ok(
    "…and is the only thing offered when the floor is empty",
    transferTargets({ reps: REPS, presence: [], excludeRepId: "daniel", transferTo: "+15551234567", now: NOW }).length === 1,
  );
  ok(
    "a transfer number that is not E.164 is not offered",
    transferTargets({ reps: REPS, presence: [], excludeRepId: "daniel", transferTo: "555-1234", now: NOW }).length === 0,
  );

  // The screen must be able to say "nobody is free" rather than render an
  // empty picker, so an empty list has to be reachable and honest.
  ok("nobody free produces an empty list, not a padded one", transferTargets({ reps: REPS, presence: null, excludeRepId: "daniel", now: NOW }).length === 0);
  ok("neither does a rep id Twilio could not carry", transferTargets({ reps: [{ id: "not a cuid!", name: "x" }], presence: [fresh("not a cuid!")], excludeRepId: "daniel", now: NOW }).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. May this transfer start at all");
// ═══════════════════════════════════════════════════════════════════════════

{
  const targets = transferTargets({ reps: REPS, presence: [fresh("maria")], excludeRepId: "daniel", now: NOW });
  const attempt = { id: "a1", providerCallSid: "CAcaller", repCallSid: "CArep", fromE164: "+16135550142" };

  const good = startTransferPlan({ kind: TRANSFER_WARM, targetKey: "rep:maria", targets, attempt });
  ok("a warm transfer to a free rep is allowed", good.ok === true, good.reason);
  ok("…and carries both legs off the row", good.callerCallSid === "CAcaller" && good.repCallSid === "CArep");
  ok("…and a bounded ring time", good.ringSeconds === TRANSFER_RING_SECONDS && TRANSFER_RING_SECONDS > 5 && TRANSFER_RING_SECONDS <= 40);
  ok("a cold transfer is allowed the same way", startTransferPlan({ kind: TRANSFER_COLD, targetKey: "rep:maria", targets, attempt }).ok);

  ok("no kind is refused, not defaulted", startTransferPlan({ kind: null, targetKey: "rep:maria", targets, attempt }).ok === false);
  ok("an invented kind is refused", startTransferPlan({ kind: "silent", targetKey: "rep:maria", targets, attempt }).ok === false);
  ok("there are exactly two kinds", TRANSFER_KINDS.length === 2, TRANSFER_KINDS);

  // The browser's pick is re-checked against a list read in this request.
  const gone = startTransferPlan({ kind: TRANSFER_WARM, targetKey: "rep:someone-who-left", targets, attempt });
  ok("a target that is no longer free is refused", gone.ok === false);
  ok("…and says so in words a rep can act on", /free/i.test(gone.reason), gone.reason);
  ok("an empty target list refuses everything", startTransferPlan({ kind: TRANSFER_WARM, targetKey: "rep:maria", targets: [], attempt }).ok === false);

  // The two legs. Without the rep's own leg there is no way to hand the caller
  // back, which is the promise this whole module is built around.
  const noCaller = startTransferPlan({ kind: TRANSFER_WARM, targetKey: "rep:maria", targets, attempt: { id: "a1", providerCallSid: null, repCallSid: "CArep" } });
  ok("a call whose caller leg is not known yet is refused", noCaller.ok === false);
  ok("…and says to try again rather than blaming the rep", /moment/i.test(noCaller.reason), noCaller.reason);
  const noRep = startTransferPlan({ kind: TRANSFER_WARM, targetKey: "rep:maria", targets, attempt: { id: "a1", providerCallSid: "CAcaller", repCallSid: null } });
  ok("a call whose REP leg is not known is refused", noRep.ok === false);
  ok("…because there would be no way to hand the caller back", /hand the caller back/i.test(noRep.reason), noRep.reason);
  ok("no attempt at all is refused", startTransferPlan({ kind: TRANSFER_WARM, targetKey: "rep:maria", targets, attempt: null }).ok === false);
  ok("a refusal never leaks a target", startTransferPlan({ kind: null, targetKey: "rep:maria", targets, attempt }).target === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The state machine, every branch");
// ═══════════════════════════════════════════════════════════════════════════

{
  // ── The caller and the rep arriving ──────────────────────────────────
  const callerJoin = onParticipantJoin({ transfer: transferRow(), callSid: "CAcaller" });
  ok("the caller is held the moment they arrive", types(callerJoin).join() === "hold:caller", types(callerJoin));
  ok("…without moving the state", callerJoin.state === XFER_RINGING && callerJoin.changed === false);

  const repJoin = onParticipantJoin({ transfer: transferRow(), callSid: "CArep" });
  ok("the transferring rep is held while the target rings", types(repJoin).join() === "hold:rep", types(repJoin));

  // A redelivered join for the rep AFTER the private conversation started must
  // not put them back on hold mid-sentence.
  ok(
    "a redelivered rep join during the private conversation does nothing",
    onParticipantJoin({ transfer: transferRow({ state: XFER_TALKING }), callSid: "CArep" }).actions.length === 0,
  );

  // ── The target arriving: the one branch between warm and cold ────────
  const warm = onParticipantJoin({ transfer: transferRow({ kind: TRANSFER_WARM }), callSid: "CAtarget" });
  ok("warm: the two reps speak, the caller stays held", types(warm).join() === "unhold:rep", types(warm));
  ok("…and the transfer is talking, not completed", warm.state === XFER_TALKING && warm.changed === true);

  const cold = onParticipantJoin({ transfer: transferRow({ kind: TRANSFER_COLD }), callSid: "CAtarget" });
  ok("cold: it completes the instant they pick up", cold.state === XFER_COMPLETED && cold.changed === true);
  // Order is the guarantee: the caller comes off hold BEFORE the rep is
  // dropped, or there is a gap in which they are held in a room with one
  // stranger in it.
  ok(
    "…caller off hold before the rep is released",
    types(cold).indexOf("unhold:caller") < types(cold).indexOf("hangup:rep"),
    types(cold),
  );
  ok(
    "…and the target inherits the power to end the room",
    types(cold).includes("endOnExit:target"),
    types(cold),
  );

  // A warm transfer whose rep hung up while the target was ringing cannot have
  // the conversation warm is for. Completing is the only outcome that does not
  // leave the caller on hold for ever.
  const warmOrphan = onParticipantJoin({ transfer: transferRow({ kind: TRANSFER_WARM }), callSid: "CAtarget", repLegUp: false });
  ok("warm with the rep gone completes rather than waiting for them", warmOrphan.state === XFER_COMPLETED, warmOrphan);
  ok("…and says why", /already hung up/i.test(warmOrphan.reason || ""), warmOrphan.reason);

  // ── Events that must do nothing ──────────────────────────────────────
  ok("an unknown leg joining moves nothing", onParticipantJoin({ transfer: transferRow(), callSid: "CAsupervisor" }).actions.length === 0);
  ok("a join with no CallSid moves nothing", onParticipantJoin({ transfer: transferRow(), callSid: null }).actions.length === 0);
  for (const state of [XFER_COMPLETED, XFER_RETURNED, XFER_CANCELLED, XFER_FAILED]) {
    ok(
      `a late join on a ${state} transfer does nothing`,
      onParticipantJoin({ transfer: transferRow({ state }), callSid: "CAtarget" }).actions.length === 0,
    );
  }
  ok("no transfer at all does nothing", onParticipantJoin({ transfer: null, callSid: "CAtarget" }).actions.length === 0);

  // ── Nobody answered ──────────────────────────────────────────────────
  const noAnswer = onTargetEnded({ transfer: transferRow(), callStatus: "no-answer", repLegUp: true });
  ok("nobody answered hands the caller back", noAnswer.state === XFER_RETURNED, noAnswer);
  ok("…by taking BOTH of them off hold", types(noAnswer).join() === "unhold:rep,unhold:caller", types(noAnswer));
  ok("…and the reason carries the carrier's word", /no-answer/.test(noAnswer.reason), noAnswer.reason);
  ok("busy is the same outcome", onTargetEnded({ transfer: transferRow(), callStatus: "busy" }).state === XFER_RETURNED);
  ok("a failed leg is the same outcome", onTargetEnded({ transfer: transferRow(), callStatus: "failed" }).state === XFER_RETURNED);

  const bailed = onTargetEnded({ transfer: transferRow({ state: XFER_TALKING }), callStatus: "completed", repLegUp: true });
  ok("a target who hangs up after the private chat hands the caller back too", bailed.state === XFER_RETURNED);
  ok("…and says which of the two it was", /hung up/.test(bailed.reason), bailed.reason);

  // THE case. The rep hung up mid-transfer, so `returned` would return the
  // caller to an empty room — silence with no end.
  const stranded = onTargetEnded({ transfer: transferRow(), callStatus: "no-answer", repLegUp: false });
  ok("a rep who hung up mid-transfer does not strand the caller", stranded.state === XFER_FAILED, stranded);
  ok("…the caller comes off hold and goes to the queue", types(stranded).join() === "unhold:caller,callerToQueue", types(stranded));
  ok("…which is a DIFFERENT word from returned, because it needs a different fix", XFER_FAILED !== XFER_RETURNED);
  ok("a target-ended event on a finished transfer does nothing", onTargetEnded({ transfer: transferRow({ state: XFER_COMPLETED }), callStatus: "completed" }).actions.length === 0);

  // ── Put them through ─────────────────────────────────────────────────
  const complete = onComplete({ transfer: transferRow({ state: XFER_TALKING }), byRepId: "daniel" });
  ok("the rep can put the caller through once the two are talking", complete.ok === true);
  ok("…caller off hold before the rep leaves", types(complete).indexOf("unhold:caller") < types(complete).indexOf("hangup:rep"), types(complete));
  ok("…and the room can be ended by the person who took it", types(complete).includes("endOnExit:target"));

  const early = onComplete({ transfer: transferRow({ state: XFER_RINGING }), byRepId: "daniel" });
  ok("completing before anybody picks up is refused", early.ok === false);
  ok("…and points at the button that DOES do that", /cancel|wait/i.test(early.reason), early.reason);
  ok("…and emits no actions at all", early.actions.length === 0);
  ok("another rep cannot complete this transfer", onComplete({ transfer: transferRow({ state: XFER_TALKING }), byRepId: "maria" }).ok === false);
  ok("nor can a request with no rep on it", onComplete({ transfer: transferRow({ state: XFER_TALKING }), byRepId: null }).ok === false);
  ok("completing a finished transfer is refused", onComplete({ transfer: transferRow({ state: XFER_COMPLETED }), byRepId: "daniel" }).ok === false);

  // ── Never mind ───────────────────────────────────────────────────────
  const cancelRinging = onCancel({ transfer: transferRow(), byRepId: "daniel" });
  ok("a transfer can be cancelled while it rings", cancelRinging.ok === true && cancelRinging.state === XFER_CANCELLED);
  ok("…the target's leg is stopped first", types(cancelRinging)[0] === "hangupTarget", types(cancelRinging));
  ok("…and both of the others come off hold", types(cancelRinging).includes("unhold:rep") && types(cancelRinging).includes("unhold:caller"));
  ok(
    "a warm transfer can be cancelled DURING the private conversation",
    onCancel({ transfer: transferRow({ state: XFER_TALKING }), byRepId: "daniel" }).ok === true,
  );
  ok("another rep cannot cancel it", onCancel({ transfer: transferRow(), byRepId: "maria" }).ok === false);
  ok("a finished transfer cannot be cancelled", onCancel({ transfer: transferRow({ state: XFER_COMPLETED }), byRepId: "daniel" }).ok === false);

  // ── Left alone in the room ───────────────────────────────────────────
  const alone = onParticipantLeave({ transfer: transferRow({ state: XFER_COMPLETED }), remainingSids: ["CAcaller"] });
  ok("a caller left alone after a completed transfer is rescued", types(alone).join() === "unhold:caller,callerToQueue", types(alone));
  ok(
    "a caller left alone after a RETURNED transfer is rescued too",
    types(onParticipantLeave({ transfer: transferRow({ state: XFER_RETURNED }), remainingSids: ["CAcaller"] })).includes("callerToQueue"),
  );
  ok(
    "two people still talking are left alone",
    onParticipantLeave({ transfer: transferRow({ state: XFER_COMPLETED }), remainingSids: ["CAcaller", "CAtarget"] }).actions.length === 0,
  );
  ok(
    "a rep left alone is not rescued — they can hang up",
    onParticipantLeave({ transfer: transferRow({ state: XFER_RETURNED }), remainingSids: ["CArep"] }).actions.length === 0,
  );
  // While the transfer is still open the target's own leg status is the
  // authority. Acting on a leave here would eject a caller whose target is one
  // second from answering.
  ok(
    "a leave during a live transfer does nothing",
    onParticipantLeave({ transfer: transferRow({ state: XFER_RINGING }), remainingSids: ["CAcaller"] }).actions.length === 0,
  );
  ok("an empty room does nothing", onParticipantLeave({ transfer: transferRow({ state: XFER_COMPLETED }), remainingSids: [] }).actions.length === 0);

  // ── The vocabulary is closed, and open means open ────────────────────
  ok("every state a transfer can hold is declared", TRANSFER_STATES.length === 6, TRANSFER_STATES);
  ok("ringing and talking are open", isTransferOpen(XFER_RINGING) && isTransferOpen(XFER_TALKING));
  ok(
    "and nothing else is",
    [XFER_COMPLETED, XFER_RETURNED, XFER_CANCELLED, XFER_FAILED].every((s) => !isTransferOpen(s)),
  );
  ok("an unknown state is not open", !isTransferOpen("maybe") && !isTransferOpen(null));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. What each leg is told, and what the rep is shown");
// ═══════════════════════════════════════════════════════════════════════════

{
  const repPlan = repLegPlan({ transfer: transferRow() });
  ok("the transferring rep follows the caller into the conference", repPlan.join === true);
  ok("…into the transfer's OWN room", repPlan.conferenceName === conferenceNameFor("t1"));
  ok("…and is told what is about to happen", repPlan.say.length > 0 && !/undefined/.test(repPlan.say.join(" ")));
  ok(
    "warm and cold say different things to the rep",
    repLegPlan({ transfer: transferRow({ kind: TRANSFER_WARM }) }).say[0] !==
      repLegPlan({ transfer: transferRow({ kind: TRANSFER_COLD }) }).say[0],
  );
  // The ordinary end of an ordinary call comes through the same door.
  ok("no transfer means the rep's leg simply ends", repLegPlan({ transfer: null }).join === false);
  ok("…saying nothing, because nothing happened", repLegPlan({ transfer: null }).say.length === 0);
  ok("a finished transfer does not re-join the rep", repLegPlan({ transfer: transferRow({ state: XFER_COMPLETED }) }).join === false);

  const target = targetLegPlan({ transfer: transferRow(), fromRepName: "Daniel" });
  ok("the target is told who it is from before they are joined", /Daniel/.test(target.say.join(" ")), target.say);
  ok("…and joined to the same room", target.conferenceName === conferenceNameFor("t1"));
  ok("an unknown transferrer never prints undefined", !/undefined|null/.test(targetLegPlan({ transfer: transferRow(), fromRepName: null }).say.join(" ")));
  ok(
    "warm and cold say different things to the target",
    targetLegPlan({ transfer: transferRow({ kind: TRANSFER_WARM }) }).say[0] !==
      targetLegPlan({ transfer: transferRow({ kind: TRANSFER_COLD }) }).say[0],
  );
  const late = targetLegPlan({ transfer: transferRow({ state: XFER_CANCELLED }) });
  ok("a target who picks up after a cancel is not joined", late.join === false);
  ok("…and is told why rather than dropped in silence", late.say.length > 0);

  // The conference name is the room. A collision is two unrelated callers
  // hearing each other, so a name that cannot be made is refused, not guessed.
  ok("a conference is named from the transfer", conferenceNameFor("abc123") === "fq_xfer_abc123");
  ok("two transfers get two rooms", conferenceNameFor("a") !== conferenceNameFor("b"));
  ok("an id Twilio could not carry produces no name", conferenceNameFor("../../etc") === null);
  ok("…nor does an empty one", conferenceNameFor("") === null && conferenceNameFor(null) === null);

  // The words on the rep's screen come from the same state machine, so a
  // screen saying "ringing" over a row that says returned cannot happen.
  ok("ringing reads as ringing", /Ringing/.test(describeTransfer(transferRow(), { targetName: "Maria" })));
  ok("talking names what the rep can do next", /put them through/i.test(describeTransfer(transferRow({ state: XFER_TALKING }), { targetName: "Maria" })));
  ok("returned says they are back with the caller", /back with the caller/i.test(describeTransfer(transferRow({ state: XFER_RETURNED, failureReason: "nobody answered" }))));
  ok("…and carries the reason", /nobody answered/.test(describeTransfer(transferRow({ state: XFER_RETURNED, failureReason: "nobody answered" }))));
  ok("no transfer describes nothing", describeTransfer(null) === null);
  ok("nothing ever prints undefined", TRANSFER_STATES.every((state) => !/undefined/.test(describeTransfer(transferRow({ state })) || "")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The queue: never for ever, never in silence, never instead of the voicemail");
// ═══════════════════════════════════════════════════════════════════════════

{
  // ── The bound, and that it is checked FIRST ──────────────────────────
  //
  // The whole promise rests on the cap being ahead of the availability branch.
  // A presence table that keeps reporting an available rep whose browser is
  // not answering would otherwise hold a caller through an unlimited number of
  // rounds, each of which looks reasonable on its own.
  const exhausted = queueStep({ round: MAX_QUEUE_ROUNDS, reachableNow: 99 });
  ok("the round cap wins over a floor full of available reps", exhausted.action === "voicemail", exhausted);
  ok("…at every round beyond it too", queueStep({ round: MAX_QUEUE_ROUNDS + 50, reachableNow: 99 }).action === "voicemail");
  ok("…and says why", exhausted.reason === "wait_exhausted");
  ok("…and offers a message rather than hanging up", /leave your name/i.test(exhausted.say.join(" ")));
  ok("a zero round cap goes straight to the voicemail", queueStep({ round: 0, reachableNow: 5, maxRounds: 0 }).action === "voicemail");

  ok("the wait is bounded by an arithmetic somebody can read", maxHoldSeconds() > 0 && maxHoldSeconds() < 300, maxHoldSeconds());
  ok("…that grows with the cap and nothing else", maxHoldSeconds({ maxRounds: 8 }) === 2 * maxHoldSeconds({ maxRounds: 4 }));
  ok("…and is zero when there are no rounds", maxHoldSeconds({ maxRounds: 0 }) === 0);
  ok("a nonsense cap is treated as none, not as infinity", maxHoldSeconds({ maxRounds: Number.NaN }) === 0);

  // ── Never in silence ─────────────────────────────────────────────────
  for (let r = 0; r < MAX_QUEUE_ROUNDS; r += 1) {
    const step = queueStep({ round: r, reachableNow: 0 });
    ok(`round ${r} says something out loud`, step.say.length > 0 && step.say.every((l) => l.trim().length > 0));
    ok(`round ${r} never prints undefined`, !/undefined|null/.test(step.say.join(" ")));
    ok(`round ${r} is never a silent hold`, step.silentHold === false);
    ok(`round ${r} has a bounded quiet stretch`, step.pauseSeconds > 0 && step.pauseSeconds <= QUIET_PAUSE_SECONDS, step.pauseSeconds);
    ok(`round ${r} moves the wait forward`, step.nextRound === r + 1);
  }
  ok(
    "the last hold round warns the message is coming next",
    /message/i.test(queueStep({ round: MAX_QUEUE_ROUNDS - 1, reachableNow: 0 }).say.join(" ")),
  );

  // ── It does not claim a position it cannot know ──────────────────────
  //
  // There is no queue object: each caller loops on their own timer, so FieldQuo
  // genuinely does not know how many others are waiting. A number here would
  // be AGENTS.md failure class 5 on a claim the caller can check by counting.
  for (let r = 0; r < MAX_QUEUE_ROUNDS; r += 1) {
    const said = queueStep({ round: r, reachableNow: 0 }).say.join(" ");
    ok(`round ${r} claims no position in a queue`, !/number \d|position|\d+(st|nd|rd|th) in/i.test(said), said);
  }

  // ── Music when there is any, a bounded pause when there is not ───────
  const withMusic = queueStep({ round: 1, reachableNow: 0, holdMusicUrl: "https://cdn.example.com/hold.mp3" });
  ok("a configured clip is played", withMusic.playUrl === "https://cdn.example.com/hold.mp3");
  ok("…and replaces the pause rather than adding to it", withMusic.pauseSeconds === 0);
  ok("a clip that is not a URL is ignored rather than emitted", queueStep({ round: 1, holdMusicUrl: "hold.mp3" }).playUrl === null);
  ok("…and the pause comes back when it is", queueStep({ round: 1, holdMusicUrl: "hold.mp3" }).pauseSeconds === QUIET_PAUSE_SECONDS);

  // ── Somebody came free ───────────────────────────────────────────────
  const free = queueStep({ round: 1, reachableNow: 2 });
  ok("a rep coming free mid-wait is rung", free.action === "ring", free);
  ok("…and the caller is told", free.say.length > 0);
  ok("…and an unanswered ring costs a look", free.nextRound === 2);

  // The rule that stops a queue becoming a machine that rings one unanswered
  // desk five times in ninety seconds.
  const justRang = queueStep({ round: 1, reachableNow: 5, justRang: true });
  ok("a ring nobody took holds rather than ringing the same desk again", justRang.action === "hold", justRang);
  ok(
    "…and the first such hold says the phone rang out",
    /did not pick up|Nobody picked up/i.test(queueStep({ round: 0, reachableNow: 5, justRang: true }).say.join(" ")),
  );
  ok("…which is the same sentence requeueSay writes", requeueSay({ repName: "Daniel" }).join(" ").includes("Daniel"));
  ok("requeueSay never prints undefined", !/undefined|null/.test(requeueSay({}).join(" ")));
  ok(
    "…but the cap still wins over justRang",
    queueStep({ round: MAX_QUEUE_ROUNDS, reachableNow: 0, justRang: true }).action === "voicemail",
  );

  // ── Hostile rounds ───────────────────────────────────────────────────
  //
  // Two different kinds of bad, and they must not get the same answer. An
  // ABSENT round is the ordinary first entry. A round that is present and
  // cannot be read is a counter that has stopped counting, and treating that
  // as zero is a loop that restarts the wait on every pass.
  for (const missing of [undefined, null]) {
    const step = queueStep({ round: missing, reachableNow: 0 });
    ok(`a missing round starts the wait (${String(missing)})`, step.action === "hold" && step.round === 0, step);
  }
  for (const unreadable of ["banana", Number.NaN, Infinity, -Infinity]) {
    const step = queueStep({ round: unreadable, reachableNow: 9 });
    ok(`an unreadable round of ${String(unreadable)} ENDS the wait rather than restarting it`, step.action === "voicemail", step);
  }
  ok("a negative round is the first one", queueStep({ round: -3, reachableNow: 0 }).round === 0);
  ok("every readable round moves the wait forward or ends it", (() => {
    for (let r = 0; r <= MAX_QUEUE_ROUNDS + 2; r += 1) {
      const step = queueStep({ round: r, reachableNow: 3 });
      if (step.action !== "voicemail" && step.nextRound <= step.round) return false;
    }
    return true;
  })());
  ok("a nonsense reachable count holds rather than dialling nothing", queueStep({ round: 0, reachableNow: "lots" }).action === "hold");

  // ── The rep's name, when we have it ──────────────────────────────────
  ok("the first line names the rep they were trying to reach", /Daniel/.test(queueStep({ round: 0, repName: "Daniel" }).say.join(" ")));
  ok("…and says something true when we do not", /Everyone/.test(queueStep({ round: 0 }).say.join(" ")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. It survives into the TwiML, which is the only thing Twilio reads");
// ═══════════════════════════════════════════════════════════════════════════

{
  // ── The caller's move into the conference ────────────────────────────
  const transfer = transferRow();
  const callerXml = callerConferenceTwiml({ transfer, origin: "https://app.fieldquo.com" }).toString();
  ok("the caller is dialled into the transfer's conference", new RegExp(`>${transfer.conferenceName}</Conference>`).test(callerXml), callerXml);
  ok(
    "…without starting it, so Twilio's wait music covers the gap before the hold",
    /startConferenceOnEnter="false"/.test(callerXml),
    callerXml,
  );
  ok(
    "…and the caller hanging up ends the room rather than leaving it billing",
    /endConferenceOnExit="true"/.test(callerXml),
    callerXml,
  );
  ok("…with join and leave reported back", /statusCallbackEvent="join leave"/.test(callerXml), callerXml);
  // A hand-built document with a bare ampersand is well-formed right up until
  // a second query parameter is added to it.
  ok("…and the callback URL's ampersand is escaped", /&amp;transferId=/.test(callerXml), callerXml);
  ok("…and it is exactly one Dial", (callerXml.match(/<Dial/g) || []).length === 1);

  // ── A rep or a target joining ────────────────────────────────────────
  //
  // Rendered here the way app/api/rep-dial/transfer renders it, and asserted on
  // the two attributes that decide whether a transfer works: the joiner starts
  // the conference, and stepping out of it never ends it for everybody else.
  const plan = repLegPlan({ transfer });
  const joiner = new twilio.twiml.VoiceResponse();
  for (const line of plan.say) joiner.say({ voice: "alice" }, line);
  const jd = joiner.dial();
  jd.conference(
    { startConferenceOnEnter: true, endConferenceOnExit: false, beep: false },
    plan.conferenceName,
  );
  const joinerXml = joiner.toString();
  ok("a rep joining starts the conference", /startConferenceOnEnter="true"/.test(joinerXml), joinerXml);
  ok(
    "…and stepping out of a completed transfer does not end it for the other two",
    /endConferenceOnExit="false"/.test(joinerXml),
    joinerXml,
  );
  ok("…after being told what is happening", joinerXml.indexOf("<Say") < joinerXml.indexOf("<Dial"), joinerXml);
  ok("…and only ever joins one room", (joinerXml.match(/<Conference/g) || []).length === 1);

  // ── A queue round that rings ─────────────────────────────────────────
  const ring = ringPlan({ presence: [fresh("maria", 2), fresh("owner", 8)], transferTo: "+15551234567", now: NOW });
  const step = queueStep({ round: 1, reachableNow: ring.targets.length });
  const ringing = new twilio.twiml.VoiceResponse();
  for (const line of step.say) ringing.say({ voice: "alice" }, line);
  const dial = ringing.dial({
    callerId: "+16135550142",
    timeout: ring.ringSeconds,
    answerOnBridge: true,
    action: `https://app.fieldquo.com/api/rep-dial/inbound?stage=after-dial&round=${step.nextRound}&attemptId=a1`,
    method: "POST",
  });
  for (const t of ring.targets) {
    if (t.kind === "client") dial.client(t.value);
    else dial.number(t.value);
  }
  const ringXml = ringing.toString();
  // ONE <Dial> with several children. A second <Dial> verb only starts after
  // the first gives up entirely, which is a different and much slower thing.
  ok("a queue ring is ONE Dial with every target inside it", (ringXml.match(/<Dial/g) || []).length === 1, ringXml);
  ok("…longest-idle rep first", ringXml.indexOf("sales_rep:owner") < ringXml.indexOf("sales_rep:maria"), ringXml);
  ok("…the standing number after every client", ringXml.lastIndexOf("+15551234567") > ringXml.lastIndexOf("sales_rep:"), ringXml);
  ok("…answerOnBridge, so the caller hears ringing rather than silence", /answerOnBridge="true"/.test(ringXml));
  ok("…and the round travels in the action URL so a no-answer costs a look", /round=2/.test(ringXml), ringXml);
  ok("…escaped, because it is not the only parameter", /&amp;attemptId=/.test(ringXml), ringXml);

  // ── A queue round that holds ─────────────────────────────────────────
  const holdStep = queueStep({ round: 1, reachableNow: 0 });
  const holding = new twilio.twiml.VoiceResponse();
  for (const line of holdStep.say) holding.say({ voice: "alice" }, line);
  if (holdStep.playUrl) holding.play({}, holdStep.playUrl);
  else holding.pause({ length: holdStep.pauseSeconds });
  holding.redirect({ method: "POST" }, `https://app.fieldquo.com/api/rep-dial/inbound?stage=queue&round=${holdStep.nextRound}&attemptId=a1`);
  const holdXml = holding.toString();
  ok("a hold speaks before it waits", holdXml.indexOf("<Say") < holdXml.indexOf("<Pause"), holdXml);
  ok("…never emits a Dial with nothing in it", !/<Dial/.test(holdXml), holdXml);
  ok("…and always comes back for another look", /<Redirect/.test(holdXml) && /round=2/.test(holdXml), holdXml);
  ok("…which is the ONLY way out of a hold", (holdXml.match(/<Redirect/g) || []).length === 1);
  ok("…and it never hangs up on somebody who is waiting", !/<Hangup/.test(holdXml), holdXml);

  // ── The end of the queue is the voicemail, not the queue instead ─────
  const vmStep = queueStep({ round: MAX_QUEUE_ROUNDS, reachableNow: 0 });
  const vm = new twilio.twiml.VoiceResponse();
  for (const line of vmStep.say) vm.say({ voice: "alice" }, line);
  vm.record({
    maxLength: 120,
    playBeep: true,
    timeout: 5,
    transcribe: false,
    action: "https://app.fieldquo.com/api/rep-dial/inbound?stage=after-voicemail&attemptId=a1",
    method: "POST",
  });
  vm.hangup();
  const vmXml = vm.toString();
  ok("the wait ends at a Record", /<Record/.test(vmXml), vmXml);
  ok("…with a beep, so the caller knows when to speak", /playBeep="true"/.test(vmXml));
  ok("…bounded in length", /maxLength="120"/.test(vmXml));
  ok("…not transcribed, which is a per-minute charge", /transcribe="false"/.test(vmXml));
  ok("…and posting to a stage that exists", /stage=after-voicemail/.test(vmXml));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The webhook signature covers the whole URL");
// ═══════════════════════════════════════════════════════════════════════════
//
// Every stage of both features is addressed by a query string. The verifier
// rebuilt the URL from `pathname` alone behind a proxy, which drops it — so on
// any Vercel deployment a second-leg webhook was a silent 403 and the caller
// heard Twilio's own "an application error has occurred". Executed here rather
// than read, against the real function.

{
  const TOKEN = "a-test-auth-token";
  const before = process.env.TWILIO_AUTH_TOKEN;
  process.env.TWILIO_AUTH_TOKEN = TOKEN;

  const full = "https://app.fieldquo.com/api/rep-dial/transfer?stage=target&transferId=t1";
  const body = { CallSid: "CAtarget", CallStatus: "no-answer" };
  const signature = getExpectedTwilioSignature(TOKEN, full, body);
  const form = new URLSearchParams(body).toString();

  const request = (url) =>
    new Request(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": signature,
        // The pair that makes the proxy branch fire — every Vercel deployment
        // sets both.
        "x-forwarded-proto": "https",
        host: "app.fieldquo.com",
      },
      body: form,
    });

  const good = await verifyTwilioWebhook(request(full));
  ok("a signed webhook carrying a query string verifies", good.ok === true);
  ok("…and its body is still parsed for the caller", good.params.CallStatus === "no-answer");

  const tampered = await verifyTwilioWebhook(
    request("https://app.fieldquo.com/api/rep-dial/transfer?stage=target&transferId=SOMEBODY-ELSE"),
  );
  ok("changing the transfer id in the URL breaks the signature", tampered.ok === false);

  const bare = "https://app.fieldquo.com/api/sms/inbound";
  const bareSig = getExpectedTwilioSignature(TOKEN, bare, body);
  const bareReq = new Request(bare, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": bareSig,
      "x-forwarded-proto": "https",
      host: "app.fieldquo.com",
    },
    body: form,
  });
  ok("a webhook with no query string still verifies, as it always did", (await verifyTwilioWebhook(bareReq)).ok === true);

  process.env.TWILIO_AUTH_TOKEN = "";
  ok("no auth token means no verification, never a pass", (await verifyTwilioWebhook(request(full))).ok === false);
  if (before === undefined) delete process.env.TWILIO_AUTH_TOKEN;
  else process.env.TWILIO_AUTH_TOKEN = before;
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The routes actually use it");
// ═══════════════════════════════════════════════════════════════════════════

{
  const bridge = source("app/api/rep-dial/bridge/route.js");
  // Without this, the rep's leg simply ends when the caller is moved, taking
  // with it the only person who could hand the caller back.
  ok("the bridge gives its Dial an action so the rep can follow the caller", /action: `\$\{origin\}\/api\/rep-dial\/transfer\?stage=rep-leg/.test(bridge), );
  ok("…and records the rep's own leg from the signed webhook", /recordRepLeg\(\{\s*attemptId/.test(bridge));
  ok("…never from anything the browser sent", /repCallSid: params\.CallSid/.test(bridge));
  ok("the bridge still sets no record attribute on the conversation", !/record:\s*true/.test(bridge));

  const webhook = source("app/api/rep-dial/transfer/route.js");
  ok("the transfer webhook verifies its signature", /verifyTwilioWebhook\(request\)/.test(webhook));
  ok("…before anything else in the handler", webhook.indexOf("verifyTwilioWebhook") < webhook.indexOf('"rep-leg"'));
  ok("…and refuses an unsigned request outright", /status: 403/.test(webhook));
  ok("it handles all four stages", ["rep-leg", "target", "target-status", "conference"].every((s) => webhook.includes(`"${s}"`)));
  ok("the state machine runs on the conference JOIN, not the carrier's answered", /participant-join/.test(webhook) && /onParticipantJoin\(/.test(webhook));
  ok("…and an `answered` status is deliberately ignored", /status === "answered"/.test(webhook));
  ok("a leave is only acted on with a readable participant list", /remaining === null/.test(webhook));
  ok("every state move is guarded on the state it moves from", /fromState: transfer\.state/.test(webhook));
  // Scoped past the import list, or the import itself counts as the first use.
  ok("…and Twilio is only touched once the row moved", (() => {
    const handler = webhook.slice(webhook.indexOf("export async function POST"));
    return handler.indexOf("moved.applied") < handler.indexOf("applyTransferActions(");
  })());

  const repRoute = source("app/api/sales/calls/transfer/route.js");
  ok("the rep's route goes through the calling gate", /requireCallingRep\(request\)/.test(repRoute));
  ok("…on both handlers", (repRoute.match(/requireCallingRep\(request\)/g) || []).length === 2);
  ok("…and returns the gate's refusal verbatim", /if \(refusal\)/.test(repRoute));
  // Scoped to the rep, on BOTH columns that can name one. This asserted
  // `salesRepId` alone until inbound calls could be answered in the browser,
  // and that was the bug: an inbound row's salesRepId is written before the
  // phone rings, from whoever last rang that contractor, so the rep actually
  // holding the call failed this WHERE and was told it was not theirs.
  // `answeredByRepId` widens nothing — it is written only by
  // /api/sales/calls/answered, and only after Twilio has confirmed the leg was
  // rung at that rep's own client identity.
  ok("the attempt is scoped to the rep in the WHERE",
    /OR: \[\{ salesRepId: repId \}, \{ answeredByRepId: repId \}\]/.test(repRoute));
  ok("…and to nobody the request named", !/body\.(salesRepId|answeredByRepId|repId)/.test(repRoute));
  ok("the target list is rebuilt in the request that acts on it", /freeTargetsFor\(rep\.id\)/.test(repRoute));
  ok("no CallSid is ever read from the request body", !/body\.(caller|rep|target)CallSid/i.test(repRoute));
  // WHICH leg is redirected is not the same in both directions, and this used
  // to assert it was always the caller. That was right while only outbound
  // calls could be transferred: there the rep's browser is the PARENT of the
  // <Dial>, and redirecting a parent hangs the child up — the caller. On an
  // INBOUND call the roles are reversed, so moving the caller would have
  // dropped the rep and left nobody to hand the caller back to. The choice is
  // conferenceMoveLeg's, carried on the plan, and section 3 of
  // scripts/check-inbound-transfer.mjs executes both branches of it.
  ok("the leg to move comes from the plan, never from an if in the route",
    /plan\.moveLeg === MOVE_REP/.test(repRoute) && !/direction === "in"/.test(repRoute));
  ok("…the caller on an outbound call", /moveCallerToConference\(/.test(repRoute));
  ok("…and the rep on an inbound one", /moveRepToConference\(/.test(repRoute));
  ok("a second transfer on one call is refused rather than started", /already being transferred/i.test(read("app/api/sales/calls/transfer/route.js")));

  const inbound = source("app/api/rep-dial/inbound/route.js");
  ok("the inbound route holds a caller instead of dropping them", /stage === "queue"/.test(inbound) && /toQueue\(/.test(inbound));
  // Scoped to the branch itself. A file-wide match for `toQueue(` passed a
  // mutation that put the first look straight back to a voicemail, because the
  // no-answer path further down still called it.
  ok("…on the first look that finds nobody", (() => {
    const at = inbound.indexOf("ring.targets.length === 0");
    if (at === -1) return false;
    return /^\s*\)?\s*\{\s*return toQueue\(/.test(inbound.slice(at + "ring.targets.length === 0".length, at + 120));
  })());
  ok("…and after a ring nobody took", /afterRing: true/.test(inbound));
  ok("the queue re-reads presence every round", /presenceFor\(/.test(inbound) && /queueStep\(\{/.test(inbound));
  ok("…and re-runs the ring plan with it", /ringPlan\(\{/.test(inbound));
  ok("the after-voicemail stage exists at last", /stage === "after-voicemail"/.test(inbound));
  ok("…and writes the recording to the row", /recordVoicemail\(/.test(inbound));
  ok("…and an orphaned message is reported rather than dropped", /voicemail_orphaned/.test(inbound));
  ok("the conversation itself is still never recorded", !/record:\s*true/.test(inbound) && !/recordingStatusCallback/.test(inbound));

  const store = source("lib/sales/calls/store.js");
  ok("something reads the voicemail columns", /voicemailUrl: true/.test(store));
  ok("…and the floor board renders them", /voicemailUrl/.test(source("app/platform/sales/floor/page.js")));
  ok("…telling a zero-second message apart from no message at all", /voicemailSeconds === 0/.test(source("app/platform/sales/floor/page.js")));
  ok(
    "the transfer table is probed on its own, so a missing one does not switch off the phone",
    /export function transferStoreState/.test(store) && !/salesCallTransfer: "SalesCallTransfer"/.test(store),
  );
  ok("the calling gate declares the transfer table it writes", REP_CALL_WRITES.includes("salesCallTransfer"));

  const schema = read("prisma/schema.prisma");
  ok("SalesCallTransfer is in the schema", /model SalesCallTransfer \{/.test(schema));
  ok("…with the rep leg it needs on the attempt", /repCallSid\s+String\?/.test(schema));
  ok("…and it is not @unique, so a webhook retry cannot fail a call", !/repCallSid\s+String\?\s+@unique/.test(schema));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:call-transfer is a script", typeof pkg.scripts?.["check:call-transfer"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:call-transfer"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
