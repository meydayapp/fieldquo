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
// ══ Where the shape came from ══════════════════════════════════════════════
//
// The state set (available / on call / after-call work / paused with a named
// reason) and the idea of a supervisor board over it are how contact centres
// have worked for decades; OMniLeads is one implementation of it and reading it
// is what prompted the pause-reason vocabulary being a closed list rather than
// free text. What is deliberately NOT taken from it is everything that only
// exists because a dialler is placing the calls: ring state, abandon state,
// queue wait, agent-selected-by-the-system. FieldQuo has no dialler and copying
// those would produce columns nothing can ever write.

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
    note: "Not working. Nothing counts against them.",
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
export const PAUSE_REASONS = Object.freeze({
  break: { code: "break", label: "Break", paid: true },
  lunch: { code: "lunch", label: "Lunch", paid: false },
  // "Dinner" is the owner's word (2026-09-11: "Online, Break, Dinner, Off,
  // Meeting — anything that is normal from the call center"). Added BESIDE
  // lunch rather than renaming it: rows already say "lunch", and a report that
  // silently folded a stored reason into a new one would move history. Same
  // unpaid treatment as lunch, for the same reason — it is the meal break.
  dinner: { code: "dinner", label: "Dinner", paid: false },
  meeting: { code: "meeting", label: "Meeting", paid: true },
  training: { code: "training", label: "Training", paid: true },
  admin: { code: "admin", label: "Admin / research", paid: true },
  technical: { code: "technical", label: "Technical problem", paid: true },
  other: { code: "other", label: "Something else", paid: true },
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
]);

/**
 * What the rep's own status picker offers — the portal header from lg up, the
 * drawer below it.
 *
 * Six choices, and deliberately not every state crossed with every reason.
 * `on_call` and `after_call` are set by the call lifecycle and are not things
 * a rep declares by hand; admin, technical and other stay in the vocabulary
 * (stored rows use them, the floor board and the report print them) but are
 * not on the picker, because the owner's list was the call-centre one —
 * Available · Break · Dinner · Meeting · Training · Off — and six one-tap
 * targets is what fits in a header. `lunch` is not offered because Dinner
 * replaced it on the picker; it is still a reason a row may carry.
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
    code: "off",
    state: STATE_OFFLINE,
    pauseReason: null,
    label: "Off",
    labelKey: "app.salesStatus.off",
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
export const TRANSITIONS = Object.freeze({
  [STATE_OFFLINE]: Object.freeze([STATE_AVAILABLE]),
  [STATE_AVAILABLE]: Object.freeze([STATE_ON_CALL, STATE_PAUSED, STATE_OFFLINE]),
  [STATE_ON_CALL]: Object.freeze([STATE_AFTER_CALL, STATE_AVAILABLE, STATE_OFFLINE]),
  [STATE_AFTER_CALL]: Object.freeze([STATE_AVAILABLE, STATE_PAUSED, STATE_OFFLINE]),
  [STATE_PAUSED]: Object.freeze([STATE_AVAILABLE, STATE_ON_CALL, STATE_OFFLINE]),
});

/**
 * How long a presence row may go unrefreshed before the board stops believing
 * it.
 *
 * Fifteen minutes because the portal beats every sixty seconds: a rep whose
 * browser is alive misses fourteen beats before they are called stale, which
 * survives a tunnel, a lift and a laptop lid closed for a coffee. Longer and
 * the board shows a rep as available half an hour after they left; shorter and
 * it flickers.
 */
export const PRESENCE_STALE_MINUTES = 15;

/** The interval the portal shell beats on. Exported so the two cannot drift. */
export const HEARTBEAT_SECONDS = 60;

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

/**
 * What the board says about one rep, from their most recent activity row.
 *
 * ── Three answers, not two ───────────────────────────────────────────────
 *
 * `state` is what the row says. `stale` is whether anybody has heard from them
 * since. The screen must render those separately, in the three-tone discipline
 * app/sales/queue/page.js already uses: a rep who is available is not the same
 * as a rep whose browser last spoke fourteen minutes ago and says they are
 * available, and painting both green is how a supervisor rings somebody who
 * went home an hour ago.
 *
 * A rep with NO row has never DECLARED anything on this build. That is
 * `offline` with `everSeen: false`, which the board prints differently from a
 * rep who signed out — "never" and "at 17:02" are different facts.
 *
 * ── Three facts, because "no activity row" was being printed as a fourth ──
 *
 * `everSeen` is about the activity row and nothing else, and it stays that
 * way: lib/sales/calls/inboundRouting.js routes an inbound call on it, and a
 * rep who has merely opened the portal has not said they are ready for one.
 *
 * What it is NOT is "has this person ever signed in". Nothing writes an
 * activity row when a rep opens the portal — only pressing dial, pausing or
 * going available does — so the board was reading `everSeen: false` and
 * printing "has never signed in", which is a different and untrue claim about
 * somebody who had been working all morning. `portalSeenAt` is that missing
 * fact, observed by lib/sales/gate.js, and `everSignedIn` is the question the
 * screen was actually asking. The three answers a board needs:
 *
 *   everSignedIn false                    never seen — no record at all
 *   everSignedIn true,  everSeen false    signed in, has declared nothing
 *   everSeen true                         a declared state, exactly as before
 *
 * @param row  the newest SalesRepActivity row, or null.
 * @param now  the clock.
 * @param portalSeenAt  SalesRep.lastSeenAt — when this rep last loaded the
 *        portal, or null when we have never seen them. Passed in rather than
 *        read here: this module has no database, and inventing a default would
 *        be exactly the "absence is not a statement" failure it is fixing.
 */
export function livePresence(row, now = new Date(), { portalSeenAt = null } = {}) {
  const at = when(now) || new Date();
  const seenInPortal = when(portalSeenAt);

  if (!row || typeof row !== "object") {
    return {
      state: STATE_OFFLINE,
      pauseReason: null,
      since: null,
      forMs: null,
      lastSeenAt: null,
      stale: false,
      everSeen: false,
      portalSeenAt: seenInPortal,
      everSignedIn: Boolean(seenInPortal),
    };
  }

  const state = isRepState(row.state) ? row.state : STATE_OFFLINE;
  const since = when(row.startedAt);
  const ended = when(row.endedAt);
  const beat = when(row.heartbeatAt);

  // A row that has been closed is not what anybody is doing now. Reporting its
  // state as live is the single most misleading thing this function could do.
  if (ended) {
    return {
      state: STATE_OFFLINE,
      pauseReason: null,
      since: ended,
      forMs: Math.max(0, at.getTime() - ended.getTime()),
      lastSeenAt: beat && beat > ended ? beat : ended,
      stale: false,
      everSeen: true,
      portalSeenAt: seenInPortal,
      everSignedIn: true,
    };
  }

  const lastSeenAt = beat && since && beat > since ? beat : since;
  const forMs = since ? Math.max(0, at.getTime() - since.getTime()) : null;
  const stale =
    state !== STATE_OFFLINE &&
    Boolean(lastSeenAt) &&
    at.getTime() - lastSeenAt.getTime() > PRESENCE_STALE_MINUTES * 60 * 1000;

  return {
    state,
    pauseReason: state === STATE_PAUSED && isPauseReason(row.pauseReason) ? row.pauseReason : null,
    since,
    forMs,
    lastSeenAt,
    stale,
    everSeen: true,
    portalSeenAt: seenInPortal,
    everSignedIn: true,
  };
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
    const finished = when(row?.endedAt) || end;
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
    const finished = when(row?.endedAt) || end;
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

  return { byReason, unattributedMs, unattributedCount, totalMs };
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
