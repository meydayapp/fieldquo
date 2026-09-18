// lib/sales/availableReminder.js
//
// "You're shown as Off" — when the portal says it, and when it must not.
//
// ══ Why a rep is reminded at all ══════════════════════════════════════════
//
// On 2026-09-17 a live rep signed in and started dialling without ever
// pressing Available. Every dial moved her to on_call and every outcome
// moved her back to available — but between the sign-in and the first dial
// she had no presence row at all, and lib/sales/calls/inboundRouting.js
// routes a ring-back on that row. A contractor who rang back reached nobody.
// The owner's ask: "when a sales rep logs in they should be reminded to
// change their status to online, with an OK button to dismiss the pop-up."
//
// ══ Why the decision is a pure function ═══════════════════════════════════
//
// The modal has five reasons NOT to appear and one reason to, and a component
// that worked them out inline in a render would be a component nothing can
// execute against a hostile input. shouldRemind() is total: an unreadable
// state, a store that has not answered, a call in progress — each is a "no",
// and only the whole set of facts lining up is a "yes". The check script
// runs every combination.
//
// ══ Dismissal is per browser session, and cleared by a sign-in ════════════
//
// OK writes a flag to sessionStorage, so the reminder does not reopen on
// every navigation for a rep who chose to stay Off. sessionStorage outlives
// a sign-out → sign-in in the same tab, which would silence the reminder on
// exactly the next morning it is for — so the login page clears the flag
// before it navigates into the portal, and sign-out clears it on the way
// out. The owner's words were "shown again next sign-in", and that is the
// mechanism that makes them true.

import { STATE_OFFLINE, isRepState } from "./calls/agentState";

/** The sessionStorage key. One per browser tab, as the tour's first-run flag is. */
export const AVAILABLE_REMINDER_KEY = "fieldquo.sales.availableReminder.dismissed";

/**
 * Should the reminder be on screen?
 *
 * @param mounted        the presence provider is above this component.
 * @param loading        the first presence read has not answered yet.
 * @param storeReady     the activity tables exist (`store.ready`); without
 *                       them "Go available" would post into a 503.
 * @param state          the rep's presence state, or null for no row.
 * @param callUp         a browser call is up (CallPanel reported it).
 * @param inboundRinging a contractor is ringing back (the dock reported it).
 * @param dismissed      the rep pressed OK this session.
 */
export function shouldRemind(facts = {}) {
  // Null is not "no facts", it is a caller that could not say — and the
  // answer to that is no, not a TypeError in a render.
  const {
    mounted = false,
    loading = true,
    storeReady = false,
    state = null,
    callUp = false,
    inboundRinging = false,
    dismissed = true,
  } = facts && typeof facts === "object" ? facts : {};
  if (mounted !== true) return false;
  if (loading === true) return false;
  if (storeReady !== true) return false;
  if (callUp === true || inboundRinging === true) return false;
  if (dismissed === true) return false;
  // No row is offline (livePresence says so); a state the vocabulary does not
  // know is a caller that could not tell us what is happening, and the
  // answer to that is not a modal.
  const current = state == null ? STATE_OFFLINE : isRepState(state) ? state : null;
  return current === STATE_OFFLINE;
}

/** Has the rep dismissed it this session? Unreadable storage reads as "yes" — no modal in private mode on every route change. */
export function readReminderDismissed(storage = typeof sessionStorage === "undefined" ? null : sessionStorage) {
  // No storage at all (the server, a stubbed window) is the same case as a
  // storage that throws: nothing can remember an OK, so nothing is asked.
  if (!storage) return true;
  try {
    return storage.getItem(AVAILABLE_REMINDER_KEY) === "1";
  } catch {
    return true;
  }
}

export function writeReminderDismissed(storage = typeof sessionStorage === "undefined" ? null : sessionStorage) {
  try {
    storage?.setItem(AVAILABLE_REMINDER_KEY, "1");
  } catch {
    /* nothing to remember it in; the modal closes for this render anyway */
  }
}

/** A sign-in or a sign-out: the next portal load asks again. */
export function clearReminderDismissed(storage = typeof sessionStorage === "undefined" ? null : sessionStorage) {
  try {
    storage?.removeItem(AVAILABLE_REMINDER_KEY);
  } catch {
    /* see above */
  }
}
