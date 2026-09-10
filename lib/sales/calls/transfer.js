// lib/sales/calls/transfer.js
//
// A rep on a live call hands the caller to somebody else.
//
// ══ What was there before ═════════════════════════════════════════════════
//
// Nothing. A rep who reached the wrong person, or reached the right person and
// needed the owner on the line, had exactly one move: "let me get someone to
// call you back", and hang up. Every contact-centre reference this floor was
// modelled on has transfer as a first-class verb; FieldQuo had the outbound
// dialler, then inbound distribution, and still no way to pass a caller across
// the room. The owner has asked for it repeatedly.
//
// ══ Two kinds, and they differ in ONE moment ══════════════════════════════
//
//   WARM   the two reps speak privately first. The caller is on hold while
//          they do. The transferring rep decides when to join them.
//   COLD   the handover happens the instant the target picks up. One press,
//          then the transferring rep is released.
//
// Everything else about the two is identical, which is why they are one state
// machine with one branch rather than two flows. The branch is
// `onParticipantJoin` when the TARGET arrives: warm goes to `talking`, cold
// goes straight to `completed`.
//
// ══ THE CALLER IS NEVER LET GO OF ═════════════════════════════════════════
//
// This is the rule the design is built around, and it is why the transferring
// rep stays in the conference until the target actually answers — even on a
// cold transfer, where they are released a moment later.
//
// The obvious cold implementation is to redirect the caller's leg at the
// target and let the transferring rep drop immediately. It was rejected: when
// the target does not pick up, there is then nobody to give the caller back
// to. The rep's browser has already torn its Device down, so they cannot even
// be rung again. The caller — who was mid-sentence with a human thirty seconds
// ago — gets a dial tone.
//
// So the sequence is: caller into a conference, transferring rep follows,
// BOTH on hold while the target rings, and only then does the branch above
// happen. A target who does not answer costs the caller some hold music and
// returns them to the person they were already speaking to
// (`onTargetEnded` → `returned`).
//
// The one case where that is not possible is the transferring rep hanging up
// mid-transfer. Their leg is gone, so `returned` would return the caller to an
// empty conference — silence, forever, which is the worst outcome in this
// whole file. That case is `failed` with a `callerToQueue` action, and the
// caller lands in lib/sales/calls/queue.js, which ends at a voicemail rather
// than at nothing.
//
// ══ Hold, rather than "start the conference later" ════════════════════════
//
// Twilio has two ways to keep somebody from hearing a conference: don't start
// it (`startConferenceOnEnter=false`), or hold the participant. Only the
// second is per-participant, and warm transfer needs exactly that — two people
// talking while a third hears music, all in one room. `startConferenceOnEnter`
// is global to the conference and would put the transferring rep on the wrong
// side of the wall along with the caller.
//
// Neither hold plays anything of ours: Twilio's own default hold music is used
// (no `holdUrl`), because a caller must never hear silence and a hold URL we
// forget to deploy is silence. The queue module, which has no conference to
// borrow that from, makes its own arrangement and says so.
//
// ══ Pure, over rows the caller has already read ═══════════════════════════
//
// The same shape as lib/sales/calls/inboundDistribution.js and for the same
// reason: scripts/check-call-transfer.mjs drives every branch of this file —
// nobody reachable, the target being the transferrer, stale presence, a rep
// who hung up mid-transfer, a late webhook for a transfer that already
// finished — with no database, no conference and no phone.
//
// The impure half is app/api/sales/calls/transfer (the rep presses it) and
// app/api/rep-dial/transfer (Twilio reports on it). Both do what the `actions`
// array below tells them and decide nothing.
import { repIdentity } from "./browserDial";
import { reachable, presenceOf } from "./inboundDistribution";

/** The two kinds. There is no third and no default — the rep picks. */
export const TRANSFER_WARM = "warm";
export const TRANSFER_COLD = "cold";
export const TRANSFER_KINDS = Object.freeze([TRANSFER_WARM, TRANSFER_COLD]);

/**
 * The states one transfer moves through.
 *
 * `returned` and `failed` are deliberately different words for two outcomes
 * that both mean "the transfer did not happen". In `returned` the caller is
 * still talking to the rep who started it, which is a recoverable, ordinary
 * event. In `failed` there is nobody left holding them, which is the one
 * outcome that needs a queue and a voicemail behind it. Collapsing the two
 * would hide the only one worth an alert.
 */
export const XFER_RINGING = "ringing";
export const XFER_TALKING = "talking";
export const XFER_COMPLETED = "completed";
export const XFER_RETURNED = "returned";
export const XFER_CANCELLED = "cancelled";
export const XFER_FAILED = "failed";

export const TRANSFER_STATES = Object.freeze([
  XFER_RINGING,
  XFER_TALKING,
  XFER_COMPLETED,
  XFER_RETURNED,
  XFER_CANCELLED,
  XFER_FAILED,
]);

/** The states in which more events are still expected. */
export const TRANSFER_OPEN_STATES = Object.freeze([XFER_RINGING, XFER_TALKING]);

export function isTransferOpen(state) {
  return TRANSFER_OPEN_STATES.includes(state);
}

/**
 * How long the target is rung before the caller is handed back.
 *
 * Shorter than the 20-second inbound ring for a reason that only applies here:
 * the caller is ALREADY on hold, having been told they are being put through.
 * Twenty-five seconds of that is the outside edge of what a person will sit
 * through without deciding they have been abandoned.
 */
export const TRANSFER_RING_SECONDS = 25;

/**
 * The conference one transfer happens in.
 *
 * Named from the transfer's own id rather than the attempt's, so a second
 * transfer on the same call — a rep hands to the owner, the owner hands on
 * again — gets its own room instead of walking into the leftovers of the
 * first. Twilio keys conferences by name and reuses an existing one silently,
 * which makes a colliding name a bug that presents as two unrelated callers
 * hearing each other.
 */
export function conferenceNameFor(transferId) {
  if (typeof transferId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(transferId)) return null;
  return `fq_xfer_${transferId}`;
}

/**
 * Who this rep may hand the caller to, right now.
 *
 * ── Presence is not re-decided here ─────────────────────────────────────
 *
 * `reachable` and `presenceOf` come from inboundDistribution.js unchanged. A
 * second opinion about who is available is how a floor board and a router come
 * to disagree, and this module has no better information than the router does.
 * Note what that inherits: the rows are `{ salesRepId, presence: { state, … } }`
 * with the state NESTED, and reading `row.state` flat is the bug that shipped
 * once already and made every rep look unreachable.
 *
 * ── The transferrer is not on their own list ────────────────────────────
 *
 * Transferring a caller to yourself is not a no-op — it would move the caller
 * into a conference, ring your own client, and find it busy on the call it is
 * already on. So `excludeRepId` is removed before anything else, and the API
 * route re-checks the chosen target against this list rather than trusting the
 * browser's pick.
 *
 * @param reps        `[{ id, name }]` for the reps this caller may see.
 * @param presence    presenceFor() rows, or null when the store is down.
 * @param excludeRepId  the rep doing the transferring.
 * @param transferTo  FIELDQUO_SALES_TRANSFER_TO, normalised, or null — the
 *                    owner's real phone, for "get me the owner" when the owner
 *                    is not at a desk.
 * @returns `[{ key, kind, value, salesRepId, name, why }]`, longest-idle rep
 *          first, the standing number last. Empty means nobody, which the
 *          screen must say rather than render a picker with nothing in it.
 */
export function transferTargets({
  reps = [],
  presence = [],
  excludeRepId = null,
  transferTo = null,
  now = new Date(),
} = {}) {
  const rows = Array.isArray(presence) ? presence : [];
  const byId = new Map(
    rows.filter((p) => p?.salesRepId).map((p) => [p.salesRepId, presenceOf(p)]),
  );
  const names = new Map(
    (Array.isArray(reps) ? reps : []).filter((r) => r?.id).map((r) => [r.id, r.name || null]),
  );

  const free = rows
    .filter((p) => p?.salesRepId && p.salesRepId !== excludeRepId)
    .filter((p) => reachable(presenceOf(p), now))
    // Longest idle first, the same fairness rule ringPlan applies. A transfer
    // is a call, and a rep who has been waiting should get it.
    .sort((a, b) => new Date(presenceOf(a)?.lastSeenAt) - new Date(presenceOf(b)?.lastSeenAt));

  const targets = [];
  for (const row of free) {
    const identity = repIdentity(row.salesRepId);
    // repIdentity refuses an id outside Twilio's identity character set rather
    // than mangling one into a string that resolves to a different rep.
    if (!identity) continue;
    targets.push({
      key: `rep:${row.salesRepId}`,
      kind: "client",
      value: identity,
      salesRepId: row.salesRepId,
      name: names.get(row.salesRepId) || null,
      why: "available now",
    });
  }

  if (typeof transferTo === "string" && transferTo.startsWith("+")) {
    targets.push({
      key: `number:${transferTo}`,
      kind: "number",
      value: transferTo,
      salesRepId: null,
      name: null,
      why: "the standing transfer number",
    });
  }

  // Deliberately NOT padded with unreachable reps marked "offline" so the
  // picker looks fuller. A name in a transfer list is a promise that pressing
  // it reaches somebody, and AGENTS.md failure class 5 is exactly this: an
  // absent statement rendered as a statement.
  void byId;
  return targets;
}

/**
 * May this transfer start, and against what?
 *
 * @param kind        "warm" | "cold", from the rep. No default: a transfer
 *                    that guessed would guess wrong half the time, and the two
 *                    sound completely different to the caller.
 * @param targetKey   the `key` of one entry in `targets`.
 * @param targets     transferTargets() output, read in THIS request. The
 *                    browser's list is a courtesy; this one is the control.
 * @param attempt     the SalesCallAttempt row: `providerCallSid` is the
 *                    caller's leg, `repCallSid` is the rep's own browser leg.
 * @returns `{ ok, reason, kind, target, callerCallSid, repCallSid, ringSeconds }`
 */
export function startTransferPlan({
  kind = null,
  targetKey = null,
  targets = [],
  attempt = null,
} = {}) {
  const no = (reason) => ({
    ok: false,
    reason,
    kind: null,
    target: null,
    callerCallSid: null,
    repCallSid: null,
    ringSeconds: 0,
  });

  if (!TRANSFER_KINDS.includes(kind)) {
    return no("Say whether this is a warm transfer or a cold one.");
  }
  if (!attempt || typeof attempt !== "object") return no("There is no call to transfer.");

  const callerCallSid = typeof attempt.providerCallSid === "string" ? attempt.providerCallSid : null;
  if (!callerCallSid) {
    // The carrier has not reported the leg yet — a transfer pressed in the
    // first second of a call. Said plainly rather than attempted: an update
    // against a CallSid we do not have would move nothing and report success.
    return no("This call has not finished connecting yet. Give it a moment and press transfer again.");
  }

  const repCallSid = typeof attempt.repCallSid === "string" ? attempt.repCallSid : null;
  if (!repCallSid) {
    // Without the rep's own leg there is no way to put them back with the
    // caller when the target does not answer, and no way to release them when
    // it does. Refusing is the only honest answer — a transfer that could not
    // give the caller back is the thing this module exists to prevent.
    return no("This call cannot be transferred: your own line was never recorded, so there would be no way to hand the caller back if nobody answers.");
  }

  const target = (Array.isArray(targets) ? targets : []).find((t) => t?.key === targetKey) || null;
  if (!target) {
    return no("That person is not free any more. Pick somebody else.");
  }

  return {
    ok: true,
    reason: null,
    kind,
    target,
    callerCallSid,
    repCallSid,
    ringSeconds: TRANSFER_RING_SECONDS,
  };
}

/** An unchanged, inert answer — a webhook about a transfer that is already over. */
function inert(transfer) {
  return { state: transfer?.state || null, actions: [], changed: false, reason: null };
}

/**
 * Somebody joined the conference.
 *
 * The whole state machine is here, driven by Twilio's conference status
 * callback rather than by the outbound call's own status. The difference
 * matters: `answered` on the target leg means the carrier connected it, and
 * `participant-join` means they are actually in the room. Acting on the first
 * releases the transferring rep a beat before the target can hear anything,
 * and the caller says hello into a gap.
 *
 * An unknown CallSid does NOTHING. A conference is a room, and a third leg
 * arriving — a supervisor, a redelivery, something Twilio retried — must never
 * move a transfer's state.
 *
 * @param repLegUp  is the transferring rep still on the line? Only consulted
 *                  when the TARGET arrives, and only on a warm transfer: a rep
 *                  who hung up while the target was ringing cannot have the
 *                  private conversation warm is for, and leaving the caller on
 *                  hold waiting for one that will never happen is the worst
 *                  outcome in this file. So a warm transfer whose rep has gone
 *                  completes like a cold one — the caller gets the person who
 *                  actually picked up.
 */
export function onParticipantJoin({ transfer = null, callSid = null, repLegUp = true } = {}) {
  if (!transfer || !isTransferOpen(transfer.state)) return inert(transfer);
  if (typeof callSid !== "string" || !callSid) return inert(transfer);

  if (callSid === transfer.callerCallSid) {
    // Held the moment they arrive. Until the target answers, the caller must
    // not hear the transferring rep sitting in silence waiting.
    return {
      state: transfer.state,
      actions: [{ type: "hold", who: "caller" }],
      changed: false,
      reason: null,
    };
  }

  if (callSid === transfer.repCallSid) {
    // Only while the target is still ringing. On a warm transfer that has
    // reached `talking` the rep is deliberately off hold, and a redelivered
    // join event must not silently put them back on it mid-sentence.
    if (transfer.state !== XFER_RINGING) return inert(transfer);
    return {
      state: transfer.state,
      actions: [{ type: "hold", who: "rep" }],
      changed: false,
      reason: null,
    };
  }

  if (callSid === transfer.targetCallSid) {
    if (transfer.kind === TRANSFER_WARM && repLegUp) {
      // The private conversation. The caller stays held; only the two reps
      // come off hold, which is the entire difference between warm and cold.
      return {
        state: XFER_TALKING,
        actions: [{ type: "unhold", who: "rep" }],
        changed: transfer.state !== XFER_TALKING,
        reason: null,
      };
    }
    return {
      state: XFER_COMPLETED,
      actions: [
        // The target inherits the caller's power to end the room. Without it,
        // the target hanging up first leaves the caller alone in a conference
        // that is still running — silence with no end, which is the same
        // failure as holding somebody forever wearing a different hat.
        { type: "endOnExit", who: "target" },
        // Order matters and survives into the adapter: the caller comes off
        // hold BEFORE the transferring rep is dropped. The other order leaves
        // a gap where the caller is held in a room with one stranger in it.
        { type: "unhold", who: "caller" },
        { type: "hangup", who: "rep" },
      ],
      changed: true,
      reason:
        transfer.kind === TRANSFER_WARM
          ? "the rep who started it had already hung up, so it completed as a cold transfer"
          : null,
    };
  }

  return inert(transfer);
}

/**
 * Somebody left the conference.
 *
 * ── Only consulted once the transfer is over ────────────────────────────
 *
 * While it is still open, the target's own leg status is the authority on what
 * happens next — a rep hanging up mid-ring is handled by `onTargetEnded`, and
 * acting on the leave as well would eject a caller whose target is one second
 * from answering.
 *
 * What this catches is the case AFTER: a completed transfer whose target hangs
 * up, or a returned one whose rep does. Either leaves exactly one person in
 * the room — the caller — listening to nothing. They go to the queue, which
 * rings whoever is free and ends at a voicemail.
 *
 * @param remainingSids  who is still in the conference, read from the carrier.
 */
export function onParticipantLeave({ transfer = null, remainingSids = [] } = {}) {
  if (!transfer) return inert(transfer);
  if (isTransferOpen(transfer.state)) return inert(transfer);

  const left = (Array.isArray(remainingSids) ? remainingSids : []).filter(Boolean);
  const alone = left.length === 1 && left[0] === transfer.callerCallSid;
  if (!alone) return inert(transfer);

  return {
    state: transfer.state,
    actions: [
      { type: "unhold", who: "caller" },
      { type: "callerToQueue" },
    ],
    changed: false,
    reason: "the caller was left alone in the conference",
  };
}

/**
 * The target's leg ended — no answer, busy, declined, or they hung up after a
 * warm conversation.
 *
 * @param repLegUp  is the transferring rep still on the line? Read fresh by
 *                  the adapter, never assumed. This is the parameter that
 *                  decides between handing the caller back and rescuing them.
 */
export function onTargetEnded({ transfer = null, callStatus = null, repLegUp = true } = {}) {
  if (!transfer || !isTransferOpen(transfer.state)) return inert(transfer);

  if (!repLegUp) {
    // The rep hung up while the target was ringing. There is nobody to give
    // the caller back to, and leaving them held in an empty conference is
    // silence with no end — so they come off hold and go to the queue, which
    // rings whoever is free and ends at a voicemail rather than at nothing.
    return {
      state: XFER_FAILED,
      actions: [
        { type: "unhold", who: "caller" },
        { type: "callerToQueue" },
      ],
      changed: true,
      reason: "the rep who started the transfer was no longer on the line",
    };
  }

  const wasTalking = transfer.state === XFER_TALKING;
  return {
    state: XFER_RETURNED,
    actions: [
      // Both, and the rep first: they are the one who needs to be able to
      // speak the instant the caller can hear again.
      { type: "unhold", who: "rep" },
      { type: "unhold", who: "caller" },
    ],
    changed: true,
    reason: wasTalking
      ? "they hung up before the caller was joined"
      : `nobody answered${callStatus ? ` (${callStatus})` : ""}`,
  };
}

/**
 * The transferring rep pressed "put them through" on a warm transfer.
 *
 * Refused while the target is still ringing, and that refusal is the point: a
 * rep who presses it early would hand the caller to a phone that has not been
 * picked up, which is precisely the blind hand-off this module is built to
 * make impossible on the warm path. If they wanted that, cold is one press
 * away and says so on the button.
 */
export function onComplete({ transfer = null, byRepId = null } = {}) {
  if (!transfer || !isTransferOpen(transfer.state)) {
    return { ...inert(transfer), ok: false, reason: "That transfer is already over." };
  }
  if (!byRepId || byRepId !== transfer.fromRepId) {
    return {
      ...inert(transfer),
      ok: false,
      reason: "Only the rep who started this transfer can complete it.",
    };
  }
  if (transfer.state !== XFER_TALKING) {
    return {
      // `...inert()` FIRST. Spreading it after the reason overwrote the reason
      // with inert's null, so every refusal here arrived at the screen as an
      // empty message — a control that refuses and will not say why.
      ...inert(transfer),
      ok: false,
      reason: "Nobody has picked up yet. Wait for them, or cancel and stay with the caller.",
    };
  }
  return {
    ok: true,
    reason: null,
    state: XFER_COMPLETED,
    actions: [
      { type: "endOnExit", who: "target" },
      { type: "unhold", who: "caller" },
      { type: "hangup", who: "rep" },
    ],
    changed: true,
  };
}

/**
 * The transferring rep changed their mind, at any point before it completes.
 *
 * Always available while the transfer is open — including during a warm
 * conversation, because "he says he can't take it" is the most common thing
 * that private conversation is FOR.
 */
export function onCancel({ transfer = null, byRepId = null } = {}) {
  if (!transfer || !isTransferOpen(transfer.state)) {
    return { ...inert(transfer), ok: false, reason: "That transfer is already over." };
  }
  if (!byRepId || byRepId !== transfer.fromRepId) {
    return {
      ...inert(transfer),
      ok: false,
      reason: "Only the rep who started this transfer can cancel it.",
    };
  }
  return {
    ok: true,
    reason: null,
    state: XFER_CANCELLED,
    actions: [
      // The target's leg goes first: cancelling and then leaving a phone
      // ringing on somebody's desk is how a rep answers a call that no longer
      // exists.
      { type: "hangupTarget" },
      { type: "unhold", who: "rep" },
      { type: "unhold", who: "caller" },
    ],
    changed: true,
  };
}

/**
 * What the transferring rep's own leg should do when the bridge's `<Dial>`
 * ends — which is what happens the moment the caller is redirected into the
 * conference.
 *
 * This is why the bridge carries an `action` at all. Without one the rep's leg
 * simply ends when the caller leaves the bridge, and the transfer loses the
 * only person who could take the caller back.
 */
export function repLegPlan({ transfer = null } = {}) {
  if (!transfer || !isTransferOpen(transfer.state)) {
    // The ordinary end of an ordinary call. Nothing to say and nothing to
    // join; the document ends and so does the leg.
    return { join: false, conferenceName: null, say: [] };
  }
  const name = conferenceNameFor(transfer.id);
  if (!name) return { join: false, conferenceName: null, say: [] };
  return {
    join: true,
    conferenceName: name,
    say: [
      transfer.kind === TRANSFER_WARM
        ? "Putting you through. The caller is on hold — you will hear them again when you join them."
        : "Putting you through. You will be released as soon as they pick up.",
    ],
  };
}

/**
 * What the TARGET hears before they are joined, and whether they are joined
 * at all.
 *
 * A whisper rather than a silent bridge: a rep whose browser rings and drops
 * them straight into a live call has no idea whether they are talking to a
 * colleague or a contractor, and the first thing they say is wrong either way.
 */
export function targetLegPlan({ transfer = null, fromRepName = null } = {}) {
  if (!transfer || !isTransferOpen(transfer.state)) {
    return {
      join: false,
      conferenceName: null,
      say: ["That transfer has already ended. Nothing to connect."],
    };
  }
  const name = conferenceNameFor(transfer.id);
  if (!name) {
    return { join: false, conferenceName: null, say: ["That transfer could not be connected."] };
  }
  const who = typeof fromRepName === "string" && fromRepName.trim() ? fromRepName.trim() : "a colleague";
  return {
    join: true,
    conferenceName: name,
    say: [
      transfer.kind === TRANSFER_WARM
        ? `Transfer from ${who}. You will speak to them first; the caller is on hold.`
        : `Transfer from ${who}. Connecting you to the caller now.`,
    ],
  };
}

/**
 * One line for the rep's screen, from the transfer row.
 *
 * Written here rather than in the component so that the words and the state
 * machine cannot drift — a screen saying "ringing" over a row that says
 * `returned` is the same dead control in text.
 */
export function describeTransfer(transfer = null, { targetName = null } = {}) {
  if (!transfer) return null;
  const who = targetName || transfer.targetName || "them";
  switch (transfer.state) {
    case XFER_RINGING:
      return `Ringing ${who}. The caller is on hold.`;
    case XFER_TALKING:
      return `You are on with ${who}. The caller is still on hold — put them through when you are ready.`;
    case XFER_COMPLETED:
      return `Transferred to ${who}.`;
    case XFER_RETURNED:
      return `That did not connect${transfer.failureReason ? ` — ${transfer.failureReason}` : ""}. You are back with the caller.`;
    case XFER_CANCELLED:
      return "Transfer cancelled. You are back with the caller.";
    case XFER_FAILED:
      return `The transfer failed${transfer.failureReason ? ` — ${transfer.failureReason}` : ""}.`;
    default:
      return null;
  }
}
