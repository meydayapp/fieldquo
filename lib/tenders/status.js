// lib/tenders/status.js
//
// The life of a bid, as a table:
//
//   watching ──▶ bid ──▶ preparing ──▶ submitted ──▶ won / lost
//      │          │          │              ├──▶ cancelled (by the buyer)
//      └──▶ no_bid ◀─────────┘              └──▶ withdrawn (by us)
//
// Pure, so scripts/check-tenders.mjs walks every pair. A transition not in
// the table is refused with 409 — never applied "close enough". A few
// backward edges exist on purpose, each a correction somebody will need:
// no_bid → watching (reconsidered), won/lost → submitted (marked the wrong
// one), cancelled → watching (the buyer re-issued it), withdrawn →
// submitted (withdrawn in error).
//
// What each move REQUIRES is decided here too, so the route cannot accept a
// "lost" with a negative winning price or a "no_bid" with no reason.
import { TENDER_STATUSES, LIMITS, MAX_MONEY } from "./constants";

export const TENDER_TRANSITIONS = Object.freeze({
  watching: Object.freeze(["bid", "no_bid", "cancelled"]),
  bid: Object.freeze(["preparing", "submitted", "no_bid", "cancelled"]),
  no_bid: Object.freeze(["watching", "bid"]),
  preparing: Object.freeze(["submitted", "no_bid", "cancelled"]),
  submitted: Object.freeze(["won", "lost", "cancelled", "withdrawn"]),
  won: Object.freeze(["submitted"]),
  lost: Object.freeze(["submitted"]),
  cancelled: Object.freeze(["watching"]),
  withdrawn: Object.freeze(["submitted"]),
});

/** May a tender move from `from` to `to`? */
export function canTransition(from, to) {
  if (!Object.prototype.hasOwnProperty.call(TENDER_TRANSITIONS, from)) return false;
  return TENDER_TRANSITIONS[from].includes(to);
}

/** Next statuses offered from `from`, in table order. */
export function nextStatuses(from) {
  return Object.prototype.hasOwnProperty.call(TENDER_TRANSITIONS, from) ? [...TENDER_TRANSITIONS[from]] : [];
}

/** Money fields a transition can carry — the route gates them on showPricing. */
export const TRANSITION_MONEY_FIELDS = Object.freeze(["awardedValue", "winningPrice"]);

function text(value, max, label) {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: `${label} must be text.` };
  const v = value.trim();
  if (v.length > max) return { ok: false, error: `${label} is longer than ${max} characters.` };
  return { ok: true, value: v || null };
}

/** A money amount: number or numeric string, ≥ 0, two decimals at most. */
export function parseMoney(value, label) {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  const s = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim().replace(/[,$\s]/g, "") : null;
  if (s === null || !/^\d+(\.\d{1,2})?$/.test(s)) return { ok: false, error: `${label} must be an amount like 125000 or 125000.50.` };
  const n = Number(s);
  if (!Number.isFinite(n) || n > MAX_MONEY) return { ok: false, error: `${label} is too large.` };
  return { ok: true, value: s };
}

/**
 * Validate a move and build the `data` the route writes.
 *
 * @param {object} tender  the stored row (status at least)
 * @param {string} to      the requested status
 * @param {object} input   the request body's extra fields
 * @param {Date}   now
 * @returns {{ ok: true, data } | { ok: false, status: number, error: string }}
 */
export function planTransition(tender, to, input = {}, now = new Date()) {
  const from = tender?.status;
  if (typeof to !== "string" || !TENDER_STATUSES.includes(to)) {
    return { ok: false, status: 400, error: "That isn't a tender status." };
  }
  if (from === to) return { ok: false, status: 409, error: "The tender is already in that status." };
  if (!canTransition(from, to)) {
    return { ok: false, status: 409, error: `A tender can't go from ${from} to ${to}.` };
  }
  const body = input && typeof input === "object" ? input : {};
  const data = { status: to };

  const take = (field, max, label) => {
    const r = text(body[field], max, label);
    if (!r.ok) throw r;
    return r.value;
  };
  const money = (field, label) => {
    const r = parseMoney(body[field], label);
    if (!r.ok) throw r;
    return r.value;
  };

  try {
    switch (to) {
      case "bid":
        data.decisionReason = take("reason", LIMITS.reason, "The reason");
        data.decidedAt = now;
        break;
      case "no_bid": {
        const reason = take("reason", LIMITS.reason, "The reason");
        if (!reason) return { ok: false, status: 400, error: "Say why you're not bidding — it's what the next similar tender is decided on." };
        data.decisionReason = reason;
        data.decidedAt = now;
        break;
      }
      case "submitted": {
        let submittedAt = now;
        if (body.submittedAt !== undefined && body.submittedAt !== null && body.submittedAt !== "") {
          const d = new Date(body.submittedAt);
          if (typeof body.submittedAt !== "string" || !Number.isFinite(d.getTime())) {
            return { ok: false, status: 400, error: "The submitted time isn't a date." };
          }
          if (d.getTime() > now.getTime() + 5 * 60 * 1000) {
            return { ok: false, status: 400, error: "A bid can't be submitted in the future." };
          }
          submittedAt = d;
        }
        // A correction (won/lost/withdrawn → submitted) keeps the original
        // submission time unless a new one is given.
        if (["won", "lost", "withdrawn"].includes(from) && tender.submittedAt && body.submittedAt == null) {
          submittedAt = tender.submittedAt;
        }
        data.submittedAt = submittedAt;
        const confirmation = take("confirmationNumber", LIMITS.confirmationNumber, "The confirmation number");
        if (confirmation !== null || !tender.confirmationNumber) data.confirmationNumber = confirmation;
        break;
      }
      case "won":
        data.contractNumber = take("contractNumber", LIMITS.contractNumber, "The contract number");
        data.awardedValue = money("awardedValue", "The contract value");
        data.awardedAt = now;
        break;
      case "lost":
        data.winningPrice = money("winningPrice", "The winning price");
        data.winnerName = take("winnerName", LIMITS.winnerName, "The winner");
        data.debriefNotes = take("debriefNotes", LIMITS.debriefNotes, "The debrief notes");
        data.closedAt = now;
        break;
      case "cancelled":
      case "withdrawn":
        data.closedReason = take("reason", LIMITS.reason, "The reason");
        data.closedAt = now;
        break;
      case "watching":
      case "preparing":
        break;
      default:
        break;
    }
  } catch (err) {
    if (err && err.ok === false) return { ok: false, status: 400, error: err.error };
    throw err;
  }
  return { ok: true, data };
}
