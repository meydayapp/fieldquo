// lib/sales/calls/agentState.js
//
// What a sales rep is doing right now, what they were doing, and the one thing
// this screen must never do — claim to know.
//
// ══ Every state here is DECLARED, not measured ═════════════════════════════
//
// This is the whole design and it is the difference between a supervisor board
// that is useful and one that is a lie. FieldQuo's reps dial a `tel:` link on
// their own handset. The operating system takes the call. Nothing reports back
// — not a ring, not an answer, not a hangup, not a second of talk time. So:
//
//   - "on a call" begins when a rep PRESSES DIAL and ends when they say it
//     ended. It is time spent on the prospect, which is a real and useful
//     number, and it is NOT talk time. Nothing in this module is allowed to
//     call it talk time, and nothing downstream may print it as one.
//   - "paused" begins when a rep presses pause and names a reason.
//   - "available" is a rep saying they are ready, not a system observing it.
//
// A rep who closes the laptop mid-call leaves an open `on_call` row. That is
// why presence has an age on it and goes STALE rather than staying true — see
// livePresence(). A board that says "Daniel: on a call, 6h 12m" is not
// reporting a marathon, it is reporting a laptop that went to sleep, and the
// board has to say which.
//
// ── What changed when the browser started placing calls (2026-09-11) ──────
//
// The paragraph above was written when every call left through a `tel:` link.
// The browser path (app/components/sales/CallPanel.js, Twilio's Voice SDK)
// DOES report a hangup — the SDK's `disconnect` event — and CallPanel now
// posts `after_call` from it, so on that path "on a call" ends when the call
// ends rather than when the outcome is logged, and "writing it up" is a real,
// measured period. The handset path still reports nothing, and a row it
// leaves open is still closed by the disposition. Nothing here is allowed to
// call the on_call period talk time even now: it starts at the press, before
// the ring, and the carrier's own talk seconds live on SalesCallAttempt.
//
// "FieldQuo has no dialler" below is also no longer quite true: lib/sales/
// autodial.js is a PROGRESSIVE dialler — one prospect at a time, after the
// rep's own write-up, with a visible countdown — and it deliberately adds no
// state here. Ring, abandon and queue-wait are predictive-dialler states, and
// the module's header says why FieldQuo is not building one.
//
// ══ 2026-09-21: presence is DERIVED from the keepalive, not read off a row ══
//
// The owner's floor showed every rep "Off" while they dialled, one rep
// "Writing it up · 76h 26m", and one "Paused" since Saturday — because the
// board printed the last button pressed, and nothing said the browser had
// gone. The model is now OMniLeads's, read in place under
// /Volumes/1TB emilio ssd/Downloads Archive/ominicontacto-master (LGPL —
// the design, never the code):
//
//   ominicontacto_app/services/asterisk/agent_activity.py
//     AgentActivityAmiManager: one Redis hash per agent (redis_database.py
//     KEY_PREFIX "OML:AGENT:{0}") with STATUS, TIMESTAMP, PAUSE_ID,
//     CAMPAIGN, CONTACT_NUMBER. _get_redis_status_data (130–145): login /
//     unpause → READY, logout → OFFLINE, pause → PAUSE-<name>; every write
//     stamps TIMESTAMP, and the AGE of that stamp is what a supervisor view
//     reads. pause_agent (74–96): pause id '0' is ACW — the after-call
//     write-up is a pause with a reserved id, not a state machine of its
//     own. _set_agent_redis_status (202–208): READY and a named pause clear
//     CAMPAIGN / CONTACT_NUMBER; ACW keeps them — the agent is still on that
//     contact while writing up. login_agent (43–54) calls
//     _close_open_session (174–182) first: a fresh login resets a dangling
//     session. logout_agent (56–63): OFFLINE, immediately.
//   ominicontacto_app/services/agent/presence.py
//     AgentPresenceManager: an append-only ActividadAgenteLog (LOGIN /
//     LOGOUT / PAUSE / UNPAUSE) behind the reports, separate from the live
//     status. fix_previous_open_session_logs (74–95): on login, an older
//     open session is closed in the log at min(session expiry, now) — the
//     SESSION EXPIRY is the offline moment, and a dangling PAUSE gets its
//     UNPAUSE + LOGOUT written there. enforce_login (57–72): a page refresh
//     re-normalises the log.
//   ominicontacto_app/views/base.py:294 SESSION_COOKIE_AGE = 600 and
//   static/ominicontacto/JS/agente/phoneJsController.js ~1491
//     KeepAliveSender pings every max_session_age/2; when the pings stop the
//     session expires and that is Off. ~893–946 callEndTransition: every
//     hangup goes to the ACW pause, auto-unpaused after `auto_unpause`
//     seconds; with a forced disposition not yet filed the agent STAYS in
//     ACW (leavePause checks llamada_calificada, ~1002). models.py
//     AgenteProfile (400–430): three states, OFFLINE / ONLINE / PAUSA.
//
// Applied here — SalesRepActivity rows plus SalesRep.lastSeenAt are the
// Redis hash's STATUS + TIMESTAMP, and the rows are also the append-only
// log:
//
//   OFF        no portal keepalive for PRESENCE_OFF_MINUTES (the owner's two
//              minutes; OMniLeads's ten-minute session age) and no dial, no
//              live leg — logged out, tab closed, laptop shut, whatever the
//              last button was. "Off since <last beat or last dial>". Beats
//              everything. Sign-out writes it at once (logout_agent).
//   BUSY       a live browser leg or a dial inside the window: "Busy · on a
//              call" — derived from the attempt, never from a button. Then
//              the write-up window after every call ends — "Busy · writing
//              it up", OMniLeads's ACW pause with the contact still attached
//              — `afterCallSeconds` long (a platform setting,
//              lib/sales/calls/floorSettings.js), during which the dialler
//              places nothing and inbound does not ring them; at zero they
//              are Available on their own (auto_unpause), sooner if they
//              press Next, and NOT at all while `requireWriteUp` is on and
//              the call has no outcome yet (the forced disposition).
//   PAUSED     set by hand, with a reason — the named pause. Paperwork is
//              the "admin" reason, on the picker, not a Busy button.
//   AVAILABLE  the default of a present rep (READY). The moment a tab is
//              present — login, tab open — with no button needed; a fresh
//              login resets a dangling pause (_close_open_session, done by
//              store.js heartbeat() closing an expired row). The picker's
//              "Available" is the unpause.
//
// Precedence: Off beats everything; a live call forces Busy · on a call; the
// write-up window next; otherwise the rep's own pause; otherwise Available.
// The activity ledger keeps every row for time accounting, and an open row
// is measured to its last beat plus the window (rowPeriodEnd — session
// expiry as the offline moment), never to the next button press days later.
//
// The state VOCABULARY below is kept — offline / available / on_call /
// after_call / paused — because the ledger rows carry it and the ring plan,
// the autodialler and the reports key on it. What changed is who decides:
// livePresence() derives the state from the keepalive and the calls, and a
// row is one input, never the answer. presenceWord() turns a state into
// the one of four words a screen prints.
//
// ══ Where the shape came from ══════════════════════════════════════════════
//
// The state set (available / on call / after-call work / paused with a named
// reason) and the idea of a supervisor board over it are how contact centres
// have worked for decades; OMniLeads is one implementation of it and reading it
// is what prompted the pause-reason vocabulary being a closed list rather than
// free text. What is deliberately NOT taken from it is everything that only
// exists because a dialler is placing the calls: ring state, abandon state,
// queue wait, agent-selected-by-the-system. FieldQuo has no predictive
// dialler and copying those would produce columns nothing can ever write.

/** The states, as stored. */
export const STATE_OFFLINE = "offline";
export const STATE_AVAILABLE = "available";
export const STATE_ON_CALL = "on_call";
export const STATE_AFTER_CALL = "after_call";
export const STATE_PAUSED = "paused";

export const REP_STATES = Object.freeze({
  [STATE_OFFLINE]: {
    code: STATE_OFFLINE,
    label: "Off",
    note: "No portal keepalive for two minutes — logged out, tab closed, laptop shut. Nothing counts against them.",
    /** Does time in this state belong in a working-hours total? */
    working: false,
    /** Is a rep in this state expected to be reachable by a supervisor? */
    live: false,
  },
  [STATE_AVAILABLE]: {
    code: STATE_AVAILABLE,
    label: "Available",
    note: "Ready to take the next prospect.",
    working: true,
    live: true,
  },
  [STATE_ON_CALL]: {
    code: STATE_ON_CALL,
    label: "On a call",
    note: "Dialled, and has not said the call ended.",
    working: true,
    live: true,
  },
  [STATE_AFTER_CALL]: {
    code: STATE_AFTER_CALL,
    label: "Writing it up",
    note: "The call ended and the outcome has not been logged yet.",
    working: true,
    live: true,
  },
  [STATE_PAUSED]: {
    code: STATE_PAUSED,
    label: "Paused",
    note: "Away from the phone, with a reason.",
    working: true,
    live: true,
  },
});

/** Board order — worst-to-know first, so a supervisor reads down. */
export const STATE_ORDER = Object.freeze([
  STATE_ON_CALL,
  STATE_AFTER_CALL,
  STATE_AVAILABLE,
  STATE_PAUSED,
  STATE_OFFLINE,
]);

/**
 * The four words a screen prints — the owner's, 2026-09-21: "the board shows
 * exactly one of: Off since {time} · Available · Busy · Paused ({reason})".
 * `detail` says which Busy: on a call, writing it up, or set by hand.
 */
export const WORD_OFF = "off";
export const WORD_AVAILABLE = "available";
export const WORD_BUSY = "busy";
export const WORD_PAUSED = "paused";
export const PRESENCE_WORDS = Object.freeze([WORD_OFF, WORD_AVAILABLE, WORD_BUSY, WORD_PAUSED]);

/** @returns {{ word: string, detail: "on_call"|"writing_up"|null }} */
export function presenceWord(state) {
  switch (state) {
    case STATE_AVAILABLE:
      return { word: WORD_AVAILABLE, detail: null };
    case STATE_ON_CALL:
      return { word: WORD_BUSY, detail: "on_call" };
    case STATE_AFTER_CALL:
      return { word: WORD_BUSY, detail: "writing_up" };
    case STATE_PAUSED:
      return { word: WORD_PAUSED, detail: null };
    default:
      return { word: WORD_OFF, detail: null };
  }
}

/**
 * Why a rep is away.
 *
 * A closed list rather than free text, and the reason is the report: "how much
 * of the day went on breaks" is only answerable if two reps typing "lunch" and
 * "Lunch " land in one bucket. `paid` is declared here because it is the one
 * distinction a person looking at the number actually needs, and it is a fact
 * about the reason rather than a payroll calculation — nothing in this repo
 * pays a sales rep by the hour, and this must not grow into something that
 * looks like it does.
 */
//
// ── Type and limit (2026-09-21) ───────────────────────────────────────────
//
// OMniLeads's Pausa has a `tipo` — P productive / R recreational — and
// ConfiguracionDePausa a `time_to_end_pause`, a maximum length after which
// the console warns. Here: `type` splits the reports (a three-hour lunch is
// visible as recreational time, a three-hour meeting as productive), and
// `maxMinutes` is the DEFAULT limit — the platform edits the live limits on
// /platform/sales/floor (floorSettings.js `pauseLimits`), and livePresence()
// prints "Over by 4 min" past it on the rep's own header and the board.
export const PAUSE_TYPE_PRODUCTIVE = "productive";
export const PAUSE_TYPE_RECREATIONAL = "recreational";

export const PAUSE_REASONS = Object.freeze({
  break: { code: "break", label: "Break", paid: true, type: PAUSE_TYPE_RECREATIONAL, maxMinutes: 15 },
  lunch: { code: "lunch", label: "Lunch", paid: false, type: PAUSE_TYPE_RECREATIONAL, maxMinutes: 60 },
  // "Dinner" is the owner's word (2026-09-11: "Online, Break, Dinner, Off,
  // Meeting — anything that is normal from the call center"). Added BESIDE
  // lunch rather than renaming it: rows already say "lunch", and a report that
  // silently folded a stored reason into a new one would move history. Same
  // unpaid treatment as lunch, for the same reason — it is the meal break.
  dinner: { code: "dinner", label: "Dinner", paid: false, type: PAUSE_TYPE_RECREATIONAL, maxMinutes: 60 },
  meeting: { code: "meeting", label: "Meeting", paid: true, type: PAUSE_TYPE_PRODUCTIVE, maxMinutes: 60 },
  training: { code: "training", label: "Training", paid: true, type: PAUSE_TYPE_PRODUCTIVE, maxMinutes: 120 },
  admin: { code: "admin", label: "Admin / research", paid: true, type: PAUSE_TYPE_PRODUCTIVE, maxMinutes: 60 },
  technical: { code: "technical", label: "Technical problem", paid: true, type: PAUSE_TYPE_PRODUCTIVE, maxMinutes: 30 },
  other: { code: "other", label: "Something else", paid: true, type: PAUSE_TYPE_PRODUCTIVE, maxMinutes: 30 },
  // A supervisor's pause from the floor board (OMniLeads's pause id '00'
  // "Supervision"): on the closed list so the ledger can carry it and the
  // reports can name it, never on the rep's picker — only a superadmin
  // writes it, through app/api/platform/sales/floor/rep-state. No limit: it
  // ends when the supervisor or the rep says so.
  supervision: { code: "supervision", label: "Supervision", paid: true, type: PAUSE_TYPE_PRODUCTIVE, maxMinutes: null },
});

export const PAUSE_REASON_ORDER = Object.freeze([
  "break",
  "lunch",
  "dinner",
  "meeting",
  "training",
  "admin",
  "technical",
  "other",
  "supervision",
]);

/** The default limits, reason → minutes (null: none). The platform's stored overrides are merged over these. */
export const DEFAULT_PAUSE_LIMITS = Object.freeze(Object.fromEntries(PAUSE_REASON_ORDER.map((code) => [code, PAUSE_REASONS[code].maxMinutes])));

/**
 * How far past its limit a pause is — milliseconds over, or null when it is
 * within the limit or the reason has none.
 *
 * @param pauseReason  the row's reason
 * @param since        when the pause began
 * @param now          the clock
 * @param limits       reason → minutes, the platform's (floorSettings.js);
 *                     the defaults when absent
 */
export function pauseOverBy(pauseReason, since, now = new Date(), limits = DEFAULT_PAUSE_LIMITS) {
  if (!isPauseReason(pauseReason) || !since) return null;
  const table = limits && typeof limits === "object" ? limits : DEFAULT_PAUSE_LIMITS;
  const minutes = Object.hasOwn(table, pauseReason) ? table[pauseReason] : DEFAULT_PAUSE_LIMITS[pauseReason];
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const began = since instanceof Date ? since : new Date(since);
  const at = now instanceof Date ? now : new Date(now);
  const over = at.getTime() - began.getTime() - minutes * 60000;
  return over > 0 ? over : null;
}

/**
 * What the rep's own status picker offers — the portal header from lg up, the
 * drawer below it.
 *
 * Six choices, and deliberately not every state crossed with every reason.
 * `on_call` and `after_call` are set by the call lifecycle and are not things
 * a rep declares by hand; technical and other stay in the vocabulary (stored
 * rows use them, the floor board and the report print them) but are not on
 * the picker, because the owner's list was the call-centre one — Available
 * · Break · Dinner · Meeting · Training — and six one-tap targets is what
 * fits in a header. `lunch` is not offered because Dinner replaced it on the
 * picker; it is still a reason a row may carry. "Admin / research" joined
 * on 2026-09-21 as the sixth: the owner wanted a rep doing paperwork to be
 * left alone by the ring plan, and OMniLeads's answer to that is a named
 * pause, not a Busy button — Busy is what a call makes you.
 *
 * "Off" LEFT the picker on 2026-09-21. Off is derived from the keepalive
 * (the header) and a button that wrote an `offline` row while the rep was
 * still in the portal was the writer of the stray Off the owner saw: one
 * rep pressed it at the end of a call and kept working, and the board said
 * Off for the rest of the afternoon. Leaving is signing out or closing the
 * last tab; both write the row through their own path, and the state
 * action refuses `offline` from a screen.
 *
 * Each entry names the state AND the reason the picker posts, so the screen
 * builds no request body of its own — a picker that assembled
 * `{ state: "paused" }` from a label is one refactor away from posting a pause
 * with no reason, which canTransition refuses.
 *
 * `labelKey` is the catalogue key the screen resolves; `label` is the English
 * fallback the floor board (superadmin-only, English) prints.
 */
export const STATUS_CHOICES = Object.freeze([
  Object.freeze({
    code: "available",
    state: STATE_AVAILABLE,
    pauseReason: null,
    label: "Available",
    labelKey: "app.salesStatus.available",
  }),
  Object.freeze({
    code: "break",
    state: STATE_PAUSED,
    pauseReason: "break",
    label: "Break",
    labelKey: "app.salesStatus.break",
  }),
  Object.freeze({
    code: "dinner",
    state: STATE_PAUSED,
    pauseReason: "dinner",
    label: "Dinner",
    labelKey: "app.salesStatus.dinner",
  }),
  Object.freeze({
    code: "meeting",
    state: STATE_PAUSED,
    pauseReason: "meeting",
    label: "Meeting",
    labelKey: "app.salesStatus.meeting",
  }),
  Object.freeze({
    code: "training",
    state: STATE_PAUSED,
    pauseReason: "training",
    label: "Training",
    labelKey: "app.salesStatus.training",
  }),
  Object.freeze({
    code: "admin",
    state: STATE_PAUSED,
    pauseReason: "admin",
    label: "Admin / research",
    labelKey: "app.salesStatus.admin",
  }),
]);

/**
 * Which picker choice a presence row corresponds to, or null when the rep is
 * in a state the picker does not offer (on a call, writing it up, or paused
 * for a reason that is not on the picker). Null is rendered as the state's
 * own label rather than as a highlighted choice, so the picker never claims a
 * rep chose "Break" when the row says "admin".
 */
export function statusChoiceFor(presence) {
  if (!presence || !isRepState(presence.state)) return null;
  return (
    STATUS_CHOICES.find(
      (c) => c.state === presence.state && (c.pauseReason || null) === (presence.pauseReason || null),
    ) || null
  );
}

/**
 * Which state may follow which.
 *
 * Written as data so the check script asserts the graph rather than the
 * branches that happen to implement it. Three edges are worth their own
 * sentence:
 *
 *   on_call → paused is ABSENT. A rep cannot go on a break from inside a call;
 *   they end the call first. Allowing it would produce overlapping periods and
 *   a "time on calls" total that includes lunch.
 *
 *   paused → on_call is PRESENT. A rep who pauses and then dials has plainly
 *   come back; refusing the dial to make them press a button first would be a
 *   control that exists to protect a chart.
 *
 *   every state → offline is present, including on_call, because a laptop
 *   closing mid-call is a real thing that happens and the log should say so
 *   rather than refuse it.
 */
// A DIAL is work, whatever the row said (owner, 2026-09-16: "how can he be
// off and be able to make calls? if a sales agent starts making calls his
// status should turn back to not off"). So on_call is reachable from
// offline — a rep who never pressed Available, or whose row went offline —
// and from after_call, which is where the progressive dialler places the
// next call from. The board then reads "on a call" the moment the button is
// pressed, and the earlier "Off" is history rather than a lie.
// offline → paused is present since 2026-09-21: a present rep with no row
// (Available by derivation) is `offline` on the ledger, and their first
// press of the day may be Break.
export const TRANSITIONS = Object.freeze({
  [STATE_OFFLINE]: Object.freeze([STATE_AVAILABLE, STATE_ON_CALL, STATE_PAUSED]),
  [STATE_AVAILABLE]: Object.freeze([STATE_ON_CALL, STATE_PAUSED, STATE_OFFLINE]),
  [STATE_ON_CALL]: Object.freeze([STATE_AFTER_CALL, STATE_AVAILABLE, STATE_OFFLINE]),
  [STATE_AFTER_CALL]: Object.freeze([STATE_AVAILABLE, STATE_ON_CALL, STATE_PAUSED, STATE_OFFLINE]),
  [STATE_PAUSED]: Object.freeze([STATE_AVAILABLE, STATE_ON_CALL, STATE_OFFLINE]),
});

/**
 * How long without a keepalive before a rep is Off.
 *
 * Two minutes, the owner's number (2026-09-21): the portal shell beats every
 * HEARTBEAT_SECONDS, so a live browser misses one beat before it is called
 * Off — OMniLeads's max_session_age against its keepalive at half that.
 * Fifteen minutes, the old figure, is how a rep who shut the laptop at 11:54
 * read "writing it up" until 12:09 and how a rep who kept dialling read
 * "stale" from a throttled background tab; the gate's own beat on every
 * request (lib/sales/gate.js) is what makes two minutes safe for the second
 * case. `PRESENCE_STALE_MINUTES` is the same number under its old name, kept
 * for the ring plan and the queue, which compare a beat's age against it.
 */
export const PRESENCE_OFF_MINUTES = 2;
export const PRESENCE_STALE_MINUTES = PRESENCE_OFF_MINUTES;
export const PRESENCE_OFF_MS = PRESENCE_OFF_MINUTES * 60 * 1000;

/** The interval the portal shell beats on. Exported so the two cannot drift. */
export const HEARTBEAT_SECONDS = 60;

/** Default write-up window and whether an outcome is required — the platform setting's defaults live in floorSettings.js; these are the fallbacks livePresence uses when handed nothing. */
export const DEFAULT_AFTER_CALL_SECONDS = 60;

export function isRepState(code) {
  return typeof code === "string" && Object.hasOwn(REP_STATES, code);
}

export function isPauseReason(code) {
  return typeof code === "string" && Object.hasOwn(PAUSE_REASONS, code);
}

function when(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * May this rep move from `from` to `to`, and with what?
 *
 * Total and fails closed. An unknown state on either side is not "probably
 * fine": it is a caller that could not tell us what is happening, and the
 * answer to that is no.
 *
 * @returns {{ok: boolean, reason: string|null, pauseReason: string|null}}
 */
export function canTransition({ from = STATE_OFFLINE, to = null, pauseReason = null } = {}) {
  const no = (reason) => ({ ok: false, reason, pauseReason: null });

  if (!isRepState(to)) return no(`"${String(to)}" is not a state a rep can be in.`);
  // An absent or unknown `from` is treated as offline rather than refused: a
  // rep with no activity rows at all has never been anything else, and that is
  // the ordinary first press of the day, not an error.
  const current = isRepState(from) ? from : STATE_OFFLINE;

  if (current === to) {
    return no(`Already ${REP_STATES[to].label.toLowerCase()}.`);
  }
  if (!TRANSITIONS[current].includes(to)) {
    return no(
      `A rep who is ${REP_STATES[current].label.toLowerCase()} cannot go straight to ${REP_STATES[to].label.toLowerCase()}.`,
    );
  }

  if (to === STATE_PAUSED) {
    if (!isPauseReason(pauseReason)) {
      return no("A pause needs a reason. “Paused, no reason given” is not something a supervisor can act on.");
    }
    return { ok: true, reason: null, pauseReason };
  }

  // A reason on any other state is a caller bug, not something to drop
  // quietly: it would store "available, because lunch", which reads as a fact.
  if (pauseReason) {
    return no(`A reason belongs to a pause. ${REP_STATES[to].label} does not take one.`);
  }

  return { ok: true, reason: null, pauseReason: null };
}

/** The later of two instants, either of which may be missing. */
function later(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * What the board says about one rep — DERIVED, the header says from what.
 *
 * ── The inputs, every one a fact somebody observed ───────────────────────
 *
 * @param row           the newest OPEN SalesRepActivity row, or null. One
 *                      input among several: what the rep last set by hand,
 *                      or what the call lifecycle last wrote. Never the
 *                      answer on its own.
 * @param now           the clock.
 * @param portalSeenAt  SalesRep.lastSeenAt — the keepalive. Stamped by the
 *                      shell's beat (POST /api/sales/presence) and by the
 *                      gate on every authenticated request. Null: never
 *                      seen.
 * @param lastCall      the rep's most recent call, either direction, as
 *                      `{ dialledAt, answeredAt, endedAt, disposition,
 *                      dialChannel, live }` — `live` is liveCall.js's
 *                      verdict on the row (a browser leg the carrier has
 *                      not ended). Null when they have never called.
 * @param afterCallSeconds  the write-up window (floorSettings.js).
 * @param requireWriteUp    whether a call with no outcome holds the rep in
 *                          the window past its end (floorSettings.js).
 *
 * ── Three facts the old model kept, kept ─────────────────────────────────
 *
 * `everSignedIn` (a keepalive was ever seen) and `everSeen` (a row was ever
 * written) stay, because "never" is a different fact from "Off since
 * Thursday" and the board prints them differently. `stale` is kept as a
 * field for the readers that test it, and is now always false: a rep whose
 * keepalive has stopped is Off, not "available but stale" — the third tone
 * the board used to need is exactly the ambiguity the owner asked to end.
 *
 * ── What comes back ──────────────────────────────────────────────────────
 *
 *   state          offline | available | on_call | after_call | paused
 *   word / detail  presenceWord(state)
 *   since / forMs  when the current state began, and how long ago — null
 *                  for Available when nothing marks its start (the board
 *                  prints the word alone rather than a counter that started
 *                  at page load)
 *   offSince       for Off: the later of the last keepalive and the last
 *                  call — what the board prints after "Off since"
 *   writeUpEndsAt  for after_call: when the window ends, or null while an
 *                  outcome is required and missing
 *   writeUpPending for after_call: the last call has no outcome yet
 *   lastSeenAt     the latest evidence of the browser — beat, dial or row
 */
export function livePresence(
  row,
  now = new Date(),
  { portalSeenAt = null, lastCall = null, afterCallSeconds = DEFAULT_AFTER_CALL_SECONDS, requireWriteUp = true, pauseLimits = DEFAULT_PAUSE_LIMITS } = {},
) {
  const at = when(now) || new Date();
  const t = at.getTime();
  const seenInPortal = when(portalSeenAt);
  const open = row && typeof row === "object" && !when(row.endedAt) ? row : null;
  const rowState = open && isRepState(open.state) ? open.state : null;
  const rowSince = open ? when(open.startedAt) : null;
  const rowBeat = open ? when(open.heartbeatAt) : null;

  const call = lastCall && typeof lastCall === "object" ? lastCall : null;
  const dialledAt = call ? when(call.dialledAt) : null;
  const callEndedAt = call ? when(call.endedAt) : null;
  const callLive = Boolean(call?.live);
  const recentDial = dialledAt ? t - dialledAt.getTime() <= PRESENCE_OFF_MS : false;

  // The latest evidence of a browser, whatever kind. The ledger row's beat
  // counts (the gate beats it on every request) and so does a dial.
  const lastSeenAt = [seenInPortal, dialledAt, callEndedAt, rowBeat, rowSince].reduce(later, null);
  const everSignedIn = Boolean(seenInPortal) || Boolean(dialledAt);
  const everSeen = Boolean(row && typeof row === "object");

  // The keepalive is EITHER stamp: SalesRep.lastSeenAt (the shell's beat,
  // the gate on a GET) or the open row's heartbeatAt (the gate on any
  // request, the older heartbeat action). A rep whose row was beaten ten
  // seconds ago is present whatever lastSeenAt says.
  const keepalive = later(seenInPortal, rowBeat);
  const online = (keepalive && t - keepalive.getTime() <= PRESENCE_OFF_MS) || recentDial || callLive;
  const base = {
    stale: false,
    everSeen,
    everSignedIn,
    portalSeenAt: seenInPortal,
    lastSeenAt,
    /** What the open ledger row says, for a board's "last state: writing it up" under an Off headline. */
    lastState: rowState,
    lastPauseReason: rowState === STATE_PAUSED && isPauseReason(open?.pauseReason) ? open.pauseReason : null,
    /** The open row was written by a platform admin (a supervisor's pause / unpause / sign-out). */
    setByAdmin: Boolean(open?.setByAdminId),
    /** For a pause past its limit: milliseconds over. Null otherwise. */
    pauseOverByMs: null,
    pauseMaxMinutes: null,
  };
  const finish = (state, extra = {}) => {
    const since = extra.since === undefined ? null : extra.since;
    return {
      state,
      ...presenceWord(state),
      pauseReason: null,
      since,
      forMs: since ? Math.max(0, t - since.getTime()) : null,
      offSince: null,
      writeUpEndsAt: null,
      writeUpPending: false,
      ...base,
      ...extra,
    };
  };

  // ── 1. Off beats everything ──────────────────────────────────────────
  //
  // Two ways to be Off: the keepalive stopped (the ordinary way — the
  // laptop shut), or an explicit leave wrote an `offline` row that no
  // later evidence has overtaken (sign-out, the last tab closing). The
  // second is checked first because the keepalive it left behind is still
  // inside the window for two minutes.
  //
  // An explicit leave is in force only while nothing later contradicts it:
  // a dial after it, or a keepalive more than a minute after it (the gate
  // beats the row on the sign-out request itself, so a minute of slack).
  // A row that says offline while the rep demonstrably kept working is the
  // old picker's stray Off, and the age rule decides instead.
  const contradicted = (dialledAt && dialledAt > rowSince) || callLive || (keepalive && keepalive.getTime() > rowSince?.getTime() + 60 * 1000);
  const leftExplicitly = rowState === STATE_OFFLINE && rowSince && !contradicted;
  if (leftExplicitly) {
    return finish(STATE_OFFLINE, { since: rowSince, offSince: rowSince });
  }
  if (!online) {
    // "Off since" is the later of the last beat and the last call — never
    // the button, which may be days older than the last thing they did —
    // and the row's own start only when nothing else was ever recorded.
    const offSince = [seenInPortal, dialledAt, callEndedAt, rowBeat, rowSince].reduce(later, null);
    return finish(STATE_OFFLINE, { since: offSince, offSince });
  }

  // ── 2. A live call forces Busy · on a call ───────────────────────────
  //
  // The carrier's leg, or a dial inside the window with no end yet, or the
  // row the dial wrote (a handset dial has no carrier leg and is on a call
  // until the outcome closes the row).
  if (callLive || (recentDial && !callEndedAt) || rowState === STATE_ON_CALL) {
    const since = rowState === STATE_ON_CALL ? rowSince || dialledAt : dialledAt || rowSince;
    return finish(STATE_ON_CALL, { since });
  }

  // ── 3. The write-up window after a call ──────────────────────────────
  //
  // Starts when the call ended (the after_call row the browser posts at
  // disconnect, else the carrier's endedAt), lasts afterCallSeconds, and
  // is over early when a NEWER hand-set row exists (Next → available, or
  // Paused). Past its end with no outcome and requireWriteUp on, the
  // rep stays in it — OMniLeads's forced-disposition rule — and the
  // countdown prints "outcome needed" instead of seconds.
  const acwStart = rowState === STATE_AFTER_CALL ? later(rowSince, callEndedAt) : callEndedAt;
  const overtaken = rowState && rowState !== STATE_AFTER_CALL && rowSince && acwStart && rowSince >= acwStart;
  if (acwStart && !overtaken) {
    const windowMs = Math.max(0, Number(afterCallSeconds) || 0) * 1000;
    const endsAt = new Date(acwStart.getTime() + windowMs);
    const pending = Boolean(call) && !call.disposition && (!callEndedAt || callEndedAt.getTime() >= acwStart.getTime() - 1000);
    if (t < endsAt.getTime()) {
      return finish(STATE_AFTER_CALL, { since: acwStart, writeUpEndsAt: endsAt, writeUpPending: pending });
    }
    if (requireWriteUp && pending) {
      return finish(STATE_AFTER_CALL, { since: acwStart, writeUpEndsAt: null, writeUpPending: true });
    }
  }

  // ── 4. The rep's own pause (or a supervisor's), while the tab is present ─
  if (rowState === STATE_PAUSED) {
    const reason = isPauseReason(open.pauseReason) ? open.pauseReason : null;
    const table = pauseLimits && typeof pauseLimits === "object" ? pauseLimits : DEFAULT_PAUSE_LIMITS;
    const max = reason && Object.hasOwn(table, reason) ? table[reason] : reason ? DEFAULT_PAUSE_LIMITS[reason] : null;
    return finish(STATE_PAUSED, {
      since: rowSince,
      pauseReason: reason,
      pauseOverByMs: pauseOverBy(reason, rowSince, at, table),
      pauseMaxMinutes: Number.isFinite(max) && max > 0 ? max : null,
    });
  }

  // ── 5. Present, and nothing says otherwise: Available ────────────────
  //
  // `since` only when an available row marks it; a rep who is Available
  // because their tab is open has no start the board should count from.
  return finish(STATE_AVAILABLE, { since: rowState === STATE_AVAILABLE ? rowSince : null });
}

/**
 * When a ledger row's period ends: its endedAt, else its last keepalive plus
 * the Off window (an open row the rep walked away from), else `end`.
 * activityTotals and pauseBreakdown share it so the two totals cannot
 * disagree about a row that was never closed.
 */
export function rowPeriodEnd(row, end) {
  const ended = when(row?.endedAt);
  if (ended) return ended;
  const began = when(row?.startedAt);
  const beat = when(row?.heartbeatAt) || began;
  if (!beat) return end;
  const expiry = beat.getTime() + PRESENCE_OFF_MS;
  return expiry < end.getTime() ? new Date(expiry) : end;
}

/**
 * How long a rep spent in each state over a set of rows.
 *
 * Pure, takes rows already read, and clamps every period into [from, to] so a
 * shift that straddles midnight contributes only its share to each day. The
 * open row is measured up to `to` (usually now), never left out — a rep who
 * has been paused for forty minutes and has not un-paused is exactly the row a
 * supervisor is looking for.
 *
 * ── What the totals are NOT ──────────────────────────────────────────────
 *
 * `on_call` here is time between pressing dial and saying the call ended. It
 * is not talk time and there is no talk time in this build. The key is
 * `onCallMs` rather than `talkMs` so a screen cannot label it by accident, and
 * scripts/check-sales-call-handling.mjs asserts no file prints a talk-time
 * figure from it.
 *
 * @returns totals in ms per state, plus counts, plus `unknownMs` for periods
 *          that could not be measured at all — never folded into a state.
 */
export function activityTotals(rows, { from = null, to = new Date() } = {}) {
  if (!Array.isArray(rows)) return null;

  const end = when(to) || new Date();
  const start = when(from);
  const lower = start ? start.getTime() : -Infinity;
  const upper = end.getTime();

  const totals = {};
  const counts = {};
  for (const code of Object.keys(REP_STATES)) {
    totals[code] = 0;
    counts[code] = 0;
  }
  let unknownMs = 0;
  let unmeasurable = 0;

  for (const row of rows) {
    const code = isRepState(row?.state) ? row.state : null;
    const began = when(row?.startedAt);
    if (!began) {
      // No start is not a zero-length period. It is a row we cannot place.
      unmeasurable += 1;
      continue;
    }
    // An OPEN row is measured to its last keepalive plus the Off window,
    // never to `to`: the rep who shut the laptop on Thursday in "writing it
    // up" was on the ledger for 76 hours of it until 2026-09-21, and the
    // next button press days later would have closed the row at that
    // instant. The gate beats the open row on every request, so a rep who
    // is present is measured to now.
    const finished = rowPeriodEnd(row, end);
    const a = Math.max(began.getTime(), lower);
    const b = Math.min(finished.getTime(), upper);
    const ms = b - a;
    if (ms <= 0) continue;

    if (!code) {
      unknownMs += ms;
      continue;
    }
    totals[code] += ms;
    counts[code] += 1;
  }

  const workingMs = Object.entries(totals).reduce(
    (sum, [code, ms]) => (REP_STATES[code].working ? sum + ms : sum),
    0,
  );

  return {
    from: start,
    to: end,
    totals,
    counts,
    onCallMs: totals[STATE_ON_CALL],
    afterCallMs: totals[STATE_AFTER_CALL],
    availableMs: totals[STATE_AVAILABLE],
    pausedMs: totals[STATE_PAUSED],
    workingMs,
    unknownMs,
    unmeasurable,
  };
}

/**
 * Pause time split by reason, over the same rows.
 *
 * Separate from activityTotals rather than nested inside it, because they
 * answer different questions and one of them is a management question: "where
 * did the day go" is a coaching conversation, and it needs the reasons broken
 * out with their own counts. A reason nobody used is present with a zero,
 * which is a real statement here — the list is closed, so an absent key IS a
 * measured zero rather than a missing measurement.
 */
export function pauseBreakdown(rows, { from = null, to = new Date() } = {}) {
  if (!Array.isArray(rows)) return null;

  const end = when(to) || new Date();
  const start = when(from);
  const lower = start ? start.getTime() : -Infinity;
  const upper = end.getTime();

  const byReason = {};
  for (const code of PAUSE_REASON_ORDER) byReason[code] = { ms: 0, count: 0 };
  // A paused row whose reason is missing or not in the vocabulary. Counted
  // apart rather than dropped into "other": "other" is a choice a rep made and
  // this is a row we cannot read, and merging them makes the first look more
  // popular than it is.
  let unattributedMs = 0;
  let unattributedCount = 0;

  for (const row of rows) {
    if (row?.state !== STATE_PAUSED) continue;
    const began = when(row?.startedAt);
    if (!began) continue;
    const finished = rowPeriodEnd(row, end);
    const ms = Math.min(finished.getTime(), upper) - Math.max(began.getTime(), lower);
    if (ms <= 0) continue;

    if (isPauseReason(row.pauseReason)) {
      byReason[row.pauseReason].ms += ms;
      byReason[row.pauseReason].count += 1;
    } else {
      unattributedMs += ms;
      unattributedCount += 1;
    }
  }

  const totalMs =
    Object.values(byReason).reduce((sum, r) => sum + r.ms, 0) + unattributedMs;
  // Productive against recreational — the split that makes a three-hour
  // lunch visible. Unattributed time is in neither and is said apart.
  const byType = { [PAUSE_TYPE_PRODUCTIVE]: 0, [PAUSE_TYPE_RECREATIONAL]: 0 };
  for (const code of PAUSE_REASON_ORDER) byType[PAUSE_REASONS[code].type] += byReason[code].ms;

  return { byReason, byType, unattributedMs, unattributedCount, totalMs };
}

/** "1h 04m", "12m", "48s". Short enough for a board cell, exact enough to act on. */
export function describeDuration(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return null;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/**
 * The board's window, in the viewer's own clock: when "today" began.
 *
 * floorBoard.js's dayBounds cuts the day at UTC midnight. A screen in
 * Montreal reading "today" at 09:00 is reading a window that opened at
 * 20:00 the evening before, and a board that says "Today, since 20:00"
 * without saying "yesterday" invites the reader to assume a typo. So this
 * returns whether the window opened on the viewer's calendar day, and the
 * page picks the sentence: "Today, since 08:00" when it did, "Since
 * yesterday, 20:00" when it did not.
 *
 * @param from   the window's start (Date or ISO string)
 * @param now    the viewer's clock — a Date; the browser's, on a screen
 * @returns {{ sameDay: boolean, time: string, date: string }|null}
 */
export function dayWindowParts(from, now = new Date()) {
  const f = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(f.getTime())) return null;
  const n = now instanceof Date ? now : new Date(now);
  const sameDay = f.getFullYear() === n.getFullYear() && f.getMonth() === n.getMonth() && f.getDate() === n.getDate();
  return {
    sameDay,
    time: f.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    date: f.toLocaleDateString(),
  };
}

/**
 * The headline a screen prints for one rep — the owner's four words, with
 * the one thing each carries — as a catalogue key and its parameters, plus
 * the English the platform console prints. The rep's own header, the agency
 * floor and the platform floor all call this, so "Off since Thu 11:54" is
 * spelt the same way on all three.
 *
 * @param presence  livePresence()'s answer
 * @param now       the clock, for the countdown and for "today" in a time
 * @returns {{ word, key, params, english, sub: {key, params, english}|null, countdownSeconds: number|null }}
 */
export function presenceHeadline(presence, { now = new Date(), labels = {} } = {}) {
  const at = now instanceof Date ? now : new Date(now);
  const p = presence && typeof presence === "object" ? presence : null;
  const clock = (d) => {
    const x = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(x.getTime())) return "";
    const time = x.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const sameDay = x.getFullYear() === at.getFullYear() && x.getMonth() === at.getMonth() && x.getDate() === at.getDate();
    return sameDay ? time : `${x.toLocaleDateString([], { weekday: "short" })} ${time}`;
  };
  const reasonLabel = (code) => labels.pauseReasons?.[code] || PAUSE_REASONS[code]?.label || code || "";

  if (!p || p.state === STATE_OFFLINE) {
    if (!p || (!p.everSignedIn && !p.everSeen)) {
      return { word: WORD_OFF, key: "app.salesPresence.never", params: {}, english: "Never signed in", sub: null, countdownSeconds: null };
    }
    const since = p.offSince || p.since || p.lastSeenAt;
    return {
      word: WORD_OFF,
      key: since ? "app.salesPresence.offSince" : "app.salesPresence.off",
      params: since ? { time: clock(since) } : {},
      english: since ? `Off since ${clock(since)}` : "Off",
      sub: null,
      countdownSeconds: null,
    };
  }
  if (p.state === STATE_ON_CALL) {
    return { word: WORD_BUSY, key: "app.salesPresence.busyOnCall", params: {}, english: "Busy · on a call", sub: null, countdownSeconds: null };
  }
  if (p.state === STATE_AFTER_CALL) {
    const ends = p.writeUpEndsAt ? new Date(p.writeUpEndsAt).getTime() : null;
    const seconds = ends ? Math.max(0, Math.ceil((ends - at.getTime()) / 1000)) : null;
    return {
      word: WORD_BUSY,
      key: "app.salesPresence.busyWritingUp",
      params: {},
      english: "Busy · writing it up",
      sub: seconds === null ? { key: "app.salesPresence.outcomeNeeded", params: {}, english: "outcome needed" } : null,
      countdownSeconds: seconds,
    };
  }
  if (p.state === STATE_PAUSED) {
    const reason = reasonLabel(p.pauseReason);
    const overMin = p.pauseOverByMs ? Math.max(1, Math.ceil(p.pauseOverByMs / 60000)) : null;
    // Red on the screen: a pause past the limit the platform set for its
    // reason. A supervisor's pause has no limit and says who set it.
    const sub = overMin
      ? { key: "app.salesPresence.overBy", params: { minutes: overMin }, english: `Over by ${overMin} min`, alert: true }
      : p.setByAdmin
        ? { key: "app.salesPresence.bySupervisor", params: {}, english: "a supervisor paused you", alert: false }
        : null;
    return {
      word: WORD_PAUSED,
      key: "app.salesPresence.paused",
      params: { reason },
      english: `Paused · ${reason}`,
      sub,
      countdownSeconds: null,
    };
  }
  return { word: WORD_AVAILABLE, key: "app.salesPresence.available", params: {}, english: "Available", sub: null, countdownSeconds: null };
}

/** "0:41" for a countdown; never negative. */
export function countdownText(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
