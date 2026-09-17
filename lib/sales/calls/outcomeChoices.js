// lib/sales/calls/outcomeChoices.js
//
// The six things a rep can press after a call, and the real disposition each
// press becomes.
//
// ══ Presentation over the vocabulary, never a second vocabulary ═══════════
//
// lib/sales/calls/dispositions.js is the closed set of outcomes and what each
// one DOES — a claim transition, a suppression write, a retry rule. That file
// does not change here. What the owner locked on 2026-09-14 is what the rep
// SEES: four big buttons, two more under "More", and nothing the line can
// already answer. Nine options in a dropdown after every call was the wrong
// price for the one control a rep touches forty times a day.
//
//   1  Sent the link            → agreed_link_sent
//   2  Call back                → callback (with a time), or — no time given —
//                                 gatekeeper ("not the owner") or
//                                 reached_interested ("interested, follow up")
//   3  Not now                  → reached_not_interested (relabelled; a later
//                                 pass in thirty days, see retryRules.js)
//   4  Left a voicemail         → voicemail
//   More:
//   5  Requested no call-backs  → do_not_call (needs their words)
//   6  Wrong number / not a business → bad_number | not_a_fit (a two-way
//                                 sub-choice; not_a_fit needs a sentence)
//
// no_answer, busy and hung_up are NEVER offered: the line writes them
// (dispositions.js AUTO_LOGGED_CODES, autoLogOutcome) and a rep choosing
// "no answer" for a call the carrier says was answered is a disagreement the
// reports want to see, not one the picker should make possible.
//
// ══ The fold is pure and total ════════════════════════════════════════════
//
// foldChoice() takes what the form holds and returns either a disposition
// call — `{ code, note, callbackAt }` for planDisposition — or a refusal with
// a catalogue key the form prints. It never guesses: "Call back" with no time
// and no tick is refused, not defaulted to a callback at some invented hour.
// scripts/check-sales-call-panel.mjs drives every branch.

import { AUTO_LOGGED_CODES, DISPOSITIONS, isDisposition } from "./dispositions";

/** The rep's note on an outcome — "what they said". */
export const OUTCOME_NOTE_MAX = 280;

export const CHOICE_SENT_LINK = "sent_link";
export const CHOICE_CALL_BACK = "call_back";
export const CHOICE_NOT_NOW = "not_now";
export const CHOICE_VOICEMAIL = "voicemail";
export const CHOICE_NO_CALLBACKS = "no_callbacks";
export const CHOICE_WRONG_OR_NOT_BUSINESS = "wrong_or_not_business";

/** The "when" a Call back can carry. */
export const WHEN_IN_AN_HOUR = "in_an_hour";
export const WHEN_LATER_TODAY = "later_today";
export const WHEN_TOMORROW = "tomorrow";
export const WHEN_PICK = "pick";
export const WHEN_KINDS = Object.freeze([WHEN_IN_AN_HOUR, WHEN_LATER_TODAY, WHEN_TOMORROW, WHEN_PICK]);

/**
 * The chip the FORM pre-selects when "Call back" is pressed, so a plain
 * press of Save is a callback in an hour rather than a refusal.
 *
 * The fold below still refuses "Call back" with no time and no tick — that
 * is the form's default, not the fold's: foldChoice() never invents an hour,
 * and a caller that hands it `whenKind: null` gets the refusal it always
 * did. What changed on 2026-09-17 is where the default lives. A rep pressed
 * Call back, pressed Save, and saw nothing happen: the refusal printed in
 * small text under a note field she was not looking at, four times. The
 * chip is on by default; the rep who spoke to a receptionist unticks it and
 * the two boxes appear.
 */
export const CALL_BACK_DEFAULT_WHEN = WHEN_IN_AN_HOUR;

/** The two-way sub-choice under "Wrong number / not a business". */
export const WHICH_WRONG_NUMBER = "wrong_number";
export const WHICH_NOT_A_BUSINESS = "not_a_business";

/**
 * In the order the buttons render. `hotkey` is the key that presses it in
 * the pop-up; "M" opens More. `folds` lists every code a choice can become,
 * so a check can hold the set of reachable codes against the table.
 */
export const OUTCOME_CHOICES = Object.freeze([
  Object.freeze({ key: CHOICE_SENT_LINK, primary: true, hotkey: "1", folds: Object.freeze(["agreed_link_sent"]) }),
  Object.freeze({ key: CHOICE_CALL_BACK, primary: true, hotkey: "2", folds: Object.freeze(["callback", "gatekeeper", "reached_interested"]) }),
  Object.freeze({ key: CHOICE_NOT_NOW, primary: true, hotkey: "3", folds: Object.freeze(["reached_not_interested"]) }),
  Object.freeze({ key: CHOICE_VOICEMAIL, primary: true, hotkey: "4", folds: Object.freeze(["voicemail"]) }),
  Object.freeze({ key: CHOICE_NO_CALLBACKS, primary: false, hotkey: null, folds: Object.freeze(["do_not_call"]) }),
  Object.freeze({ key: CHOICE_WRONG_OR_NOT_BUSINESS, primary: false, hotkey: null, folds: Object.freeze(["bad_number", "not_a_fit"]) }),
]);

export const CHOICE_KEYS = Object.freeze(OUTCOME_CHOICES.map((c) => c.key));
export const PRIMARY_CHOICE_KEYS = Object.freeze(OUTCOME_CHOICES.filter((c) => c.primary).map((c) => c.key));
export const MORE_CHOICE_KEYS = Object.freeze(OUTCOME_CHOICES.filter((c) => !c.primary).map((c) => c.key));

/** Every code the buttons can produce. */
export const OFFERED_CODES = Object.freeze([...new Set(OUTCOME_CHOICES.flatMap((c) => c.folds))]);

/** The catalogue keys a choice renders from, derived so a new choice cannot ship English by omission. */
export const choiceLabelKey = (key) => `app.salesCall.choice.${key}.label`;
export const choiceHintKey = (key) => `app.salesCall.choice.${key}.hint`;
export const CHOICE_COPY_KEYS = Object.freeze(CHOICE_KEYS.flatMap((k) => [choiceLabelKey(k), choiceHintKey(k)]));

/** Which choice, if any, a stored code would have come from — for the history row. */
export function choiceForCode(code) {
  return OUTCOME_CHOICES.find((c) => c.folds.includes(code)) || null;
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
 * The instant a "when" chip means. "In an hour" is one hour on; "later today" is three hours on; "tomorrow"
 * is 10:00 the next calendar day IN THE CALLER'S ZONE (the browser's, which
 * is the rep's — the prospect's window is re-checked by the dial gate when
 * the callback comes due, so a rep in Vancouver booking a Halifax callback
 * for "tomorrow 10:00" gets an honest refusal then, not a silent shift now).
 * "Pick" is whatever `at` says. Null for anything else.
 */
export function callbackTimeFor(kind, { now = new Date(), at = null } = {}) {
  const base = when(now) || new Date();
  if (kind === WHEN_IN_AN_HOUR) return new Date(base.getTime() + 60 * 60 * 1000);
  if (kind === WHEN_LATER_TODAY) return new Date(base.getTime() + 3 * 60 * 60 * 1000);
  if (kind === WHEN_TOMORROW) {
    const d = new Date(base.getTime());
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  }
  if (kind === WHEN_PICK) return when(at);
  return null;
}

const refuse = (reasonKey) => ({ ok: false, reasonKey, code: null, note: "", callbackAt: null });

/**
 * From what the form holds to the disposition call.
 *
 * @param key         a CHOICE_* key.
 * @param note        the rep's words, clipped to OUTCOME_NOTE_MAX.
 * @param whenKind    for Call back: a WHEN_* kind, or null for no time.
 * @param whenAt      for WHEN_PICK: the chosen instant.
 * @param notOwner    for Call back with no time: they were not the owner.
 * @param interested  for Call back with no time: interested, follow up.
 * @param which       for Wrong number / not a business: a WHICH_* value.
 * @param now         the clock.
 * @returns {{ ok: true, code, note, callbackAt: Date|null } | { ok: false, reasonKey }}
 */
export function foldChoice(input) {
  const { key, note = "", whenKind = null, whenAt = null, notOwner = false, interested = false, which = null, now = new Date() } =
    input && typeof input === "object" ? input : {};
  const text = typeof note === "string" ? note.trim().slice(0, OUTCOME_NOTE_MAX) : "";
  const done = (code, callbackAt = null) => ({ ok: true, reasonKey: null, code, note: text, callbackAt });

  switch (key) {
    case CHOICE_SENT_LINK:
      return done("agreed_link_sent");
    case CHOICE_VOICEMAIL:
      return done("voicemail");
    case CHOICE_NOT_NOW:
      return done("reached_not_interested");
    case CHOICE_CALL_BACK: {
      if (whenKind) {
        const at = callbackTimeFor(whenKind, { now, at: whenAt });
        if (!at) return refuse("app.salesCall.choice.call_back.needsTime");
        return done("callback", at);
      }
      // No time: the tick says who they spoke to. Both ticked is a callback
      // with the owner who is interested — and no time, which is the one
      // thing this cannot invent.
      if (notOwner && !interested) return done("gatekeeper");
      if (interested && !notOwner) return done("reached_interested");
      return refuse("app.salesCall.choice.call_back.needsTimeOrTick");
    }
    case CHOICE_NO_CALLBACKS:
      if (!text) return refuse("app.salesCall.choice.no_callbacks.needsWords");
      return done("do_not_call");
    case CHOICE_WRONG_OR_NOT_BUSINESS:
      if (which === WHICH_WRONG_NUMBER) return done("bad_number");
      if (which === WHICH_NOT_A_BUSINESS) {
        if (!text) return refuse("app.salesCall.choice.wrong_or_not_business.needsWords");
        return done("not_a_fit");
      }
      return refuse("app.salesCall.choice.wrong_or_not_business.needsWhich");
    default:
      return refuse("app.salesCall.choice.unknown");
  }
}

/** Every reason key foldChoice can print, for the copy check. */
export const CHOICE_REFUSAL_KEYS = Object.freeze([
  "app.salesCall.choice.call_back.needsTime",
  "app.salesCall.choice.call_back.needsTimeOrTick",
  "app.salesCall.choice.no_callbacks.needsWords",
  "app.salesCall.choice.wrong_or_not_business.needsWords",
  "app.salesCall.choice.wrong_or_not_business.needsWhich",
  "app.salesCall.choice.unknown",
]);

/**
 * The invariants a check holds: every offered code is real, none of the
 * line's codes is offered, and — with the line's three — the buttons cover
 * the whole table, so no outcome has become unreachable.
 */
export function choiceCoverage() {
  const offered = new Set(OFFERED_CODES);
  const unknown = OFFERED_CODES.filter((c) => !isDisposition(c));
  const autoOffered = AUTO_LOGGED_CODES.filter((c) => offered.has(c));
  const unreachable = Object.keys(DISPOSITIONS).filter((c) => !offered.has(c) && !AUTO_LOGGED_CODES.includes(c));
  return { unknown, autoOffered, unreachable, ok: unknown.length === 0 && autoOffered.length === 0 && unreachable.length === 0 };
}
