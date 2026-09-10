// lib/sales/calls/queue.js
//
// Everybody is on a call. What happens to the contractor on the line?
//
// ══ What happened before ══════════════════════════════════════════════════
//
// They were told there was nobody free and offered a voicemail, immediately,
// on the first look. lib/sales/calls/inboundDistribution.js fixed WHO gets
// rung; it did not change the fact that one glance at presence decided the
// whole call. A rep who hangs up four seconds after the call arrives is a rep
// who would have answered — and the caller has already been sent to a machine.
//
// A queue is the missing middle. Hold them, keep looking, and only take a
// message when looking has genuinely run out.
//
// ══ THE THREE PROMISES THIS FILE KEEPS ════════════════════════════════════
//
//   1. Never hold anybody forever. The round cap is checked FIRST, before
//      anything else, including before "is somebody free now" — see the order
//      of the guards in queueStep. A caller cannot be kept in the loop by a
//      presence table that keeps saying somebody is available while nobody
//      picks up, which is the exact shape of every hold-forever bug.
//   2. Never hold anybody silently. Every hold round returns at least one
//      spoken line, and either music or a bounded pause after it. There is no
//      branch that returns an empty `say`.
//   3. Never replace the voicemail with the queue. The queue ENDS at the
//      voicemail — `action: "voicemail"` is where every path terminates, and
//      app/api/rep-dial/inbound's recording stage is unchanged behind it.
//
// ══ It does not claim a position, and that is deliberate ══════════════════
//
// "You are number three in the queue" is the line every contact centre plays,
// and this one cannot honestly say it. There is no queue object: each caller
// loops independently, re-reading presence on their own timer, so FieldQuo
// genuinely does not know how many other people are waiting or in what order
// they will be reached. Inventing a number would be AGENTS.md failure class 5
// — absence padded with a default — on a claim the caller can check by
// counting how long they sit there.
//
// So the wait message says what is true: everyone is on a call, we are still
// trying, and here is when we will stop and take a message instead. A caller
// who is told the truth about a two-minute wait hangs up less often than one
// who is told they are third and still waiting six minutes later.
//
// ══ Why a redirect loop and not <Enqueue> ═════════════════════════════════
//
// Twilio's `<Enqueue>` needs something to DEQUEUE — a rep pressing "take the
// next call", or a TaskRouter workflow. FieldQuo has neither: reps work a
// prospect list and answer their own client, and the whole floor is built on
// declared presence rather than on a dialler handing work out (see
// lib/sales/calls/agentState.js's header on exactly which contact-centre
// concepts were deliberately not copied). A `<Redirect>` loop that re-runs
// ringPlan each time needs no consumer, no queue resource and no new vocabulary
// — and it degrades to the old behaviour, a voicemail, on its own.
//
// Pure over what the caller has already read, so scripts/check-call-transfer.mjs
// drives every round, an empty floor, a floor that fills up mid-wait and a
// caller who abandons, with no phone and no database.

/**
 * How many times we look before taking a message.
 *
 * Four, because the arithmetic below puts the worst case at a little over two
 * minutes and a contractor who rang a salesperson back will wait two minutes.
 * It is the hard bound on the whole feature: raising it is the one edit in
 * this file that can hurt somebody, which is why the number is here with the
 * sum beside it rather than inline in a route.
 */
export const MAX_QUEUE_ROUNDS = 4;

/**
 * How long a round of hold lasts when there is no music to play.
 *
 * Ten seconds of quiet between two spoken lines is a pause; thirty is a dead
 * line, and the caller hangs up. When FIELDQUO_SALES_HOLD_MUSIC_URL is set the
 * pause is replaced by the clip and this is not used.
 */
export const QUIET_PAUSE_SECONDS = 10;

/** Roughly how long each spoken line costs, for the bound below. */
const SPOKEN_SECONDS = 5;

/**
 * The worst case, in seconds, computed rather than asserted.
 *
 * Every round is: a line, then either music or a pause, and — when somebody
 * looks free — a ring that may go unanswered. Exposed as a function so the
 * check script can hold the promise "never forever" to an actual number
 * instead of to a comment.
 */
export function maxHoldSeconds({
  maxRounds = MAX_QUEUE_ROUNDS,
  pauseSeconds = QUIET_PAUSE_SECONDS,
  ringSeconds = 20,
} = {}) {
  const rounds = Number.isFinite(maxRounds) && maxRounds > 0 ? Math.floor(maxRounds) : 0;
  return rounds * (SPOKEN_SECONDS + pauseSeconds + ringSeconds);
}

/**
 * What the caller is told on this round.
 *
 * Each line says the same three things in fewer words as the wait goes on:
 * what is happening, that we are still trying, and what will happen if we
 * stop. The last round says the next stop is a message, so the beep is never
 * a surprise.
 */
function holdSay(round, maxRounds, repName) {
  const who = typeof repName === "string" && repName.trim() ? repName.trim() : null;
  const last = round >= maxRounds - 1;

  if (round === 0) {
    return [
      who
        ? `${who} is on another call right now.`
        : "Everyone here is on another call right now.",
      "Stay on the line and I will keep trying.",
    ];
  }
  if (last) {
    return [
      "Still nobody free.",
      "One more try, and then I will take a message.",
    ];
  }
  return ["Still trying. Thanks for holding."];
}

/**
 * One step of the wait.
 *
 * @param round        which look this is. 0 is the first, the one taken the
 *                     moment the floor turns out to be busy.
 * @param reachableNow how many targets ringPlan produced on THIS look. The
 *                     caller re-reads presence each round; this module never
 *                     caches a decision from the previous one, because the
 *                     whole point of holding is that the answer changes.
 * @param justRang     did we arrive here from a ring nobody took?
 *
 *                     If so this round HOLDS, whatever presence says. The
 *                     obvious alternative — ring again straight away, because
 *                     the table still says somebody is available — is the bug
 *                     that turns a queue into a machine that rings the same
 *                     unanswered desk five times in ninety seconds. Presence
 *                     is a claim a rep made, and it has learned nothing in the
 *                     second since it was wrong; a hold is what gives them
 *                     time to actually become free.
 * @param holdMusicUrl FIELDQUO_SALES_HOLD_MUSIC_URL, or null. Null is not a
 *                     failure — it produces a bounded pause between spoken
 *                     lines, which is quieter than music and never silence.
 * @param repName      the rep this caller was trying to reach, when we know.
 * @param maxRounds    injectable so the bound is executable.
 *
 * @returns {{action:"ring"|"hold"|"voicemail", round:number, nextRound:number,
 *            say:string[], playUrl:string|null, pauseSeconds:number,
 *            silentHold:boolean, reason:string}}
 */
export function queueStep({
  round = 0,
  reachableNow = 0,
  justRang = false,
  holdMusicUrl = null,
  repName = null,
  maxRounds = MAX_QUEUE_ROUNDS,
} = {}) {
  const cap = Number.isFinite(maxRounds) && maxRounds > 0 ? Math.floor(maxRounds) : 0;

  // ── An unreadable round ENDS the wait; a missing one starts it ─────────
  //
  // Two different things, and the difference is the whole safety argument.
  // Nothing at all — the parameter absent — is the ordinary first entry, and
  // starting the wait is right. A value that is present and cannot be read
  // (`Infinity`, `NaN`, `banana`) is a round counter that has stopped
  // counting, and treating THAT as zero is a loop that never ends: every pass
  // restarts the wait at the beginning.
  //
  // So it is treated as exhausted instead. The cost of being wrong is a caller
  // offered a voicemail sooner than they needed to be; the cost of the other
  // way round is a caller who is never offered one at all.
  const n = round === null || round === undefined ? 0 : Number(round);
  const at = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : cap;

  // ── The bound, checked before anything else ───────────────────────────
  //
  // Deliberately ahead of the "is anybody free" branch. The other order reads
  // more naturally and is the bug: a presence table that keeps reporting an
  // available rep whose browser is not actually answering would hold a caller
  // through an unlimited number of rounds, each of which looks reasonable on
  // its own. Nothing below this line can extend the wait.
  if (at >= cap) {
    return {
      action: "voicemail",
      round: at,
      nextRound: at,
      say: [
        "I am sorry — nobody has come free.",
        "Leave your name and number after the tone and somebody will ring you back.",
      ],
      playUrl: null,
      pauseSeconds: 0,
      silentHold: false,
      reason: "wait_exhausted",
    };
  }

  const free = Number(reachableNow);
  if (!justRang && Number.isFinite(free) && free > 0) {
    return {
      action: "ring",
      round: at,
      // A ring that goes unanswered comes back one round further on, so an
      // unanswered ring costs a look. Reusing the same round would let a
      // permanently-ringing client hold the caller for ever.
      nextRound: at + 1,
      say: at === 0 ? ["Putting you through now."] : ["Someone is free — putting you through."],
      playUrl: null,
      pauseSeconds: 0,
      silentHold: false,
      reason: "target_available",
    };
  }

  const music = typeof holdMusicUrl === "string" && /^https?:\/\//i.test(holdMusicUrl)
    ? holdMusicUrl
    : null;

  return {
    action: "hold",
    round: at,
    nextRound: at + 1,
    // A caller who has just heard a phone ring out knows something a caller
    // who found the floor busy does not, and pretending otherwise is the sort
    // of small lie that makes the rest of the message sound automated.
    say: justRang && at === 0 ? requeueSay({ repName }) : holdSay(at, cap, repName),
    playUrl: music,
    // Zero when there is music: the clip IS the wait, and adding a pause on
    // top would double a round nobody measured.
    pauseSeconds: music ? 0 : QUIET_PAUSE_SECONDS,
    // Never true. Kept as a field rather than an assumption so the check can
    // assert it across every round instead of trusting this sentence.
    silentHold: false,
    reason: "nobody_free",
  };
}

/**
 * The line spoken once, on the way into the queue from a ring that nobody
 * took — as opposed to a call that found the floor busy from the start.
 *
 * Separate because the two are different facts and the caller can tell: one of
 * them heard a phone ring out.
 */
export function requeueSay({ repName = null } = {}) {
  const who = typeof repName === "string" && repName.trim() ? repName.trim() : null;
  return [
    who ? `${who} did not pick up.` : "Nobody picked up.",
    "Hold on and I will try the rest of the team.",
  ];
}
